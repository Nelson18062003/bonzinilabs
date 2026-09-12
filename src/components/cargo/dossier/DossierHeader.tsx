/**
 * En-tête du dossier — la même identité partout : boîte rapide, page dédiée,
 * mobile. Trois niveaux et pas un de plus :
 *   1. identité (n° de boîte, statut, client)          — 20px bold
 *   2. références (armateur, B/L, navire, voyage)      — 12px sourd
 *   3. la décision (arrivée) + les actions             — à droite
 */
import { useState } from 'react';
import { CheckCircle, Copy, MoreHorizontal, RefreshCw, Ship, Trash2 } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useRemoveCargoShipment, useRequestCargoSync, useUpdateCargoShipment } from '@/hooks/useCargo';
import { CargoVesselDialog } from '@/components/cargo/CargoVesselDialog';
import { CARRIER_LABEL, bestEta, daysUntilArrival, etaSlipDays, fmtDay, statusMeta } from '@/lib/cargo/model';
import type { CargoShipment } from '@/lib/cargo/model';
import { copyToClipboard } from '@/lib/clipboard';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, SOFT_PILL, DANGER_SOFT_PILL, Holder, RefChip, StatusPill, CenterDialog } from '@/desktop/designKit';

function CopyBtn({ value, label }: { value: string; label: string }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); copyToClipboard(value, label); }}
      aria-label={`Copier ${label.toLowerCase()}`}
      className={cn('rounded-md p-1 transition-colors hover:bg-muted', TEXT.muted)}
    >
      <Copy className="h-3.5 w-3.5" />
    </button>
  );
}

export function DossierHeader({
  shipment: s,
  onRemoved,
  compact = false,
}: {
  shipment: CargoShipment;
  onRemoved?: () => void;
  /** Boîte rapide : titre plus petit, pas de ligne d'arrivée (elle est dans le corps). */
  compact?: boolean;
}) {
  const { hasPermission } = useAdminAuth();
  const canManage = hasPermission('canManageCargo');
  const update = useUpdateCargoShipment();
  const remove = useRemoveCargoShipment();
  const sync = useRequestCargoSync();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [vesselOpen, setVesselOpen] = useState(false);

  const meta = statusMeta(s.status);
  const eta = bestEta(s);
  const slip = etaSlipDays(s);
  const inDays = daysUntilArrival(s);
  const doRemove = () => remove.mutate(s.id, { onSuccess: () => { setConfirmRemove(false); onRemoved?.(); } });

  const identity = (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className={cn(compact ? 'text-[17px]' : 'text-[20px]', 'font-extrabold tracking-tight', TEXT.strong)}>
          Conteneur de {s.client_label}
        </h2>
        <StatusPill tone={meta.tone} label={meta.label} />
      </div>
      <div className={cn('mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]', TEXT.muted)}>
        <span className="inline-flex items-center gap-1">
          <RefChip>{s.container_number}</RefChip>
          <CopyBtn value={s.container_number} label="Numéro de conteneur" />
        </span>
        <span className="inline-flex items-center gap-1">
          {CARRIER_LABEL[s.carrier] ?? s.carrier} · B/L <span className={cn('font-mono font-semibold', TEXT.body)}>{s.bl_number}</span>
          <CopyBtn value={s.bl_number} label="Numéro de B/L" />
        </span>
        {s.vessel_name && <span>{s.vessel_name}{s.voyage ? ` · ${s.voyage}` : ''}</span>}
      </div>
    </div>
  );

  const actions = (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        onClick={() => sync.mutate()}
        disabled={sync.isPending}
        className={cn('flex h-8 items-center gap-1.5 px-3 text-[12px] font-semibold disabled:opacity-60', SOFT_PILL)}
      >
        <RefreshCw className={cn('h-3.5 w-3.5', sync.isPending && 'animate-spin')} /> Rafraîchir
      </button>
      {canManage && (
        <div className="relative">
          <Holder icon={MoreHorizontal} size="sm" onClick={() => setMenuOpen((v) => !v)} ariaLabel="Plus d'actions" />
          {menuOpen && (
            <div className={cn('absolute right-0 top-[calc(100%+6px)] z-[70] min-w-[250px] overflow-hidden rounded-xl p-1.5', SURFACE.card, 'ring-1 ring-black/[0.10] dark:ring-white/[0.10]')}>
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
  );

  return (
    <div className="flex items-start justify-between gap-x-6 gap-y-3 max-sm:flex-col">
      {identity}
      {compact ? (
        actions
      ) : (
        <div className="flex items-start gap-4">
          <div className="text-right">
            <div className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>
              {eta.source === 'carrier' ? 'Arrivée' : 'Arrivée promise'}
            </div>
            <div className={cn('mt-0.5 text-[17px] font-extrabold tabular-nums', TEXT.strong)}>{s.pod_name} · {fmtDay(eta.date)}</div>
            <div className={cn('text-[11.5px] tabular-nums', slip > 0 ? 'font-semibold text-amber-700 dark:text-amber-400' : TEXT.muted)}>
              {inDays != null && (inDays > 0 ? `dans ${inDays} j` : inDays === 0 ? "aujourd'hui" : `il y a ${-inDays} j`)}
              {slip > 0 && ` · +${slip} j vs promesse`}
            </div>
          </div>
          {actions}
        </div>
      )}

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
          <span className="font-mono font-bold">{s.container_number}</span> ({s.client_label}) disparaîtra de la flotte avec ses jalons, ses documents et ses coûts. Tu pourras le retrouver en le recherchant à nouveau.
        </p>
      </CenterDialog>
    </div>
  );
}
