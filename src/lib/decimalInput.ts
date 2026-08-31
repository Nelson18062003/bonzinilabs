// Saisie décimale francophone : « 11530,5 » doit valoir 11530.5, pas 11530.
// parseFloat s'arrête à la virgule (le séparateur décimal fr-FR ET la touche
// du pavé numérique) — sur des taux ou des pourcentages, la troncature est
// silencieuse et financièrement fausse. À utiliser pour TOUT champ décimal.
export function parseDecimal(value: string): number {
  const n = parseFloat(String(value).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}
