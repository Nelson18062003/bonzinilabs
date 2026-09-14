/**
 * Identifiant unique côté client.
 *
 * `crypto.randomUUID()` manque sur iOS < 15.4 et dans tout contexte non
 * sécurisé : l'appel lève AVANT le moindre `setState`, et le bouton « Envoyer »
 * de Mola ne faisait alors rien du tout. Ici : la version native quand elle
 * existe, sinon un UUID v4 tiré de `getRandomValues` (ou, à défaut, de
 * `Math.random` — assez bon pour une clé de liste React ou un nom de fichier).
 */
export function uid(): string {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const b = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
