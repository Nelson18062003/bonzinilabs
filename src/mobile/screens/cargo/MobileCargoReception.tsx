// ============================================================
// Mobile admin — Cargo › Réception (refonte v2, maquette 04/06) : ce qui a
// été reçu à Guangzhou, comme la console de l'ordinateur.
//
// La recherche (RC, BZ, client, bordereau, contenu ; PQ en vue Paquets),
// les vues Dépôts · Colis · Paquets, les files en puces (Tous, À attribuer,
// Incomplets, Sans photo, En cours, En attente, Partis), puis les dépôts
// jour par jour avec le montant du devis et leur état. Dans « … » : la
// période (En stock, Aujourd'hui, 7 / 30 / 90 j, Tout, Supprimés), le lieu,
// « Reçu par », les vues Par client et Photos, le travail des
// réceptionnaires, la langue des devis, le CSV, les comptes cargo et
// Douala. `?vue=colis|paquets` ouvre la vue.
// ============================================================
import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarRange, Download, Globe2, Images, Languages, MapPin, Package, Plane, UserRound, Users, Warehouse } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useReceptionBoard, useReceptionStock, type BoardScope } from '@/hooks/useReception';
import { useWarehouseDay } from '@/hooks/useWarehouse';
import { useAirPackages } from '@/hooks/useAirPackages';
import { CARGO_DOC_LANGS, CARGO_DOC_LANG_LABEL, readCargoDocLang, storeCargoDocLang, type CargoDocLang } from '@/lib/cargoQuotePdf';
import { isAssignable, packageKg, packageStatusMeta, fmtKg1, type AirPackage } from '@/lib/airPackage';
import {
  clientFullName, depositDate, depositInQueue, depositMatches, formatCbm, formatKg, isParcelIncomplete, parcelInQueue, parcelPhotoPaths, parcelStage, sortedParcels,
  type Deposit, type Parcel, type ReceptionLocation, type ReceptionQueue,
} from '@/lib/reception';
import { exportToCSV } from '@/lib/exportCSV';
import { cn } from '@/lib/utils';
import {
  ActionSheet, BottomSheet, DayLabel, EmptyLine, IconCircle, Initials, ItemList, ItemRow, KVBox, MoreButton, ScreenLoader, ScreenTop, SearchBox, SURFACE, TEXT, type Tone,
} from '@/mobile/designKit';
import { ChipRow, FitSegmented, RadioRow, RowButton } from '@/mobile/components/cargo/v2';
import { ParcelThumb, formatDateTime as fmtDT, useReceptionLabels } from "@/mobile/components/reception/bits";
import { ShipSheet } from '@/mobile/components/cargo/ShipSheet';

type View = 'deposits' | 'parcels' | 'packages';
type Period = 'stock' | 'today' | 'week' | 'month' | 'quarter' | 'all' | 'cancelled';
type Sheet = 'period' | 'where' | 'by' | 'clients' | 'photos' | 'staff' | 'lang' | 'douala' | null;

const PERIODS: { value: Period; label: string }[] = [
  { value: 'stock', label: 'En stock' }, { value: 'today', label: "Aujourd'hui" }, { value: 'week', label: '7 jours' },
  { value: 'month', label: '30 jours' }, { value: 'quarter', label: '90 jours' }, { value: 'all', label: 'Tout' }, { value: 'cancelled', label: 'Supprimés' },
];
const QUEUES: { value: ReceptionQueue; label: string }[] = [
  { value: 'all', label: 'Tous' }, { value: 'pending', label: 'À attribuer' }, { value: 'incomplete', label: 'Incomplets' }, { value: 'nophoto', label: 'Sans photo' },
  { value: 'open', label: 'En cours' }, { value: 'waiting', label: 'En attente' }, { value: 'loaded', label: 'Partis' },
];
const WHERE: { value: 'all' | ReceptionLocation; label: string }[] = [{ value: 'all', label: 'Partout' }, { value: 'warehouse', label: 'Entrepôt' }, { value: 'office', label: 'Bureau' }];

function periodQuery(p: Period): { scope: BoardScope; from: Date | null } {
  if (p === 'stock') return { scope: 'stock', from: null };
  if (p === 'cancelled' || p === 'all') return { scope: p === 'all' ? 'all' : 'cancelled', from: null };
  const from = new Date(); from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - (p === 'today' ? 0 : p === 'week' ? 6 : p === 'month' ? 29 : 89));
  return { scope: 'all', from };
}
const short = (n: number) => Math.round(n).toLocaleString('fr-FR');
function dayKey(iso: string): string {
  const d = new Date(iso); const today = new Date(); const y = new Date(); y.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  return same(d, today) ? "Aujourd'hui" : same(d, y) ? 'Hier' : d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' });
}

/** Ce qui compte d'un dépôt, en un tag : supprimé, en cours, à attribuer, incomplet, puis le devis. */
function depositTag(d: Deposit): { tone: Tone; label: string } {
  if (d.status === 'cancelled') return { tone: 'danger', label: 'Supprimé' };
  if (d.status === 'open') return { tone: 'info', label: 'En cours' };
  if (!d.client) return { tone: 'pending', label: 'À attribuer' };
  if (d.parcels.some((p) => p.weight_kg == null)) return { tone: 'danger', label: 'Sans poids' };
  if (d.parcels.some(isParcelIncomplete)) return { tone: 'pending', label: 'Incomplet' };
  const total = Number(d.quote_total_xaf ?? 0); const paid = Number(d.quote_paid_xaf ?? 0);
  if (!d.quote_no || total <= 0) return { tone: 'neutral', label: 'Sans prix' };
  if (paid >= total) return { tone: 'success', label: 'Payé' };
  return { tone: 'pending', label: 'À payer' };
}

export function MobileCargoReception() {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const labels = useReceptionLabels();
  const [params, setParams] = useSearchParams();
  const view: View = params.get('vue') === 'colis' ? 'parcels' : params.get('vue') === 'paquets' ? 'packages' : 'deposits';
  const setView = (v: View) => setParams(v === 'deposits' ? {} : { vue: v === 'parcels' ? 'colis' : 'paquets' }, { replace: true });
  const [period, setPeriod] = useState<Period>('stock');
  const [where, setWhere] = useState<'all' | ReceptionLocation>('all');
  const [queue, setQueue] = useState<ReceptionQueue>('all');
  const [query, setQuery] = useState('');
  const [receivedBy, setReceivedBy] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [shipOpen, setShipOpen] = useState(false);
  const [docLang, setDocLangState] = useState<CargoDocLang>(readCargoDocLang);
  const pq = periodQuery(period);
  const board = useReceptionBoard({ scope: pq.scope, location: where === 'all' ? null : where, from: pq.from, to: null });
  const stock = useReceptionStock(where === 'all' ? null : where);
  const packages = useAirPackages('all', null, view === 'packages');
  const seesDouala = hasPermission('canReleaseParcels') || hasPermission('canReceiveAtDestination');
  const douala = useWarehouseDay(seesDouala && sheet === 'douala');

  const all = useMemo(() => board.data?.deposits ?? [], [board.data]);
  const scoped = useMemo(() => all.filter((d) => (!receivedBy || d.received_by === receivedBy) && depositMatches(d, query)), [all, receivedBy, query]);
  const deposits = useMemo(() => scoped.filter((d) => depositInQueue(d, queue)).sort((a, b) => depositDate(b).localeCompare(depositDate(a))), [scoped, queue]);
  const parcelRows = useMemo(() => deposits.flatMap((d) => sortedParcels(d.parcels).filter((p) => parcelInQueue(p, d, queue)).map((p) => ({ parcel: p, deposit: d }))), [deposits, queue]);
  const staff = useMemo(() => {
    const m = new Map<string, { id: string; name: string; deposits: number; parcels: number; kg: number; incomplete: number; pending: number }>();
    for (const d of all) {
      const r = m.get(d.received_by) ?? { id: d.received_by, name: d.received_by_name || 'Réceptionnaire', deposits: 0, parcels: 0, kg: 0, incomplete: 0, pending: 0 };
      r.deposits += 1; r.parcels += d.parcels.length; r.kg += Number(d.total_weight_kg ?? 0);
      r.incomplete += d.parcels.filter(isParcelIncomplete).length; if (!d.client) r.pending += 1;
      m.set(d.received_by, r);
    }
    return [...m.values()].sort((a, b) => b.parcels - a.parcels);
  }, [all]);

  if (!hasPermission('canViewCargo')) return <Navigate to="/m" replace />;
  // `?paquet=<id>` (lien d'une fiche avion) : la fiche du paquet est celle de la réception.
  const paquet = params.get('paquet');
  if (paquet && hasPermission('canReceiveParcels')) return <Navigate to={`/r/paquets/${paquet}`} replace />;

  const count = (q: ReceptionQueue) => scoped.filter((d) => depositInQueue(d, q)).length;
  const setDocLang = (l: CargoDocLang) => { setDocLangState(l); storeCargoDocLang(l); };
  const pkList = (packages.data ?? []).filter((k) => !query.trim() || `${k.package_no} ${k.awb_number ?? ''} ${k.flight_no ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  const loose = (packages.data ?? []).filter((k) => !k.air_shipment_id && isAssignable(k)).length;

  // Les dépôts, jour par jour.
  const days: { key: string; items: Deposit[] }[] = [];
  for (const d of deposits) {
    const k = dayKey(depositDate(d));
    const last = days[days.length - 1];
    if (last && last.key === k) last.items.push(d); else days.push({ key: k, items: [d] });
  }

  const exportCsv = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    if (view === 'parcels') {
      exportToCSV(
        parcelRows.map(({ parcel: p, deposit: d }) => ({ colis: p.parcel_no, depot: d.deposit_no, recu_le: fmtDT(depositDate(d)), client: d.client ? clientFullName(d.client) : '', code: d.client?.customer_code ?? '', lieu: labels.location(d.location), type: labels.kind(p.kind), contenu: p.description ?? '', bordereau: p.courier_waybill ?? '', poids_kg: p.weight_kg ?? '', volume_m3: p.cbm ?? '', photos: parcelPhotoPaths(p).length, etat: parcelStage(p, d.location).label })),
        [{ key: 'colis', header: 'N° colis' }, { key: 'depot', header: 'Dépôt' }, { key: 'recu_le', header: 'Reçu le' }, { key: 'client', header: 'Client' }, { key: 'code', header: 'Code' }, { key: 'lieu', header: 'Lieu' }, { key: 'type', header: 'Type' }, { key: 'contenu', header: 'Contenu' }, { key: 'bordereau', header: 'Bordereau' }, { key: 'poids_kg', header: 'Poids (kg)' }, { key: 'volume_m3', header: 'Volume (m³)' }, { key: 'photos', header: 'Photos' }, { key: 'etat', header: 'État' }],
        `bonzini-reception-colis-${stamp}.csv`,
      );
      return;
    }
    if (view === 'packages') {
      exportToCSV(
        pkList.map((k) => ({ paquet: k.package_no, etat: packageStatusMeta(k.status).label, colis: k.parcel_count, clients: k.client_count, poids_kg: Number(k.net_weight_kg), pese_kg: k.gross_weight_kg ?? '', lta: k.awb_number ?? '', vol: k.flight_no ?? '', refus: k.refusal_reason ?? '' })),
        [{ key: 'paquet', header: 'Paquet' }, { key: 'etat', header: 'État' }, { key: 'colis', header: 'Colis' }, { key: 'clients', header: 'Clients' }, { key: 'poids_kg', header: 'Poids des colis (kg)' }, { key: 'pese_kg', header: 'Poids pesé (kg)' }, { key: 'lta', header: 'LTA' }, { key: 'vol', header: 'Vol' }, { key: 'refus', header: "Motif du refus à l'aéroport" }],
        `bonzini-paquets-avion-${stamp}.csv`,
      );
      return;
    }
    exportToCSV(
      deposits.map((d) => ({ numero: d.deposit_no, date: fmtDT(depositDate(d)), client: d.client ? clientFullName(d.client) : '', code: d.client?.customer_code ?? '', lieu: labels.location(d.location), apporte_par: labels.broughtBy(d.brought_by), fournisseur: d.supplier_name ?? '', colis: d.parcels.length, poids_kg: Number(d.total_weight_kg), volume_m3: Number(d.total_cbm), recu_par: d.received_by_name ?? '', etat: d.status === 'cancelled' ? `Supprimé : ${d.cancel_reason ?? ''}` : labels.status(d).label, devis: d.quote_no ?? '', devis_total_xaf: d.quote_total_xaf ?? '' })),
      [{ key: 'numero', header: 'N°' }, { key: 'date', header: 'Reçu le' }, { key: 'client', header: 'Client' }, { key: 'code', header: 'Code' }, { key: 'lieu', header: 'Lieu' }, { key: 'apporte_par', header: 'Apporté par' }, { key: 'fournisseur', header: 'Fournisseur' }, { key: 'colis', header: 'Colis' }, { key: 'poids_kg', header: 'Poids (kg)' }, { key: 'volume_m3', header: 'Volume (m³)' }, { key: 'recu_par', header: 'Reçu par' }, { key: 'etat', header: 'État' }, { key: 'devis', header: 'Devis' }, { key: 'devis_total_xaf', header: 'Total devis (XAF)' }],
      `bonzini-reception-depots-${stamp}.csv`,
    );
  };

  const openDeposit = (d: Deposit, p?: Parcel) => navigate(`/m/cargo/reception/${d.id}${p ? `?colis=${p.id}` : ''}`);
  const pkRow = (k: AirPackage) => {
    const meta = packageStatusMeta(k.status);
    return (
      <ItemRow
        key={k.id}
        leading={<IconCircle icon={Package} />}
        title={<span className="tabular-nums">{k.package_no}</span>}
        subtitle={[fmtKg1(packageKg(k)), `${k.parcel_count} colis`, k.flight_no].filter(Boolean).join(' · ')}
        tag={{ tone: meta.tone, label: meta.label }}
        onClick={hasPermission('canReceiveParcels') ? () => navigate(`/r/paquets/${k.id}`) : k.air_shipment_id ? () => navigate(`/m/cargo/avion/${k.air_shipment_id}`) : undefined}
      />
    );
  };
  const filters = [
    period !== 'stock' ? PERIODS.find((p) => p.value === period)!.label : null,
    where !== 'all' ? WHERE.find((w) => w.value === where)!.label : null,
    receivedBy ? `par ${staff.find((s) => s.id === receivedBy)?.name ?? '…'}` : null,
  ].filter(Boolean);

  return (
    <div className={cn('flex min-h-[100dvh] flex-col pb-6', SURFACE.canvas)}>
      <ScreenTop title="Réception" backTo="/m/cargo" right={<MoreButton onClick={() => setMore(true)} />} />
      <div className="space-y-3 px-5 pt-4">
        <SearchBox value={query} onChange={setQuery} placeholder={view === 'packages' ? 'PQ, LTA, vol' : 'RC, BZ, client, bordereau'} />
        <FitSegmented value={view} onChange={setView} ariaLabel="Vue" options={[{ value: 'deposits', label: 'Dépôts' }, { value: 'parcels', label: 'Colis' }, { value: 'packages', label: 'Paquets' }]} />
      </div>
      {view !== 'packages' && (
        <ChipRow className="pt-3" value={queue} onChange={setQueue} options={QUEUES.map((q) => ({ value: q.value, label: q.label, count: q.value === 'all' ? undefined : count(q.value) || undefined }))} />
      )}
      {filters.length > 0 && view !== 'packages' && (
        <div className="flex items-center justify-between gap-3 px-5 pt-3">
          <span className={cn('truncate text-[15px]', TEXT.muted)}>{filters.join(' · ')}</span>
          <RowButton link onClick={() => { setPeriod('stock'); setWhere('all'); setReceivedBy(null); }}>Effacer</RowButton>
        </div>
      )}

      {view === 'packages' ? (
        packages.isLoading ? <ScreenLoader /> : (
          <>
            {loose > 0 && hasPermission('canViewCargo') && (
              <div className="px-5 pt-4">
                <div className="flex items-center gap-3 rounded-lg border border-[#D9D9D9] px-4 py-3.5 dark:border-[#444444]">
                  <Plane className={cn('h-6 w-6 shrink-0', TEXT.strong)} aria-hidden />
                  <span className={cn('min-w-0 flex-1 truncate text-[17px] font-semibold', TEXT.strong)}>{loose} sans vol</span>
                  <RowButton link onClick={() => setShipOpen(true)}>Mettre sur un vol</RowButton>
                </div>
              </div>
            )}
            {pkList.length === 0 ? <EmptyLine>Aucun paquet.</EmptyLine> : <ItemList className="pt-2">{pkList.map(pkRow)}</ItemList>}
          </>
        )
      ) : board.isLoading ? <ScreenLoader /> : board.error ? (
        <EmptyLine action={{ label: 'Réessayer', onClick: () => void board.refetch() }}>{(board.error as Error).message}</EmptyLine>
      ) : view === 'parcels' ? (
        parcelRows.length === 0 ? <EmptyLine>Aucun colis.</EmptyLine> : (
          <ItemList className="pt-2">
            {parcelRows.slice(0, 200).map(({ parcel: p, deposit: d }) => {
              const st = parcelStage(p, d.location);
              return (
                <ItemRow
                  key={p.id}
                  leading={<ParcelThumb path={p.photo_path} />}
                  title={<span className="tabular-nums">{p.parcel_no}</span>}
                  subtitle={[p.description || labels.kind(p.kind), p.weight_kg != null ? formatKg(p.weight_kg) : 'sans poids', d.client ? clientFullName(d.client) : 'sans client'].join(' · ')}
                  tag={{ tone: st.tone === 'info' ? 'info' : st.tone, label: st.label }}
                  onClick={() => openDeposit(d, p)}
                />
              );
            })}
          </ItemList>
        )
      ) : deposits.length === 0 ? <EmptyLine>{query ? 'Rien ne correspond.' : 'Aucun dépôt.'}</EmptyLine> : (
        <>
          {days.map((g) => (
            <section key={g.key}>
              <DayLabel>{g.key} · {g.items.length} dépôt{g.items.length > 1 ? 's' : ''} · {g.items.reduce((s, d) => s + d.parcels.length, 0)} colis</DayLabel>
              <ItemList>
                {g.items.map((d) => {
                  const tag = depositTag(d);
                  const total = Number(d.quote_total_xaf ?? 0); const paid = Number(d.quote_paid_xaf ?? 0);
                  return (
                    <ItemRow
                      key={d.id}
                      leading={d.client ? <Initials name={clientFullName(d.client)} /> : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F5F5F5] text-[18px] font-semibold text-[#1E1E1E] dark:bg-[#383838] dark:text-[#F5F5F5]">?</span>}
                      title={d.client ? clientFullName(d.client) : 'Sans client'}
                      subtitle={[d.deposit_no, `${d.parcels.length} colis`, Number(d.total_weight_kg) > 0 ? formatKg(d.total_weight_kg) : null, !d.client ? d.received_by_name : null].filter(Boolean).join(' · ')}
                      amount={d.client && total > 0 ? short(paid > 0 && paid < total ? total - paid : total) : d.client ? '—' : undefined}
                      tag={tag}
                      onClick={() => openDeposit(d)}
                    />
                  );
                })}
              </ItemList>
            </section>
          ))}
          {board.data?.truncated && <p className={cn('px-5 pt-4 text-[15px]', TEXT.muted)}>Les 500 plus récents</p>}
        </>
      )}

      <ActionSheet
        open={more}
        onClose={() => setMore(false)}
        actions={[
          { label: 'Période', hint: PERIODS.find((p) => p.value === period)!.label, icon: CalendarRange, onClick: () => { setMore(false); setSheet('period'); } },
          { label: 'Lieu', hint: WHERE.find((w) => w.value === where)!.label, icon: MapPin, onClick: () => { setMore(false); setSheet('where'); } },
          { label: 'Reçu par', hint: receivedBy ? staff.find((s) => s.id === receivedBy)?.name : 'Tout le monde', icon: UserRound, onClick: () => { setMore(false); setSheet('by'); } },
          { label: 'Par client', icon: Users, onClick: () => { setMore(false); setSheet('clients'); } },
          { label: 'Photos', icon: Images, onClick: () => { setMore(false); setSheet('photos'); } },
          { label: 'Réceptionnaires', icon: UserRound, onClick: () => { setMore(false); setSheet('staff'); } },
          { label: 'Langue des devis', hint: CARGO_DOC_LANG_LABEL[docLang], icon: Languages, onClick: () => { setMore(false); setSheet('lang'); } },
          { label: 'Exporter en CSV', icon: Download, onClick: () => { setMore(false); exportCsv(); } },
          { label: 'Comptes cargo', icon: Globe2, onClick: () => navigate('/m/cargo/comptes') },
          { label: 'À Douala', icon: Warehouse, hidden: !seesDouala, onClick: () => { setMore(false); setSheet('douala'); } },
        ]}
      />

      <BottomSheet open={sheet === 'period'} onClose={() => setSheet(null)} title="Période">
        {PERIODS.map((p) => <RadioRow key={p.value} selected={period === p.value} onClick={() => { setPeriod(p.value); setSheet(null); }} title={p.label} />)}
      </BottomSheet>
      <BottomSheet open={sheet === 'where'} onClose={() => setSheet(null)} title="Lieu">
        {WHERE.map((w) => <RadioRow key={w.value} selected={where === w.value} onClick={() => { setWhere(w.value); setSheet(null); }} title={w.label} />)}
      </BottomSheet>
      <BottomSheet open={sheet === 'by'} onClose={() => setSheet(null)} title="Reçu par">
        <RadioRow selected={!receivedBy} onClick={() => { setReceivedBy(null); setSheet(null); }} title="Tout le monde" />
        {staff.map((s) => <RadioRow key={s.id} selected={receivedBy === s.id} onClick={() => { setReceivedBy(s.id); setSheet(null); }} title={s.name} hint={`${s.deposits} dépôts · ${s.parcels} colis`} />)}
      </BottomSheet>
      <BottomSheet open={sheet === 'lang'} onClose={() => setSheet(null)} title="Langue des devis">
        {CARGO_DOC_LANGS.map((l) => <RadioRow key={l} selected={docLang === l} onClick={() => { setDocLang(l); setSheet(null); }} title={CARGO_DOC_LANG_LABEL[l]} />)}
      </BottomSheet>
      <BottomSheet open={sheet === 'staff'} onClose={() => setSheet(null)} title="Réceptionnaires">
        {staff.length === 0 ? <EmptyLine>Personne sur la période.</EmptyLine> : staff.map((r) => (
          <ItemRow key={r.id} leading={<Initials name={r.name} />} title={r.name}
            subtitle={[`${r.deposits} dépôts`, `${r.parcels} colis`, formatKg(r.kg), r.incomplete ? `${r.incomplete} incomplets` : null, r.pending ? `${r.pending} à attribuer` : null].filter(Boolean).join(' · ')}
            onClick={() => { setReceivedBy(r.id); setSheet(null); }} />
        ))}
      </BottomSheet>
      <BottomSheet open={sheet === 'clients'} onClose={() => setSheet(null)} title="Par client">
        {stock.data?.stats && (
          <KVBox className="mb-2" rows={[
            { label: 'Colis qui attendent', value: stock.data.stats.parcels },
            { label: 'Poids · volume', value: `${formatKg(stock.data.stats.weight_kg)} · ${formatCbm(stock.data.stats.cbm)}` },
          ]} />
        )}
        {(stock.data?.by_client ?? []).map((row, i) => {
          const name = row.client ? clientFullName(row.client) : 'Client à attribuer';
          return (
            <ItemRow key={`${row.client?.user_id ?? 'none'}-${row.location}-${i}`} leading={<Initials name={name} />} title={name}
              subtitle={[labels.location(row.location), `${row.parcels} colis`, formatKg(row.weight_kg), formatCbm(row.cbm)].join(' · ')}
              onClick={row.client ? () => navigate(`/m/clients/${row.client!.user_id}/parcels`) : () => { setQueue('pending'); setSheet(null); }} chevron />
          );
        })}
      </BottomSheet>
      <BottomSheet open={sheet === 'photos'} onClose={() => setSheet(null)} title="Photos">
        <div className="grid grid-cols-3 gap-2.5">
          {parcelRows.slice(0, 60).map(({ parcel: p, deposit: d }) => (
            <button key={p.id} type="button" onClick={() => openDeposit(d, p)} className="min-w-0 text-left">
              <ParcelThumb path={p.photo_path} size="aspect-square h-auto w-full" />
              <span className={cn('mt-1 block truncate text-[14px] tabular-nums', TEXT.muted)}>{p.parcel_no}</span>
            </button>
          ))}
        </div>
      </BottomSheet>
      <BottomSheet open={sheet === 'douala'} onClose={() => setSheet(null)} title="À Douala">
        {!douala.data ? <ScreenLoader className="min-h-[120px]" /> : (
          <>
            <KVBox rows={[
              { label: 'À pointer', value: douala.data.stats.to_checkin },
              { label: 'Attendent leur client', value: douala.data.stats.waiting },
              { label: "Remis aujourd'hui", value: douala.data.stats.delivered_today, tone: 'success' },
              { label: 'Manquants', value: douala.data.stats.missing, tone: douala.data.stats.missing > 0 ? 'danger' : undefined },
            ]} />
            {douala.data.waiting_by_client.slice(0, 5).map((w) => (
              <ItemRow key={w.client?.user_id ?? 'none'} leading={<Initials name={w.client ? clientFullName(w.client) : '?'} />} title={w.client ? clientFullName(w.client) : 'Client à attribuer'}
                subtitle={`${w.parcels} colis · ${formatKg(w.weight_kg)}`} tag={w.unpaid ? { tone: 'pending', label: 'À encaisser' } : { tone: 'success', label: 'Payé' }} />
            ))}
            <ItemList className="-mx-5 pt-2">
              <ItemRow leading={<IconCircle icon={Warehouse} />} title="Ouvrir l'app Entrepôt" onClick={() => navigate('/w')} chevron />
            </ItemList>
          </>
        )}
      </BottomSheet>
      <ShipSheet open={shipOpen} onClose={() => setShipOpen(false)} />
    </div>
  );
}
