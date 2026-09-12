/**
 * Palette de la carte Cargo.
 *
 * Pourquoi la carte était grise : le fond `positron` peint l'océan en
 * rgb(194,200,202) et le fond sombre en rgb(27,27,29). Sur une carte maritime,
 * la mer occupe presque tout l'écran — donc tout paraissait éteint. On repeint
 * donc l'eau, et on rend la couleur à ce qu'elle doit signifier.
 *
 * Règle : le fond de carte reste sobre (c'est le support), la couleur appartient
 * aux DONNÉES. Trois teintes seulement, chacune avec un travail :
 *   · la route du navire      → une teinte d'identité (violet)
 *   · l'état d'un conteneur   → la palette de statut, réservée (vert/jaune/rouge)
 *   · un conteneur livré      → pas de teinte du tout : il ne doit plus crier
 *
 * Valeurs vérifiées avec `scripts/validate_palette.js` du référentiel dataviz,
 * contre les deux surfaces réelles de la carte (#dbe8f2 clair, #0f1a26 sombre) :
 *   séparation daltonisme  ΔE 11.3  (seuil 8)   ✓ clair et sombre
 *   séparation vision normale ΔE 27.6 (seuil 15) ✓ clair et sombre
 *   contraste sur le fond   ≥ 3:1               ✓ sombre
 * En clair, le vert et le jaune passent sous 3:1 sur l'eau : c'est la limite
 * connue de la palette de statut. La compensation est imposée et appliquée —
 * anneau blanc de 2 px autour de chaque marqueur, étiquette visible, et la
 * liste latérale qui redit l'état en toutes lettres. La couleur ne porte donc
 * jamais l'information toute seule.
 *
 * Quatre niveaux d'alerte avaient été essayés ; jaune contre orange échouait en
 * clair (ΔE 13.6) et orange contre rouge en sombre (ΔE 7.2). Trois niveaux
 * passent partout — et trois suffisent à un opérateur.
 */
import { differenceInCalendarDays } from 'date-fns';
import { bestEta, etaSlipDays } from '@/lib/cargo/model';
import type { CargoDocument, CargoShipment } from '@/lib/cargo/model';
import { todoCounts } from '@/lib/cargo/todo';

/** L'état d'un conteneur, tel qu'il se lit sur la carte. */
export type AlertLevel = 'late' | 'watch' | 'ok' | 'done';

export interface AlertMeta {
  /** Ce qu'on écrit à côté du point — la couleur ne suffit jamais. */
  label: string;
  /** La forme dessinée dans le marqueur, pour qui ne distingue pas les teintes. */
  glyph: '!' | '·' | '✓' | '✓';
  hex: string;
  /** Ordre de gravité : sert à prendre le pire état d'un navire qui porte plusieurs boîtes. */
  rank: number;
}

/** Palette de statut du référentiel : fixe, jamais thémée, jamais réutilisée pour autre chose. */
export const ALERT: Record<AlertLevel, AlertMeta> = {
  late: { label: 'En retard', glyph: '!', hex: '#d03b3b', rank: 3 },
  watch: { label: 'À surveiller', glyph: '·', hex: '#fab219', rank: 2 },
  ok: { label: 'À l’heure', glyph: '✓', hex: '#0ca30c', rank: 1 },
  done: { label: 'Livré', glyph: '✓', hex: '#8a8a8a', rank: 0 },
};

export const ALERT_ORDER: AlertLevel[] = ['late', 'watch', 'ok', 'done'];

/** Les couleurs du décor, par mode. La mer est repeinte ; le reste vient du fond. */
export const MAP_INK = {
  light: {
    water: '#dbe8f2',
    route: '#4a3aa7',
    routeFaint: '#a9a1d8',
    port: '#171717',
    portRing: '#ffffff',
    ring: '#ffffff',
  },
  dark: {
    water: '#0f1a26',
    route: '#9085e9',
    routeFaint: '#5b53a8',
    port: '#e2e2e2',
    portRing: '#0d0d0d',
    ring: '#0d0d0d',
  },
} as const;

export const mapInk = (dark: boolean) => (dark ? MAP_INK.dark : MAP_INK.light);

/**
 * L'état d'un conteneur. Trois signaux seulement, dans cet ordre :
 * la franchise dépassée, le report annoncé par l'armateur, ce qui reste à faire
 * alors que l'arrivée approche.
 */
export function alertLevel(s: CargoShipment, docs?: CargoDocument[], now = new Date()): AlertLevel {
  if (s.status === 'DELIVERED') return 'done';

  const slip = etaSlipDays(s);
  const eta = bestEta(s).date;
  const days = eta ? differenceInCalendarDays(eta, now) : null;

  // Franchise dépassée et boîte encore au port : les surestaries courent déjà.
  if (s.free_time_ends_on && !s.gate_out_at) {
    const left = differenceInCalendarDays(new Date(s.free_time_ends_on), now);
    if (left < 0) return 'late';
    if (left <= 3) return 'watch';
  }

  if (slip >= 7) return 'late';

  // Arrivée dans moins de trois jours sans télex : la boîte ne sortira pas.
  if (days != null && days <= 3 && !s.telex_released && s.status !== 'UNKNOWN') return 'late';

  if (slip >= 1) return 'watch';
  if (todoCounts(s, docs).now > 0) return 'watch';
  return 'ok';
}

/** L'état d'un navire = le pire état des conteneurs qu'il porte. */
export function worstAlert(shipments: CargoShipment[], docs?: CargoDocument[]): AlertLevel {
  let worst: AlertLevel = 'done';
  for (const s of shipments) {
    const a = alertLevel(s, docs);
    if (ALERT[a].rank > ALERT[worst].rank) worst = a;
  }
  return worst;
}

/** Combien de conteneurs dans chaque état — alimente la légende. */
export function alertTally(shipments: CargoShipment[], docs?: CargoDocument[]): Record<AlertLevel, number> {
  const tally: Record<AlertLevel, number> = { late: 0, watch: 0, ok: 0, done: 0 };
  for (const s of shipments) tally[alertLevel(s, docs)] += 1;
  return tally;
}
