/**
 * Prospects (refonte v2) — ce que la direction et l'app commercial
 * partagent : le tag d'une ligne (relance due ou statut), les filtres de
 * l'entonnoir, le rythme d'un objectif.
 */
import type { Prospect } from '@/hooks/useSales';
import { PROSPECT_STATUS, OPEN_STATUSES } from '@/lib/sales';
import type { Tone } from '@/mobile/designKit';
import type { PaceStatus } from '@/components/sales/HomeData';

const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** La relance d'un prospect ouvert : « Aujourd'hui », « Hier », « Il y a 3 j » (dues), « 24 oct. » (à venir). */
export function followUp(p: Pick<Prospect, 'next_action_at' | 'status'>, now = new Date()): { tone: Tone; label: string; due: boolean } | null {
  if (!p.next_action_at || !OPEN_STATUSES.includes(p.status)) return null;
  const days = Math.round((startOfDay(new Date(p.next_action_at)) - startOfDay(now)) / DAY);
  if (days === 0) return { tone: 'pending', label: 'Aujourd’hui', due: true };
  if (days === -1) return { tone: 'danger', label: 'Hier', due: true };
  if (days < 0) return { tone: 'danger', label: `Il y a ${-days} j`, due: true };
  return { tone: 'neutral', label: new Date(p.next_action_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }), due: false };
}

/** Le tag d'une ligne de prospect : la relance due d'abord, sinon son statut. */
export function prospectTag(p: Prospect): { tone: Tone; label: string } {
  const f = followUp(p);
  if (f?.due) return { tone: f.tone, label: 'À relancer' };
  const s = PROSPECT_STATUS[p.status];
  return { tone: s.tone === 'info' ? 'neutral' : s.tone, label: s.label };
}

export const prospectName = (p: Pick<Prospect, 'first_name' | 'last_name'>) => [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || '—';
export const prospectLine = (p: Pick<Prospect, 'company' | 'city'>) => [p.company, p.city].filter(Boolean).join(' · ');

export const PACE_TAG: Record<PaceStatus, { tone: Tone; label: string }> = {
  reached: { tone: 'success', label: 'Atteint' },
  ahead: { tone: 'success', label: 'Dans le rythme' },
  behind: { tone: 'pending', label: 'Sous le rythme' },
  missed: { tone: 'danger', label: 'Non atteint' },
};
