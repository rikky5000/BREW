// Bryggdag: bygger en steg-för-steg-plan från ett recept och håller timrar.
import { load, save } from './storage.js';
import { calcWater, fmt } from './water.js';
import { calcRecipe } from './recipes.js';
import { SALTS, planChemistry } from './chemistry.js';
import { applyRecipe } from './recipe-view.js';
import { chemistryDefaults } from './chemistry-view.js';

const KEY = 'brewday';
const BATCHES_KEY = 'batches';
const TAP_TEMP = 10; // °C, antagen temperatur på kranvatten

export function getSession() {
  return load(KEY, { session: null }).session;
}

export function saveSession(session) {
  return save(KEY, { session });
}

export function getBatches() {
  return load(BATCHES_KEY, { list: [] }).list;
}

export function finishSession(session) {
  session.finishedAt = Date.now();
  const list = getBatches();
  list.unshift(session);
  save(BATCHES_KEY, { list });
  saveSession(null);
}

// Uppvärmningstid i minuter (90 % verkningsgrad på elementet).
export function heatMinutes(liters, fromC, toC, watts) {
  if (!(watts > 0) || toC <= fromC) return 0;
  return (liters * 4186 * (toC - fromC)) / (watts * 0.9) / 60;
}

const isLager = (name) => /lager|34\/70|w-?34|s-?23|novalager|diamond|2124|2206/i.test(name || '');
const isUse = (m, re) => re.test(`${m.use || ''}`);

export function buildSession(recipe, eq) {
  // Synka Vatten & Kemi med receptet så att alla sidor visar samma siffror.
  applyRecipe(recipe, eq);

  const c = calcRecipe(recipe, eq);
  const mashRatio = recipe.mashRatio ?? eq.mashRatio;
  const w = calcWater({
    grainKg: c.grainKg, batchL: recipe.batchL, boilMin: recipe.boilMin,
    mashRatio, mashTemp: recipe.mashTemp, grainTemp: 18,
  }, eq);

  const chemState = load('chemistry', chemistryDefaults(c.grainKg));
  const chem = planChemistry(chemState, w.mash, w.sparge);
  save('chemistry', chemState);

  const saltTasks = (salts) => SALTS
    .filter((s) => (salts[s.id] || 0) >= 0.05)
    .map((s) => `${s.name}: ${fmt(salts[s.id])} ${s.unit}`);

  const power = eq.elementPower || 3500;
  const heatStrike = heatMinutes(w.mash, TAP_TEMP, w.strikeTemp, power);
  const heatBoil = heatMinutes(w.preBoil, 76, 100, power);

  const boilHops = recipe.hops.filter((h) => h.use === 'boil').sort((a, b) => b.min - a.min);
  const wpHops = recipe.hops.filter((h) => h.use === 'whirlpool');
  const dryHops = recipe.hops.filter((h) => h.use === 'dryhop');
  const miscs = recipe.miscs || [];
  const mashMiscs = miscs.filter((m) => isUse(m, /mäsk|mash/i));
  const boilMiscs = miscs.filter((m) => isUse(m, /kok|boil/i));
  const laterMiscs = miscs.filter((m) => !mashMiscs.includes(m) && !boilMiscs.includes(m));
  const wpTemp = wpHops.length ? Math.min(...wpHops.map((h) => h.temp ?? 80)) : 80;
  const wpMin = wpHops.length ? Math.max(...wpHops.map((h) => +h.min || 0), 10) : 0;
  const lager = isLager(recipe.yeast?.name);

  let n = 0;
  const task = (text, extra = {}) => ({ id: `t${n++}`, text, done: false, ...extra });
  const miscText = (m) => `${m.name}: ${fmt(+m.amount || 0, 1)} ${m.unit || ''}`.trim();

  const steps = [
    {
      id: 'prep', title: 'Förberedelser', icon: 'drop',
      tasks: [
        task('Rengör och sanera utrustning, jäskärl och slangar'),
        task(`Fyll BrewZillan med ${fmt(w.mash)} L mäskvatten`),
        ...saltTasks(chem.mashSalts).map((t) => task(`Tillsätt i mäskvattnet – ${t}`)),
        ...(chem.mashAcid >= 0.05 ? [task(`Tillsätt i mäskvattnet – Mjölksyra 80 %: ${fmt(chem.mashAcid)} ml`)] : []),
        task(`Värm till insläppstemperatur ${fmt(w.strikeTemp)} °C (≈ ${fmt(heatStrike, 0)} min vid ${fmt(power, 0)} W)`),
        task(`Förbered ${fmt(w.sparge)} L lakvatten, ca 76–78 °C`),
        ...saltTasks(chem.spargeSalts).map((t) => task(`Tillsätt i lakvattnet – ${t}`)),
        ...(chem.spargeAcid >= 0.05 ? [task(`Tillsätt i lakvattnet – Mjölksyra 80 %: ${fmt(chem.spargeAcid)} ml`)] : []),
      ],
    },
    {
      id: 'mash', title: 'Mäskning', icon: 'flame',
      tasks: [
        task('Sätt i maltröret och starta recirkulationen'),
        task(`Mäska in ${fmt(c.grainKg, 2)} kg malt under omrörning – inga klumpar`),
        ...mashMiscs.map((m) => task(`Tillsätt – ${miscText(m)}`)),
        task(`Mät mäsk-pH efter 10–15 min (mål ${fmt(chemState.mashPhTarget, 2)}, uppskattat ${chem.phWithAcid ? fmt(chem.phWithAcid, 2) : '–'})`, { measure: 'mashPh' }),
        task('Mäska ut: höj till 76–78 °C'),
      ],
      timers: [
        { id: 'mash', label: `Mäskning ${fmt(recipe.mashTemp)} °C`, minutes: 60,
          alarms: [{ at: 15, text: 'Dags att mäta mäsk-pH' }, { at: 'end', text: 'Mäskningen klar – höj till 76–78 °C' }] },
        { id: 'mashout', label: 'Mäska ut 76–78 °C', minutes: 10, alarms: [{ at: 'end', text: 'Mäska ut klar – dags att laka' }] },
      ],
    },
    {
      id: 'sparge', title: 'Lakning', icon: 'drop',
      tasks: [
        task('Lyft maltröret och låt det rinna av'),
        task(`Laka långsamt med ${fmt(w.sparge)} L lakvatten`),
        task(`Mät volym och densitet före kok (förväntat ${fmt(w.preBoil)} L, ${c.boilGravity.toFixed(3)})`, { measure: 'preBoil' }),
      ],
    },
    {
      id: 'boil', title: 'Kok', icon: 'flame',
      tasks: [
        task(`Värm upp till kok på ${fmt(power, 0)} W (≈ ${fmt(heatBoil, 0)} min)`),
        task('Skumma av när koket startar, sänk sedan till ett jämnt kok'),
        ...boilHops.map((h) => task(`${fmt(h.min, 0)} min kvar – ${h.name}: ${fmt(h.g, 1)} g`)),
        ...boilMiscs.map((m) => task(`I koket – ${miscText(m)}`)),
        task('Sanera kylaren (dopp i kokande vört sista 10–15 min)'),
      ],
      timers: [{
        id: 'boil', label: `Kok ${fmt(recipe.boilMin, 0)} min`, minutes: +recipe.boilMin || 60,
        alarms: [
          ...boilHops.map((h) => ({ at: Math.max((+recipe.boilMin || 60) - (+h.min || 0), 0), text: `Tillsätt ${h.name} ${fmt(h.g, 1)} g` })),
          { at: 'end', text: 'Koket klart – stäng av värmen' },
        ],
      }],
    },
    ...(wpHops.length ? [{
      id: 'whirlpool', title: 'Whirlpool', icon: 'timer',
      tasks: [
        task(`Kyl till ${fmt(wpTemp, 0)} °C`),
        ...wpHops.map((h) => task(`Tillsätt ${h.name}: ${fmt(h.g, 1)} g`)),
        task('Kör pumpen i whirlpool'),
      ],
      timers: [{ id: 'whirlpool', label: `Whirlpool ${fmt(wpTemp, 0)} °C`, minutes: wpMin, alarms: [{ at: 'end', text: 'Whirlpool klar – kyl vidare' }] }],
    }] : []),
    {
      id: 'chill', title: 'Kylning & mätning', icon: 'chart',
      tasks: [
        task(`Kyl vörten till ${lager ? '10–12' : '18–20'} °C`),
        task(`Mät volym i kärlet efter kok (förväntat ${fmt(c.postBoilL / (1 - (eq.coolingShrinkage || 0) / 100))} L varm)`, { measure: 'postBoil' }),
        task(`Mät OG (förväntat ${c.og.toFixed(3)})`, { measure: 'og' }),
        task(`För över till jäskärlet (förväntat ${fmt(recipe.batchL)} L)`, { measure: 'ferm' }),
      ],
    },
    {
      id: 'ferment', title: 'Jäsning', icon: 'bubbles',
      tasks: [
        task('Syresätt vörten'),
        task(`Tillsätt jäst – ${recipe.yeast?.name || 'jäst'}`),
        task(`Ställ jästemperatur ${lager ? '10–12' : '18–20'} °C`),
        ...dryHops.map((h) => task(`Planera torrhumling – ${h.name}: ${fmt(h.g, 1)} g (dag ${fmt(h.min, 0)})`)),
        ...laterMiscs.map((m) => task(`Senare (${m.use || 'enligt recept'}) – ${miscText(m)}`)),
        task('Diska och torka utrustningen'),
      ],
    },
  ];

  return {
    id: `b-${Date.now().toString(36)}`,
    recipeId: recipe.id,
    recipeName: recipe.name,
    recipe: structuredClone(recipe),
    startedAt: Date.now(),
    expected: {
      og: c.og, fg: c.fg, abv: c.abv, ibu: c.ibu, preBoilL: w.preBoil, preBoilSg: c.boilGravity,
      postBoilL: c.postBoilL, batchL: +recipe.batchL, mashL: w.mash, spargeL: w.sparge, strikeTemp: w.strikeTemp,
      mashPh: chemState.mashPhTarget,
    },
    steps,
    open: 'prep',
    timers: {},
    m: {},
  };
}

// ---------- Timrar ----------
// Tiden räknas från tidsstämplar, så den stämmer även efter omladdning eller skärmlås.
export function timerState(session, t) {
  const s = session.timers[t.id] || { elapsedMs: 0, runningSince: null, fired: [], minutes: t.minutes };
  session.timers[t.id] = s;
  return s;
}

export function elapsedMs(s, now = Date.now()) {
  return s.elapsedMs + (s.runningSince ? now - s.runningSince : 0);
}

export function remainingMs(s, now) {
  return Math.max(s.minutes * 60000 - elapsedMs(s, now), 0);
}

// Returnerar larm som har passerats men inte visats.
export function dueAlarms(s, t, now = Date.now()) {
  if (!s.runningSince && !s.elapsedMs) return []; // timern har inte startats
  const el = elapsedMs(s, now);
  const out = [];
  t.alarms.forEach((a, i) => {
    const atMs = (a.at === 'end' ? s.minutes : a.at) * 60000;
    if (el >= atMs && !s.fired.includes(i)) { s.fired.push(i); out.push(a.text); }
  });
  return out;
}

export function fmtClock(ms) {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}
