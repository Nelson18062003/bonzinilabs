// ============================================================
// CODE 128 — le code-barres à barres de l'étiquette interne, sous le QR.
// Même donnée que le QR (le numéro du colis), pour un lecteur ancien qui ne
// lit pas les codes 2D. Jeu B (lettres, chiffres, tiret) ; chaque symbole
// fait onze modules, le stop treize. Rendu en rectangles : pas de police.
// ============================================================

/** Les 107 motifs (largeurs barre/espace alternées), indexés par valeur. */
const PATTERNS = [
  '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213','221312','231212','112232','122132','122231','113222',
  '123122','123221','223211','221132','221231','213212','223112','312131','311222','321122','321221','312212','322112','322211','212123','212321',
  '232121','111323','131123','131321','112313','132113','132311','211313','231113','231311','112133','112331','132131','113123','113321','133121',
  '313121','211331','231131','213113','213311','213131','311123','311321','331121','312113','312311','332111','314111','221411','431111','111224',
  '111422','121124','121421','141122','141221','112214','112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
  '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141','214121','412121','111143','111341','131141','114113',
  '114311','411113','411311','113141','114131','311141','411131','211412','211214','211232','2331112',
];
const START_B = 104, STOP = 106;

/** La valeur Code 128 B d'un caractère (espace = 0 … DEL = 95). */
function valueB(ch: string): number {
  const c = ch.charCodeAt(0);
  if (c < 32 || c > 127) throw new Error(`Code 128 B : caractère hors jeu « ${ch} »`);
  return c - 32;
}

/** Les modules du code, en largeurs alternées (barre, espace, barre…), avec le contrôle et le stop. */
export function code128Widths(text: string): number[] {
  if (!text) throw new Error('Code 128 : texte vide');
  const values = Array.from(text).map(valueB);
  let check = START_B;
  values.forEach((v, i) => { check += v * (i + 1); });
  const symbols = [START_B, ...values, check % 103, STOP];
  return symbols.flatMap((s) => Array.from(PATTERNS[s]).map(Number));
}

/** Les barres (x, largeur) sur `totalModules` modules, prêtes à être peintes ; `quiet` modules de silence de chaque côté. */
export function code128Bars(text: string, quiet = 10): { bars: Array<{ x: number; w: number }>; totalModules: number } {
  const widths = code128Widths(text);
  const bars: Array<{ x: number; w: number }> = [];
  let x = quiet;
  widths.forEach((w, i) => { if (i % 2 === 0) bars.push({ x, w }); x += w; });
  return { bars, totalModules: x + quiet };
}
