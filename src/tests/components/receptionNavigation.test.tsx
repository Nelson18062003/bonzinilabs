/**
 * GUANGZHOU — la navigation de l'app réception (/r), repensée le 12/10.
 *
 * Ce que le réceptionnaire ne doit plus vivre :
 *  · remplir cinq étapes sur le dépôt d'un collègue pour finir sur un refus
 *    → le dépôt d'un collègue s'ouvre en lecture, avec qui le saisit ;
 *  · un dépôt terminé qui ne s'ouvre que sur « Dépôt terminé », sans colis
 *    → la fiche du dépôt montre ses colis, les corrige, réimprime les étiquettes ;
 *  · un dépôt ouvert par erreur sans issue → « Abandonner ce dépôt vide » ;
 *  · un « Continuer » grisé parce que le lieu n'a jamais été choisi
 *    → « Où êtes-vous ? » avant l'accueil et avant un nouveau dépôt ;
 *  · une flèche qui empile l'écran parent (boucles) → la flèche revient là
 *    d'où l'on vient, ou remplace par le parent quand il n'y a pas d'historique.
 * Les hooks de données sont simulés : le sujet est l'écran.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { LanguageProvider } from '@/contexts/LanguageContext';
import type { Deposit, Parcel } from '@/lib/reception';

const m = vi.hoisted(() => ({
  deposit: null as unknown,
  me: 'kevin',
  cargo: false,
  cancel: vi.fn(),
  close: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('@/contexts/AdminAuthContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/contexts/AdminAuthContext')>()),
  useAdminAuth: () => ({ currentUser: { id: m.me }, hasPermission: (k: string) => (k === 'canManageCargo' ? m.cargo : true), isAuthenticated: true, isLoading: false }),
}));

vi.mock('@/hooks/useReception', () => ({
  useReceptionDeposit: () => ({ data: m.deposit, isLoading: false, error: null, refetch: vi.fn() }),
  useCancelDeposit: () => ({ mutate: m.cancel, isPending: false }),
  useCloseDeposit: () => ({ mutateAsync: m.close, isPending: false }),
  useRemoveParcel: () => ({ mutate: m.remove, isPending: false }),
  useParcelPhotoUrl: () => ({ data: null }),
}));

vi.mock('@/hooks/useShippingSettings', () => ({ useAdminShippingSettings: () => ({ data: undefined }) }));
// Les étiquettes peignent des canvas : hors sujet ici, on ne garde que leur ouverture.
vi.mock('@/mobile/components/reception/InternalLabelSheet', () => ({
  InternalLabelSheet: ({ open }: { open: boolean }) => (open ? <div role="dialog" aria-label="labels">étiquettes des colis</div> : null),
}));

import { ReceptionDeposit } from '@/mobile/screens/reception/ReceptionDeposit';
import { ReceptionDone } from '@/mobile/screens/reception/ReceptionDone';
import { ReceptionShell } from '@/mobile/components/reception/ReceptionRouteWrapper';
import { canGoBack } from '@/mobile/components/reception/useReceptionBack';

const client = { user_id: 'u1', customer_code: 'BZ-482913', first_name: 'Aïcha', last_name: 'Mbarga', phone: null, email: null, company_name: null, city: null, country: null };
const parcel = (o: Partial<Parcel> = {}): Parcel => ({
  id: 'p1', seq: 1, parcel_no: 'RC-000123-01', kind: 'carton', weight_kg: 8, length_cm: null, width_cm: null, height_cm: null, cbm: null,
  description: 'Chaussures', courier_waybill: null, photo_path: null, status: 'received', created_at: 'x', ...o,
});
const deposit = (o: Partial<Deposit> = {}): Deposit => ({
  id: 'd1', deposit_no: 'RC-000123', client: client as Deposit['client'], location: 'office', brought_by: 'client', representative_name: null, representative_phone: null,
  status: 'open', received_by: 'kevin', received_by_name: 'Kevin Nkolo', opened_at: '2026-10-12T08:00:00Z', closed_at: null, parcel_count: 1,
  total_weight_kg: 8, total_cbm: 0, notes: null, parcels: [parcel()], ...o,
} as Deposit);

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{loc.pathname}{loc.search}</div>;
}

function mount(path: string, element: React.ReactNode, routePath: string) {
  return render(
    <LanguageProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={routePath} element={<>{element}<Where /></>} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  );
}

beforeEach(() => {
  for (const fn of [m.cancel, m.close, m.remove]) fn.mockReset();
  m.me = 'kevin';
  m.cargo = false;
  m.deposit = deposit();
  localStorage.removeItem('bonzini-reception-location');
});

describe('la fiche du dépôt', () => {
  it('mon dépôt en cours : la saisie (ajouter, terminer)', () => {
    mount('/r/deposit/d1', <ReceptionDeposit />, '/r/deposit/:depositId');
    expect(screen.getByRole('button', { name: /Ajouter un colis/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Terminer/ })).toBeInTheDocument();
  });

  it('le dépôt en cours d’un collègue : en lecture, avec qui le saisit — pas de saisie qui finirait refusée', () => {
    m.deposit = deposit({ received_by: 'li', received_by_name: 'Li Wei' });
    mount('/r/deposit/d1', <ReceptionDeposit />, '/r/deposit/:depositId');
    expect(screen.getByText(/En cours de saisie par Li Wei/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ajouter un colis/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Terminer/ })).toBeNull();
    // Toucher un colis ouvre ses photos, pas le formulaire.
    fireEvent.click(screen.getByText('Chaussures'));
    expect(screen.getByTestId('where').textContent).toBe('/r/deposit/d1');
  });

  it('l’équipe cargo garde la main sur le dépôt d’un collègue', () => {
    m.deposit = deposit({ received_by: 'li', received_by_name: 'Li Wei' });
    m.cargo = true;
    mount('/r/deposit/d1', <ReceptionDeposit />, '/r/deposit/:depositId');
    expect(screen.getByRole('button', { name: /Ajouter un colis/ })).toBeInTheDocument();
  });

  it('un dépôt terminé s’ouvre sur sa fiche : corriger un colis, réimprimer les étiquettes sur place', () => {
    m.deposit = deposit({ status: 'closed', closed_at: '2026-10-12T09:00:00Z' });
    const { unmount } = mount('/r/deposit/d1', <ReceptionDeposit />, '/r/deposit/:depositId');
    fireEvent.click(screen.getByRole('button', { name: /Imprimer les étiquettes/ }));
    expect(screen.getByRole('dialog', { name: 'labels' })).toBeInTheDocument();
    expect(screen.getByTestId('where').textContent).toBe('/r/deposit/d1');
    unmount();

    mount('/r/deposit/d1', <ReceptionDeposit />, '/r/deposit/:depositId');
    fireEvent.click(screen.getByText('Chaussures'));
    expect(screen.getByTestId('where').textContent).toBe('/r/deposit/d1/parcel/p1');
  });

  it('un colis déjà dans un paquet ne s’ouvre pas en correction (il est verrouillé)', () => {
    m.deposit = deposit({ status: 'closed', parcels: [parcel({ air_package_id: 'k1', package_no: 'PQ-000045' })] });
    mount('/r/deposit/d1', <ReceptionDeposit />, '/r/deposit/:depositId');
    fireEvent.click(screen.getByText('Chaussures'));
    expect(screen.getByTestId('where').textContent).toBe('/r/deposit/d1');
  });

  it('un dépôt ouvert par erreur, encore vide, s’abandonne (après confirmation)', () => {
    m.deposit = deposit({ parcels: [], parcel_count: 0 });
    mount('/r/deposit/d1', <ReceptionDeposit />, '/r/deposit/:depositId');
    fireEvent.click(screen.getByRole('button', { name: /Abandonner ce dépôt vide/ }));
    const sheet = screen.getAllByRole('dialog').at(-1)!;
    fireEvent.click(within(sheet).getByRole('button', { name: /Abandonner ce dépôt vide/ }));
    expect(m.cancel).toHaveBeenCalledWith({ depositId: 'd1', reason: expect.stringContaining('erreur') }, expect.anything());
  });

  it('retirer un colis demande confirmation', () => {
    mount('/r/deposit/d1', <ReceptionDeposit />, '/r/deposit/:depositId');
    fireEvent.click(screen.getByRole('button', { name: /Supprimer|Retirer/ }));
    expect(m.remove).not.toHaveBeenCalled();
    const sheet = screen.getAllByRole('dialog').at(-1)!;
    fireEvent.click(within(sheet).getByRole('button', { name: /Retirer/ }));
    expect(m.remove).toHaveBeenCalledWith('p1', expect.anything());
  });

  it('sans historique, la flèche REMPLACE par Aujourd’hui (pas de boucle)', () => {
    expect(canGoBack()).toBe(false);
    mount('/r/deposit/d1', <ReceptionDeposit />, '/r/deposit/:depositId');
    fireEvent.click(screen.getByRole('button', { name: 'Retour' }));
    expect(screen.getByTestId('where').textContent).toBe('/r');
  });
});

describe('dépôt terminé', () => {
  it('sans client : le dire, et « Attribuer maintenant »', () => {
    m.deposit = deposit({ status: 'closed', client: null });
    mount('/r/deposit/d1/done', <ReceptionDone />, '/r/deposit/:depositId/done');
    expect(screen.getByText(/Ce dépôt attend son client/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Attribuer maintenant/ }));
    expect(screen.getByTestId('where').textContent).toBe('/r/new?assign=d1');
  });

  it('ni « Mettre en paquet », ni « Étiquette du client » à la fin d’un dépôt', () => {
    m.deposit = deposit({ status: 'closed' });
    mount('/r/deposit/d1/done', <ReceptionDone />, '/r/deposit/:depositId/done');
    expect(screen.getByRole('button', { name: /Imprimer les étiquettes/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mettre en paquet/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Étiquette du client/ })).toBeNull();
  });
});

describe('le lieu, avant tout', () => {
  it('sans lieu mémorisé, l’accueil et un nouveau dépôt commencent par « Où êtes-vous ? »', () => {
    for (const path of ['/r', '/r/new', '/r/new/how']) {
      const { unmount } = mount(path, <ReceptionShell showTabBar={false}><p>écran demandé</p></ReceptionShell>, '*');
      expect(screen.getByRole('heading', { name: 'Où êtes-vous ?' })).toBeInTheDocument();
      expect(screen.queryByText('écran demandé')).toBeNull();
      unmount();
    }
  });

  it('le lieu choisi, l’écran demandé s’affiche — et les autres écrans ne sont jamais bloqués', () => {
    mount('/r/new', <ReceptionShell showTabBar={false}><p>écran demandé</p></ReceptionShell>, '*');
    fireEvent.click(screen.getByRole('button', { name: /Bureau/ }));
    expect(screen.getByText('écran demandé')).toBeInTheDocument();
    expect(localStorage.getItem('bonzini-reception-location')).toBe('office');
  });

  it('les paquets ou une fiche client s’ouvrent sans poser la question', () => {
    mount('/r/paquets', <ReceptionShell showTabBar={false}><p>paquets</p></ReceptionShell>, '*');
    expect(screen.getByText('paquets')).toBeInTheDocument();
  });
});
