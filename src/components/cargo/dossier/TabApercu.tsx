/** Onglet Aperçu — où il est, quand il arrive, ce qu'il reste à faire. */
import { useMemo } from 'react';
import { CheckCircle2, Circle, ExternalLink } from 'lucide-react';
import { useCargoDocuments, useCargoVesselPositions } from '@/hooks/useCargo';
import { CargoMap } from '@/components/cargo/CargoMap';
import { CargoJourney } from '@/components/cargo/CargoJourney';
import { Empty, Fact, Facts, Section } from '@/components/cargo/dossier/kit';
import { groupVessels } from '@/lib/cargo/vessels';
import { LIVE_STATUS_LABEL, vesselLiveStatus } from '@/lib/cargo/geo';
import { nextSteps } from '@/lib/cargo/todo';
import { CARRIER_LABEL, bestEta, bestEtd, daysUntilArrival, etaSlipDays, fmtDay, fmtDayFull, fmtDayTime, fmtLatLng, fmtUsd, liveVesselUrl, voyageProgress, whereIs } from '@/lib/cargo/model';
import type { CargoShipment } from '@/lib/cargo/model';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT } from '@/desktop/designKit';

export function TabApercu({ shipment: s }: { shipment: CargoShipment }) {
  const { data: positions } = useCargoVesselPositions();
  const { data: docs } = useCargoDocuments(s.id);
  const vessel = useMemo(() => groupVessels([s], positions ?? [])[0] ?? null, [s, positions]);
  const todo = useMemo(() => nextSteps(s, docs), [s, docs]);
  const open = todo.filter((t) => t.level !== 'done');
  const eta = bestEta(s);
  const slip = etaSlipDays(s);
  const inDays = daysUntilArrival(s);
  const progress = voyageProgress(s);
  const liveStatus = vessel ? vesselLiveStatus(vessel.position) : null;
  const live = liveVesselUrl(s.vessel_imo);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-5 max-lg:grid-cols-1">
      <div className="space-y-5">
        <Section title="Où est-il ?" meta={vessel ? fmtDayTime(new Date(vessel.position.reported_at)) : undefined}>
          <p className={cn('text-[17px] font-bold leading-snug', TEXT.strong)}>{whereIs(s, vessel?.position ?? null)}</p>
          {vessel && liveStatus ? (
            <Facts cols={3}>
              <Fact label="Navire" value={vessel.position.vessel_name ?? '—'} hint={s.voyage ? `voyage ${s.voyage}` : undefined} />
              <Fact
                label="Allure"
                value={`${LIVE_STATUS_LABEL[liveStatus]}${vessel.position.speed_kn != null && liveStatus !== 'stale' ? ` · ${vessel.position.speed_kn} nd` : ''}`}
                hint={vessel.position.course_deg != null && liveStatus !== 'stale' ? `cap ${Math.round(Number(vessel.position.course_deg))}°` : undefined}
              />
              <Fact label="Position" value={fmtLatLng(vessel.position.latitude, vessel.position.longitude)} hint={liveStatus === 'stale' ? 'hors couverture AIS' : 'relevé AIS'} />
            </Facts>
          ) : (
            <p className={cn('mt-2 text-[13px]', TEXT.muted)}>
              {s.status === 'UNKNOWN'
                ? `${CARRIER_LABEL[s.carrier] ?? s.carrier} n'est pas encore interrogeable : les dates viennent du transitaire. Renseigne le navire (menu ⋯) pour suivre sa position.`
                : "Aucune position de navire pour l'instant."}
            </p>
          )}
        </Section>

        <Section title="Parcours" meta={progress ? `jour ${progress.day} sur ${progress.total}` : undefined}>
          <CargoJourney shipment={s} position={vessel?.position ?? null} />
          <div className="mt-5 border-t border-black/[0.06] pt-4 dark:border-white/[0.06]">
            <Facts cols={4}>
              <Fact label="Départ réel" value={s.etd_actual ? fmtDay(new Date(s.etd_actual)) : '—'} hint={s.pol_name ?? undefined} />
              <Fact label="Départ promis" value={s.etd_promised ? fmtDay(new Date(s.etd_promised + 'T12:00:00')) : '—'} hint="transitaire" />
              <Fact
                label={eta.source === 'carrier' ? 'Arrivée armateur' : 'Arrivée promise'}
                value={fmtDay(eta.date)}
                hint={inDays != null ? (inDays > 0 ? `dans ${inDays} jours` : inDays === 0 ? "aujourd'hui" : `il y a ${-inDays} jours`) : undefined}
              />
              <Fact
                label="Écart"
                value={slip > 0 ? <span className="text-amber-700 dark:text-amber-400">+{slip} jours</span> : '—'}
                hint={slip > 0 && s.eta_promised ? `promis ${fmtDay(new Date(s.eta_promised + 'T12:00:00'))}` : 'conforme à la promesse'}
              />
            </Facts>
          </div>
        </Section>

        <Section title="La marchandise">
          <Facts cols={4}>
            <Fact label="Type de boîte" value={s.container_iso === '45G1' ? "40' High Cube" : s.container_iso ?? '—'} />
            <Fact label="Marchandise" value={s.goods_description ?? '—'} />
            <Fact label="Poids brut" value={s.gross_weight_kg != null ? `${Number(s.gross_weight_kg).toLocaleString('fr-FR')} kg` : '—'} />
            <Fact label="Colis" value={s.packages_count != null ? String(s.packages_count) : '—'} />
          </Facts>
        </Section>
      </div>

      <div className="space-y-5">
        <Section title="Sur la carte" bodyClassName="p-0">
          {vessel ? (
            <CargoMap shipments={[s]} positions={positions ?? []} mode="mini" selectedVesselImo={vessel.position.vessel_imo} className="h-[220px]" />
          ) : (
            <div className={cn('flex h-[220px] items-center justify-center px-4 text-center text-[12.5px]', SURFACE.inset, TEXT.muted)}>Pas de position de navire</div>
          )}
          {live && (
            <a href={live} target="_blank" rel="noopener noreferrer" className={cn('flex items-center justify-center gap-1 border-t border-black/[0.06] py-2.5 text-[12px] font-semibold dark:border-white/[0.06]', TEXT.body)}>
              Position en direct <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </Section>

        <Section title="À faire avant l'arrivée" meta={open.length > 0 ? `${open.length} restante${open.length > 1 ? 's' : ''}` : 'tout est prêt'}>
          {todo.length === 0 ? (
            <Empty title="Rien à faire">Ce dossier est livré.</Empty>
          ) : (
            <ul className="space-y-2.5">
              {todo.map((t) => (
                <li key={t.id} className="flex items-start gap-2.5">
                  {t.level === 'done'
                    ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    : <Circle className={cn('mt-0.5 h-4 w-4 shrink-0', t.level === 'now' ? 'text-destructive' : TEXT.muted)} />}
                  <div className="min-w-0">
                    <div className={cn('text-[13px]', t.level === 'done' ? cn('line-through', TEXT.muted) : t.level === 'now' ? cn('font-semibold', TEXT.strong) : TEXT.body)}>{t.label}</div>
                    {t.detail && t.level !== 'done' && <div className={cn('text-[11.5px]', TEXT.muted)}>{t.detail}</div>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Argent">
          <Facts cols={2}>
            <Fact label="Fret" value={fmtUsd(s.freight_usd)} hint="au transitaire" />
            <Fact
              label="Paiement"
              value={<span className={s.freight_paid ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'}>{s.freight_paid ? 'Réglé' : 'À régler'}</span>}
            />
            <Fact
              label="Télex release"
              value={<span className={s.telex_released ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'}>{s.telex_released ? 'Reçu' : 'Non reçu'}</span>}
              hint={s.telex_released ? undefined : 'sans lui, pas de sortie du port'}
            />
            <Fact label="Départ" value={bestEtd(s) ? fmtDayFull(bestEtd(s)) : '—'} />
          </Facts>
        </Section>
      </div>
    </div>
  );
}
