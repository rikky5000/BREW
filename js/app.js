import { icons } from './icons.js';
import { getEquipment, saveEquipment, BREWZILLA_65_DEFAULTS, EQUIPMENT_FIELDS } from './equipment.js';
import { calcWater, fmt, WATER_KEY, waterDefaults } from './water.js';
import { load, save } from './storage.js';
import { fieldHtml, esc, toast } from './ui.js';
import { renderChemistry } from './chemistry-view.js';
import { renderRecipeList, renderRecipeEditor, getActiveRecipeId } from './recipe-view.js';
import { getRecipe } from './recipes.js';

const view = document.getElementById('view');

// ---------- Startsida ----------
const MODULES = [
  { title: 'Recept', desc: 'OG, FG, ABV, IBU, EBC & BJCP', icon: 'book', href: '#/recept' },
  { title: 'Vatten', desc: 'Mäsk- & lakvatten för BrewZilla', icon: 'drop', href: '#/vatten' },
  { title: 'Vattenkemi', desc: 'Salter, pH & mjölksyra', icon: 'flask', href: '#/vattenkemi' },
  { title: 'Utrustning', desc: 'Profil för 65L Gen 4.1', icon: 'kettle', href: '#/utrustning' },
  { title: 'Bryggdag', desc: 'Checklista, timer & logg', icon: 'timer', soon: true },
  { title: 'Mäskschema', desc: 'Upp till 6 steg för RAPT', icon: 'flame', soon: true },
  { title: 'Jäsning', desc: 'SG & temperatur i graf', icon: 'chart', soon: true },
  { title: 'Batcher', desc: 'Historik, anteckningar, betyg', icon: 'archive', soon: true },
  { title: 'Kolsyra', desc: 'Socker eller keg-tryck', icon: 'bubbles', soon: true },
  { title: 'Lager', desc: 'Malt, humle & jäst', icon: 'box', soon: true },
  { title: 'Verktyg', desc: 'ABV, refraktometer, spädning', icon: 'calc', soon: true },
  { title: 'Import', desc: 'BeerXML-recept', icon: 'upload', soon: true },
  { title: 'RAPT', desc: 'Livedata från molnet', icon: 'wifi', soon: true },
];

function renderHome() {
  const eq = getEquipment();
  view.innerHTML = `
    <header class="brand">
      <span class="mug">${icons.mug}</span>
      <h1>WALTHERSON</h1>
      <p class="sub">BREWING</p>
      <hr>
      <p class="tagline"><span>CRAFTED WITH PASSION</span> · <span>BREWED WITH PRECISION</span></p>
      <p class="system">BREWING MANAGEMENT SYSTEM</p>
      <p class="edition">${esc(eq.name)} Edition</p>
    </header>

    ${activeHtml()}
    <h2 class="section-title">Moduler</h2>
    <div class="tiles">
      ${MODULES.map((m) => `
        <a class="tile${m.soon ? ' soon' : ''}" ${m.soon ? 'aria-disabled="true"' : `href="${m.href}"`}>
          ${m.soon ? '<span class="badge">Snart</span>' : ''}
          ${icons[m.icon]}
          <strong>${m.title}</strong>
          <small>${m.desc}</small>
        </a>`).join('')}
    </div>

    <h2 class="section-title">Utrustning</h2>
    <div class="card">
      <div class="results">
        <div class="result"><span>Kärl</span><b>${fmt(eq.kettleVolume, 0)} L</b></div>
        <div class="result"><span>Effekt</span><b>${fmt(eq.elementPower, 0)} W</b></div>
        <div class="result"><span>Avkok</span><b>${fmt(eq.boilOffRate)} L/h</b></div>
        <div class="result"><span>Verkningsgrad</span><b>${fmt(eq.efficiency, 0)} %</b></div>
      </div>
    </div>
  `;
}

function activeHtml() {
  const r = getRecipe(getActiveRecipeId());
  if (!r) return '';
  return `
    <h2 class="section-title">Aktivt recept</h2>
    <a class="card active-recipe" href="#/recept/${r.id}">
      <strong>${esc(r.name)}</strong>
      <small>${fmt(+r.batchL, 0)} L · ${fmt(+r.boilMin, 0)} min kok · ${esc(r.yeast?.name || '')}</small>
    </a>`;
}

// ---------- Vattenkalkylator ----------

function renderWater() {
  const eq = getEquipment();
  const input = load(WATER_KEY, waterDefaults(eq));

  const fields = [
    { key: 'batchL', label: 'Volym i jäskärl', unit: 'L', step: 1 },
    { key: 'grainKg', label: 'Total maltmängd', unit: 'kg', step: 0.1 },
    { key: 'boilMin', label: 'Koktid', unit: 'min', step: 5 },
    { key: 'mashRatio', label: 'Mäsktjocklek', unit: 'L/kg', step: 0.1 },
    { key: 'mashTemp', label: 'Mäsktemperatur', unit: '°C', step: 0.5 },
    { key: 'grainTemp', label: 'Malttemperatur', unit: '°C', step: 1 },
  ];

  view.innerHTML = `
    <div class="page-head">${icons.drop}<div><h1>Vatten</h1><p>${esc(eq.name)}</p></div></div>
    <form class="card" id="water-form" autocomplete="off">
      ${fields.map((f) => fieldHtml(f, input[f.key])).join('')}
    </form>
    <h2 class="section-title">Resultat</h2>
    <div class="card" id="water-result"></div>
  `;

  const form = document.getElementById('water-form');
  const out = document.getElementById('water-result');

  const update = () => {
    const data = Object.fromEntries(new FormData(form));
    save(WATER_KEY, data);
    const r = calcWater(data, eq);
    out.innerHTML = `
      <div class="results">
        <div class="result primary wide"><span>Totalt vatten</span><b>${fmt(r.total)} L</b></div>
        <div class="result primary"><span>Mäskvatten</span><b>${fmt(r.mash)} L</b></div>
        <div class="result primary"><span>Lakvatten</span><b>${fmt(r.sparge)} L</b></div>
        <div class="result"><span>Insläppstemp</span><b>${fmt(r.strikeTemp)} °C</b></div>
        <div class="result"><span>Mäsk inkl. malt</span><b>${fmt(r.mashVolumeWithGrain)} L</b></div>
        <div class="result"><span>Före kok</span><b>${fmt(r.preBoil)} L</b></div>
        <div class="result"><span>Efter kok (varm)</span><b>${fmt(r.postBoilHot)} L</b></div>
        <div class="result"><span>Avkok</span><b>${fmt(r.boilOff)} L</b></div>
        <div class="result"><span>Maltabsorption</span><b>${fmt(r.absorption)} L</b></div>
      </div>
      ${r.warnings.length
        ? r.warnings.map((w) => `<div class="alert warn">${esc(w)}</div>`).join('')
        : '<div class="alert ok">Volymerna ryms i BrewZillan.</div>'}
      <p class="note">Beräknat med utrustningsprofilen: avkok ${fmt(eq.boilOffRate)} L/h, förlust ${fmt(eq.kettleLoss)} L,
        absorption ${fmt(eq.grainAbsorption, 2)} L/kg, krympning ${fmt(eq.coolingShrinkage)} %.</p>
    `;
  };

  form.addEventListener('input', update);
  update();
}

// ---------- Utrustning ----------
function renderEquipment() {
  const eq = getEquipment();
  view.innerHTML = `
    <div class="page-head">${icons.kettle}<div><h1>Utrustning</h1><p>Justera efter egna mätningar</p></div></div>
    <form class="card" id="eq-form" autocomplete="off">
      ${EQUIPMENT_FIELDS.map((f) => fieldHtml(f, eq[f.key])).join('')}
      <div class="btn-row">
        <button class="btn primary" type="submit">Spara</button>
        <button class="btn" type="button" id="eq-reset">Återställ standard</button>
      </div>
    </form>
  `;

  const form = document.getElementById('eq-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const next = { ...eq };
    for (const f of EQUIPMENT_FIELDS) {
      if (f.type === 'text') {
        next[f.key] = String(data[f.key] || '').trim() || BREWZILLA_65_DEFAULTS[f.key];
      } else {
        const n = parseFloat(String(data[f.key]).replace(',', '.'));
        next[f.key] = Number.isFinite(n) ? n : BREWZILLA_65_DEFAULTS[f.key];
      }
    }
    toast(saveEquipment(next) ? 'Sparat' : 'Kunde inte spara');
  });

  document.getElementById('eq-reset').addEventListener('click', () => {
    if (!confirm('Återställa till standardvärden för BrewZilla 65L Gen 4.1?')) return;
    saveEquipment({ ...BREWZILLA_65_DEFAULTS });
    renderEquipment();
    toast('Återställt');
  });
}

// ---------- Router ----------
const ROUTES = {
  '/': renderHome,
  '/recept': () => renderRecipeList(view),
  '/vatten': renderWater,
  '/vattenkemi': () => renderChemistry(view),
  '/utrustning': renderEquipment,
};

function route() {
  const path = location.hash.replace(/^#/, '') || '/';
  const m = path.match(/^\/recept\/(.+)$/);
  if (m) renderRecipeEditor(view, decodeURIComponent(m[1]));
  else (ROUTES[path] || renderHome)();
  const section = '/' + (path.split('/')[1] || '');
  document.querySelectorAll('.tabbar a').forEach((a) => {
    a.classList.toggle('active', a.dataset.route === section);
  });
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
route();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
