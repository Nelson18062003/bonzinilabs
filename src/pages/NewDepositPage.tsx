// ============================================================
// PAGE — NewDepositPage (wizard de dépôt), refonte « Direction A ».
// En-tête drill-in (retour rond + titre) · phases libellées (Montant ·
// Méthode · Confirmation, masquées sur l'écran Montant) · vrais logos de
// marque · récap = coordonnées Bonzini (où verser) + étapes + confirmation.
// Sélections en tap-to-advance. Logique 100% PRÉSERVÉE : étapes, sous-
// méthodes, banque/agence, getRecapInfo, doCreateDeposit (RPC), bornes
// 50 000 / 50 000 000 XAF.
// ============================================================
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Check, Copy, Loader2, Info, Clock, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { SURFACE, TEXT, PRIMARY_PILL } from '@/mobile/designKit';
import { DepositFamilyLogo, DepositBankLogo } from '@/mobile/components/deposits/DepositLogos';
import { formatNumber } from '@/lib/formatters';
import { useCreateDeposit } from '@/hooks/useDeposits';
import { useMyWallet } from '@/hooks/useWallet';
import { SUB_METHOD_TO_DB_METHOD, type DepositMethod } from '@/types/deposit';
import {
  methodFamilies,
  getSubMethodsForFamily,
  banks,
  agencies,
  orangeMoneyAccount,
  mtnMoneyAccount,
  waveAccount,
  omMerchantInfo,
  mtnMerchantInfo,
  familyRequiresSubMethod,
  subMethodRequiresBankSelection,
  getBankInfo,
  getAgencyInfo,
} from '@/data/depositMethodsData';
import type {
  DepositMethodFamily,
  DepositSubMethod,
  BankOption,
  AgencyOption,
} from '@/types/deposit';

type Step = 'amount' | 'family' | 'submethod' | 'bank' | 'agency' | 'recap' | 'creating';

const MIN_DEPOSIT_XAF = 50_000;
const MAX_DEPOSIT_XAF = 50_000_000;

const PHASES = ['Montant', 'Méthode', 'Confirmation'];
const phaseOf = (s: Step): number => (s === 'amount' ? 0 : s === 'recap' ? 2 : 1);

const NewDepositPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('deposits');
  const createDeposit = useCreateDeposit();
  const { data: wallet } = useMyWallet();

  // Flow state
  const [step, setStep] = useState<Step>('amount');
  const [amount, setAmount] = useState('');
  const [selectedFamily, setSelectedFamily] = useState<DepositMethodFamily | null>(null);
  const [selectedSubMethod, setSelectedSubMethod] = useState<DepositSubMethod | null>(null);
  const [selectedBank, setSelectedBank] = useState<BankOption | null>(null);
  const [selectedAgency, setSelectedAgency] = useState<AgencyOption | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const parsedAmount = Math.min(parseInt(amount) || 0, MAX_DEPOSIT_XAF);
  const newBalance = (wallet?.balance_xaf ?? 0) + parsedAmount;

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success(t('detail.copied'));
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error(t('detail.copyError'));
    }
  };

  // Map our internal types to the database deposit method format
  const getDepositMethod = (): DepositMethod => {
    if (selectedSubMethod) return SUB_METHOD_TO_DB_METHOD[selectedSubMethod];
    if (selectedFamily === 'AGENCY_BONZINI') return SUB_METHOD_TO_DB_METHOD['AGENCY_CASH'];
    if (selectedFamily === 'WAVE') return SUB_METHOD_TO_DB_METHOD['WAVE_TRANSFER'];
    return 'bank_transfer';
  };

  // Create deposit — only called from recap after explicit user confirmation
  const doCreateDeposit = async () => {
    setStep('creating');
    try {
      const deposit = await createDeposit.mutateAsync({
        amount_xaf: parseInt(amount),
        method: getDepositMethod(),
        bank_name: selectedBank || undefined,
        agency_name: selectedAgency || undefined,
      });

      toast.success(t('new.depositCreated'), {
        description: t('new.depositCreatedDesc', { reference: deposit.reference }),
      });

      // Navigate to deposit detail — proof upload is handled there
      navigate(`/deposits/${deposit.id}`, { state: { fromCreation: true } });
    } catch {
      // Error handled by mutation's onError — go back to recap
      setStep('recap');
    }
  };

  // Determine next step based on method family selection
  const handleFamilySelected = (family: DepositMethodFamily) => {
    setSelectedFamily(family);
    if (familyRequiresSubMethod(family)) {
      setStep('submethod');
    } else if (family === 'AGENCY_BONZINI') {
      setSelectedSubMethod('AGENCY_CASH');
      setStep('agency');
    } else if (family === 'WAVE') {
      setSelectedSubMethod('WAVE_TRANSFER');
      setStep('recap');
    }
  };

  const handleSubMethodSelected = (subMethod: DepositSubMethod) => {
    setSelectedSubMethod(subMethod);
    if (subMethodRequiresBankSelection(subMethod)) {
      setStep('bank');
    } else {
      setStep('recap');
    }
  };

  const handleBankSelected = (bank: BankOption) => {
    setSelectedBank(bank);
    setStep('recap');
  };

  const handleAgencySelected = (agency: AgencyOption) => {
    setSelectedAgency(agency);
    setStep('recap');
  };

  // Back navigation depends on the path taken
  const goBack = () => {
    switch (step) {
      case 'amount':
        navigate('/deposits');
        break;
      case 'family':
        setStep('amount');
        break;
      case 'submethod':
        setStep('family');
        break;
      case 'bank':
        setStep('submethod');
        break;
      case 'agency':
        setStep('family');
        break;
      case 'recap':
        if (selectedFamily === 'WAVE') setStep('family');
        else if (selectedFamily === 'AGENCY_BONZINI') setStep('agency');
        else if (selectedBank) setStep('bank');
        else setStep('submethod');
        break;
    }
  };

  // Build recap info with coordinates + instructions for the selected method
  const getRecapInfo = () => {
    if (!selectedFamily) return null;

    if (selectedFamily === 'BANK' && selectedBank) {
      const bankInfo = getBankInfo(selectedBank);
      return {
        title: selectedSubMethod === 'BANK_TRANSFER' ? t('new.recap.bankTransferTitle') : t('new.recap.bankCashTitle'),
        fields: [
          { label: t('new.recap.bank'), value: bankInfo?.bonziniAccount.bankName || '', key: 'bank' },
          { label: t('new.recap.accountNumber'), value: bankInfo?.bonziniAccount.accountNumber || '', key: 'account', mono: true },
          { label: t('new.recap.accountHolder'), value: bankInfo?.bonziniAccount.accountName || '', key: 'name' },
          { label: t('new.recap.iban'), value: bankInfo?.bonziniAccount.iban || '', key: 'iban', mono: true },
          { label: t('new.recap.swift'), value: bankInfo?.bonziniAccount.swift || '', key: 'swift', mono: true },
        ],
        merchantCode: undefined as string | undefined,
        instructions: selectedSubMethod === 'BANK_TRANSFER'
          ? [t('new.recap.bankTransferInstr1'), t('new.recap.bankTransferInstr2'), t('new.recap.bankTransferInstr3'), t('new.recap.bankTransferInstr4')]
          : [t('new.recap.bankCashInstr1', { bank: bankInfo?.label }), t('new.recap.bankCashInstr2'), t('new.recap.bankCashInstr3'), t('new.recap.bankCashInstr4')],
      };
    }

    if (selectedFamily === 'ORANGE_MONEY') {
      if (selectedSubMethod === 'OM_TRANSFER') {
        return {
          title: t('new.recap.omTransferTitle'),
          fields: [
            { label: t('new.recap.omNumber'), value: orangeMoneyAccount.phone, key: 'account', mono: true },
            { label: t('new.recap.accountHolder'), value: orangeMoneyAccount.accountName, key: 'name' },
          ],
          merchantCode: undefined as string | undefined,
          instructions: [
            t('new.recap.omTransferInstr1'),
            t('new.recap.omTransferInstr2', { phone: orangeMoneyAccount.phone }),
            t('new.recap.omTransferInstr3', { amount: `${formatNumber(parseInt(amount))} XAF` }),
            t('new.recap.omTransferInstr4'),
            t('new.recap.omTransferInstr5'),
          ],
        };
      } else {
        const merchantCodeWithAmount = omMerchantInfo.merchantCode.replace('MONTANT', amount);
        return {
          title: t('new.recap.omWithdrawalTitle'),
          fields: [{ label: t('new.recap.accountHolder'), value: omMerchantInfo.accountName, key: 'name' }],
          merchantCode: merchantCodeWithAmount,
          instructions: [t('new.recap.omWithdrawalInstr1'), t('new.recap.omWithdrawalInstr2'), t('new.recap.omWithdrawalInstr3')],
        };
      }
    }

    if (selectedFamily === 'MTN_MONEY') {
      if (selectedSubMethod === 'MTN_TRANSFER') {
        return {
          title: t('new.recap.mtnTransferTitle'),
          fields: [
            { label: t('new.recap.mtnNumber'), value: mtnMoneyAccount.phone, key: 'account', mono: true },
            { label: t('new.recap.accountHolder'), value: mtnMoneyAccount.accountName, key: 'name' },
          ],
          merchantCode: undefined as string | undefined,
          instructions: [
            t('new.recap.mtnTransferInstr1'),
            t('new.recap.mtnTransferInstr2'),
            t('new.recap.mtnTransferInstr3', { phone: mtnMoneyAccount.phone }),
            t('new.recap.mtnTransferInstr4', { amount: `${formatNumber(parseInt(amount))} XAF` }),
            t('new.recap.mtnTransferInstr5'),
          ],
        };
      } else {
        const merchantCodeWithAmount = mtnMerchantInfo.merchantCode.replace('MONTANT', amount);
        return {
          title: t('new.recap.mtnWithdrawalTitle'),
          fields: [{ label: t('new.recap.accountHolder'), value: mtnMerchantInfo.accountName, key: 'name' }],
          merchantCode: merchantCodeWithAmount,
          instructions: [t('new.recap.mtnWithdrawalInstr1'), t('new.recap.mtnWithdrawalInstr2'), t('new.recap.mtnWithdrawalInstr3')],
        };
      }
    }

    if (selectedFamily === 'AGENCY_BONZINI' && selectedAgency) {
      const agencyInfo = getAgencyInfo(selectedAgency);
      return {
        title: t('new.recap.agencyTitle'),
        fields: [
          { label: t('new.recap.agency'), value: agencyInfo?.label || '', key: 'agency' },
          { label: t('new.recap.address'), value: agencyInfo?.address || '', key: 'address' },
          { label: t('new.recap.hours'), value: agencyInfo?.hours || '', key: 'hours' },
        ],
        merchantCode: undefined as string | undefined,
        instructions: [
          t('new.recap.agencyInstr1', { agency: agencyInfo?.label }),
          t('new.recap.agencyInstr2'),
          t('new.recap.agencyInstr3'),
          t('new.recap.agencyInstr4'),
          t('new.recap.agencyInstr5'),
        ],
      };
    }

    if (selectedFamily === 'WAVE') {
      return {
        title: t('new.recap.waveTitle'),
        fields: [
          { label: t('new.recap.waveNumber'), value: waveAccount.phone, key: 'account', mono: true },
          { label: t('new.recap.accountHolder'), value: waveAccount.accountName, key: 'name' },
        ],
        merchantCode: undefined as string | undefined,
        instructions: [
          t('new.recap.waveInstr1'),
          t('new.recap.waveInstr2'),
          t('new.recap.waveInstr3', { phone: waveAccount.phone }),
          t('new.recap.waveInstr4', { amount: `${formatNumber(parseInt(amount))} XAF` }),
          t('new.recap.waveInstr5'),
        ],
      };
    }

    return null;
  };

  // ── Selection row (tap-to-advance) ──────────────────────────
  const SelectRow = ({
    logo,
    title,
    subtitle,
    extra,
    onClick,
  }: {
    logo: React.ReactNode;
    title: string;
    subtitle?: string;
    extra?: React.ReactNode;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className={cn('flex w-full items-center gap-4 rounded-[20px] p-4 text-left transition active:scale-[0.98]', SURFACE.card, SURFACE.shadow)}
    >
      {logo}
      <div className="min-w-0 flex-1">
        <p className={cn('text-[16px] font-bold leading-tight', TEXT.strong)}>{title}</p>
        {subtitle && <p className={cn('mt-0.5 text-[12px]', TEXT.muted)}>{subtitle}</p>}
        {extra}
      </div>
      <ArrowRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
    </button>
  );

  // ── Recap coordinate row ────────────────────────────────────
  const CoordRow = ({ label, value, mono, last, fieldKey }: { label: string; value: string; mono?: boolean; last?: boolean; fieldKey: string }) => (
    <button
      onClick={() => handleCopy(value, fieldKey)}
      className={cn('flex w-full items-center justify-between gap-3 py-3 text-left transition active:opacity-60', !last && 'border-b border-black/[0.05] dark:border-white/[0.07]')}
    >
      <div className="min-w-0">
        <div className={cn('text-[11px]', TEXT.muted)}>{label}</div>
        <div className={cn('mt-0.5 truncate text-[14px] font-bold', mono && 'font-mono', TEXT.strong)}>{value}</div>
      </div>
      {copiedField === fieldKey ? (
        <Check className="h-4 w-4 shrink-0 text-[#2E7D52] dark:text-[#7FCBA0]" />
      ) : (
        <Copy className={cn('h-4 w-4 shrink-0', TEXT.muted)} />
      )}
    </button>
  );

  // ── Step bodies ─────────────────────────────────────────────
  const renderBody = () => {
    if (step === 'amount') {
      return (
        <div className="animate-fade-in space-y-4">
          <div className={cn('rounded-[22px] p-5', SURFACE.card, SURFACE.shadow)}>
            <div className="flex items-center justify-between gap-2">
              <span className={cn('text-[12px] font-medium', TEXT.muted)}>{t('new.amountToDeposit')}</span>
              {wallet ? (
                <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums', SURFACE.holder)}>
                  Solde · {formatNumber(wallet.balance_xaf)} XAF
                </span>
              ) : null}
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              {/* eslint-disable-next-line no-restricted-syntax */}
              <input
                type="text"
                inputMode="numeric"
                value={amount ? formatNumber(parseInt(amount)) : ''}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="0"
                autoFocus
                className={cn('min-w-0 flex-1 bg-transparent text-[40px] font-black leading-none tabular-nums outline-none placeholder:text-[#C7C2D6] dark:placeholder:text-[#4A4658]', TEXT.strong)}
              />
              <span className="shrink-0 text-[18px] font-extrabold text-[#E8932A]">XAF</span>
            </div>
            {parsedAmount > 0 && (
              <div className="mt-4 rounded-2xl bg-[#EDEAFA] p-4 dark:bg-[#221F33]">
                <div className={cn('text-[12px]', TEXT.muted)}>Nouveau solde après dépôt</div>
                <div className={cn('mt-0.5 text-[24px] font-black tabular-nums', TEXT.strong)}>
                  {formatNumber(newBalance)} <span className="text-[14px]" style={{ color: '#E8932A' }}>XAF</span>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[100_000, 250_000, 500_000, 1_000_000].map((preset) => {
              const active = parsedAmount === preset;
              return (
                <button
                  key={preset}
                  onClick={() => setAmount(preset.toString())}
                  className={cn(
                    'rounded-xl py-2.5 text-[12px] font-bold transition-colors',
                    active ? 'bg-[#8B5CF6] text-white' : cn(SURFACE.card, SURFACE.shadow, TEXT.muted),
                  )}
                >
                  {preset >= 1_000_000 ? `${preset / 1_000_000}M` : `${preset / 1_000}K`}
                </button>
              );
            })}
          </div>

          <p className={cn('px-1 text-center text-[11px]', TEXT.muted)}>{t('new.minimumAmount')}</p>
        </div>
      );
    }

    if (step === 'family') {
      return (
        <div className="animate-fade-in space-y-3">
          <p className={cn('px-1 text-[15px] font-semibold', TEXT.strong)}>{t('new.howToDeposit')}</p>
          {methodFamilies.map((family) => (
            <SelectRow
              key={family.family}
              logo={<DepositFamilyLogo family={family.family} size={48} />}
              title={family.label}
              subtitle={family.description}
              onClick={() => handleFamilySelected(family.family)}
            />
          ))}
        </div>
      );
    }

    if (step === 'submethod' && selectedFamily) {
      return (
        <div className="animate-fade-in space-y-3">
          <p className={cn('px-1 text-[15px] font-semibold', TEXT.strong)}>{t('new.operationType')}</p>
          {getSubMethodsForFamily(selectedFamily).map((sm) => (
            <SelectRow
              key={sm.subMethod}
              logo={<DepositFamilyLogo family={selectedFamily} size={48} />}
              title={sm.label}
              subtitle={sm.description}
              onClick={() => handleSubMethodSelected(sm.subMethod)}
            />
          ))}
        </div>
      );
    }

    if (step === 'bank') {
      return (
        <div className="animate-fade-in space-y-3">
          <p className={cn('px-1 text-[15px] font-semibold', TEXT.strong)}>{t('new.chooseBank')}</p>
          {banks.map((bank) => (
            <SelectRow
              key={bank.bank}
              logo={<DepositBankLogo bank={bank.bank} size={48} />}
              title={bank.label}
              onClick={() => handleBankSelected(bank.bank)}
            />
          ))}
        </div>
      );
    }

    if (step === 'agency') {
      return (
        <div className="animate-fade-in space-y-3">
          <p className={cn('px-1 text-[15px] font-semibold', TEXT.strong)}>{t('new.chooseAgency')}</p>
          {agencies.map((agency) => (
            <SelectRow
              key={agency.agency}
              logo={<DepositFamilyLogo family="AGENCY_BONZINI" size={48} />}
              title={agency.label}
              subtitle={agency.address}
              extra={
                <p className={cn('mt-1 flex items-center gap-1 text-[12px]', TEXT.muted)}>
                  <Clock className="h-3 w-3" /> {agency.hours}
                </p>
              }
              onClick={() => handleAgencySelected(agency.agency)}
            />
          ))}
        </div>
      );
    }

    if (step === 'recap') {
      const info = getRecapInfo();
      if (!info) return null;
      return (
        <div className="animate-fade-in space-y-4">
          {/* Montant héros */}
          <div className={cn('rounded-[26px] p-6', SURFACE.card, SURFACE.shadow)}>
            <div className="flex items-center gap-2">
              <DepositFamilyLogo family={selectedFamily!} size={30} radius={9} />
              <span className={cn('text-[13px] font-bold', TEXT.strong)}>{info.title}</span>
            </div>
            <div className={cn('mt-5 text-[13px] font-semibold', TEXT.muted)}>Vous allez verser</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className={cn('text-[46px] font-black leading-none tracking-tight tabular-nums', TEXT.strong)}>{formatNumber(parseInt(amount))}</span>
              <span className="text-[18px] font-extrabold text-[#E8932A]">XAF</span>
            </div>
          </div>

          {/* Coordonnées Bonzini */}
          <section>
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className={cn('text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>{t('new.recap.depositCoordinates')}</h2>
            </div>
            <div className={cn('rounded-[22px] p-5', SURFACE.card, SURFACE.shadow)}>
              {info.fields.map((f, i) => (
                <CoordRow key={f.key} label={f.label} value={f.value} mono={f.mono} fieldKey={f.key} last={!info.merchantCode && i === info.fields.length - 1} />
              ))}
              {info.merchantCode && (
                <div className="pt-3">
                  <div className={cn('mb-2 text-[11px]', TEXT.muted)}>{t('new.recap.merchantCode')}</div>
                  <button
                    onClick={() => handleCopy(info.merchantCode!, 'merchant')}
                    className={cn('flex w-full items-center justify-between gap-3 rounded-2xl p-3.5 text-left', SURFACE.holder)}
                  >
                    <span className={cn('break-all font-mono text-[14px] font-bold', TEXT.strong)}>{info.merchantCode}</span>
                    {copiedField === 'merchant' ? <Check className="h-4 w-4 shrink-0 text-[#2E7D52] dark:text-[#7FCBA0]" /> : <Copy className={cn('h-4 w-4 shrink-0', TEXT.muted)} />}
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Étapes à suivre */}
          <section>
            <h2 className={cn('mb-2 px-1 text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>{t('new.recap.instructions')}</h2>
            <div className={cn('rounded-[22px] p-5', SURFACE.card, SURFACE.shadow)}>
              <ol className="space-y-3">
                {info.instructions.map((instruction, index) => (
                  <li key={index} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#EDEAFA] text-[12px] font-bold text-[#5B4CC4] dark:bg-[#221F33] dark:text-[#B5AAF0]">{index + 1}</span>
                    <span className={cn('pt-0.5 text-[13px]', TEXT.muted)}>{instruction}</span>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <div className="flex items-start gap-2.5 rounded-2xl bg-[#EAE7FA] p-3.5 dark:bg-[#272252]">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#5B4CC4] dark:text-[#B5AAF0]" />
            <p className="text-[12.5px] text-[#5B4CC4] dark:text-[#B5AAF0]">{t('new.recap.confirmNotice')}</p>
          </div>
        </div>
      );
    }

    if (step === 'creating') {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className={cn('flex h-20 w-20 items-center justify-center rounded-full', SURFACE.holder)}>
            <Loader2 className="h-9 w-9 animate-spin" />
          </div>
          <p className={cn('mt-6 text-[16px] font-bold', TEXT.strong)}>{t('new.creating')}</p>
          <p className={cn('mt-1 text-[13px]', TEXT.muted)}>{t('new.pleaseWait')}</p>
        </div>
      );
    }

    return null;
  };

  const amountValid = parsedAmount >= MIN_DEPOSIT_XAF;

  return (
    <MobileLayout showNav={false} showHeader={false}>
      <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
        {/* En-tête drill-in */}
        {step !== 'creating' && (
          <div className="flex items-center gap-3 px-4 pb-1 pt-4">
            <button
              onClick={goBack}
              aria-label={t('new.back')}
              className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition active:scale-95', SURFACE.card, SURFACE.shadow)}
            >
              <ArrowLeft className={cn('h-5 w-5', TEXT.strong)} />
            </button>
            <span className={cn('truncate text-[17px] font-black', TEXT.strong)}>{t('newDeposit')}</span>
          </div>
        )}

        {/* Phases — masquées sur Montant et Création */}
        {step !== 'amount' && step !== 'creating' && (
          <div className="px-4 pb-1 pt-3">
            <div className="flex gap-1.5">
              {PHASES.map((label, i) => {
                const done = i <= phaseOf(step);
                return (
                  <div key={label} className="flex flex-1 flex-col items-center gap-1.5">
                    <div className={cn('h-1.5 w-full rounded-full', done ? 'bg-[#8B5CF6]' : 'bg-black/[0.07] dark:bg-white/[0.09]')} />
                    <span className={cn('text-[10px] font-bold', done ? 'text-[#5B4CC4] dark:text-[#B5AAF0]' : TEXT.muted)}>{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex-1 px-4 py-4">{renderBody()}</div>

        {/* Pied — CTA seulement sur Montant et Récap */}
        {step === 'amount' && (
          <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
            <button
              onClick={() => amountValid && setStep('family')}
              disabled={!amountValid}
              className={cn(
                'flex w-full items-center justify-center gap-2 py-[15px] text-[15px] font-bold transition active:scale-[0.99]',
                amountValid ? PRIMARY_PILL : 'rounded-full bg-muted text-muted-foreground',
              )}
            >
              {t('new.continue')} <ArrowRight className="h-[17px] w-[17px]" />
            </button>
          </div>
        )}
        {step === 'recap' && (
          <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
            <button
              onClick={doCreateDeposit}
              disabled={createDeposit.isPending}
              className={cn('flex w-full items-center justify-center gap-2 py-[15px] text-[15px] font-bold transition active:scale-[0.99] disabled:opacity-60', PRIMARY_PILL)}
            >
              {createDeposit.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-[18px] w-[18px]" />}
              {t('new.recap.confirmButton')}
            </button>
          </div>
        )}
      </div>
    </MobileLayout>
  );
};

export default NewDepositPage;
