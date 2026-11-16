import { icons } from './icons.js';
import { load, save } from './storage.js';
import { getEquipment } from './equipment.js';
import { fmt, calcWater, WATER_KEY, waterDefaults } from './water.js';
import { esc, toast } from './ui.js';
import { TARGET_PROFILES } from './chemistry.js';
import {
  MALTS, HOPS, HOP_USES, YEASTS, STYLES,
  getRecipes, getRecipe, saveRecipe, deleteRecipe, newRecipe, calcRecipe, ebcToColor, scaleRecipe,
} from './recipes.js';

const ACTIVE_KEY = 'active-recipe';

export function getActiveRecipeId() {
  return load(ACTIVE_KEY, { id: null }).id;
}

const sg = (v) => v.toFixed(3);

// ---------- Lista ----------
export function renderRecipeList(view) {
  const eq = getEquipment();
  const list = getRecipes();
  const active = getActiveRecipeId();

  view.innerHTML = `
    <div class="page-head">${icons.book}<div><h1>Recept</h1><p>${list.length} sparade</p></div></div>
    <div class="btn-row split">
      <button class="btn primary" id="r-new" type="button">+ Nytt recept</button>
      <a class="btn" href="#/import">Importera</a>
    </div>
    <div class="recipe-list">
      ${list.length ? list.map((r) => {
        const c = calcRecipe(r, eq);
        const style = STYLES.find((s) => s.id === r.styleId);
        return `
          <a class="recipe-card" href="#/recept/${r.id}">
            <span class="swatch" style="background:${ebcToColor(c.ebc)}"></span>
            <div class="rc-body">
              <strong>${esc(r.name)}${r.id === active ? ' <span class="badge inline">Aktivt</span>' : ''}</strong>
              <small>${style ? esc(style.name) : 'Ingen stil'} · ${fmt(+r.batchL, 0)} L</small>
              <div class="chips">
                <span>OG ${sg(c.og)}</span><span>${fmt(c.abv)} %</span><span>${fmt(c.ibu, 0)} IBU</span><span>${fmt(c.ebc, 0)} EBC</span>
              </div>
            </div>
          </a>`;
      }).join('') : '<div class="card empty"><p>Inga recept ännu.</p><p class="note">Skapa ditt första recept för att räkna ut OG, ABV, IBU och färg.</p></div>'}
    </div>
  `;

  view.querySelector('#r-new').addEventListener('click', () => {
    const r = newRecipe(eq);
    saveRecipe(r);
    location.hash = `#/recept/${r.id}`;
  });
}

// ---------- Redigering ----------
export function renderRecipeEditor(view, id) {
  const eq = getEquipment();
  const recipe = getRecipe(id);
  if (!recipe) { location.hash = '#/recept'; return; }
  recipe.miscs ||= [];

  view.innerHTML = `
    <div class="page-head">
      <a class="back" href="#/recept" aria-label="Tillbaka">‹</a>
      <div><h1>Recept</h1><p id="r-title">${esc(recipe.name)}</p></div>
    </div>

    <div class="card stats" id="r-stats"></div>

    <h2 class="section-title">Grund</h2>
    <div class="card" id="r-base">
      <div class="field text"><label for="r-name">Namn</label><div class="input-wrap"><input id="r-name" data-k="name" type="text" value="${esc(recipe.name)}"></div></div>
      <div class="field"><label for="r-style">Stil (BJCP)</label><div class="input-wrap"><select id="r-style" data-k="styleId">
        <option value="">Ingen</option>
        ${STYLES.map((s) => `<option value="${s.id}"${s.id === recipe.styleId ? ' selected' : ''}>${s.id} ${esc(s.name)}</option>`).join('')}
      </select></div></div>
      ${num('batchL', 'Volym i jäskärl', recipe.batchL, 'L', 1)}
      <label class="toggle-row" for="r-scale">
        <span>Skala ingredienser med volymen<small>Behåller OG, IBU, ABV och färg</small></span>
        <input id="r-scale" type="checkbox" class="switch"${recipe.scaleWithVolume !== false ? ' checked' : ''}>
      </label>
      ${num('boilMin', 'Koktid', recipe.boilMin, 'min', 5)}
      ${num('efficiency', 'Verkningsgrad', recipe.efficiency, '%', 1)}
      ${num('mashTemp', 'Mäsktemperatur', recipe.mashTemp, '°C', 0.5)}
    </div>

    <h2 class="section-title">Vatten</h2>
    <div class="card" id="r-water">
      ${num('mashRatio', 'Mäsktjocklek', recipe.mashRatio ?? eq.mashRatio, 'L/kg', 0.05)}
      <div id="r-water-out"></div>
    </div>

    <h2 class="section-title">Malt</h2>
    <div class="card"><div id="r-malts"></div>
      <div class="ing-total" id="r-malt-total"></div>
      <div class="btn-row"><button class="btn" type="button" id="r-add-malt">+ Lägg till malt</button></div>
    </div>

    <h2 class="section-title">Humle</h2>
    <div class="card"><div id="r-hops"></div>
      <div class="ing-total" id="r-hop-total"></div>
      <div class="btn-row"><button class="btn" type="button" id="r-add-hop">+ Lägg till humle</button></div>
    </div>

    <h2 class="section-title">Jäst</h2>
    <div class="card" id="r-yeast">
      <div class="field text"><label for="r-yeast-name">Jäst</label><div class="input-wrap"><input id="r-yeast-name" data-y="name" list="dl-yeasts" type="text" value="${esc(recipe.yeast.name)}"></div></div>
      ${num('attenuation', 'Förjäsningsgrad', recipe.yeast.attenuation, '%', 1, 'data-y')}
    </div>

    <h2 class="section-title">Övrigt</h2>
    <div class="card"><div id="r-miscs"></div>
      <div class="btn-row"><button class="btn" type="button" id="r-add-misc">+ Lägg till</button></div>
    </div>

    <h2 class="section-title">Anteckningar</h2>
    <div class="card"><textarea id="r-notes" rows="4" placeholder="Smak, ändringar till nästa gång …">${esc(recipe.notes)}</textarea></div>

    <div class="btn-row stack">
      <button class="btn primary" type="button" id="r-apply">Använd i Vatten &amp; Kemi</button>
      <button class="btn" type="button" id="r-copy">Duplicera</button>
      <button class="btn danger" type="button" id="r-delete">Ta bort</button>
    </div>

    <datalist id="dl-malts">${MALTS.map((m) => `<option value="${esc(m.name)}">`).join('')}</datalist>
    <datalist id="dl-hops">${HOPS.map((h) => `<option value="${esc(h.name)}">`).join('')}</datalist>
    <datalist id="dl-yeasts">${YEASTS.map((y) => `<option value="${esc(y.name)}">`).join('')}</datalist>
  `;

  const persist = () => saveRecipe(recipe);
  const statsEl = view.querySelector('#r-stats');

  // ---------- Statistik ----------
  function renderStats() {
    renderWater();
    const c = calcRecipe(recipe, eq);
    const style = STYLES.find((s) => s.id === recipe.styleId);
    const stat = (label, value, text, range, digits) => {
      let cls = '';
      let rangeTxt = '';
      if (range) {
        cls = value < range[0] ? 'lo' : value > range[1] ? 'hi' : 'ok';
        rangeTxt = `<small>${digits === 3 ? sg(range[0]) : fmt(range[0], digits)}–${digits === 3 ? sg(range[1]) : fmt(range[1], digits)}</small>`;
      }
      return `<div class="stat ${cls}"><span>${label}</span><b>${text}</b>${rangeTxt}</div>`;
    };
    const grain = c.grainKg;
    statsEl.innerHTML = `
      <div class="stat-grid">
        ${stat('OG', c.og, sg(c.og), style?.og, 3)}
        ${stat('FG', c.fg, sg(c.fg), style?.fg, 3)}
        ${stat('ABV', c.abv, `${fmt(c.abv)} %`, style?.abv, 1)}
        ${stat('IBU', c.ibu, fmt(c.ibu, 0), style?.ibu, 0)}
        ${stat('Färg', c.ebc, `<i class="dot" style="background:${ebcToColor(c.ebc)}"></i>${fmt(c.ebc, 0)} EBC`, style?.ebc, 0)}
        ${stat('BU:GU', c.buGu, fmt(c.buGu, 2))}
      </div>
      <p class="note">Malt ${fmt(grain)} kg${grain > eq.maxGrain ? ` – <span class="warn-txt">över max ${fmt(eq.maxGrain)} kg för maltröret</span>` : ''}
        · Efter kok ${fmt(c.postBoilL)} L${style ? ' · Grönt = inom stilens intervall' : ''}</p>
    `;
  }

  // ---------- Grund ----------
  const scaling = () => recipe.scaleWithVolume !== false;
  view.querySelector('#r-base').addEventListener('input', (e) => {
    const k = e.target.dataset.k;
    if (!k) return;
    // Vid skalning hanteras volymen när fältet lämnas (change), inte per tangent.
    if (k === 'batchL' && scaling()) return;
    recipe[k] = e.target.type === 'number' ? numVal(e.target.value) : e.target.value;
    if (k === 'name') view.querySelector('#r-title').textContent = recipe.name;
    persist(); renderStats();
  });
  view.querySelector('#f-batchL').addEventListener('change', (e) => {
    if (!scaling()) return;
    const next = numVal(e.target.value);
    if (next <= 0 || next === +recipe.batchL) return;
    scaleRecipe(recipe, next, eq);
    persist(); renderMalts(); renderHops(); renderMiscs(); renderStats();
    toast(`Skalat till ${fmt(next, 1)} L`);
  });
  view.querySelector('#r-scale').addEventListener('change', (e) => {
    recipe.scaleWithVolume = e.target.checked;
    persist();
  });

  // ---------- Vatten ----------
  const waterOut = view.querySelector('#r-water-out');
  function renderWater() {
    const c = calcRecipe(recipe, eq);
    const w = calcWater({
      grainKg: c.grainKg, batchL: recipe.batchL, boilMin: recipe.boilMin,
      mashRatio: recipe.mashRatio ?? eq.mashRatio, mashTemp: recipe.mashTemp, grainTemp: 18,
    }, eq);
    const fw = recipe.fileWater;
    const row = (label, app, file) => `<tr><td>${label}</td><td>${fmt(app)} L</td>${fw ? `<td>${file == null ? '–' : `${fmt(file)} L`}</td>` : ''}</tr>`;
    waterOut.innerHTML = `
      <table class="ions cmp">
        <thead><tr><th></th><th>Appen</th>${fw ? `<th>Filen${fw.batchL && fw.batchL !== +recipe.batchL ? ` (${fmt(fw.batchL, 0)} L)` : ''}</th>` : ''}</tr></thead>
        <tbody>
          ${row('Mäskvatten', w.mash, fw?.mashL)}
          ${row('Lakvatten', w.sparge, fw?.spargeL)}
          ${row('Totalt vatten', w.total, fw ? fw.mashL + fw.spargeL : null)}
          ${row('Före kok', w.preBoil, null)}
        </tbody>
      </table>
      <p class="note">Insläppstemperatur ${fmt(w.strikeTemp)} °C. Appen räknar med din utrustningsprofil
        (avkok ${fmt(eq.boilOffRate)} L/h, förlust ${fmt(eq.kettleLoss)} L, absorption ${fmt(eq.grainAbsorption, 2)} L/kg).
        ${fw ? 'Filens värden gäller originalreceptet och dess utrustning.' : ''}</p>
      ${w.warnings.map((x) => `<div class="alert warn">${esc(x)}</div>`).join('')}
      ${fw && c.grainKg > 0 ? '<div class="btn-row"><button class="btn" type="button" id="r-match-mash">Matcha filens mäskvatten</button></div>' : ''}
    `;
  }
  view.querySelector('#r-water').addEventListener('input', (e) => {
    if (e.target.dataset.k !== 'mashRatio') return;
    recipe.mashRatio = numVal(e.target.value);
    persist(); renderWater();
  });
  waterOut.addEventListener('click', (e) => {
    if (e.target.id !== 'r-match-mash') return;
    const c = calcRecipe(recipe, eq);
    const orig = recipe.fileWater.mashL * ((+recipe.batchL + eq.kettleLoss) / ((recipe.fileWater.batchL ?? +recipe.batchL) + eq.kettleLoss));
    recipe.mashRatio = Math.round((orig / c.grainKg) * 100) / 100;
    view.querySelector('#f-mashRatio').value = recipe.mashRatio;
    persist(); renderWater();
    toast(`Mäsktjocklek ${fmt(recipe.mashRatio, 2)} L/kg`);
  });

  // ---------- Malt ----------
  const maltsEl = view.querySelector('#r-malts');
  function renderMalts() {
    const total = recipe.malts.reduce((s, m) => s + (+m.kg || 0), 0);
    maltsEl.innerHTML = recipe.malts.map((m, i) => `
      <div class="ing-row malt" data-i="${i}">
        <input class="ing-name" data-k="name" list="dl-malts" type="text" value="${esc(m.name)}" aria-label="Malt">
        <label class="mini"><input data-k="kg" type="number" inputmode="decimal" step="0.1" min="0" value="${m.kg}"><span>kg</span></label>
        <label class="mini"><input data-k="ebc" type="number" inputmode="decimal" step="1" min="0" value="${m.ebc}"><span>EBC</span></label>
        <span class="pct">${total > 0 ? fmt((m.kg / total) * 100, 0) : 0} %</span>
        <button type="button" class="icon-btn" data-remove aria-label="Ta bort">×</button>
      </div>`).join('') || '<p class="note">Ingen malt.</p>';
    renderMaltTotal();
  }
  function renderMaltTotal() {
    const sum = (f) => recipe.malts.filter(f).reduce((s, m) => s + (+m.kg || 0), 0);
    const total = sum(() => true);
    const sugar = sum((m) => m.kind === 'sugar');
    view.querySelector('#r-malt-total').innerHTML = recipe.malts.length
      ? `<span>Totalt</span><b>${fmt(total, 2)} kg</b>${sugar > 0 ? `<small>varav malt ${fmt(total - sugar, 2)} kg · socker ${fmt(sugar, 2)} kg</small>` : ''}`
      : '';
  }
  maltsEl.addEventListener('input', (e) => {
    const row = e.target.closest('.ing-row'); const k = e.target.dataset.k;
    if (!row || !k) return;
    const m = recipe.malts[+row.dataset.i];
    if (k === 'name') {
      m.name = e.target.value;
      const db = MALTS.find((x) => x.name.toLowerCase() === m.name.trim().toLowerCase());
      if (db) {
        Object.assign(m, { ebc: db.ebc, yield: db.yield, kind: db.kind });
        row.querySelector('[data-k=ebc]').value = db.ebc;
      } else {
        m.yield = m.yield || 78;
        m.kind = guessKind(+m.ebc);
      }
    } else {
      m[k] = numVal(e.target.value);
      if (k === 'ebc' && !MALTS.some((x) => x.name === m.name)) m.kind = guessKind(m.ebc);
    }
    persist(); renderStats();
    if (k === 'kg') updatePercents();
  });
  function updatePercents() {
    renderMaltTotal();
    const total = recipe.malts.reduce((s, m) => s + (+m.kg || 0), 0);
    maltsEl.querySelectorAll('.ing-row').forEach((row) => {
      const m = recipe.malts[+row.dataset.i];
      row.querySelector('.pct').textContent = `${total > 0 ? fmt((m.kg / total) * 100, 0) : 0} %`;
    });
  }
  maltsEl.addEventListener('click', (e) => {
    if (!e.target.matches('[data-remove]')) return;
    recipe.malts.splice(+e.target.closest('.ing-row').dataset.i, 1);
    persist(); renderMalts(); renderStats();
  });
  view.querySelector('#r-add-malt').addEventListener('click', () => {
    recipe.malts.push({ name: '', kg: 0.5, ebc: 0, yield: 78, kind: 'pale' });
    persist(); renderMalts(); renderStats();
    maltsEl.querySelector('.ing-row:last-child .ing-name')?.focus();
  });

  // ---------- Humle ----------
  const hopsEl = view.querySelector('#r-hops');
  function renderHops() {
    hopsEl.innerHTML = recipe.hops.map((h, i) => `
      <div class="ing-row hop" data-i="${i}">
        <input class="ing-name" data-k="name" list="dl-hops" type="text" value="${esc(h.name)}" aria-label="Humle">
        <label class="mini"><input data-k="g" type="number" inputmode="decimal" step="1" min="0" value="${h.g}"><span>g</span></label>
        <label class="mini"><input data-k="alpha" type="number" inputmode="decimal" step="0.1" min="0" value="${h.alpha}"><span>α%</span></label>
        <button type="button" class="icon-btn" data-remove aria-label="Ta bort">×</button>
        <select data-k="use" aria-label="Användning">${HOP_USES.map((u) => `<option value="${u.id}"${u.id === h.use ? ' selected' : ''}>${u.name}</option>`).join('')}</select>
        <label class="mini"><input data-k="min" type="number" inputmode="numeric" step="1" min="0" value="${h.min}"><span>${h.use === 'dryhop' ? 'dag' : 'min'}</span></label>
        ${h.use === 'whirlpool' ? `<label class="mini"><input data-k="temp" type="number" inputmode="numeric" step="1" min="0" max="100" value="${h.temp ?? 80}"><span>°C</span></label>` : ''}
      </div>`).join('') || '<p class="note">Ingen humle.</p>';
    renderHopTotal();
  }
  function renderHopTotal() {
    const total = recipe.hops.reduce((t, h) => t + (+h.g || 0), 0);
    const dry = recipe.hops.filter((h) => h.use === 'dryhop').reduce((t, h) => t + (+h.g || 0), 0);
    view.querySelector('#r-hop-total').innerHTML = recipe.hops.length
      ? `<span>Totalt</span><b>${fmt(total, 1)} g</b>${dry > 0 ? `<small>varav torrhumling ${fmt(dry, 1)} g</small>` : ''}`
      : '';
  }
  hopsEl.addEventListener('input', (e) => {
    const row = e.target.closest('.ing-row'); const k = e.target.dataset.k;
    if (!row || !k) return;
    const h = recipe.hops[+row.dataset.i];
    if (k === 'name') {
      h.name = e.target.value;
      const db = HOPS.find((x) => x.name.toLowerCase() === h.name.trim().toLowerCase());
      if (db) { h.alpha = db.alpha; row.querySelector('[data-k=alpha]').value = db.alpha; }
    } else if (k === 'use') {
      h.use = e.target.value;
      if (h.use === 'whirlpool') { if (!h.min) h.min = 20; h.temp ??= 80; }
      if (h.use === 'dryhop') h.min = h.min > 14 ? 3 : h.min;
      renderHops();
    } else {
      h[k] = numVal(e.target.value);
    }
    persist(); renderStats(); renderHopTotal();
  });
  hopsEl.addEventListener('click', (e) => {
    if (!e.target.matches('[data-remove]')) return;
    recipe.hops.splice(+e.target.closest('.ing-row').dataset.i, 1);
    persist(); renderHops(); renderStats();
  });
  view.querySelector('#r-add-hop').addEventListener('click', () => {
    recipe.hops.push({ name: '', g: 25, alpha: 8, use: 'boil', min: 10 });
    persist(); renderHops(); renderStats();
    hopsEl.querySelector('.ing-row:last-child .ing-name')?.focus();
  });

  // ---------- Övrigt ----------
  const miscsEl = view.querySelector('#r-miscs');
  function renderMiscs() {
    miscsEl.innerHTML = recipe.miscs.map((m, i) => `
      <div class="ing-row misc" data-i="${i}">
        <input class="ing-name" data-k="name" type="text" value="${esc(m.name)}" placeholder="T.ex. Mjölksyra 80 %" aria-label="Namn">
        <label class="mini"><input data-k="amount" type="number" inputmode="decimal" step="any" min="0" value="${m.amount}"><span></span></label>
        <input class="ing-name unit-in" data-k="unit" type="text" value="${esc(m.unit)}" placeholder="ml" aria-label="Enhet">
        <button type="button" class="icon-btn" data-remove aria-label="Ta bort">×</button>
        <input class="ing-name use-in" data-k="use" type="text" value="${esc(m.use)}" placeholder="När: mäskning, kok, fatning …" aria-label="När">
      </div>`).join('') || '<p class="note">Inget – t.ex. syra, salter, aromer, Irish moss.</p>';
  }
  miscsEl.addEventListener('input', (e) => {
    const row = e.target.closest('.ing-row'); const k = e.target.dataset.k;
    if (!row || !k) return;
    recipe.miscs[+row.dataset.i][k] = k === 'amount' ? numVal(e.target.value) : e.target.value;
    persist();
  });
  miscsEl.addEventListener('click', (e) => {
    if (!e.target.matches('[data-remove]')) return;
    recipe.miscs.splice(+e.target.closest('.ing-row').dataset.i, 1);
    persist(); renderMiscs();
  });
  view.querySelector('#r-add-misc').addEventListener('click', () => {
    recipe.miscs.push({ name: '', amount: 0, unit: 'g', use: '' });
    persist(); renderMiscs();
    miscsEl.querySelector('.ing-row:last-child .ing-name')?.focus();
  });

  // ---------- Jäst & anteckningar ----------
  view.querySelector('#r-yeast').addEventListener('input', (e) => {
    const k = e.target.dataset.y;
    if (!k) return;
    if (k === 'name') {
      recipe.yeast.name = e.target.value;
      const db = YEASTS.find((y) => y.name.toLowerCase() === e.target.value.trim().toLowerCase());
      if (db) { recipe.yeast.attenuation = db.attenuation; view.querySelector('#f-attenuation').value = db.attenuation; }
    } else {
      recipe.yeast[k] = numVal(e.target.value);
    }
    persist(); renderStats();
  });
  view.querySelector('#r-notes').addEventListener('input', (e) => { recipe.notes = e.target.value; persist(); });

  // ---------- Åtgärder ----------
  view.querySelector('#r-apply').addEventListener('click', () => {
    applyRecipe(recipe, eq);
    toast('Överfört till Vatten & Kemi');
    setTimeout(() => { location.hash = '#/vattenkemi'; }, 600);
  });
  view.querySelector('#r-copy').addEventListener('click', () => {
    const copy = { ...structuredClone(recipe), id: `r-${Date.now().toString(36)}`, name: `${recipe.name} (kopia)` };
    saveRecipe(copy);
    location.hash = `#/recept/${copy.id}`;
  });
  view.querySelector('#r-delete').addEventListener('click', () => {
    if (!confirm(`Ta bort "${recipe.name}"?`)) return;
    deleteRecipe(recipe.id);
    if (getActiveRecipeId() === recipe.id) save(ACTIVE_KEY, { id: null });
    location.hash = '#/recept';
  });

  renderMalts(); renderHops(); renderMiscs(); renderStats();
}

// Överför volymer och malt till vattenkalkylatorn och vattenkemin.
export function applyRecipe(recipe, eq) {
  const c = calcRecipe(recipe, eq);
  const water = load(WATER_KEY, waterDefaults(eq));
  save(WATER_KEY, {
    ...water,
    grainKg: Math.round(c.grainKg * 100) / 100,
    batchL: recipe.batchL,
    boilMin: recipe.boilMin,
    mashTemp: recipe.mashTemp,
    ...(recipe.mashRatio ? { mashRatio: recipe.mashRatio } : {}),
  });

  const style = STYLES.find((s) => s.id === recipe.styleId);
  const chem = load('chemistry', {});
  let profile = TARGET_PROFILES.find((p) => p.id === style?.water);
  // Receptets egen vattenprofil (t.ex. från import) går före stilens.
  if (recipe.waterTarget) {
    profile = { id: `recipe-${recipe.id}`, name: `${recipe.name} (recept)`, ...recipe.waterTarget, mashPh: recipe.mashPh || 5.3 };
    chem.customProfiles = [...(chem.customProfiles || []).filter((p) => p.id !== profile.id), profile];
  }
  const next = {
    ...chem,
    malts: recipe.malts
      .filter((m) => m.kind !== 'sugar' && +m.kg > 0)
      .map((m) => ({ type: m.kind || 'pale', kg: +m.kg, ebc: +m.ebc })),
    auto: true,
  };
  if (profile) {
    next.targetId = profile.id;
    next.target = { ca: profile.ca, mg: profile.mg, na: profile.na, so4: profile.so4, cl: profile.cl };
    next.mashPhTarget = profile.mashPh;
  }
  save('chemistry', next);
  save(ACTIVE_KEY, { id: recipe.id });
}

function guessKind(ebc) {
  if (ebc <= 8) return 'pale';
  if (ebc <= 40) return 'munich';
  if (ebc <= 500) return 'crystal';
  return 'roast';
}

function num(key, label, value, unit, step, attr = 'data-k') {
  return `
    <div class="field">
      <label for="f-${key}">${label}</label>
      <div class="input-wrap"><input id="f-${key}" ${attr}="${key}" type="number" inputmode="decimal" step="${step}" value="${value}"><span class="unit">${unit}</span></div>
    </div>`;
}

function numVal(v) {
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}
