/**
 * Design kit mobile — les fonctions de la couche v2 (wave.tsx), à part pour
 * que wave.tsx n'exporte que des composants.
 */
import * as React from 'react';

/* ── Saisie au clavier ────────────────────────────────────────────────────
 * La saisie d'un montant façon Wave : `applyKey` tient la règle (entier, ou
 * décimales bornées), `formatPad` l'affiche, `padValue` la lit. */
export type PadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | ',' | 'back';

/** Applique une touche à une saisie texte (« 7493 », « 0,25 »). `decimals` = 0 → pas de virgule. */
export function applyKey(current: string, key: PadKey, decimals = 0, maxDigits = 12): string {
  if (key === 'back') return current.slice(0, -1);
  if (key === ',') {
    if (decimals === 0 || current.includes(',')) return current;
    return (current || '0') + ',';
  }
  const [int, dec] = current.split(',');
  if (dec != null) {
    if (dec.length >= decimals) return current;
    return current + key;
  }
  if (int === '0') return key;
  if (int.length >= maxDigits) return current;
  return current + key;
}

/** La saisie texte en nombre (« 1 234,5 » → 1234.5). */
export function padValue(s: string): number {
  if (!s) return 0;
  const n = Number(s.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** La saisie avec ses espaces de milliers, telle qu'on l'affiche. */
export function formatPad(s: string): string {
  if (!s) return '0';
  const [int, dec] = s.split(',');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
  return dec != null ? `${grouped},${dec}` : grouped;
}


/** L'état d'ouverture d'un menu « … » : `const more = useSheet(); <MoreButton onClick={more.show} />`. */
export function useSheet(initial = false) {
  const [open, setOpen] = React.useState(initial);
  return React.useMemo(() => ({ open, show: () => setOpen(true), hide: () => setOpen(false), set: setOpen }), [open]);
}

