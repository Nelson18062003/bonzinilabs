/**
 * Mobile admin — le dossier d'un conteneur (refonte v2, maquettes 04/02,
 * 04/03, 04/04, 10/34, 10/35).
 *
 * En tête : le trajet (départ → arrivée, le navire, la barre d'avancement),
 * l'arrivée retenue avec son retard, et trois tags qui se touchent : Télex et
 * Fret (feuille de confirmation), BESC (la douane). Puis quatre onglets :
 *   · Suivi — les escales, la position, l'arrivée retenue, puis la douane ;
 *   · Documents — le classeur, puis les intervenants ;
 *   · Colis — les clients du groupage, les lots, le chargement ;
 *   · Coûts — les coûts justifiés et le coût à quai.
 * Ce qui est rare (corriger l'arrivée, la position, les escales, le navire,
 * marquer arrivé, l'avis d'expédition, la note, retirer) est dans « … ».
 *
 * L'adresse suit l'onglet (/m/cargo/:id/:onglet) ; les anciennes adresses
 * (sections du mobile, onglets de l'ordinateur) restent valables.
 */
import { toast } from 'sonner';
import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  Boxes, CalendarCheck, ExternalLink, FileText, Flag, Landmark, Map as MapIcon, MapPin, NotebookPen, RefreshCw, Route, Ship, Trash2, Undo2, Users,
} from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import {
  useCargoEvents, useCargoShipment, useCargoVesselPositions, useRemoveCargoShipment, useRequestCargoSync, useUpdateCargoShipment,
} from '@/hooks/useCargo';
import { useShipmentParcels } from '@/hooks/useReception';
import { deliverSeaNoticePdf } from '@/lib/shippingNoticePdf';
import { clientFullName, formatCbm } from '@/lib/reception';
import { TabChargement, TabClient, TabDouane, TabIntervenants } from '@/components/cargo/dossier';
import { DossierDocs } from './DossierDocs';
import { DossierCosts } from './DossierCosts';
import { dedupeEvents } from '@/components/cargo/dossier/TabSuivi';
import { CallsDialog, EtaDialog, MarkArrivedDialog, PositionDialog, UnmarkArrivedDialog } from '@/components/cargo/dossier/VoyageDialogs';
import { MobileNotes } from './MobileNotes';
import { MobileNavireSheet } from './MobileNavire';
import { groupVessels } from '@/lib/cargo/vessels';
import { agoSentence, customsSentence } from '@/lib/cargo/plain';
import {
  CARRIER_LABEL, arrivalPort, bestEta, bestEtd, etaSlipDays, fmtDay, fmtUsd, fromDate, hasArrived, liveVesselUrl, positionAge,
  timelineFromEvents, voyageProgress,
} from '@/lib/cargo/model';
import type { CargoShipment, CargoVesselPosition } from '@/lib/cargo/model';
import { callDate, callStates, voyageCalls, type CallState, type RouteCall } from '@/lib/cargo/voyage';
import { copyToClipboard } from '@/lib/clipboard';
import { cn } from '@/lib/utils';
import {
  ActionSheet, BottomSheet, ConfirmSheet, Dock, BigButton, Initials, ItemList, ItemRow, KVBox, MoreButton, ScreenError,
  ScreenLoader, ScreenTop, Tag, TEXT, EmptyLine, useSheet, IconCircle, type SheetAction,
} from '@/mobile/designKit';
import { CapsLabel, FitSegmented, StateCircle } from '@/mobile/components/cargo/v2';
import { boxNo } from './fleet';

type TabKey = 'suivi' | 'documents' | 'colis' | 'couts';
const TABS: ReadonlyArray<{ value: TabKey; label: string }> = [
  { value: 'suivi', label: 'Suivi' },
  { value: 'documents', label: 'Documents' },
  { value: 'colis', label: 'Colis' },
  { value: 'couts', label: 'Coûts' },
];
/** Les adresses d'avant (sections du mobile, onglets de l'ordinateur) mènent au bon onglet. */
const ALIAS: Record<string, TabKey> = {
  suivi: 'suivi', apercu: 'suivi', afaire: 'suivi', ou: 'suivi', trajet: 'suivi', argent: 'suivi', douane: 'suivi', notes: 'suivi',
  documents: 'documents', papiers: 'documents', intervenants: 'documents',
  colis: 'colis', dedans: 'colis', chargement: 'colis', client: 'colis',
  couts: 'couts',
};
const tabPath = (id: string, t: TabKey) => (t === 'suivi' ? `/m/cargo/${id}` : `/m/cargo/${id}/${t}`);

/* ── L'en-tête du voyage ─────────────────────────────────────────────── */
function VoyageHead({ s, onTag }: { s: CargoShipment; onTag: (t: 'telex' | 'fret' | 'besc') => void }) {
  const etd = bestEtd(s);
  const eta = bestEta(s);
  const slip = etaSlipDays(s);
  const promised = fromDate(s.eta_promised);
  const prog = voyageProgress(s);
  const pct = hasArrived(s.status) ? 100 : prog?.pct ?? (s.etd_actual ? 50 : 0);
  const besc = !!s.besc_number;
  const tagBtn = 'rounded-md active:opacity-70';
  return (
    <div className="px-5 pt-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={cn('truncate text-[24px] font-bold leading-tight', TEXT.strong)}>{s.pol_name ?? 'Départ'}</p>
          <p className={cn('text-[16px]', TEXT.muted)}>{s.etd_actual ? `parti le ${fmtDay(etd)}` : etd ? `départ prévu ${fmtDay(etd)}` : 'pas encore parti'}</p>
        </div>
        <div className="min-w-0 text-right">
          <p className={cn('truncate text-[24px] font-bold leading-tight', TEXT.strong)}>{arrivalPort(s)}</p>
          <p className={cn('truncate text-[16px] uppercase', TEXT.muted)}>{s.vessel_name ?? CARRIER_LABEL[s.carrier] ?? s.carrier}</p>
        </div>
      </div>
      {/* La ligne du voyage : le navire avance de gauche à droite. */}
      <div className="relative mt-4 h-9" aria-hidden>
        <div className="absolute inset-x-1.5 top-1/2 h-[3px] -translate-y-1/2 bg-[#D9D9D9] dark:bg-[#444444]" />
        <div className="absolute left-1.5 top-1/2 h-[3px] -translate-y-1/2 bg-[#2C2C2C] dark:bg-[#E3E3E3]" style={{ width: `calc(${pct}% - 12px)` }} />
        <span className="absolute left-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-[#2C2C2C] dark:bg-[#E3E3E3]" />
        <span className="absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-[3px] border-[#D9D9D9] bg-white dark:border-[#444444] dark:bg-[#1E1E1E]" />
        {pct > 0 && pct < 100 && (
          <span className="absolute top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#2C2C2C] text-[#F5F5F5] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]" style={{ left: `${pct}%` }}>
            <Ship className="h-5 w-5" />
          </span>
        )}
      </div>
      <p className={cn('mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[17px]', TEXT.body)}>
        {hasArrived(s.status) ? 'Arrivé le' : 'Arrive le'} <b className={cn('font-bold', TEXT.strong)}>{fmtDay(eta.date)}</b>
        {slip > 0 && <Tag tone="danger">+{slip} j</Tag>}
        {slip > 0 && promised && <span className={TEXT.muted}>promis le {promised.getDate()}</span>}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={tagBtn} onClick={() => onTag('telex')}><Tag tone={s.telex_released ? 'success' : 'pending'} className="py-2 text-[15px]">{s.telex_released ? 'Télex reçu' : 'Télex attendu'}</Tag></button>
        <button type="button" className={tagBtn} onClick={() => onTag('fret')}><Tag tone={s.freight_paid ? 'success' : 'pending'} className="py-2 text-[15px]">{s.freight_paid ? 'Fret réglé' : 'Fret à régler'}</Tag></button>
        {(s.pod_unlocode === 'CMKBI' || s.pod_unlocode === 'CMDLA') && (
          <button type="button" className={tagBtn} onClick={() => onTag('besc')}><Tag tone={besc ? 'success' : 'pending'} className="py-2 text-[15px]">{besc ? 'BESC fait' : 'BESC à faire'}</Tag></button>
        )}
      </div>
    </div>
  );
}

/* ── Onglet Suivi ────────────────────────────────────────────────────── */
const callKind = (i: number, n: number) => (i === 0 ? 'Départ' : i === n - 1 ? 'Arrivée' : 'Escale');
function callLine(c: RouteCall, state: CallState, i: number, n: number, s: CargoShipment): string {
  const kind = callKind(i, n);
  if (state === 'done') return `${kind} · ${fmtDay(callDate(i === 0 ? c.atd : c.ata ?? c.atd))}`;
  if (state === 'here') return `${kind} · depuis le ${fmtDay(callDate(c.ata))}`;
  if (i === n - 1) return `${kind} · ${bestEta(s).source === 'manual' ? 'relevée' : bestEta(s).source === 'promised' ? 'promise' : 'armateur'}`;
  return `${kind}${c.eta ? ` · prévu le ${fmtDay(callDate(c.eta))}` : ''}`;
}

function SuiviTab({ s, pos, onPosition, onEta, onJournal, onDouane, canManage }: { s: CargoShipment; pos: CargoVesselPosition | null; onPosition: () => void; onEta: () => void; onJournal: () => void; onDouane: () => void; canManage: boolean }) {
  const calls = voyageCalls(s);
  const states = callStates(calls);
  const eta = bestEta(s);
  const etaSrc = eta.source === 'manual' ? 'équipe' : eta.source === 'promised' ? 'promise' : 'armateur';
  return (
    <>
      <ItemList className="pt-2">
        {calls.map((c, i) => {
          const st = states[i];
          const last = i === calls.length - 1;
          const lead = st === 'done' ? <StateCircle state="done" /> : st === 'here' ? <StateCircle state="here" icon={Ship} /> : last ? <IconCircle icon={Flag} /> : <StateCircle state="todo" />;
          const right = st === 'done' ? { tag: { tone: 'success' as const, label: 'Fait' } } : st === 'here' ? { tag: { tone: 'pending' as const, label: 'Ici' } } : st === 'after' ? { tag: { tone: 'neutral' as const, label: 'Après' } } : last ? { amount: fmtDay(eta.date) } : { amount: c.eta ? fmtDay(callDate(c.eta)) : undefined };
          return (
            <ItemRow key={c.id} leading={lead} title={c.name} subtitle={callLine(c, st, i, calls.length, s)} {...right} onClick={onJournal} />
          );
        })}
      </ItemList>
      <div className="px-5 pt-4">
        <KVBox
          rows={[
            { label: 'Position', value: pos ? `${pos.note ?? (s.status === 'AT_SEA' ? 'En mer' : '—')} · ${positionAge(pos)}` : 'Inconnue', onClick: onPosition },
            { label: 'Arrivée retenue', value: `${fmtDay(eta.date)} · ${etaSrc}`, onClick: canManage ? onEta : onJournal },
          ]}
        />
      </div>
      <ItemList className="pt-3">
        <ItemRow leading={<IconCircle icon={Landmark} />} title="Douane et arrivée" subtitle={customsSentence(s)} onClick={onDouane} chevron />
      </ItemList>
    </>
  );
}

/* ── Onglet Colis ────────────────────────────────────────────────────── */
function ColisTab({ s, canManage, onSheet }: { s: CargoShipment; canManage: boolean; onSheet: (k: 'lots' | '3d') => void }) {
  const navigate = useNavigate();
  const { data: loaded } = useShipmentParcels(s.id);
  const groups = useMemo(() => {
    const by = new Map<string, { name: string; deposits: Set<string>; parcels: number; cbm: number }>();
    for (const p of loaded ?? []) {
      const key = p.client?.user_id ?? 'none';
      const g = by.get(key) ?? { name: p.client ? clientFullName(p.client) : 'Sans client', deposits: new Set<string>(), parcels: 0, cbm: 0 };
      g.deposits.add(p.deposit_no); g.parcels += 1; g.cbm += Number(p.cbm ?? 0);
      by.set(key, g);
    }
    return [...by.values()].sort((a, b) => b.cbm - a.cbm);
  }, [loaded]);
  const parcels = loaded?.length ?? 0;
  const cbm = groups.reduce((a, g) => a + g.cbm, 0);
  return (
    <>
      <div className="px-5 pt-5"><CapsLabel>{groups.length} client{groups.length > 1 ? 's' : ''} · {parcels} colis · {formatCbm(cbm)}</CapsLabel></div>
      {groups.length === 0 ? (
        <EmptyLine>Aucun colis reçu dans cette boîte.</EmptyLine>
      ) : (
        <ItemList>
          {groups.map((g) => (
            <ItemRow
              key={g.name}
              leading={<Initials name={g.name} />}
              title={g.name}
              subtitle={`${[...g.deposits].slice(0, 2).join(', ')}${g.deposits.size > 2 ? '…' : ''} · ${g.parcels} colis`}
              amount={formatCbm(g.cbm)}
              right={<span className={cn('-ml-2 w-12 shrink-0 text-right text-[15px] tabular-nums', TEXT.muted)}>{cbm > 0 ? `${Math.round((g.cbm / cbm) * 100)} %` : ''}</span>}
            />
          ))}
        </ItemList>
      )}
      <ItemList className="pt-3">
        <ItemRow leading={<IconCircle icon={Users} />} title="Lots et groupage" subtitle="Propriétaires, part du fret, rattacher" onClick={() => onSheet('lots')} chevron />
        <ItemRow leading={<IconCircle icon={Boxes} />} title="Chargement en 3D" subtitle="Lots, remplissage, sortir un colis" onClick={() => onSheet('3d')} chevron />
      </ItemList>
    </>
  );
}

/* ── Le journal de l'armateur (toucher une escale) ───────────────────── */
function JournalSheet({ s, open, onClose }: { s: CargoShipment; open: boolean; onClose: () => void }) {
  const { data: events } = useCargoEvents(open ? s.id : null);
  const { kept, etaHistory } = useMemo(() => dedupeEvents(events ?? []), [events]);
  const items = useMemo(() => timelineFromEvents(kept).reverse(), [kept]);
  return (
    <BottomSheet open={open} onClose={onClose} title="Le voyage">
      {s.last_event_label && <KVBox rows={[{ label: 'Dernier mouvement', value: `${s.last_event_label}${s.last_event_at ? ` · ${fmtDay(new Date(s.last_event_at))}` : ''}` }]} />}
      <CapsLabel className="mt-5">Jalons de l'armateur</CapsLabel>
      {items.length === 0 ? <p className={cn('py-4 text-[16px]', TEXT.muted)}>Aucun jalon reçu.</p> : (
        <div>
          {items.map((e) => (
            <ItemRow key={e.id} leading={<StateCircle state={e.classifier === 'ACT' ? 'done' : 'todo'} />} title={e.label} subtitle={`${e.location ?? '—'} · ${fmtDay(new Date(e.time))}`} tag={e.classifier === 'ACT' ? undefined : { tone: 'neutral', label: 'Prévu' }} />
          ))}
        </div>
      )}
      {etaHistory.length > 1 && (
        <>
          <CapsLabel className="mt-5">Estimations successives</CapsLabel>
          <KVBox className="mt-2" rows={etaHistory.map((e) => ({ label: `Reçue le ${fmtDay(new Date(e.created_at))}`, value: fmtDay(new Date(e.event_time)) }))} />
        </>
      )}
    </BottomSheet>
  );
}

function PositionSheet({ s, pos, open, onClose, onUpdate, canManage }: { s: CargoShipment; pos: CargoVesselPosition | null; open: boolean; onClose: () => void; onUpdate: () => void; canManage: boolean }) {
  const navigate = useNavigate();
  const live = liveVesselUrl(s.vessel_imo);
  return (
    <ActionSheet
      open={open}
      onClose={onClose}
      title={pos ? `${pos.note ?? s.vessel_name ?? 'Position'} · ${positionAge(pos)}` : 'Position inconnue'}
      actions={[
        { label: 'Voir en direct', hint: 'MarineTraffic', icon: ExternalLink, onClick: () => { if (live) window.open(live, '_blank', 'noopener,noreferrer'); }, hidden: !live },
        { label: 'Voir sur la carte', icon: MapIcon, onClick: () => navigate(`/m/cargo/map?vessel=${encodeURIComponent(s.vessel_imo ?? '')}`), hidden: !pos || !s.vessel_imo },
        { label: 'Mettre à jour la position', icon: MapPin, onClick: onUpdate, hidden: !canManage },
      ]}
    />
  );
}

export function MobileCargoDossier() {
  const { hasPermission } = useAdminAuth();
  const navigate = useNavigate();
  const { shipmentId, tab: raw } = useParams<{ shipmentId: string; tab?: string }>();
  const tab: TabKey = raw ? ALIAS[raw] ?? 'suivi' : 'suivi';
  const canManage = hasPermission('canManageCargo');
  const { data: s, isLoading, error } = useCargoShipment(shipmentId ?? null);
  const { data: positions } = useCargoVesselPositions();
  const { data: loaded } = useShipmentParcels(shipmentId ?? null);
  const update = useUpdateCargoShipment();
  const remove = useRemoveCargoShipment();
  const sync = useRequestCargoSync();
  const pos = useMemo(() => (s ? groupVessels([s], positions ?? [])[0]?.position ?? null : null), [s, positions]);
  const more = useSheet();
  const [dialog, setDialog] = useState<'eta' | 'position' | 'calls' | 'arrived' | 'unarrived' | 'vessel' | 'notes' | 'remove' | 'journal' | 'where' | 'telex' | 'fret' | 'douane' | 'parties' | 'lots' | '3d' | null>(null);
  const close = () => setDialog(null);

  if (!hasPermission('canViewCargo')) return <Navigate to="/m" replace />;
  if (!shipmentId) return <Navigate to="/m/cargo" replace />;

  const goTab = (t: TabKey) => navigate(tabPath(shipmentId, t), { replace: true });
  const onTag = (t: 'telex' | 'fret' | 'besc') => {
    if (t === 'besc') { setDialog('douane'); return; }
    if (canManage) setDialog(t);
  };
  const notice = () => {
    if (!s) return;
    void deliverSeaNoticePdf(s, loaded ?? []).then((o) => { if (o === 'downloaded') toast.success('Avis d’expédition téléchargé'); }).catch((e: Error) => toast.error(e.message));
  };

  const actions: SheetAction[] = s ? [
    { label: 'Rafraîchir', hint: s.last_synced_at ? `Armateur interrogé ${agoSentence(s.last_synced_at)}` : 'Interroger l’armateur', icon: RefreshCw, onClick: () => sync.mutate() },
    { label: 'Corriger l’arrivée', icon: CalendarCheck, onClick: () => setDialog('eta'), hidden: !canManage },
    { label: 'Mettre à jour la position', icon: MapPin, onClick: () => setDialog('position'), hidden: !canManage },
    { label: 'Modifier les escales', icon: Route, onClick: () => setDialog('calls'), hidden: !canManage },
    { label: 'Navire et voyage', hint: s.vessel_name ? `${s.vessel_name}${s.voyage ? ` · ${s.voyage}` : ''}` : 'À renseigner', icon: Ship, onClick: () => setDialog('vessel'), hidden: !canManage },
    { label: 'Marquer arrivé', icon: Flag, onClick: () => setDialog('arrived'), hidden: !canManage || hasArrived(s.status) || !(s.status === 'AT_SEA' || !!s.etd_actual) },
    { label: 'Annuler l’arrivée', icon: Undo2, onClick: () => setDialog('unarrived'), hidden: !canManage || s.status !== 'ARRIVED' },
    { label: 'Avis d’expédition (PDF)', icon: FileText, onClick: notice, disabled: (loaded?.length ?? 0) === 0 },
    { label: 'Note interne', hint: s.notes ? s.notes.slice(0, 40) : undefined, icon: NotebookPen, onClick: () => setDialog('notes') },
    { label: 'Retirer de la flotte', icon: Trash2, danger: true, onClick: () => setDialog('remove'), hidden: !canManage },
  ] : [];

  return (
    <div className="flex min-h-full flex-col pb-8">
      <ScreenTop
        title={s ? <button type="button" onClick={() => copyToClipboard(s.container_number, 'Numéro de conteneur')} className="max-w-full truncate text-left tabular-nums">{boxNo(s.container_number)}</button> : 'Conteneur'}
        backTo="/m/cargo"
        right={s ? <MoreButton onClick={more.show} /> : undefined}
      />

      {isLoading && <ScreenLoader />}
      {error && <ScreenError title="Dossier introuvable" description={(error as Error).message} />}
      {!isLoading && !error && !s && <ScreenError title="Dossier introuvable" description="Ce conteneur n'est plus dans la flotte." />}

      {s && (
        <>
          <VoyageHead s={s} onTag={onTag} />
          <div className="px-5 pt-4">
            <FitSegmented<TabKey> ariaLabel="Parties du dossier" options={TABS} value={tab} onChange={goTab} />
          </div>

          {tab === 'suivi' && <SuiviTab s={s} pos={pos} canManage={canManage} onPosition={() => setDialog('where')} onEta={() => setDialog('eta')} onJournal={() => setDialog('journal')} onDouane={() => setDialog('douane')} />}
          {tab === 'documents' && (
            <>
              <DossierDocs s={s} canManage={canManage} />
              <ItemList className="pt-1">
                <ItemRow leading={<IconCircle icon={Users} />} title="Intervenants" subtitle="Transitaire, déclarante, destinataire" onClick={() => setDialog('parties')} chevron />
              </ItemList>
            </>
          )}
          {tab === 'colis' && <ColisTab s={s} canManage={canManage} onSheet={(k) => setDialog(k)} />}
          {tab === 'couts' && <DossierCosts s={s} canManage={canManage} />}

          <BottomSheet open={dialog === 'douane'} onClose={close} title="Douane et arrivée"><TabDouane shipment={s} canManage={canManage} /></BottomSheet>
          <BottomSheet open={dialog === 'parties'} onClose={close} title="Intervenants"><TabIntervenants shipment={s} canManage={canManage} /></BottomSheet>
          <BottomSheet open={dialog === 'lots'} onClose={close} title="Lots et groupage"><TabClient shipment={s} canManage={canManage} /></BottomSheet>
          <BottomSheet open={dialog === '3d'} onClose={close} title="Chargement"><TabChargement shipment={s} canManage={canManage} /></BottomSheet>

          {tab === 'colis' && canManage && (
            <Dock><BigButton onClick={() => navigate(`/m/cargo/${s.id}/charger-colis`)}>Charger des colis reçus</BigButton></Dock>
          )}

          <ActionSheet open={more.open} onClose={more.hide} title={boxNo(s.container_number)} actions={actions} />
          <JournalSheet s={s} open={dialog === 'journal'} onClose={close} />
          <PositionSheet s={s} pos={pos} open={dialog === 'where'} onClose={close} canManage={canManage} onUpdate={() => setDialog('position')} />
          {canManage && <MobileNavireSheet shipment={s} open={dialog === 'vessel'} onClose={close} />}
          <BottomSheet open={dialog === 'notes'} onClose={close} title="Note interne">
            <MobileNotes shipment={s} canManage={canManage} />
          </BottomSheet>
          <ConfirmSheet
            open={dialog === 'fret'}
            onClose={close}
            title={s.freight_paid ? 'Le fret n’est pas réglé ?' : 'Le fret est réglé ?'}
            subtitle={`Au transitaire · ${boxNo(s.container_number)}`}
            rows={[{ label: 'Fret', value: fmtUsd(s.freight_usd) }, { label: 'État', before: s.freight_paid ? 'Réglé' : 'À régler', value: s.freight_paid ? 'À régler' : 'Réglé' }]}
            confirmLabel={s.freight_paid ? 'Marquer non réglé' : 'Marquer réglé'}
            loading={update.isPending}
            onConfirm={() => update.mutate({ id: s.id, patch: { freight_paid: !s.freight_paid } }, { onSuccess: close })}
          />
          <ConfirmSheet
            open={dialog === 'telex'}
            onClose={close}
            title={s.telex_released ? 'Le télex n’est pas reçu ?' : 'Le télex est reçu ?'}
            subtitle={`Sans lui, le conteneur reste au port`}
            rows={[{ label: 'Télex release', before: s.telex_released ? 'Reçu' : 'Attendu', value: s.telex_released ? 'Attendu' : 'Reçu' }]}
            confirmLabel={s.telex_released ? 'Marquer non reçu' : 'Marquer reçu'}
            loading={update.isPending}
            onConfirm={() => update.mutate({ id: s.id, patch: { telex_released: !s.telex_released } }, { onSuccess: close })}
          />
          <ConfirmSheet
            open={dialog === 'remove'}
            danger
            onClose={close}
            title="Retirer ce conteneur ?"
            subtitle={`${boxNo(s.container_number)} · ${s.client_label}`}
            rows={[{ label: 'Jalons, documents, coûts', value: 'Retirés' }]}
            confirmLabel="Retirer de la flotte"
            cancelLabel="Garder"
            loading={remove.isPending}
            onConfirm={() => remove.mutate(s.id, { onSuccess: () => { close(); navigate('/m/cargo'); } })}
          />
          {dialog === 'eta' && <div className="admin-theme"><EtaDialog shipment={s} onClose={close} /></div>}
          {dialog === 'position' && <div className="admin-theme"><PositionDialog shipment={s} position={pos} onClose={close} /></div>}
          {dialog === 'calls' && <div className="admin-theme"><CallsDialog shipment={s} onClose={close} /></div>}
          {dialog === 'arrived' && <div className="admin-theme"><MarkArrivedDialog shipment={s} onClose={close} /></div>}
          {dialog === 'unarrived' && <div className="admin-theme"><UnmarkArrivedDialog shipment={s} onClose={close} /></div>}
        </>
      )}
    </div>
  );
}
