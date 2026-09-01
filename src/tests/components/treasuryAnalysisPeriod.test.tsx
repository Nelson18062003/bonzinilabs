/**
 * L'analyse Trésorerie doit offrir le MÊME choix de période que le tableau de
 * bord : presets calendaires (aujourd'hui, cette semaine, ce mois…) ET plage
 * personnalisée.
 *
 * RÉGRESSION RÉELLE, signalée : « dans la Trésorerie, je ne peux plus mettre
 * une plage personnalisée, il n'y a plus aujourd'hui, cette semaine, ce
 * mois ». L'écran mobile d'origine (`MobileTreasuryDashboard`) offrait
 * jour / semaine / mois / trimestre / année / tout / personnalisé avec un
 * calendrier. La reconstruction desktop n'avait gardé que 7j / 30j / 3 mois /
 * 1 an — quatre durées glissantes, aucun calendrier.
 *
 * Deux modules, deux sélecteurs de période, deux calculs de bornes : c'est
 * ainsi que l'un a pu régresser sans que l'autre ne le voie. Ce test fixe le
 * contrat : la Trésorerie utilise le sélecteur PARTAGÉ.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Les hooks de trésorerie tapent Supabase ; les fixtures du harnais de capture
// suffisent, le sujet est le sélecteur, pas les chiffres.
vi.mock('@/hooks/useTreasury', () => import('@/__screenshot__/mockTreasury'));

// lightweight-charts dessine sur un <canvas> ; jsdom n'en a pas et lève
// « Value is null » en asynchrone. Le graphique n'est pas le sujet.
vi.mock('@/desktop/screens/treasury/TreasuryRateChart', () => ({
  TreasuryRateChart: () => null,
}));

import { TreasuryAnalysisView } from '@/desktop/screens/treasury/TreasuryAnalysisView';

function mountLikeApp(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("L'analyse Trésorerie et sa période", () => {
  const originalError = console.error;
  beforeAll(() => {
    console.error = () => undefined;
  });
  afterAll(() => {
    console.error = originalError;
  });

  it('se monte seule, avec son propre contexte de plage', () => {
    expect(() => mountLikeApp(<TreasuryAnalysisView />)).not.toThrow();
  });

  it('expose les presets calendaires ET la plage personnalisée', async () => {
    mountLikeApp(<TreasuryAnalysisView />);

    // Le déclencheur du sélecteur partagé porte le libellé du preset courant —
    // « Ce mois », ce que l'ancien écran desktop ouvrait par défaut.
    const trigger = await screen.findByRole('button', { name: /Ce mois/i });
    fireEvent.click(trigger);

    // Une fois ouvert, « Ce mois » existe deux fois (déclencheur + preset) :
    // on cherche DANS le popover.
    const popover = await screen.findByRole('dialog');
    const inside = within(popover);

    // Ce que l'utilisateur réclamait, nommément.
    expect(inside.getByRole('button', { name: "Aujourd'hui" })).toBeTruthy();
    expect(inside.getByRole('button', { name: 'Cette semaine' })).toBeTruthy();
    expect(inside.getByRole('button', { name: 'Ce mois' })).toBeTruthy();
    expect(inside.getByRole('button', { name: 'Cette année' })).toBeTruthy();
    expect(inside.getByRole('button', { name: 'Tout' })).toBeTruthy();
    expect(inside.getByText(/personnalisé/i)).toBeTruthy();
  });

  it("n'expose PAS les réglages propres au tableau de bord", async () => {
    // Granularité et comparaison n'ont pas de sens ici : les graphiques de
    // trésorerie sont des séries d'événements, pas des seaux, et les quatre
    // chiffres de tête n'ont pas de « période précédente » calculée.
    mountLikeApp(<TreasuryAnalysisView />);
    const trigger = await screen.findByRole('button', { name: /Ce mois/i });
    fireEvent.click(trigger);
    const inside = within(await screen.findByRole('dialog'));
    inside.getByRole('button', { name: "Aujourd'hui" });
    expect(inside.queryByText(/granularité/i)).toBeNull();
    expect(inside.queryByText(/comparer à la période précédente/i)).toBeNull();
  });
});
