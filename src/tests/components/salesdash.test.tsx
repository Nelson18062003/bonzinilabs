/**
 * Tableau de bord des ventes (08/10) — le rendu des briques de
 * src/components/salesdash/ avec les données du générateur des captures
 * (tools/journey/salesSeriesFixture.mjs : trois fiches dont une archivée,
 * mois vides, période en cours) : jamais « NaN », les zéros, l'archivée,
 * une seule fiche, la légende qui masque sans repeindre, la vue tableau,
 * les états vide et erreur.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { SalesSeries } from '@/hooks/useSales';
import { emptyTotals, pickSource } from '@/lib/salesSeries';
import { CargoChart, ErrorState, EvolutionChart, KpiTile, Leaderboard, MetricSwitcher, PeriodPicker, ProspectFunnel } from '@/components/salesdash';
// @ts-expect-error -- module JavaScript des captures (tools/), sans déclaration de types
import { emptySalesSeries, presetBody, salesSeriesResponse } from '../../../tools/journey/salesSeriesFixture.mjs';

const NOW = new Date('2026-10-09T10:00:00Z');
type Fx = (body: unknown) => SalesSeries & { success: boolean };
const series = (preset: '3m' | '6m' | '12m' | '12w', sourceId?: string): SalesSeries => (salesSeriesResponse as Fx)((presetBody as (p: string, o?: unknown) => unknown)(preset, { sourceId }));
const empty = (): SalesSeries => (emptySalesSeries as Fx)((presetBody as (p: string) => unknown)('3m'));

beforeAll(() => {
  // Mouvement réduit : recharts dessine tout de suite (pas d'animation dans jsdom).
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((q: string) => ({
      matches: q.includes('reduce'),
      media: q,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

const noNaN = (el: HTMLElement) => {
  expect(el.textContent ?? '').not.toMatch(/NaN|undefined|Infinity/);
  for (const n of el.querySelectorAll('path, circle, rect, line, text')) {
    for (const a of ['d', 'cx', 'cy', 'x', 'y', 'width', 'height']) expect(n.getAttribute(a) ?? '').not.toMatch(/NaN/);
  }
};

describe('Le générateur des captures respecte le contrat', () => {
  it('déterministe, une période par point, les totaux sont les sommes des points', () => {
    const a = series('12m');
    expect(JSON.stringify(series('12m'))).toBe(JSON.stringify(a));
    expect(a.periods).toHaveLength(12);
    expect(a.sources.map((s) => s.label).sort()).toEqual(['Carine Ewane', 'Hervé Nkoulou', 'Rodrigue Tchami']);
    expect(a.sources.find((s) => s.source_id === 'src-herve')?.is_active).toBe(false);
    for (const s of a.sources) {
      expect(s.points.map((p) => p.period)).toEqual(a.periods);
      const pay = s.points.reduce((x, p) => x + p.payments_xaf, 0);
      expect(s.totals.payments_xaf).toBe(pay);
      expect(s.totals.flights).toBe(s.points.reduce((x, p) => x + p.flights, 0));
      expect(s.funnel.total).toBe(s.funnel.new + s.funnel.contacted + s.funnel.interested + s.funnel.to_verify + s.funnel.won + s.funnel.lost);
    }
    // Des mois vides (avant l'arrivée de Carine, après le départ d'Hervé) et des montants crédibles.
    const herve = a.sources.find((s) => s.source_id === 'src-herve')!;
    expect(herve.points[herve.points.length - 1].payments_xaf).toBe(0);
    const monthly = a.team.points.map((p) => p.payments_xaf);
    expect(Math.max(...monthly)).toBeLessThan(80_000_000);
    expect(Math.max(...monthly)).toBeGreaterThan(20_000_000);
  });

  it('12 semaines, une fiche, une fiche inconnue, la fiche vide', () => {
    expect(series('12w').periods).toHaveLength(12);
    expect(series('3m', 'src-carine').sources).toHaveLength(1);
    expect((salesSeriesResponse as Fx)({ ...(presetBody as (p: string) => object)('3m'), p_source_id: 'src-zz' }).success).toBe(false);
    expect(empty().team.totals.payments_xaf).toBe(0);
  });
});

describe('KpiTile', () => {
  it('déduit libellé, valeur, unité, ligne du dessous, tendance et courbe', () => {
    const s = series('3m');
    const { container } = render(<KpiTile metric="payments_xaf" data={s.team} grain={s.grain} now={NOW} compareLabel="par rapport aux 3 mois précédents" />);
    expect(screen.getByText('Paiements')).toBeInTheDocument();
    expect(screen.getByText('XAF')).toBeInTheDocument();
    expect(container.textContent).toMatch(/paiements/);
    expect(container.querySelector('[data-tone]')).not.toBeNull();
    expect(container.querySelector('svg circle')).not.toBeNull();
    noNaN(container);
  });

  it('0 → 0 : un tiret, pas de pourcentage ; 0 → x : « nouveau »', () => {
    const t = emptyTotals();
    const { container, rerender } = render(<KpiTile metric="payments_xaf" data={{ totals: t, previous_totals: t, points: [] }} />);
    expect(container.textContent).toContain('0');
    expect(container.querySelector('[data-tone]')).toBeNull();
    noNaN(container);
    rerender(<KpiTile metric="payments_xaf" data={{ totals: { ...t, payments_xaf: 5_000_000 }, previous_totals: t }} />);
    expect(container.textContent).toContain('nouveau');
  });

  it('cliquable : un bouton pressé', () => {
    const onClick = vi.fn();
    const s = series('3m');
    render(<KpiTile metric="air_kg" data={s.team} onClick={onClick} selected />);
    const b = screen.getByRole('button', { pressed: true });
    fireEvent.click(b);
    expect(onClick).toHaveBeenCalled();
  });
});

describe('EvolutionChart', () => {
  it('par commercial : barres empilées, légende des trois fiches (l’archivée dite), période en cours dite', () => {
    const s = series('12m');
    const { container } = render(<EvolutionChart series={s} metric="payments_xaf" width={640} now={NOW} />);
    expect(container.querySelectorAll('.recharts-bar-rectangle path').length).toBeGreaterThan(10);
    const legend = screen.getByRole('list', { name: 'Commerciaux affichés' });
    expect(within(legend).getAllByRole('button')).toHaveLength(3);
    expect(within(legend).getByText('archivée')).toBeInTheDocument();
    expect(container.textContent).toContain('octobre 2026 n’est pas fini');
    noNaN(container);
  });

  it('la légende masque une fiche sans repeindre les autres, et jamais la dernière', () => {
    const s = series('12m');
    const { container } = render(<EvolutionChart series={s} metric="payments_xaf" width={640} now={NOW} />);
    const fills = () => [...new Set([...container.querySelectorAll('.recharts-bar-rectangle path')].map((p) => p.getAttribute('fill')))].sort();
    expect(fills()).toEqual(['var(--sd-cat-1)', 'var(--sd-cat-2)', 'var(--sd-cat-3)']);
    const carine = screen.getByRole('button', { name: /Carine Ewane/ });
    fireEvent.click(carine);
    expect(carine).toHaveAttribute('aria-pressed', 'false');
    expect(fills()).toEqual(['var(--sd-cat-2)', 'var(--sd-cat-3)']);
    fireEvent.click(screen.getByRole('button', { name: /Hervé Nkoulou/ }));
    const rodrigue = screen.getByRole('button', { name: /Rodrigue Tchami/ });
    fireEvent.click(rodrigue);
    expect(rodrigue).toHaveAttribute('aria-pressed', 'true');
  });

  it('la vue tableau : une ligne par période, la plus récente en tête, le total', () => {
    const s = series('3m');
    render(<EvolutionChart series={s} metric="deposits_xaf" width={640} now={NOW} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tableau' }));
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(1 + 3);
    expect(rows[1].textContent).toContain('oct. 2026');
    expect(rows[1].textContent).toContain('en cours');
    expect(within(table).getByText('Total')).toBeInTheDocument();
  });

  it('une seule fiche : pas de légende ; courbe pour les clients', () => {
    const one = pickSource(series('12w'), 'src-rodrigue')!;
    const { container } = render(<EvolutionChart series={one} metric="clients_total" width={500} now={NOW} />);
    expect(screen.queryByRole('list', { name: 'Commerciaux affichés' })).toBeNull();
    expect(container.querySelector('.recharts-area-curve, .recharts-line-curve')).not.toBeNull();
    noNaN(container);
  });

  it('tout à zéro : « Pas encore d’activité sur cette période »', () => {
    render(<EvolutionChart series={empty()} metric="payments_xaf" width={500} now={NOW} />);
    expect(screen.getByText('Pas encore d’activité sur cette période')).toBeInTheDocument();
  });
});

describe('CargoChart, ProspectFunnel, Leaderboard', () => {
  it('le fret : chiffres de tête, panneaux kilos et vols, sans NaN', () => {
    const { container } = render(<CargoChart series={series('12m')} width={600} now={NOW} showSea />);
    expect(screen.getByText('Kilos envoyés par avion')).toBeInTheDocument();
    expect(screen.getByText('Par vol')).toBeInTheDocument();
    expect(container.querySelectorAll('svg.recharts-surface')).toHaveLength(3);
    noNaN(container);
  });

  it('le fret sans colis : l’état vide', () => {
    render(<CargoChart series={empty()} width={600} now={NOW} />);
    expect(screen.getByText('Aucun colis avion sur cette période')).toBeInTheDocument();
  });

  it('les prospects : taux, étapes ; vide sans prospect', () => {
    const s = series('12m');
    const { container, rerender } = render(<ProspectFunnel funnel={s.team.funnel} />);
    expect(screen.getByText('Taux de conversion')).toBeInTheDocument();
    for (const l of ['En cours', 'À vérifier', 'Devenus clients', 'Perdus']) expect(screen.getByText(l)).toBeInTheDocument();
    noNaN(container);
    rerender(<ProspectFunnel funnel={{ total: 0, new: 0, contacted: 0, interested: 0, to_verify: 0, won: 0, lost: 0 }} />);
    expect(screen.getByText('Aucun prospect ajouté sur cette période')).toBeInTheDocument();
  });

  it('le classement : actives d’abord, l’archivée ensuite, la ligne Équipe ; une ligne s’ouvre', () => {
    const onSelect = vi.fn();
    const { container } = render(<Leaderboard series={series('12m')} onSelect={onSelect} now={NOW} />);
    const table = screen.getByRole('table');
    const names = within(table)
      .getAllByRole('button', { name: /^Ouvrir / })
      .map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual(['Ouvrir Rodrigue Tchami', 'Ouvrir Carine Ewane', 'Ouvrir Hervé Nkoulou']);
    expect(within(table).getByText('fiche archivée')).toBeInTheDocument();
    expect(within(table).getByText('Équipe')).toBeInTheDocument();
    fireEvent.click(within(table).getByRole('button', { name: 'Ouvrir Carine Ewane' }));
    expect(onSelect).toHaveBeenCalledWith('src-carine');
    noNaN(container);
  });

  it('le classement d’une seule fiche sans activité : pas de ligne Équipe, des tirets', () => {
    const { container } = render(<Leaderboard series={empty()} now={NOW} />);
    expect(screen.queryByText('Équipe')).toBeNull();
    expect(container.textContent).toContain('—');
    noNaN(container);
  });
});

describe('Contrôles et états', () => {
  it('PeriodPicker : un segmenté de quatre plages', () => {
    const onChange = vi.fn();
    render(<PeriodPicker value="3m" onChange={onChange} />);
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    fireEvent.click(screen.getByRole('radio', { name: '12 semaines' }));
    expect(onChange).toHaveBeenCalledWith('12w');
  });

  it('MetricSwitcher : onglets, flèches du clavier, valeur sous chaque onglet', () => {
    const onChange = vi.fn();
    const s = series('3m');
    render(<MetricSwitcher value="payments_xaf" onChange={onChange} totals={s.team.totals} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[0].textContent).toMatch(/XAF/);
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('deposits_xaf');
    fireEvent.click(screen.getByRole('tab', { name: /Vols/ }));
    expect(onChange).toHaveBeenLastCalledWith('flights');
  });

  it('ErrorState : le message du serveur et Réessayer', () => {
    const onRetry = vi.fn();
    render(<ErrorState detail="Accès non autorisé" onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Accès non autorisé');
    fireEvent.click(screen.getByRole('button', { name: /Réessayer/ }));
    expect(onRetry).toHaveBeenCalled();
  });
});
