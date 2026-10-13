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
 *    d'où l'on vient, ou remplace par le parent quand il n'y a pas d'historique ;
 *  · un retour qui part après un envoi alors qu'on a déjà quitté l'écran
 *    (double retour) → rien ne part d'un écran quitté ;
 *  · une attribution refusée sous une caméra qui se relance en boucle → la
 *    caméra attend « Scanner encore » ; partie de la fiche, l'attribution y revient ;
 *  · quatre étapes de correction pour finir sur « devis déjà envoyé » → les photos.
 * Les hooks de données sont simulés : le sujet est l'écran.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, act, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { LanguageProvider } from '@/contexts/LanguageContext';
import type { Deposit, Parcel } from '@/lib/reception';

const m = vi.hoisted(() => ({
  deposit: null as unknown,
  depLoading: false,
  depError: null as Error | null,
  me: 'kevin',
  cargo: false,
  cancel: vi.fn(),
  close: vi.fn(),
  remove: vi.fn(),
  assign: vi.fn(),
  byCode: vi.fn(),
  stop: vi.fn(),
  decode: null as ((text: string) => void) | null,
  restartKeys: [] as number[],
}));

vi.mock('@/contexts/AdminAuthContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/contexts/AdminAuthContext')>()),
  useAdminAuth: () => ({ currentUser: { id: m.me }, hasPermission: (k: string) => (k === 'canManageCargo' ? m.cargo : true), isAuthenticated: true, isLoading: false }),
}));

vi.mock('@/hooks/useReception', () => ({
  UnknownCodeError: class UnknownCodeError extends Error {},
  useReceptionDeposit: () => ({ data: m.deposit, isLoading: m.depLoading, error: m.depError, refetch: vi.fn() }),
  useCancelDeposit: () => ({ mutate: m.cancel, isPending: false }),
  useCloseDeposit: () => ({ mutateAsync: m.close, isPending: false }),
  useRemoveParcel: () => ({ mutate: m.remove, isPending: false }),
  useParcelPhotoUrl: () => ({ data: null }),
  useAssignDeposit: () => ({ mutateAsync: m.assign, isPending: false }),
  useClientByCode: () => ({ mutateAsync: m.byCode, isPending: false }),
  useAddParcel: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateParcel: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRemoveParcelPhoto: () => ({ mutate: vi.fn(), isPending: false }),
  uploadParcelPhotos: vi.fn(),
}));

// La caméra : on garde le texte qu'elle rendrait, et chaque relance (restartKey).
vi.mock('@/mobile/components/reception/useQrScanner', () => ({
  useQrScanner: (_id: string, onDecode: (text: string) => void, _enabled?: boolean, opts?: { restartKey?: number }) => {
    m.decode = onDecode;
    const k = opts?.restartKey ?? 0;
    if (m.restartKeys.at(-1) !== k) m.restartKeys.push(k);
    return { starting: false, error: null, stop: m.stop };
  },
}));

vi.mock('@/hooks/useShippingSettings', () => ({ useAdminShippingSettings: () => ({ data: undefined }) }));
// Les étiquettes peignent des canvas : hors sujet ici, on ne garde que leur ouverture.
vi.mock('@/mobile/components/reception/InternalLabelSheet', () => ({
  InternalLabelSheet: ({ open }: { open: boolean }) => (open ? <div role="dialog" aria-label="labels">étiquettes des colis</div> : null),
}));

import { ReceptionDeposit } from '@/mobile/screens/reception/ReceptionDeposit';
import { ReceptionDone } from '@/mobile/screens/reception/ReceptionDone';
import { ReceptionIdentify } from '@/mobile/screens/reception/ReceptionIdentify';
import { ReceptionParcel } from '@/mobile/screens/reception/ReceptionParcel';
import { ReceptionShell } from '@/mobile/components/reception/ReceptionRouteWrapper';
import { canGoBack, useReceptionBack } from '@/mobile/components/reception/useReceptionBack';
import { usePackFix } from '@/mobile/components/reception/packageText';
import { assignPath } from '@/mobile/components/reception/useAssignFlow';

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

/** Où l'on est — et un « retour du téléphone » témoin : il montre ce que l'historique a gardé. */
function Where() {
  const loc = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <div data-testid="where">{loc.pathname}{loc.search}</div>
      <button type="button" onClick={() => navigate(-1)}>geste-retour</button>
    </>
  );
}

function mount(path: string | string[], element: React.ReactNode, routePath: string) {
  const entries = Array.isArray(path) ? path : [path];
  return render(
    <LanguageProvider>
      <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
        <Routes>
          <Route path={routePath} element={<>{element}<Where /></>} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  );
}

beforeEach(() => {
  for (const fn of [m.cancel, m.close, m.remove, m.assign, m.byCode, m.stop]) fn.mockReset();
  m.me = 'kevin';
  m.cargo = false;
  m.deposit = deposit();
  m.depLoading = false;
  m.depError = null;
  m.decode = null;
  m.restartKeys = [];
  localStorage.removeItem('bonzini-reception-location');
});

afterEach(() => {
  window.history.replaceState(null, ''); // canGoBack lit window.history.state.idx
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
    // Remplacée, la fiche n'est plus dans l'historique : le geste retour ne la rouvre pas.
    fireEvent.click(screen.getByRole('button', { name: 'geste-retour' }));
    expect(screen.getByTestId('where').textContent).toBe('/r');
  });

  it('avec un historique, la flèche fait comme le geste retour : là d’où l’on vient', () => {
    window.history.replaceState({ idx: 1 }, '');
    mount(['/r/clients/u1', '/r/deposit/d1'], <ReceptionDeposit />, '/r/deposit/:depositId');
    fireEvent.click(screen.getByRole('button', { name: 'Retour' }));
    expect(screen.getByTestId('where').textContent).toBe('/r/clients/u1');
  });

  it('« Attribuer » part de la fiche et dit qu’on en vient (pour y revenir, pas l’empiler)', () => {
    m.deposit = deposit({ status: 'closed', client: null });
    mount('/r/deposit/d1', <ReceptionDeposit />, '/r/deposit/:depositId');
    fireEvent.click(screen.getByRole('button', { name: /Attribuer à un client/ }));
    expect(screen.getByTestId('where').textContent).toBe('/r/new?assign=d1&from=deposit');
  });

  it('un colis déjà emballé n’a pas de corbeille, même dans mon dépôt en cours (le serveur refuserait)', () => {
    m.deposit = deposit({ parcels: [parcel({ air_package_id: 'k1', package_no: 'PQ-000045' }), parcel({ id: 'p2', seq: 2, parcel_no: 'RC-000123-02', description: 'Sacs' })] });
    mount('/r/deposit/d1', <ReceptionDeposit />, '/r/deposit/:depositId');
    expect(screen.getAllByRole('button', { name: /Retirer/ })).toHaveLength(1);
  });

  it('terminé, devis déjà chez le client : le dire, et ouvrir les photos plutôt que la correction', () => {
    m.deposit = deposit({ status: 'closed', quote_engaged: 'Le devis DV-000012 a déjà été envoyé au client' });
    const { unmount } = mount('/r/deposit/d1', <ReceptionDeposit />, '/r/deposit/:depositId');
    expect(screen.getByText(/déjà chez le client/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Chaussures'));
    expect(screen.getByTestId('where').textContent).toBe('/r/deposit/d1');
    unmount();

    // L'équipe cargo, elle, corrige toujours.
    m.cargo = true;
    mount('/r/deposit/d1', <ReceptionDeposit />, '/r/deposit/:depositId');
    expect(screen.queryByText(/déjà chez le client/)).toBeNull();
    fireEvent.click(screen.getByText('Chaussures'));
    expect(screen.getByTestId('where').textContent).toBe('/r/deposit/d1/parcel/p1');
  });
});

describe('rien ne part d’un écran déjà quitté', () => {
  it('un retour demandé après l’envoi, l’écran déjà quitté : il ne part pas (pas de double retour)', () => {
    let late: ((fallback: string) => void) | null = null;
    function Sender() {
      const back = useReceptionBack();
      const navigate = useNavigate();
      late = back;
      return <button type="button" onClick={() => navigate('/r/ailleurs')}>quitter</button>;
    }
    mount('/r/deposit/d1/parcel', <Sender />, '/r/deposit/:depositId/parcel');
    fireEvent.click(screen.getByRole('button', { name: 'quitter' }));
    expect(screen.getByTestId('where').textContent).toBe('/r/ailleurs');
    act(() => late!('/r/deposit/d1')); // l'envoi se termine : sans garde, il remplacerait /r/ailleurs
    expect(screen.getByTestId('where').textContent).toBe('/r/ailleurs');
  });

  it('quitté pendant le voile vert « Client trouvé » : ni attribution, ni étape suivante', async () => {
    m.byCode.mockResolvedValue(client);
    mount('/r/new?assign=d1', <ReceptionIdentify />, '/r/new');
    await act(async () => { m.decode!('BZ-482913'); });
    fireEvent.click(screen.getByRole('button', { name: 'Retour' }));
    expect(screen.getByTestId('where').textContent).toBe('/r/pending');
    await act(() => new Promise((r) => setTimeout(r, 900)));
    expect(m.assign).not.toHaveBeenCalled();
    expect(screen.getByTestId('where').textContent).toBe('/r/pending');
  });
});

describe('attribuer : un refus laisse l’écran utilisable', () => {
  it('la caméra ne repart pas d’elle-même (ni boucle sur le même QR, ni caméra native par-dessus le message)', async () => {
    m.byCode.mockResolvedValue(client);
    m.assign.mockRejectedValue(new Error('Ce dépôt est déjà attribué'));
    mount('/r/new?assign=d1', <ReceptionIdentify />, '/r/new');
    await act(async () => { m.decode!('BZ-482913'); });
    const alert = await screen.findByRole('alert', {}, { timeout: 2000 });
    expect(alert).toHaveTextContent('Ce dépôt est déjà attribué');
    expect(m.stop).toHaveBeenCalled();
    expect(m.restartKeys).toEqual([0]); // aucune relance
    expect(within(alert).getByRole('button', { name: /Voir le dépôt/ })).toBeInTheDocument();
    expect(within(alert).getByRole('button', { name: /Retour/ })).toBeInTheDocument();
    // « Scanner encore » : la relance vient d'un geste.
    fireEvent.click(within(alert).getByRole('button', { name: /Scanner encore/ }));
    expect(m.restartKeys).toEqual([0, 1]);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('partie de la fiche du dépôt, « Voir le dépôt » y REVIENT au lieu d’en empiler une seconde', async () => {
    window.history.replaceState({ idx: 2 }, '');
    m.byCode.mockResolvedValue(client);
    m.assign.mockRejectedValue(new Error('Ce dépôt est déjà attribué'));
    mount(['/r', '/r/deposit/d1', '/r/new?assign=d1&from=deposit'], <ReceptionIdentify />, '/r/new');
    await act(async () => { m.decode!('BZ-482913'); });
    const alert = await screen.findByRole('alert', {}, { timeout: 2000 });
    fireEvent.click(within(alert).getByRole('button', { name: /Voir le dépôt/ }));
    expect(screen.getByTestId('where').textContent).toBe('/r/deposit/d1');
    fireEvent.click(screen.getByRole('button', { name: 'geste-retour' }));
    expect(screen.getByTestId('where').textContent).toBe('/r'); // une seule fiche dans l'historique
  });

  it('un lien fabriqué (?assign=x&from=…) ne glisse ni paramètre ni chemin', () => {
    expect(assignPath('d1')).toBe('/r/new?assign=d1');
    expect(assignPath('d1', true)).toBe('/r/new?assign=d1&from=deposit');
    mount('/r/new?assign=x%26from%3Ddeposit', <ReceptionIdentify />, '/r/new');
    // Pas une attribution : l'écran d'un nouveau dépôt, et sa sortie vers l'accueil.
    expect(screen.queryByText(/Attribuer à un client/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retour' }));
    expect(screen.getByTestId('where').textContent).toBe('/r');
  });

  it('réussie depuis la fiche : retour à la fiche', async () => {
    m.byCode.mockResolvedValue(client);
    m.assign.mockResolvedValue({});
    mount('/r/new?assign=d1&from=deposit', <ReceptionIdentify />, '/r/new');
    await act(async () => { m.decode!('BZ-482913'); });
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/r/deposit/d1'), { timeout: 2000 });
    expect(m.assign).toHaveBeenCalledWith({ depositId: 'd1', clientUserId: 'u1' });
  });
});

describe('corriger un colis', () => {
  it('pendant le chargement : l’en-tête et sa flèche, pas un formulaire vide qu’on remplirait pour rien', () => {
    m.deposit = undefined;
    m.depLoading = true;
    mount('/r/deposit/d1/parcel/p1?step=weight', <ReceptionParcel />, '/r/deposit/:depositId/parcel/:parcelId');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('spinbutton')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retour' }));
    expect(screen.getByTestId('where').textContent).toBe('/r/deposit/d1');
  });

  it('lecture en échec : le dire, avec « Réessayer » — pas un « Enregistrer » muet', () => {
    m.deposit = undefined;
    m.depError = new Error('Réseau indisponible');
    mount('/r/deposit/d1/parcel/p1?step=weight', <ReceptionParcel />, '/r/deposit/:depositId/parcel/:parcelId');
    expect(screen.getByText('Réseau indisponible')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Réessayer/ })).toBeInTheDocument();
  });
});

describe('une relecture ratée en arrière-plan', () => {
  it('garde le formulaire de correction déjà rempli (retour de l’appareil photo, réseau faible)', () => {
    m.depError = new Error('Réseau indisponible'); // react-query garde les données et pose l'erreur
    mount('/r/deposit/d1/parcel/p1?step=weight', <ReceptionParcel />, '/r/deposit/:depositId/parcel/:parcelId');
    expect(screen.queryByText('Réseau indisponible')).toBeNull();
    expect(screen.getByRole('button', { name: /Suivant|Passer/ })).toBeInTheDocument();
  });

  it('garde la fiche du dépôt', () => {
    m.depError = new Error('Réseau indisponible');
    mount('/r/deposit/d1', <ReceptionDeposit />, '/r/deposit/:depositId');
    expect(screen.getByRole('button', { name: /Ajouter un colis/ })).toBeInTheDocument();
  });
});

describe('colis à emballer : où le compléter', () => {
  function Fix({ d }: { d: Deposit }) {
    const fix = usePackFix()({ parcel: { id: 'p1' }, deposit: d, reason: 'no_weight' });
    return <output>{JSON.stringify(fix)}</output>;
  }
  const show = (d: Deposit) => {
    const { unmount } = render(<LanguageProvider><MemoryRouter><Fix d={d} /></MemoryRouter></LanguageProvider>);
    const fix = JSON.parse(screen.getByRole('status').textContent ?? '{}') as { path: string | null; note: string | null };
    unmount();
    return fix;
  };

  it('mon dépôt terminé, pas pesé : droit à la pesée', () => {
    expect(show(deposit({ status: 'closed' })).path).toBe('/r/deposit/d1/parcel/p1?step=weight');
  });

  it('devis déjà chez le client : pas de lien (le serveur refuserait), et qui le fait', () => {
    const fix = show(deposit({ status: 'closed', quote_engaged: 'Le devis DV-000012 a déjà été envoyé au client' }));
    expect(fix.path).toBeNull();
    expect(fix.note).toMatch(/équipe cargo/);
    m.cargo = true;
    expect(show(deposit({ status: 'closed', quote_engaged: 'Le devis DV-000012 a déjà été envoyé au client' })).path).toBe('/r/deposit/d1/parcel/p1?step=weight');
  });

  it('le dépôt d’un collègue : pas de lien, son nom', () => {
    const fix = show(deposit({ status: 'closed', received_by: 'li', received_by_name: 'Li Wei' }));
    expect(fix.path).toBeNull();
    expect(fix.note).toMatch(/Li Wei/);
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
