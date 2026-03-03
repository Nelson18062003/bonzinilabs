import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isToday, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { StepProgressBar } from '@/components/payment-form/StepProgressBar';
import { PaymentMethodCard } from '@/components/payment-form/PaymentMethodCard';
import { SuccessScreen } from '@/components/payment-form/SuccessScreen';
import { useAllClients } from '@/hooks/useAdminDeposits';
import { useWalletByUserId } from '@/hooks/useWallet';
import { useActiveDailyRate, useRateAdjustments } from '@/hooks/useDailyRates';
import { calculateFinalRate, getBaseRate } from '@/lib/rateCalculation';
import type { PaymentMethodKey } from '@/types/rates';
import { useAdminCreatePayment } from '@/hooks/useAdminPayments';
import { useAdminClientBeneficiaries, useAdminCreateBeneficiary } from '@/hooks/useBeneficiaries';
import type { Beneficiary } from '@/hooks/useBeneficiaries';
import { formatXAF, formatRMB } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Loader2,
  Search,
  Check,
  Banknote,
  Upload,
  X,
  Calendar,
  AlertCircle,
  QrCode,
  RefreshCw,
  User,
  Phone,
  Mail,
  CreditCard,
  Building2,
  SkipForward,
} from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { PaymentMethodLogo } from '@/mobile/components/payments/PaymentMethodLogo';

type Step = 'client' | 'method' | 'amount' | 'beneficiary' | 'summary';
type PaymentMethod = 'alipay' | 'wechat' | 'bank_transfer' | 'cash';

const STEPS: { key: Step; label: string }[] = [
  { key: 'client', label: 'Client' },
  { key: 'method', label: 'Mode' },
  { key: 'amount', label: 'Montant' },
  { key: 'beneficiary', label: 'Bénéf.' },
  { key: 'summary', label: 'Résumé' },
];

function toRateKey(method: PaymentMethod | null): PaymentMethodKey {
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

const AMOUNT_PRESETS_XAF = [100000, 250000, 500000, 1000000];
const AMOUNT_PRESETS_RMB = [1000, 2500, 5000, 10000];

const paymentMethods: { method: PaymentMethod; label: string; description: string }[] = [
  { method: 'alipay', label: 'Alipay', description: 'QR code Alipay' },
  { method: 'wechat', label: 'WeChat Pay', description: 'QR code WeChat' },
  { method: 'bank_transfer', label: 'Virement bancaire', description: 'Compte bancaire chinois' },
  { method: 'cash', label: 'Cash', description: 'Retrait en espèces' },
];

type IdentificationType = 'qr' | 'id' | 'email' | 'phone';

export function MobileNewPayment() {
  const navigate = useNavigate();
  const { data: clients, isLoading: clientsLoading } = useAllClients();
  const { data: activeDailyRate, isLoading: rateLoading, refetch: refetchRate } = useActiveDailyRate();
  const { data: rateAdjustments } = useRateAdjustments();
  const createPayment = useAdminCreatePayment();
  const adminCreateBeneficiary = useAdminCreateBeneficiary();

  // Step state
  const [step, setStep] = useState<Step>('client');
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdPaymentId, setCreatedPaymentId] = useState<string | null>(null);

  // Step 1: Client
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<(typeof clients extends (infer T)[] | undefined ? T : never) | null>(null);

  // Step 2: Method
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);

  // Step 3: Amount
  const [inputMode, setInputMode] = useState<'XAF' | 'RMB'>('XAF');
  const [amountXAF, setAmountXAF] = useState('');
  const [amountRMB, setAmountRMB] = useState('');
  const [useCustomRate, setUseCustomRate] = useState(false);
  const [customRate, setCustomRate] = useState('');
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [notes, setNotes] = useState('');

  // Step 4: Beneficiary
  const [skipBeneficiary, setSkipBeneficiary] = useState(false);
  const [beneficiaryTab, setBeneficiaryTab] = useState<'existing' | 'new'>('existing');
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<Beneficiary | null>(null);
  // New beneficiary fields
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

  // Fetched data
  const { data: clientWallet } = useWalletByUserId(selectedClient?.user_id);
  const { data: existingBeneficiaries } = useAdminClientBeneficiaries(
    selectedClient?.user_id,
    selectedMethod || undefined
  );

  // Country-based rate adjustment
  const clientCountryKey = useMemo(() => {
    // The clients from useAllClients don't include country, so we'll default to cameroun for now
    // and get it from clientWallet or profile if available
    return 'cameroun';
  }, []);

  // Rate calculation
  const effectiveRate = useMemo(() => {
    if (useCustomRate && customRate) {
      const customRateValue = parseFloat(customRate);
      if (customRateValue > 0) return customRateValue / 1_000_000;
    }
    if (!activeDailyRate) return 0.01167;
    const rateKey = toRateKey(selectedMethod);
    const baseRate = getBaseRate(activeDailyRate, rateKey);
    const countryAdj = rateAdjustments?.find(a => a.type === 'country' && a.key === clientCountryKey);
    const countryPct = countryAdj?.percentage ?? 0;
    const tierAdjs = (rateAdjustments?.filter(a => a.type === 'tier') || [])
      .map(a => ({ key: a.key, percentage: a.percentage }));
    let prelimXAF: number;
    if (inputMode === 'XAF') {
      prelimXAF = parseInt(amountXAF) || 1_000_000;
    } else {
      const baseRateDecimal = baseRate * (1 + countryPct / 100) / 1_000_000;
      prelimXAF = baseRateDecimal > 0
        ? Math.round((parseFloat(amountRMB) || 0) / baseRateDecimal)
        : 1_000_000;
    }
    const result = calculateFinalRate(baseRate, countryPct, prelimXAF, tierAdjs);
    return result.finalRate / 1_000_000;
  }, [useCustomRate, customRate, activeDailyRate, rateAdjustments, selectedMethod, inputMode, amountXAF, amountRMB, clientCountryKey]);

  // Calculated amounts
  const calculatedAmountXAF = useMemo(() => {
    if (inputMode === 'XAF') return parseInt(amountXAF) || 0;
    const rmb = parseFloat(amountRMB) || 0;
    return effectiveRate > 0 ? Math.round(rmb / effectiveRate) : 0;
  }, [inputMode, amountXAF, amountRMB, effectiveRate]);

  const calculatedAmountRMB = useMemo(() => {
    if (inputMode === 'RMB') return parseFloat(amountRMB) || 0;
    const xaf = parseInt(amountXAF) || 0;
    return Math.round(xaf * effectiveRate * 100) / 100;
  }, [inputMode, amountXAF, amountRMB, effectiveRate]);

  const filteredClients = useMemo(() => {
    if (!clients) return [];
    if (!clientSearch.trim()) return clients.slice(0, 20);
    const search = clientSearch.toLowerCase();
    return clients
      .filter(c =>
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(search) ||
        c.phone?.includes(search)
      )
      .slice(0, 20);
  }, [clients, clientSearch]);

  const balanceAfter = (clientWallet?.balance_xaf || 0) - calculatedAmountXAF;
  const isBalanceInsufficient = balanceAfter < 0;
  const showRate = calculatedAmountXAF >= 10000;

  // QR file handling
  const handleQrFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setQrCodeFile(file);
      setQrCodePreview(URL.createObjectURL(file));
    }
  };

  const removeQrFile = () => {
    if (qrCodePreview) URL.revokeObjectURL(qrCodePreview);
    setQrCodeFile(null);
    setQrCodePreview(null);
  };

  // Step navigation
  const currentStepIndex = STEPS.findIndex(s => s.key === step);

  const goBack = () => {
    const idx = currentStepIndex;
    if (idx > 0) setStep(STEPS[idx - 1].key);
    else navigate('/m/payments');
  };

  // Build beneficiary snapshot
  const getBeneficiarySnapshot = (): Record<string, unknown> | undefined => {
    if (skipBeneficiary) return undefined;
    if (selectedBeneficiary) {
      return {
        id: selectedBeneficiary.id,
        name: selectedBeneficiary.name,
        payment_method: selectedBeneficiary.payment_method,
        identifier: selectedBeneficiary.identifier,
        identifier_type: selectedBeneficiary.identifier_type,
        phone: selectedBeneficiary.phone,
        email: selectedBeneficiary.email,
        bank_name: selectedBeneficiary.bank_name,
        bank_account: selectedBeneficiary.bank_account,
      };
    }
    // New beneficiary info
    if (selectedMethod === 'cash') {
      return {
        type: cashBenefType,
        name: cashBenefType === 'self'
          ? `${selectedClient?.first_name || ''} ${selectedClient?.last_name || ''}`.trim()
          : newBenefName,
        phone: cashBenefType === 'self' ? selectedClient?.phone : newBenefPhone,
      };
    }
    if (selectedMethod === 'alipay' || selectedMethod === 'wechat') {
      return {
        name: newBenefName,
        identifier: newBenefIdentifier,
        identifier_type: newBenefIdType,
        phone: newBenefPhone,
        email: newBenefEmail,
      };
    }
    if (selectedMethod === 'bank_transfer') {
      return {
        name: newBenefName,
        bank_name: newBenefBankName,
        bank_account: newBenefBankAccount,
        bank_extra: newBenefBankExtra,
      };
    }
    return undefined;
  };

  // Submit
  const handleSubmit = async () => {
    if (!selectedClient || !selectedMethod) {
      toast.error('Informations manquantes');
      return;
    }

    try {
      let beneficiaryId: string | undefined = selectedBeneficiary?.id;

      // If creating a new beneficiary and not skipping, save it first
      if (!skipBeneficiary && !selectedBeneficiary && newBenefName) {
        try {
          const newBenef = await adminCreateBeneficiary.mutateAsync({
            client_id: selectedClient.user_id,
            payment_method: selectedMethod,
            name: newBenefName,
            identifier: newBenefIdentifier || undefined,
            identifier_type: newBenefIdType || undefined,
            phone: newBenefPhone || undefined,
            email: newBenefEmail || undefined,
            bank_name: newBenefBankName || undefined,
            bank_account: newBenefBankAccount || undefined,
            bank_extra: newBenefBankExtra || undefined,
            qr_code_file: qrCodeFile || undefined,
          });
          beneficiaryId = newBenef.id;
        } catch {
          // Continue without saved beneficiary — info will still be in snapshot
        }
      }

      const snapshot = getBeneficiarySnapshot();

      // Build legacy beneficiary fields for backward compatibility
      const legacyBenefName = snapshot?.name as string || undefined;
      const legacyBenefPhone = snapshot?.phone as string || undefined;
      const legacyBenefEmail = snapshot?.email as string || undefined;
      const legacyBankName = snapshot?.bank_name as string || undefined;
      const legacyBankAccount = snapshot?.bank_account as string || undefined;

      const result = await createPayment.mutateAsync({
        user_id: selectedClient.user_id,
        amount_xaf: calculatedAmountXAF,
        amount_rmb: calculatedAmountRMB,
        exchange_rate: effectiveRate,
        method: selectedMethod,
        beneficiary_name: legacyBenefName,
        beneficiary_phone: legacyBenefPhone,
        beneficiary_email: legacyBenefEmail,
        beneficiary_bank_name: legacyBankName,
        beneficiary_bank_account: legacyBankAccount,
        beneficiary_notes: notes || undefined,
        client_visible_comment: notes || undefined,
        desired_date: !isToday(paymentDate) ? paymentDate : undefined,
        qr_code_files: qrCodeFile ? [qrCodeFile] : undefined,
        beneficiary_id: beneficiaryId,
        beneficiary_details: snapshot,
        rate_is_custom: useCustomRate,
      });

      if (result.payment_id) {
        setCreatedPaymentId(result.payment_id);
      }
      setShowSuccess(true);
    } catch {
      // Error handled by mutation
    }
  };

  // ── Success screen ──
  if (showSuccess) {
    return (
      <SuccessScreen
        variant="admin"
        amountXAF={calculatedAmountXAF}
        amountRMB={calculatedAmountRMB}
        method={selectedMethod || 'cash'}
        clientName={`${selectedClient?.first_name || ''} ${selectedClient?.last_name || ''}`.trim()}
        onNewPayment={() => {
          // Reset state
          setStep('client');
          setShowSuccess(false);
          setCreatedPaymentId(null);
          setSelectedClient(null);
          setSelectedMethod(null);
          setAmountXAF('');
          setAmountRMB('');
          setUseCustomRate(false);
          setCustomRate('');
          setPaymentDate(new Date());
          setNotes('');
          setSkipBeneficiary(false);
          setSelectedBeneficiary(null);
          setNewBenefName('');
          setNewBenefPhone('');
          setNewBenefEmail('');
          setNewBenefIdentifier('');
          setNewBenefBankName('');
          setNewBenefBankAccount('');
          setNewBenefBankExtra('');
          setQrCodeFile(null);
          setQrCodePreview(null);
        }}
        onViewPayment={() => navigate(`/m/payments/${createdPaymentId}`)}
      />
    );
  }

  // ── Step renderers ──

  const renderClientStep = () => (
    <>
      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-1">Sélectionner un client</h2>
        <p className="text-sm text-muted-foreground">Choisissez le client pour ce paiement</p>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher par nom ou téléphone..."
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            className="w-full h-12 pl-10 pr-4 rounded-xl bg-muted border-0 text-base focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div className="space-y-2">
        {clientsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          filteredClients.map((client) => (
            <ClientCard
              key={client.user_id}
              client={client}
              isSelected={selectedClient?.user_id === client.user_id}
              onSelect={() => setSelectedClient(client)}
            />
          ))
        )}
      </div>
    </>
  );

  const renderMethodStep = () => (
    <>
      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-1">Mode de paiement</h2>
        <p className="text-sm text-muted-foreground">
          Comment le bénéficiaire souhaite recevoir ?
        </p>
      </div>

      <div className="space-y-3">
        {paymentMethods.map((m) => (
          <PaymentMethodCard
            key={m.method}
            method={m.method}
            label={m.label}
            description={m.description}
            isSelected={selectedMethod === m.method}
            onSelect={() => setSelectedMethod(m.method)}
          />
        ))}
      </div>
    </>
  );

  const renderAmountStep = () => (
    <>
      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-1">Montant du paiement</h2>
        <p className="text-sm text-muted-foreground">
          {selectedClient?.first_name} {selectedClient?.last_name}
          {clientWallet && ` • Solde : ${formatXAF(clientWallet.balance_xaf)} XAF`}
        </p>
      </div>

      {/* Rate display — only when amount >= 10K */}
      {showRate && (
        rateLoading ? (
          <div className="mb-4 p-3 rounded-xl bg-muted/50 border border-border flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mr-2" />
            <span className="text-sm text-muted-foreground">Chargement du taux...</span>
          </div>
        ) : !activeDailyRate && !useCustomRate ? (
          <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive font-medium">Impossible de charger le taux.</p>
            <button onClick={() => refetchRate()} className="mt-2 flex items-center gap-2 text-sm text-primary font-medium">
              <RefreshCw className="w-4 h-4" />Réessayer
            </button>
          </div>
        ) : (
          <div className="mb-4 p-3 rounded-xl bg-muted/50 border border-border">
            <p className="text-xs text-muted-foreground">Taux appliqué{useCustomRate ? ' (personnalisé)' : ''}</p>
            <p className="text-base font-semibold mt-0.5">
              1 000 000 XAF = ¥{formatRMB(1000000 * effectiveRate)}
            </p>
          </div>
        )
      )}

      {/* Toggle XAF / RMB */}
      <div className="flex gap-1 mb-4 bg-muted rounded-lg p-1">
        <button
          onClick={() => setInputMode('XAF')}
          className={cn(
            'flex-1 h-9 rounded-md text-sm font-medium transition-colors',
            inputMode === 'XAF' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
          )}
        >
          Par XAF
        </button>
        <button
          onClick={() => setInputMode('RMB')}
          className={cn(
            'flex-1 h-9 rounded-md text-sm font-medium transition-colors',
            inputMode === 'RMB' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
          )}
        >
          Par RMB
        </button>
      </div>

      {/* Amount input card */}
      <div className="mb-4 p-4 rounded-xl border border-border bg-card space-y-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1">
            {inputMode === 'XAF' ? 'Montant débité' : 'Bénéficiaire reçoit'}
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={
                inputMode === 'XAF'
                  ? amountXAF ? parseInt(amountXAF).toLocaleString('fr-FR') : ''
                  : amountRMB
              }
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9.,]/g, '');
                if (inputMode === 'XAF') setAmountXAF(value.replace(/[.,]/g, ''));
                else setAmountRMB(value.replace(',', '.'));
              }}
              className="flex-1 text-3xl font-bold bg-transparent focus:outline-none"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            />
            <span className="text-lg font-medium text-muted-foreground flex-shrink-0">
              {inputMode === 'XAF' ? 'XAF' : 'RMB'}
            </span>
          </div>
        </div>
        <div className="h-px bg-border" />
        <div>
          <p className="text-xs text-muted-foreground mb-1">
            {inputMode === 'XAF' ? 'Bénéficiaire reçoit' : 'Montant débité'}
          </p>
          <p className="text-2xl font-bold text-primary">
            {(calculatedAmountXAF > 0 || calculatedAmountRMB > 0)
              ? inputMode === 'XAF'
                ? `¥${formatRMB(calculatedAmountRMB)}`
                : `${formatXAF(calculatedAmountXAF)} XAF`
              : inputMode === 'XAF' ? '¥0,00' : '0 XAF'}
          </p>
        </div>
      </div>

      {/* Quick amounts */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {(inputMode === 'XAF' ? AMOUNT_PRESETS_XAF : AMOUNT_PRESETS_RMB).map((preset) => (
          <button
            key={preset}
            onClick={() => {
              if (inputMode === 'XAF') setAmountXAF(preset.toString());
              else setAmountRMB(preset.toString());
            }}
            className={cn(
              'h-11 rounded-xl text-sm font-medium transition-colors',
              (inputMode === 'XAF' ? amountXAF : amountRMB) === preset.toString()
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground'
            )}
          >
            {inputMode === 'XAF'
              ? preset >= 1000000 ? `${preset / 1000000}M` : `${preset / 1000}K`
              : `¥${preset.toLocaleString('fr-FR')}`}
          </button>
        ))}
      </div>

      {/* Insufficient balance */}
      {isBalanceInsufficient && calculatedAmountXAF > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
            <span className="text-sm font-medium text-destructive">
              Solde insuffisant : il manque {formatXAF(Math.abs(balanceAfter))} XAF
            </span>
          </div>
        </div>
      )}

      {/* Custom rate toggle */}
      <div className="mb-4 p-4 rounded-xl border border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Taux personnalisé</span>
          <button
            onClick={() => setUseCustomRate(!useCustomRate)}
            className={cn('w-12 h-6 rounded-full transition-colors relative', useCustomRate ? 'bg-primary' : 'bg-muted')}
          >
            <div className={cn('w-5 h-5 rounded-full bg-white shadow absolute top-0.5 transition-all', useCustomRate ? 'left-6' : 'left-0.5')} />
          </button>
        </div>
        {useCustomRate && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">1M XAF =</span>
            <input
              type="text"
              inputMode="decimal"
              value={customRate}
              onChange={(e) => setCustomRate(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder={activeDailyRate ? activeDailyRate.rate_cash.toFixed(0) : '11670'}
              className="flex-1 h-10 px-3 rounded-lg border border-border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <span className="text-sm text-muted-foreground">RMB</span>
          </div>
        )}
      </div>

      {/* Date selector */}
      <div className="mb-4">
        <Drawer open={calendarOpen} onOpenChange={setCalendarOpen}>
          <DrawerTrigger asChild>
            <button className="w-full flex items-center justify-between p-4 rounded-xl border border-border">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm">Date du paiement</span>
              </div>
              <span className={cn('text-sm font-medium', !isToday(paymentDate) && 'text-amber-600')}>
                {isToday(paymentDate) ? "Aujourd'hui" : format(paymentDate, 'dd MMM yyyy', { locale: fr })}
              </span>
            </button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader><DrawerTitle>Sélectionner une date</DrawerTitle></DrawerHeader>
            <div className="p-4 flex justify-center">
              <CalendarComponent
                mode="single"
                selected={paymentDate}
                onSelect={(date) => { if (date) setPaymentDate(date); setCalendarOpen(false); }}
                locale={fr}
                disabled={(date) => date > new Date()}
              />
            </div>
          </DrawerContent>
        </Drawer>
      </div>

      {/* Notes */}
      <div>
        <label className="text-sm font-medium mb-1 block">Notes / instructions</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Instructions supplémentaires..."
          rows={2}
          className="w-full p-3 rounded-xl border border-border bg-background text-base resize-none focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
    </>
  );

  const renderBeneficiaryStep = () => {
    const isCash = selectedMethod === 'cash';
    const isAlipayWechat = selectedMethod === 'alipay' || selectedMethod === 'wechat';
    const isBankTransfer = selectedMethod === 'bank_transfer';

    return (
      <>
        <div className="mb-4">
          <h2 className="text-lg font-semibold mb-1">Bénéficiaire</h2>
          <p className="text-sm text-muted-foreground">
            {paymentMethods.find(m => m.method === selectedMethod)?.label}
          </p>
        </div>

        {/* Skip option */}
        <button
          onClick={() => setSkipBeneficiary(!skipBeneficiary)}
          className={cn(
            'w-full flex items-center gap-3 p-3 rounded-xl mb-4 transition-colors',
            skipBeneficiary ? 'bg-orange-500/10 border border-orange-300' : 'bg-muted/50 border border-border'
          )}
        >
          <div className={cn(
            'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
            skipBeneficiary ? 'bg-orange-500 border-orange-500' : 'border-muted-foreground'
          )}>
            {skipBeneficiary && <Check className="w-3 h-3 text-white" />}
          </div>
          <div className="flex-1 text-left">
            <span className={cn('text-sm font-medium', skipBeneficiary ? 'text-orange-600' : 'text-foreground')}>
              Passer cette étape
            </span>
            <p className="text-xs text-muted-foreground">Les infos du bénéficiaire seront ajoutées plus tard</p>
          </div>
          <SkipForward className={cn('w-4 h-4', skipBeneficiary ? 'text-orange-500' : 'text-muted-foreground')} />
        </button>

        {!skipBeneficiary && (
          <>
            {/* Toggle existing / new */}
            <div className="flex gap-1 mb-4 bg-muted rounded-lg p-1">
              <button
                onClick={() => setBeneficiaryTab('existing')}
                className={cn(
                  'flex-1 h-9 rounded-md text-sm font-medium transition-colors',
                  beneficiaryTab === 'existing' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                )}
              >
                Existant
              </button>
              <button
                onClick={() => setBeneficiaryTab('new')}
                className={cn(
                  'flex-1 h-9 rounded-md text-sm font-medium transition-colors',
                  beneficiaryTab === 'new' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                )}
              >
                Nouveau
              </button>
            </div>

            {beneficiaryTab === 'existing' ? (
              <div className="space-y-2">
                {!existingBeneficiaries || existingBeneficiaries.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <User className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Aucun bénéficiaire existant</p>
                    <button
                      onClick={() => setBeneficiaryTab('new')}
                      className="mt-2 text-sm text-primary font-medium"
                    >
                      Créer un nouveau
                    </button>
                  </div>
                ) : (
                  existingBeneficiaries.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setSelectedBeneficiary(selectedBeneficiary?.id === b.id ? null : b)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left',
                        selectedBeneficiary?.id === b.id ? 'border-primary bg-primary/5' : 'border-border'
                      )}
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
                        {b.name[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{b.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {b.identifier || b.phone || b.bank_account || b.email || ''}
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
                {/* Cash: self or other */}
                {isCash && (
                  <>
                    <div className="space-y-2">
                      <button
                        onClick={() => setCashBenefType('self')}
                        className={cn(
                          'w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all',
                          cashBenefType === 'self' ? 'border-[#dc2626] bg-red-50/50' : 'border-border'
                        )}
                      >
                        <User className="w-5 h-5" />
                        <div className="flex-1 text-left">
                          <p className="font-medium">Le client lui-même</p>
                          <p className="text-xs text-muted-foreground">
                            {selectedClient?.first_name} {selectedClient?.last_name}
                          </p>
                        </div>
                      </button>
                      <button
                        onClick={() => setCashBenefType('other')}
                        className={cn(
                          'w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all',
                          cashBenefType === 'other' ? 'border-[#dc2626] bg-red-50/50' : 'border-border'
                        )}
                      >
                        <User className="w-5 h-5" />
                        <div className="text-left">
                          <p className="font-medium">Autre personne</p>
                        </div>
                      </button>
                    </div>
                    {cashBenefType === 'other' && (
                      <div className="space-y-3 p-4 rounded-xl bg-muted/50">
                        <div>
                          <label className="text-sm font-medium mb-1 block">Nom complet *</label>
                          <input type="text" value={newBenefName} onChange={(e) => setNewBenefName(e.target.value)}
                            placeholder="Nom du bénéficiaire"
                            className="w-full h-12 px-4 rounded-xl border border-border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary" />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-1 block">Téléphone *</label>
                          <input type="tel" value={newBenefPhone} onChange={(e) => setNewBenefPhone(e.target.value)}
                            placeholder="+86..."
                            className="w-full h-12 px-4 rounded-xl border border-border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary" />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-1 block">Email (optionnel)</label>
                          <input type="email" value={newBenefEmail} onChange={(e) => setNewBenefEmail(e.target.value)}
                            placeholder="email@exemple.com"
                            className="w-full h-12 px-4 rounded-xl border border-border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary" />
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Alipay / WeChat: identification type */}
                {isAlipayWechat && (
                  <>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Nom du bénéficiaire *</label>
                      <input type="text" value={newBenefName} onChange={(e) => setNewBenefName(e.target.value)}
                        placeholder="Nom complet"
                        className="w-full h-12 px-4 rounded-xl border border-border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Type d'identification</label>
                      <div className="grid grid-cols-4 gap-2">
                        {([
                          { key: 'qr' as const, icon: QrCode, label: 'QR' },
                          { key: 'id' as const, icon: CreditCard, label: 'ID' },
                          { key: 'email' as const, icon: Mail, label: 'Email' },
                          { key: 'phone' as const, icon: Phone, label: 'Tél.' },
                        ]).map((t) => (
                          <button
                            key={t.key}
                            onClick={() => setNewBenefIdType(t.key)}
                            className={cn(
                              'flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-colors',
                              newBenefIdType === t.key ? 'border-primary bg-primary/5' : 'border-border'
                            )}
                          >
                            <t.icon className="w-5 h-5" />
                            <span className="text-xs font-medium">{t.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {newBenefIdType === 'qr' ? (
                      <div className="space-y-3">
                        {qrCodePreview ? (
                          <div className="relative w-32 h-32 mx-auto rounded-xl overflow-hidden">
                            <img src={qrCodePreview} alt="" className="w-full h-full object-cover" />
                            <button
                              onClick={removeQrFile}
                              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center"
                            >
                              <X className="w-4 h-4 text-white" />
                            </button>
                          </div>
                        ) : (
                          <label className="block w-full h-24 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors">
                            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleQrFileChange} className="hidden" />
                            <div className="h-full flex flex-col items-center justify-center gap-2">
                              <Upload className="w-6 h-6 text-muted-foreground" />
                              <p className="text-sm text-muted-foreground">Ajouter le QR code</p>
                            </div>
                          </label>
                        )}
                      </div>
                    ) : (
                      <div>
                        <label className="text-sm font-medium mb-1 block">
                          {newBenefIdType === 'id' ? 'Identifiant' : newBenefIdType === 'email' ? 'Email' : 'Téléphone'}
                        </label>
                        <input
                          type={newBenefIdType === 'email' ? 'email' : newBenefIdType === 'phone' ? 'tel' : 'text'}
                          value={newBenefIdentifier}
                          onChange={(e) => setNewBenefIdentifier(e.target.value)}
                          placeholder={
                            newBenefIdType === 'id' ? 'ID Alipay/WeChat'
                            : newBenefIdType === 'email' ? 'email@exemple.com'
                            : '+86...'
                          }
                          className="w-full h-12 px-4 rounded-xl border border-border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    )}
                  </>
                )}

                {/* Bank transfer */}
                {isBankTransfer && (
                  <>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Nom du bénéficiaire *</label>
                      <input type="text" value={newBenefName} onChange={(e) => setNewBenefName(e.target.value)}
                        placeholder="Nom complet"
                        className="w-full h-12 px-4 rounded-xl border border-border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Banque *</label>
                      <input type="text" value={newBenefBankName} onChange={(e) => setNewBenefBankName(e.target.value)}
                        placeholder="Nom de la banque"
                        className="w-full h-12 px-4 rounded-xl border border-border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Numéro de compte *</label>
                      <input type="text" value={newBenefBankAccount} onChange={(e) => setNewBenefBankAccount(e.target.value)}
                        placeholder="Numéro de compte"
                        className="w-full h-12 px-4 rounded-xl border border-border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Infos complémentaires</label>
                      <input type="text" value={newBenefBankExtra} onChange={(e) => setNewBenefBankExtra(e.target.value)}
                        placeholder="SWIFT, agence, etc."
                        className="w-full h-12 px-4 rounded-xl border border-border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </>
    );
  };

  const renderSummaryStep = () => {
    const methodInfo = paymentMethods.find(m => m.method === selectedMethod);
    const benefSnapshot = getBeneficiarySnapshot();
    const hasBenef = !skipBeneficiary && (selectedBeneficiary || newBenefName || (selectedMethod === 'cash' && cashBenefType === 'self'));

    return (
      <>
        <div className="mb-4">
          <h2 className="text-lg font-semibold mb-1">Récapitulatif</h2>
          <p className="text-sm text-muted-foreground">Vérifiez les informations</p>
        </div>

        <div className="space-y-4">
          {/* Client card */}
          <div className="bg-card rounded-xl p-4 border border-border">
            <p className="text-xs text-muted-foreground mb-1">Client</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
                {selectedClient?.first_name?.[0]}{selectedClient?.last_name?.[0]}
              </div>
              <div className="flex-1">
                <p className="font-medium">{selectedClient?.first_name} {selectedClient?.last_name}</p>
                {selectedClient?.phone && <p className="text-xs text-muted-foreground">{selectedClient.phone}</p>}
              </div>
            </div>
            {clientWallet && (
              <div className="flex justify-between text-sm mt-3 pt-3 border-t border-border">
                <span className="text-muted-foreground">Solde après</span>
                <span className={cn('font-medium', balanceAfter >= 0 ? 'text-green-600' : 'text-destructive')}>
                  {formatXAF(balanceAfter)} XAF
                </span>
              </div>
            )}
          </div>

          {/* Amount card */}
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-4 border border-primary/20 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Montant débité</span>
              <span className="font-bold">{formatXAF(calculatedAmountXAF)} XAF</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Montant à payer</span>
              <span className="text-xl font-bold text-primary">¥{formatRMB(calculatedAmountRMB)}</span>
            </div>
            {showRate && (
              <div className="flex justify-between text-xs border-t pt-2">
                <span className="text-muted-foreground">
                  Taux{useCustomRate ? ' (personnalisé)' : ''}
                </span>
                <span>1M XAF = ¥{formatRMB(1000000 * effectiveRate)}</span>
              </div>
            )}
            {!isToday(paymentDate) && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Date</span>
                <span className="text-amber-600">{format(paymentDate, 'dd MMM yyyy', { locale: fr })}</span>
              </div>
            )}
          </div>

          {/* Method card */}
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center gap-3">
              <PaymentMethodLogo method={selectedMethod || 'alipay'} size={40} />
              <div className="flex-1">
                <p className="font-medium">{methodInfo?.label}</p>
              </div>
            </div>
          </div>

          {/* Beneficiary card */}
          {hasBenef ? (
            <div className="bg-card rounded-xl p-4 border border-border">
              <p className="text-xs text-muted-foreground mb-2">Bénéficiaire</p>
              <p className="font-medium">{benefSnapshot?.name as string || '-'}</p>
              {benefSnapshot?.phone && <p className="text-xs text-muted-foreground">{benefSnapshot.phone as string}</p>}
              {benefSnapshot?.bank_name && <p className="text-xs text-muted-foreground">{benefSnapshot.bank_name as string} • {benefSnapshot.bank_account as string}</p>}
              {benefSnapshot?.identifier && <p className="text-xs text-muted-foreground">{benefSnapshot.identifier as string}</p>}
            </div>
          ) : (
            <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
              <p className="text-sm font-medium text-orange-600">Bénéficiaire : À compléter</p>
              <p className="text-xs text-orange-500 mt-1">Les informations seront ajoutées ultérieurement</p>
            </div>
          )}

          {/* Notes */}
          {notes && (
            <div className="bg-card rounded-xl p-4 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Notes</p>
              <p className="text-sm">{notes}</p>
            </div>
          )}
        </div>
      </>
    );
  };

  // ── Footer button logic ──
  const getFooterButton = () => {
    switch (step) {
      case 'client':
        return { label: 'Continuer', disabled: !selectedClient, onClick: () => setStep('method') };
      case 'method':
        return { label: 'Continuer', disabled: !selectedMethod, onClick: () => setStep('amount') };
      case 'amount':
        return {
          label: 'Continuer',
          disabled: !calculatedAmountXAF || calculatedAmountXAF < 10000 || isBalanceInsufficient,
          onClick: () => setStep('beneficiary'),
        };
      case 'beneficiary':
        return { label: 'Voir le récapitulatif', disabled: false, onClick: () => setStep('summary') };
      case 'summary':
        return {
          label: createPayment.isPending ? 'Création...' : 'Créer le paiement',
          disabled: createPayment.isPending,
          onClick: handleSubmit,
          isSubmit: true,
        };
    }
  };

  const footer = getFooterButton();

  return (
    <div className="h-dvh flex flex-col overflow-hidden max-w-[430px] mx-auto">
      {/* Header */}
      <div className="flex-shrink-0">
        <MobileHeader
          title="Nouveau paiement"
          showBack
          onBack={goBack}
        />
        <StepProgressBar steps={STEPS} currentStepIndex={currentStepIndex} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {step === 'client' && renderClientStep()}
        {step === 'method' && renderMethodStep()}
        {step === 'amount' && renderAmountStep()}
        {step === 'beneficiary' && renderBeneficiaryStep()}
        {step === 'summary' && renderSummaryStep()}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          onClick={footer.onClick}
          disabled={footer.disabled}
          className={cn(
            'w-full h-14 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]',
            footer.disabled
              ? 'bg-muted text-muted-foreground'
              : (footer as any).isSubmit
                ? 'bg-primary text-primary-foreground'
                : 'bg-primary text-primary-foreground'
          )}
        >
          {createPayment.isPending && <Loader2 className="w-5 h-5 animate-spin" />}
          {(footer as any).isSubmit && !createPayment.isPending && <Check className="w-5 h-5" />}
          {footer.label}
        </button>
      </div>
    </div>
  );
}

// ── Client card sub-component ──
function ClientCard({
  client,
  isSelected,
  onSelect,
}: {
  client: { user_id: string; first_name: string; last_name: string; phone: string | null };
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { data: wallet } = useWalletByUserId(client.user_id);

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all active:scale-[0.98]',
        isSelected ? 'border-violet-500 bg-violet-500/5' : 'border-border bg-card'
      )}
    >
      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
        {client.first_name?.[0]}{client.last_name?.[0]}
      </div>
      <div className="flex-1 text-left">
        <p className="font-medium">{client.first_name} {client.last_name}</p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {client.phone && <span>{client.phone}</span>}
          {wallet && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted">{formatXAF(wallet.balance_xaf)} XAF</span>
          )}
        </div>
      </div>
      {isSelected && (
        <div className="w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center flex-shrink-0">
          <Check className="w-4 h-4 text-white" />
        </div>
      )}
    </button>
  );
}
