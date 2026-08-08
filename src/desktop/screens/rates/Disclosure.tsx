/**
 * Deferred section — a title the operator can open, and nothing else.
 *
 * The two blocks this screen defers (the trend chart, the country/tier
 * adjustments) are consulted a few times a month, so they cost one control
 * each instead of the twenty they carry open. The trigger is a `Button`
 * rather than a hand-styled row so its height, padding, radius, font and
 * focus ring all come from `CONTROL.page` — a full-width control is still a
 * control, and the previous version wrote `px-4 py-3 text-[13px]` by hand.
 */
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DS, DFG, CONTROL } from '@/desktop/ui/tokens';
import { Button, Panel } from '@/desktop/ui/primitives';

export function Disclosure({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Panel className="overflow-hidden">
      <div className="p-2">
        <Button
          variant="ghost"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="w-full justify-between"
        >
          {title}
          <ChevronDown
            className={cn(CONTROL.page.glyph, 'transition-transform', DFG.faint, !open && '-rotate-90')}
            aria-hidden
          />
        </Button>
      </div>
      {open ? <div className={cn('border-t p-3', DS.line)}>{children}</div> : null}
    </Panel>
  );
}
