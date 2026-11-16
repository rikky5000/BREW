import { load, save } from './storage.js';

// Standardprofil för BrewZilla 65L Gen 4.1.
// Värdena är utgångspunkter – justera efter egna mätningar.
export const BREWZILLA_65_DEFAULTS = {
  name: 'BrewZilla 65L Gen 4.1',
  kettleVolume: 65,        // L, total volym i kärlet
  maxGrain: 16,            // kg, ungefärlig max i maltröret (uppskattat)
  elementPower: 2000,      // W, 2000 / 1000 / 500
  boilOffRate: 5,          // L/timme vid full effekt
  kettleLoss: 4,           // L, trub + dödvolym under kranen
  grainAbsorption: 0.8,    // L/kg, kvar i malten efter lakning
  grainDisplacement: 0.67, // L/kg, malten tar plats i kärlet
  coolingShrinkage: 4,     // %, volymminskning vid kylning
  mashRatio: 3.0,          // L/kg, standard vattenmängd i mäsken
  efficiency: 72,          // %, bryggverkets verkningsgrad
};

const KEY = 'equipment';

export function getEquipment() {
  return load(KEY, BREWZILLA_65_DEFAULTS);
}

export function saveEquipment(eq) {
  return save(KEY, eq);
}

// Fält som visas i utrustningsformuläret.
export const EQUIPMENT_FIELDS = [
  { key: 'name', label: 'Namn', type: 'text' },
  { key: 'kettleVolume', label: 'Kärlvolym', unit: 'L', step: 1 },
  { key: 'maxGrain', label: 'Max malt i maltröret', hint: 'Uppskattat – kontrollera', unit: 'kg', step: 0.5 },
  { key: 'elementPower', label: 'Elementeffekt', unit: 'W', options: [2000, 1000, 500] },
  { key: 'boilOffRate', label: 'Avkok', hint: 'Mät vid ditt vanliga kok', unit: 'L/h', step: 0.1 },
  { key: 'kettleLoss', label: 'Förlust i kärl', hint: 'Trub + dödvolym', unit: 'L', step: 0.1 },
  { key: 'grainAbsorption', label: 'Maltabsorption', unit: 'L/kg', step: 0.05 },
  { key: 'grainDisplacement', label: 'Maltens volym', hint: 'Undanträngning i kärlet', unit: 'L/kg', step: 0.01 },
  { key: 'coolingShrinkage', label: 'Krympning vid kylning', unit: '%', step: 0.5 },
  { key: 'mashRatio', label: 'Mäsktjocklek (standard)', unit: 'L/kg', step: 0.1 },
  { key: 'efficiency', label: 'Verkningsgrad', unit: '%', step: 1 },
];
