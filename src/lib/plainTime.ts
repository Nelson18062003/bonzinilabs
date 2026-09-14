/**
 * Le temps en français de tous les jours — « il y a 3 heures », « hier »,
 * « le 6 septembre ». Pour les listes que lit quelqu'un qui n'a pas envie
 * de convertir « 06/09/2026 » en tête.
 */
import { differenceInCalendarDays, differenceInHours, differenceInMinutes, format } from 'date-fns';
import { fr } from 'date-fns/locale';

const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;

/** « depuis 11 heures », « depuis 4 jours » — l'âge réel d'un dossier, pas un seuil. */
export function sinceSentence(iso: string | Date, now = new Date()): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '';
  const min = differenceInMinutes(now, d);
  if (min < 60) return `depuis ${plural(Math.max(1, min), 'minute')}`;
  const h = differenceInHours(now, d);
  if (h < 48) return `depuis ${plural(h, 'heure')}`;
  return `depuis ${plural(differenceInCalendarDays(now, d), 'jour')}`;
}

export function whenSentence(iso: string | Date, now = new Date()): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '';
  const min = differenceInMinutes(now, d);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${plural(min, 'minute')}`;
  const h = differenceInHours(now, d);
  if (h < 24) return `il y a ${plural(h, 'heure')}`;
  const days = differenceInCalendarDays(now, d);
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${plural(days, 'jour')}`;
  return `le ${format(d, d.getFullYear() === now.getFullYear() ? 'd MMMM' : 'd MMMM yyyy', { locale: fr })}`;
}
