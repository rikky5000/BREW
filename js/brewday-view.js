import { icons } from './icons.js';
import { load, save } from './storage.js';
import { getEquipment } from './equipment.js';
import { fmt } from './water.js';
import { esc, toast } from './ui.js';
import { getRecipes, getRecipe, calcRecipe, measuredEfficiency } from './recipes.js';
import { getActiveRecipeId } from './recipe-view.js';
import {
  getSession, saveSession, finishSession, buildSession,
  timerState, elapsedMs, remainingMs, dueAlarms, fmtClock,
} from './brewday.js';

let ticker = null;
let wakeLock = null;
let audioCtx = null;

export function renderBrewday(view) {
  clearInterval(ticker);
  const session = getSession();
  if (session) renderSession(view, session);
  else renderStart(view);
}

// ---------- Start ----------
function renderStart(view) {
  const eq = getEquipment();
  const recipes = getRecipes();
  let selected = getActiveRecipeId() && getRecipe(getActiveRecipeId()) ? getActiveRecipeId() : recipes[0]?.id;

  view.innerHTML = `
    <div class="page-head">${icons.timer}<div><h1>Bryggdag</h1><p>Steg för steg med timrar och larm</p></div></div>
    ${recipes.length ? `
      <div class="card">
        <div class="field text"><label for="b-recipe">Recept</label><div class="input-wrap"><select id="b-recipe">
          ${recipes.map((r) => `<option value="${r.id}"${r.id === selected ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}
        </select></div></div>
        <div id="b-summary"></div>
      </div>
      <button class="btn primary block" id="b-start" type="button">Starta bryggdag</button>
      <p class="note">Vid start förs receptet över till Vatten &amp; Kemi, så att salter, syra och volymer i checklistan stämmer.</p>
    ` : `<div class="card empty"><p>Skapa eller importera ett recept först.</p>
        <div class="btn-row"><a class="btn primary" href="#/recept">Till recept</a></div></div>`}
  `;
  if (!recipes.length) return;

  const summary = () => {
    const r = getRecipe(selected);
    const c = calcRecipe(r, eq);
    const boilHops = r.hops.filter((h) => h.use === 'boil').length;
    view.querySelector('#b-summary').innerHTML = `
      <ul class="kv">
        <li><span>Volym</span><b>${fmt(+r.batchL)} L · ${fmt(+r.boilMin, 0)} min kok</b></li>
        <li><span>Malt</span><b>${fmt(c.grainKg, 2)} kg · mäsk ${fmt(+r.mashTemp)} °C</b></li>
        <li><span>OG / FG</span><b>${c.og.toFixed(3)} / ${c.fg.toFixed(3)} · ${fmt(c.abv)} %</b></li>
        <li><span>Humle</span><b>${boilHops} givor i kok · ${r.hops.length - boilHops} övriga</b></li>
        <li><span>Jäst</span><b>${esc(r.yeast?.name || '–')}</b></li>
      </ul>`;
  };
  view.querySelector('#b-recipe').addEventListener('change', (e) => { selected = e.target.value; summary(); });
  view.querySelector('#b-start').addEventListener('click', () => {
    unlockAudio();
    const s = buildSession(getRecipe(selected), eq);
    saveSession(s);
    renderSession(view, s);
    window.scrollTo(0, 0);
  });
  summary();
}

// ---------- Pågående bryggdag ----------
function renderSession(view, session) {
  const eq = getEquipment();
  const persist = () => saveSession(session);
  const allTasks = session.steps.flatMap((s) => s.tasks);

  view.innerHTML = `
    <div class="page-head">${icons.timer}<div><h1>Bryggdag</h1><p>${esc(session.recipeName)} · start ${new Date(session.startedAt).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}</p></div></div>
    <div class="card bd-top">
      <div class="progress"><div class="bar" id="bd-bar"></div></div>
      <p class="note" id="bd-progress"></p>
      <div id="bd-running"></div>
      <div class="btn-row">
        <button class="btn" type="button" id="bd-wake">Håll skärmen tänd</button>
        <button class="btn" type="button" id="bd-notify">Aktivera larm</button>
      </div>
    </div>
    <div id="bd-steps"></div>

    <h2 class="section-title">Anteckningar</h2>
    <div class="card"><textarea id="bd-notes" rows="3" placeholder="Avvikelser, smak, idéer …">${esc(session.m.notes || '')}</textarea></div>

    <div class="btn-row stack">
      <button class="btn primary" type="button" id="bd-finish">Avsluta bryggdag</button>
      <button class="btn danger" type="button" id="bd-cancel">Avbryt utan att spara</button>
    </div>
    <div class="alarm" id="bd-alarm" hidden>
      <div class="alarm-box">
        <strong>⏰ Larm</strong>
        <ul id="bd-alarm-list"></ul>
        <button class="btn primary block" type="button" id="bd-alarm-ok">OK</button>
      </div>
    </div>
  `;

  const stepsEl = view.querySelector('#bd-steps');

  // ---------- Steg ----------
  function renderSteps() {
    stepsEl.innerHTML = session.steps.map((st, i) => {
      const done = st.tasks.filter((t) => t.done).length;
      const open = session.open === st.id;
      const complete = done === st.tasks.length;
      return `
        <section class="card step${open ? ' open' : ''}${complete ? ' complete' : ''}" data-step="${st.id}">
          <button class="step-head" type="button" data-toggle="${st.id}" aria-expanded="${open}">
            <span class="step-no">${complete ? '✓' : i + 1}</span>
            <span class="step-title">${esc(st.title)}</span>
            <span class="step-count">${done}/${st.tasks.length}</span>
          </button>
          ${open ? `
          <div class="step-body">
            ${(st.timers || []).map((t) => timerHtml(t)).join('')}
            <ul class="tasks">
              ${st.tasks.map((t) => `
                <li class="${t.done ? 'done' : ''}">
                  <label><input type="checkbox" data-task="${t.id}"${t.done ? ' checked' : ''}><span>${esc(t.text)}</span></label>
                  ${t.measure ? measureHtml(t.measure) : ''}
                </li>`).join('')}
            </ul>
            ${st.id === 'chill' ? '<div id="bd-eff"></div>' : ''}
            ${!complete ? `<div class="btn-row"><button class="btn" type="button" data-all="${st.id}">Markera alla klara</button></div>` : ''}
          </div>` : ''}
        </section>`;
    }).join('');
    updateProgress();
    tick(true);
    renderEfficiency();
  }

  function timerHtml(t) {
    const s = timerState(session, t);
    const running = !!s.runningSince;
    return `
      <div class="timer" data-timer="${t.id}">
        <div class="timer-head">
          <span>${esc(t.label)}</span>
          ${running || s.elapsedMs ? '' : `<label class="mini tmin"><input type="number" inputmode="numeric" min="1" step="1" data-minutes="${t.id}" value="${s.minutes}"><span>min</span></label>`}
        </div>
        <div class="clock" data-clock="${t.id}">${fmtClock(remainingMs(s))}</div>
        <div class="next" data-next="${t.id}"></div>
        <div class="btn-row">
          <button class="btn primary" type="button" data-start="${t.id}">${running ? 'Paus' : s.elapsedMs ? 'Fortsätt' : 'Starta'}</button>
          <button class="btn" type="button" data-plus="${t.id}">+1 min</button>
          <button class="btn" type="button" data-reset="${t.id}">Nollställ</button>
        </div>
      </div>`;
  }

  function measureHtml(key) {
    const m = session.m;
    const input = (k, ph, unit, step) => `<label class="mini m-in"><input type="number" inputmode="decimal" step="${step}" data-m="${k}" value="${m[k] ?? ''}" placeholder="${ph}"><span>${unit}</span></label>`;
    const fields = {
      mashPh: input('mashPh', fmt(session.expected.mashPh, 2), 'pH', '0.01'),
      preBoil: input('preBoilL', fmt(session.expected.preBoilL), 'L', '0.1') + input('preBoilSg', session.expected.preBoilSg.toFixed(3), 'SG', '0.001'),
      postBoil: input('postBoilL', fmt(session.expected.postBoilL), 'L', '0.1'),
      og: input('og', session.expected.og.toFixed(3), 'SG', '0.001'),
      ferm: input('fermL', fmt(session.expected.batchL), 'L', '0.1'),
    };
    return `<div class="measure">${fields[key]}</div>`;
  }

  function renderEfficiency() {
    const el = view.querySelector('#bd-eff');
    if (!el) return;
    const m = session.m;
    const k = 1 - (eq.coolingShrinkage || 0) / 100;
    const eff = measuredEfficiency(session.recipe, +m.og, (+m.postBoilL || 0) * k);
    const tot = m.fermL ? measuredEfficiency(session.recipe, +m.og, +m.fermL) : null;
    if (eff == null) { el.innerHTML = '<p class="note">Fyll i volym efter kok och OG för att se verkningsgraden.</p>'; return; }
    el.innerHTML = `
      <div class="results">
        <div class="result primary"><span>Utbyte efter kok</span><b>${fmt(eff)} %</b><small class="hint">Recept: ${fmt(+session.recipe.efficiency)} %</small></div>
        <div class="result"><span>Totalt utbyte</span><b>${tot == null ? '–' : `${fmt(tot)} %`}</b></div>
      </div>
      <div class="btn-row"><button class="btn" type="button" id="bd-eff-log"${session.effLogged ? ' disabled' : ''}>${session.effLogged ? '✓ Sparad i historiken' : 'Spara i verkningsgradshistoriken'}</button></div>`;
  }

  function updateProgress() {
    const done = allTasks.filter((t) => t.done).length;
    view.querySelector('#bd-bar').style.width = `${(done / allTasks.length) * 100}%`;
    view.querySelector('#bd-progress').textContent = `${done} av ${allTasks.length} moment klara`;
  }

  // ---------- Timrar & larm ----------
  const timers = session.steps.flatMap((st) => (st.timers || []).map((t) => ({ ...t, step: st.id })));

  function tick(force = false) {
    if (!document.body.contains(stepsEl)) { clearInterval(ticker); return; }
    const now = Date.now();
    const fired = [];
    const running = [];
    for (const t of timers) {
      const s = timerState(session, t);
      const due = dueAlarms(s, t, now);
      fired.push(...due);
      if (s.runningSince && remainingMs(s, now) <= 0) {
        s.elapsedMs = s.minutes * 60000; s.runningSince = null; force = true;
      }
      if (s.runningSince) running.push({ t, s });
      const clock = view.querySelector(`[data-clock="${t.id}"]`);
      if (clock) clock.textContent = fmtClock(remainingMs(s, now));
      const next = view.querySelector(`[data-next="${t.id}"]`);
      if (next) next.textContent = nextAlarmText(t, s, now);
    }
    view.querySelector('#bd-running').innerHTML = running.map(({ t, s }) => `
      <a class="running" href="#/bryggdag" data-goto="${t.step}"><span>${esc(t.label)}</span><b>${fmtClock(remainingMs(s, now))}</b></a>`).join('');
    if (fired.length) { persist(); showAlarm(fired); }
    if (force) persist();
    if (force) {
      // uppdatera knapptexter när en timer gått klart
      timers.forEach((t) => {
        const b = view.querySelector(`[data-start="${t.id}"]`);
        const s = timerState(session, t);
        if (b) b.textContent = s.runningSince ? 'Paus' : remainingMs(s, now) <= 0 ? 'Klar' : s.elapsedMs ? 'Fortsätt' : 'Starta';
      });
    }
  }

  function nextAlarmText(t, s, now) {
    const el = elapsedMs(s, now);
    const upcoming = t.alarms
      .map((a) => ({ ...a, ms: (a.at === 'end' ? s.minutes : a.at) * 60000 }))
      .filter((a) => a.ms > el && a.at !== 'end')
      .sort((a, b) => a.ms - b.ms)[0];
    return upcoming ? `Nästa: ${upcoming.text} om ${fmtClock(upcoming.ms - el)}` : '';
  }

  function showAlarm(texts) {
    const box = view.querySelector('#bd-alarm');
    const list = view.querySelector('#bd-alarm-list');
    list.innerHTML += texts.map((t) => `<li>${esc(t)}</li>`).join('');
    box.hidden = false;
    beep();
    if (navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 400]);
    notify(texts.join(' · '));
  }

  ticker = setInterval(() => tick(), 1000);
  document.addEventListener('visibilitychange', onVisible);
  function onVisible() {
    if (!document.body.contains(stepsEl)) { document.removeEventListener('visibilitychange', onVisible); return; }
    if (!document.hidden) { tick(true); if (wakeLock) requestWake(); }
  }

  // ---------- Händelser ----------
  stepsEl.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.toggle) {
      session.open = session.open === t.dataset.toggle ? null : t.dataset.toggle;
      persist(); renderSteps();
    } else if (t.dataset.start) {
      unlockAudio();
      const timer = timers.find((x) => x.id === t.dataset.start);
      const s = timerState(session, timer);
      if (remainingMs(s) <= 0) return;
      if (s.runningSince) { s.elapsedMs = elapsedMs(s); s.runningSince = null; } else { s.runningSince = Date.now(); }
      persist(); renderSteps();
    } else if (t.dataset.plus) {
      const s = timerState(session, timers.find((x) => x.id === t.dataset.plus));
      s.minutes += 1;
      persist(); renderSteps();
    } else if (t.dataset.reset) {
      if (!confirm('Nollställa timern?')) return;
      const timer = timers.find((x) => x.id === t.dataset.reset);
      session.timers[timer.id] = { elapsedMs: 0, runningSince: null, fired: [], minutes: timer.minutes };
      persist(); renderSteps();
    } else if (t.dataset.all) {
      session.steps.find((s) => s.id === t.dataset.all).tasks.forEach((x) => { if (!x.done) { x.done = true; x.doneAt = Date.now(); } });
      openNext(); persist(); renderSteps();
    } else if (t.id === 'bd-eff-log') {
      const k = 1 - (eq.coolingShrinkage || 0) / 100;
      const eff = measuredEfficiency(session.recipe, +session.m.og, (+session.m.postBoilL || 0) * k);
      const log = load('efficiency-log', { list: [] }).list;
      log.unshift({ date: new Date().toISOString().slice(0, 10), recipe: session.recipeName, eff: Math.round(eff * 10) / 10 });
      save('efficiency-log', { list: log.slice(0, 20) });
      session.effLogged = true;
      persist(); renderEfficiency();
      toast('Sparad – se Verktyg');
    }
  });

  stepsEl.addEventListener('change', (e) => {
    if (e.target.dataset.task) {
      const task = allTasks.find((x) => x.id === e.target.dataset.task);
      task.done = e.target.checked;
      task.doneAt = task.done ? Date.now() : null;
      e.target.closest('li').classList.toggle('done', task.done);
      const st = session.steps.find((s) => s.tasks.includes(task));
      if (st.tasks.every((x) => x.done)) { openNext(); persist(); renderSteps(); return; }
      persist(); updateProgress();
      const head = e.target.closest('.step').querySelector('.step-count');
      head.textContent = `${st.tasks.filter((x) => x.done).length}/${st.tasks.length}`;
    } else if (e.target.dataset.minutes) {
      const timer = timers.find((x) => x.id === e.target.dataset.minutes);
      timerState(session, timer).minutes = Math.max(+e.target.value || 1, 1);
      persist(); tick();
    }
  });

  stepsEl.addEventListener('input', (e) => {
    if (!e.target.dataset.m) return;
    const v = parseFloat(String(e.target.value).replace(',', '.'));
    session.m[e.target.dataset.m] = Number.isFinite(v) ? v : null;
    persist(); renderEfficiency();
  });

  view.querySelector('#bd-running').addEventListener('click', (e) => {
    const a = e.target.closest('[data-goto]');
    if (!a) return;
    e.preventDefault();
    session.open = a.dataset.goto; persist(); renderSteps();
    stepsEl.querySelector(`[data-step="${a.dataset.goto}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });

  view.querySelector('#bd-notes').addEventListener('input', (e) => { session.m.notes = e.target.value; persist(); });

  view.querySelector('#bd-alarm-ok').addEventListener('click', () => {
    view.querySelector('#bd-alarm').hidden = true;
    view.querySelector('#bd-alarm-list').innerHTML = '';
    stopBeep();
  });

  const wakeBtn = view.querySelector('#bd-wake');
  if (!('wakeLock' in navigator)) wakeBtn.hidden = true;
  wakeBtn.addEventListener('click', async () => {
    if (wakeLock) { await wakeLock.release().catch(() => {}); wakeLock = null; wakeBtn.textContent = 'Håll skärmen tänd'; return; }
    await requestWake();
    wakeBtn.textContent = wakeLock ? 'Skärmen hålls tänd ✓' : 'Håll skärmen tänd';
  });
  if (wakeLock) wakeBtn.textContent = 'Skärmen hålls tänd ✓';

  const notifyBtn = view.querySelector('#bd-notify');
  const notifyLabel = () => {
    if (!('Notification' in window)) { notifyBtn.textContent = 'Ljudlarm aktivt'; return; }
    notifyBtn.textContent = Notification.permission === 'granted' ? 'Larm aktiva ✓' : 'Aktivera larm';
  };
  notifyLabel();
  notifyBtn.addEventListener('click', async () => {
    unlockAudio(); beep(1);
    if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
    notifyLabel();
  });

  view.querySelector('#bd-finish').addEventListener('click', () => {
    const left = allTasks.filter((t) => !t.done).length;
    if (!confirm(left ? `${left} moment är inte avbockade. Avsluta och spara bryggdagen ändå?` : 'Avsluta och spara bryggdagen?')) return;
    finishSession(session);
    clearInterval(ticker);
    toast('Bryggdagen sparad');
    renderBrewday(view);
  });
  view.querySelector('#bd-cancel').addEventListener('click', () => {
    if (!confirm('Avbryta bryggdagen? Avbockningar, timrar och mätningar försvinner.')) return;
    saveSession(null);
    clearInterval(ticker);
    renderBrewday(view);
  });

  function openNext() {
    const next = session.steps.find((s) => s.tasks.some((t) => !t.done));
    session.open = next ? next.id : null;
  }

  renderSteps();
}

// ---------- Skärm, ljud & notiser ----------
async function requestWake() {
  try { wakeLock = await navigator.wakeLock.request('screen'); } catch { wakeLock = null; }
}

function unlockAudio() {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch { audioCtx = null; }
}

let beepTimer = null;
function beep(times = 10) {
  if (!audioCtx) return;
  stopBeep();
  let n = 0;
  const one = () => {
    const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
    o.type = 'square'; o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.35);
    o.connect(g).connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + 0.4);
    if (++n >= times) stopBeep();
  };
  one();
  if (times > 1) beepTimer = setInterval(one, 900);
}
function stopBeep() { clearInterval(beepTimer); beepTimer = null; }

function notify(text) {
  if (!('Notification' in window) || Notification.permission !== 'granted' || !document.hidden) return;
  const opts = { body: text, icon: 'icons/icon-192.png', tag: 'brewday', renotify: true, vibrate: [400, 200, 400] };
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.ready.then((r) => r.showNotification('Bryggdag', opts)).catch(() => {});
  } else {
    try { new Notification('Bryggdag', opts); } catch { /* ignoreras */ }
  }
}

// Kort status för startsidan.
export function sessionSummary() {
  const s = getSession();
  if (!s) return null;
  const tasks = s.steps.flatMap((st) => st.tasks);
  const done = tasks.filter((t) => t.done).length;
  const step = s.steps.find((st) => st.tasks.some((t) => !t.done));
  const timers = s.steps.flatMap((st) => st.timers || []);
  const running = timers.map((t) => ({ t, st: s.timers[t.id] })).find((x) => x.st?.runningSince);
  return {
    name: s.recipeName, done, total: tasks.length, step: step?.title || 'Klar',
    running: running ? `${running.t.label} – ${fmtClock(remainingMs(running.st))} kvar` : null,
  };
}
