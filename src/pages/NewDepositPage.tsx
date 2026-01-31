import { useState, useMemo } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { formatXAF } from '@/lib/formatters';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateDeposit, DepositMethod as DBDepositMethod } from '@/hooks/useDeposits';
import { BUSINESS_RULES } from '@/lib/constants';
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
  generateDepositReference,
  getBankInfo,
  getAgencyInfo,
} from '@/data/depositMethodsData';
import {
  DepositMethodFamily,
  DepositSubMethod,
  BankOption,
  AgencyOption
} from '@/types/deposit';
import {
  Check,
  Upload,
  ArrowRight,
  ArrowLeft,
  Copy,
  Info,
  MapPin,
  Clock,
  Phone,
  Building2,
  User,
  Loader2,
  FileText,
} from 'lucide-react';
import * as Icons from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

type Step = 
  | 'amount' 
  | 'family' 
  | 'submethod' 
  | 'bank' 
  | 'agency' 
  | 'client-info'
  | 'instructions' 
  | 'proof' 
  | 'success';

const NewDepositPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const createDeposit = useCreateDeposit();
  
  // Flow state
  const [step, setStep] = useState<Step>('amount');
  const [amount, setAmount] = useState('');
  const [selectedFamily, setSelectedFamily] = useState<DepositMethodFamily | null>(null);
  const [selectedSubMethod, setSelectedSubMethod] = useState<DepositSubMethod | null>(null);
  const [selectedBank, setSelectedBank] = useState<BankOption | null>(null);
  const [selectedAgency, setSelectedAgency] = useState<AgencyOption | null>(null);
  const [clientPhone, setClientPhone] = useState('');
  const [clientName, setClientName] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [createdDepositId, setCreatedDepositId] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Generate reference code
  const depositReference = useMemo(() => {
    return generateDepositReference(user?.email?.split('@')[0] || 'CLIENT');
  }, [user]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copié dans le presse-papier');
  };

  const handleCopyAll = () => {
    const info = getInstructionInfo();
    if (!info) return;
    
    const allText = `${info.accountLabel}: ${info.accountValue}\nTitulaire: ${info.accountName}\nMontant: ${formatXAF(parseInt(amount))} XAF\nRéférence: ${depositReference}`;
    navigator.clipboard.writeText(allText);
    toast.success('Toutes les informations copiées');
  };

  // Map our internal types to the database deposit method format
  const getDepositMethod = (): DBDepositMethod => {
    if (selectedFamily === 'BANK') {
      return selectedSubMethod === 'BANK_TRANSFER' ? 'bank_transfer' : 'bank_cash';
    }
    if (selectedFamily === 'ORANGE_MONEY') {
      return selectedSubMethod === 'OM_TRANSFER' ? 'om_transfer' : 'om_withdrawal';
    }
    if (selectedFamily === 'MTN_MONEY') {
      return selectedSubMethod === 'MTN_TRANSFER' ? 'mtn_transfer' : 'mtn_withdrawal';
    }
    if (selectedFamily === 'AGENCY_BONZINI') return 'agency_cash';
    if (selectedFamily === 'WAVE') return 'wave';
    return 'bank_transfer';
  };

  const handleSubmit = async () => {
    try {
      const deposit = await createDeposit.mutateAsync({
        amount_xaf: parseInt(amount),
        method: getDepositMethod(),
        bank_name: selectedBank || undefined,
        agency_name: selectedAgency || undefined,
        client_phone: clientPhone || undefined,
      });

      // Store the created deposit ID for navigation
      setCreatedDepositId(deposit.id);

      toast.success('Dépôt créé avec succès !', {
        description: 'Vous avez 48h pour effectuer le dépôt et envoyer la preuve.',
      });

      // Go to success step instead of navigating immediately
      setStep('success');
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  const handleCopyField = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success('Copié !');
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error('Erreur lors de la copie');
    }
  };

  // Determine next step based on selections
  const handleFamilySelected = (family: DepositMethodFamily) => {
    setSelectedFamily(family);
    
    if (familyRequiresSubMethod(family)) {
      setStep('submethod');
    } else if (family === 'AGENCY_BONZINI') {
      setSelectedSubMethod('AGENCY_CASH');
      setStep('agency');
    } else if (family === 'WAVE') {
      setSelectedSubMethod('WAVE_TRANSFER');
      setStep('instructions');
    }
  };

  const handleSubMethodSelected = (subMethod: DepositSubMethod) => {
    setSelectedSubMethod(subMethod);
    
    if (subMethodRequiresBankSelection(subMethod)) {
      setStep('bank');
    } else {
      // All other methods (including withdrawals) go directly to instructions
      setStep('instructions');
    }
  };

  const handleBankSelected = (bank: BankOption) => {
    setSelectedBank(bank);
    setStep('instructions');
  };

  const handleAgencySelected = (agency: AgencyOption) => {
    setSelectedAgency(agency);
    setStep('instructions');
  };

  const handleClientInfoSubmit = () => {
    if (!clientPhone || !clientName) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    setStep('instructions');
  };

  // Get instruction info based on selected method
  const getInstructionInfo = () => {
    if (!selectedFamily) return null;

    if (selectedFamily === 'BANK' && selectedBank) {
      const bankInfo = getBankInfo(selectedBank);
      return {
        type: 'bank',
        title: selectedSubMethod === 'BANK_TRANSFER' ? 'Virement bancaire' : 'Dépôt cash en banque',
        accountLabel: 'N° Compte',
        accountValue: bankInfo?.bonziniAccount.accountNumber || '',
        accountName: bankInfo?.bonziniAccount.accountName || '',
        bankName: bankInfo?.bonziniAccount.bankName || '',
        instructions: selectedSubMethod === 'BANK_TRANSFER' 
          ? [
              'Connectez-vous à votre application bancaire ou rendez-vous en agence',
              'Effectuez un virement vers le compte ci-dessus',
              `Indiquez la référence: ${depositReference}`,
              'Conservez le reçu et téléchargez-le ici',
            ]
          : [
              `Rendez-vous dans une agence ${bankInfo?.label}`,
              'Effectuez un dépôt cash sur le compte ci-dessus',
              `Indiquez la référence: ${depositReference}`,
              'Conservez le bordereau et téléchargez-le ici',
            ],
      };
    }

    if (selectedFamily === 'ORANGE_MONEY') {
      if (selectedSubMethod === 'OM_TRANSFER') {
        return {
          type: 'mobile',
          title: 'Transfert Orange Money',
          accountLabel: 'Numéro OM',
          accountValue: orangeMoneyAccount.phone,
          accountName: orangeMoneyAccount.accountName,
          instructions: [
            'Composez #150*1*1#',
            `Entrez le numéro: ${orangeMoneyAccount.phone}`,
            `Saisissez le montant: ${formatXAF(parseInt(amount))} XAF`,
            'Confirmez avec votre code PIN',
            'Prenez une capture d\'écran du SMS de confirmation',
          ],
        };
      } else {
        // Withdrawal - show merchant code with amount integrated
        const merchantCodeWithAmount = omMerchantInfo.merchantCode.replace('MONTANT', amount);
        return {
          type: 'merchant',
          title: 'Retrait Orange Money',
          accountLabel: 'Titulaire',
          accountValue: omMerchantInfo.accountName,
          accountName: omMerchantInfo.accountName,
          merchantCode: merchantCodeWithAmount,
          instructions: [
            'Composez le code ci-dessous sur votre téléphone',
            'Validez avec votre code PIN Orange Money',
            'Prenez une capture d\'écran du SMS de confirmation',
          ],
        };
      }
    }

    if (selectedFamily === 'MTN_MONEY') {
      if (selectedSubMethod === 'MTN_TRANSFER') {
        return {
          type: 'mobile',
          title: 'Transfert MTN Mobile Money',
          accountLabel: 'Numéro MOMO',
          accountValue: mtnMoneyAccount.phone,
          accountName: mtnMoneyAccount.accountName,
          instructions: [
            'Composez *126#',
            'Sélectionnez "Transfert d\'argent"',
            `Entrez le numéro: ${mtnMoneyAccount.phone}`,
            `Saisissez le montant: ${formatXAF(parseInt(amount))} XAF`,
            'Confirmez avec votre code PIN',
          ],
        };
      } else {
        // Withdrawal - show merchant code with amount integrated
        const merchantCodeWithAmount = mtnMerchantInfo.merchantCode.replace('MONTANT', amount);
        return {
          type: 'merchant',
          title: 'Retrait MTN Mobile Money',
          accountLabel: 'Titulaire',
          accountValue: mtnMerchantInfo.accountName,
          accountName: mtnMerchantInfo.accountName,
          merchantCode: merchantCodeWithAmount,
          instructions: [
            'Composez le code ci-dessous sur votre téléphone',
            'Validez avec votre code PIN MTN Mobile Money',
            'Prenez une capture d\'écran du SMS de confirmation',
          ],
        };
      }
    }

    if (selectedFamily === 'AGENCY_BONZINI' && selectedAgency) {
      const agencyInfo = getAgencyInfo(selectedAgency);
      return {
        type: 'agency',
        title: 'Dépôt en agence Bonzini',
        accountLabel: 'Agence',
        accountValue: agencyInfo?.label || '',
        accountName: 'BONZINI TRADING',
        address: agencyInfo?.address,
        hours: agencyInfo?.hours,
        instructions: [
          `Rendez-vous à l'agence ${agencyInfo?.label}`,
          'Présentez votre pièce d\'identité',
          `Mentionnez la référence: ${depositReference}`,
          'Effectuez votre dépôt en espèces',
          'Conservez votre reçu',
        ],
      };
    }

    if (selectedFamily === 'WAVE') {
      return {
        type: 'mobile',
        title: 'Transfert Wave',
        accountLabel: 'Numéro Wave',
        accountValue: waveAccount.phone,
        accountName: waveAccount.accountName,
        instructions: [
          'Ouvrez l\'application Wave',
          'Sélectionnez "Envoyer"',
          `Entrez le numéro: ${waveAccount.phone}`,
          `Saisissez le montant: ${formatXAF(parseInt(amount))} XAF`,
          'Confirmez le transfert',
        ],
      };
    }

    return null;
  };

  // ============================================
  // RENDER FUNCTIONS
  // ============================================

  const renderAmountInput = () => (
    <div className="animate-fade-in">
      <div className="card-elevated p-6 mb-6">
        <p className="text-sm text-muted-foreground text-center mb-4">
          Montant à déposer
        </p>
        <div className="flex items-center justify-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="0"
            className="amount-input text-foreground"
          />
          <span className="text-2xl font-medium text-muted-foreground">XAF</span>
        </div>
        {amount && (
          <p className="text-center text-sm text-muted-foreground mt-2">
            {formatXAF(parseInt(amount) || 0)} XAF
          </p>
        )}
      </div>
      
      <div className="grid grid-cols-3 gap-2 mb-6">
        {[100000, 500000, 1000000].map((preset) => (
          <button
            key={preset}
            onClick={() => setAmount(preset.toString())}
            className="py-3 rounded-xl bg-secondary text-foreground font-medium hover:bg-secondary/80 transition-colors text-sm"
          >
            {formatXAF(preset)}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center mb-6">
        Montant minimum: 50 000 XAF
      </p>
      
      <button
        onClick={() => amount && parseInt(amount) >= 50000 && setStep('family')}
        disabled={!amount || parseInt(amount) < 50000}
        className={cn(
          'w-full py-4 rounded-xl font-semibold transition-all',
          amount && parseInt(amount) >= 50000
            ? 'btn-primary-gradient'
            : 'bg-muted text-muted-foreground cursor-not-allowed'
        )}
      >
        Continuer
      </button>
    </div>
  );

  const renderFamilySelection = () => (
    <div className="space-y-3 animate-fade-in">
      <p className="text-sm text-muted-foreground mb-4">
        Comment souhaitez-vous déposer ?
      </p>
      {methodFamilies.map((family) => {
        const IconComponent = (Icons as any)[family.icon] || Icons.Banknote;
        const isSelected = selectedFamily === family.family;
        
        return (
          <button
            key={family.family}
            onClick={() => handleFamilySelected(family.family)}
            className={cn(
              'method-card w-full text-left',
              isSelected && 'method-card-selected'
            )}
          >
            <div className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center',
              isSelected ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
            )}>
              <IconComponent className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">{family.label}</p>
              <p className="text-xs text-muted-foreground">{family.description}</p>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground" />
          </button>
        );
      })}
    </div>
  );

  const renderSubMethodSelection = () => {
    if (!selectedFamily) return null;
    const subMethodsList = getSubMethodsForFamily(selectedFamily);
    
    return (
      <div className="space-y-3 animate-fade-in">
        <button
          onClick={() => setStep('family')}
          className="flex items-center gap-2 text-sm text-muted-foreground mb-4 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>
        
        <p className="text-sm text-muted-foreground mb-4">
          Type d'opération
        </p>
        
        {subMethodsList.map((subMethod) => (
          <button
            key={subMethod.subMethod}
            onClick={() => handleSubMethodSelected(subMethod.subMethod)}
            className="method-card w-full text-left"
          >
            <div className="flex-1">
              <p className="font-semibold text-foreground">{subMethod.label}</p>
              <p className="text-xs text-muted-foreground">{subMethod.description}</p>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground" />
          </button>
        ))}
      </div>
    );
  };

  const renderBankSelection = () => (
    <div className="space-y-3 animate-fade-in">
      <button
        onClick={() => setStep('submethod')}
        className="flex items-center gap-2 text-sm text-muted-foreground mb-4 hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour
      </button>
      
      <p className="text-sm text-muted-foreground mb-4">
        Choisissez votre banque
      </p>
      
      {banks.map((bank) => (
        <button
          key={bank.bank}
          onClick={() => handleBankSelected(bank.bank)}
          className="method-card w-full text-left"
        >
          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
            <Building2 className="w-5 h-5 text-foreground" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-foreground">{bank.label}</p>
          </div>
          <ArrowRight className="w-5 h-5 text-muted-foreground" />
        </button>
      ))}
    </div>
  );

  const renderAgencySelection = () => (
    <div className="space-y-3 animate-fade-in">
      <button
        onClick={() => setStep('family')}
        className="flex items-center gap-2 text-sm text-muted-foreground mb-4 hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour
      </button>
      
      <p className="text-sm text-muted-foreground mb-4">
        Choisissez une agence
      </p>
      
      {agencies.map((agency) => (
        <button
          key={agency.agency}
          onClick={() => handleAgencySelected(agency.agency)}
          className="method-card w-full text-left"
        >
          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
            <MapPin className="w-5 h-5 text-foreground" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-foreground">{agency.label}</p>
            <p className="text-xs text-muted-foreground">{agency.address}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <Clock className="w-3 h-3" />
              {agency.hours}
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-muted-foreground" />
        </button>
      ))}
    </div>
  );

  const renderClientInfoForm = () => (
    <div className="space-y-6 animate-fade-in">
      <button
        onClick={() => setStep('submethod')}
        className="flex items-center gap-2 text-sm text-muted-foreground mb-4 hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour
      </button>
      
      <div className="card-elevated p-4">
        <p className="text-sm text-muted-foreground mb-4">
          Nous avons besoin de vos informations pour initier le retrait
        </p>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Votre nom (sur le compte {selectedFamily === 'ORANGE_MONEY' ? 'OM' : 'MOMO'})
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ex: Jean Dupont"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Numéro de téléphone
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="tel"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="Ex: 6XX XXX XXX"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>
      </div>
      
      <button
        onClick={handleClientInfoSubmit}
        disabled={!clientPhone || !clientName}
        className={cn(
          'w-full py-4 rounded-xl font-semibold transition-all',
          clientPhone && clientName
            ? 'btn-primary-gradient'
            : 'bg-muted text-muted-foreground cursor-not-allowed'
        )}
      >
        Continuer
      </button>
    </div>
  );

  const renderInstructions = () => {
    const info = getInstructionInfo();
    if (!info) return null;

    return (
      <div className="animate-fade-in space-y-4">
        {/* Summary card */}
        <div className="card-elevated p-4 bg-primary/5 border-primary/20">
          <div className="flex justify-between items-start mb-2">
            <span className="text-sm text-muted-foreground">Montant à déposer</span>
            <span className="font-bold text-lg text-foreground">{formatXAF(parseInt(amount))} XAF</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Méthode</span>
            <span className="text-sm font-medium text-foreground">{info.title}</span>
          </div>
        </div>

        {/* Account info */}
        <div className="card-elevated p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Info className="w-4 h-4 text-primary" />
              Informations de dépôt
            </p>
            <button 
              onClick={handleCopyAll}
              className="text-xs text-primary font-medium hover:underline"
            >
              Tout copier
            </button>
          </div>
          
          {(info as any).bankName && (
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Banque</span>
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{(info as any).bankName}</span>
                <button onClick={() => handleCopy((info as any).bankName!)}>
                  <Copy className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <span className="text-sm text-muted-foreground">{info.accountLabel}</span>
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground font-mono text-sm">{info.accountValue}</span>
              <button onClick={() => handleCopy(info.accountValue)}>
                <Copy className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
          </div>
          
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <span className="text-sm text-muted-foreground">Titulaire</span>
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">{info.accountName}</span>
              <button onClick={() => handleCopy(info.accountName)}>
                <Copy className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
          </div>

          {(info as any).address && (
            <div className="flex items-start justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Adresse</span>
              <span className="font-medium text-foreground text-right text-sm">{(info as any).address}</span>
            </div>
          )}

          {(info as any).hours && (
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Horaires</span>
              <span className="font-medium text-foreground text-sm">{(info as any).hours}</span>
            </div>
          )}
          {/* Merchant code for withdrawals */}
          {(info as any).merchantCode && (
            <div className="py-3 border-b border-border/50">
              <span className="text-sm text-muted-foreground block mb-2">Code Marchand</span>
              <div className="flex items-center justify-between bg-secondary/50 rounded-lg p-3">
                <span className="font-bold text-foreground font-mono text-sm break-all">{(info as any).merchantCode}</span>
                <button onClick={() => handleCopy((info as any).merchantCode)}>
                  <Copy className="w-4 h-4 text-muted-foreground hover:text-foreground flex-shrink-0 ml-2" />
                </button>
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-muted-foreground">Référence</span>
            <div className="flex items-center gap-2">
              <span className="font-medium text-primary font-mono text-xs">{depositReference}</span>
              <button onClick={() => handleCopy(depositReference)}>
                <Copy className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Instructions */}
        <div className="card-elevated p-4">
          <p className="text-sm font-semibold text-foreground mb-4">Instructions</p>
          <ol className="space-y-3">
            {info.instructions.map((instruction, index) => (
              <li key={index} className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center flex-shrink-0">
                  {index + 1}
                </span>
                <span className="text-sm text-muted-foreground pt-0.5">{instruction}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Note for withdrawal */}
        {(info as any).note && (
          <div className="card-elevated p-4 bg-warning/5 border-warning/20">
            <p className="text-sm text-warning">
              {(info as any).note}
            </p>
          </div>
        )}
        
        <button
          onClick={() => setStep('proof')}
          className="w-full btn-primary-gradient flex items-center justify-center gap-2"
        >
          J'ai effectué le dépôt
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  };

  const renderProofUpload = () => (
    <div className="animate-fade-in space-y-6">
      <div className="card-elevated p-6">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <Upload className="w-8 h-8 text-primary" />
          </div>
          <p className="font-semibold text-foreground mb-2">
            Téléchargez votre preuve
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Capture d'écran, bordereau ou reçu
          </p>
          
          <label className="block">
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setProofFile(e.target.files?.[0] || null)}
              className="hidden"
            />
            <div className="py-8 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors">
              {proofFile ? (
                <div className="flex items-center justify-center gap-2 text-success">
                  <Check className="w-5 h-5" />
                  <span className="font-medium">{proofFile.name}</span>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  Cliquez pour sélectionner un fichier
                </p>
              )}
            </div>
          </label>
        </div>
      </div>
      
      <button
        onClick={handleSubmit}
        disabled={createDeposit.isPending}
        className={cn(
          'w-full py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2',
          'btn-primary-gradient'
        )}
      >
        {createDeposit.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        Soumettre le dépôt
      </button>
      
      <button
        onClick={handleSubmit}
        disabled={createDeposit.isPending}
        className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        Envoyer la preuve plus tard
      </button>
    </div>
  );

  const renderSuccess = () => (
    <div className="animate-scale-in py-6">
      {/* Success Header */}
      <div className="text-center mb-6">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
          <Check className="w-10 h-10 text-success" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Demande enregistrée !</h2>
        <p className="text-muted-foreground">
          Votre demande de dépôt de {formatXAF(parseInt(amount))} XAF a été créée
        </p>
      </div>

      {/* Reference Card - Prominent */}
      <Card className="p-4 mb-4 bg-primary/5 border-primary/20">
        <p className="text-xs text-muted-foreground text-center mb-2">
          Référence à utiliser lors du dépôt
        </p>
        <div className="flex items-center justify-center gap-3">
          <p className="text-xl font-bold font-mono text-primary">
            {depositReference}
          </p>
          <button
            onClick={() => handleCopyField(depositReference, 'ref')}
            className="p-2 rounded-lg hover:bg-primary/10 transition-colors"
          >
            {copiedField === 'ref' ? (
              <Check className="w-5 h-5 text-success" />
            ) : (
              <Copy className="w-5 h-5 text-primary" />
            )}
          </button>
        </div>
      </Card>

      {/* Timer Warning */}
      <Card className="p-4 mb-6 bg-amber-50 border-amber-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="font-medium text-amber-800">
              Vous avez {BUSINESS_RULES.DEPOSIT_PROOF_DEADLINE_HOURS}h pour effectuer le dépôt
            </p>
            <p className="text-sm text-amber-600">
              Envoyez la preuve depuis votre fiche dépôt
            </p>
          </div>
        </div>
      </Card>

      {/* Next Steps */}
      <Card className="p-4 mb-6">
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Prochaines étapes
        </h3>
        <ol className="space-y-2">
          <li className="flex gap-3 text-sm">
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center flex-shrink-0">1</span>
            <span className="text-muted-foreground">Effectuez le dépôt avec la référence ci-dessus</span>
          </li>
          <li className="flex gap-3 text-sm">
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center flex-shrink-0">2</span>
            <span className="text-muted-foreground">Prenez une photo du reçu ou capture d'écran</span>
          </li>
          <li className="flex gap-3 text-sm">
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center flex-shrink-0">3</span>
            <span className="text-muted-foreground">Envoyez la preuve depuis votre fiche dépôt</span>
          </li>
        </ol>
      </Card>

      {/* Action Buttons */}
      <div className="space-y-3">
        <button
          onClick={() => createdDepositId && navigate(`/deposits/${createdDepositId}`)}
          className="w-full btn-primary-gradient flex items-center justify-center gap-2"
        >
          <FileText className="w-5 h-5" />
          Voir ma fiche dépôt
        </button>
        <button
          onClick={() => navigate('/deposits')}
          className="w-full py-3 text-foreground font-medium hover:bg-secondary rounded-xl transition-colors border border-border"
        >
          Mes dépôts
        </button>
        <button
          onClick={() => navigate('/')}
          className="w-full py-3 text-muted-foreground font-medium hover:text-foreground transition-colors"
        >
          Retour au wallet
        </button>
      </div>
    </div>
  );

  const getStepTitle = () => {
    const titles: Record<Step, string> = {
      amount: 'Nouveau dépôt',
      family: 'Méthode de dépôt',
      submethod: 'Type d\'opération',
      bank: 'Choix de la banque',
      agency: 'Choix de l\'agence',
      'client-info': 'Vos informations',
      instructions: 'Bordereau',
      proof: 'Preuve de dépôt',
      success: 'Succès',
    };
    return titles[step];
  };

  const getProgressSteps = (): Step[] => {
    return ['amount', 'family', 'instructions', 'proof'];
  };

  const getCurrentProgressIndex = () => {
    const progressSteps = getProgressSteps();
    if (step === 'submethod' || step === 'bank' || step === 'agency' || step === 'client-info') {
      return 1; // Still in method selection phase
    }
    return progressSteps.indexOf(step);
  };

  return (
    <MobileLayout showNav={false}>
      <PageHeader 
        title={getStepTitle()} 
        showBack={step !== 'success'}
      />
      
      <div className="px-4 py-6">
        {/* Progress */}
        {step !== 'success' && (
          <div className="flex gap-1 mb-6">
            {getProgressSteps().map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors',
                  getCurrentProgressIndex() >= i
                    ? 'bg-primary'
                    : 'bg-muted'
                )}
              />
            ))}
          </div>
        )}
        
        {step === 'amount' && renderAmountInput()}
        {step === 'family' && renderFamilySelection()}
        {step === 'submethod' && renderSubMethodSelection()}
        {step === 'bank' && renderBankSelection()}
        {step === 'agency' && renderAgencySelection()}
        {step === 'client-info' && renderClientInfoForm()}
        {step === 'instructions' && renderInstructions()}
        {step === 'proof' && renderProofUpload()}
        {step === 'success' && renderSuccess()}
      </div>
    </MobileLayout>
  );
};

export default NewDepositPage;
