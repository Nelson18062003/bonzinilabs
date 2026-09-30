/**
 * Les prélèvements d'une DAU regroupés comme le client les lit : le droit de
 * douane, les accises, la TVA (et ses centimes), le reste. Chaque groupe porte
 * une couleur du logo — violet, orange, or — pour la barre de répartition.
 */
import type { Simulation } from '@/lib/customs/engine';

export const DAU_GROUPS = [
  { key: 'duty', codes: ['DDI'], color: 'bg-dz-violet' },
  { key: 'excise', codes: ['DAC'], color: 'bg-dz-orange' },
  { key: 'vat', codes: ['TVA', 'CAC'], color: 'bg-dz-gold' },
  { key: 'other', codes: [] as string[], color: 'bg-dz-ink3/40' },
] as const;

export type DauGroupKey = (typeof DAU_GROUPS)[number]['key'];

/** Le montant de chaque groupe, sans les groupes vides. */
export function dauGroups(sim: Simulation) {
  const known = DAU_GROUPS.flatMap((g) => g.codes as readonly string[]);
  return DAU_GROUPS.map((g) => ({
    ...g,
    amount: sim.dau.lines
      .filter((l) => (g.key === 'other' ? !known.includes(l.code) : (g.codes as readonly string[]).includes(l.code)))
      .reduce((n, l) => n + l.amount, 0),
  })).filter((g) => g.amount > 0);
}
