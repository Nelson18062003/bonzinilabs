// ============================================================
// RÉCEPTION — « Qui apporte le colis ? » Quatre cas du terrain, quatre
// grandes cartes : un transporteur, le client lui-même (retour du marché),
// quelqu'un pour lui (nom + téléphone), Bonzini qui est allé le chercher.
// Puis on ouvre le dépôt.
// ============================================================
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { BROUGHT_BY, initials, type BroughtBy } from '@/lib/reception';
import { useOpenDeposit } from '@/hooks/useReception';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { SURFACE, TEXT, TYPE, Card, FormField, Holder, PrimaryPill, TextInput } from '@/mobile/designKit';
import { LocationMark, StepHeader } from '@/mobile/components/reception/bits';
import { useReceptionLocation } from './useReceptionLocation';

export function ReceptionBroughtBy() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { t } = useLanguage();
  const { location } = useReceptionLocation();
  const open = useOpenDeposit();

  const clientId = params.get('client');
  const clientName = params.get('name') ?? '';
  const clientCode = params.get('code') ?? '';
  const [choice, setChoice] = useState<BroughtBy | null>(null);
  const [repName, setRepName] = useState('');
  const [repPhone, setRepPhone] = useState('');

  const canOpen = !!location && !!choice && (choice !== 'representative' || repName.trim().length > 0);

  const submit = async () => {
    if (!location || !choice) return;
    const dep = await open.mutateAsync({
      location,
      clientUserId: clientId,
      broughtBy: choice,
      representativeName: choice === 'representative' ? repName : undefined,
      representativePhone: choice === 'representative' ? repPhone : undefined,
    });
    navigate(`/r/deposit/${dep.id}`, { replace: true });
  };

  return (
    <div className={cn('flex h-[100dvh] flex-col', SURFACE.canvas)}>
      <MobileHeader title={t('rc_new_deposit')} showBack backTo="/r/new" />

      <div className="flex-1 space-y-6 overflow-y-auto px-5 pb-6 pt-5">
        <StepHeader step={2} total={3} title={t('rc_brought_title')} help={t('rc_s2_help')} />

        {/* Le client, en une ligne : on sait pour qui on travaille, sans que ça prenne l'écran. */}
        <button type="button" onClick={() => navigate('/r/new')} className={cn('flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left', SURFACE.inset)}>
          <Holder size="sm" tone={clientId ? 'neutral' : 'pending'}>{clientId ? initials(clientName) : '?'}</Holder>
          <span className={cn('min-w-0 flex-1 break-words', TYPE.bodyStrong, TEXT.strong)}>
            {clientId ? clientName : t('rc_unknown_client')}
            {clientCode && <span className={cn('ml-2 font-normal tabular-nums', TEXT.muted)}>{clientCode}</span>}
          </span>
          {location && <LocationMark location={location} size={24} />}
          <span className={cn('shrink-0', TYPE.smallStrong, TEXT.muted)}>{t('rc_change')}</span>
        </button>

        <div className="flex flex-col gap-3" role="radiogroup" aria-label={t('rc_brought_title')}>
          {BROUGHT_BY.map((b) => {
            const on = choice === b;
            return (
              <button
                key={b}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setChoice(b)}
                className={cn('flex min-h-[76px] w-full items-center gap-4 rounded-lg border px-4 py-4 text-left transition-colors', on ? 'border-[#2C2C2C] bg-[#F5F5F5] dark:border-[#E3E3E3] dark:bg-[#383838]' : cn(SURFACE.card, SURFACE.divider))}
              >
                <span className="min-w-0 flex-1">
                  <span className={cn('block', TYPE.bodyStrong, TEXT.strong)}>{t(`rc_by_${b}`)}</span>
                  <span className={cn('mt-0.5 block', TYPE.small, TEXT.muted)}>{t(`rc_by_${b}_hint`)}</span>
                </span>
                <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full border', on ? 'border-[#2C2C2C] bg-[#2C2C2C] text-white dark:border-[#E3E3E3] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]' : 'border-[#949494]')}>
                  {on && <Check className="h-4 w-4" strokeWidth={3} />}
                </span>
              </button>
            );
          })}
        </div>

        {choice === 'representative' && (
          <Card className="space-y-4">
            <FormField label={t('rc_rep_name')} htmlFor="rep-name">
              <TextInput id="rep-name" value={repName} onChange={(e) => setRepName(e.target.value)} autoCapitalize="words" className="h-12" />
            </FormField>
            <FormField label={t('rc_rep_phone')} htmlFor="rep-phone">
              <TextInput id="rep-phone" value={repPhone} onChange={(e) => setRepPhone(e.target.value)} inputMode="tel" className="h-12" />
            </FormField>
          </Card>
        )}
      </div>

      <div className={cn('shrink-0 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3', SURFACE.canvas)}>
        <PrimaryPill onClick={() => void submit()} disabled={!canOpen} loading={open.isPending} className="h-14 w-full text-[17px]">
          {t('rc_continue_next')}
        </PrimaryPill>
      </div>
    </div>
  );
}
