/**
 * Aperçu rapide — la boîte ouverte en cliquant une ligne de la flotte.
 *
 * Elle répond à TROIS questions, dans cet ordre, et à rien d'autre :
 * où est-il, quand arrive-t-il, qu'est-ce qui bloque. Tout le reste (faits,
 * jalons, documents, douane, coûts, client, notes) vit dans le dossier
 * complet, à un clic. Quatre bandes séparées par un filet — jamais de carte
 * imbriquée dans un dialogue.
 */
import { useMemo } from 'react';
import { ArrowRight, CheckCircle2, Circle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCargoDocuments, useCargoShipment, useCargoVesselPositions } from '@/hooks/useCargo';
import { CargoJourney } from '@/components/cargo/CargoJourney';
import { DossierHeader } from '@/components/cargo/dossier/DossierHeader';
import { Band } from '@/components/cargo/dossier/kit';
import { groupVessels } from '@/lib/cargo/vessels';
import { LIVE_STATUS_LABEL, vesselLiveStatus } from '@/lib/cargo/geo';
import { nextSteps } from '@/lib/cargo/todo';
import { bestEta, daysUntilArrival, etaSlipDays, fmtDay, fmtDayTime, voyageProgress, whereIs } from '@/lib/cargo/model';
import { dossierPath } from '@/lib/cargo/dossierNav';
import { cn } from '@/lib/utils';
import { TEXT, SOFT_PILL, PRIMARY_PILL, CenterDialog, ScreenLoader } from '@/desktop/designKit';

export function CargoQuickView({ shipmentId, onClose }: { shipmentId: string | null; onClose: () => void }) {
  const navigate = useNavigate();
  const { data: s } = useCargoShipment(shipmentId);
  const { data: positions } = useCargoVesselPositions();
  const { data: docs } = useCargoDocuments(shipmentId);

  const vessel = useMemo(() => (s ? groupVessels([s], positions ?? [])[0] ?? null : null), [s, positions]);
  const todo = useMemo(() => (s ? nextSteps(s, docs) : []), [s, docs]);
  const open = todo.filter((t) => t.level !== 'done');

  const eta = s ? bestEta(s) : { date: null, source: null as null | 'carrier' | 'promised' };
  const slip = s ? etaSlipDays(s) : 0;
  const inDays = s ? daysUntilArrival(s) : null;
  const progress = s ? voyageProgress(s) : null;
  const liveStatus = vessel ? vesselLiveStatus(vessel.position) : null;

  return (
    <CenterDialog
      open={!!shipmentId}
      onClose={onClose}
      width={620}
      title={s ? <DossierHeader shipment={s} onRemoved={onClose} compact /> : 'Conteneur'}
      bodyClassName="-mx-5 -mb-1 mt-1"
      footer={
        s ? (
          <>
            <button
              type="button"
              onClick={() => navigate(dossierPath(s.id))}
              className={cn('inline-flex h-9 items-center gap-2 px-4 text-[13px] font-bold', PRIMARY_PILL)}
            >
              Ouvrir le dossier complet <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={onClose} className={cn('ml-auto h-9 px-4 text-[13px] font-semibold', SOFT_PILL)}>Fermer</button>
          </>
        ) : undefined
      }
    >
      {!s ? (
        <ScreenLoader className="min-h-[180px]" />
      ) : (
        <div>
          <Band title="Où est-il ?" meta={vessel ? fmtDayTime(new Date(vessel.position.reported_at)) : undefined} first>
            <p className={cn('text-[17px] font-bold leading-snug', TEXT.strong)}>{whereIs(s, vessel?.position ?? null)}</p>
            {vessel && liveStatus && (
              <p className={cn('mt-1 text-[12.5px]', TEXT.muted)}>
                {vessel.position.vessel_name} · {LIVE_STATUS_LABEL[liveStatus]}
                {vessel.position.speed_kn != null && liveStatus !== 'stale' ? ` · ${vessel.position.speed_kn} nd` : ''}
              </p>
            )}
          </Band>

          <Band title="Quand arrive-t-il ?">
            <p className={cn('text-[28px] font-extrabold leading-8 tracking-tight tabular-nums', TEXT.strong)}>
              {s.pod_name} · {fmtDay(eta.date)}
            </p>
            <p className={cn('mt-1 text-[12.5px]', TEXT.body)}>
              {inDays != null && (inDays > 0 ? `dans ${inDays} jour${inDays > 1 ? 's' : ''}` : inDays === 0 ? "aujourd'hui" : `il y a ${-inDays} jour${inDays < -1 ? 's' : ''}`)}
              {eta.source === 'promised' && <span className={TEXT.muted}> · date du transitaire</span>}
              {slip > 0 && <span className="ml-1.5 font-semibold text-amber-700 dark:text-amber-400">+{slip} j vs promesse</span>}
            </p>
            {progress && (
              <div className="mt-3">
                <div className="relative h-1.5 rounded-full bg-muted">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${progress.pct}%` }} />
                </div>
                <div className={cn('mt-1 flex justify-between text-[11.5px] tabular-nums', TEXT.muted)}>
                  <span>{s.pol_name ?? 'Départ'}</span>
                  <span>jour {progress.day} sur {progress.total}</span>
                </div>
              </div>
            )}
          </Band>

          <Band title="Parcours">
            <CargoJourney shipment={s} position={vessel?.position ?? null} />
          </Band>

          <Band title="À faire" meta={open.length > 0 ? `${open.length} restante${open.length > 1 ? 's' : ''}` : 'rien'}>
            {open.length === 0 ? (
              <p className={cn('flex items-center gap-2 text-[13px] font-semibold text-emerald-700 dark:text-emerald-400')}>
                <CheckCircle2 className="h-4 w-4" /> Ce conteneur est prêt à être récupéré.
              </p>
            ) : (
              <ul className="space-y-2">
                {open.slice(0, 3).map((t) => (
                  <li key={t.id} className="flex items-start gap-2.5">
                    <Circle className={cn('mt-0.5 h-4 w-4 shrink-0', t.level === 'now' ? 'text-destructive' : TEXT.muted)} />
                    <div className="min-w-0">
                      <div className={cn('text-[13px]', t.level === 'now' ? cn('font-semibold', TEXT.strong) : TEXT.body)}>{t.label}</div>
                      {t.detail && <div className={cn('text-[11.5px]', TEXT.muted)}>{t.detail}</div>}
                    </div>
                  </li>
                ))}
                {open.length > 3 && (
                  <li className={cn('pl-[26px] text-[12px]', TEXT.muted)}>
                    et {open.length - 3} autre{open.length - 3 > 1 ? 's' : ''} — voir le dossier complet
                  </li>
                )}
              </ul>
            )}
          </Band>
        </div>
      )}
    </CenterDialog>
  );
}
