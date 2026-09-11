/**
 * Suivi jalon par jalon — même anatomie que le suivi des dépôts (panneau
 * desktop) : réel = coché, prévu = creux, le dernier réel = point courant.
 */
import { CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TEXT } from '@/desktop/designKit';
import { fmtDayTime } from '@/lib/cargo/model';
import type { TimelineItem } from '@/lib/cargo/model';

function Step({ item, state, last }: { item: TimelineItem; state: 'completed' | 'current' | 'pending'; last: boolean }) {
  const meta = [fmtDayTime(new Date(item.time)), item.location].filter(Boolean).join(' · ');
  return (
    <div className="flex gap-2.5">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
            state === 'completed'
              ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
              : state === 'current'
                ? 'border-primary text-primary'
                : cn('border-black/[0.12] dark:border-white/[0.15]', TEXT.muted),
          )}
        >
          {state === 'completed' && <CheckCircle className="h-3 w-3" />}
          {state === 'current' && <span className="h-2 w-2 rounded-full bg-current" />}
        </div>
        {!last && <div className={cn('my-0.5 w-0.5 flex-1', state === 'pending' ? 'bg-black/[0.08] dark:bg-white/[0.1]' : 'bg-emerald-400')} style={{ minHeight: 10 }} />}
      </div>
      <div className="flex min-w-0 flex-1 items-baseline justify-between gap-3 pb-2.5 max-sm:flex-col max-sm:gap-0.5">
        <div className="min-w-0">
          <p className={cn('text-[12.5px] font-semibold', state === 'pending' ? TEXT.muted : TEXT.strong)}>{item.label}</p>
          {item.vessel && <p className={cn('truncate text-[11px]', TEXT.muted)}>{item.vessel}</p>}
        </div>
        <p className={cn('shrink-0 text-[11px] tabular-nums max-sm:shrink', TEXT.muted)}>{meta}</p>
      </div>
    </div>
  );
}

export function CargoTimeline({ items, emptyLabel = 'Aucun jalon reçu pour l’instant.' }: { items: TimelineItem[]; emptyLabel?: string }) {
  if (items.length === 0) return <p className={cn('text-[12.5px]', TEXT.muted)}>{emptyLabel}</p>;
  const sorted = [...items].sort((a, b) => a.time.localeCompare(b.time));
  const lastActual = [...sorted].reverse().find((i) => i.classifier === 'ACT');
  return (
    <div>
      {sorted.map((it, i) => (
        <Step
          key={it.id}
          item={it}
          state={it.classifier !== 'ACT' ? 'pending' : it === lastActual ? 'current' : 'completed'}
          last={i === sorted.length - 1}
        />
      ))}
    </div>
  );
}
