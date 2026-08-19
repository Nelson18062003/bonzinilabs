/**
 * DEV-ONLY maquette — nouveau sélecteur date & heure (BzDateTimePicker)
 * dans son contexte réel : carte « Date de l'opération » de l'étape
 * montant des wizards admin Nouveau paiement (violet) et Nouveau
 * dépôt (vert). Harness : ?screen=dtp-payment | dtp-deposit
 */
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, Card } from '@/mobile/designKit';
import { OperationDateCard } from '@/mobile/components/OperationDateCard';
import { BzDateRangeField } from '@/mobile/components/BzDateRangeField';
import { Card as KitCard } from '@/mobile/designKit';

const VIOLET = '#8B5CF6';
const GREEN = '#10B981';

function Shell({ title, subtitle, amount, accent, children }: {
  title: string; subtitle: string; amount: string; accent: string; children: React.ReactNode;
}) {
  return (
    <div className={cn('mx-auto flex min-h-screen max-w-[420px] flex-col', SURFACE.canvas)}>
      <div className="flex items-center gap-3 px-4 pb-1 pt-4">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', SURFACE.card, SURFACE.shadow)}>
          <ArrowLeft className={cn('h-5 w-5', TEXT.strong)} />
        </div>
        <span className={cn('text-[17px] font-black', TEXT.strong)}>{title}</span>
      </div>
      <div className="px-4 pb-1 pt-3">
        <div className="flex gap-1.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i <= 2 ? accent : 'rgba(0,0,0,0.07)' }} />
          ))}
        </div>
      </div>
      <div className="flex-1 px-4 pb-8 pt-3">
        <div className={cn('mb-1 text-[22px] font-extrabold', TEXT.strong)}>Combien ?</div>
        <div className={cn('mb-3.5 text-[12px]', TEXT.muted)}>{subtitle}</div>
        <Card className={cn('mb-2.5 py-5 text-center', SURFACE.shadow)}>
          <div className="flex items-baseline justify-center gap-2">
            <span className={cn('text-[40px] font-black tracking-tight', TEXT.strong)}>{amount}</span>
            <span className={cn('text-[18px] font-bold', TEXT.muted)}>XAF</span>
          </div>
        </Card>
        {children}
      </div>
    </div>
  );
}

export function DtpPayment() {
  const [enabled, setEnabled] = useState(true);
  const [value, setValue] = useState('2026-08-14T09:30');
  return (
    <Shell title="Nouveau paiement" subtitle="Solde de Cedric junior : 102 310 XAF" amount="45 000" accent={VIOLET}>
      <OperationDateCard
        enabled={enabled}
        value={value}
        onToggle={(on, nowLocal) => { setEnabled(on); if (on && !value) setValue(nowLocal); }}
        onChange={setValue}
        accent={VIOLET}
      />
    </Shell>
  );
}

export function DtpDeposit() {
  const [enabled, setEnabled] = useState(true);
  const [value, setValue] = useState('2026-08-11T15:45');
  return (
    <Shell title="Nouveau dépôt" subtitle="Client : Aboyo — dépôt reçu il y a quelques jours" amount="250 000" accent={GREEN}>
      <OperationDateCard
        enabled={enabled}
        value={value}
        onToggle={(on, nowLocal) => { setEnabled(on); if (on && !value) setValue(nowLocal); }}
        onChange={setValue}
        accent={GREEN}
      />
    </Shell>
  );
}

export function DtpRange() {
  const [range, setRange] = useState({ from: '2026-08-04', to: '2026-08-14' });
  return (
    <div className={cn('mx-auto flex min-h-screen max-w-[420px] flex-col px-4 pt-6', SURFACE.canvas)}>
      <div className={cn('mb-3 text-[22px] font-extrabold', TEXT.strong)}>Filtres</div>
      <KitCard className={cn('space-y-2.5', SURFACE.shadow)}>
        <div className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>Période</div>
        <BzDateRangeField value={range} onChange={setRange} accent={GREEN} defaultOpen />
      </KitCard>
    </div>
  );
}
