// Vattenberäkning för ett enkärlssystem med maltrör (BrewZilla).
//
// Baklänges från volymen i jäskärlet:
//   kall vört efter kok  = batch + förlust i kärl
//   varm vört efter kok  = kall / (1 - krympning)
//   före kok             = varm + avkok * koktid
//   totalt vatten        = före kok + maltabsorption * malt
//   mäskvatten           = malt * mäsktjocklek (max totalt)
//   lakvatten            = totalt - mäskvatten

export const WATER_KEY = 'water-input';

export function waterDefaults(eq) {
  return { grainKg: 11, batchL: 45, boilMin: 60, mashRatio: eq.mashRatio, mashTemp: 66, grainTemp: 18 };
}

export function calcWater(input, eq) {
  const grain = num(input.grainKg);
  const batch = num(input.batchL);
  const boilMin = num(input.boilMin);
  const ratio = num(input.mashRatio) || eq.mashRatio;
  const mashTemp = num(input.mashTemp);
  const grainTemp = num(input.grainTemp);

  const shrink = Math.min(Math.max(eq.coolingShrinkage, 0), 20) / 100;
  const postBoilCold = batch + eq.kettleLoss;
  const postBoilHot = postBoilCold / (1 - shrink);
  const boilOff = eq.boilOffRate * (boilMin / 60);
  const preBoil = postBoilHot + boilOff;
  const absorption = grain * eq.grainAbsorption;
  const total = preBoil + absorption;

  let mash = grain * ratio;
  if (mash > total) mash = total;
  const sparge = Math.max(total - mash, 0);

  const mashVolumeWithGrain = mash + grain * eq.grainDisplacement;
  const effectiveRatio = grain > 0 ? mash / grain : 0;

  // Insläppstemperatur (Palmer, metriskt): Tw = (0.41 / r)(T2 - T1) + T2
  const strikeTemp = effectiveRatio > 0
    ? (0.41 / effectiveRatio) * (mashTemp - grainTemp) + mashTemp
    : mashTemp;

  const warnings = [];
  if (grain > eq.maxGrain) {
    warnings.push(`Maltmängden (${fmt(grain)} kg) är över maxgränsen för maltröret (${fmt(eq.maxGrain)} kg).`);
  }
  if (mashVolumeWithGrain > eq.kettleVolume) {
    warnings.push(`Mäsken (${fmt(mashVolumeWithGrain)} L inkl. malt) får inte plats i kärlet (${fmt(eq.kettleVolume)} L).`);
  }
  if (preBoil > eq.kettleVolume * 0.92) {
    warnings.push(`Volymen före kok (${fmt(preBoil)} L) är nära kärlets kapacitet – risk för överkok.`);
  }
  if (grain > 0 && sparge === 0 && grain * ratio > total) {
    warnings.push('Allt vatten går åt till mäsken – inget lakvatten kvar. Sänk mäsktjockleken eller öka batchen.');
  }

  return {
    total, mash, sparge, preBoil, postBoilHot, postBoilCold,
    boilOff, absorption, mashVolumeWithGrain, effectiveRatio, strikeTemp, warnings,
  };
}

function num(v) {
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export function fmt(n, digits = 1) {
  return n.toLocaleString('sv-SE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
