/**
 * Identifiant unique côté client.
 *
 * `crypto.randomUUID()` manque sur iOS < 15.4 et dans tout contexte non
 * sécurisé : l'appel lève AVANT le moindre `setState`, et le bouton « Envoyer »
 * de Mola ne faisait alors rien du tout. Ici : la version native quand elle
 * existe, sinon un UUID v4 tiré de `getRandomValues`.
 */
export function uid(): string {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const b = new Uint8Array(16);
  // getRandomValues existe partout où l'app tourne (iOS 6+, tous les WebView) ;
  // un identifiant prévisible (Math.random) servirait de nom de fichier de
  // stockage, on préfère échouer franchement.
  if (!c || typeof c.getRandomValues !== 'function') throw new Error('Générateur aléatoire indisponible');
  c.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
