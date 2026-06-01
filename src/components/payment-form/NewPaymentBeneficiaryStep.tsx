// ============================================================
// Step 3 — Beneficiary (payment wizard, client).
//
// Rebuilt for Lot 3 bis. Two tabs:
//   • "existing" — pick a saved beneficiary (alias-first list).
//   • "new"      — a self/other toggle + the shared <BeneficiaryForm/>.
//
// Reuses BeneficiaryForm (same hard validation / alias / CJK / QR as the
// carnet) instead of duplicating per-mode inputs. The page owns all
// state and the snapshot/payment payload; this component is presentational.
// "Complete later" (skip) stays available for non-cash modes.
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
      <div>
        <h2 className="text-lg font-semibold">{t('form.beneficiary.title')}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t('form.beneficiary.selectOrCreate')}
        </p>
      </div>

      {/* Existing / New tabs */}
      <div className="flex gap-1 bg-muted rounded-lg p-1">
        {(['existing', 'new'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onBeneficiaryTabChange(tab)}
            className={cn(
              'flex-1 h-9 rounded-md text-sm font-medium transition-colors',
              beneficiaryTab === tab
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground',
            )}
          >
            {t(`form.beneficiary.${tab === 'existing' ? 'existing' : 'new'}`)}
          </button>
        ))}
      </div>

      {beneficiaryTab === 'existing' ? (
        <div className="space-y-2">
          {!existingBeneficiaries || existingBeneficiaries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <User className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{t('form.beneficiary.noneRegistered')}</p>
              <button
                type="button"
                onClick={() => onBeneficiaryTabChange('new')}
                className="mt-2 text-sm text-primary font-medium"
              >
                {t('form.beneficiary.createNew')}
              </button>
            </div>
          ) : (
            existingBeneficiaries.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() =>
                  onSelectedBeneficiaryChange(selectedBeneficiary?.id === b.id ? null : b)
                }
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left',
                  selectedBeneficiary?.id === b.id ? 'border-primary bg-primary/5' : 'border-border',
                )}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm flex-shrink-0"
                  style={{ backgroundColor: modeColor(b.payment_method) }}
                >
                  {(b.alias || b.name)[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  {/* alias-first: the recognisable label on top, real account below */}
                  <p className="font-medium truncate">{b.alias || b.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {b.identifier || b.phone || b.bank_account || b.name || ''}
                  </p>
                </div>
                {selectedBeneficiary?.id === b.id && (
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Self / other toggle (all modes) */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onUseSelfChange(true)}
              className={cn(
                'flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-left',
                useSelf ? 'border-current' : 'border-border',
              )}
              style={useSelf ? { color: modeColor(selectedMethod) } : undefined}
            >
              <User className="w-5 h-5" />
              <span className="text-sm font-medium text-foreground">
                {t('form.beneficiary.myself')}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onUseSelfChange(false)}
              className={cn(
                'flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-left',
                !useSelf ? 'border-current' : 'border-border',
              )}
              style={!useSelf ? { color: modeColor(selectedMethod) } : undefined}
            >
              <User className="w-5 h-5" />
              <span className="text-sm font-medium text-foreground">
                {t('form.beneficiary.anotherPerson')}
              </span>
            </button>
          </div>

          {/* Soft duplicate hint: offer to reuse the saved match. */}
          {!cashSelfCard && duplicateMatch && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {tc('beneficiaries.duplicate.body', { alias: duplicateMatch.alias || duplicateMatch.name })}
              </p>
              <button
                type="button"
                onClick={() => {
                  onSelectedBeneficiaryChange(duplicateMatch);
                  onBeneficiaryTabChange('existing');
                }}
                className="mt-2 text-sm font-medium text-amber-900 dark:text-amber-100 underline"
              >
                {tc('beneficiaries.actions.useThis')}
              </button>
            </div>
          )}

          {cashSelfCard ? (
            // Cash + self: nothing to fill, just confirm it's the client.
            <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
                style={{ backgroundColor: modeColor('cash') }}
              >
                {(profile?.first_name?.[0] || 'M').toUpperCase()}
              </div>
              <div>
                <p className="font-medium">
                  {`${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() ||
                    t('form.beneficiary.myself')}
                </p>
                <p className="text-xs text-muted-foreground">{profile?.phone || ''}</p>
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
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={dontSave}
                  onChange={(e) => onDontSaveChange(e.target.checked)}
                  className="w-4 h-4 rounded border-border"
                />
                {t('form.beneficiary.dontSave')}
              </label>
            </>
          )}
        </div>
      )}

      {/* Complete later (not for cash) */}
      {!isCash && (
        <button
          type="button"
          onClick={onSkip}
          className="w-full py-3 text-muted-foreground font-medium hover:bg-secondary rounded-xl transition-colors"
        >
          {t('form.beneficiary.addLater')}
        </button>
      )}
    </div>
  );
}
