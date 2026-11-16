import { icons } from './icons.js';
import { getEquipment } from './equipment.js';
import { fmt } from './water.js';
import { esc, toast } from './ui.js';
import { STYLES, HOP_USES, saveRecipe, calcRecipe, efficiencyForOg } from './recipes.js';
import { importFile, ACCEPT } from './importer.js';

export function renderImport(view) {
  const eq = getEquipment();
  const items = []; // { draft, calibrate, saved, error, file }

  view.innerHTML = `
    <div class="page-head">
      <a class="back" href="#/recept" aria-label="Tillbaka">‹</a>
      <div><h1>Importera</h1><p>BeerXML, BeerJSON, Brewfather JSON och PDF</p></div>
    </div>
    <div class="card drop" id="i-drop">
      ${icons.upload}
      <p>Välj en eller flera receptfiler</p>
      <label class="btn primary">Välj filer<input id="i-file" type="file" accept="${ACCEPT}" multiple hidden></label>
      <p class="note">.xml (BeerXML – Brewfather, BeerSmith, Brewer's Friend, Grainfather m.fl.),
        .json (BeerJSON eller Brewfather-export) och .pdf (Brewfather-utskrift).</p>
    </div>
    <div id="i-list"></div>
  `;

  const listEl = view.querySelector('#i-list');
  const input = view.querySelector('#i-file');
  input.addEventListener('change', () => { handle([...input.files]); input.value = ''; });

  const drop = view.querySelector('#i-drop');
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault(); drop.classList.remove('over');
    handle([...e.dataTransfer.files]);
  });

  async function handle(files) {
    for (const file of files) {
      try {
        const drafts = await importFile(file);
        for (const d of drafts) {
          const eff = efficiencyForOg(d, eq, d.source.og);
          items.push({ draft: d, file: file.name, calibrate: eff != null, calibratedEff: eff, originalEff: d.efficiency });
        }
      } catch (err) {
        items.push({ file: file.name, error: err.message || String(err) });
      }
    }
    render();
  }

  function render() {
    const pending = items.filter((i) => i.draft && !i.saved).length;
    listEl.innerHTML = items.map((it, idx) => card(it, idx, eq)).join('')
      + (pending > 1 ? '<button class="btn primary block" id="i-save-all" type="button">Spara alla</button>' : '');
  }

  listEl.addEventListener('change', (e) => {
    const idx = e.target.closest('[data-idx]')?.dataset.idx;
    if (idx == null || !e.target.matches('[data-calibrate]')) return;
    items[idx].calibrate = e.target.checked;
    render();
  });

  listEl.addEventListener('click', (e) => {
    if (e.target.id === 'i-save-all') {
      items.forEach((it) => { if (it.draft && !it.saved) store(it); });
      toast('Alla recept sparade');
      render();
      return;
    }
    const idx = e.target.closest('[data-idx]')?.dataset.idx;
    if (idx == null) return;
    const it = items[idx];
    if (e.target.matches('[data-save]')) {
      store(it);
      toast('Recept sparat');
      render();
    } else if (e.target.matches('[data-open]')) {
      location.hash = `#/recept/${it.savedId}`;
    } else if (e.target.matches('[data-discard]')) {
      items.splice(idx, 1);
      render();
    }
  });

  function store(it) {
    const r = finalRecipe(it);
    r.id = `r-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    saveRecipe(r);
    it.saved = true;
    it.savedId = r.id;
  }
}

function finalRecipe(it) {
  const d = structuredClone(it.draft);
  d.efficiency = it.calibrate && it.calibratedEff ? it.calibratedEff : it.originalEff;
  const { source } = d;
  delete d.source;
  const origin = `Importerat från ${it.file} (${source.format}).`;
  d.notes = d.notes ? `${d.notes}\n\n${origin}` : origin;
  return d;
}

function card(it, idx, eq) {
  if (it.error) {
    return `<div class="card" data-idx="${idx}">
      <strong>${esc(it.file)}</strong>
      <div class="alert warn">${esc(it.error)}</div>
      <div class="btn-row"><button class="btn" type="button" data-discard>Ta bort</button></div>
    </div>`;
  }
  const r = finalRecipe(it);
  const c = calcRecipe(r, eq);
  const s = it.draft.source;
  const style = STYLES.find((x) => x.id === r.styleId);
  const cmp = (label, file, app, digits) => {
    const f = file == null ? '–' : digits === 3 ? (+file).toFixed(3) : fmt(+file, digits);
    const a = digits === 3 ? app.toFixed(3) : fmt(app, digits);
    return `<tr><td>${label}</td><td>${f}</td><td>${a}</td></tr>`;
  };
  const useName = (u) => HOP_USES.find((h) => h.id === u)?.name || u;

  return `
    <div class="card import-card${it.saved ? ' saved' : ''}" data-idx="${idx}">
      <div class="ic-head">
        <div><strong>${esc(r.name)}</strong><small>${esc(it.file)}</small></div>
        <span class="badge inline">${esc(s.format)}</span>
      </div>
      <ul class="kv">
        <li><span>Stil</span><b>${style ? `${style.id} ${esc(style.name)}` : '<em>Ingen matchning</em>'}${s.styleName && (!style || style.name !== s.styleName) ? ` <small>(fil: ${esc(s.styleName)})</small>` : ''}</b></li>
        <li><span>Volym</span><b>${fmt(r.batchL)} L · ${fmt(r.boilMin, 0)} min kok</b></li>
        <li><span>Verkningsgrad</span><b>${fmt(r.efficiency)} %</b></li>
        ${r.fileWater ? `<li><span>Vatten (filen)</span><b>Mäsk ${fmt(r.fileWater.mashL)} L · Lak ${fmt(r.fileWater.spargeL)} L</b></li>` : ''}
        <li><span>Mäsktemp</span><b>${fmt(r.mashTemp)} °C</b></li>
        ${r.waterTarget ? `<li><span>Vattenprofil</span><b>Ca ${fmt(r.waterTarget.ca, 0)} · SO₄ ${fmt(r.waterTarget.so4, 0)} · Cl ${fmt(r.waterTarget.cl, 0)}${r.mashPh ? ` · pH ${fmt(r.mashPh, 2)}` : ''}</b></li>` : ''}
        <li><span>Jäst</span><b>${esc(r.yeast.name || '–')} · ${fmt(r.yeast.attenuation, 0)} %</b></li>
      </ul>
      ${it.calibratedEff ? `
        <label class="toggle-row">
          <span>Anpassa verkningsgrad till filens OG<small>${fmt(it.calibratedEff)} % i stället för ${fmt(it.originalEff)} % (med din BrewZilla-profil)</small></span>
          <input type="checkbox" class="switch" data-calibrate${it.calibrate ? ' checked' : ''}>
        </label>` : ''}
      <table class="ions cmp">
        <thead><tr><th></th><th>Filen</th><th>Appen</th></tr></thead>
        <tbody>
          ${cmp('OG', s.og, c.og, 3)}
          ${cmp('FG', s.fg, c.fg, 3)}
          ${cmp('IBU', s.ibu, c.ibu, 0)}
          ${cmp('Färg (EBC)', s.ebc, c.ebc, 0)}
          <tr><td>ABV</td><td>${s.og && s.fg ? `${fmt((s.og - s.fg) * 131.25)} %` : '–'}</td><td>${fmt(c.abv)} %</td></tr>
        </tbody>
      </table>
      <details>
        <summary>Ingredienser (${r.malts.length} malt, ${r.hops.length} humle, ${r.miscs.length} övrigt)</summary>
        <ul class="dose">
          ${r.malts.map((m) => `<li><span>${esc(m.name)} <small>${fmt(m.ebc, 1)} EBC</small></span><b>${fmt(m.kg, 2)} kg</b></li>`).join('')}
          ${r.hops.map((h) => `<li><span>${esc(h.name)} <small>${fmt(h.alpha, 1)} % · ${useName(h.use)} ${fmt(h.min, 0)} ${h.use === 'dryhop' ? 'd' : 'min'}</small></span><b>${fmt(h.g, 1)} g</b></li>`).join('')}
          ${r.miscs.map((m) => `<li><span>${esc(m.name)} <small>${esc(m.use)}</small></span><b>${fmt(m.amount, 1)} ${esc(m.unit)}</b></li>`).join('')}
        </ul>
      </details>
      <div class="btn-row">
        ${it.saved
          ? '<span class="saved-txt">✓ Sparat</span><button class="btn" type="button" data-open>Öppna</button>'
          : '<button class="btn primary" type="button" data-save>Spara recept</button><button class="btn" type="button" data-discard>Hoppa över</button>'}
      </div>
    </div>`;
}
