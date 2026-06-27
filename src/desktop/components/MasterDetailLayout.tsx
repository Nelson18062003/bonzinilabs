import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Desktop master-detail: the list (`children`) on the left and, when a row is
 * selected, the existing mobile detail screen in a sticky panel on the right —
 * so an operator can scan the list and read/act on a record without leaving the
 * page. When `detail` is null the list spans the full width.
 *
 * The mobile detail screens render their own canvas + white cards, so the panel
 * just wraps them in a delineating rounded container with the soft kit shadow,
 * and owns the scroll (their sticky header sticks to the top of the panel).
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
    <div className="flex gap-6">
      <div className="min-w-0 flex-1">{children}</div>
      <aside className="w-[min(460px,40vw)] shrink-0">
        <div
          className={cn(
            'sticky top-[84px] overflow-hidden rounded-[24px]',
            'shadow-[0_8px_30px_-12px_rgba(46,32,92,0.22)] ring-1 ring-black/[0.05]',
            'dark:shadow-none dark:ring-white/[0.06]',
          )}
        >
          <div className="max-h-[calc(100vh-104px)] overflow-y-auto">{detail}</div>
        </div>
      </aside>
    </div>
  );
}
