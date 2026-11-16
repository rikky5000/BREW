import { load, save } from './storage.js';

// ---------- Ingrediensdatabas ----------
// kind styr pH-modellen i vattenkemin; yield = extraktutbyte (%).
export const MALTS = [
  { name: 'Pilsnermalt',            ebc: 3.5,  yield: 81, kind: 'pils' },
  { name: 'Pale Ale-malt',          ebc: 6,    yield: 80, kind: 'pale' },
  { name: 'Maris Otter',            ebc: 6,    yield: 81, kind: 'pale' },
  { name: 'Wienermalt',             ebc: 8,    yield: 80, kind: 'munich' },
  { name: 'Münchenmalt I',          ebc: 15,   yield: 80, kind: 'munich' },
  { name: 'Münchenmalt II',         ebc: 25,   yield: 79, kind: 'munich' },
  { name: 'Melanoidinmalt',         ebc: 70,   yield: 78, kind: 'munich' },
  { name: 'Vetemalt ljus',          ebc: 4,    yield: 83, kind: 'wheat' },
  { name: 'Havreflingor',           ebc: 2,    yield: 70, kind: 'wheat' },
  { name: 'Carapils / Carafoam',    ebc: 4,    yield: 75, kind: 'crystal' },
  { name: 'Carahell',               ebc: 25,   yield: 75, kind: 'crystal' },
  { name: 'Caramünch I',            ebc: 90,   yield: 74, kind: 'crystal' },
  { name: 'Crystal 150',            ebc: 150,  yield: 73, kind: 'crystal' },
  { name: 'Caraaroma',              ebc: 400,  yield: 72, kind: 'crystal' },
  { name: 'Chokladmalt',            ebc: 900,  yield: 70, kind: 'roast' },
  { name: 'Carafa Special II',      ebc: 1100, yield: 70, kind: 'roast' },
  { name: 'Rostat korn',            ebc: 1200, yield: 68, kind: 'roast' },
  { name: 'Surmalt',                ebc: 4,    yield: 77, kind: 'acid' },
  { name: 'Socker (sukros)',        ebc: 0,    yield: 100, kind: 'sugar' },
  { name: 'Druvsocker (dextros)',   ebc: 0,    yield: 92, kind: 'sugar' },
];

export const MALT_KINDS = [
  { id: 'pils', name: 'Basmalt (pils)' },
  { id: 'pale', name: 'Basmalt (pale)' },
  { id: 'munich', name: 'Wiener/München' },
  { id: 'wheat', name: 'Vete/havre' },
  { id: 'crystal', name: 'Karamell' },
  { id: 'roast', name: 'Rostad' },
  { id: 'acid', name: 'Surmalt' },
  { id: 'sugar', name: 'Socker' },
];

export const HOPS = [
  { name: 'Amarillo', alpha: 9 },
  { name: 'Cascade', alpha: 6.5 },
  { name: 'Centennial', alpha: 10 },
  { name: 'Citra', alpha: 12 },
  { name: 'Columbus', alpha: 15 },
  { name: 'East Kent Goldings', alpha: 5.5 },
  { name: 'El Dorado', alpha: 15 },
  { name: 'Fuggles', alpha: 4.5 },
  { name: 'Galaxy', alpha: 14 },
  { name: 'Hallertauer Mittelfrüh', alpha: 4 },
  { name: 'Magnum', alpha: 13 },
  { name: 'Mosaic', alpha: 12.5 },
  { name: 'Nelson Sauvin', alpha: 12 },
  { name: 'Northern Brewer', alpha: 8.5 },
  { name: 'Perle', alpha: 7.5 },
  { name: 'Saaz', alpha: 3.5 },
  { name: 'Simcoe', alpha: 13 },
  { name: 'Tettnanger', alpha: 4.5 },
];

export const HOP_USES = [
  { id: 'boil', name: 'Kok' },
  { id: 'whirlpool', name: 'Whirlpool' },
  { id: 'dryhop', name: 'Torrhumling' },
];

export const YEASTS = [
  { name: 'SafAle US-05', attenuation: 78 },
  { name: 'SafAle S-04', attenuation: 75 },
  { name: 'LalBrew Nottingham', attenuation: 80 },
  { name: 'LalBrew Verdant IPA', attenuation: 77 },
  { name: 'LalBrew New England', attenuation: 78 },
  { name: 'LalBrew Windsor', attenuation: 70 },
  { name: 'LalBrew London ESB', attenuation: 67 },
  { name: 'LalBrew Voss Kveik', attenuation: 80 },
  { name: 'LalBrew Belle Saison', attenuation: 90 },
  { name: 'SafAle WB-06', attenuation: 86 },
  { name: 'SafAle BE-256', attenuation: 85 },
  { name: 'SafLager W-34/70', attenuation: 83 },
  { name: 'SafLager S-23', attenuation: 80 },
  { name: 'LalBrew Novalager', attenuation: 80 },
];

// ---------- BJCP-stilar (2021), färg i EBC ----------
// water = föreslagen målprofil i vattenkemin.
export const STYLES = [
  { id: '5D',  name: 'German Pils',               og: [1.044, 1.050], fg: [1.008, 1.013], abv: [4.4, 5.2], ibu: [22, 40], ebc: [4, 8],   water: 'pilsner' },
  { id: '3B',  name: 'Czech Premium Pale Lager',  og: [1.044, 1.060], fg: [1.013, 1.017], abv: [4.2, 5.8], ibu: [30, 45], ebc: [7, 12],  water: 'pilsner' },
  { id: '4A',  name: 'Munich Helles',             og: [1.044, 1.048], fg: [1.006, 1.012], abv: [4.7, 5.4], ibu: [16, 22], ebc: [6, 10],  water: 'lager' },
  { id: '6A',  name: 'Märzen',                    og: [1.054, 1.060], fg: [1.010, 1.014], abv: [5.6, 6.3], ibu: [18, 24], ebc: [16, 33], water: 'amber' },
  { id: '10A', name: 'Weissbier',                 og: [1.044, 1.053], fg: [1.008, 1.014], abv: [4.3, 5.6], ibu: [8, 15],  ebc: [4, 12],  water: 'weiss' },
  { id: '11B', name: 'Best Bitter',               og: [1.040, 1.048], fg: [1.008, 1.012], abv: [3.8, 4.6], ibu: [25, 40], ebc: [16, 32], water: 'paleale' },
  { id: '18B', name: 'American Pale Ale',         og: [1.045, 1.060], fg: [1.010, 1.015], abv: [4.5, 6.2], ibu: [30, 50], ebc: [10, 20], water: 'paleale' },
  { id: '19A', name: 'American Amber Ale',        og: [1.045, 1.060], fg: [1.010, 1.015], abv: [4.5, 6.2], ibu: [25, 40], ebc: [20, 33], water: 'amber' },
  { id: '21A', name: 'American IPA',              og: [1.056, 1.070], fg: [1.008, 1.014], abv: [5.5, 7.5], ibu: [40, 70], ebc: [12, 28], water: 'ipa' },
  { id: '21C', name: 'Hazy IPA (NEIPA)',          og: [1.060, 1.085], fg: [1.010, 1.015], abv: [6.0, 9.0], ibu: [25, 60], ebc: [6, 14],  water: 'neipa' },
  { id: '22A', name: 'Double IPA',                og: [1.065, 1.085], fg: [1.008, 1.018], abv: [7.5, 10],  ibu: [60, 100], ebc: [12, 28], water: 'ipa' },
  { id: '15B', name: 'Irish Stout',               og: [1.036, 1.044], fg: [1.007, 1.011], abv: [3.8, 5.0], ibu: [25, 45], ebc: [49, 79], water: 'stout' },
  { id: '20A', name: 'American Porter',           og: [1.050, 1.070], fg: [1.012, 1.018], abv: [4.8, 6.5], ibu: [25, 50], ebc: [43, 79], water: 'stout' },
  { id: '24A', name: 'Witbier',                   og: [1.044, 1.052], fg: [1.008, 1.012], abv: [4.5, 5.5], ibu: [8, 20],  ebc: [4, 8],   water: 'weiss' },
  { id: '25B', name: 'Saison',                    og: [1.048, 1.065], fg: [1.002, 1.008], abv: [3.5, 9.5], ibu: [20, 35], ebc: [10, 43], water: 'belgian' },
  { id: '26B', name: 'Belgian Dubbel',            og: [1.062, 1.075], fg: [1.008, 1.018], abv: [6.0, 7.6], ibu: [15, 25], ebc: [20, 33], water: 'belgian' },
  { id: '26C', name: 'Belgian Tripel',            og: [1.075, 1.085], fg: [1.008, 1.014], abv: [7.5, 9.5], ibu: [20, 40], ebc: [9, 14],  water: 'belgian' },
];

// ---------- Lagring ----------
const KEY = 'recipes';

export function getRecipes() {
  return load(KEY, { list: [] }).list;
}

export function getRecipe(id) {
  return getRecipes().find((r) => r.id === id);
}

export function saveRecipe(recipe) {
  const list = getRecipes();
  const i = list.findIndex((r) => r.id === recipe.id);
  recipe.updated = Date.now();
  if (i >= 0) list[i] = recipe; else list.unshift(recipe);
  return save(KEY, { list });
}

export function deleteRecipe(id) {
  return save(KEY, { list: getRecipes().filter((r) => r.id !== id) });
}

export function newRecipe(eq) {
  return {
    id: `r-${Date.now().toString(36)}`,
    name: 'Nytt recept',
    styleId: '18B',
    batchL: 45,
    boilMin: 60,
    efficiency: eq.efficiency,
    mashTemp: 66,
    malts: [{ name: 'Pale Ale-malt', kg: 10, ebc: 6, yield: 80, kind: 'pale' }],
    hops: [
      { name: 'Magnum', g: 30, alpha: 13, use: 'boil', min: 60 },
      { name: 'Cascade', g: 60, alpha: 6.5, use: 'boil', min: 10 },
    ],
    yeast: { name: 'SafAle US-05', attenuation: 78 },
    notes: '',
  };
}

// ---------- Beräkningar ----------
// OG beräknas på kall vört efter kok (batch + förlust i kärl) med
// bryggverkets verkningsgrad. Socker räknas med 100 % utbyte.
export function calcRecipe(r, eq) {
  const postBoilL = Math.max((+r.batchL || 0) + (eq.kettleLoss || 0), 0.1);
  const eff = (+r.efficiency || 0) / 100;

  let points = 0; let grainKg = 0; let totalKg = 0; let mcu = 0;
  for (const m of r.malts) {
    const kg = Math.max(+m.kg || 0, 0);
    totalKg += kg;
    const ppkgL = 385.6 * ((+m.yield || 0) / 100); // gravitetspunkter per kg i 1 L vid 100 %
    if (m.kind === 'sugar') {
      points += ppkgL * kg;
    } else {
      grainKg += kg;
      points += ppkgL * kg * eff;
    }
    const lovibond = ((+m.ebc || 0) / 1.97 + 0.76) / 1.3546;
    mcu += (kg * 2.20462 * lovibond) / (postBoilL / 3.78541);
  }
  const og = 1 + points / postBoilL / 1000;
  const att = Math.min(Math.max(+r.yeast?.attenuation || 0, 0), 100) / 100;
  const fg = 1 + (og - 1) * (1 - att);
  const abv = (og - fg) * 131.25;
  const srm = mcu > 0 ? 1.4922 * mcu ** 0.6859 : 0;
  const ebc = srm * 1.97;

  // IBU enligt Tinseth. Whirlpool räknas förenklat som 40 % av motsvarande koktid.
  let ibu = 0;
  const bigness = 1.65 * 0.000125 ** (og - 1);
  for (const h of r.hops) {
    if (h.use === 'dryhop') continue;
    const min = Math.max(+h.min || 0, 0);
    let util = bigness * ((1 - Math.exp(-0.04 * min)) / 4.15);
    if (h.use === 'whirlpool') util *= 0.4;
    ibu += (util * ((+h.alpha || 0) / 100) * (+h.g || 0) * 1000) / postBoilL;
  }

  const buGu = og > 1 ? ibu / ((og - 1) * 1000) : 0;
  return { og, fg, abv, ibu, ebc, grainKg, totalKg, buGu, postBoilL };
}

// Ungefärlig ölfärg (sRGB) från EBC, via vedertagen SRM-färgtabell (1–40).
const SRM_HEX = ['FFE699','FFD878','FFCA5A','FFBF42','FBB123','F8A600','F39C00','EA8F00','E58500','DE7C00',
  'D77200','CF6900','CB6200','C35900','BB5100','B54C00','B04500','A63E00','A13700','9B3200',
  '952D00','8E2900','882300','821E00','7B1A00','771900','701400','6A0E00','660D00','5E0B00',
  '5A0A02','600903','520907','4C0505','470606','440607','3F0708','3B0607','3A070B','36080A'];
export function ebcToColor(ebc) {
  const srm = Math.min(Math.max(ebc / 1.97, 1), 40);
  const i = Math.floor(srm) - 1;
  const j = Math.min(i + 1, 39);
  const t = srm - Math.floor(srm);
  const rgb = (h) => [0, 2, 4].map((k) => parseInt(h.slice(k, k + 2), 16));
  const a = rgb(SRM_HEX[i]); const b = rgb(SRM_HEX[j]);
  const c = a.map((v, k) => Math.round(v + (b[k] - v) * t));
  return `rgb(${c.join(', ')})`;
}
