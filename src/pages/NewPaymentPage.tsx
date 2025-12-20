import { useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { paymentMethodsInfo } from '@/data/staticData';
import { formatXAF, formatRMB, convertXAFtoRMB } from '@/lib/formatters';
import { useMyWallet, useExchangeRate } from '@/hooks/useWallet';
import { PaymentMethod, Beneficiary } from '@/types';
import { Check, Plus, User, ArrowRightLeft, AlertCircle } from 'lucide-react';
import * as Icons from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

type Step = 'method' | 'beneficiary' | 'amount' | 'confirm' | 'success';

const NewPaymentPage = () => {
  const navigate = useNavigate();
  const { data: wallet, isLoading: walletLoading } = useMyWallet();
  const { data: exchangeRate } = useExchangeRate();
  
  const [step, setStep] = useState<Step>('method');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<Beneficiary | null>(null);
  const [amountXAF, setAmountXAF] = useState('');

  const rate = exchangeRate || 0.01167;
  const amountRMB = amountXAF ? convertXAFtoRMB(parseInt(amountXAF), rate) : 0;
  const fees = amountXAF ? Math.round(parseInt(amountXAF) * 0.01) : 0;
  const totalXAF = amountXAF ? parseInt(amountXAF) + fees : 0;
  const hasEnoughBalance = totalXAF <= (wallet?.balance_xaf || 0);

  // TODO: Fetch beneficiaries from database when ready
  const filteredBeneficiaries: Beneficiary[] = [];

  const handleSubmit = () => {
    if (!hasEnoughBalance) {
      toast.error('Solde insuffisant');
      return;
    }
    toast.success('Paiement initié avec succès !');
    setStep('success');
  };

  const renderMethodSelection = () => (
    <div className="space-y-3 animate-fade-in">
      <p className="text-sm text-muted-foreground mb-4">
        Comment votre bénéficiaire souhaite recevoir ?
      </p>
      {paymentMethodsInfo.map((method) => {
        const IconComponent = (Icons as any)[method.icon] || Icons.Send;
        const isSelected = selectedMethod === method.method;
        
        return (
          <button
            key={method.method}
            onClick={() => setSelectedMethod(method.method as PaymentMethod)}
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

  const renderBeneficiarySelection = () => (
    <div className="animate-fade-in">
      <p className="text-sm text-muted-foreground mb-4">
        Sélectionnez ou ajoutez un bénéficiaire
      </p>
      
      <div className="space-y-3 mb-6">
        {filteredBeneficiaries.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>Aucun bénéficiaire pour cette méthode</p>
          </div>
        )}
        
        <button
          onClick={() => navigate('/beneficiaries/new')}
          className="method-card w-full text-left border-dashed"
        >
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Plus className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-primary">Nouveau bénéficiaire</p>
            <p className="text-xs text-muted-foreground">Ajouter un nouveau destinataire</p>
          </div>
        </button>
      </div>
      
      <button
        onClick={() => selectedBeneficiary && setStep('amount')}
        disabled={!selectedBeneficiary}
        className={cn(
          'w-full py-4 rounded-xl font-semibold transition-all',
          selectedBeneficiary
            ? 'btn-primary-gradient'
            : 'bg-muted text-muted-foreground cursor-not-allowed'
        )}
      >
        Continuer
      </button>
    </div>
  );

  const renderAmountInput = () => (
    <div className="animate-fade-in">
      {/* Conversion Display */}
      <div className="card-primary p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-primary-foreground/70 text-sm">Vous envoyez</span>
          <span className="text-primary-foreground/70 text-sm">
            {walletLoading ? (
              <Skeleton className="h-4 w-24 bg-primary-foreground/20" />
            ) : (
              `Solde: ${formatXAF(wallet?.balance_xaf || 0)} XAF`
            )}
          </span>
        </div>
        
        <div className="flex items-center justify-center gap-2 mb-4">
          <input
            type="text"
            inputMode="numeric"
            value={amountXAF}
            onChange={(e) => setAmountXAF(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="0"
            className="amount-input text-primary-foreground placeholder:text-primary-foreground/30"
          />
          <span className="text-xl font-medium text-primary-foreground/70">XAF</span>
        </div>
        
        <div className="flex items-center justify-center gap-3 py-3 border-t border-primary-foreground/10">
          <ArrowRightLeft className="w-5 h-5 text-primary-foreground/50" />
        </div>
        
        <div className="text-center">
          <span className="text-primary-foreground/70 text-sm">Bénéficiaire reçoit</span>
          <p className="text-3xl font-bold text-primary-foreground mt-1">
            ¥ {formatRMB(amountRMB)}
            <span className="text-lg font-medium text-primary-foreground/70 ml-2">RMB</span>
          </p>
        </div>
      </div>
      
      {/* Quick amounts */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        {[100000, 250000, 500000].map((preset) => (
          <button
            key={preset}
            onClick={() => setAmountXAF(preset.toString())}
            className="py-3 rounded-xl bg-secondary text-foreground font-medium hover:bg-secondary/80 transition-colors"
          >
            {formatXAF(preset)}
          </button>
        ))}
      </div>
      
      {/* Rate info */}
      <div className="card-glass p-4 mb-6">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Taux de change</span>
          <span className="font-medium text-foreground">1 XAF = {rate.toFixed(5)} RMB</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-2">
          <span className="text-muted-foreground">Frais (1%)</span>
          <span className="font-medium text-foreground">{formatXAF(fees)} XAF</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-2 pt-2 border-t border-border">
          <span className="text-foreground font-semibold">Total à débiter</span>
          <span className="font-bold text-foreground">{formatXAF(totalXAF)} XAF</span>
        </div>
      </div>
      
      {!hasEnoughBalance && amountXAF && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-sm mb-4">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>Solde insuffisant. Veuillez réduire le montant ou effectuer un dépôt.</span>
        </div>
      )}
      
      <button
        onClick={() => amountXAF && hasEnoughBalance && setStep('confirm')}
        disabled={!amountXAF || !hasEnoughBalance}
        className={cn(
          'w-full py-4 rounded-xl font-semibold transition-all',
          amountXAF && hasEnoughBalance
            ? 'btn-primary-gradient'
            : 'bg-muted text-muted-foreground cursor-not-allowed'
        )}
      >
        Vérifier et confirmer
      </button>
    </div>
  );

  const renderConfirmation = () => {
    const methodInfo = paymentMethodsInfo.find(m => m.method === selectedMethod);
    const IconComponent = methodInfo ? (Icons as any)[methodInfo.icon] : Icons.Send;
    
    return (
      <div className="animate-fade-in space-y-6">
        <div className="card-elevated p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <IconComponent className="w-8 h-8 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">Vous envoyez</p>
          <p className="text-3xl font-bold text-foreground mb-1">
            ¥ {formatRMB(amountRMB)} RMB
          </p>
          <p className="text-sm text-muted-foreground">
            ({formatXAF(parseInt(amountXAF))} XAF)
          </p>
        </div>
        
        <div className="card-elevated p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Bénéficiaire</span>
            <div className="text-right">
              <p className="font-semibold text-foreground">{selectedBeneficiary?.name}</p>
              {selectedBeneficiary?.chineseName && (
                <p className="text-sm text-muted-foreground">{selectedBeneficiary.chineseName}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Méthode</span>
            <span className="font-medium text-foreground">{methodInfo?.label}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Frais</span>
            <span className="font-medium text-foreground">{formatXAF(fees)} XAF</span>
          </div>
          
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <span className="font-semibold text-foreground">Total débité</span>
            <span className="font-bold text-foreground">{formatXAF(totalXAF)} XAF</span>
          </div>
        </div>
        
        <button
          onClick={handleSubmit}
          className="w-full btn-primary-gradient"
        >
          Confirmer le paiement
        </button>
      </div>
    );
  };

  const renderSuccess = () => (
    <div className="animate-scale-in text-center py-12">
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-success/10 flex items-center justify-center">
        <Check className="w-10 h-10 text-success" />
      </div>
      <h2 className="text-2xl font-bold text-foreground mb-2">Paiement initié !</h2>
      <p className="text-muted-foreground mb-2">
        {selectedBeneficiary?.name} recevra
      </p>
      <p className="text-2xl font-bold text-primary mb-8">
        ¥ {formatRMB(amountRMB)} RMB
      </p>
      
      <div className="space-y-3">
        <button
          onClick={() => navigate('/payments')}
          className="w-full btn-primary-gradient"
        >
          Voir mes paiements
        </button>
        <button
          onClick={() => navigate('/')}
          className="w-full py-3 text-foreground font-medium hover:bg-secondary rounded-xl transition-colors"
        >
          Retour au wallet
        </button>
      </div>
    </div>
  );

  const getStepTitle = () => {
    const titles: Record<Step, string> = {
      method: 'Nouveau paiement',
      beneficiary: 'Bénéficiaire',
      amount: 'Montant',
      confirm: 'Confirmation',
      success: 'Succès',
    };
    return titles[step];
  };

  return (
    <MobileLayout showNav={false}>
      <PageHeader 
        title={getStepTitle()} 
        showBack={step !== 'success'}
      />
      
      <div className="px-4 py-6">
        {step !== 'success' && (
          <div className="flex gap-1 mb-6">
            {['method', 'beneficiary', 'amount', 'confirm'].map((s, i) => (
              <div
                key={s}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors',
                  ['method', 'beneficiary', 'amount', 'confirm'].indexOf(step) >= i
                    ? 'bg-primary'
                    : 'bg-muted'
                )}
              />
            ))}
          </div>
        )}
        
        {step === 'method' && renderMethodSelection()}
        {step === 'beneficiary' && renderBeneficiarySelection()}
        {step === 'amount' && renderAmountInput()}
        {step === 'confirm' && renderConfirmation()}
        {step === 'success' && renderSuccess()}
      </div>
    </MobileLayout>
  );
};

export default NewPaymentPage;