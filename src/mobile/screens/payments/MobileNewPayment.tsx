import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAllClients } from '@/hooks/useAdminCreateDeposit';
import { useWalletByUserId, useExchangeRate } from '@/hooks/useWallet';
import { useAdminCreatePayment } from '@/hooks/useAdminPayments';
import { formatXAF, formatCurrencyRMB } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Loader2,
  Search,
  Check,
  ChevronRight,
  CreditCard,
  Wallet,
  Building2,
  Banknote,
  Upload,
  X,
  User,
  Calendar,
  AlertCircle,
  QrCode,
} from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';

type Step = 'client' | 'amount' | 'method' | 'beneficiary' | 'summary';
type PaymentMethod = 'alipay' | 'wechat' | 'bank_transfer' | 'cash';

const AMOUNT_PRESETS_XAF = [100000, 500000, 1000000, 2000000];
const AMOUNT_PRESETS_RMB = [500, 1000, 5000, 10000];

const paymentMethods = [
  {
    method: 'alipay' as const,
    label: 'Alipay',
    icon: CreditCard,
    description: 'QR code Alipay',
  },
  {
    method: 'wechat' as const,
    label: 'WeChat Pay',
    icon: Wallet,
    description: 'QR code WeChat',
  },
  {
    method: 'bank_transfer' as const,
    label: 'Virement bancaire',
    icon: Building2,
    description: 'Compte bancaire chinois',
  },
  {
    method: 'cash' as const,
    label: 'Cash',
    icon: Banknote,
    description: 'Retrait en espèces',
  },
];

export function MobileNewPayment() {
  const navigate = useNavigate();
  const { data: clients, isLoading: clientsLoading } = useAllClients();
  const { data: currentRate, isLoading: rateLoading } = useExchangeRate();
  const createPayment = useAdminCreatePayment();

  // Form state
  const [step, setStep] = useState<Step>('client');
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<typeof clients[0] | null>(null);

  // Amount state
  const [inputMode, setInputMode] = useState<'XAF' | 'RMB'>('XAF');
  const [amountXAF, setAmountXAF] = useState('');
  const [amountRMB, setAmountRMB] = useState('');
  const [useCustomRate, setUseCustomRate] = useState(false);
  const [customRate, setCustomRate] = useState('');

  // Payment method
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);

  // Beneficiary info
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [beneficiaryPhone, setBeneficiaryPhone] = useState('');
  const [beneficiaryBankName, setBeneficiaryBankName] = useState('');
  const [beneficiaryBankAccount, setBeneficiaryBankAccount] = useState('');
  const [beneficiaryNotes, setBeneficiaryNotes] = useState('');
  const [qrCodeFiles, setQrCodeFiles] = useState<File[]>([]);
  const [qrCodePreviews, setQrCodePreviews] = useState<string[]>([]);

  // Date and comment
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [clientVisibleComment, setClientVisibleComment] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Get selected client's wallet
  const { data: clientWallet } = useWalletByUserId(selectedClient?.user_id);

  // Calculate effective rate
  const effectiveRate = useMemo(() => {
    if (useCustomRate && customRate) {
      const customRateValue = parseFloat(customRate);
      if (customRateValue > 0) {
        return customRateValue / 1000000;
      }
    }
    return currentRate || 0.01167;
  }, [useCustomRate, customRate, currentRate]);

  // Calculate amounts based on input mode
  const calculatedAmountXAF = useMemo(() => {
    if (inputMode === 'XAF') {
      return parseInt(amountXAF) || 0;
    }
    const rmb = parseFloat(amountRMB) || 0;
    return Math.round(rmb / effectiveRate);
  }, [inputMode, amountXAF, amountRMB, effectiveRate]);

  const calculatedAmountRMB = useMemo(() => {
    if (inputMode === 'RMB') {
      return parseFloat(amountRMB) || 0;
    }
    const xaf = parseInt(amountXAF) || 0;
    return Math.round(xaf * effectiveRate * 100) / 100;
  }, [inputMode, amountXAF, amountRMB, effectiveRate]);

  // Filter clients
  const filteredClients = useMemo(() => {
    if (!clients) return [];
    if (!clientSearch.trim()) return clients.slice(0, 20);

    const search = clientSearch.toLowerCase();
    return clients
      .filter(
        (c) =>
          `${c.first_name} ${c.last_name}`.toLowerCase().includes(search) ||
          c.phone?.includes(search)
      )
      .slice(0, 20);
  }, [clients, clientSearch]);

  // Check if balance is sufficient
  const balanceAfter = (clientWallet?.balance_xaf || 0) - calculatedAmountXAF;
  const isBalanceInsufficient = balanceAfter < 0;

  // Handle QR code file upload
  const handleQrCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newPreviews = files.map((file) => URL.createObjectURL(file));
    setQrCodeFiles((prev) => [...prev, ...files].slice(0, 5));
    setQrCodePreviews((prev) => [...prev, ...newPreviews].slice(0, 5));
  };

  const removeQrCode = (index: number) => {
    URL.revokeObjectURL(qrCodePreviews[index]);
    setQrCodeFiles((prev) => prev.filter((_, i) => i !== index));
    setQrCodePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  // Check if beneficiary info is complete
  const hasBeneficiaryInfo = useMemo(() => {
    if (selectedMethod === 'cash') return true;
    if (selectedMethod === 'alipay' || selectedMethod === 'wechat') {
      return qrCodeFiles.length > 0 || beneficiaryName;
    }
    if (selectedMethod === 'bank_transfer') {
      return beneficiaryName && beneficiaryBankName && beneficiaryBankAccount;
    }
    return false;
  }, [selectedMethod, qrCodeFiles, beneficiaryName, beneficiaryBankName, beneficiaryBankAccount]);

  // Progress percentage
  const getProgress = () => {
    const steps: Step[] = ['client', 'amount', 'method', 'beneficiary', 'summary'];
    const index = steps.indexOf(step);
    return ((index + 1) / steps.length) * 100;
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!selectedClient || !selectedMethod) {
      toast.error('Informations manquantes');
      return;
    }

    try {
      await createPayment.mutateAsync({
        user_id: selectedClient.user_id,
        amount_xaf: calculatedAmountXAF,
        amount_rmb: calculatedAmountRMB,
        exchange_rate: effectiveRate,
        method: selectedMethod,
        beneficiary_name: beneficiaryName || undefined,
        beneficiary_phone: beneficiaryPhone || undefined,
        beneficiary_bank_name: beneficiaryBankName || undefined,
        beneficiary_bank_account: beneficiaryBankAccount || undefined,
        beneficiary_notes: beneficiaryNotes || undefined,
        client_visible_comment: clientVisibleComment || undefined,
        desired_date: !isToday(paymentDate) ? paymentDate : undefined,
        qr_code_files: qrCodeFiles.length > 0 ? qrCodeFiles : undefined,
      });
      toast.success('Paiement créé avec succès');
      navigate('/m/payments');
    } catch {
      // Error handled by mutation
    }
  };

  const renderStep = () => {
    switch (step) {
      case 'client':
        return (
          <div className="flex-1 flex flex-col">
            <div className="px-4 py-4">
              <h2 className="text-xl font-semibold mb-1">Sélectionner un client</h2>
              <p className="text-sm text-muted-foreground">Choisissez le client pour ce paiement</p>
            </div>

            <div className="px-4 mb-4">
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

            <div className="flex-1 overflow-y-auto px-4 space-y-2">
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
                    onSelect={() => {
                      setSelectedClient(client);
                      setStep('amount');
                    }}
                  />
                ))
              )}
            </div>
          </div>
        );

      case 'amount':
        return (
          <div className="flex-1 flex flex-col">
            <div className="px-4 py-4">
              <h2 className="text-xl font-semibold mb-1">Montant du paiement</h2>
              <p className="text-sm text-muted-foreground">
                Pour {selectedClient?.first_name} {selectedClient?.last_name}
              </p>
            </div>

            {/* Client wallet info */}
            {clientWallet && (
              <div className="mx-4 mb-4 p-3 rounded-xl bg-muted/50 border border-border">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Solde disponible</span>
                  <span className="font-medium">{formatXAF(clientWallet.balance_xaf)} XAF</span>
                </div>
              </div>
            )}

            {/* Input mode toggle */}
            <div className="flex justify-center gap-2 px-4 mb-4">
              <button
                onClick={() => setInputMode('XAF')}
                className={cn(
                  'flex-1 h-10 rounded-lg font-medium transition-colors',
                  inputMode === 'XAF' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                )}
              >
                Saisir en XAF
              </button>
              <button
                onClick={() => setInputMode('RMB')}
                className={cn(
                  'flex-1 h-10 rounded-lg font-medium transition-colors',
                  inputMode === 'RMB' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                )}
              >
                Saisir en RMB
              </button>
            </div>

            {/* Amount input */}
            <div className="flex-1 flex flex-col items-center justify-center px-6">
              <input
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={
                  inputMode === 'XAF'
                    ? amountXAF
                      ? parseInt(amountXAF).toLocaleString('fr-FR')
                      : ''
                    : amountRMB
                }
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9.]/g, '');
                  if (inputMode === 'XAF') {
                    setAmountXAF(value.replace('.', ''));
                  } else {
                    setAmountRMB(value);
                  }
                }}
                className="text-5xl font-bold text-center bg-transparent w-full focus:outline-none"
              />
              <span className="text-xl text-muted-foreground mt-2">{inputMode}</span>
            </div>

            {/* Amount presets */}
            <div className="px-4 pb-4">
              <p className="text-xs text-muted-foreground text-center mb-3">Montants rapides</p>
              <div className="grid grid-cols-4 gap-2">
                {(inputMode === 'XAF' ? AMOUNT_PRESETS_XAF : AMOUNT_PRESETS_RMB).map((preset) => (
                  <button
                    key={preset}
                    onClick={() => {
                      if (inputMode === 'XAF') {
                        setAmountXAF(preset.toString());
                      } else {
                        setAmountRMB(preset.toString());
                      }
                    }}
                    className={cn(
                      'h-12 rounded-xl font-medium transition-colors',
                      (inputMode === 'XAF' ? amountXAF : amountRMB) === preset.toString()
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    )}
                  >
                    {inputMode === 'XAF'
                      ? preset >= 1000000
                        ? `${preset / 1000000}M`
                        : `${preset / 1000}K`
                      : `¥${preset}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Conversion display */}
            {(calculatedAmountXAF > 0 || calculatedAmountRMB > 0) && (
              <div className="mx-4 mb-4 p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Montant débité</span>
                  <span className="font-bold">{formatXAF(calculatedAmountXAF)} XAF</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Montant à payer</span>
                  <span className="font-bold text-primary">{formatCurrencyRMB(calculatedAmountRMB)}</span>
                </div>
                <div className="flex justify-between text-xs border-t pt-2">
                  <span className="text-muted-foreground">Taux: 1M XAF =</span>
                  <span>{formatCurrencyRMB(1000000 * effectiveRate)}</span>
                </div>
                {clientWallet && (
                  <div
                    className={cn(
                      'flex justify-between text-sm font-medium border-t pt-2',
                      isBalanceInsufficient ? 'text-destructive' : 'text-green-600'
                    )}
                  >
                    <span>Solde après</span>
                    <span>{formatXAF(balanceAfter)} XAF</span>
                  </div>
                )}
              </div>
            )}

            {isBalanceInsufficient && (
              <div className="mx-4 mb-4 flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Solde insuffisant</span>
              </div>
            )}

            {/* Custom rate toggle */}
            <div className="mx-4 mb-4 p-4 rounded-xl border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Taux personnalisé</span>
                <button
                  onClick={() => setUseCustomRate(!useCustomRate)}
                  className={cn(
                    'w-12 h-6 rounded-full transition-colors relative',
                    useCustomRate ? 'bg-primary' : 'bg-muted'
                  )}
                >
                  <div
                    className={cn(
                      'w-5 h-5 rounded-full bg-white shadow absolute top-0.5 transition-all',
                      useCustomRate ? 'left-6' : 'left-0.5'
                    )}
                  />
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
                    placeholder={(currentRate ? (1000000 * currentRate).toFixed(0) : '11670')}
                    className="flex-1 h-10 px-3 rounded-lg border border-border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <span className="text-sm text-muted-foreground">RMB</span>
                </div>
              )}
            </div>

            {/* Date selector */}
            <div className="mx-4 mb-4">
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
                  <DrawerHeader>
                    <DrawerTitle>Sélectionner une date</DrawerTitle>
                  </DrawerHeader>
                  <div className="p-4 flex justify-center">
                    <CalendarComponent
                      mode="single"
                      selected={paymentDate}
                      onSelect={(date) => {
                        if (date) setPaymentDate(date);
                        setCalendarOpen(false);
                      }}
                      locale={fr}
                      disabled={(date) => date > new Date()}
                    />
                  </div>
                </DrawerContent>
              </Drawer>
            </div>

            <div className="px-4 pb-6">
              <button
                onClick={() => setStep('method')}
                disabled={!calculatedAmountXAF || calculatedAmountXAF < 1000 || isBalanceInsufficient}
                className="w-full h-14 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform"
              >
                Continuer
              </button>
            </div>
          </div>
        );

      case 'method':
        return (
          <div className="flex-1 flex flex-col">
            <div className="px-4 py-4">
              <h2 className="text-xl font-semibold mb-1">Mode de paiement</h2>
              <p className="text-sm text-muted-foreground">
                {formatXAF(calculatedAmountXAF)} → {formatCurrencyRMB(calculatedAmountRMB)}
              </p>
            </div>

            <div className="flex-1 px-4 space-y-3">
              {paymentMethods.map((method) => {
                const Icon = method.icon;
                return (
                  <button
                    key={method.method}
                    onClick={() => {
                      setSelectedMethod(method.method);
                      setStep('beneficiary');
                    }}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card active:scale-[0.98] transition-transform"
                  >
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium">{method.label}</p>
                      <p className="text-sm text-muted-foreground">{method.description}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 'beneficiary':
        return (
          <div className="flex-1 flex flex-col overflow-y-auto">
            <div className="px-4 py-4">
              <h2 className="text-xl font-semibold mb-1">Bénéficiaire</h2>
              <p className="text-sm text-muted-foreground">
                {paymentMethods.find((m) => m.method === selectedMethod)?.label}
              </p>
            </div>

            <div className="flex-1 px-4 space-y-4">
              {/* Alipay / WeChat - QR Code or manual */}
              {(selectedMethod === 'alipay' || selectedMethod === 'wechat') && (
                <>
                  {/* QR Code upload */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <QrCode className="w-4 h-4" />
                      QR Code(s) de paiement
                    </label>

                    {qrCodePreviews.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {qrCodePreviews.map((preview, index) => (
                          <div key={index} className="relative aspect-square rounded-lg overflow-hidden">
                            <img src={preview} alt="" className="w-full h-full object-cover" />
                            <button
                              onClick={() => removeQrCode(index)}
                              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center"
                            >
                              <X className="w-4 h-4 text-white" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <label className="block w-full h-24 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleQrCodeChange}
                        className="hidden"
                      />
                      <div className="h-full flex flex-col items-center justify-center gap-2">
                        <Upload className="w-6 h-6 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Ajouter un QR code</p>
                      </div>
                    </label>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-sm text-muted-foreground">ou</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Nom du bénéficiaire</label>
                      <input
                        type="text"
                        value={beneficiaryName}
                        onChange={(e) => setBeneficiaryName(e.target.value)}
                        placeholder="Nom complet"
                        className="w-full h-12 px-4 rounded-xl border border-border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Téléphone</label>
                      <input
                        type="tel"
                        value={beneficiaryPhone}
                        onChange={(e) => setBeneficiaryPhone(e.target.value)}
                        placeholder="+86..."
                        className="w-full h-12 px-4 rounded-xl border border-border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Bank transfer */}
              {selectedMethod === 'bank_transfer' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Nom du bénéficiaire *</label>
                    <input
                      type="text"
                      value={beneficiaryName}
                      onChange={(e) => setBeneficiaryName(e.target.value)}
                      placeholder="Nom complet"
                      className="w-full h-12 px-4 rounded-xl border border-border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Banque *</label>
                    <input
                      type="text"
                      value={beneficiaryBankName}
                      onChange={(e) => setBeneficiaryBankName(e.target.value)}
                      placeholder="Nom de la banque"
                      className="w-full h-12 px-4 rounded-xl border border-border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Numéro de compte *</label>
                    <input
                      type="text"
                      value={beneficiaryBankAccount}
                      onChange={(e) => setBeneficiaryBankAccount(e.target.value)}
                      placeholder="Numéro de compte bancaire"
                      className="w-full h-12 px-4 rounded-xl border border-border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              )}

              {/* Cash */}
              {selectedMethod === 'cash' && (
                <div className="py-8 text-center">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Banknote className="w-10 h-10 text-primary" />
                  </div>
                  <p className="font-medium">Retrait en espèces</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Le client récupérera le montant en cash
                  </p>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="text-sm font-medium mb-1 block">Notes / instructions</label>
                <textarea
                  value={beneficiaryNotes}
                  onChange={(e) => setBeneficiaryNotes(e.target.value)}
                  placeholder="Instructions supplémentaires..."
                  rows={2}
                  className="w-full p-3 rounded-xl border border-border bg-background text-base resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Client visible comment */}
              <div>
                <label className="text-sm font-medium mb-1 block">Motif (visible par le client)</label>
                <textarea
                  value={clientVisibleComment}
                  onChange={(e) => setClientVisibleComment(e.target.value)}
                  placeholder="Ce message sera visible dans l'historique du client..."
                  rows={2}
                  className="w-full p-3 rounded-xl border border-border bg-background text-base resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {!hasBeneficiaryInfo && selectedMethod !== 'cash' && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm">Sans informations bénéficiaire, le paiement restera en attente.</span>
                </div>
              )}
            </div>

            <div className="px-4 pb-6 pt-4">
              <button
                onClick={() => setStep('summary')}
                className="w-full h-14 rounded-xl bg-primary text-primary-foreground font-semibold active:scale-[0.98] transition-transform"
              >
                Voir le récapitulatif
              </button>
            </div>
          </div>
        );

      case 'summary':
        const methodInfo = paymentMethods.find((m) => m.method === selectedMethod);
        const MethodIcon = methodInfo?.icon || CreditCard;

        return (
          <div className="flex-1 flex flex-col overflow-y-auto">
            <div className="px-4 py-4">
              <h2 className="text-xl font-semibold mb-1">Récapitulatif</h2>
              <p className="text-sm text-muted-foreground">Vérifiez les informations avant de créer</p>
            </div>

            <div className="flex-1 px-4 space-y-4">
              {/* Client */}
              <div className="bg-card rounded-xl p-4 border border-border">
                <p className="text-xs text-muted-foreground mb-1">Client</p>
                <p className="font-medium">
                  {selectedClient?.first_name} {selectedClient?.last_name}
                </p>
                {clientWallet && (
                  <div className="flex justify-between text-sm mt-2 pt-2 border-t border-border">
                    <span className="text-muted-foreground">Solde après</span>
                    <span className="font-medium text-green-600">{formatXAF(balanceAfter)} XAF</span>
                  </div>
                )}
              </div>

              {/* Amount */}
              <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-4 border border-primary/20 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Montant débité</span>
                  <span className="font-bold">{formatXAF(calculatedAmountXAF)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Montant à payer</span>
                  <span className="text-xl font-bold text-primary">{formatCurrencyRMB(calculatedAmountRMB)}</span>
                </div>
                <div className="flex justify-between text-xs border-t pt-2">
                  <span className="text-muted-foreground">
                    Taux{useCustomRate ? ' (personnalisé)' : ''}
                  </span>
                  <span>1M XAF = {formatCurrencyRMB(1000000 * effectiveRate)}</span>
                </div>
                {!isToday(paymentDate) && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Date</span>
                    <span className="text-amber-600">{format(paymentDate, 'dd MMM yyyy', { locale: fr })}</span>
                  </div>
                )}
              </div>

              {/* Method */}
              <div className="bg-card rounded-xl p-4 border border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <MethodIcon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{methodInfo?.label}</p>
                    <span
                      className={cn(
                        'text-xs px-2 py-0.5 rounded-full',
                        hasBeneficiaryInfo
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      )}
                    >
                      {hasBeneficiaryInfo ? 'Prêt à payer' : 'En attente d\'infos'}
                    </span>
                  </div>
                </div>

                {(beneficiaryName || qrCodePreviews.length > 0) && (
                  <div className="mt-3 pt-3 border-t border-border space-y-2 text-sm">
                    {beneficiaryName && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Bénéficiaire</span>
                        <span>{beneficiaryName}</span>
                      </div>
                    )}
                    {beneficiaryBankName && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Banque</span>
                        <span>{beneficiaryBankName}</span>
                      </div>
                    )}
                    {beneficiaryBankAccount && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Compte</span>
                        <span>{beneficiaryBankAccount}</span>
                      </div>
                    )}
                    {qrCodePreviews.length > 0 && (
                      <div className="flex gap-2 pt-2">
                        {qrCodePreviews.slice(0, 3).map((preview, i) => (
                          <img key={i} src={preview} alt="" className="w-12 h-12 rounded border object-cover" />
                        ))}
                        {qrCodePreviews.length > 3 && (
                          <div className="w-12 h-12 rounded border flex items-center justify-center bg-muted">
                            <span className="text-xs text-muted-foreground">+{qrCodePreviews.length - 3}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Visible comment */}
              {clientVisibleComment && (
                <div className="bg-card rounded-xl p-4 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Motif (visible client)</p>
                  <p className="text-sm">{clientVisibleComment}</p>
                </div>
              )}
            </div>

            <div className="px-4 pb-6 pt-4">
              <button
                onClick={handleSubmit}
                disabled={createPayment.isPending}
                className="w-full h-14 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                {createPayment.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Check className="w-5 h-5" />
                )}
                Créer le paiement
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const canGoBack = step !== 'client';
  const handleBack = () => {
    const stepOrder: Step[] = ['client', 'amount', 'method', 'beneficiary', 'summary'];
    const currentIndex = stepOrder.indexOf(step);
    if (currentIndex > 0) {
      setStep(stepOrder[currentIndex - 1]);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <MobileHeader
        title="Nouveau paiement"
        showBack={canGoBack}
        onBack={handleBack}
        backTo={canGoBack ? undefined : '/m/payments'}
      />

      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${getProgress()}%` }}
        />
      </div>

      {/* Selected client indicator */}
      {selectedClient && step !== 'client' && (
        <div className="px-4 py-2 bg-muted/50 border-b border-border">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">
              {selectedClient.first_name} {selectedClient.last_name}
            </span>
            {calculatedAmountXAF > 0 && step !== 'amount' && (
              <>
                <span className="text-muted-foreground">•</span>
                <span className="text-sm font-medium text-primary">
                  {formatCurrencyRMB(calculatedAmountRMB)}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {renderStep()}
    </div>
  );
}

// Client card component
function ClientCard({
  client,
  isSelected,
  onSelect,
}: {
  client: any;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { data: wallet } = useWalletByUserId(client.user_id);

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full flex items-center gap-3 p-4 rounded-xl border transition-all active:scale-[0.98]',
        isSelected ? 'border-primary bg-primary/5' : 'border-border bg-card'
      )}
    >
      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
        {client.first_name?.[0]}
        {client.last_name?.[0]}
      </div>
      <div className="flex-1 text-left">
        <p className="font-medium">
          {client.first_name} {client.last_name}
        </p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {client.phone && <span>{client.phone}</span>}
          {wallet && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted">{formatXAF(wallet.balance_xaf)}</span>
          )}
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-muted-foreground" />
    </button>
  );
}
