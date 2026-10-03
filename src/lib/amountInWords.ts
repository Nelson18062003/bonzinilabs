// ============================================================
// UN MONTANT EN TOUTES LETTRES — « Deux-cent-dix-neuf mille huit-cent-quarante
// francs CFA » sous le chiffre du devis, comme sur la packing list client :
// un montant écrit deux fois ne se falsifie pas d'un trait de stylo.
//
// Français : orthographe rectifiée (traits d'union dans chaque groupe de trois
// chiffres), « vingt » et « cent » prennent un s quand ils sont multipliés et
// terminent le nombre (« quatre-vingts », « deux-cents ») ou précèdent
// « million(s) » / « milliard(s) », qui sont des noms ; jamais devant
// « mille », qui est invariable. « mille », pas « un mille ».
// Anglais : « two hundred nineteen thousand eight hundred forty ».
// Entiers positifs seulement — un montant de devis est en XAF entiers.
// ============================================================

const FR_UNITS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
  'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
const FR_TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

function frBelow100(n: number): string {
  if (n < 20) return FR_UNITS[n];
  const t = Math.floor(n / 10);
  // 70-79 et 90-99 se disent « soixante-dix… », « quatre-vingt-dix… »
  const u = n % 10 + (t === 7 || t === 9 ? 10 : 0);
  const tens = FR_TENS[t];
  if (u === 0) return t === 8 ? 'quatre-vingts' : tens;
  if (u === 1 && t >= 2 && t <= 6) return `${tens}-et-un`;
  if (u === 11 && t === 7) return `${tens}-et-onze`;
  return `${tens}-${FR_UNITS[u]}`;
}

function frBelow1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h === 0) return frBelow100(r);
  const hundreds = h === 1 ? 'cent' : `${FR_UNITS[h]}-cent`;
  if (r === 0) return h > 1 ? `${hundreds}s` : hundreds;
  return `${hundreds}-${frBelow100(r)}`;
}

/** 219 840 → « deux-cent-dix-neuf mille huit-cent-quarante ». */
export function numberToWordsFr(value: number): string {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return 'zéro';
  const parts: string[] = [];
  for (const [div, one, many] of [[1e9, 'milliard', 'milliards'], [1e6, 'million', 'millions'], [1e3, 'mille', 'mille']] as const) {
    const q = Math.floor(n / div);
    n %= div;
    if (!q) continue;
    if (div === 1e3) {
      // « mille », pas « un mille » ; et « vingt » / « cent » restent invariables devant « mille ».
      parts.push(q === 1 ? 'mille' : `${frBelow1000(q).replace(/(cent|vingt)s$/, '$1')} mille`);
    } else {
      parts.push(`${frBelow1000(q)} ${q === 1 ? one : many}`);
    }
  }
  if (n) parts.push(frBelow1000(n));
  return parts.join(' ');
}

const EN_UNITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function enBelow1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const words: string[] = [];
  if (h) words.push(`${EN_UNITS[h]} hundred`);
  if (r) words.push(r < 20 ? EN_UNITS[r] : EN_TENS[Math.floor(r / 10)] + (r % 10 ? `-${EN_UNITS[r % 10]}` : ''));
  return words.join(' ');
}

/** 219 840 → « two hundred nineteen thousand eight hundred forty ». */
export function numberToWordsEn(value: number): string {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return 'zero';
  const parts: string[] = [];
  for (const [div, word] of [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']] as const) {
    const q = Math.floor(n / div);
    n %= div;
    if (q) parts.push(`${enBelow1000(q)} ${word}`);
  }
  if (n) parts.push(enBelow1000(n));
  return parts.join(' ');
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * « Deux-cent-dix-neuf mille huit-cent-quarante francs CFA » / « Two hundred
 * nineteen thousand eight hundred forty CFA francs ». « million » et
 * « milliard » sont des noms : « deux millions DE francs CFA », mais « deux
 * millions cinq-cent mille francs CFA ». Le singulier pour 0 et 1 en français
 * (« un franc »), pour 1 seulement en anglais. Au-delà de 999 milliards (aucun
 * devis réel), rien : le chiffre seul fait foi.
 */
export function xafInWords(amount: number, lang: 'fr' | 'en'): string {
  const n = Math.round(Math.abs(Number(amount) || 0));
  if (n >= 1e12) return '';
  if (lang === 'en') return `${capitalize(numberToWordsEn(n))} CFA ${n === 1 ? 'franc' : 'francs'}`;
  const words = numberToWordsFr(n);
  const de = /(?:million|milliard)s?$/.test(words) ? ' de' : '';
  return `${capitalize(words)}${de} ${n <= 1 ? 'franc' : 'francs'} CFA`;
}
