/**
 * DEV-ONLY maquette — options for Mola's "new conversation" control, in the
 * reference design language. The current control is an icon-only SquarePen,
 * which isn't discoverable for non-technical users. Rendered at
 * /screenshot.html?screen=mola-nav.
 */
import type { ReactNode } from 'react';
import { ArrowLeft, Bot, SquarePen, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

const HOLDER = 'bg-[#EDEAFA] text-[#2C2740] dark:bg-[#2F2C3D] dark:text-[#E7E5F0]';

function Circle({ children }: { children: ReactNode }) {
  return <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', HOLDER)}>{children}</div>;
}

function HeaderBar({ right }: { right: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[22px] bg-white px-3 py-2.5 shadow-[0_8px_30px_-12px_rgba(46,32,92,0.20)] dark:bg-[#211F2B] dark:shadow-none">
      <Circle><ArrowLeft className="h-4 w-4" /></Circle>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Circle><Bot className="h-4 w-4" /></Circle>
        <div className="min-w-0">
          <div className="text-[15px] font-bold leading-tight text-[#1B1A24] dark:text-[#F2F1F7]">Mola</div>
          <div className="truncate text-[11px] text-[#8E8BA0] dark:text-[#9B98AD]">Directeur des opérations</div>
        </div>
      </div>
      {right}
    </div>
  );
}

function Caption({ children, tone }: { children: ReactNode; tone?: 'bad' }) {
  return (
    <p className={cn('px-1 pt-1 text-[12px] font-semibold', tone === 'bad' ? 'text-[#B23A3A] dark:text-[#E79A9A]' : 'text-[#6B6880] dark:text-[#9B98AD]')}>
      {children}
    </p>
  );
}

export function MolaNav() {
  return (
    <div className="min-h-screen space-y-2 bg-[#ECEAF7] px-4 py-6 dark:bg-[#141320]">
      {/* AVANT */}
      <Caption tone="bad">Aujourd'hui — icône seule, non descriptive</Caption>
      <HeaderBar
        right={<Circle><SquarePen className="h-4 w-4" /></Circle>}
      />

      <div className="h-3" />

      {/* OPTION A */}
      <Caption>Option A — pilule libellée dans l'en-tête (toujours visible)</Caption>
      <HeaderBar
        right={
          <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#EDEAFA] px-3.5 py-2 text-[13px] font-bold text-[#2C2740] dark:bg-[#2F2C3D] dark:text-[#E7E5F0]">
            <Plus className="h-4 w-4" /> Nouvelle
          </div>
        }
      />

      <div className="h-3" />

      {/* OPTION B */}
      <Caption>Option B — bouton explicite sous l'en-tête (le plus clair)</Caption>
      <HeaderBar right={<Circle><Bot className="h-4 w-4 opacity-0" /></Circle>} />
      <button className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full bg-[#1C1B22] py-3 text-[14px] font-bold text-white dark:bg-[#F2F1F7] dark:text-[#1B1A24]">
        <Plus className="h-4 w-4" /> Nouvelle conversation
      </button>

      <div className="h-3" />

      {/* OPTION C */}
      <Caption>Option C — libellé complet dans l'en-tête (si la largeur le permet)</Caption>
      <HeaderBar
        right={
          <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#1C1B22] px-3 py-2 text-[12px] font-bold text-white dark:bg-[#F2F1F7] dark:text-[#1B1A24]">
            <Plus className="h-3.5 w-3.5" /> Nouvelle conv.
          </div>
        }
      />
    </div>
  );
}
