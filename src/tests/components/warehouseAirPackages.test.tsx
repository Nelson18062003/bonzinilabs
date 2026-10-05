/**
 * DOUALA — les paquets avion de 32 kg au pointage.
 *
 * Ce que le chef d'entrepôt doit voir et pouvoir faire :
 *  · « Paquets reçus X / Y » en grand, et EN ROUGE les paquets pas encore là ;
 *  · un scan PQ-… reçoit le paquet (le serveur répond), le message le dit ;
 *  · un paquet s'ouvre, puis « Tout pointer » ne pointe QUE ses colis ;
 *  · le lien du scanner /w/arrivees?paquet=PQ-… reçoit le paquet et file au
 *    pointage de son expédition ; un refus reste affiché sur les arrivées.
 * Les hooks sont simulés : le sujet est l'écran, pas la base.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { AirPackage } from '@/lib/airPackage';
import type { WarehouseArrivalDetail, WarehouseParcel } from '@/lib/warehouse';

const m = vi.hoisted(() => ({
  arrival: null as unknown,
  receive: vi.fn(),
  open: vi.fn(),
  checkin: vi.fn(),
  checkinMany: vi.fn(),
  flagMany: vi.fn(),
  setArrivalPackage: vi.fn(),
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

vi.mock('@/hooks/useWarehouse', () => ({
  useWarehouseArrival: () => ({ data: m.arrival, isLoading: false, error: null, refetch: vi.fn() }),
  useWarehouseDay: () => ({ data: { arrivals: [] }, isLoading: false }),
  useCheckinParcel: () => ({ mutate: m.checkin, mutateAsync: m.checkin, isPending: false }),
  useCheckinMany: () => ({ mutate: m.checkinMany, isPending: false }),
  useFlagMissingMany: () => ({ mutate: m.flagMany, isPending: false }),
  useFindParcel: () => ({ mutateAsync: vi.fn().mockRejectedValue(new Error('inconnu')) }),
  useSetArrivalPackage: () => m.setArrivalPackage,
}));

vi.mock('@/hooks/useAirPackages', () => ({
  useReceiveAirPackage: () => ({ mutateAsync: m.receive }),
  useOpenAirPackage: () => ({ mutate: m.open, isPending: false }),
  useAirPackages: () => ({ data: undefined }),
}));

import { WarehouseCheckin } from '@/mobile/screens/warehouse/WarehouseCheckin';
import { WarehouseArrivals } from '@/mobile/screens/warehouse/WarehouseArrivals';

const pkg = (o: Partial<AirPackage>): AirPackage => ({
  id: 'k1', package_no: 'PQ-000001', status: 'handed_over', air_shipment_id: 'a1', awb_number: '07112345675', air_status: 'ARRIVED', etd: null, flight_no: null,
  max_weight_kg: 32, gross_weight_kg: 30, length_cm: null, width_cm: null, height_cm: null, notes: null, net_weight_kg: 20,
  parcel_count: 2, client_count: 1, checked_count: 0, missing_count: 0, sealed_at: null, handed_over_at: null, refused_at: null,
  refusal_reason: null, refused_air_shipment_id: null, received_at: null, opened_at: null, created_at: 'x', updated_at: 'x', parcels: null,
  ...o,
});

const parcel = (o: Partial<WarehouseParcel>): WarehouseParcel => ({
  id: 'p', seq: 1, parcel_no: 'RC-000123-01', kind: 'carton', weight_kg: 8, length_cm: 40, width_cm: 30, height_cm: 30, cbm: 0.036,
  description: 'Chaussures', courier_waybill: null, photo_path: null, status: 'arrived', created_at: 'x',
  deposit_id: 'd1', deposit_no: 'RC-000123', client: null, air_shipment_id: 'a1', awb_number: '07112345675',
  checked_in_at: null, warehouse_location: null, condition: null, condition_note: null, delivered_at: null, release_id: null,
  ...o,
});

const ARRIVAL: WarehouseArrivalDetail = {
  kind: 'air', id: 'a1', label: 'LTA 071-12345675', sub: 'ET 901 · Ethiopian',
  packages: [
    pkg({ id: 'k1', package_no: 'PQ-000001', status: 'opened', received_at: 'x', opened_at: 'x' }),
    pkg({ id: 'k2', package_no: 'PQ-000002', status: 'received', received_at: 'x' }),
    pkg({ id: 'k3', package_no: 'PQ-000003' }),
  ],
  parcels: [
    parcel({ id: 'p1a', parcel_no: 'RC-000123-01', air_package_id: 'k1', package_no: 'PQ-000001', checked_in_at: 'x', condition: 'ok' }),
    parcel({ id: 'p1b', parcel_no: 'RC-000123-02', air_package_id: 'k1', package_no: 'PQ-000001' }),
    parcel({ id: 'p2a', parcel_no: 'RC-000124-01', air_package_id: 'k2', package_no: 'PQ-000002' }),
    parcel({ id: 'p3a', parcel_no: 'RC-000125-01', air_package_id: 'k3', package_no: 'PQ-000003' }),
    parcel({ id: 'pl', parcel_no: 'RC-000126-01' }),
  ],
};

function Probe() {
  const loc = useLocation();
  const st = loc.state as { packageScan?: { text: string } } | null;
  return <p data-testid="probe">{loc.pathname} | {st?.packageScan?.text ?? ''}</p>;
}

function renderAt(url: string, checkinElement: React.ReactElement = <WarehouseCheckin />) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/w/arrivees" element={<WarehouseArrivals />} />
        <Route path="/w/arrivees/:kind/:id" element={checkinElement} />
      </Routes>
    </MemoryRouter>,
  );
}

const scan = (text: string) => {
  const input = screen.getByRole('textbox', { name: /Scannez/ });
  fireEvent.change(input, { target: { value: text } });
  fireEvent.keyDown(input, { key: 'Enter' });
};

beforeEach(() => {
  m.arrival = ARRIVAL;
  for (const f of [m.receive, m.open, m.checkin, m.checkinMany, m.flagMany, m.setArrivalPackage]) f.mockReset();
});

describe('L’arrivée avion : les paquets d’abord', () => {
  it('montre « Paquets reçus 2 / 3 » et, en rouge, le paquet qui manque', () => {
    renderAt('/w/arrivees/air/a1');
    expect(screen.getByTestId('packages-counter')).toHaveTextContent('2 / 3');
    expect(screen.getByRole('alert')).toHaveTextContent('1 paquet pas encore reçu');
    expect(screen.getByRole('alert')).toHaveTextContent('PQ-000003');
    // Reçu mais pas ouvert : le bouton « Ouvrir » est sur sa ligne.
    expect(screen.getByRole('button', { name: 'Ouvrir' })).toBeInTheDocument();
    // Le colis hors paquet reste listé ; « Tout pointer » ne vise que lui.
    expect(screen.getByText('Colis hors paquet')).toBeInTheDocument();
    expect(screen.getByText('RC-000126-01')).toBeInTheDocument();
    expect(screen.queryByText('RC-000123-02')).toBeNull();
    expect(screen.getByRole('button', { name: /Tout pointer hors paquet \(1\)/ })).toBeInTheDocument();
  });

  it('un scan PQ-… reçoit le paquet et dit le compte', async () => {
    m.receive.mockResolvedValue({ already: false, package_no: 'PQ-000003', received: 3, total: 3, package: pkg({ id: 'k3', package_no: 'PQ-000003', status: 'received', received_at: 'x' }) });
    renderAt('/w/arrivees/air/a1');
    scan('pq 3');
    await waitFor(() => expect(screen.getByText('PQ-000003 reçu · les 3 paquets sont là')).toBeInTheDocument());
    expect(m.receive).toHaveBeenCalledWith('PQ-000003');
    expect(m.setArrivalPackage).toHaveBeenCalledWith('air', 'a1', expect.objectContaining({ id: 'k3' }));
  });

  it('un refus du serveur s’affiche tel quel', async () => {
    m.receive.mockRejectedValue(new Error('Paquet PQ-000009 introuvable'));
    renderAt('/w/arrivees/air/a1');
    scan('PQ-000009');
    await waitFor(() => expect(screen.getByText('Paquet PQ-000009 introuvable')).toBeInTheDocument());
  });

  it('un scan de colis garde le pointage d’aujourd’hui, et dit son paquet', async () => {
    m.checkin.mockResolvedValue({});
    renderAt('/w/arrivees/air/a1');
    scan('RC-000124-01');
    await waitFor(() => expect(screen.getByText('RC-000124-01 pointé · PQ-000002')).toBeInTheDocument());
    expect(m.checkin).toHaveBeenCalledWith(expect.objectContaining({ parcelId: 'p2a', condition: 'ok' }));
    expect(m.receive).not.toHaveBeenCalled();
  });
});

describe('Un paquet ouvert : ses colis, et eux seuls', () => {
  it('« Tout pointer ce paquet » ne pointe que ses colis restants', () => {
    renderAt('/w/arrivees/air/a1?paquet=PQ-000001');
    expect(screen.getAllByText('PQ-000001').length).toBeGreaterThan(1); // le titre, et la pastille de chaque colis
    expect(screen.queryByText('RC-000126-01')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Tout pointer ce paquet \(1\)/ }));
    fireEvent.click(screen.getByRole('button', { name: /Oui, tout pointer/ }));
    expect(m.checkinMany).toHaveBeenCalledWith({ parcelIds: ['p1b'], location: undefined }, expect.anything());
  });

  it('un paquet jamais reçu se signale, et s’ouvre quand même s’il est là', () => {
    renderAt('/w/arrivees/air/a1?paquet=PQ-000003');
    expect(screen.getByText('Ce paquet n\'a pas été reçu')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ouvrir le paquet/ }));
    expect(m.open).toHaveBeenCalledWith('k3', expect.anything());
    fireEvent.click(screen.getByRole('button', { name: /déclarer ses 1 colis manquants/ }));
    fireEvent.click(screen.getByRole('button', { name: /Oui, manquants/ }));
    expect(m.flagMany).toHaveBeenCalledWith({ parcelIds: ['p3a'], note: 'Paquet PQ-000003 non reçu à Douala' }, expect.anything());
  });
});

describe('Le lien du scanner : /w/arrivees?paquet=PQ-…', () => {
  it('reçoit le paquet puis ouvre le pointage de son expédition, avec le résultat', async () => {
    m.receive.mockResolvedValue({ already: false, package_no: 'PQ-000003', received: 3, total: 3, package: pkg({ id: 'k3', package_no: 'PQ-000003', air_shipment_id: 'a1', status: 'received' }) });
    renderAt('/w/arrivees?paquet=PQ-000003', <Probe />);
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('/w/arrivees/air/a1 | PQ-000003 reçu · les 3 paquets sont là'));
    expect(m.receive).toHaveBeenCalledTimes(1);
  });

  it('le résultat apparaît sur l’écran de pointage', () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/w/arrivees/air/a1', state: { packageScan: { outcome: 'ok', text: 'PQ-000003 reçu · 3 / 3 paquets reçus' } } }]}>
        <Routes><Route path="/w/arrivees/:kind/:id" element={<WarehouseCheckin />} /></Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('PQ-000003 reçu · 3 / 3 paquets reçus')).toBeInTheDocument();
  });

  it('un refus reste affiché sur les arrivées', async () => {
    m.receive.mockRejectedValue(new Error('Son expédition n\'est pas encore marquée arrivée : demandez à l\'admin de poser le jalon'));
    renderAt('/w/arrivees?paquet=PQ-000003', <Probe />);
    await waitFor(() => expect(screen.getByText(/pas encore marquée arrivée/)).toBeInTheDocument());
    expect(screen.queryByTestId('probe')).toBeNull();
    expect(screen.getByText('Quelle arrivée ?')).toBeInTheDocument();
  });

  it('un code qui n’est pas un paquet est refusé sans appeler le serveur', async () => {
    renderAt('/w/arrivees?paquet=BZ-482913', <Probe />);
    await waitFor(() => expect(screen.getByText(/ce n'est pas une étiquette de paquet/)).toBeInTheDocument());
    expect(m.receive).not.toHaveBeenCalled();
  });
});
