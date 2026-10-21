/**
 * Analyses mobile v2 — le cadre commun des écrans : en-tête à « … », tirer
 * pour rafraîchir, et le gros chiffre.
 */
import * as React from 'react';
import { BigFigure, EmptyLine, MoreButton, ScreenTop, type Tone } from '@/mobile/designKit';
import { PullToRefresh } from '@/mobile/components/ui/PullToRefresh';
import { cn } from '@/lib/utils';
import { useAnalyticsUi, type ChartDataset } from './state';
import { PeriodBar } from './parts';
import { periodLabel } from './format';

/** Vrai tant que la page est tout en haut : le geste « tirer » n'agit qu'à ce moment. */
function useAtTop(): boolean {
  const [top, setTop] = React.useState(true);
  React.useEffect(() => {
    const on = () => setTop(window.scrollY <= 0);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return top;
}

export function ChartScreen({
  title, ds, children, backTo = '/m/dashboard', right,
}: {
  title: React.ReactNode;
  ds?: ChartDataset | null;
  children: React.ReactNode;
  backTo?: string;
  right?: React.ReactNode;
}) {
  const ui = useAnalyticsUi();
  const atTop = useAtTop();
  return (
    <div className="flex min-h-full flex-col bg-white pb-10 dark:bg-[#1E1E1E]">
      <ScreenTop
        title={title}
        backTo={backTo}
        right={<>{right}{ds && <MoreButton onClick={() => ui.open({ type: 'menu', ds })} />}</>}
      />
      <PullToRefresh onRefresh={ui.refresh} disabled={!atTop}>
        {children}
      </PullToRefresh>
    </div>
  );
}

/** La barre période + comparer, branchée sur l'état du module. */
export function Period({ compare = true, className }: { compare?: boolean; className?: string }) {
  const ui = useAnalyticsUi();
  return (
    <PeriodBar
      className={className}
      label={periodLabel(ui.range)}
      onPeriod={() => ui.open({ type: 'period' })}
      compare={ui.range.compareToPrevious}
      onCompare={compare ? () => ui.setCompare(!ui.range.compareToPrevious) : undefined}
    />
  );
}

/** Le gros chiffre en tête d'écran (sans carte). */
export function Figure({
  label, value, unit, delta, note, className,
}: {
  label?: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
  delta?: { tone: Tone; label: React.ReactNode };
  note?: React.ReactNode;
  className?: string;
}) {
  return <BigFigure className={cn('px-5 pt-5', className)} size="md" label={label} value={value} unit={unit} delta={delta} note={note} />;
}

/** Un état vide ou d'erreur, sobre. */
export function Empty({ error, onRetry, children }: { error?: boolean; onRetry?: () => void; children?: React.ReactNode }) {
  if (error) return <EmptyLine action={onRetry ? { label: 'Réessayer', onClick: onRetry } : undefined}>Les chiffres n'ont pas pu être chargés.</EmptyLine>;
  return <EmptyLine>{children ?? 'Rien sur la période.'}</EmptyLine>;
}
