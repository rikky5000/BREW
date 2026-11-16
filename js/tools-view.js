import { icons } from './icons.js';
import { load, save } from './storage.js';
import { getEquipment, saveEquipment } from './equipment.js';
import { fmt } from './water.js';
import { esc, toast } from './ui.js';
import { getRecipes, getRecipe, saveRecipe, extractPoints, measuredEfficiency, calcRecipe } from './recipes.js';
import { getActiveRecipeId } from './recipe-view.js';

const INPUT_KEY = 'tool-efficiency';
const LOG_KEY = 'efficiency-log';

// ---------- Verktyg: verkningsgrad ----------
export function renderTools(view) {
  const eq = getEquipment();
  const recipes = getRecipes();
  const state = load(INPUT_KEY, {
    recipeId: getActiveRecipeId() || recipes[0]?.id || '',
    og: '', postL: '', hot: true, fermL: '', preSg: '', preL: '',
  });
  if (!recipes.some((r) => r.id === state.recipeId)) state.recipeId = recipes[0]?.id || '';

  view.innerHTML = `
    <div class="page-head">${icons.calc}<div><h1>Verktyg</h1><p>Mät din verkningsgrad</p></div></div>

    ${recipes.length ? `
    <h2 class="section-title">Verkningsgrad</h2>
    <form class="card" id="t-form" autocomplete="off">
      <div class="field text"><label for="t-recipe">Recept</label><div class="input-wrap"><select id="t-recipe" name="recipeId">
        ${recipes.map((r) => `<option value="${r.id}"${r.id === state.recipeId ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}
      </select></div></div>
      <p class="note" id="t-points"></p>

      <h3 class="sub-title">Efter kok</h3>
      ${field('og', 'OG', 'Kylt prov, 20 °C', state.og, '', '0.001')}
      ${field('postL', 'Volym i kärlet efter kok', 'Före överföring', state.postL, 'L', '0.1')}
      <label class="toggle-row" for="t-hot">
        <span>Volymen mätt varm<small>Räknas om med krympning ${fmt(eq.coolingShrinkage)} %</small></span>
        <input id="t-hot" name="hot" type="checkbox" class="switch"${state.hot ? ' checked' : ''}>
      </label>
      ${field('fermL', 'Volym i jäskärl', 'Valfritt – för totalt utbyte', state.fermL, 'L', '0.1')}

      <h3 class="sub-title">Före kok (valfritt)</h3>
      ${field('preSg', 'Densitet före kok', 'Kylt prov', state.preSg, '', '0.001')}
      ${field('preL', 'Volym före kok', 'Mätt varm om reglaget ovan är på', state.preL, 'L', '0.1')}
    </form>

    <h2 class="section-title">Resultat</h2>
    <div class="card" id="t-out"></div>

    <h2 class="section-title">Historik</h2>
    <div class="card" id="t-log"></div>
    ` : `<div class="card empty"><p>Skapa eller importera ett recept först.</p>
      <div class="btn-row"><a class="btn primary" href="#/recept">Till recept</a></div></div>`}
  `;
  if (!recipes.length) return;

  const form = view.querySelector('#t-form');
  const out = view.querySelector('#t-out');
  let last = null;

  function update() {
    const data = Object.fromEntries(new FormData(form));
    Object.assign(state, data, { hot: form.hot.checked });
    save(INPUT_KEY, state);

    const r = getRecipe(state.recipeId);
    const { grainPts, sugarPts } = extractPoints(r);
    const c = calcRecipe(r, eq);
    view.querySelector('#t-points').textContent =
      `Maltens maxpoäng: ${fmt(grainPts, 0)}${sugarPts ? ` + socker ${fmt(sugarPts, 0)}` : ''} · ${fmt(c.grainKg)} kg malt · receptets verkningsgrad ${fmt(+r.efficiency)} %`;

    const k = state.hot ? 1 - (eq.coolingShrinkage || 0) / 100 : 1;
    const og = num(state.og); const postL = num(state.postL) * k;
    const effPost = measuredEfficiency(r, og, postL);
    const effTotal = num(state.fermL) ? measuredEfficiency(r, og, num(state.fermL)) : null;
    const effPre = measuredEfficiency(r, num(state.preSg), num(state.preL) * k);
    const lossL = num(state.fermL) ? postL - num(state.fermL) : null;
    last = effPost != null ? { effPost, effTotal, effPre, lossL, r } : null;

    const box = (label, v, primary, hint) => `<div class="result${primary ? ' primary' : ''}"><span>${label}</span><b>${v == null ? '–' : `${fmt(v)} %`}</b>${hint ? `<small class="hint">${hint}</small>` : ''}</div>`;
    out.innerHTML = `
      <div class="results">
        ${box('Utbyte efter kok', effPost, true, 'Appens verkningsgrad')}
        ${box('Totalt utbyte', effTotal, false, 'Till jäskärl')}
        ${box('Mäskutbyte', effPre, false, 'Före kok')}
        <div class="result"><span>Förlust i kärl</span><b>${lossL == null ? '–' : `${fmt(lossL)} L`}</b><small class="hint">Profil: ${fmt(eq.kettleLoss)} L</small></div>
      </div>
      ${effPost == null ? '<p class="note">Fyll i OG och volym efter kok.</p>' : ''}
      ${effPost != null && (effPost < 50 || effPost > 100) ? '<div class="alert warn">Värdet ser orimligt ut – kontrollera OG, volym och receptets malt.</div>' : ''}
      ${effPost != null ? `
      <div class="btn-row stack">
        <button class="btn primary" type="button" id="t-log-add">Spara mätning i historiken</button>
        <button class="btn" type="button" id="t-to-recipe">Använd ${fmt(effPost)} % i receptet</button>
        <button class="btn" type="button" id="t-to-eq">Använd ${fmt(effPost)} % i utrustningen</button>
        ${lossL != null && lossL >= 0 ? `<button class="btn" type="button" id="t-loss-eq">Använd ${fmt(lossL)} L som förlust i kärl</button>` : ''}
      </div>` : ''}
    `;
  }

  function renderLog() {
    const log = load(LOG_KEY, { list: [] }).list;
    const el = view.querySelector('#t-log');
    if (!log.length) { el.innerHTML = '<p class="note">Inga sparade mätningar ännu. Spara 2–3 bryggningar för ett pålitligt medelvärde.</p>'; return; }
    const avg = log.reduce((s, x) => s + x.eff, 0) / log.length;
    el.innerHTML = `
      <ul class="dose">${log.map((x, i) => `
        <li><span>${esc(x.date)} · ${esc(x.recipe)}</span><b>${fmt(x.eff)} % <button class="icon-btn" data-del="${i}" aria-label="Ta bort">×</button></b></li>`).join('')}
      </ul>
      <div class="results" style="margin-top:10px"><div class="result primary wide"><span>Medelvärde (${log.length} st)</span><b>${fmt(avg)} %</b></div></div>
      <div class="btn-row"><button class="btn" type="button" id="t-avg-eq">Använd medelvärdet i utrustningen</button></div>
    `;
    el.querySelector('#t-avg-eq').addEventListener('click', () => setEquipmentEff(avg));
    el.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
      log.splice(+b.dataset.del, 1);
      save(LOG_KEY, { list: log });
      renderLog();
    }));
  }

  function setEquipmentEff(v) {
    const e = getEquipment();
    e.efficiency = Math.round(v * 10) / 10;
    saveEquipment(e);
    toast(`Utrustning: ${fmt(e.efficiency)} %`);
  }

  form.addEventListener('input', update);
  // Bara reglage och listor via change – annars ritas knapparna om när ett fält tappar fokus.
  form.addEventListener('change', (e) => {
    if (e.target.type === 'checkbox' || e.target.tagName === 'SELECT') update();
  });
  out.addEventListener('click', (e) => {
    if (!last) return;
    if (e.target.id === 't-log-add') {
      const log = load(LOG_KEY, { list: [] }).list;
      log.unshift({ date: new Date().toISOString().slice(0, 10), recipe: last.r.name, eff: Math.round(last.effPost * 10) / 10 });
      save(LOG_KEY, { list: log.slice(0, 20) });
      renderLog();
      toast('Mätning sparad');
    } else if (e.target.id === 't-to-recipe') {
      last.r.efficiency = Math.round(last.effPost * 10) / 10;
      saveRecipe(last.r);
      toast(`${last.r.name}: ${fmt(last.r.efficiency)} %`);
      update();
    } else if (e.target.id === 't-to-eq') {
      setEquipmentEff(last.effPost);
    } else if (e.target.id === 't-loss-eq') {
      const eqNow = getEquipment();
      eqNow.kettleLoss = Math.round(last.lossL * 10) / 10;
      saveEquipment(eqNow);
      toast(`Förlust i kärl: ${fmt(eqNow.kettleLoss)} L`);
    }
  });

  update();
  renderLog();
}

function field(name, label, hint, value, unit, step) {
  return `
    <div class="field">
      <label for="t-${name}">${label}${hint ? `<small>${hint}</small>` : ''}</label>
      <div class="input-wrap"><input id="t-${name}" name="${name}" type="number" inputmode="decimal" step="${step}" value="${esc(value)}"><span class="unit">${unit}</span></div>
    </div>`;
}

function num(v) {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}
