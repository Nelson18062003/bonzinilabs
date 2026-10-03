// ============================================================
// L'historique d'un dépôt de colis, en une colonne : un point par
// événement, la date à gauche, la phrase à droite. Même composant sur
// mobile et desktop (il ne dépend que des classes du design kit mobile).
// ============================================================
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, Card } from '@/mobile/designKit';
import { formatDateTime } from '@/mobile/components/reception/bits';
import type { TimelineEvent } from '@/lib/parcelDepositTimeline';

const DOT: Record<TimelineEvent['tone'], string> = {
  neutral: 'bg-[#949494]',
  info: 'bg-[#0C8CE9]',
  pending: 'bg-[#E8B931]',
  success: 'bg-[#14AE5C]',
  danger: 'bg-[#EC221F]',
};

export function DepositTimeline({ events, flat }: { events: readonly TimelineEvent[]; flat?: boolean }) {
  if (events.length === 0) return null;
  const list = (
    <ol className="relative space-y-0">
      {events.map((e, i) => (
        <li key={`${e.kind}-${e.at}-${i}`} className="relative flex gap-3 py-2.5">
          <span className="relative flex w-3 shrink-0 justify-center">
            {i < events.length - 1 && <span className={cn('absolute top-4 h-full w-px', 'bg-[#D9D9D9] dark:bg-[#444444]')} aria-hidden="true" />}
            <span className={cn('relative mt-1.5 h-3 w-3 rounded-full ring-4 ring-white dark:ring-[#2C2C2C]', DOT[e.tone])} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className={cn('block', TYPE.body, TEXT.strong)}>{e.text}</span>
            <span className={cn('block tabular-nums', TYPE.small, TEXT.muted)}>{formatDateTime(e.at)}{e.detail ? ` · ${e.detail}` : ''}</span>
          </span>
        </li>
      ))}
    </ol>
  );
  if (flat) return list;
  return <Card className={cn('py-2', SURFACE.card)}>{list}</Card>;
}
