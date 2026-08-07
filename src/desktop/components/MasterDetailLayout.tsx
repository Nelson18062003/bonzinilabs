import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { DS } from '@/desktop/ui/tokens';

/**
 * Legacy master–detail wrapper, kept for the screens that have not yet moved to
 * `Workbench` (which docks the inspector into the viewport instead of the page
 * flow). Restyled onto the console tokens — hairline, 12px radius, no shadow —
 * so a mixed-migration state still reads as one product.
 *
 * The mobile detail screens render their own canvas + cards, so the panel just
 * gives them a delineated, independently-scrolling column.
 */
export function MasterDetailLayout({
  children,
  detail,
}: {
  children: ReactNode;
  detail?: ReactNode | null;
}) {
  if (!detail) return <>{children}</>;
  return (
    <div className="flex gap-5">
      <div className="min-w-0 flex-1">{children}</div>
      <aside className="w-[min(440px,38vw)] shrink-0">
        <div className={cn('sticky top-[68px] overflow-hidden rounded-xl border', DS.card, DS.line)}>
          <div className="max-h-[calc(100vh-88px)] overflow-y-auto">{detail}</div>
        </div>
      </aside>
    </div>
  );
}
