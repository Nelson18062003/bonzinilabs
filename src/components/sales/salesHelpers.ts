// ============================================================
// Espace commercial (« /v ») — petites fonctions sans rendu : dates de
// Douala, relances, refus « fiche pas encore reliée ». Le vocabulaire
// métier (statuts, objectifs, formats) vit dans `@/lib/sales`.
// ============================================================
import { OPEN_STATUSES } from '@/lib/sales';
import type { Prospect } from '@/hooks/useSales';

const TZ = 'Africa/Douala';

/** Le refus d'un commercial dont le compte n'est pas encore relié à sa fiche. */
export function isUnlinkedError(err: unknown): boolean {
  return err instanceof Error && /pas encore reli/i.test(err.message);
}

/** Le jour à Douala, « AAAA-MM-JJ ». */
export function doualaDay(d: Date | string = new Date()): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** « AAAA-MM-JJ » décalé de n jours. */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Une relance se pose à 9 h, heure de Douala (UTC+1, sans heure d'été). */
export function followUpIso(day: string): string {
  return `${day}T09:00:00+01:00`;
}

/** « 12 oct. » (l'année seulement si elle n'est pas l'année en cours). */
export function fmtDay(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const sameYear = doualaDay(d).slice(0, 4) === doualaDay(now).slice(0, 4);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }), timeZone: TZ });
}

/** « 12 octobre 2026 ». */
export function fmtLongDay(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ });
}

/** La relance dite simplement : « Aujourd'hui », « Demain », « Hier », sinon la date. */
export function followUpLabel(iso: string, now = new Date()): string {
  const day = doualaDay(iso);
  const today = doualaDay(now);
  if (day === today) return 'Aujourd’hui';
  if (day === addDays(today, 1)) return 'Demain';
  if (day === addDays(today, -1)) return 'Hier';
  return fmtDay(iso, now);
}

export function isOpenProspect(p: Pick<Prospect, 'status'>): boolean {
  return OPEN_STATUSES.includes(p.status);
}

/** Ouvert et relance échue (prévue jusqu'à maintenant) : même règle que `prospects_due` côté serveur. */
export function isDue(p: Pick<Prospect, 'status' | 'next_action_at'>, now = new Date()): boolean {
  return isOpenProspect(p) && !!p.next_action_at && new Date(p.next_action_at).getTime() <= now.getTime();
}

export function prospectName(p: Pick<Prospect, 'first_name' | 'last_name'>): string {
  return [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
}

export function initialsOf(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  return letters || '?';
}

/** « 1 colis », « 3 paiements » — en français, 0 et 1 sont au singulier. */
export function plural(n: number, one: string, many: string): string {
  return `${Number(n || 0).toLocaleString('fr-FR')} ${Math.abs(n) <= 1 ? one : many}`;
}
