/** Onglet Suivi — les jalons de l'armateur, et la promesse confrontée au réel. */
import { useMemo } from 'react';
import { useCargoEvents } from '@/hooks/useCargo';
import { CargoTimeline } from '@/components/cargo/CargoTimeline';
import { Empty, Fact, Facts, Section } from '@/components/cargo/dossier/kit';
import { CARRIER_LABEL, fmtDayFull, fmtDayTime, etaSlipDays, timelineFromEvents } from '@/lib/cargo/model';
import type { CargoShipment } from '@/lib/cargo/model';
import { cn } from '@/lib/utils';
import { TEXT } from '@/desktop/designKit';

export function TabSuivi({ shipment: s }: { shipment: CargoShipment }) {
  const { data: events } = useCargoEvents(s.id);
  const timeline = useMemo(() => timelineFromEvents(events ?? []), [events]);
  const slip = etaSlipDays(s);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-5 max-lg:grid-cols-1">
      <Section
        title="Jalons de l'armateur"
        meta={s.last_synced_at ? `mis à jour ${fmtDayTime(new Date(s.last_synced_at))}` : 'jamais synchronisé'}
      >
        {timeline.length === 0 ? (
          <Empty title="Aucun jalon reçu">
            {s.carrier === 'MAERSK'
              ? 'Les jalons Maersk arrivent à la prochaine mise à jour — le bouton « Rafraîchir » la déclenche.'
              : `${CARRIER_LABEL[s.carrier] ?? s.carrier} n'est pas encore interrogeable : ce dossier avance avec les dates du transitaire.`}
          </Empty>
        ) : (
          <CargoTimeline items={timeline} />
        )}
      </Section>

      <div className="space-y-5">
        <Section title="Promis / réel" meta={slip > 0 ? `+${slip} j` : 'conforme'}>
          <Facts cols={2}>
            <Fact label="Départ promis" value={s.etd_promised ? fmtDayFull(new Date(s.etd_promised + 'T12:00:00')) : '—'} hint="transitaire" />
            <Fact label="Départ réel" value={s.etd_actual ? fmtDayFull(new Date(s.etd_actual)) : '—'} hint="armateur" />
            <Fact label="Arrivée promise" value={s.eta_promised ? fmtDayFull(new Date(s.eta_promised + 'T12:00:00')) : '—'} hint="transitaire" />
            <Fact
              label="Arrivée annoncée"
              value={s.eta_carrier ? fmtDayFull(new Date(s.eta_carrier)) : '—'}
              hint={slip > 0 ? <span className="text-amber-700 dark:text-amber-400">{slip} jours de plus que la promesse</span> : 'armateur'}
            />
          </Facts>
          {slip > 3 && (
            <p className={cn('mt-4 border-t border-black/[0.06] pt-3 text-[12.5px] dark:border-white/[0.06]', TEXT.body)}>
              Écart significatif : c'est l'argument à opposer au transitaire, et la raison de prévenir {s.client_label}.
            </p>
          )}
        </Section>

        <Section title="Dernier mouvement">
          {s.last_event_label ? (
            <>
              <p className={cn('text-[15px] font-bold', TEXT.strong)}>{s.last_event_label}</p>
              <p className={cn('mt-1 text-[12.5px]', TEXT.muted)}>{s.last_event_at ? fmtDayTime(new Date(s.last_event_at)) : '—'}</p>
            </>
          ) : (
            <Empty title="Rien de neuf" />
          )}
        </Section>
      </div>
    </div>
  );
}
