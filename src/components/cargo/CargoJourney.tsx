/**
 * Le parcours en une ligne : les VRAIES escales du voyage (saisies par
 * l'équipe, sinon départ et arrivée), ce qui est fait, où est le navire, ce
 * qui reste. Plus de ligne WAX1 figée : la rotation change (en octobre 2026
 * le navire a touché Kribi AVANT Lekki), la fiche doit suivre.
 */
import { Ship } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TEXT } from '@/desktop/designKit';
import type { CargoShipment, CargoVesselPosition } from '@/lib/cargo/model';
import { callDateLine, callStates, voyageCalls, type CallState } from '@/lib/cargo/voyage';

const DOT: Record<CallState, string> = {
  done: 'border-foreground bg-foreground',
  here: 'border-emerald-500 bg-emerald-500 ring-4 ring-emerald-500/20',
  next: 'border-violet-600 bg-card ring-4 ring-violet-500/15',
  later: 'border-black/[0.25] bg-card dark:border-white/[0.3]',
  after: 'border-dashed border-black/[0.25] bg-card dark:border-white/[0.3]',
};

/** `position` reste accepté pour les appels existants : l'état vient des escales, pas d'une projection sur une ligne. */
export function CargoJourney({ shipment: s }: { shipment: CargoShipment; position?: CargoVesselPosition | null }) {
  const calls = voyageCalls(s);
  const states = callStates(calls);
  return (
    <ol className="flex items-start">
      {calls.map((c, i) => {
        const st = states[i];
        const last = i === calls.length - 1;
        const nextSt = states[i + 1];
        // Le segment vers l'escale suivante : plein si elle est atteinte, à moitié (navire dessus) si c'est la prochaine.
        const segment = nextSt === 'done' || nextSt === 'here' ? 'full' : nextSt === 'next' && (st === 'done' || st === 'here') ? 'half' : 'empty';
        return (
          <li key={c.id} className={cn('relative flex min-w-0 flex-1 flex-col items-start', st === 'after' && 'opacity-55')}>
            <div className="flex w-full items-center">
              <span className={cn('h-3.5 w-3.5 shrink-0 rounded-full border-2', DOT[st])} />
              {!last && (
                <span className={cn('relative mx-1 h-0.5 flex-1 rounded', nextSt === 'after' ? 'border-t-2 border-dashed border-black/[0.15] bg-transparent dark:border-white/[0.15]' : 'bg-black/[0.1] dark:bg-white/[0.12]')}>
                  {segment === 'full' && <span className="absolute inset-0 rounded bg-foreground" />}
                  {segment === 'half' && (
                    <>
                      <span className="absolute inset-y-0 left-0 w-1/2 rounded bg-foreground" />
                      <span className="absolute left-1/2 top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-violet-600 text-white ring-4 ring-violet-500/20">
                        <Ship className="h-3.5 w-3.5" />
                      </span>
                    </>
                  )}
                </span>
              )}
            </div>
            <div className="mt-2 min-w-0 max-w-full pr-2">
              <div className={cn('truncate text-[13px] max-lg:text-[15px] font-semibold', st === 'later' || st === 'after' ? TEXT.muted : TEXT.strong)}>
                {c.name}
                {st === 'here' && <span className="ml-1.5 rounded bg-emerald-50 px-1 py-px text-[10.5px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">ici</span>}
              </div>
              <div className={cn('text-[11.5px] max-lg:text-[13px] leading-snug', TEXT.muted)}>{callDateLine(c, st) ?? ' '}</div>
              {st === 'after' && <div className={cn('text-[11px] max-lg:text-[12.5px] italic', TEXT.muted)}>après notre déchargement</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
