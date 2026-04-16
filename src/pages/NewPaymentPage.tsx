import { useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StepProgressBar } from '@/components/payment-form/StepProgressBar';
import { PaymentMethodCard } from '@/components/payment-form/PaymentMethodCard';
import { SuccessScreen } from '@/components/payment-form/SuccessScreen';
import { formatXAF, formatRMB } from '@/lib/formatters';
import { useMyWallet } from '@/hooks/useWallet';
import { useClientRates } from '@/hooks/useDailyRates';
import { useMyProfile } from '@/hooks/useProfile';
import { calculateFinalRate, getBaseRate } from '@/lib/rateCalculation';
import type { PaymentMethodKey } from '@/types/rates';
import { useCreatePayment } from '@/hooks/usePayments';
import { useBeneficiaries, useCreateBeneficiary } from '@/hooks/useBeneficiaries';
import type { Beneficiary } from '@/hooks/useBeneficiaries';
import {
  Check,
  ArrowRightLeft,
  AlertCircle,
  Loader2,
  Upload,
  X,
  QrCode,
  Phone,
  Mail,
  CreditCard,
  User,
} from 'lucide-react';
import { PaymentMethodLogo } from '@/mobile/components/payments/PaymentMethodLogo';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { compressImage } from '@/lib/imageCompression';
import { toast } from 'sonner';

type Step = 'method' | 'amount' | 'beneficiary' | 'confirm';
type Currency = 'XAF' | 'RMB';
type PaymentMethodType = 'alipay' | 'wechat' | 'bank_transfer' | 'cash';
type IdentificationType = 'qr' | 'id' | 'email' | 'phone';

const STEP_KEYS: Step[] = ['method', 'amount', 'beneficiary', 'confirm'];
const PAYMENT_METHOD_IDS: PaymentMethodType[] = ['alipay', 'wechat', 'bank_transfer', 'cash'];

function toRateKey(method: PaymentMethodType | null): PaymentMethodKey {
  if (method === 'bank_transfer') return 'virement';
  if (method === 'alipay' || method === 'wechat' || method === 'cash') return method;
  return 'cash';
}

function clientCountryToRateKey(country: string | null | undefined): string {
  const map: Record<string, string> = {
    'Cameroun': 'cameroun', 'cameroun': 'cameroun',
    'Gabon': 'gabon', 'gabon': 'gabon',
    'Tchad': 'tchad', 'tchad': 'tchad',
    'Centrafrique': 'rca', 'RCA': 'rca', 'rca': 'rca',
    'Congo': 'congo', 'congo': 'congo',
    'Guinée Équatoriale': 'guinee', 'guinee': 'guinee',
  };
  return map[country || ''] ?? 'cameroun';
}

const QUICK_XAF = [100000, 250000, 500000, 1000000];
const QUICK_RMB = [1000, 2500, 5000, 10000];

const NewPaymentPage = () => {
  const { t } = useTranslation('payments');
  const navigate = useNavigate();
  const { data: wallet, isLoading: walletLoading } = useMyWallet();
  const { data: clientRatesData } = useClientRates();
  const { data: profile } = useMyProfile();
  const createPayment = useCreatePayment();
  const createBeneficiary = useCreateBeneficiary();

  const STEPS: { key: Step; label: string }[] = STEP_KEYS.map((key) => ({
    key,
    label: t(`form.steps.${key}`),
  }));

  const paymentMethods: { id: PaymentMethodType; label: string; description: string }[] = PAYMENT_METHOD_IDS.map((id) => ({
    id,
    label: t(`form.methods.${id}.label`),
    description: t(`form.methods.${id}.desc`),
  }));

  const [step, setStep] = useState<Step>('method');
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdPaymentId, setCreatedPaymentId] = useState<string | null>(null);

  // Step 1: Method
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType | null>(null);

  // Step 2: Amount
  const [currency, setCurrency] = useState<Currency>('XAF');
  const [inputAmount, setInputAmount] = useState('');

  // Step 3: Beneficiary
  const [beneficiaryTab, setBeneficiaryTab] = useState<'existing' | 'new'>('existing');
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<Beneficiary | null>(null);
  const [skipBeneficiary, setSkipBeneficiary] = useState(false);
  const [newBenefName, setNewBenefName] = useState('');
  const [newBenefPhone, setNewBenefPhone] = useState('');
  const [newBenefEmail, setNewBenefEmail] = useState('');
  const [newBenefIdType, setNewBenefIdType] = useState<IdentificationType>('qr');
  const [newBenefIdentifier, setNewBenefIdentifier] = useState('');
  const [newBenefBankName, setNewBenefBankName] = useState('');
  const [newBenefBankAccount, setNewBenefBankAccount] = useState('');
  const [newBenefBankExtra, setNewBenefBankExtra] = useState('');
  const [qrCodeFile, setQrCodeFile] = useState<File | null>(null);
  const [qrCodePreview, setQrCodePreview] = useState<string | null>(null);
  const [cashBenefType, setCashBenefType] = useState<'self' | 'other'>('self');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: existingBeneficiaries } = useBeneficiaries(selectedMethod || undefined);

  const clientCountryKey = useMemo(() => clientCountryToRateKey(profile?.country), [profile?.country]);

  // Rate calculation
  const rate = useMemo(() => {
    if (!clientRatesData?.activeRate) return 0.01167;
    const rateKey = toRateKey(selectedMethod);
    const baseRate = getBaseRate(clientRatesData.activeRate, rateKey);
    const countryAdj = clientRatesData.adjustments.find(a => a.type === 'country' && a.key === clientCountryKey);
    const countryPct = countryAdj?.percentage ?? 0;
    const tierAdjs = clientRatesData.adjustments
      .filter(a => a.type === 'tier')
      .map(a => ({ key: a.key, percentage: a.percentage }));
    let prelimXAF: number;
    if (currency === 'XAF') {
      prelimXAF = parseInt(inputAmount) || 1_000_000;
    } else {
      const baseRateDecimal = baseRate * (1 + countryPct / 100) / 1_000_000;
      prelimXAF = baseRateDecimal > 0
        ? Math.round((parseFloat(inputAmount) || 0) / baseRateDecimal)
        : 1_000_000;
    }
    const result = calculateFinalRate(baseRate, countryPct, prelimXAF, tierAdjs);
    return result.finalRate / 1_000_000;
  }, [clientRatesData, selectedMethod, currency, inputAmount, clientCountryKey]);

  const amountXAF = currency === 'XAF'
    ? parseInt(inputAmount) || 0
    : rate > 0 ? Math.round((parseFloat(inputAmount) || 0) / rate) : 0;

  const amountRMB = currency === 'RMB'
    ? parseFloat(inputAmount) || 0
    : Math.round(amountXAF * rate * 100) / 100;

  const hasEnoughBalance = amountXAF <= (wallet?.balance_xaf || 0);
  const isValidAmount = amountXAF >= 10000 && amountXAF <= 50_000_000 && Number.isSafeInteger(amountXAF);
  const showRate = amountXAF >= 10000;
  const balanceAfter = (wallet?.balance_xaf || 0) - amountXAF;

  const handleQrFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setQrCodeFile(file); setQrCodePreview(URL.createObjectURL(file)); }
  };

  const removeQrFile = () => {
    if (qrCodePreview) URL.revokeObjectURL(qrCodePreview);
    setQrCodeFile(null); setQrCodePreview(null);
  };

  const currentStepIndex = STEPS.findIndex(s => s.key === step);

  const getBeneficiarySnapshot = (): Record<string, unknown> | undefined => {
    if (skipBeneficiary) return undefined;
    if (selectedBeneficiary) {
      return { id: selectedBeneficiary.id, name: selectedBeneficiary.name, payment_method: selectedBeneficiary.payment_method,
        identifier: selectedBeneficiary.identifier, identifier_type: selectedBeneficiary.identifier_type,
        phone: selectedBeneficiary.phone, email: selectedBeneficiary.email,
        bank_name: selectedBeneficiary.bank_name, bank_account: selectedBeneficiary.bank_account };
    }
    if (selectedMethod === 'cash') {
      return { type: cashBenefType,
        name: cashBenefType === 'self' ? `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() : newBenefName,
        phone: cashBenefType === 'self' ? profile?.phone : newBenefPhone };
    }
    if (selectedMethod === 'alipay' || selectedMethod === 'wechat') {
      return { name: newBenefName, identifier: newBenefIdentifier, identifier_type: newBenefIdType, phone: newBenefPhone, email: newBenefEmail };
    }
    if (selectedMethod === 'bank_transfer') {
      return { name: newBenefName, bank_name: newBenefBankName, bank_account: newBenefBankAccount, bank_extra: newBenefBankExtra };
    }
    return undefined;
  };

  const handleSubmit = async () => {
    if (!selectedMethod || !isValidAmount || !hasEnoughBalance) return;

    try {
      let beneficiaryId: string | undefined = selectedBeneficiary?.id;

      let qrCodeUrl: string | undefined;
      if (qrCodeFile) {
        const compressed = await compressImage(qrCodeFile);
        const filePath = `qr-codes/${Date.now()}_${compressed.name}`;
        const { error: uploadError } = await supabase.storage.from('payment-proofs').upload(filePath, compressed);
        if (uploadError) {
          toast.error(t('form.qrUploadError'));
          return;
        }
        qrCodeUrl = `payment-proofs/${filePath}`;
      }

      if (!skipBeneficiary && !selectedBeneficiary && newBenefName) {
        try {
          const newBenef = await createBeneficiary.mutateAsync({
            payment_method: selectedMethod,
            name: newBenefName,
            identifier: newBenefIdentifier || undefined,
            identifier_type: newBenefIdType || undefined,
            phone: newBenefPhone || undefined, email: newBenefEmail || undefined,
            bank_name: newBenefBankName || undefined, bank_account: newBenefBankAccount || undefined,
            bank_extra: newBenefBankExtra || undefined, qr_code_file: qrCodeFile || undefined,
          });
          beneficiaryId = newBenef.id;
        } catch { /* continue */ }
      }

      const snapshot = getBeneficiarySnapshot();
      const isCash = selectedMethod === 'cash';
      const legacyBenefName = isCash
        ? (cashBenefType === 'self' ? `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() : newBenefName)
        : (snapshot?.name as string || undefined);

      const result = await createPayment.mutateAsync({
        amount_xaf: amountXAF, amount_rmb: amountRMB, exchange_rate: Math.round(rate * 1_000_000), method: selectedMethod,
        beneficiary_name: legacyBenefName || undefined,
        beneficiary_phone: isCash ? (cashBenefType === 'self' ? profile?.phone || undefined : newBenefPhone || undefined) : (snapshot?.phone as string || undefined),
        beneficiary_email: snapshot?.email as string || undefined,
        beneficiary_qr_code_url: qrCodeUrl || undefined,
        beneficiary_bank_name: snapshot?.bank_name as string || undefined,
        beneficiary_bank_account: snapshot?.bank_account as string || undefined,
        cash_beneficiary_type: isCash ? cashBenefType : undefined,
        cash_beneficiary_first_name: isCash && cashBenefType === 'self' ? profile?.first_name : (isCash ? newBenefName.split(' ')[0] : undefined),
        cash_beneficiary_last_name: isCash && cashBenefType === 'self' ? profile?.last_name : (isCash ? newBenefName.split(' ').slice(1).join(' ') : undefined),
        cash_beneficiary_phone: isCash ? (cashBenefType === 'self' ? profile?.phone || undefined : newBenefPhone || undefined) : undefined,
        beneficiary_id: beneficiaryId, beneficiary_details: snapshot, rate_is_custom: false,
      });

      if (result.payment_id) setCreatedPaymentId(result.payment_id);
      setShowSuccess(true);
    } catch { /* Error handled by mutation */ }
  };

  // ── Success ──
  if (showSuccess) {
    return (
      <MobileLayout showNav={false}>
        <SuccessScreen
          variant="client"
          amountXAF={amountXAF}
          amountRMB={amountRMB}
          method={selectedMethod || 'cash'}
          onViewPayment={() => navigate(createdPaymentId ? `/payments/${createdPaymentId}` : '/payments')}
          onNewPayment={() => navigate('/payments')}
          onGoBack={() => navigate('/wallet')}
        />
      </MobileLayout>
    );
  }

  // ── Step 1: Method ──
  const renderMethodStep = () => (
    <div className="animate-fade-in space-y-4">
      <p className="text-sm text-muted-foreground mb-4">{t('form.howToReceive')}</p>
      {paymentMethods.map((method) => (
        <PaymentMethodCard
          key={method.id}
          method={method.id}
          label={method.label}
          description={method.description}
          isSelected={selectedMethod === method.id}
          onSelect={() => setSelectedMethod(method.id)}
        />
      ))}
    </div>
  );

  // ── Step 2: Amount ──
  const renderAmountStep = () => (
    <div className="animate-fade-in space-y-6">
      {showRate && (
        <div className="card-glass p-4 text-center">
          <p className="text-sm text-muted-foreground mb-1">{t('form.rateApplied')}</p>
          <p className="text-lg font-bold text-foreground">1 000 000 XAF = ¥{formatRMB(1000000 * rate)}</p>
        </div>
      )}

      <Tabs value={currency} onValueChange={(v) => { setCurrency(v as Currency); setInputAmount(''); }}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="XAF">Par XAF</TabsTrigger>
          <TabsTrigger value="RMB">Par RMB</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="card-primary p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-primary-foreground/70 text-sm">{currency === 'XAF' ? 'Vous envoyez' : 'Bénéficiaire reçoit'}</span>
          {!walletLoading && wallet && (
            <span className="text-primary-foreground/70 text-sm">Solde: {formatXAF(wallet.balance_xaf)} XAF</span>
          )}
        </div>
        <div className="flex items-center justify-center gap-2 mb-4">
          <input type="text" inputMode="numeric" value={inputAmount}
            onChange={(e) => setInputAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="0" className="amount-input text-primary-foreground placeholder:text-primary-foreground/30" />
          <span className="text-xl font-medium text-primary-foreground/70">{currency}</span>
        </div>
        <div className="flex items-center justify-center gap-3 py-3 border-t border-primary-foreground/10">
          <ArrowRightLeft className="w-5 h-5 text-primary-foreground/50" />
        </div>
        <div className="text-center">
          <span className="text-primary-foreground/70 text-sm">{currency === 'XAF' ? 'Bénéficiaire reçoit' : 'Montant débité'}</span>
          <p className="text-3xl font-bold text-primary-foreground mt-1">
            {currency === 'XAF'
              ? `¥${formatRMB(amountRMB)}`
              : <>{formatXAF(amountXAF)}<span className="text-lg font-medium text-primary-foreground/70 ml-2">XAF</span></>}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {(currency === 'XAF' ? QUICK_XAF : QUICK_RMB).map((preset) => (
          <button key={preset} onClick={() => setInputAmount(preset.toString())}
            className={cn('py-3 rounded-xl font-medium transition-colors text-sm',
              inputAmount === preset.toString() ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground hover:bg-secondary/80')}>
            {currency === 'XAF' ? (preset >= 1000000 ? `${preset / 1000000}M` : `${formatXAF(preset)}`) : `¥${preset.toLocaleString('fr-FR')}`}
          </button>
        ))}
      </div>

      {!hasEnoughBalance && isValidAmount && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div className="flex-1">
            <span>Solde insuffisant.</span>
            <button onClick={() => navigate('/deposits/new')} className="ml-1 underline font-medium">Ajouter de l'argent</button>
          </div>
        </div>
      )}
    </div>
  );

  // ── Step 3: Beneficiary ──
  const renderBeneficiaryStep = () => {
    const isCash = selectedMethod === 'cash';
    const isAlipayWechat = selectedMethod === 'alipay' || selectedMethod === 'wechat';
    const isBankTransfer = selectedMethod === 'bank_transfer';

    return (
      <div className="animate-fade-in space-y-4">
        <div>
          <h2 className="text-lg font-semibold">{isCash ? 'Qui va récupérer le cash ?' : 'Informations du bénéficiaire'}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isCash ? 'Cette personne devra présenter le QR Code au bureau Bonzini.' : 'Sélectionnez un bénéficiaire existant ou créez-en un nouveau.'}
          </p>
        </div>

        <div className="flex gap-1 bg-muted rounded-lg p-1">
          <button onClick={() => setBeneficiaryTab('existing')}
            className={cn('flex-1 h-9 rounded-md text-sm font-medium transition-colors',
              beneficiaryTab === 'existing' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground')}>Existant</button>
          <button onClick={() => setBeneficiaryTab('new')}
            className={cn('flex-1 h-9 rounded-md text-sm font-medium transition-colors',
              beneficiaryTab === 'new' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground')}>Nouveau</button>
        </div>

        {beneficiaryTab === 'existing' ? (
          <div className="space-y-2">
            {!existingBeneficiaries || existingBeneficiaries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <User className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Aucun bénéficiaire enregistré</p>
                <button onClick={() => setBeneficiaryTab('new')} className="mt-2 text-sm text-primary font-medium">Créer un nouveau</button>
              </div>
            ) : existingBeneficiaries.map((b) => (
              <button key={b.id} onClick={() => setSelectedBeneficiary(selectedBeneficiary?.id === b.id ? null : b)}
                className={cn('w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left',
                  selectedBeneficiary?.id === b.id ? 'border-primary bg-primary/5' : 'border-border')}>
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">{b.name[0]?.toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{b.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{b.identifier || b.phone || b.bank_account || b.email || ''}</p>
                </div>
                {selectedBeneficiary?.id === b.id && (
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0"><Check className="w-4 h-4 text-primary-foreground" /></div>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {isCash && (
              <>
                <div className="space-y-2">
                  <button onClick={() => setCashBenefType('self')}
                    className={cn('w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all',
                      cashBenefType === 'self' ? 'border-[#dc2626] bg-red-50/50' : 'border-border hover:border-primary/50')}>
                    <User className="w-5 h-5 text-muted-foreground" />
                    <div className="flex-1 text-left">
                      <p className="font-medium">Moi-même</p>
                      {profile && <p className="text-xs text-muted-foreground">{profile.first_name} {profile.last_name}</p>}
                    </div>
                  </button>
                  <button onClick={() => setCashBenefType('other')}
                    className={cn('w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all',
                      cashBenefType === 'other' ? 'border-[#dc2626] bg-red-50/50' : 'border-border hover:border-primary/50')}>
                    <User className="w-5 h-5 text-muted-foreground" />
                    <div className="text-left"><p className="font-medium">Une autre personne</p><p className="text-xs text-muted-foreground">Indiquez ses coordonnées</p></div>
                  </button>
                </div>
                {cashBenefType === 'other' && (
                  <div className="space-y-3 p-4 rounded-xl bg-muted/50">
                    <div><label className="text-sm font-medium mb-1 block">Nom complet *</label>
                      <input type="text" value={newBenefName} onChange={(e) => setNewBenefName(e.target.value)} placeholder="Nom du bénéficiaire"
                        className="w-full h-12 px-4 rounded-xl border border-border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary" /></div>
                    <div><label className="text-sm font-medium mb-1 block">Téléphone *</label>
                      <input type="tel" value={newBenefPhone} onChange={(e) => setNewBenefPhone(e.target.value)} placeholder="+86..."
                        className="w-full h-12 px-4 rounded-xl border border-border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary" /></div>
                    <div><label className="text-sm font-medium mb-1 block">Email (optionnel)</label>
                      <input type="email" value={newBenefEmail} onChange={(e) => setNewBenefEmail(e.target.value)} placeholder="email@exemple.com"
                        className="w-full h-12 px-4 rounded-xl border border-border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary" /></div>
                  </div>
                )}
              </>
            )}

            {isAlipayWechat && (
              <>
                <div className="space-y-3">
                  {qrCodePreview ? (
                    <div className="relative w-32 h-32 mx-auto rounded-xl overflow-hidden">
                      <img src={qrCodePreview} alt="" className="w-full h-full object-cover" />
                      <button onClick={removeQrFile} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center">
                        <X className="w-4 h-4 text-white" /></button>
                    </div>
                  ) : (
                    <label className="block w-full h-24 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors">
                      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleQrFileChange} className="hidden" />
                      <div className="h-full flex flex-col items-center justify-center gap-2">
                        <Upload className="w-6 h-6 text-muted-foreground" /><p className="text-sm text-muted-foreground">Ajouter le QR code</p>
                      </div>
                    </label>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Ou renseignez les infos</span></div>
                </div>
                <div><label className="text-sm font-medium mb-1 block">Nom du bénéficiaire</label>
                  <input type="text" value={newBenefName} onChange={(e) => setNewBenefName(e.target.value)} placeholder="Nom complet"
                    className="w-full h-12 px-4 rounded-xl border border-border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary" /></div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Type d'identification</label>
                  <div className="grid grid-cols-4 gap-2">
                    {([
                      { key: 'qr' as const, icon: QrCode, label: 'QR' },
                      { key: 'id' as const, icon: CreditCard, label: 'ID' },
                      { key: 'email' as const, icon: Mail, label: 'Email' },
                      { key: 'phone' as const, icon: Phone, label: 'Tél.' },
                    ]).map((t) => (
                      <button key={t.key} onClick={() => setNewBenefIdType(t.key)}
                        className={cn('flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-colors',
                          newBenefIdType === t.key ? 'border-primary bg-primary/5' : 'border-border')}>
                        <t.icon className="w-5 h-5" /><span className="text-xs font-medium">{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {newBenefIdType !== 'qr' && (
                  <div><label className="text-sm font-medium mb-1 block">
                    {newBenefIdType === 'id' ? 'Identifiant' : newBenefIdType === 'email' ? 'Email' : 'Téléphone'}</label>
                    <input type={newBenefIdType === 'email' ? 'email' : newBenefIdType === 'phone' ? 'tel' : 'text'}
                      value={newBenefIdentifier} onChange={(e) => setNewBenefIdentifier(e.target.value)}
                      placeholder={newBenefIdType === 'id' ? 'ID Alipay/WeChat' : newBenefIdType === 'email' ? 'email@exemple.com' : '+86...'}
                      className="w-full h-12 px-4 rounded-xl border border-border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary" /></div>
                )}
              </>
            )}

            {isBankTransfer && (
              <>
                <div><label className="text-sm font-medium mb-1 block">Nom du bénéficiaire *</label>
                  <input type="text" value={newBenefName} onChange={(e) => setNewBenefName(e.target.value)} placeholder="Nom complet"
                    className="w-full h-12 px-4 rounded-xl border border-border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary" /></div>
                <div><label className="text-sm font-medium mb-1 block">Banque *</label>
                  <input type="text" value={newBenefBankName} onChange={(e) => setNewBenefBankName(e.target.value)} placeholder="Nom de la banque"
                    className="w-full h-12 px-4 rounded-xl border border-border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary" /></div>
                <div><label className="text-sm font-medium mb-1 block">Numéro de compte *</label>
                  <input type="text" value={newBenefBankAccount} onChange={(e) => setNewBenefBankAccount(e.target.value)} placeholder="Numéro de compte"
                    className="w-full h-12 px-4 rounded-xl border border-border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary" /></div>
                <div><label className="text-sm font-medium mb-1 block">Infos complémentaires</label>
                  <input type="text" value={newBenefBankExtra} onChange={(e) => setNewBenefBankExtra(e.target.value)} placeholder="SWIFT, agence, etc."
                    className="w-full h-12 px-4 rounded-xl border border-border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary" /></div>
              </>
            )}
          </div>
        )}

        {!isCash && (
          <button onClick={() => { setSkipBeneficiary(true); setStep('confirm'); }}
            className="w-full py-3 text-muted-foreground font-medium hover:bg-secondary rounded-xl transition-colors">
            Ajouter plus tard
          </button>
        )}
      </div>
    );
  };

  // ── Step 4: Confirm ──
  const renderConfirmStep = () => {
    const methodInfo = paymentMethods.find(m => m.id === selectedMethod);
    const benefSnapshot = getBeneficiarySnapshot();
    const hasBenef = !skipBeneficiary && (selectedBeneficiary || newBenefName || (selectedMethod === 'cash' && cashBenefType === 'self'));

    return (
      <div className="animate-fade-in space-y-6">
        <div className="card-elevated p-6 text-center">
          <div className="flex justify-center mb-4"><PaymentMethodLogo method={selectedMethod || 'alipay'} size={64} /></div>
          <p className="text-sm text-muted-foreground">Vous envoyez</p>
          <p className="text-3xl font-bold text-foreground mb-1">¥{formatRMB(amountRMB)}</p>
          <p className="text-sm text-muted-foreground">({formatXAF(amountXAF)} XAF)</p>
        </div>

        <div className="card-elevated p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Méthode</span><span className="font-medium">{methodInfo?.label}</span>
          </div>
          {showRate && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Taux</span><span className="font-medium">1M XAF = ¥{formatRMB(1000000 * rate)}</span>
            </div>
          )}
          {benefSnapshot?.name && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Bénéficiaire</span><span className="font-medium">{benefSnapshot.name as string}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <span className="font-semibold">Montant débité</span><span className="font-bold">{formatXAF(amountXAF)} XAF</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Nouveau solde</span><span className="font-medium">{formatXAF(balanceAfter)} XAF</span>
          </div>
        </div>

        {!hasBenef && selectedMethod !== 'cash' && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-yellow-500/10 text-yellow-600 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>Vous pourrez ajouter les informations du bénéficiaire après la création.</span>
          </div>
        )}
        <p className="text-xs text-center text-muted-foreground">En confirmant, {formatXAF(amountXAF)} XAF seront débités de votre solde.</p>
      </div>
    );
  };

  const getFooterButton = () => {
    switch (step) {
      case 'method': return { label: 'Continuer', disabled: !selectedMethod, onClick: () => setStep('amount') };
      case 'amount': return { label: 'Continuer', disabled: !isValidAmount || !hasEnoughBalance, onClick: () => setStep('beneficiary') };
      case 'beneficiary': return { label: 'Continuer', disabled: false, onClick: () => { setSkipBeneficiary(false); setStep('confirm'); } };
      case 'confirm': return { label: createPayment.isPending ? 'Création...' : 'Confirmer le paiement', disabled: createPayment.isPending, onClick: handleSubmit, isSubmit: true };
    }
  };

  const footer = getFooterButton();

  return (
    <MobileLayout showNav={false}>
      <PageHeader title="Nouveau paiement" showBack
        onBack={() => { const idx = currentStepIndex; if (idx > 0) setStep(STEPS[idx - 1].key); else navigate('/payments'); }} />

      <div className="px-4 py-2">
        <StepProgressBar steps={STEPS} currentStepIndex={currentStepIndex} />
      </div>

      <div className="px-4 py-4 flex-1">
        {step === 'method' && renderMethodStep()}
        {step === 'amount' && renderAmountStep()}
        {step === 'beneficiary' && renderBeneficiaryStep()}
        {step === 'confirm' && renderConfirmStep()}
      </div>

      <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button onClick={footer.onClick} disabled={footer.disabled}
          className={cn('w-full py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2',
            footer.disabled ? 'bg-muted text-muted-foreground cursor-not-allowed'
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              : (footer as any).isSubmit ? 'bg-primary text-primary-foreground' : 'btn-primary-gradient')}>
          {createPayment.isPending && <Loader2 className="w-5 h-5 animate-spin" />}
          {footer.label}
        </button>
      </div>
    </MobileLayout>
  );
};

export default NewPaymentPage;
