import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Loader2, 
  Search,
  CreditCard,
  Wallet,
  Building2,
  Banknote,
  Upload,
  X,
  User,
  CalendarIcon,
  AlertCircle,
  QrCode,
} from 'lucide-react';
import { useAllClients } from '@/hooks/useAdminCreateDeposit';
import { useWalletByUserId, useExchangeRate } from '@/hooks/useWallet';
import { useAdminCreatePayment } from '@/hooks/useAdminPayments';
import { formatXAF, formatCurrencyRMB } from '@/lib/formatters';
import { cn } from '@/lib/utils';

type Step = 'client' | 'amount' | 'method' | 'beneficiary' | 'summary';
type PaymentMethod = 'alipay' | 'wechat' | 'bank_transfer' | 'cash';

const STEP_LABELS: Record<Step, string> = {
  client: 'Client',
  amount: 'Montant',
  method: 'Mode',
  beneficiary: 'Bénéficiaire',
  summary: 'Récap',
};

const paymentMethods = [
  { 
    method: 'alipay' as const, 
    label: 'Alipay', 
    icon: CreditCard,
    description: 'Paiement via QR code Alipay'
  },
  { 
    method: 'wechat' as const, 
    label: 'WeChat Pay', 
    icon: Wallet,
    description: 'Paiement via QR code WeChat'
  },
  { 
    method: 'bank_transfer' as const, 
    label: 'Virement bancaire', 
    icon: Building2,
    description: 'Transfert vers compte bancaire chinois'
  },
  { 
    method: 'cash' as const, 
    label: 'Cash', 
    icon: Banknote,
    description: 'Retrait en espèces'
  },
];

export function AdminNewPaymentPage() {
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
  const [beneficiaryEmail, setBeneficiaryEmail] = useState('');
  const [beneficiaryBankName, setBeneficiaryBankName] = useState('');
  const [beneficiaryBankAccount, setBeneficiaryBankAccount] = useState('');
  const [beneficiaryNotes, setBeneficiaryNotes] = useState('');
  const [qrCodeFiles, setQrCodeFiles] = useState<File[]>([]);
  const [qrCodePreviews, setQrCodePreviews] = useState<string[]>([]);
  
  // Date and comment
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [clientVisibleComment, setClientVisibleComment] = useState('');

  // Get selected client's wallet
  const { data: clientWallet } = useWalletByUserId(selectedClient?.user_id);

  // Calculate effective rate
  const effectiveRate = useMemo(() => {
    if (useCustomRate && customRate) {
      return parseFloat(customRate);
    }
    return currentRate || 0.01167;
  }, [useCustomRate, customRate, currentRate]);

  // Calculate amounts based on input mode
  const calculatedAmountXAF = useMemo(() => {
    if (inputMode === 'XAF') {
      return parseInt(amountXAF) || 0;
    }
    // RMB to XAF
    const rmb = parseFloat(amountRMB) || 0;
    return Math.round(rmb / effectiveRate);
  }, [inputMode, amountXAF, amountRMB, effectiveRate]);

  const calculatedAmountRMB = useMemo(() => {
    if (inputMode === 'RMB') {
      return parseFloat(amountRMB) || 0;
    }
    // XAF to RMB
    const xaf = parseInt(amountXAF) || 0;
    return Math.round(xaf * effectiveRate * 100) / 100;
  }, [inputMode, amountXAF, amountRMB, effectiveRate]);

  // Filter clients
  const filteredClients = useMemo(() => {
    if (!clients) return [];
    if (!clientSearch.trim()) return clients.slice(0, 10);
    
    const search = clientSearch.toLowerCase();
    return clients.filter(c => 
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(search) ||
      c.phone?.includes(search)
    ).slice(0, 10);
  }, [clients, clientSearch]);

  // Check if balance is sufficient
  const balanceAfter = (clientWallet?.balance_xaf || 0) - calculatedAmountXAF;
  const isBalanceInsufficient = balanceAfter < 0;

  // Handle QR code file upload
  const handleQrCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newPreviews = files.map(file => URL.createObjectURL(file));
    setQrCodeFiles(prev => [...prev, ...files]);
    setQrCodePreviews(prev => [...prev, ...newPreviews]);
  };

  const removeQrCode = (index: number) => {
    URL.revokeObjectURL(qrCodePreviews[index]);
    setQrCodeFiles(prev => prev.filter((_, i) => i !== index));
    setQrCodePreviews(prev => prev.filter((_, i) => i !== index));
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

  // Submit
  const handleSubmit = async () => {
    if (!selectedClient || !selectedMethod) return;
    
    await createPayment.mutateAsync({
      user_id: selectedClient.user_id,
      amount_xaf: calculatedAmountXAF,
      amount_rmb: calculatedAmountRMB,
      exchange_rate: effectiveRate,
      method: selectedMethod,
      beneficiary_name: beneficiaryName || undefined,
      beneficiary_phone: beneficiaryPhone || undefined,
      beneficiary_email: beneficiaryEmail || undefined,
      beneficiary_bank_name: beneficiaryBankName || undefined,
      beneficiary_bank_account: beneficiaryBankAccount || undefined,
      beneficiary_notes: beneficiaryNotes || undefined,
      client_visible_comment: clientVisibleComment || undefined,
      desired_date: !isToday(paymentDate) ? paymentDate : undefined,
      qr_code_files: qrCodeFiles.length > 0 ? qrCodeFiles : undefined,
    });

    navigate('/admin/payments');
  };

  // Progress calculation
  const steps: Step[] = ['client', 'amount', 'method', 'beneficiary', 'summary'];
  const currentStepIndex = steps.indexOf(step);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  // Back navigation
  const goBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setStep(steps[prevIndex]);
    } else {
      navigate('/admin/payments');
    }
  };

  // Render step content
  const renderContent = () => {
    switch (step) {
      case 'client':
        return (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un client (nom, téléphone)..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>

            {clientsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {filteredClients.map((client) => (
                  <ClientCard
                    key={client.id}
                    client={client}
                    isSelected={selectedClient?.id === client.id}
                    onSelect={() => {
                      setSelectedClient(client);
                      setStep('amount');
                    }}
                  />
                ))}

                {filteredClients.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Aucun client trouvé
                  </p>
                )}
              </div>
            )}
          </div>
        );

      case 'amount':
        return (
          <div className="space-y-6">
            {/* Client summary */}
            {selectedClient && clientWallet && (
              <div className="p-4 rounded-xl bg-secondary/50 space-y-2">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {selectedClient.first_name[0]}{selectedClient.last_name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{selectedClient.first_name} {selectedClient.last_name}</p>
                    <p className="text-sm text-muted-foreground">Solde: {formatXAF(clientWallet.balance_xaf)} XAF</p>
                  </div>
                </div>
              </div>
            )}

            {/* Input mode toggle */}
            <div className="flex justify-center gap-2">
              <Button
                variant={inputMode === 'XAF' ? 'default' : 'outline'}
                onClick={() => setInputMode('XAF')}
                size="sm"
              >
                Saisir en XAF
              </Button>
              <Button
                variant={inputMode === 'RMB' ? 'default' : 'outline'}
                onClick={() => setInputMode('RMB')}
                size="sm"
              >
                Saisir en RMB
              </Button>
            </div>

            {/* Amount input */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Montant à {inputMode === 'XAF' ? 'débiter' : 'payer'}
              </p>
              <div className="flex items-center justify-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={inputMode === 'XAF' ? amountXAF : amountRMB}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9.]/g, '');
                    if (inputMode === 'XAF') {
                      setAmountXAF(value.replace('.', ''));
                    } else {
                      setAmountRMB(value);
                    }
                  }}
                  placeholder="0"
                  className="text-4xl font-bold text-center bg-transparent border-none outline-none w-48"
                  autoFocus
                />
                <span className="text-2xl text-muted-foreground">{inputMode}</span>
              </div>
            </div>

            {/* Conversion display */}
            {(calculatedAmountXAF > 0 || calculatedAmountRMB > 0) && (
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Montant débité</span>
                  <span className="font-bold">{formatXAF(calculatedAmountXAF)} XAF</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Montant à payer</span>
                  <span className="font-bold text-primary">{formatCurrencyRMB(calculatedAmountRMB)}</span>
                </div>
                <div className="flex justify-between text-sm border-t pt-2">
                  <span className="text-muted-foreground">Taux appliqué</span>
                  <span>1 000 000 XAF = {formatCurrencyRMB(1000000 * effectiveRate)}</span>
                </div>
                {clientWallet && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Solde disponible</span>
                      <span>{formatXAF(clientWallet.balance_xaf)} XAF</span>
                    </div>
                    <div className={cn(
                      "flex justify-between text-sm font-medium",
                      isBalanceInsufficient ? "text-destructive" : "text-green-600"
                    )}>
                      <span>Solde après débit</span>
                      <span>{formatXAF(balanceAfter)} XAF</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {isBalanceInsufficient && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Solde insuffisant</span>
              </div>
            )}

            {/* Custom rate toggle */}
            <div className="space-y-3 p-4 rounded-xl border">
              <div className="flex items-center justify-between">
                <Label htmlFor="custom-rate" className="text-sm">Taux personnalisé</Label>
                <Switch
                  id="custom-rate"
                  checked={useCustomRate}
                  onCheckedChange={setUseCustomRate}
                />
              </div>
              {useCustomRate && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">1 000 000 XAF =</span>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={customRate}
                    onChange={(e) => setCustomRate(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder={(currentRate ? (1000000 * currentRate).toFixed(2) : '11670')}
                    className="w-28"
                  />
                  <span className="text-sm text-muted-foreground">RMB</span>
                </div>
              )}
              {!useCustomRate && currentRate && (
                <p className="text-xs text-muted-foreground">
                  Taux du jour: 1 000 000 XAF = {formatCurrencyRMB(1000000 * currentRate)}
                </p>
              )}
            </div>

            {/* Date selector */}
            <div className="space-y-3 p-4 rounded-xl border">
              <p className="text-sm font-medium">Date du paiement</p>
              <div className="flex gap-2">
                <Button
                  variant={isToday(paymentDate) ? 'default' : 'outline'}
                  onClick={() => setPaymentDate(new Date())}
                  size="sm"
                >
                  Aujourd'hui
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={!isToday(paymentDate) ? 'default' : 'outline'}
                      size="sm"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {!isToday(paymentDate) 
                        ? format(paymentDate, 'dd MMM yyyy', { locale: fr })
                        : 'Autre date'
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="center">
                    <Calendar
                      mode="single"
                      selected={paymentDate}
                      onSelect={(date) => date && setPaymentDate(date)}
                      locale={fr}
                      disabled={(date) => date > new Date()}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <Button
              onClick={() => setStep('method')}
              disabled={!calculatedAmountXAF || calculatedAmountXAF < 1000 || isBalanceInsufficient}
              className="w-full"
            >
              Continuer <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        );

      case 'method':
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">
              Mode de paiement
            </p>
            {paymentMethods.map((method) => {
              const IconComponent = method.icon;
              const isSelected = selectedMethod === method.method;
              
              return (
                <button
                  key={method.method}
                  onClick={() => {
                    setSelectedMethod(method.method);
                    setStep('beneficiary');
                  }}
                  className={cn(
                    'w-full flex items-center gap-4 p-4 rounded-lg border transition-all',
                    'hover:border-primary/50 hover:bg-primary/5',
                    isSelected && 'border-primary bg-primary/10'
                  )}
                >
                  <div className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center',
                    isSelected ? 'bg-primary text-primary-foreground' : 'bg-secondary'
                  )}>
                    <IconComponent className="h-6 w-6" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold">{method.label}</p>
                    <p className="text-sm text-muted-foreground">{method.description}</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        );

      case 'beneficiary':
        return (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Informations du bénéficiaire
              {selectedMethod !== 'cash' && !hasBeneficiaryInfo && (
                <span className="text-amber-600 ml-2">(optionnel, mais bloquera le paiement)</span>
              )}
            </p>

            {(selectedMethod === 'alipay' || selectedMethod === 'wechat') && (
              <div className="space-y-4">
                {/* QR Code upload */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <QrCode className="h-4 w-4" />
                    QR Code(s) de paiement
                  </Label>
                  
                  {/* Previews */}
                  {qrCodePreviews.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {qrCodePreviews.map((preview, index) => (
                        <div key={index} className="relative group">
                          <img 
                            src={preview} 
                            alt={`QR Code ${index + 1}`}
                            className="w-full aspect-square object-cover rounded-lg border"
                          />
                          <button
                            onClick={() => removeQrCode(index)}
                            className="absolute -top-2 -right-2 p-1 rounded-full bg-destructive text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Ajouter un QR code</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleQrCodeChange}
                    />
                  </label>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-sm text-muted-foreground">ou</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <div className="space-y-3">
                  <div>
                    <Label>Nom du bénéficiaire</Label>
                    <Input
                      value={beneficiaryName}
                      onChange={(e) => setBeneficiaryName(e.target.value)}
                      placeholder="Nom complet"
                    />
                  </div>
                  <div>
                    <Label>Téléphone</Label>
                    <Input
                      value={beneficiaryPhone}
                      onChange={(e) => setBeneficiaryPhone(e.target.value)}
                      placeholder="+86..."
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={beneficiaryEmail}
                      onChange={(e) => setBeneficiaryEmail(e.target.value)}
                      placeholder="email@example.com"
                    />
                  </div>
                </div>
              </div>
            )}

            {selectedMethod === 'bank_transfer' && (
              <div className="space-y-3">
                <div>
                  <Label>Nom du bénéficiaire *</Label>
                  <Input
                    value={beneficiaryName}
                    onChange={(e) => setBeneficiaryName(e.target.value)}
                    placeholder="Nom complet"
                  />
                </div>
                <div>
                  <Label>Banque *</Label>
                  <Input
                    value={beneficiaryBankName}
                    onChange={(e) => setBeneficiaryBankName(e.target.value)}
                    placeholder="Nom de la banque"
                  />
                </div>
                <div>
                  <Label>Numéro de compte *</Label>
                  <Input
                    value={beneficiaryBankAccount}
                    onChange={(e) => setBeneficiaryBankAccount(e.target.value)}
                    placeholder="Numéro de compte bancaire"
                  />
                </div>
              </div>
            )}

            {selectedMethod === 'cash' && (
              <div className="p-4 rounded-xl bg-secondary/50 text-center">
                <Banknote className="h-12 w-12 mx-auto text-primary mb-2" />
                <p className="font-medium">Retrait en espèces</p>
                <p className="text-sm text-muted-foreground">
                  Le client récupérera le montant en cash
                </p>
              </div>
            )}

            {/* Notes */}
            <div>
              <Label>Notes / instructions</Label>
              <Textarea
                value={beneficiaryNotes}
                onChange={(e) => setBeneficiaryNotes(e.target.value)}
                placeholder="Instructions supplémentaires..."
                rows={2}
              />
            </div>

            {/* Client visible comment */}
            <div>
              <Label>Motif (visible par le client)</Label>
              <Textarea
                value={clientVisibleComment}
                onChange={(e) => setClientVisibleComment(e.target.value)}
                placeholder="Ce message sera visible dans l'historique du client..."
                rows={2}
              />
            </div>

            {!hasBeneficiaryInfo && selectedMethod !== 'cash' && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">
                  Sans informations bénéficiaire, le paiement restera en attente.
                </span>
              </div>
            )}

            <Button onClick={() => setStep('summary')} className="w-full">
              Voir le récapitulatif <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        );

      case 'summary':
        const methodInfo = paymentMethods.find(m => m.method === selectedMethod);
        const MethodIcon = methodInfo?.icon || CreditCard;
        
        return (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Récapitulatif du paiement</h3>

            {/* Client */}
            {selectedClient && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {selectedClient.first_name[0]}{selectedClient.last_name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{selectedClient.first_name} {selectedClient.last_name}</p>
                      {selectedClient.phone && (
                        <p className="text-sm text-muted-foreground">{selectedClient.phone}</p>
                      )}
                    </div>
                  </div>
                  {clientWallet && (
                    <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Solde actuel</span>
                        <p className="font-medium">{formatXAF(clientWallet.balance_xaf)} XAF</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Après débit</span>
                        <p className="font-medium text-green-600">{formatXAF(balanceAfter)} XAF</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Amounts */}
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Montant débité</span>
                  <span className="font-bold text-lg">{formatXAF(calculatedAmountXAF)} XAF</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Montant à payer</span>
                  <span className="font-bold text-lg text-primary">{formatCurrencyRMB(calculatedAmountRMB)}</span>
                </div>
                <div className="flex justify-between text-sm border-t pt-2">
                  <span className="text-muted-foreground">Taux appliqué</span>
                  <span className={useCustomRate ? 'text-amber-600' : ''}>
                    1M XAF = {formatCurrencyRMB(1000000 * effectiveRate)}
                    {useCustomRate && ' (personnalisé)'}
                  </span>
                </div>
                {!isToday(paymentDate) && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Date du paiement</span>
                    <span className="text-amber-600">{format(paymentDate, 'dd MMM yyyy', { locale: fr })}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Method */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <MethodIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{methodInfo?.label}</p>
                    <Badge variant={hasBeneficiaryInfo ? 'default' : 'secondary'}>
                      {hasBeneficiaryInfo ? 'Prêt à payer' : 'En attente d\'instructions'}
                    </Badge>
                  </div>
                </div>
                
                {(beneficiaryName || qrCodePreviews.length > 0) && (
                  <div className="mt-3 pt-3 border-t space-y-2 text-sm">
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
                          <img key={i} src={preview} alt="" className="w-16 h-16 rounded border object-cover" />
                        ))}
                        {qrCodePreviews.length > 3 && (
                          <div className="w-16 h-16 rounded border flex items-center justify-center bg-secondary">
                            <span className="text-sm text-muted-foreground">+{qrCodePreviews.length - 3}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Visible comment */}
            {clientVisibleComment && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground mb-1">Motif (visible client)</p>
                  <p className="text-sm">{clientVisibleComment}</p>
                </CardContent>
              </Card>
            )}

            <Button 
              onClick={handleSubmit} 
              className="w-full"
              disabled={createPayment.isPending}
            >
              {createPayment.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Création en cours...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Créer le paiement
                </>
              )}
            </Button>
          </div>
        );
    }
  };

  return (
    <AdminLayout>
      <div className="min-h-screen">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background border-b">
          <div className="flex items-center gap-4 p-4">
            <Button variant="ghost" size="icon" onClick={goBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="font-bold text-lg">Créer un paiement</h1>
              <p className="text-sm text-muted-foreground">
                {STEP_LABELS[step]}
              </p>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="h-1 bg-secondary">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {renderContent()}
        </div>
      </div>
    </AdminLayout>
  );
}

// Client card component
function ClientCard({ 
  client, 
  isSelected, 
  onSelect 
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
        'w-full flex items-center gap-3 p-3 rounded-lg border transition-all',
        'hover:border-primary/50 hover:bg-primary/5',
        isSelected && 'border-primary bg-primary/10'
      )}
    >
      <Avatar className="h-10 w-10">
        <AvatarFallback className="bg-primary/10 text-primary">
          {client.first_name[0]}{client.last_name[0]}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 text-left">
        <p className="font-medium">{client.first_name} {client.last_name}</p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {client.phone && <span>{client.phone}</span>}
          {wallet && (
            <Badge variant="outline" className="text-xs">
              {formatXAF(wallet.balance_xaf)} XAF
            </Badge>
          )}
        </div>
      </div>
      {isSelected && (
        <Check className="h-5 w-5 text-primary" />
      )}
    </button>
  );
}

export default AdminNewPaymentPage;
