import { useState, useRef, useCallback } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { formatXAF, formatCurrencyRMB } from '@/lib/formatters';
import { useMyWallet, useExchangeRate } from '@/hooks/useWallet';
import { useCreatePayment } from '@/hooks/usePayments';
import { 
  Check, 
  ArrowRightLeft, 
  AlertCircle,
  CreditCard,
  Wallet,
  Building2,
  Banknote,
  Loader2,
  Upload,
  Image as ImageIcon,
  QrCode
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { CashBeneficiaryForm, CashBeneficiaryData } from '@/components/cash/CashBeneficiaryForm';
import { CashQRCode } from '@/components/cash/CashQRCode';

type Step = 'amount' | 'method' | 'beneficiary' | 'confirm' | 'success';
type Currency = 'XAF' | 'RMB';
type PaymentMethodType = 'alipay' | 'wechat' | 'bank_transfer' | 'cash';

const paymentMethods = [
  { id: 'alipay' as const, label: 'Alipay', icon: CreditCard, description: 'Paiement via Alipay' },
  { id: 'wechat' as const, label: 'WeChat Pay', icon: Wallet, description: 'Paiement via WeChat' },
  { id: 'bank_transfer' as const, label: 'Virement bancaire', icon: Building2, description: 'Transfert vers compte bancaire' },
  { id: 'cash' as const, label: 'Cash', icon: Banknote, description: 'Retrait au bureau Bonzini' },
];

const NewPaymentPage = () => {
  const navigate = useNavigate();
  const { data: wallet, isLoading: walletLoading } = useMyWallet();
  const { data: exchangeRateData } = useExchangeRate();
  const createPayment = useCreatePayment();
  
  const [step, setStep] = useState<Step>('amount');
  const [currency, setCurrency] = useState<Currency>('XAF');
  const [inputAmount, setInputAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType | null>(null);
  const [skipBeneficiary, setSkipBeneficiary] = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  
  // Beneficiary form
  const [beneficiaryForm, setBeneficiaryForm] = useState({
    name: '',
    phone: '',
    email: '',
    bank_name: '',
    bank_account: '',
    notes: '',
    qr_code_url: '',
  });
  const [qrCodeFile, setQrCodeFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Cash beneficiary state
  const [cashBeneficiaryData, setCashBeneficiaryData] = useState<CashBeneficiaryData>({
    type: 'self',
    firstName: '',
    lastName: '',
    phone: '',
  });
  const [paymentReference, setPaymentReference] = useState<string>('');

  // Callback for cash beneficiary changes - must be at top level, not inside render functions
  const handleCashBeneficiaryChange = useCallback((data: CashBeneficiaryData) => {
    setCashBeneficiaryData(data);
  }, []);

  // Rate calculation
  const rate = exchangeRateData || 0.01167;
  
  const amountXAF = currency === 'XAF' 
    ? parseInt(inputAmount) || 0 
    : Math.round((parseInt(inputAmount) || 0) / rate);
  
  const amountRMB = currency === 'RMB' 
    ? parseFloat(inputAmount) || 0 
    : parseFloat((amountXAF * rate).toFixed(2));
  
  const hasEnoughBalance = amountXAF <= (wallet?.balance_xaf || 0);
  const isValidAmount = amountXAF > 0;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setQrCodeFile(file);
    }
  };

  const handleSubmit = async () => {
    if (!selectedMethod || !isValidAmount || !hasEnoughBalance) return;

    try {
      // Upload QR code if provided
      let qrCodeUrl = beneficiaryForm.qr_code_url;
      if (qrCodeFile) {
        const filePath = `qr-codes/${Date.now()}_${qrCodeFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('payment-proofs')
          .upload(filePath, qrCodeFile);

        if (!uploadError) {
          // Store the file path for later signed URL generation
          qrCodeUrl = `payment-proofs/${filePath}`;
        }
      }

      // For cash payments, use cash beneficiary data
      const isCash = selectedMethod === 'cash';
      const beneficiaryName = isCash 
        ? `${cashBeneficiaryData.firstName} ${cashBeneficiaryData.lastName}`.trim()
        : beneficiaryForm.name;

      const result = await createPayment.mutateAsync({
        amount_xaf: amountXAF,
        amount_rmb: amountRMB,
        exchange_rate: rate,
        method: selectedMethod,
        beneficiary_name: beneficiaryName || undefined,
        beneficiary_phone: isCash ? cashBeneficiaryData.phone : beneficiaryForm.phone || undefined,
        beneficiary_email: beneficiaryForm.email || undefined,
        beneficiary_qr_code_url: qrCodeUrl || undefined,
        beneficiary_bank_name: beneficiaryForm.bank_name || undefined,
        beneficiary_bank_account: beneficiaryForm.bank_account || undefined,
        beneficiary_notes: beneficiaryForm.notes || undefined,
        // Cash-specific fields
        cash_beneficiary_type: isCash ? cashBeneficiaryData.type : undefined,
        cash_beneficiary_first_name: isCash ? cashBeneficiaryData.firstName : undefined,
        cash_beneficiary_last_name: isCash ? cashBeneficiaryData.lastName : undefined,
        cash_beneficiary_phone: isCash ? cashBeneficiaryData.phone : undefined,
      });

      if (result.payment_id) {
        setPaymentId(result.payment_id);
      }
      if (result.reference) {
        setPaymentReference(result.reference);
      }
      setStep('success');
    } catch (error) {
      // Error handled by mutation
    }
  };

  // Step 1: Amount input
  const renderAmountStep = () => (
    <div className="animate-fade-in space-y-6">
      {/* Rate display */}
      <div className="card-glass p-4 text-center">
        <p className="text-sm text-muted-foreground mb-1">Taux actuel</p>
        <p className="text-lg font-bold text-foreground">
          1 000 000 XAF → {formatCurrencyRMB(1000000 * rate)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">Taux appliqué à ce paiement</p>
      </div>

      {/* Currency tabs */}
      <Tabs value={currency} onValueChange={(v) => { setCurrency(v as Currency); setInputAmount(''); }}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="XAF">Par XAF</TabsTrigger>
          <TabsTrigger value="RMB">Par RMB</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Amount input */}
      <div className="card-primary p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-primary-foreground/70 text-sm">Vous envoyez</span>
          {walletLoading ? (
            <Skeleton className="h-4 w-24 bg-primary-foreground/20" />
          ) : (
            <span className="text-primary-foreground/70 text-sm">
              Solde: {formatXAF(wallet?.balance_xaf || 0)} XAF
            </span>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 mb-4">
          <input
            type="text"
            inputMode="numeric"
            value={inputAmount}
            onChange={(e) => setInputAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="0"
            className="amount-input text-primary-foreground placeholder:text-primary-foreground/30"
          />
          <span className="text-xl font-medium text-primary-foreground/70">{currency}</span>
        </div>

        <div className="flex items-center justify-center gap-3 py-3 border-t border-primary-foreground/10">
          <ArrowRightLeft className="w-5 h-5 text-primary-foreground/50" />
        </div>

        <div className="text-center">
          <span className="text-primary-foreground/70 text-sm">
            {currency === 'XAF' ? 'Bénéficiaire reçoit' : 'Montant débité'}
          </span>
          <p className="text-3xl font-bold text-primary-foreground mt-1">
            {currency === 'XAF' ? (
              <>
                ¥ {amountRMB.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                <span className="text-lg font-medium text-primary-foreground/70 ml-2">RMB</span>
              </>
            ) : (
              <>
                {formatXAF(amountXAF)}
                <span className="text-lg font-medium text-primary-foreground/70 ml-2">XAF</span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Quick amounts */}
      <div className="grid grid-cols-3 gap-2">
        {(currency === 'XAF' ? [100000, 250000, 500000] : [1000, 5000, 10000]).map((preset) => (
          <button
            key={preset}
            onClick={() => setInputAmount(preset.toString())}
            className="py-3 rounded-xl bg-secondary text-foreground font-medium hover:bg-secondary/80 transition-colors text-sm"
          >
            {currency === 'XAF' ? formatXAF(preset) : `¥${preset.toLocaleString()}`}
          </button>
        ))}
      </div>

      {!hasEnoughBalance && isValidAmount && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div className="flex-1">
            <span>Solde insuffisant.</span>
            <button 
              onClick={() => navigate('/deposits/new')} 
              className="ml-1 underline font-medium"
            >
              Ajouter de l'argent
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => isValidAmount && hasEnoughBalance && setStep('method')}
        disabled={!isValidAmount || !hasEnoughBalance}
        className={cn(
          'w-full py-4 rounded-xl font-semibold transition-all',
          isValidAmount && hasEnoughBalance
            ? 'btn-primary-gradient'
            : 'bg-muted text-muted-foreground cursor-not-allowed'
        )}
      >
        Continuer
      </button>
    </div>
  );

  // Step 2: Payment method
  const renderMethodStep = () => (
    <div className="animate-fade-in space-y-4">
      <p className="text-sm text-muted-foreground mb-4">
        Comment votre bénéficiaire souhaite recevoir ?
      </p>

      {paymentMethods.map((method) => {
        const Icon = method.icon;
        const isSelected = selectedMethod === method.id;

        return (
          <button
            key={method.id}
            onClick={() => setSelectedMethod(method.id)}
            className={cn(
              'method-card w-full text-left',
              isSelected && 'method-card-selected'
            )}
          >
            <div className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center',
              isSelected ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
            )}>
              <Icon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">{method.label}</p>
              <p className="text-xs text-muted-foreground">{method.description}</p>
            </div>
            {isSelected && (
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                <Check className="w-4 h-4 text-primary-foreground" />
              </div>
            )}
          </button>
        );
      })}

      <button
        onClick={() => selectedMethod && setStep('beneficiary')}
        disabled={!selectedMethod}
        className={cn(
          'w-full mt-6 py-4 rounded-xl font-semibold transition-all',
          selectedMethod
            ? 'btn-primary-gradient'
            : 'bg-muted text-muted-foreground cursor-not-allowed'
        )}
      >
        Continuer
      </button>
    </div>
  );

  // Step 3: Beneficiary info
  const renderBeneficiaryStep = () => {
    const isAlipayOrWechat = selectedMethod === 'alipay' || selectedMethod === 'wechat';
    const isBankTransfer = selectedMethod === 'bank_transfer';
    const isCash = selectedMethod === 'cash';

    // Cash beneficiary validation
    const isCashBeneficiaryValid = cashBeneficiaryData.type === 'self' || 
      (cashBeneficiaryData.firstName && cashBeneficiaryData.lastName && cashBeneficiaryData.phone);

    return (
      <div className="animate-fade-in space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {isCash ? 'Qui va récupérer le cash ?' : 'Informations du bénéficiaire'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isCash
              ? 'Cette personne devra présenter le QR Code au bureau Bonzini Guangzhou.'
              : 'Ces informations permettent à Bonzini d\'effectuer le paiement. Vous pouvez les ajouter maintenant ou plus tard.'}
          </p>
        </div>

        {isCash ? (
          <CashBeneficiaryForm onChange={handleCashBeneficiaryChange} />
        ) : (
          <div className="space-y-4">
            {isAlipayOrWechat && (
              <>
                {/* QR Code upload - beneficiary info, NOT proof */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    QR Code du bénéficiaire
                    <span className="text-xs text-muted-foreground">(recommandé)</span>
                  </Label>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
                    }}
                    className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    {qrCodeFile ? (
                      <div className="flex flex-col items-center gap-2">
                        <ImageIcon className="w-8 h-8 text-primary" />
                        <span className="text-sm font-medium text-foreground">{qrCodeFile.name}</span>
                        <span className="text-xs text-muted-foreground">Cliquez pour changer</span>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm font-medium text-foreground">Ajouter le QR code Alipay / WeChat</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Le QR code de paiement fourni par votre bénéficiaire
                        </p>
                      </>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Ou renseignez les infos</span>
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Nom du bénéficiaire</Label>
              <Input
                value={beneficiaryForm.name}
                onChange={(e) => setBeneficiaryForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Nom complet"
              />
            </div>

            {isAlipayOrWechat && (
              <div className="space-y-2">
                <Label>Téléphone / ID</Label>
                <Input
                  value={beneficiaryForm.phone}
                  onChange={(e) => setBeneficiaryForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="Numéro ou identifiant Alipay/WeChat"
                />
              </div>
            )}

            {isBankTransfer && (
              <>
                <div className="space-y-2">
                  <Label>Nom de la banque</Label>
                  <Input
                    value={beneficiaryForm.bank_name}
                    onChange={(e) => setBeneficiaryForm((prev) => ({ ...prev, bank_name: e.target.value }))}
                    placeholder="Nom de la banque"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Numéro de compte</Label>
                  <Input
                    value={beneficiaryForm.bank_account}
                    onChange={(e) => setBeneficiaryForm((prev) => ({ ...prev, bank_account: e.target.value }))}
                    placeholder="Numéro de compte bancaire"
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Notes (optionnel)</Label>
              <Textarea
                value={beneficiaryForm.notes}
                onChange={(e) => setBeneficiaryForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Instructions supplémentaires pour Bonzini"
                rows={3}
              />
            </div>
          </div>
        )}

        <div className="space-y-3 pt-2">
          <button
            onClick={() => setStep('confirm')}
            disabled={isCash && !isCashBeneficiaryValid}
            className={cn(
              "w-full py-4 rounded-xl font-semibold transition-all",
              isCash && !isCashBeneficiaryValid
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "btn-primary-gradient"
            )}
          >
            {isCash ? 'Continuer' : 'Continuer avec ces informations'}
          </button>

          {!isCash && (
            <button
              onClick={() => {
                setSkipBeneficiary(true);
                setBeneficiaryForm({
                  name: '',
                  phone: '',
                  email: '',
                  bank_name: '',
                  bank_account: '',
                  notes: '',
                  qr_code_url: '',
                });
                setQrCodeFile(null);
                setStep('confirm');
              }}
              className="w-full py-3 text-muted-foreground font-medium hover:bg-secondary rounded-xl transition-colors"
            >
              Ajouter plus tard
            </button>
          )}
        </div>
      </div>
    );
  };

  // Step 4: Confirmation
  const renderConfirmStep = () => {
    const methodInfo = paymentMethods.find((m) => m.id === selectedMethod);
    const Icon = methodInfo?.icon || CreditCard;
    const hasBeneficiaryInfo =
      beneficiaryForm.name || beneficiaryForm.phone || beneficiaryForm.bank_account || qrCodeFile;

    return (
      <div className="animate-fade-in space-y-6">
        <div className="card-elevated p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="w-8 h-8 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">Vous envoyez</p>
          <p className="text-3xl font-bold text-foreground mb-1">
            ¥ {amountRMB.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} RMB
          </p>
          <p className="text-sm text-muted-foreground">
            ({formatXAF(amountXAF)} XAF)
          </p>
        </div>

        <div className="card-elevated p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Méthode</span>
            <span className="font-medium text-foreground">{methodInfo?.label}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Taux utilisé</span>
            <span className="font-medium text-foreground">1 XAF = {rate.toFixed(5)} RMB</span>
          </div>

          {beneficiaryForm.name && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Bénéficiaire</span>
              <span className="font-medium text-foreground">{beneficiaryForm.name}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-border">
            <span className="font-semibold text-foreground">Montant débité</span>
            <span className="font-bold text-foreground">{formatXAF(amountXAF)} XAF</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Nouveau solde</span>
            <span className="font-medium text-foreground">
              {formatXAF((wallet?.balance_xaf || 0) - amountXAF)} XAF
            </span>
          </div>
        </div>

        {!hasBeneficiaryInfo && selectedMethod !== 'cash' && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-yellow-500/10 text-yellow-600 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>Vous pourrez ajouter les informations du bénéficiaire après la création.</span>
          </div>
        )}

        <Button
          onClick={handleSubmit}
          disabled={createPayment.isPending}
          className="w-full py-6 text-lg btn-primary-gradient"
        >
          {createPayment.isPending ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Création en cours...
            </>
          ) : (
            'Confirmer le paiement'
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          En confirmant, vous acceptez que {formatXAF(amountXAF)} XAF soient débités de votre solde.
        </p>
      </div>
    );
  };

  // Step 5: Success
  const renderSuccessStep = () => {
    const isCash = selectedMethod === 'cash';
    const beneficiaryName = isCash 
      ? `${cashBeneficiaryData.firstName} ${cashBeneficiaryData.lastName}`.trim()
      : beneficiaryForm.name;

    if (isCash && paymentId && paymentReference) {
      return (
        <div className="animate-scale-in py-6 space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
              <Check className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-1">Paiement cash créé !</h2>
            <p className="text-sm text-muted-foreground">
              Présentez ce QR Code au bureau Bonzini Guangzhou
            </p>
          </div>

          <CashQRCode
            paymentId={paymentId}
            paymentReference={paymentReference}
            amountRMB={amountRMB}
            beneficiaryName={beneficiaryName || 'Client'}
          />

          <div className="space-y-3">
            <button
              onClick={() => navigate(`/payments/${paymentId}`)}
              className="w-full py-3 bg-secondary text-foreground font-medium rounded-xl"
            >
              Voir le détail du paiement
            </button>
            <button
              onClick={() => navigate('/payments')}
              className="w-full py-3 text-muted-foreground font-medium hover:bg-secondary rounded-xl transition-colors"
            >
              Mes paiements
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="animate-scale-in text-center py-12">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/10 flex items-center justify-center">
          <Check className="w-10 h-10 text-green-500" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Paiement créé !</h2>
        <p className="text-muted-foreground mb-2">
          Votre demande de paiement a été enregistrée
        </p>
        <p className="text-2xl font-bold text-primary mb-2">
          ¥ {amountRMB.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} RMB
        </p>
        <p className="text-sm text-muted-foreground mb-8">
          {formatXAF(amountXAF)} XAF débités de votre solde
        </p>

        <div className="space-y-3">
          {paymentId && (
            <button
              onClick={() => navigate(`/payments/${paymentId}`)}
              className="w-full btn-primary-gradient"
            >
              Voir le paiement
            </button>
          )}
          <button
            onClick={() => navigate('/payments')}
            className="w-full py-3 bg-secondary text-foreground font-medium rounded-xl"
          >
            Mes paiements
          </button>
          <button
            onClick={() => navigate('/')}
            className="w-full py-3 text-muted-foreground font-medium hover:bg-secondary rounded-xl transition-colors"
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  };

  const steps: Step[] = ['amount', 'method', 'beneficiary', 'confirm'];
  const currentStepIndex = steps.indexOf(step);

  return (
    <MobileLayout showNav={false}>
      <PageHeader 
        title={step === 'success' ? 'Succès' : 'Nouveau paiement'} 
        showBack={step !== 'success'}
      />

      <div className="px-4 py-6">
        {step !== 'success' && (
          <div className="flex gap-1 mb-6">
            {steps.map((s, i) => (
              <div
                key={s}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors',
                  currentStepIndex >= i ? 'bg-primary' : 'bg-muted'
                )}
              />
            ))}
          </div>
        )}

        {step === 'amount' && renderAmountStep()}
        {step === 'method' && renderMethodStep()}
        {step === 'beneficiary' && renderBeneficiaryStep()}
        {step === 'confirm' && renderConfirmStep()}
        {step === 'success' && renderSuccessStep()}
      </div>
    </MobileLayout>
  );
};

export default NewPaymentPage;
