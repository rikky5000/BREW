// Vattenkemi: salttillsatser, jonprofil, mäsk-pH och syra.
//
// Mäsk-pH bygger på en förenklad modell (Kai Troester): varje malt har ett
// pH i destillerat vatten och en buffertkapacitet. Vattnets restalkalitet (RA)
// och tillsatt syra flyttar pH från maltens utgångsläge. Resultatet är en
// uppskattning – mät gärna med pH-mätare vid mäskstart.

export const IONS = ['ca', 'mg', 'na', 'so4', 'cl', 'hco3'];
export const ION_LABELS = {
  ca: 'Kalcium (Ca)', mg: 'Magnesium (Mg)', na: 'Natrium (Na)',
  so4: 'Sulfat (SO₄)', cl: 'Klorid (Cl)', hco3: 'Vätekarbonat (HCO₃)',
};

// Katrineholms vattenverk – Eurofins analysrapport AR-25-QI-078024-01,
// provtagen 2025-06-10 hos användare (Sörmland Vatten).
export const KATRINEHOLM = {
  name: 'Katrineholm (analys 2025-06)',
  ca: 31, mg: 4.5, na: 12, so4: 15, cl: 9.3, hco3: 99, ph: 7.9,
};

// Målprofiler (mg/l) och föreslaget mäsk-pH per ölstil.
export const TARGET_PROFILES = [
  { id: 'pilsner',  name: 'Pilsner',                  ca: 50,  mg: 5,  na: 5,  so4: 70,  cl: 50,  mashPh: 5.3 },
  { id: 'lager',    name: 'Ljus lager',               ca: 55,  mg: 5,  na: 10, so4: 75,  cl: 60,  mashPh: 5.3 },
  { id: 'paleale',  name: 'Pale Ale',                 ca: 90,  mg: 10, na: 15, so4: 200, cl: 60,  mashPh: 5.3 },
  { id: 'ipa',      name: 'IPA (West Coast)',         ca: 110, mg: 15, na: 15, so4: 300, cl: 60,  mashPh: 5.25 },
  { id: 'neipa',    name: 'NEIPA',                    ca: 100, mg: 10, na: 15, so4: 80,  cl: 180, mashPh: 5.3 },
  { id: 'weiss',    name: 'Weissbier',                ca: 50,  mg: 5,  na: 10, so4: 50,  cl: 60,  mashPh: 5.4 },
  { id: 'belgian',  name: 'Belgiskt',                 ca: 60,  mg: 5,  na: 10, so4: 60,  cl: 80,  mashPh: 5.35 },
  { id: 'amber',    name: 'Amber / Brown (maltig)',   ca: 70,  mg: 10, na: 20, so4: 80,  cl: 110, mashPh: 5.4 },
  { id: 'stout',    name: 'Porter / Stout',           ca: 80,  mg: 10, na: 30, so4: 70,  cl: 100, mashPh: 5.45 },
  { id: 'balanced', name: 'Balanserad',               ca: 70,  mg: 10, na: 15, so4: 90,  cl: 90,  mashPh: 5.35 },
];

// Salter. `perUnit` = mg/l jon som 1 enhet (g eller ml) ger i 1 liter vatten.
const CACL2_DENSITY = 1.31;           // g/ml för 33 % lösning
const CACL2_PER_ML = CACL2_DENSITY * 0.33 * 1000; // mg CaCl2 per ml
export const SALTS = [
  { id: 'cacl2',  name: 'Kalciumklorid 33 %', formula: 'CaCl₂-lösning', unit: 'ml',
    perUnit: { ca: CACL2_PER_ML * 0.3611, cl: CACL2_PER_ML * 0.6389 } },
  { id: 'gypsum', name: 'Kalciumsulfat',      formula: 'Gips, CaSO₄·2H₂O', unit: 'g',
    perUnit: { ca: 1000 * 0.2328, so4: 1000 * 0.5579 } },
  { id: 'epsom',  name: 'Magnesiumsulfat',    formula: 'Epsomsalt, MgSO₄·7H₂O', unit: 'g',
    perUnit: { mg: 1000 * 0.0986, so4: 1000 * 0.3898 } },
  { id: 'nacl',   name: 'Natriumklorid',      formula: 'Koksalt, NaCl', unit: 'g',
    perUnit: { na: 1000 * 0.3934, cl: 1000 * 0.6066 } },
];

// Mjölksyra 80 %: densitet ~1,19 g/ml, molvikt 90,08, pKa 3,86.
export const LACTIC_MMOL_PER_ML = (0.8 * 1.19 * 1000) / 90.08;
const LACTIC_PKA = 3.86;
export function lacticMeqPerMl(ph) {
  return LACTIC_MMOL_PER_ML / (1 + 10 ** (LACTIC_PKA - ph));
}

// Malttyper: pH i destillerat vatten (pHdi) och buffertkapacitet (mEq/kg·pH).
export const MALT_TYPES = [
  { id: 'pils',    name: 'Pilsnermalt',            ebc: 3.5, buffer: 30 },
  { id: 'pale',    name: 'Pale ale-malt',          ebc: 6,   buffer: 30 },
  { id: 'munich',  name: 'Wiener / München',       ebc: 15,  buffer: 32 },
  { id: 'wheat',   name: 'Vetemalt',               ebc: 4,   buffer: 28 },
  { id: 'crystal', name: 'Karamellmalt',           ebc: 120, buffer: 40 },
  { id: 'roast',   name: 'Rostad malt / choklad',  ebc: 900, buffer: 40 },
  { id: 'acid',    name: 'Surmalt',                ebc: 4,   buffer: 30 },
];

const BASE_PHDI = { pils: 5.75, pale: 5.65, munich: 5.5, wheat: 6.0, roast: 4.7, acid: 5.75 };
const ACID_MALT_MEQ_PER_KG = 25 / 90.08 * 1000; // ca 2,5 % mjölksyra

function maltPhDi(type, ebc) {
  if (type === 'crystal') {
    const srm = ebc * 0.508;
    const lovibond = (srm + 0.76) / 1.3546;
    return 5.22 - 0.00504 * lovibond;
  }
  return BASE_PHDI[type] ?? 5.7;
}

// ---------- Jonberäkningar ----------

// Jonprofil (mg/l) när saltmängder (totalt, g/ml) löses i `liters` vatten.
export function ionsFromSalts(salts, liters) {
  const out = { ca: 0, mg: 0, na: 0, so4: 0, cl: 0, hco3: 0 };
  if (liters <= 0) return out;
  for (const s of SALTS) {
    const amount = salts[s.id] || 0;
    for (const [ion, v] of Object.entries(s.perUnit)) out[ion] += (v * amount) / liters;
  }
  return out;
}

export function addProfiles(a, b) {
  const out = {};
  for (const ion of IONS) out[ion] = (a[ion] || 0) + (b[ion] || 0);
  return out;
}

// Föreslår saltmängd (per liter) som ligger så nära målet som möjligt
// utan negativa tillsatser. Med fyra salter testas alla kombinationer.
export function suggestSaltDose(source, target) {
  const ions = ['ca', 'mg', 'na', 'so4', 'cl'];
  const need = ions.map((i) => (target[i] || 0) - (source[i] || 0));
  // Sulfat och klorid styr smaken mest och väger därför tyngre.
  const w = ions.map((i) => (i === 'so4' || i === 'cl' ? 2 : 1) / Math.max(target[i] || 0, 30));
  const cols = SALTS.map((s) => ions.map((i) => s.perUnit[i] || 0));

  let best = { err: Infinity, dose: SALTS.map(() => 0) };
  const n = SALTS.length;
  for (let mask = 0; mask < 1 << n; mask++) {
    const idx = [...Array(n).keys()].filter((k) => mask & (1 << k));
    const dose = SALTS.map(() => 0);
    if (idx.length) {
      // Viktad minsta-kvadrat: (AᵀWA) x = AᵀW b
      const A = idx.map((k) => cols[k]);
      const M = idx.map((_, r) => idx.map((__, c) => ions.reduce((s, _i, j) => s + w[j] ** 2 * A[r][j] * A[c][j], 0)));
      const v = idx.map((_, r) => ions.reduce((s, _i, j) => s + w[j] ** 2 * A[r][j] * need[j], 0));
      const x = solve(M, v);
      if (!x || x.some((xi) => xi < 0)) continue;
      idx.forEach((k, r) => { dose[k] = x[r]; });
    }
    const err = ions.reduce((s, _i, j) => {
      const got = SALTS.reduce((t, _s, k) => t + cols[k][j] * dose[k], 0);
      return s + (w[j] * (got - need[j])) ** 2;
    }, 0);
    if (err < best.err - 1e-12) best = { err, dose };
  }
  return Object.fromEntries(SALTS.map((s, k) => [s.id, best.dose[k]]));
}

function solve(M, v) {
  const n = v.length;
  const a = M.map((row, i) => [...row, v[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    if (Math.abs(a[p][c]) < 1e-12) return null;
    [a[c], a[p]] = [a[p], a[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = a[r][c] / a[c][c];
      for (let k = c; k <= n; k++) a[r][k] -= f * a[c][k];
    }
  }
  return a.map((row, i) => row[n] / row[i]);
}

// ---------- pH ----------

// Restalkalitet i mEq/l.
export function residualAlkalinity(p) {
  const alk = (p.hco3 || 0) / 61.02;
  return alk - (p.ca || 0) / 20.04 / 3.5 - (p.mg || 0) / 12.15 / 7;
}

// Mäsk-pH givet maltlista, mäskvattnets jonprofil och mängd mjölksyra (ml).
export function mashPh({ malts, mashL, water, lacticMl = 0 }) {
  const { phDi, buffer, acidMeq } = maltSummary(malts);
  if (buffer <= 0) return null;
  const raMeq = residualAlkalinity(water) * mashL;
  // Iterera eftersom syrans styrka beror lite på pH.
  let ph = phDi + (raMeq - acidMeq) / buffer;
  for (let i = 0; i < 5; i++) ph = phDi + (raMeq - acidMeq - lacticMl * lacticMeqPerMl(ph)) / buffer;
  return ph;
}

// Mängd mjölksyra 80 % (ml) för att nå målvärdet för mäsk-pH.
export function lacticForMashPh({ malts, mashL, water, targetPh }) {
  const { phDi, buffer, acidMeq } = maltSummary(malts);
  if (buffer <= 0) return 0;
  const raMeq = residualAlkalinity(water) * mashL;
  const meq = raMeq - acidMeq - (targetPh - phDi) * buffer;
  return Math.max(meq / lacticMeqPerMl(targetPh), 0);
}

function maltSummary(malts) {
  let buffer = 0; let weighted = 0; let acidMeq = 0;
  for (const m of malts) {
    const kg = Math.max(+m.kg || 0, 0);
    const type = MALT_TYPES.find((t) => t.id === m.type) || MALT_TYPES[0];
    const b = kg * type.buffer;
    buffer += b;
    weighted += b * maltPhDi(type.id, +m.ebc || type.ebc);
    if (type.id === 'acid') acidMeq += kg * ACID_MALT_MEQ_PER_KG;
  }
  return { phDi: buffer > 0 ? weighted / buffer : 0, buffer, acidMeq };
}

// Mjölksyra (ml) för att sänka lakvattnets pH till målvärdet.
export function lacticForSparge({ water, spargeL, targetPh }) {
  const alk = (water.hco3 || 0) / 61.02; // mEq/l
  const startPh = water.ph || 8;
  const frac = (ph) => 1 / (1 + 10 ** (6.35 - ph));
  if (targetPh >= startPh) return 0;
  const meq = alk * (1 - frac(targetPh) / frac(startPh)) * spargeL;
  return Math.max(meq / lacticMeqPerMl(targetPh), 0);
}

// Hela kemiplanen för en bryggning: salter per kärl, pH och mjölksyra.
// state = sparat Kemi-läge. Muterar state.salts om automatiskt förslag är på.
export function planChemistry(state, mashL, spargeL, recalcSalts = true) {
  const totalL = mashL + spargeL;
  if (state.auto && recalcSalts) {
    const dose = suggestSaltDose(state.source, state.target);
    for (const s of SALTS) state.salts[s.id] = dose[s.id] * totalL;
  }
  const mashShare = state.spargeSalts && totalL > 0 ? mashL / totalL : 1;
  const mashSalts = {}; const spargeSalts = {};
  for (const s of SALTS) {
    mashSalts[s.id] = (state.salts[s.id] || 0) * mashShare;
    spargeSalts[s.id] = (state.salts[s.id] || 0) - mashSalts[s.id];
  }
  const mashWater = addProfiles(state.source, ionsFromSalts(mashSalts, mashL));
  const kettle = addProfiles(state.source, ionsFromSalts(state.salts, totalL));
  const malts = (state.malts || []).filter((m) => m.kg > 0);
  const phNoAcid = mashPh({ malts, mashL, water: mashWater });
  const mashAcid = lacticForMashPh({ malts, mashL, water: mashWater, targetPh: state.mashPhTarget });
  const phWithAcid = mashPh({ malts, mashL, water: mashWater, lacticMl: mashAcid });
  const spargeAcid = state.spargeAcid
    ? lacticForSparge({ water: state.source, spargeL, targetPh: state.spargePhTarget })
    : 0;
  return { mashSalts, spargeSalts, mashWater, kettle, phNoAcid, mashAcid, phWithAcid, spargeAcid };
}
