/**
 * Le dossier d'un conteneur — même composant en panneau (42 % du workbench)
 * et en page (mobile, lien profond). Anatomie 02-foundation §2.B :
 * en-tête épinglé · zone de verdict (où / quand) · faits · suivi · documents
 * · note interne.
 */
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, ExternalLink, MoreHorizontal, RefreshCw, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import {
  useCargoEvents,
  useCargoShipment,
  useCargoVesselPositions,
  useRemoveCargoShipment,
  useRequestCargoSync,
  useUpdateCargoShipment,
} from '@/hooks/useCargo';
import { CargoMap } from '@/components/cargo/CargoMap';
import { CargoTimeline } from '@/components/cargo/CargoTimeline';
import { CargoDocuments } from '@/components/cargo/CargoDocuments';
import { groupVessels } from '@/lib/cargo/vessels';
import {
  CARRIER_LABEL,
  bestEta,
  daysUntilArrival,
  etaSlipDays,
  fmtDay,
  fmtDayFull,
  fmtDayTime,
  fmtLatLng,
  fmtUsd,
  liveVesselUrl,
  statusMeta,
  timelineFromEvents,
  voyageProgress,
  whereIs,
} from '@/lib/cargo/model';
import type { LatLng } from '@/lib/cargo/model';
import { cn } from '@/lib/utils';
import { TextArea } from '@/components/form';
import { SURFACE, TEXT, SOFT_PILL, Holder, KV, RefChip, SecLabel, StatusPill, ScreenLoader, CenterDialog, DANGER_SOFT_PILL } from '@/desktop/designKit';

export function CargoDetail({ shipmentId, onClose, asPage = false }: { shipmentId: string; onClose?: () => void; asPage?: boolean }) {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const canManage = hasPermission('canManageCargo');
  const { data: s, isLoading } = useCargoShipment(shipmentId);
  const { data: events } = useCargoEvents(shipmentId);
  const { data: positions } = useCargoVesselPositions();
  const update = useUpdateCargoShipment();
  const remove = useRemoveCargoShipment();
  const sync = useRequestCargoSync();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => { setNotes(s?.notes ?? ''); }, [s?.id, s?.notes]);

  const vessel = useMemo(() => {
    if (!s || !positions) return null;
    return groupVessels([s], positions)[0] ?? null;
  }, [s, positions]);
  const timeline = useMemo(() => timelineFromEvents(events ?? []), [events]);

  if (isLoading || !s) return <ScreenLoader className="min-h-[240px]" />;

  const meta = statusMeta(s.status);
  const eta = bestEta(s);
  const slip = etaSlipDays(s);
  const inDays = daysUntilArrival(s);
  const progress = voyageProgress(s);
  const live = liveVesselUrl(s.vessel_imo);
  const focus: LatLng | null = vessel ? [vessel.position.latitude, vessel.position.longitude] : null;

  const saveNotes = () => {
    if ((s.notes ?? '') !== notes) update.mutate({ id: s.id, patch: { notes: notes || null } });
  };
  const doRemove = () => {
    remove.mutate(s.id, {
      onSuccess: () => {
        setConfirmRemove(false);
        if (onClose) onClose();
        else navigate('/m/cargo');
      },
    });
  };

  return (
    <div className={cn('flex h-full min-h-0 flex-col', asPage && 'min-h-screen')}>
      {/* ── En-tête épinglé ─────────────────────────────────────────────── */}
      <div className={cn('flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-black/[0.06] px-4 py-3 dark:border-white/[0.06]', SURFACE.card)}>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <RefChip>{s.container_number}</RefChip>
          <StatusPill tone={meta.tone} label={meta.label} />
          <span className={cn('text-[13px] font-bold', TEXT.strong)}>{s.client_label}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={() => sync.mutate()} disabled={sync.isPending} className={cn('flex h-8 items-center gap-1.5 px-3 text-[12px] font-semibold disabled:opacity-60', SOFT_PILL)}>
            <RefreshCw className={cn('h-3.5 w-3.5', sync.isPending && 'animate-spin')} /> Rafraîchir
          </button>
          {canManage && (
            <div className="relative">
              <Holder icon={MoreHorizontal} size="sm" onClick={() => setMenuOpen((v) => !v)} ariaLabel="Plus d'actions" />
              {menuOpen && (
                <div className={cn('absolute right-0 top-[calc(100%+6px)] z-40 min-w-[230px] overflow-hidden rounded-xl p-1.5', SURFACE.card, 'ring-1 ring-black/[0.10] dark:ring-white/[0.10]')}>
                  <button type="button" onClick={() => { setMenuOpen(false); update.mutate({ id: s.id, patch: { freight_paid: !s.freight_paid } }); }} className={cn('flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-semibold hover:bg-muted/50', TEXT.strong)}>
                    <CheckCircle className="h-3.5 w-3.5" /> {s.freight_paid ? 'Marquer le fret non réglé' : 'Marquer le fret réglé'}
                  </button>
                  <button type="button" onClick={() => { setMenuOpen(false); update.mutate({ id: s.id, patch: { telex_released: !s.telex_released } }); }} className={cn('flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-semibold hover:bg-muted/50', TEXT.strong)}>
                    <CheckCircle className="h-3.5 w-3.5" /> {s.telex_released ? 'Télex : non reçu' : 'Télex reçu'}
                  </button>
                  <button type="button" onClick={() => { setMenuOpen(false); setConfirmRemove(true); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-semibold text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-3.5 w-3.5" /> Retirer de la flotte
                  </button>
                </div>
              )}
            </div>
          )}
          {onClose && <Holder icon={X} size="sm" onClick={onClose} ariaLabel="Fermer" />}
        </div>
      </div>

      {/* ── Contenu ─────────────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {/* Verdict : où, quand */}
        <div className="grid grid-cols-[minmax(0,1fr)_240px] items-stretch gap-4 max-md:grid-cols-1">
          <div className="flex flex-col justify-between gap-3">
            <div>
              <p className={cn('text-[13px] font-semibold', TEXT.body)}>{whereIs(s, vessel?.position ?? null)}</p>
              {vessel && (
                <p className={cn('mt-0.5 text-[12px] tabular-nums', TEXT.muted)}>
                  {fmtLatLng(vessel.position.latitude, vessel.position.longitude)} · {fmtDayTime(new Date(vessel.position.reported_at))}
                  {vessel.position.speed_kn != null ? ` · ${vessel.position.speed_kn} nd` : ''}
                </p>
              )}
              {!vessel && s.status === 'UNKNOWN' && (
                <p className={cn('mt-0.5 text-[12px]', TEXT.muted)}>{CARRIER_LABEL[s.carrier] ?? s.carrier} n'est pas encore interrogeable. Les dates viennent du transitaire.</p>
              )}
            </div>
            <div>
              <p className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>{eta.source === 'carrier' ? 'Arrivée' : 'Arrivée promise'}</p>
              <p className={cn('mt-0.5 text-[28px] font-extrabold leading-8 tracking-tight tabular-nums', TEXT.strong)}>
                {s.pod_name} · {fmtDay(eta.date)}
              </p>
              <p className={cn('mt-1 text-[12px]', TEXT.muted)}>
                {inDays != null && (inDays > 0 ? `dans ${inDays} jour${inDays > 1 ? 's' : ''}` : inDays === 0 ? "aujourd'hui" : `il y a ${-inDays} jour${inDays < -1 ? 's' : ''}`)}
                {slip > 0 && <span className="ml-2 font-semibold text-amber-700 dark:text-amber-400">{slip} j après la date promise ({fmtDay(new Date(s.eta_promised + 'T12:00:00'))})</span>}
              </p>
              {progress && (
                <div className="mt-3">
                  <div className="relative h-1.5 rounded-full bg-muted">
                    <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${progress.pct}%` }} />
                  </div>
                  <div className={cn('mt-1 flex justify-between text-[11px] tabular-nums', TEXT.muted)}>
                    <span>{s.pol_name ?? 'Départ'} · {fmtDay(s.etd_actual ? new Date(s.etd_actual) : s.etd_promised ? new Date(s.etd_promised + 'T12:00:00') : null)}</span>
                    <span>jour {progress.day} sur {progress.total}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className={cn('overflow-hidden rounded-lg', SURFACE.inset, 'ring-1 ring-black/[0.06] dark:ring-white/[0.06]')}>
            {vessel ? (
              <CargoMap vessels={[vessel]} selectedImo={vessel.position.vessel_imo} compact focus={focus} className="h-[176px] max-md:h-[200px]" />
            ) : (
              <div className={cn('flex h-[176px] items-center justify-center px-4 text-center text-[12px]', TEXT.muted)}>Pas de position de navire</div>
            )}
            {live && (
              <a href={live} target="_blank" rel="noopener noreferrer" className={cn('flex items-center justify-center gap-1 border-t border-black/[0.06] py-1.5 text-[11.5px] font-semibold dark:border-white/[0.06]', TEXT.body)}>
                Position en direct <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>

        {/* Faits */}
        <div className="mt-3 grid grid-cols-3 gap-x-4 gap-y-2.5 border-t border-black/[0.06] pt-3 dark:border-white/[0.06] max-md:grid-cols-2">
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

        {/* Suivi */}
        <div className="mt-3 border-t border-black/[0.06] pt-2.5 dark:border-white/[0.06]">
          <SecLabel className="mb-2" right={s.last_synced_at ? <span className={cn('text-[11px]', TEXT.muted)}>armateur · {fmtDayTime(new Date(s.last_synced_at))}</span> : undefined}>
            Suivi
          </SecLabel>
          <CargoTimeline
            items={timeline}
            emptyLabel={s.carrier === 'MAERSK' ? 'Les jalons Maersk arrivent à la prochaine mise à jour.' : `Pas de jalons : ${CARRIER_LABEL[s.carrier] ?? s.carrier} n'est pas encore interrogeable.`}
          />
        </div>

        {/* Documents */}
        <div className="mt-3 border-t border-black/[0.06] pt-2.5 dark:border-white/[0.06]">
          <CargoDocuments shipmentId={s.id} canManage={canManage} />
        </div>

        {/* Note interne */}
        <div className="mt-3 border-t border-black/[0.06] pt-2.5 dark:border-white/[0.06]">
          <SecLabel className="mb-1.5">Note interne</SecLabel>
          <TextArea
            id={`cargo-notes-${s.id}`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            readOnly={!canManage}
            rows={2}
            placeholder="Ce qu'il faut savoir sur ce dossier (transitaire, client, incident…)"
          />
        </div>
      </div>

      <CenterDialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onConfirm={doRemove}
        title="Retirer ce conteneur de la flotte ?"
        footer={
          <>
            <button type="button" onClick={() => setConfirmRemove(false)} className={cn('h-9 px-4 text-[13px] font-semibold', SOFT_PILL)}>Annuler</button>
            <button type="button" onClick={doRemove} className={cn('h-9 px-4 text-[13px]', DANGER_SOFT_PILL)}>
              Retirer
            </button>
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
