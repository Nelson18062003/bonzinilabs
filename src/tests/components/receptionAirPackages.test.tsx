/**
 * GUANGZHOU — les paquets avion de 32 kg à la réception (/r/paquets).
 *
 * Ce que le réceptionnaire doit voir et pouvoir faire :
 *  · les paquets rangés : en cours, refusés (avec le motif), prêts, affectés ;
 *  · « Nouveau paquet » ouvre sa fiche ; le lien de l'app HQ ?code=PQ-… aussi ;
 *  · un scan RC-… met le colis dans le paquet ; 32 kg dépassés → on propose
 *    de fermer ce paquet et d'en commencer un autre ;
 *  · fermer exige un poids pesé ≤ 32 kg ; un paquet fermé s'imprime et se rouvre.
 * Les hooks sont simulés : le sujet est l'écran, pas la base.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { LanguageProvider } from '@/contexts/LanguageContext';
import type { AirPackage, AirPackageParcel } from '@/lib/airPackage';

const m = vi.hoisted(() => ({
  list: [] as unknown[],
  one: null as unknown,
  find: vi.fn(),
  create: vi.fn(),
  add: vi.fn(),
  remove: vi.fn(),
  seal: vi.fn(),
  reopen: vi.fn(),
  del: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  Object.assign(chain, {
    from: self, select: self, eq: self, in: self, order: self, limit: self,
    single: async () => ({ data: null, error: null }),
    then: (r: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(r),
    rpc: async () => ({ data: null, error: null }),
    storage: { from: () => ({ createSignedUrl: async () => ({ data: null, error: null }) }) },
    auth: { getUser: async () => ({ data: { user: null } }) },
  });
  return { supabase: chain, supabaseAdmin: chain };
});

vi.mock('@/hooks/useAirPackages', () => {
  class RpcError extends Error {
    constructor(message: string, readonly payload: Record<string, unknown>) { super(message); }
  }
  return {
    PackageRpcError: RpcError,
    useAirPackages: () => ({ data: m.list, isLoading: false, error: null, refetch: vi.fn() }),
    useAirPackage: () => ({ data: m.one, isLoading: false, error: null, refetch: vi.fn() }),
    useFindAirPackage: () => ({ mutateAsync: m.find }),
    useCreateAirPackage: () => ({ mutate: m.create, isPending: false }),
    useAddParcelToPackage: () => ({ mutateAsync: m.add }),
    useRemoveParcelFromPackage: () => ({ mutate: m.remove, isPending: false }),
    useSealAirPackage: () => ({ mutate: m.seal, isPending: false }),
    useReopenAirPackage: () => ({ mutate: m.reopen, isPending: false }),
    useDeleteAirPackage: () => ({ mutate: m.del, isPending: false }),
  };
});

import { PackageRpcError } from '@/hooks/useAirPackages';
import { ReceptionPackages } from '@/mobile/screens/reception/ReceptionPackages';
import { ReceptionPackage } from '@/mobile/screens/reception/ReceptionPackage';

const pkg = (o: Partial<AirPackage>): AirPackage => ({
  id: 'k1', package_no: 'PQ-000001', status: 'open', air_shipment_id: null, awb_number: null, air_status: null, etd: null, flight_no: null,
  max_weight_kg: 32, gross_weight_kg: null, length_cm: null, width_cm: null, height_cm: null, notes: null, net_weight_kg: 12,
  parcel_count: 2, client_count: 1, checked_count: 0, missing_count: 0, sealed_at: null, handed_over_at: null, refused_at: null,
  refusal_reason: null, refused_air_shipment_id: null, received_at: null, opened_at: null, created_at: 'x', updated_at: 'x', parcels: [],
  ...o,
});

const client = { user_id: 'u1', customer_code: 'BZ-482913', first_name: 'Jean', last_name: 'Mballa', phone: null, email: null, company_name: null, city: null, country: null };
const parcel = (o: Partial<AirPackageParcel>): AirPackageParcel => ({
  id: 'p1', seq: 1, parcel_no: 'RC-000123-01', kind: 'carton', weight_kg: 7, cbm: null, description: 'Chaussures', status: 'stored', photo_path: null,
  checked_in_at: null, warehouse_location: null, condition: null, delivered_at: null, deposit_no: 'RC-000123', deposit_id: 'd1', client: client as AirPackageParcel['client'],
  ...o,
});

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{loc.pathname}{loc.search}</div>;
}

function mount(path: string) {
  return render(
    <LanguageProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/r/paquets" element={<><ReceptionPackages /><Where /></>} />
          <Route path="/r/paquets/:id" element={<><ReceptionPackage /><Where /></>} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  );
}

beforeEach(() => {
  for (const fn of [m.find, m.create, m.add, m.remove, m.seal, m.reopen, m.del]) fn.mockReset();
  m.list = [];
  m.one = null;
});

describe('la liste des paquets du bureau', () => {
  it('range les paquets et montre le motif d’un refus et l’expédition', () => {
    m.list = [
      pkg({ id: 'a', package_no: 'PQ-000010', status: 'open' }),
      pkg({ id: 'b', package_no: 'PQ-000011', status: 'refused', refusal_reason: 'Batterie au lithium', gross_weight_kg: 30 }),
      pkg({ id: 'c', package_no: 'PQ-000012', status: 'sealed', gross_weight_kg: 31.5 }),
      pkg({ id: 'd', package_no: 'PQ-000013', status: 'sealed', air_shipment_id: 'air1', awb_number: '07112345675', flight_no: 'ET 607', gross_weight_kg: 29 }),
    ];
    mount('/r/paquets');
    for (const title of ['En cours', 'Refusés à l\'aéroport', 'Fermés, prêts à partir', 'Affectés à une expédition']) expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.getByText('Motif : Batterie au lithium')).toBeInTheDocument();
    expect(screen.getByText(/LTA 071-12345675 · Vol ET 607/)).toBeInTheDocument();
    expect(screen.getByText('reste 20 kg')).toBeInTheDocument();
  });

  it('« Nouveau paquet » ouvre la fiche du paquet créé', () => {
    m.create.mockImplementation((_: unknown, opts: { onSuccess: (p: AirPackage) => void }) => opts.onSuccess(pkg({ id: 'new1' })));
    mount('/r/paquets');
    fireEvent.click(screen.getByRole('button', { name: /Nouveau paquet/ }));
    expect(screen.getByTestId('where').textContent).toBe('/r/paquets/new1');
  });

  it('le lien du scanner natif ?code=PQ-… file à la fiche', async () => {
    m.find.mockResolvedValue(pkg({ id: 'k7', package_no: 'PQ-000007' }));
    mount('/r/paquets?code=pq7');
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/r/paquets/k7'));
    expect(m.find).toHaveBeenCalledWith('PQ-000007');
  });

  it('un code introuvable reste affiché, le lien s’efface', async () => {
    m.find.mockRejectedValue(new Error('Paquet introuvable'));
    mount('/r/paquets?code=PQ-000099');
    expect(await screen.findByRole('alert')).toHaveTextContent('PQ-000099 · Paquet introuvable');
    expect(screen.getByTestId('where').textContent).toBe('/r/paquets');
  });
});

describe("la fiche d'un paquet", () => {
  const scan = (text: string) => {
    const input = screen.getByRole('textbox', { name: /Scannez l'étiquette d'un colis/ });
    fireEvent.change(input, { target: { value: text } });
    fireEvent.keyDown(input, { key: 'Enter' });
  };

  it('un scan met le colis dans le paquet et le dit', async () => {
    m.one = pkg({ parcels: [parcel({})], parcel_count: 1, net_weight_kg: 7 });
    m.add.mockResolvedValue({ already: false, parcel_no: 'RC-000124-02', weight_kg: 3.5, client, package: m.one });
    mount('/r/paquets/k1');
    expect(screen.getByText('BZ-482913')).toBeInTheDocument();
    expect(screen.getByText('reste 25 kg')).toBeInTheDocument();
    scan('RC-000124-02');
    expect(await screen.findByRole('status')).toHaveTextContent('RC-000124-02 ajouté (3,5 kg) · BZ-482913 · Jean Mballa');
    expect(m.add).toHaveBeenCalledWith('RC-000124-02');
  });

  it('32 kg dépassés : la raison du serveur, et « fermer et en commencer un autre »', async () => {
    m.one = pkg({ parcels: [parcel({ weight_kg: 30 })], parcel_count: 1, net_weight_kg: 30 });
    m.add.mockRejectedValue(new PackageRpcError('Le paquet passerait à 35 kg : 32 kg au plus. Commencez un autre paquet.', { success: false, over: true }));
    mount('/r/paquets/k1');
    scan('RC-000200-01');
    expect(await screen.findByText(/passerait à 35 kg/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Fermer ce paquet et en commencer un autre/ }));
    expect(await screen.findByLabelText('Poids pesé (kg)')).toBeInTheDocument();
  });

  it('fermer exige un poids pesé de 32 kg au plus', async () => {
    m.one = pkg({ parcels: [parcel({ weight_kg: 12 })], parcel_count: 1, net_weight_kg: 12 });
    mount('/r/paquets/k1');
    fireEvent.click(screen.getByRole('button', { name: /^Fermer le paquet$/ }));
    const input = await screen.findByLabelText('Poids pesé (kg)');
    fireEvent.change(input, { target: { value: '33' } });
    expect(screen.getByText('Plus de 32 kg : retirez un colis')).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: /Fermer et imprimer l'étiquette/ });
    expect(submit).toBeDisabled();
    fireEvent.change(input, { target: { value: '12,6' } });
    fireEvent.change(screen.getByLabelText('Longueur'), { target: { value: '60' } });
    fireEvent.click(submit);
    expect(m.seal).toHaveBeenCalledWith({ grossWeightKg: 12.6, lengthCm: 60, widthCm: null, heightCm: null }, expect.anything());
  });

  it('un paquet fermé s’imprime et se rouvre ; vide, il se supprime', () => {
    m.one = pkg({ status: 'sealed', gross_weight_kg: 12.4, parcels: [parcel({})], parcel_count: 1 });
    const { unmount } = mount('/r/paquets/k1');
    expect(screen.getByRole('button', { name: /Imprimer l'étiquette/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rouvrir/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Fermer le paquet$/ })).toBeNull();
    expect(screen.queryByRole('textbox', { name: /Scannez/ })).toBeNull();
    unmount();

    m.one = pkg({ parcels: [], parcel_count: 0, net_weight_kg: 0 });
    mount('/r/paquets/k1');
    fireEvent.click(screen.getByRole('button', { name: /Supprimer ce paquet vide/ }));
    const dialog = screen.getAllByRole('dialog').at(-1)!;
    fireEvent.click(within(dialog).getByRole('button', { name: /Supprimer ce paquet vide/ }));
    expect(m.del).toHaveBeenCalledWith('k1', expect.anything());
  });
});
