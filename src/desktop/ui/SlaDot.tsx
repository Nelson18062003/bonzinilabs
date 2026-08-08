/**
 * SLA age indicator — one 8px cell that says how long a record has been waiting.
 *
 * Two rules it has to satisfy at once:
 *  · **Never colour alone.** Green/amber/red at 6px is the textbook deuteranopia
 *    failure, and a `title` on a role-less span is not reliably announced. So the
 *    level is also encoded in *shape* — filled, hollow, haloed — and carries a
 *    real accessible name.
 *  · **Never strobe.** The overdue state pulses to draw the eye, but honours
 *    `prefers-reduced-motion`: an operator stares at these lists all day.
 */
import type { SlaLevel } from '@/lib/paymentSla';
import { cn } from '@/lib/utils';

const LABEL: Record<SlaLevel, string> = {
  fresh: 'Dans les délais',
  aging: 'Bientôt hors délai',
  overdue: 'Hors délai',
};

/**
 * Colour *and* shape per level — filled / hollow / haloed. Each half of every
 * pair is tuned for its own theme; the first pass reused one light-mode hex,
 * and #34d399 is 1.92:1 on white.
 */
const STYLE: Record<SlaLevel, string> = {
  fresh: 'bg-[#1F8A5B] dark:bg-[#5FD39A]',
  aging: 'border-[1.5px] border-[#B26A00] dark:border-[#E7B463]',
  overdue:
    'bg-[#C0342F] ring-2 ring-[#C0342F]/30 dark:bg-[#F08B86] dark:ring-[#F08B86]/30 animate-pulse motion-reduce:animate-none',
};

export function SlaDot({ level, className }: { level: SlaLevel; className?: string }) {
  return (
    <span
      role="img"
      aria-label={LABEL[level]}
      title={LABEL[level]}
      className={cn('inline-block h-2 w-2 shrink-0 rounded-full', STYLE[level], className)}
    />
  );
}
