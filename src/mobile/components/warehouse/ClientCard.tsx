// ============================================================
// ENTREPÔT — la carte du client en tête des écrans de remise (v2) :
// initiales, nom, code et téléphone, un tag à droite.
// ============================================================
import type { ReactNode } from 'react';
import { clientFullName, type ReceptionClient } from '@/lib/reception';
import { cn } from '@/lib/utils';
import { Initials, TEXT, Tag, type Tone } from '@/mobile/designKit';

export function WhClientCard({ client, sub, tag, className }: { client: ReceptionClient | null; sub?: ReactNode; tag?: { tone: Tone; label: ReactNode }; className?: string }) {
  const name = client ? clientFullName(client) : 'Client à attribuer';
  return (
    <div className={cn('flex items-center gap-3.5 rounded-lg border border-[#D9D9D9] px-4 py-3.5 dark:border-[#444444]', className)}>
      {client ? <Initials name={name} /> : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FFF1C2] text-[18px] font-semibold text-[#682D03]">?</span>}
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-[17px] font-semibold', TEXT.strong)}>{name}</span>
        <span className={cn('block truncate text-[15px] tabular-nums', TEXT.muted)}>{sub ?? [client?.customer_code, client?.phone].filter(Boolean).join(' · ')}</span>
      </span>
      {tag && <Tag tone={tag.tone}>{tag.label}</Tag>}
    </div>
  );
}
