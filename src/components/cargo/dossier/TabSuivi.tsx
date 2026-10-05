/**
 * Onglet Suivi — le voyage escale par escale, les jalons de l'armateur, et
 * les trois arrivées confrontées (promise, armateur, relevée), et le statut
 * « arrivé » que l'équipe pose à la main quand l'armateur se tait.
 *
 * Les jalons Maersk arrivaient en double (« Navire parti » six fois, cinq
 * estimations d'arrivée successives) : on n'en garde qu'un par événement,
 * et pour les estimations, seulement la DERNIÈRE — les autres sont l'histoire
 * du retard, résumée en une ligne.
 */
import { useMemo, useState } from 'react';
import { Anchor, CalendarClock, CheckCircle2, History, MapPin, Pencil, Route, Undo2 } from 'lucide-react';
import { useCargoEvents } from '@/hooks/useCargo';
import { CargoTimeline } from '@/components/cargo/CargoTimeline';
import { Empty, Fact, Facts, Section, Tag, ToolButton } from '@/components/cargo/dossier/kit';
import { CallsDialog, EtaDialog, MarkArrivedDialog, UnmarkArrivedDialog } from '@/components/cargo/dossier/VoyageDialogs';
import { CARRIER_LABEL, ETA_SOURCE_LABEL, arrivalPort, bestEta, etaSlipDays, fmtDay, fmtDayFull, fmtDayTime, hasArrived, timelineFromEvents } from '@/lib/cargo/model';
import type { CargoEvent, CargoShipment } from '@/lib/cargo/model';
import { callDateLine, callStates, voyageCalls, type CallState } from '@/lib/cargo/voyage';
import { cn } from '@/lib/utils';
import { TEXT } from '@/desktop/designKit';

/** Un jalon par événement réel ; pour les arrivées estimées, la dernière seulement. */
export function dedupeEvents(events: CargoEvent[]): { kept: CargoEvent[]; etaHistory: CargoEvent[] } {
  const seen = new Set<string>();
  const kept: CargoEvent[] = [];
  const estimates: CargoEvent[] = [];
  for (const e of events) {
    if (e.classifier !== 'ACT' && e.event_code === 'ARRI') { estimates.push(e); continue; }
    const key = `${e.event_code}|${e.classifier}|${e.event_time}|${e.location_name ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(e);
  }
  // Les estimations sont rangées par date de création (ordre d'arrivée du flux) : la dernière reçue fait foi.
  const byReceipt = [...estimates].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const latest = byReceipt[byReceipt.length - 1];
  if (latest) kept.push(latest);
  const uniq = [...new Map(byReceipt.map((e) => [e.event_time, e])).values()];
  return { kept, etaHistory: uniq };
}

const STATE_LABEL: Record<CallState, { text: string; tone: 'success' | 'info' | 'neutral' | 'warn' }> = {
  done: { text: 'fait', tone: 'neutral' },
  here: { text: 'en cours', tone: 'success' },
  next: { text: 'prochaine', tone: 'info' },
  later: { text: 'à venir', tone: 'neutral' },
  after: { text: 'après déchargement', tone: 'neutral' },
};

export function TabSuivi({ shipment: s, canManage = false }: { shipment: CargoShipment; canManage?: boolean }) {
  const { data: events } = useCargoEvents(s.id);
  const { kept, etaHistory } = useMemo(() => dedupeEvents(events ?? []), [events]);
  const timeline = useMemo(() => timelineFromEvents(kept), [kept]);
  const calls = voyageCalls(s);
  const states = callStates(calls);
  const eta = bestEta(s);
  const slip = etaSlipDays(s);
  const [dialog, setDialog] = useState<'eta' | 'calls' | 'arrived' | 'unarrived' | null>(null);
  const arrived = hasArrived(s.status);
  // On ne marque arrivé qu'un conteneur parti (en mer, ou un départ connu) — comme la RPC.
  const canMark = canManage && !arrived && (s.status === 'AT_SEA' || !!s.etd_actual);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_380px] gap-5 max-lg:grid-cols-1">
      <div className="space-y-5">
        <Section
          icon={Route}
          tone="violet"
          title="Escales du voyage"
          subtitle="tenues à jour par l’équipe (Atlas, VesselFinder, consignataire)"
          action={canManage ? <ToolButton icon={Pencil} onClick={() => setDialog('calls')}>Modifier</ToolButton> : undefined}
        >
          <ol className="relative">
            {calls.map((c, i) => {
              const st = states[i];
              return (
                <li key={c.id} className={cn('relative flex gap-3 pb-5 last:pb-0', st === 'after' && 'opacity-60')}>
                  {i < calls.length - 1 && <span className="absolute left-[11px] top-6 h-[calc(100%-18px)] w-0.5 bg-black/[0.08] dark:bg-white/[0.1]" />}
                  <span className={cn('relative z-[1] mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full', st === 'done' ? 'bg-foreground text-background' : st === 'here' ? 'bg-emerald-500 text-white' : st === 'next' ? 'bg-violet-600 text-white' : 'bg-muted text-muted-foreground')}>
                    {st === 'here' ? <Anchor className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn('text-[14px] max-lg:text-[16px] font-bold', TEXT.strong)}>{c.name}</span>
                      <Tag tone={STATE_LABEL[st].tone}>{STATE_LABEL[st].text}</Tag>
                    </div>
                    <div className={cn('text-[12.5px] max-lg:text-[14px] tabular-nums', TEXT.body)}>{callDateLine(c, st) ?? '—'}</div>
                    {c.note && <p className={cn('mt-1 text-[12.5px] max-lg:text-[14px] leading-relaxed', TEXT.muted)}>{c.note}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </Section>

        <Section
          icon={History}
          title={`Jalons ${CARRIER_LABEL[s.carrier] ?? 'de l’armateur'}`}
          subtitle={s.last_synced_at ? `mis à jour ${fmtDayTime(new Date(s.last_synced_at))}` : 'jamais synchronisé'}
          meta={timeline.length ? `${timeline.length}` : undefined}
        >
          {timeline.length === 0 ? (
            <Empty title="Aucun jalon reçu">
              {s.carrier === 'MAERSK'
                ? 'Les jalons Maersk arrivent à la prochaine mise à jour : le bouton « Rafraîchir » la déclenche.'
                : `${CARRIER_LABEL[s.carrier] ?? s.carrier} n'est pas encore interrogeable : ce dossier avance avec les dates de l'équipe.`}
            </Empty>
          ) : (
            <CargoTimeline items={timeline} />
          )}
        </Section>
      </div>

      <div className="space-y-5">
        <Section
          icon={CalendarClock}
          tone="amber"
          title="Les arrivées"
          meta={slip > 0 ? `+${slip} j` : 'conforme'}
          action={canManage ? <ToolButton icon={Pencil} onClick={() => setDialog('eta')}>Corriger</ToolButton> : undefined}
        >
          <Facts cols={2}>
            <Fact label="Promise" value={s.eta_promised ? fmtDayFull(new Date(s.eta_promised + 'T12:00:00')) : '—'} hint="par le transitaire" />
            <Fact label="Armateur" value={s.eta_carrier ? fmtDayFull(new Date(s.eta_carrier)) : '—'} hint="dernière estimation reçue" />
            <Fact label="Relevée" value={s.eta_manual ? fmtDayFull(new Date(s.eta_manual)) : '—'} hint={s.eta_manual_at ? `saisie ${fmtDayTime(new Date(s.eta_manual_at))}` : 'par l’équipe'} />
            <Fact label="Retenue" value={fmtDay(eta.date)} hint={eta.source ? ETA_SOURCE_LABEL[eta.source] : undefined} />
          </Facts>
          {s.eta_manual_note && <p className={cn('mt-4 border-t border-black/[0.06] pt-3 text-[12.5px] max-lg:text-[14px] leading-relaxed dark:border-white/[0.06]', TEXT.body)}>{s.eta_manual_note}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-black/[0.06] pt-3 dark:border-white/[0.06]">
            {arrived ? (
              <>
                <span className={cn('inline-flex items-center gap-1.5 text-[13px] max-lg:text-[15px] font-bold', TEXT.strong)}>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Arrivé au port de {arrivalPort(s)}
                </span>
                {s.status === 'ARRIVED' && <span className={cn('text-[12.5px] max-lg:text-[14px]', TEXT.muted)}>les colis du conteneur sont pointables à Douala</span>}
                {canManage && s.status === 'ARRIVED' && <span className="ml-auto"><ToolButton icon={Undo2} onClick={() => setDialog('unarrived')}>Annuler l'arrivée</ToolButton></span>}
              </>
            ) : (
              <>
                <span className={cn('text-[12.5px] max-lg:text-[14px] leading-relaxed', TEXT.body)}>
                  Pas encore arrivé{canMark ? ' : si l’armateur ne le signale pas, marquez-le — sinon Douala ne peut pas pointer les colis.' : '.'}
                </span>
                {canMark && <span className="ml-auto"><ToolButton icon={CheckCircle2} onClick={() => setDialog('arrived')}>Marquer arrivé</ToolButton></span>}
              </>
            )}
          </div>
        </Section>

        {etaHistory.length > 1 && (
          <Section icon={History} title="Estimations successives" subtitle="ce que l’armateur a annoncé, dans l’ordre">
            <ul className="space-y-1.5">
              {etaHistory.map((e) => (
                <li key={e.id} className={cn('flex items-center justify-between text-[13px] max-lg:text-[15px] tabular-nums', TEXT.body)}>
                  <span>{fmtDayTime(new Date(e.event_time))}</span>
                  <span className={cn('text-[12px]', TEXT.muted)}>reçue {fmtDay(new Date(e.created_at))}</span>
                </li>
              ))}
            </ul>
            <p className={cn('mt-3 text-[12px] max-lg:text-[14px]', TEXT.muted)}>Une date qui change d'un jour sur l'autre se confirme sur Atlas ou auprès du consignataire.</p>
          </Section>
        )}

        <Section icon={History} title="Dernier mouvement">
          {s.last_event_label ? (
            <>
              <p className={cn('text-[15px] max-lg:text-[16px] font-bold', TEXT.strong)}>{s.last_event_label}</p>
              <p className={cn('mt-1 text-[12.5px] max-lg:text-[14px]', TEXT.muted)}>{s.last_event_at ? fmtDayTime(new Date(s.last_event_at)) : '—'}</p>
            </>
          ) : (
            <Empty title="Rien de neuf" />
          )}
        </Section>
      </div>

      {dialog === 'eta' && <EtaDialog shipment={s} onClose={() => setDialog(null)} />}
      {dialog === 'calls' && <CallsDialog shipment={s} onClose={() => setDialog(null)} />}
      {dialog === 'arrived' && <MarkArrivedDialog shipment={s} onClose={() => setDialog(null)} />}
      {dialog === 'unarrived' && <UnmarkArrivedDialog shipment={s} onClose={() => setDialog(null)} />}
    </div>
  );
}
