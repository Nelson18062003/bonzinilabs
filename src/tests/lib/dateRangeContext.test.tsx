/**
 * Le contexte de plage doit livrer une granularité COMPATIBLE avec la plage.
 *
 * RÉGRESSION RÉELLE, signalée : « après une plage personnalisée, les axes du
 * tableau de bord sont bizarres ». Cause : `setPreset` et `setCustom`
 * conservaient la granularité précédente. « Aujourd'hui » (par heure) puis une
 * plage de six mois donnait donc ~4 400 seaux horaires ; « 30 derniers jours »
 * (par jour) puis « Cette année » en donnait 365. L'axe X devenait un mur.
 *
 * Le mobile s'en protégeait avec `coerceGranularity` à la consommation ; le
 * desktop ne le faisait pas. Corriger à la consommation, c'est garantir qu'un
 * prochain consommateur l'oubliera — la garantie doit venir de la SOURCE.
 *
 * Ces tests montent le vrai fournisseur et exercent ses transitions.
 */
import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { DateRangeProvider, useDateRange } from '@/lib/analytics/DateRangeContext';
import { bucketStarts, granularityIsCompatible } from '@/lib/analytics/dateRange';

function mount(defaultPreset: Parameters<typeof DateRangeProvider>[0]['defaultPreset'] = 'last_30_days') {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <DateRangeProvider defaultPreset={defaultPreset}>{children}</DateRangeProvider>
  );
  return renderHook(() => useDateRange(), { wrapper });
}

describe('La granularité suit la plage', () => {
  it("« Aujourd'hui » puis une plage personnalisée de six mois ne garde pas « par heure »", () => {
    const { result } = mount('today');
    expect(result.current.range.granularity).toBe('hour');

    act(() => result.current.setCustom(new Date(2026, 2, 1), new Date(2026, 7, 31)));

    const { range } = result.current;
    expect(range.preset).toBe('custom');
    expect(granularityIsCompatible(range.granularity, range)).toBe(true);
    expect(range.granularity).not.toBe('hour');
    // Le vrai symptôme : le nombre de seaux que le graphique aurait dû tracer.
    expect(bucketStarts(range).length).toBeLessThanOrEqual(60);
  });

  it('« 30 derniers jours » puis « Cette année » ne garde pas « par jour »', () => {
    const { result } = mount('last_30_days');
    expect(result.current.range.granularity).toBe('day');

    act(() => result.current.setPreset('this_year'));

    const { range } = result.current;
    expect(granularityIsCompatible(range.granularity, range)).toBe(true);
    expect(bucketStarts(range).length).toBeLessThanOrEqual(60);
  });

  it('« Cette année » puis « Aujourd\'hui » ne garde pas « par mois »', () => {
    // Le sens inverse : une granularité trop GROSSE donne un seul seau vide.
    const { result } = mount('this_year');
    act(() => result.current.setPreset('today'));

    const { range } = result.current;
    expect(granularityIsCompatible(range.granularity, range)).toBe(true);
    expect(bucketStarts(range).length).toBeGreaterThan(1);
  });

  it('un choix explicite compatible est respecté quand la plage change', () => {
    // L'utilisateur a demandé « par semaine » sur 30 jours (compatible) ; il
    // passe à 90 jours, où « par semaine » reste compatible : on ne lui
    // retire pas son choix.
    const { result } = mount('last_30_days');
    act(() => result.current.setGranularity('week'));
    act(() => result.current.setPreset('last_90_days'));
    expect(result.current.range.granularity).toBe('week');
  });

  it("setGranularity refuse silencieusement une granularité incompatible", () => {
    // Le sélecteur désactive déjà ces boutons ; la garde est côté source, pour
    // un état hydraté depuis l'URL ou un appel programmatique.
    const { result } = mount('today');
    act(() => result.current.setGranularity('year'));
    expect(granularityIsCompatible(result.current.range.granularity, result.current.range)).toBe(true);
  });
});
