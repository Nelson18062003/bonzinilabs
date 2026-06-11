// ============================================================
// Step 3 — Beneficiary (payment wizard, client).
// Refonte « Direction A » (designKit) : onglets existant/nouveau,
// liste alias-first, bascule moi-même/autre (anneau violet), indice
// de doublon (ambre = sens), carte cash+self, « compléter plus tard ».
// Le <BeneficiaryForm/> partagé est CONSERVÉ tel quel.
// Logique 100% PRÉSERVÉE : tous les props/handlers inchangés.
// ============================================================
import { useTranslation } from 'react-i18next';
import { Check, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Beneficiary } from '@/hooks/useBeneficiaries';
import type { useMyProfile } from '@/hooks/useProfile';
import {
  BeneficiaryForm,
  type BeneficiaryFormValues,
} from '@/components/beneficiary/BeneficiaryForm';
import { modeColor } from '@/lib/beneficiaries/labels';
import { SURFACE, TEXT, SOFT_PILL } from '@/mobile/designKit';
import type { PaymentMethodType } from './types';

type Profile = NonNullable<ReturnType<typeof useMyProfile>['data']>;

interface Props {
  selectedMethod: PaymentMethodType;
  profile: Profile | undefined;
  existingBeneficiaries: Beneficiary[] | undefined;
  beneficiaryTab: 'existing' | 'new';
  onBeneficiaryTabChange: (tab: 'existing' | 'new') => void;
  selectedBeneficiary: Beneficiary | null;
  onSelectedBeneficiaryChange: (b: Beneficiary | null) => void;
  /** "Me payer moi-même" — sets relation=self + prefills from profile. */
  useSelf: boolean;
  onUseSelfChange: (v: boolean) => void;
  formValues: BeneficiaryFormValues;
  onFormChange: (v: BeneficiaryFormValues) => void;
  dontSave: boolean;
  onDontSaveChange: (v: boolean) => void;
  /** A saved beneficiary that collides with the typed account (soft dedup). */
  duplicateMatch: Beneficiary | null;
  qrCodePreview: string | null;
  onQrFileSelect: (file: File) => void;
  onQrFileRemove: () => void;
  onSkip: () => void;
}

export function NewPaymentBeneficiaryStep({
  selectedMethod,
  profile,
  existingBeneficiaries,
  beneficiaryTab,
  onBeneficiaryTabChange,
  selectedBeneficiary,
  onSelectedBeneficiaryChange,
  useSelf,
  onUseSelfChange,
  formValues,
  onFormChange,
  dontSave,
  onDontSaveChange,
  duplicateMatch,
  qrCodePreview,
  onQrFileSelect,
  onQrFileRemove,
  onSkip,
}: Props) {
  const { t } = useTranslation('payments');
  const { t: tc } = useTranslation('client');

  const isCash = selectedMethod === 'cash';
  // Cash + self needs no account details (it's the client) → show a card.
  const cashSelfCard = isCash && useSelf;

  return (
    <div className="animate-fade-in space-y-4">
      <div className="px-1">
        <h2 className={cn('text-[18px] font-black', TEXT.strong)}>{t('form.beneficiary.title')}</h2>
        <p className={cn('mt-0.5 text-[13px]', TEXT.muted)}>{t('form.beneficiary.selectOrCreate')}</p>
      </div>

      {/* Existing / New tabs */}
      <div className={cn('inline-flex w-full items-center gap-1 rounded-full p-1', SURFACE.canvas)}>
        {(['existing', 'new'] as const).map((tab) => {
          const active = beneficiaryTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => onBeneficiaryTabChange(tab)}
              className={cn(
                'flex-1 rounded-full py-2 text-[13px] font-bold transition-colors',
                active ? cn('bg-white shadow-sm dark:bg-[#211F2B]', TEXT.strong) : TEXT.muted,
              )}
            >
              {t(`form.beneficiary.${tab === 'existing' ? 'existing' : 'new'}`)}
            </button>
          );
        })}
      </div>

      {beneficiaryTab === 'existing' ? (
        <div className="space-y-2.5">
          {!existingBeneficiaries || existingBeneficiaries.length === 0 ? (
            <div className={cn('rounded-[22px] p-8 text-center', SURFACE.card, SURFACE.shadow)}>
              <div className={cn('mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full', SURFACE.holder)}>
                <User className="h-6 w-6" />
              </div>
              <p className={cn('text-[14px]', TEXT.muted)}>{t('form.beneficiary.noneRegistered')}</p>
              <button
                type="button"
                onClick={() => onBeneficiaryTabChange('new')}
                className="mt-2 text-[14px] font-bold text-[#5B4CC4] dark:text-[#B5AAF0]"
              >
                {t('form.beneficiary.createNew')}
              </button>
            </div>
          ) : (
            existingBeneficiaries.map((b) => {
              const sel = selectedBeneficiary?.id === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => onSelectedBeneficiaryChange(sel ? null : b)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl p-3.5 text-left transition active:scale-[0.99]',
                    SURFACE.card,
                    SURFACE.shadow,
                    sel && 'ring-2 ring-[#8B5CF6]',
                  )}
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-white"
                    style={{ backgroundColor: modeColor(b.payment_method) }}
                  >
                    {(b.alias || b.name)[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    {/* alias-first: the recognisable label on top, real account below */}
                    <p className={cn('truncate text-[15px] font-bold', TEXT.strong)}>{b.alias || b.name}</p>
                    <p className={cn('truncate text-[12px]', TEXT.muted)}>
                      {b.identifier || b.phone || b.bank_account || b.name || ''}
                    </p>
                  </div>
                  {sel && (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#8B5CF6]">
                      <Check className="h-4 w-4 text-white" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Self / other toggle (all modes) */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => onUseSelfChange(true)}
              className={cn(
                'flex items-center gap-2 rounded-2xl p-3.5 text-left transition',
                SURFACE.card,
                SURFACE.shadow,
                useSelf && 'ring-2 ring-[#8B5CF6]',
              )}
            >
              <User className={cn('h-5 w-5', TEXT.muted)} />
              <span className={cn('text-[14px] font-semibold', TEXT.strong)}>{t('form.beneficiary.myself')}</span>
            </button>
            <button
              type="button"
              onClick={() => onUseSelfChange(false)}
              className={cn(
                'flex items-center gap-2 rounded-2xl p-3.5 text-left transition',
                SURFACE.card,
                SURFACE.shadow,
                !useSelf && 'ring-2 ring-[#8B5CF6]',
              )}
            >
              <User className={cn('h-5 w-5', TEXT.muted)} />
              <span className={cn('text-[14px] font-semibold', TEXT.strong)}>{t('form.beneficiary.anotherPerson')}</span>
            </button>
          </div>

          {/* Soft duplicate hint: offer to reuse the saved match. */}
          {!cashSelfCard && duplicateMatch && (
            <div className="rounded-2xl bg-[#FDF1DD] p-3.5 dark:bg-[#3A2F1A]">
              <p className="text-[13px] text-[#9A6B12] dark:text-[#E0B978]">
                {tc('beneficiaries.duplicate.body', { alias: duplicateMatch.alias || duplicateMatch.name })}
              </p>
              <button
                type="button"
                onClick={() => {
                  onSelectedBeneficiaryChange(duplicateMatch);
                  onBeneficiaryTabChange('existing');
                }}
                className="mt-2 text-[13px] font-bold text-[#7A5410] underline dark:text-[#E8C98C]"
              >
                {tc('beneficiaries.actions.useThis')}
              </button>
            </div>
          )}

          {cashSelfCard ? (
            // Cash + self: nothing to fill, just confirm it's the client.
            <div className={cn('flex items-center gap-3 rounded-2xl p-4', SURFACE.card, SURFACE.shadow)}>
              <div
                className="flex h-11 w-11 items-center justify-center rounded-full text-[16px] font-bold text-white"
                style={{ backgroundColor: modeColor('cash') }}
              >
                {(profile?.first_name?.[0] || 'M').toUpperCase()}
              </div>
              <div>
                <p className={cn('text-[15px] font-bold', TEXT.strong)}>
                  {`${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || t('form.beneficiary.myself')}
                </p>
                <p className={cn('text-[12px]', TEXT.muted)}>{profile?.phone || ''}</p>
              </div>
            </div>
          ) : (
            <>
              <BeneficiaryForm
                values={formValues}
                onChange={onFormChange}
                lockMode
                qrPreview={qrCodePreview}
                onQrSelect={onQrFileSelect}
                onQrRemove={onQrFileRemove}
              />
              {/* Ponctuel: don't persist this beneficiary to the carnet. */}
              <label className={cn('flex cursor-pointer items-center gap-2 text-[13px]', TEXT.muted)}>
                <input
                  type="checkbox"
                  checked={dontSave}
                  onChange={(e) => onDontSaveChange(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                {t('form.beneficiary.dontSave')}
              </label>
            </>
          )}
        </div>
      )}

      {/* Complete later (not for cash) */}
      {!isCash && (
        <button type="button" onClick={onSkip} className={cn('w-full py-3.5 text-[14px] font-semibold', SOFT_PILL)}>
          {t('form.beneficiary.addLater')}
        </button>
      )}
    </div>
  );
}
