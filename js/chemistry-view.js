import { icons } from './icons.js';
import { load, save } from './storage.js';
import { getEquipment } from './equipment.js';
import { calcWater, fmt, WATER_KEY, waterDefaults } from './water.js';
import { esc, toast } from './ui.js';
import {
  KATRINEHOLM, TARGET_PROFILES, SALTS, MALT_TYPES, ION_LABELS,
  suggestSaltDose, ionsFromSalts, addProfiles, residualAlkalinity,
  mashPh, lacticForMashPh, lacticForSparge, planChemistry,
} from './chemistry.js';

const KEY = 'chemistry';
const TARGET_IONS = ['ca', 'mg', 'na', 'so4', 'cl'];
const SOURCE_IONS = ['ca', 'mg', 'na', 'so4', 'cl', 'hco3'];

export function chemistryDefaults(grainKg) {
  const t = TARGET_PROFILES[0];
  return {
    source: { ...KATRINEHOLM },
    targetId: t.id,
    target: pickIons(t),
    customProfiles: [],
    spargeSalts: true,
    spargeAcid: true,
    auto: true,
    salts: { cacl2: 0, gypsum: 0, epsom: 0, nacl: 0 },
    malts: [{ type: 'pils', kg: grainKg, ebc: 3.5 }],
    mashPhTarget: t.mashPh,
    spargePhTarget: 5.8,
  };
}

function pickIons(p) {
  return Object.fromEntries(TARGET_IONS.map((i) => [i, p[i]]));
}

function allProfiles(state) {
  return [...TARGET_PROFILES, ...state.customProfiles];
}

export function renderChemistry(view) {
  const eq = getEquipment();
  const waterInput = load(WATER_KEY, waterDefaults(eq));
  const water = calcWater(waterInput, eq);
  const state = load(KEY, chemistryDefaults(parseFloat(waterInput.grainKg) || 0));

  view.innerHTML = `
    <div class="page-head">${icons.flask}<div><h1>Vattenkemi</h1><p>Salter, mäsk-pH och mjölksyra</p></div></div>

    <div class="card">
      <div class="vol-row">
        <div><span>Mäskvatten</span><b>${fmt(water.mash)} L</b></div>
        <div><span>Lakvatten</span><b>${fmt(water.sparge)} L</b></div>
        <a class="link" href="#/vatten">Ändra volymer</a>
      </div>
    </div>

    <h2 class="section-title">Målprofil</h2>
    <div class="card">
      <div class="field">
        <label for="c-target">Ölstil</label>
        <div class="input-wrap"><select id="c-target">
          ${allProfiles(state).map((p) => `<option value="${p.id}"${p.id === state.targetId ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}
        </select></div>
      </div>
      <details>
        <summary>Justera målvärden (mg/l)</summary>
        <div id="c-target-fields">${TARGET_IONS.map((i) => ionField('t', i, state.target[i])).join('')}</div>
        <div class="btn-row"><button class="btn" type="button" id="c-save-profile">Spara som egen profil</button></div>
      </details>
    </div>

    <h2 class="section-title">Råvatten</h2>
    <div class="card">
      <details>
        <summary>${esc(state.source.name)} <small>Ca ${fmt(state.source.ca, 0)} · HCO₃ ${fmt(state.source.hco3, 0)} · pH ${fmt(state.source.ph)}</small></summary>
        <div id="c-source-fields">
          ${SOURCE_IONS.map((i) => ionField('s', i, state.source[i])).join('')}
          ${numField('s-ph', 'pH', state.source.ph, '', 0.1)}
        </div>
        <p class="note">Katrineholm: Sörmland Vatten, analys från Eurofins provtagen 2025-06-10
          (hårdhet 5,4 °dH). Ändra värdena om du får en nyare analys.</p>
        <div class="btn-row"><button class="btn" type="button" id="c-reset-source">Återställ Katrineholm</button></div>
      </details>
    </div>

    <h2 class="section-title">Behandla lakvattnet</h2>
    <div class="card">
      ${toggle('c-sparge-salts', 'Salter i lakvattnet', 'Av = allt salt i mäsken', state.spargeSalts)}
      ${toggle('c-sparge-acid', 'Mjölksyra i lakvattnet', 'Sänker pH, motverkar garvsyra', state.spargeAcid)}
    </div>

    <h2 class="section-title">Salter</h2>
    <div class="card">
      ${SALTS.map((s) => `
        <div class="field">
          <label for="c-salt-${s.id}">${s.name}<small>${s.formula}</small></label>
          <div class="input-wrap">
            <input id="c-salt-${s.id}" data-salt="${s.id}" type="number" inputmode="decimal" step="0.1" min="0" value="${round1(state.salts[s.id])}">
            <span class="unit">${s.unit}</span>
          </div>
        </div>`).join('')}
      <div class="btn-row">
        <button class="btn" type="button" id="c-auto">${state.auto ? 'Automatiskt förslag ✓' : 'Föreslå igen'}</button>
      </div>
      <p class="note">Mängderna är totalt för bryggningen. Fördelningen per kärl visas under <em>Att tillsätta</em>.</p>
    </div>

    <h2 class="section-title">Mäsk-pH</h2>
    <div class="card">
      <div id="c-malts"></div>
      <div class="btn-row"><button class="btn" type="button" id="c-add-malt">+ Lägg till malt</button></div>
      ${numField('c-mash-ph', 'Mål mäsk-pH', state.mashPhTarget, '', 0.05)}
      ${state.spargeAcid ? numField('c-sparge-ph', 'Mål lakvatten-pH', state.spargePhTarget, '', 0.1) : ''}
    </div>

    <h2 class="section-title">Att tillsätta</h2>
    <div class="card" id="c-dose"></div>

    <h2 class="section-title">Resultat</h2>
    <div class="card" id="c-result"></div>
  `;

  // ---------- Händelser ----------
  const persist = () => save(KEY, state);
  const rerender = () => { persist(); renderChemistry(view); };

  view.querySelector('#c-target').addEventListener('change', (e) => {
    const p = allProfiles(state).find((x) => x.id === e.target.value);
    state.targetId = p.id;
    state.target = pickIons(p);
    if (p.mashPh) state.mashPhTarget = p.mashPh;
    state.auto = true;
    rerender();
  });

  view.querySelector('#c-target-fields').addEventListener('input', (e) => {
    const ion = e.target.dataset.ion;
    if (!ion) return;
    state.target[ion] = num(e.target.value);
    update();
  });

  view.querySelector('#c-save-profile').addEventListener('click', () => {
    const name = prompt('Namn på profilen:');
    if (!name) return;
    const id = `custom-${Date.now()}`;
    state.customProfiles.push({ id, name: name.trim(), ...state.target, mashPh: state.mashPhTarget });
    state.targetId = id;
    rerender();
    toast('Profil sparad');
  });

  view.querySelector('#c-source-fields').addEventListener('input', (e) => {
    if (e.target.id === 'f-s-ph') state.source.ph = num(e.target.value);
    else if (e.target.dataset.ion) state.source[e.target.dataset.ion] = num(e.target.value);
    update();
  });

  view.querySelector('#c-reset-source').addEventListener('click', () => {
    state.source = { ...KATRINEHOLM };
    rerender();
  });

  view.querySelector('#c-sparge-salts').addEventListener('change', (e) => { state.spargeSalts = e.target.checked; update(); });
  view.querySelector('#c-sparge-acid').addEventListener('change', (e) => { state.spargeAcid = e.target.checked; rerender(); });

  SALTS.forEach((s) => {
    view.querySelector(`#c-salt-${s.id}`).addEventListener('input', (e) => {
      state.salts[s.id] = Math.max(num(e.target.value), 0);
      if (state.auto) {
        state.auto = false;
        view.querySelector('#c-auto').textContent = 'Föreslå igen';
      }
      update(false);
    });
  });

  view.querySelector('#c-auto').addEventListener('click', () => { state.auto = true; rerender(); });

  view.querySelector('#c-mash-ph').addEventListener('input', (e) => { state.mashPhTarget = num(e.target.value); update(); });
  view.querySelector('#c-sparge-ph')?.addEventListener('input', (e) => { state.spargePhTarget = num(e.target.value); update(); });

  // ---------- Maltlista ----------
  const maltsEl = view.querySelector('#c-malts');
  const renderMalts = () => {
    maltsEl.innerHTML = state.malts.map((m, i) => {
      const t = MALT_TYPES.find((x) => x.id === m.type) || MALT_TYPES[0];
      return `
        <div class="malt-row" data-i="${i}">
          <select data-k="type" aria-label="Malttyp">
            ${MALT_TYPES.map((x) => `<option value="${x.id}"${x.id === m.type ? ' selected' : ''}>${x.name}</option>`).join('')}
          </select>
          <label class="mini"><input data-k="kg" type="number" inputmode="decimal" step="0.1" min="0" value="${m.kg}"><span>kg</span></label>
          ${t.id === 'crystal'
            ? `<label class="mini"><input data-k="ebc" type="number" inputmode="decimal" step="5" min="0" value="${m.ebc}"><span>EBC</span></label>`
            : '<span class="mini-spacer"></span>'}
          <button type="button" class="icon-btn" data-remove aria-label="Ta bort">×</button>
        </div>`;
    }).join('');
  };
  renderMalts();

  maltsEl.addEventListener('input', (e) => {
    const row = e.target.closest('.malt-row');
    const k = e.target.dataset.k;
    if (!row || !k) return;
    const m = state.malts[+row.dataset.i];
    if (k === 'type') {
      m.type = e.target.value;
      m.ebc = MALT_TYPES.find((x) => x.id === m.type).ebc;
      renderMalts();
    } else {
      m[k] = num(e.target.value);
    }
    update();
  });
  maltsEl.addEventListener('click', (e) => {
    if (!e.target.matches('[data-remove]')) return;
    state.malts.splice(+e.target.closest('.malt-row').dataset.i, 1);
    renderMalts();
    update();
  });
  view.querySelector('#c-add-malt').addEventListener('click', () => {
    state.malts.push({ type: 'crystal', kg: 0.5, ebc: 120 });
    renderMalts();
    update();
  });

  // ---------- Beräkning ----------
  function update(recalcSalts = true) {
    const mashL = water.mash;
    const spargeL = water.sparge;
    const totalL = mashL + spargeL;

    const plan = planChemistry(state, mashL, spargeL, recalcSalts);
    if (state.auto && recalcSalts) {
      for (const s of SALTS) {
        const inp = view.querySelector(`#c-salt-${s.id}`);
        if (inp) inp.value = round1(state.salts[s.id]);
      }
    }
    const { mashSalts, spargeSalts, mashWater, kettle, phNoAcid, mashAcid, phWithAcid, spargeAcid } = plan;

    // ---------- Att tillsätta ----------
    const doseList = (salts, acid) => {
      const rows = SALTS.filter((s) => salts[s.id] >= 0.05)
        .map((s) => `<li><span>${s.name}</span><b>${fmt(salts[s.id])} ${s.unit}</b></li>`);
      if (acid >= 0.05) rows.push(`<li><span>Mjölksyra 80 %</span><b>${fmt(acid)} ml</b></li>`);
      return rows.length ? `<ul class="dose">${rows.join('')}</ul>` : '<p class="note">Ingenting.</p>';
    };
    view.querySelector('#c-dose').innerHTML = `
      <h3 class="sub-title">Mäskvatten · ${fmt(mashL)} L</h3>
      ${doseList(mashSalts, mashAcid)}
      <h3 class="sub-title">Lakvatten · ${fmt(spargeL)} L</h3>
      ${doseList(spargeSalts, spargeAcid)}
    `;

    // ---------- Resultat ----------
    const ratio = kettle.cl > 0 ? kettle.so4 / kettle.cl : 0;
    const warnings = [];
    if (kettle.ca < 40) warnings.push('Kalcium under 40 mg/l – kan ge sämre jäsning och klarning.');
    if (kettle.mg > 30) warnings.push('Magnesium över 30 mg/l – kan ge besk, metallisk smak.');
    if (kettle.na > 100) warnings.push('Natrium över 100 mg/l – kan smaka salt.');
    if (kettle.so4 > 400) warnings.push('Sulfat över 400 mg/l – mycket torr och sträv beska.');
    if (kettle.cl > 250) warnings.push('Klorid över 250 mg/l – risk för mineralsmak.');
    const lactatePpm = ((mashAcid + spargeAcid) * 0.8 * 1.19 * 1000) / (totalL || 1);
    if (lactatePpm > 400) warnings.push(`Mycket mjölksyra (~${fmt(lactatePpm, 0)} mg/l) – kan ge syrlig smak. Överväg surmalt eller lägre pH-mål.`);
    if (phNoAcid == null) warnings.push('Lägg till malt för att beräkna mäsk-pH.');

    view.querySelector('#c-result').innerHTML = `
      <div class="results">
        <div class="result primary"><span>Mäsk-pH utan syra</span><b>${phNoAcid == null ? '–' : fmt(phNoAcid, 2)}</b></div>
        <div class="result primary"><span>Mäsk-pH med syra</span><b>${phWithAcid == null ? '–' : fmt(phWithAcid, 2)}</b></div>
        <div class="result"><span>Sulfat / klorid</span><b>${fmt(ratio, 2)}</b></div>
        <div class="result"><span>Restalkalitet mäsk</span><b>${fmt(residualAlkalinity(mashWater) * 50, 0)} <small>ppm CaCO₃</small></b></div>
      </div>
      <p class="note">${ratioText(ratio)}</p>
      <table class="ions">
        <thead><tr><th></th><th>Rå</th><th>Mål</th><th>Färdigt</th></tr></thead>
        <tbody>
          ${TARGET_IONS.map((i) => {
            const diff = kettle[i] - state.target[i];
            const cls = Math.abs(diff) <= Math.max(state.target[i] * 0.15, 5) ? 'ok' : diff > 0 ? 'hi' : 'lo';
            return `<tr><td>${ION_LABELS[i]}</td><td>${fmt(state.source[i], 0)}</td><td>${fmt(state.target[i], 0)}</td><td class="${cls}">${fmt(kettle[i], 0)}</td></tr>`;
          }).join('')}
          <tr><td>${ION_LABELS.hco3}</td><td>${fmt(state.source.hco3, 0)}</td><td>–</td><td>${fmt(kettle.hco3, 0)}</td></tr>
        </tbody>
      </table>
      <p class="note">Färdigt = genomsnitt i kokaren (mäsk + lak), mg/l.</p>
      ${warnings.map((w) => `<div class="alert warn">${esc(w)}</div>`).join('')}
      <p class="note">pH är en uppskattning. Mät gärna med pH-mätare ca 10 min in i mäsken (rumstempererat prov).</p>
    `;

    persist();
  }

  update();
}

// ---------- Små hjälpare ----------
function ratioText(r) {
  if (r === 0) return '';
  if (r < 0.6) return 'Mycket maltig/fyllig profil.';
  if (r < 0.9) return 'Maltig profil.';
  if (r <= 1.5) return 'Balanserad profil.';
  if (r <= 3) return 'Humlebetonad, torrare beska.';
  return 'Mycket torr och krispig beska.';
}

function ionField(prefix, ion, value) {
  return `
    <div class="field">
      <label for="f-${prefix}-${ion}">${ION_LABELS[ion]}</label>
      <div class="input-wrap"><input id="f-${prefix}-${ion}" data-ion="${ion}" type="number" inputmode="decimal" step="1" min="0" value="${value}"><span class="unit">mg/l</span></div>
    </div>`;
}

function numField(id, label, value, unit, step) {
  const fid = id.startsWith('c-') ? id : `f-${id}`;
  return `
    <div class="field">
      <label for="${fid}">${label}</label>
      <div class="input-wrap"><input id="${fid}" type="number" inputmode="decimal" step="${step}" value="${value}"><span class="unit">${unit}</span></div>
    </div>`;
}

function toggle(id, label, hint, checked) {
  return `
    <label class="toggle-row" for="${id}">
      <span>${label}<small>${hint}</small></span>
      <input id="${id}" type="checkbox" class="switch"${checked ? ' checked' : ''}>
    </label>`;
}

function num(v) {
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function round1(v) {
  return Math.round((v || 0) * 10) / 10;
}
