// Inläsning av recept från fil.
// Format: BeerXML (.xml), BeerJSON (.json), Brewfather JSON (.json) och Brewfather-PDF (.pdf).
import { MALTS, YEASTS, STYLES } from './recipes.js';

export const ACCEPT = '.xml,.beerxml,.json,.pdf';

// Läser en fil och returnerar en lista med receptutkast.
export async function importFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    return parseBrewfatherPdf(await pdfToLines(await file.arrayBuffer()));
  }
  const text = await file.text();
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return parseJson(JSON.parse(trimmed));
  if (trimmed.startsWith('<')) return parseBeerXml(trimmed);
  throw new Error('Okänt filformat. Använd BeerXML (.xml), BeerJSON/Brewfather (.json) eller PDF.');
}

// ---------- BeerXML ----------
export function parseBeerXml(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Kunde inte läsa XML-filen.');
  const recipes = [...doc.getElementsByTagName('RECIPE')];
  if (!recipes.length) throw new Error('Hittade inget recept (RECIPE) i filen.');

  return recipes.map((r) => {
    const t = (el, tag) => child(el, tag)?.textContent.trim() ?? '';
    const n = (el, tag) => num(t(el, tag));
    const list = (group, item) => {
      const g = child(r, group);
      return g ? [...g.children].filter((c) => c.tagName === item) : [];
    };

    const malts = list('FERMENTABLES', 'FERMENTABLE').map((f) => {
      const type = t(f, 'TYPE').toLowerCase();
      return malt(t(f, 'NAME'), n(f, 'AMOUNT'), n(f, 'COLOR') * 1.97, n(f, 'YIELD') || null,
        type.includes('sugar') ? 'sugar' : null);
    });

    const hops = list('HOPS', 'HOP').map((h) => {
      const use = hopUse(t(h, 'USE'));
      let time = n(h, 'TIME');
      // BeerXML anger torrhumling i minuter, men många program skriver dagar.
      if (use === 'dryhop' && time > 30) time = Math.round(time / 1440);
      return { name: t(h, 'NAME'), g: round(n(h, 'AMOUNT') * 1000, 1), alpha: n(h, 'ALPHA'), use, min: time };
    });

    const y = list('YEASTS', 'YEAST')[0];
    const yeast = y ? yeastOf(`${t(y, 'NAME')} ${t(y, 'PRODUCT_ID')}`, n(y, 'ATTENUATION'), t(y, 'NAME')) : null;

    const miscs = list('MISCS', 'MISC').map((m) => {
      const isWeight = t(m, 'AMOUNT_IS_WEIGHT').toLowerCase() === 'true';
      const amt = n(m, 'AMOUNT');
      return {
        name: t(m, 'NAME'),
        amount: round(amt * 1000, 1),
        unit: isWeight ? 'g' : 'ml',
        use: t(m, 'USE'),
        notes: t(m, 'NOTES'),
      };
    });

    const style = child(r, 'STYLE');
    const steps = [...(child(r, 'MASH')?.getElementsByTagName('MASH_STEP') ?? [])];
    const mashTemp = steps.length ? n(steps[0], 'STEP_TEMP') : null;

    return draft({
      format: 'BeerXML',
      name: t(r, 'NAME'),
      styleId: findStyle(style && t(style, 'NAME'), style && t(style, 'CATEGORY'), style && t(style, 'CATEGORY_LETTER')),
      styleName: style ? t(style, 'NAME') : '',
      batchL: n(r, 'BATCH_SIZE'),
      boilMin: n(r, 'BOIL_TIME'),
      efficiency: n(r, 'EFFICIENCY'),
      mashTemp,
      malts, hops, yeast, miscs,
      notes: t(r, 'NOTES'),
      og: n(r, 'OG') || n(r, 'EST_OG'),
      fg: n(r, 'FG') || n(r, 'EST_FG'),
    });
  });
}

function child(el, tag) {
  return el ? [...el.children].find((c) => c.tagName.toUpperCase() === tag) : null;
}

// ---------- JSON (BeerJSON eller Brewfather) ----------
function parseJson(data) {
  if (data.beerjson) return (data.beerjson.recipes || []).map(parseBeerJsonRecipe);
  const list = Array.isArray(data) ? data : [data];
  if (list.some((r) => r && Array.isArray(r.fermentables))) return list.map(parseBrewfatherJson);
  throw new Error('JSON-filen är varken BeerJSON eller en Brewfather-export.');
}

function parseBeerJsonRecipe(r) {
  const ing = r.ingredients || {};
  const malts = (ing.fermentable_additions || []).map((f) => malt(
    f.name, mass(f.amount), color(f.color), f.yield?.fine_grind?.value ?? null,
    /sugar/i.test(f.type || '') ? 'sugar' : null,
  ));
  const hops = (ing.hop_additions || []).map((h) => {
    const use = beerJsonHopUse(h.timing?.use);
    const t = h.timing?.time;
    let min = t ? timeIn(t, use === 'dryhop' ? 'day' : 'min') : 0;
    if (use === 'whirlpool' && h.timing?.duration) min = timeIn(h.timing.duration, 'min');
    return { name: h.name, g: round(mass(h.amount) * 1000, 1), alpha: h.alpha_acid?.value ?? 0, use, min: round(min, 0) };
  });
  const c = (ing.culture_additions || [])[0];
  const miscs = (ing.miscellaneous_additions || []).map((m) => ({
    name: m.name, amount: m.amount?.value ?? 0, unit: m.amount?.unit ?? '', use: m.timing?.use ?? '', notes: m.notes ?? '',
  }));
  const step = r.mash?.mash_steps?.[0];
  return draft({
    format: 'BeerJSON',
    name: r.name,
    styleId: findStyle(r.style?.name, r.style?.category_number ?? r.style?.category_id, r.style?.style_letter),
    styleName: r.style?.name ?? '',
    batchL: volume(r.batch_size),
    boilMin: r.boil?.boil_time ? timeIn(r.boil.boil_time, 'min') : 60,
    efficiency: r.efficiency?.brewhouse?.value ?? r.efficiency?.mash?.value ?? null,
    mashTemp: step ? temp(step.step_temperature) : null,
    malts, hops, miscs,
    yeast: c ? yeastOf(`${c.name} ${c.product_id || ''}`, c.attenuation?.value, c.name) : null,
    notes: r.notes ?? '',
    og: r.original_gravity?.value, fg: r.final_gravity?.value,
  });
}

// Brewfather lagrar färg i EBC, mängder i kg (malt) och g (humle).
function parseBrewfatherJson(r) {
  const malts = (r.fermentables || []).map((f) => malt(
    f.name, +f.amount || 0, +f.color || 0, f.potentialPercentage ?? null,
    /sugar/i.test(f.type || '') ? 'sugar' : null,
  ));
  const hops = (r.hops || []).map((h) => {
    const use = hopUse(h.use);
    return { name: h.name, g: +h.amount || 0, alpha: +h.alpha || 0, use, min: use === 'dryhop' ? (+h.day || +h.time || 0) : (+h.time || 0) };
  });
  const y = (r.yeasts || [])[0];
  const step = r.mash?.steps?.[0];
  return draft({
    format: 'Brewfather JSON',
    name: r.name,
    styleId: findStyle(r.style?.name, r.style?.categoryNumber, r.style?.styleLetter),
    styleName: r.style?.name ?? '',
    batchL: +r.batchSize || 0,
    boilMin: +r.boilTime || 60,
    efficiency: +r.efficiency || null,
    mashTemp: step ? +step.stepTemp : null,
    malts, hops,
    yeast: y ? yeastOf(`${y.name} ${y.productId || ''}`, y.attenuation, y.name) : null,
    miscs: (r.miscs || []).map((m) => ({ name: m.name, amount: +m.amount || 0, unit: m.unit || '', use: m.use || '', notes: m.notes || '' })),
    notes: r.notes ?? '',
    og: r.og, fg: r.fg,
  });
}

// ---------- PDF (Brewfather-utskrift) ----------
let pdfjsPromise;
function loadPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'vendor/pdfjs/pdf.min.js';
      s.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      };
      s.onerror = () => { pdfjsPromise = null; reject(new Error('Kunde inte ladda PDF-läsaren.')); };
      document.head.appendChild(s);
    });
  }
  return pdfjsPromise;
}

// Returnerar textrader per kolumn (vänster/höger), i läsordning.
export async function pdfToLines(buffer) {
  const pdfjs = await loadPdfJs();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const left = []; const right = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const width = page.getViewport({ scale: 1 }).width;
    const { items } = await page.getTextContent();
    const rows = new Map();
    for (const it of items) {
      if (!it.str.trim()) continue;
      const x = it.transform[4]; const y = Math.round(it.transform[5]);
      const side = x < width * 0.5 ? 'L' : 'R';
      const key = `${side}:${y}`;
      if (!rows.has(key)) rows.set(key, { side, y, parts: [] });
      rows.get(key).parts.push({ x, s: it.str });
    }
    const sorted = [...rows.values()].sort((a, b) => b.y - a.y);
    for (const r of sorted) {
      const text = r.parts.sort((a, b) => a.x - b.x).map((q) => q.s).join(' ').replace(/\s+/g, ' ').trim();
      (r.side === 'L' ? left : right).push(text);
    }
  }
  return { left, right };
}

export function parseBrewfatherPdf({ left, right }) {
  const all = [...left, ...right];
  const find = (re) => { for (const l of all) { const m = l.match(re); if (m) return m; } return null; };
  const val = (re) => { const m = find(re); return m ? num(m[1]) : null; };

  const titleIdx = left.findIndex((l) => /\(V\d+\)/.test(l));
  if (titleIdx < 0 && !find(/brewfather/i)) throw new Error('PDF:en ser inte ut som en Brewfather-utskrift.');
  const name = titleIdx >= 0 ? left[titleIdx].replace(/\s*\(V\d+\).*$/, '').trim() : 'Importerat recept';
  const styleName = titleIdx >= 0 ? (left[titleIdx + 1] || '').trim() : '';

  const malts = []; const hops = []; const miscs = []; let yeast = null;
  let section = '';
  for (const line of left) {
    const l = line.trim();
    if (/^(Extraktgivare|Fermentables)\b/i.test(l)) { section = 'malt'; continue; }
    if (/^(Humle|Hops)\b/i.test(l)) { section = 'boil'; continue; }
    if (/^(Hop stand|Whirlpool)\b/i.test(l)) { section = 'whirlpool'; continue; }
    if (/^(Torrhumle|Torrhumling|Dry Hop)/i.test(l)) { section = 'dryhop'; continue; }
    if (/^(Övrigt|Other|Miscs?)\b/i.test(l)) { section = 'misc'; continue; }
    if (/^(Jäst|Yeast)s?$/i.test(l)) { section = 'yeast'; continue; }
    if (/^(Jästceller|Yeast cells|Vattenprofil|Water|Anteckningar|Notes)/i.test(l)) { section = ''; continue; }

    let m;
    if (section === 'malt' && (m = l.match(/^([\d.,]+)\s*(kg|g)\s*-\s*(.+?)\s+([\d.,]+)\s*(EBC|SRM|°?L)\b/i))) {
      const kg = num(m[1]) / (m[2].toLowerCase() === 'g' ? 1000 : 1);
      const ebc = /EBC/i.test(m[5]) ? num(m[4]) : num(m[4]) * 1.97;
      malts.push(malt(m[3], kg, ebc, null, null));
    } else if (['boil', 'whirlpool', 'dryhop'].includes(section)
      && (m = l.match(/^([\d.,]+)\s*(min|dagar|dag|days?)\s*-\s*([\d.,]+)\s*(g|kg)\s*-\s*(.+?)\s*-\s*([\d.,]+)\s*%/i))) {
      const days = /dag|day/i.test(m[2]);
      hops.push({
        name: m[5].trim(),
        g: num(m[3]) * (m[4].toLowerCase() === 'kg' ? 1000 : 1),
        alpha: num(m[6]),
        use: days ? 'dryhop' : section,
        min: num(m[1]),
      });
    } else if (section === 'misc' && (m = l.match(/^(.+?)\s*-\s*([\d.,]+)\s*(ml|l|g|kg|st|pkt|items?|tsp|tbsp)\s*-\s*(.+)$/i))) {
      miscs.push({ name: m[4].trim(), amount: round(num(m[2]), 2), unit: m[3], use: m[1].trim(), notes: '' });
    } else if (section === 'misc' && miscs.length && !/^\d/.test(l)) {
      miscs[miscs.length - 1].name += ` ${l}`;
    } else if (section === 'yeast' && !yeast && (m = l.match(/^[\d.,]+\s*\S+\s*-\s*(.+)$/))) {
      yeast = yeastOf(m[1], null, m[1].trim());
    }
  }

  const step = right.map((l) => l.match(/^([\d.,]+)\s*°C\s*-\s*\d+\s*min/)).find(Boolean);
  const mashEff = val(/(?:Mäskutbyte|Mash Efficiency)\s*:?\s*([\d.,]+)\s*%/i);
  const totalEff = val(/(?:Totalt utbyte|Brewhouse Efficiency)\s*:?\s*([\d.,]+)\s*%/i);

  return [draft({
    format: 'Brewfather PDF',
    name,
    styleId: findStyle(styleName),
    styleName,
    batchL: val(/(?:Satsvolym|Batch Size)\s*:?\s*([\d.,]+)\s*L/i),
    boilMin: val(/(?:Koktid|Boil Time)\s*:?\s*([\d.,]+)\s*min/i),
    efficiency: totalEff ?? mashEff,
    mashTemp: step ? num(step[1]) : null,
    malts, hops, yeast, miscs,
    notes: '',
    og: val(/Original Gravity\s*:?\s*(1[.,]\d{3})/i),
    fg: val(/Final Gravity\s*:?\s*(1[.,]\d{3})/i),
    ibu: val(/^IBU\s*:?\s*([\d.,]+)/i),
    ebc: val(/(?:Färg|Color)\s*:?\s*([\d.,]+)\s*EBC/i),
  })];
}

// ---------- Gemensamt ----------
function draft(d) {
  // Saknas förjäsningsgrad i filen men OG och FG finns: räkna fram den så att FG stämmer.
  if (d.yeast && !d.yeast.fromFile && d.og > 1 && d.fg > 1 && d.fg < d.og) {
    d.yeast.attenuation = Math.round(((d.og - d.fg) / (d.og - 1)) * 1000) / 10;
  }
  if (d.yeast) delete d.yeast.fromFile;
  return {
    name: d.name || 'Importerat recept',
    styleId: d.styleId || '',
    batchL: d.batchL || 25,
    boilMin: d.boilMin || 60,
    efficiency: d.efficiency || 72,
    mashTemp: d.mashTemp || 66,
    malts: d.malts || [],
    hops: d.hops || [],
    yeast: d.yeast || { name: '', attenuation: 75 },
    miscs: d.miscs || [],
    notes: d.notes || '',
    source: {
      format: d.format, styleName: d.styleName || '',
      og: d.og || null, fg: d.fg || null, ibu: d.ibu ?? null, ebc: d.ebc ?? null,
    },
  };
}

function malt(name, kg, ebc, yieldPct, kindHint) {
  const clean = String(name || '').trim();
  const db = MALTS.find((m) => norm(m.name) === norm(clean));
  const kind = kindHint || db?.kind || guessMaltKind(clean, ebc);
  return {
    name: clean,
    kg: round(kg, 3),
    ebc: round(ebc || db?.ebc || 0, 1),
    yield: yieldPct || db?.yield || (kind === 'sugar' ? 100 : 78),
    kind,
  };
}

function guessMaltKind(name, ebc) {
  const n = name.toLowerCase();
  if (/sugar|socker|dextros|dextrose|honung|honey|candi|syrup|sirap/.test(n)) return 'sugar';
  if (/acid|sur(malt)?\b|sauer/.test(n)) return 'acid';
  if (/choc|chokl|roast|rost|black|carafa|svart|coffee/.test(n)) return 'roast';
  if (/crystal|cara|caramel|karamell|special b/.test(n)) return 'crystal';
  if (/wheat|vete|weizen|oat|havre|flake|flingor|rye|råg|spelt/.test(n)) return 'wheat';
  if (/munich|münch|munch|vienna|wien|melano|aroma|biscuit|amber/.test(n)) return 'munich';
  if (/pils|lager/.test(n)) return 'pils';
  if (ebc > 500) return 'roast';
  if (ebc > 40) return 'crystal';
  if (ebc > 12) return 'munich';
  return 'pale';
}

function yeastOf(search, attenuation, name) {
  const s = norm(search);
  const db = YEASTS.find((y) => s.includes(norm(y.name).replace(/^(safale|saflager|lalbrew)/, '')) || s.includes(norm(y.name)));
  return { name: (name || db?.name || '').trim(), attenuation: +attenuation || db?.attenuation || 75, fromFile: !!+attenuation };
}

function hopUse(u) {
  const s = String(u || '').toLowerCase();
  if (s.includes('dry')) return 'dryhop';
  if (/aroma|whirl|stand|flameout/.test(s)) return 'whirlpool';
  return 'boil';
}

function beerJsonHopUse(u) {
  if (u === 'add_to_fermentation' || u === 'add_to_package') return 'dryhop';
  if (u === 'add_to_boil') return 'boil';
  return 'boil';
}

export function findStyle(name, category, letter) {
  const id = category && letter ? `${parseInt(category, 10)}${String(letter).toUpperCase()}` : '';
  let s = STYLES.find((x) => x.id === id);
  if (s) return s.id;
  const n = norm(name || '');
  if (n) {
    s = STYLES.find((x) => norm(x.name) === n)
      || STYLES.find((x) => n.includes(norm(x.name)) || norm(x.name).includes(n));
    if (s) return s.id;
    if (n.includes('neipa') || n.includes('hazy')) return '21C';
    if (n.includes('ipa')) return '21A';
    if (n.includes('stout')) return '15B';
    if (n.includes('porter')) return '20A';
    if (n.includes('pils')) return '5D';
  }
  if (category) {
    s = STYLES.find((x) => parseInt(x.id, 10) === parseInt(category, 10));
    if (s) return s.id;
  }
  return '';
}

// Enhetskonvertering för BeerJSON.
function mass(q) {
  const v = +q?.value || 0; const u = String(q?.unit || 'kg').toLowerCase();
  return { kg: v, g: v / 1000, mg: v / 1e6, lb: v * 0.453592, oz: v * 0.0283495 }[u] ?? v;
}
function volume(q) {
  const v = +q?.value || 0; const u = String(q?.unit || 'l').toLowerCase();
  return { l: v, ml: v / 1000, gal: v * 3.78541, qt: v * 0.946353 }[u] ?? v;
}
function color(q) {
  const v = +q?.value || 0; const u = String(q?.unit || 'EBC').toLowerCase();
  if (u === 'ebc') return v;
  return v * 1.97; // SRM eller Lovibond
}
function temp(q) {
  const v = +q?.value || 0;
  return String(q?.unit || 'C').toUpperCase() === 'F' ? (v - 32) / 1.8 : v;
}
function timeIn(q, target) {
  const v = +q?.value || 0; const u = String(q?.unit || 'min').toLowerCase();
  const min = { min: v, s: v / 60, sec: v / 60, hr: v * 60, h: v * 60, day: v * 1440, d: v * 1440, week: v * 10080 }[u] ?? v;
  return target === 'day' ? min / 1440 : min;
}

function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
}
function num(v) {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}
function round(v, d) {
  const f = 10 ** d;
  return Math.round((+v || 0) * f) / f;
}
