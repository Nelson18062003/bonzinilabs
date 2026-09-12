/**
 * Le dossier d'un conteneur — trois pièces composables :
 *   CargoDossierHeader  n°, statut, client, actions (Rafraîchir, menu ⋯)
 *   CargoDossierBody    où / quand · faits · suivi | carte · documents · note
 *   CargoDossierDialog  la boîte centrée ouverte depuis la flotte
 *   CargoDetail         la page complète (mobile, /m/cargo/:id)
 */
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Circle, Copy, ExternalLink, MoreHorizontal, RefreshCw, Ship, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { TextArea } from '@/components/form';
import { useCargoDocuments, useCargoEvents, useCargoShipment, useCargoVesselPositions, useRemoveCargoShipment, useRequestCargoSync, useUpdateCargoShipment } from '@/hooks/useCargo';
import { CargoMap } from '@/components/cargo/CargoMap';
import { CargoTimeline } from '@/components/cargo/CargoTimeline';
import { CargoDocuments } from '@/components/cargo/CargoDocuments';
import { CargoJourney } from '@/components/cargo/CargoJourney';
import { CargoVesselDialog } from '@/components/cargo/CargoVesselDialog';
import { nextSteps } from '@/lib/cargo/todo';
import { copyToClipboard } from '@/lib/clipboard';
import { groupVessels } from '@/lib/cargo/vessels';
import { LIVE_STATUS_LABEL, vesselLiveStatus } from '@/lib/cargo/geo';
import { CARRIER_LABEL, bestEta, daysUntilArrival, etaSlipDays, fmtDay, fmtDayFull, fmtDayTime, fmtLatLng, fmtUsd, liveVesselUrl, statusMeta, timelineFromEvents, voyageProgress, whereIs } from '@/lib/cargo/model';
import type { CargoShipment } from '@/lib/cargo/model';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, SOFT_PILL, Holder, KV, RefChip, SecLabel, StatusPill, ScreenLoader, CenterDialog, DANGER_SOFT_PILL } from '@/desktop/designKit';

/* ── En-tête + actions ───────────────────────────────────────────────── */

export function CargoDossierHeader({ shipment: s, onRemoved }: { shipment: CargoShipment; onRemoved?: () => void }) {
  const { hasPermission } = useAdminAuth();
  const canManage = hasPermission('canManageCargo');
  const update = useUpdateCargoShipment();
  const remove = useRemoveCargoShipment();
  const sync = useRequestCargoSync();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [vesselOpen, setVesselOpen] = useState(false);
  const meta = statusMeta(s.status);
  const doRemove = () => remove.mutate(s.id, { onSuccess: () => { setConfirmRemove(false); onRemoved?.(); } });

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2.5">
        <RefChip className="text-[13px]">{s.container_number}</RefChip>
        <button type="button" onClick={() => copyToClipboard(s.container_number, 'Numéro de conteneur')} className={cn('rounded-md p-1 hover:bg-muted', TEXT.muted)} aria-label="Copier le numéro de conteneur"><Copy className="h-3.5 w-3.5" /></button>
        <StatusPill tone={meta.tone} label={meta.label} />
        <span className={cn('text-[15px] font-bold', TEXT.strong)}>Conteneur de {s.client_label}</span>
        <span className={cn('inline-flex items-center gap-1 text-[13px]', TEXT.muted)}>
          {CARRIER_LABEL[s.carrier] ?? s.carrier} · B/L <span className="font-mono">{s.bl_number}</span>
          <button type="button" onClick={() => copyToClipboard(s.bl_number, 'Numéro de B/L')} className="rounded-md p-1 hover:bg-muted" aria-label="Copier le numéro de B/L"><Copy className="h-3 w-3" /></button>
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button type="button" onClick={() => sync.mutate()} disabled={sync.isPending} className={cn('flex h-8 items-center gap-1.5 px-3 text-[12px] font-semibold disabled:opacity-60', SOFT_PILL)}>
          <RefreshCw className={cn('h-3.5 w-3.5', sync.isPending && 'animate-spin')} /> Rafraîchir
        </button>
        {canManage && (
          <div className="relative">
            <Holder icon={MoreHorizontal} size="sm" onClick={() => setMenuOpen((v) => !v)} ariaLabel="Plus d'actions" />
            {menuOpen && (
              <div className={cn('absolute right-0 top-[calc(100%+6px)] z-[70] min-w-[240px] overflow-hidden rounded-xl p-1.5', SURFACE.card, 'ring-1 ring-black/[0.10] dark:ring-white/[0.10]')}>
                <button type="button" onClick={() => { setMenuOpen(false); update.mutate({ id: s.id, patch: { freight_paid: !s.freight_paid } }); }} className={cn('flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-semibold hover:bg-muted/50', TEXT.strong)}>
                  <CheckCircle className="h-3.5 w-3.5" /> {s.freight_paid ? 'Marquer le fret non réglé' : 'Marquer le fret réglé'}
                </button>
                <button type="button" onClick={() => { setMenuOpen(false); update.mutate({ id: s.id, patch: { telex_released: !s.telex_released } }); }} className={cn('flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-semibold hover:bg-muted/50', TEXT.strong)}>
                  <CheckCircle className="h-3.5 w-3.5" /> {s.telex_released ? 'Télex : non reçu' : 'Télex reçu'}
                </button>
                <button type="button" onClick={() => { setMenuOpen(false); setVesselOpen(true); }} className={cn('flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-semibold hover:bg-muted/50', TEXT.strong)}>
                  <Ship className="h-3.5 w-3.5" /> {s.vessel_name ? 'Modifier le navire' : 'Renseigner le navire'}
                </button>
                <button type="button" onClick={() => { setMenuOpen(false); setConfirmRemove(true); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-semibold text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5" /> Retirer de la flotte
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <CargoVesselDialog shipment={s} open={vesselOpen} onClose={() => setVesselOpen(false)} />
      <CenterDialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onConfirm={doRemove}
        title="Retirer ce conteneur de la flotte ?"
        footer={
          <>
            <button type="button" onClick={() => setConfirmRemove(false)} className={cn('h-9 px-4 text-[13px] font-semibold', SOFT_PILL)}>Annuler</button>
            <button type="button" onClick={doRemove} className={cn('h-9 px-4 text-[13px]', DANGER_SOFT_PILL)}>Retirer</button>
          </>
        }
      >
        <p className={cn('text-[13px]', TEXT.body)}>
          <span className="font-mono font-bold">{s.container_number}</span> ({s.client_label}) disparaîtra de la flotte avec ses jalons et ses documents. Tu pourras le retrouver en le recherchant à nouveau.
        </p>
      </CenterDialog>
    </div>
  );
}

/* ── Corps ───────────────────────────────────────────────────────────── */

export function CargoDossierBody({ shipment: s }: { shipment: CargoShipment }) {
  const { hasPermission } = useAdminAuth();
  const canManage = hasPermission('canManageCargo');
  const { data: events } = useCargoEvents(s.id);
  const { data: docs } = useCargoDocuments(s.id);
  const { data: positions } = useCargoVesselPositions();
  const update = useUpdateCargoShipment();
  const [notes, setNotes] = useState(s.notes ?? '');
  useEffect(() => { setNotes(s.notes ?? ''); }, [s.id, s.notes]);

  const vessel = useMemo(() => groupVessels([s], positions ?? [])[0] ?? null, [s, positions]);
  const timeline = useMemo(() => timelineFromEvents(events ?? []), [events]);
  const eta = bestEta(s);
  const slip = etaSlipDays(s);
  const inDays = daysUntilArrival(s);
  const progress = voyageProgress(s);
  const live = liveVesselUrl(s.vessel_imo);
  const liveStatus = vessel ? vesselLiveStatus(vessel.position) : null;
  const todo = useMemo(() => nextSteps(s, docs), [s, docs]);
  const saveNotes = () => { if ((s.notes ?? '') !== notes) update.mutate({ id: s.id, patch: { notes: notes || null } }); };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-6 max-md:grid-cols-1">
      {/* ── Colonne principale ──────────────────────────────────────────── */}
      <div className="min-w-0">
        <div className="grid grid-cols-2 gap-6 max-sm:grid-cols-1">
          <div>
            <SecLabel className="mb-1.5">Où</SecLabel>
            <p className={cn('text-[15px] font-semibold leading-snug', TEXT.strong)}>{whereIs(s, vessel?.position ?? null)}</p>
            {vessel && liveStatus && (
              <p className={cn('mt-1 text-[13px]', TEXT.body)}>
                {vessel.position.vessel_name} · {LIVE_STATUS_LABEL[liveStatus]}
                {vessel.position.speed_kn != null && liveStatus !== 'stale' ? ` · ${vessel.position.speed_kn} nd` : ''}
              </p>
            )}
            {vessel && <p className={cn('mt-0.5 text-[12.5px] tabular-nums', TEXT.muted)}>{fmtLatLng(vessel.position.latitude, vessel.position.longitude)} · {fmtDayTime(new Date(vessel.position.reported_at))}</p>}
            {!vessel && s.status === 'UNKNOWN' && <p className={cn('mt-1 text-[13px]', TEXT.muted)}>{CARRIER_LABEL[s.carrier] ?? s.carrier} n'est pas encore interrogeable : les dates ci-contre viennent du transitaire.</p>}
          </div>
          <div>
            <SecLabel className="mb-1.5">{eta.source === 'carrier' ? 'Arrivée' : 'Arrivée promise'}</SecLabel>
            <p className={cn('text-[28px] font-extrabold leading-8 tracking-tight tabular-nums', TEXT.strong)}>{s.pod_name} · {fmtDay(eta.date)}</p>
            <p className={cn('mt-1 text-[13px]', TEXT.body)}>
              {inDays != null && (inDays > 0 ? `dans ${inDays} jour${inDays > 1 ? 's' : ''}` : inDays === 0 ? "aujourd'hui" : `il y a ${-inDays} jour${inDays < -1 ? 's' : ''}`)}
              {slip > 0 && <span className="ml-2 font-semibold text-amber-700 dark:text-amber-400">{slip} j après la date promise ({fmtDay(new Date(s.eta_promised + 'T12:00:00'))})</span>}
            </p>
            {progress && (
              <div className="mt-3">
                <div className="relative h-1.5 rounded-full bg-muted"><div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${progress.pct}%` }} /></div>
                <div className={cn('mt-1 flex justify-between text-[11.5px] tabular-nums', TEXT.muted)}>
                  <span>{s.pol_name ?? 'Départ'} · {fmtDay(s.etd_actual ? new Date(s.etd_actual) : s.etd_promised ? new Date(s.etd_promised + 'T12:00:00') : null)}</span>
                  <span>jour {progress.day} sur {progress.total}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 border-t border-black/[0.06] pt-4 dark:border-white/[0.06]">
          <SecLabel className="mb-3">Parcours</SecLabel>
          <CargoJourney shipment={s} position={vessel?.position ?? null} />
        </div>

        <div className="mt-5 border-t border-black/[0.06] pt-4 dark:border-white/[0.06]">
          <SecLabel className="mb-3">Le dossier</SecLabel>
          <div className="grid grid-cols-3 gap-x-5 gap-y-3.5 max-sm:grid-cols-2">
            <KV k="Armateur" v={CARRIER_LABEL[s.carrier] ?? s.carrier} />
            <KV k="Bill of lading" v={<span className="font-mono">{s.bl_number}</span>} />
            <KV k="Type de boîte" v={s.container_iso === '45G1' ? "40' High Cube" : s.container_iso ?? '—'} />
            <KV k="Navire" v={s.vessel_name ?? '—'} />
            <KV k="Voyage" v={s.voyage ?? '—'} />
            <KV k="Départ réel" v={s.etd_actual ? fmtDayFull(new Date(s.etd_actual)) : '—'} />
            <KV k="Chargement" v={s.pol_name ?? '—'} />
            <KV k="Déchargement" v={s.pod_name} />
            <KV k="Départ promis" v={s.etd_promised ? fmtDayFull(new Date(s.etd_promised + 'T12:00:00')) : '—'} />
            <KV k="Fret" v={fmtUsd(s.freight_usd)} />
            <KV k="Paiement du fret" v={<span className={s.freight_paid ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'}>{s.freight_paid ? 'Réglé' : 'À régler'}</span>} />
            <KV k="Télex release" v={<span className={s.telex_released ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'}>{s.telex_released ? 'Reçu' : 'Non reçu'}</span>} />
          </div>
        </div>

        <div className="mt-5 border-t border-black/[0.06] pt-4 dark:border-white/[0.06]">
          <SecLabel className="mb-3" right={s.last_synced_at ? <span className={cn('text-[11px]', TEXT.muted)}>armateur · {fmtDayTime(new Date(s.last_synced_at))}</span> : undefined}>Suivi</SecLabel>
          <CargoTimeline
            items={timeline}
            emptyLabel={s.carrier === 'MAERSK' ? 'Les jalons Maersk arrivent à la prochaine mise à jour.' : `Pas de jalons : ${CARRIER_LABEL[s.carrier] ?? s.carrier} n'est pas encore interrogeable.`}
          />
        </div>
      </div>

      {/* ── Rail droit ──────────────────────────────────────────────────── */}
      <div className="space-y-5">
        <div className={cn('isolate overflow-hidden rounded-xl', SURFACE.inset, 'ring-1 ring-black/[0.06] dark:ring-white/[0.06]')}>
          {vessel ? (
            <CargoMap shipments={[s]} positions={positions ?? []} mode="mini" selectedVesselImo={vessel.position.vessel_imo} className="h-[240px]" />
          ) : (
            <div className={cn('flex h-[240px] items-center justify-center px-4 text-center text-[12.5px]', TEXT.muted)}>Pas de position de navire</div>
          )}
          {live && (
            <a href={live} target="_blank" rel="noopener noreferrer" className={cn('flex items-center justify-center gap-1 border-t border-black/[0.06] py-2 text-[12px] font-semibold dark:border-white/[0.06]', TEXT.body)}>
              Position en direct <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <div>
          <SecLabel className="mb-2" right={<span className={cn('text-[11px]', TEXT.muted)}>{todo.filter((t) => t.level !== 'done').length} restante{todo.filter((t) => t.level !== 'done').length > 1 ? 's' : ''}</span>}>À faire avant l'arrivée</SecLabel>
          <ul className="space-y-1.5">
            {todo.map((t) => (
              <li key={t.id} className="flex items-start gap-2">
                {t.level === 'done' ? <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" /> : <Circle className={cn('mt-0.5 h-4 w-4 shrink-0', t.level === 'now' ? 'text-destructive' : TEXT.muted)} />}
                <div className="min-w-0">
                  <div className={cn('text-[13px]', t.level === 'done' ? cn('line-through', TEXT.muted) : t.level === 'now' ? cn('font-semibold', TEXT.strong) : TEXT.body)}>{t.label}</div>
                  {t.detail && t.level !== 'done' && <div className={cn('text-[11.5px]', TEXT.muted)}>{t.detail}</div>}
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <CargoDocuments shipmentId={s.id} canManage={canManage} />
        </div>
        <div>
          <SecLabel className="mb-1.5">Note interne</SecLabel>
          <TextArea id={`cargo-notes-${s.id}`} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={saveNotes} readOnly={!canManage} rows={3} placeholder="Ce qu'il faut savoir sur ce dossier (transitaire, client, incident…)" />
        </div>
      </div>
    </div>
  );
}

/* ── Boîte centrée (depuis la flotte) ────────────────────────────────── */

export function CargoDossierDialog({ shipmentId, onClose }: { shipmentId: string | null; onClose: () => void }) {
  const navigate = useNavigate();
  const { data: s } = useCargoShipment(shipmentId);
  return (
    <CenterDialog
      open={!!shipmentId}
      onClose={onClose}
      width={1040}
      title={s ? <CargoDossierHeader shipment={s} onRemoved={onClose} /> : 'Dossier conteneur'}
      footer={
        s ? (
          <>
            <button type="button" onClick={() => navigate(`/m/cargo/${s.id}`)} className={cn('h-9 px-4 text-[13px] font-semibold', SOFT_PILL)}>
              Ouvrir en pleine page →
            </button>
            <button type="button" onClick={onClose} className={cn('ml-auto h-9 px-4 text-[13px] font-semibold', SOFT_PILL)}>Fermer</button>
          </>
        ) : undefined
      }
    >
      {s ? <CargoDossierBody shipment={s} /> : <ScreenLoader className="min-h-[200px]" />}
    </CenterDialog>
  );
}

/* ── Page complète (mobile, /m/cargo/:id) ────────────────────────────── */

export function CargoDetail({ shipmentId, onClose }: { shipmentId: string; onClose?: () => void }) {
  const navigate = useNavigate();
  const { data: s, isLoading } = useCargoShipment(shipmentId);
  if (isLoading || !s) return <ScreenLoader className="min-h-[240px]" />;
  return (
    <div className="p-5 max-sm:p-4">
      <div className="mb-5 flex items-center gap-3 border-b border-black/[0.06] pb-4 dark:border-white/[0.06]">
        <CargoDossierHeader shipment={s} onRemoved={() => (onClose ? onClose() : navigate('/m/cargo'))} />
      </div>
      <CargoDossierBody shipment={s} />
    </div>
  );
}
