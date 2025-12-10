import { useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { depositMethodsInfo, formatXAF } from '@/data/mockData';
import { DepositMethod } from '@/types';
import { Check, Upload, ArrowRight, Copy, Info } from 'lucide-react';
import * as Icons from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Step = 'method' | 'amount' | 'instructions' | 'proof' | 'success';

const NewDepositPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('method');
  const [selectedMethod, setSelectedMethod] = useState<DepositMethod | null>(null);
  const [amount, setAmount] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);

  const methodInfo = selectedMethod 
    ? depositMethodsInfo.find(m => m.method === selectedMethod) 
    : null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copié dans le presse-papier');
  };

  const handleSubmit = () => {
    // Mock submission
    toast.success('Dépôt soumis avec succès !');
    setStep('success');
  };

  const renderMethodSelection = () => (
    <div className="space-y-3 animate-fade-in">
      <p className="text-sm text-muted-foreground mb-4">
        Choisissez votre méthode de dépôt
      </p>
      {depositMethodsInfo.map((method) => {
        const IconComponent = (Icons as any)[method.icon] || Icons.Banknote;
        const isSelected = selectedMethod === method.method;
        
        return (
          <button
            key={method.method}
            onClick={() => setSelectedMethod(method.method)}
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
        onClick={() => selectedMethod && setStep('amount')}
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
        {[100000, 250000, 500000].map((preset) => (
          <button
            key={preset}
            onClick={() => setAmount(preset.toString())}
            className="py-3 rounded-xl bg-secondary text-foreground font-medium hover:bg-secondary/80 transition-colors"
          >
            {formatXAF(preset)}
          </button>
        ))}
      </div>
      
      <button
        onClick={() => amount && setStep('instructions')}
        disabled={!amount || parseInt(amount) < 1000}
        className={cn(
          'w-full py-4 rounded-xl font-semibold transition-all',
          amount && parseInt(amount) >= 1000
            ? 'btn-primary-gradient'
            : 'bg-muted text-muted-foreground cursor-not-allowed'
        )}
      >
        Voir les instructions
      </button>
    </div>
  );

  const renderInstructions = () => (
    <div className="animate-fade-in space-y-6">
      {methodInfo?.accountInfo && (
        <div className="card-elevated p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" />
            Informations de dépôt
          </p>
          
          {methodInfo.accountInfo.bankName && (
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Banque</span>
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{methodInfo.accountInfo.bankName}</span>
                <button onClick={() => handleCopy(methodInfo.accountInfo!.bankName!)}>
                  <Copy className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>
          )}
          
          {methodInfo.accountInfo.accountNumber && (
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">N° Compte</span>
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground font-mono text-sm">{methodInfo.accountInfo.accountNumber}</span>
                <button onClick={() => handleCopy(methodInfo.accountInfo!.accountNumber!)}>
                  <Copy className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>
          )}
          
          {methodInfo.accountInfo.accountName && (
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Titulaire</span>
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{methodInfo.accountInfo.accountName}</span>
                <button onClick={() => handleCopy(methodInfo.accountInfo!.accountName!)}>
                  <Copy className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>
          )}
          
          {methodInfo.accountInfo.phone && (
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Téléphone</span>
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{methodInfo.accountInfo.phone}</span>
                <button onClick={() => handleCopy(methodInfo.accountInfo!.phone!)}>
                  <Copy className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      
      <div className="card-elevated p-4">
        <p className="text-sm font-semibold text-foreground mb-4">Instructions</p>
        <ol className="space-y-3">
          {methodInfo?.instructions.map((instruction, index) => (
            <li key={index} className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center flex-shrink-0">
                {index + 1}
              </span>
              <span className="text-sm text-muted-foreground pt-0.5">{instruction}</span>
            </li>
          ))}
        </ol>
      </div>
      
      <div className="card-elevated p-4 bg-warning/5 border-warning/20">
        <p className="text-sm text-warning font-medium">
          Montant à déposer: {formatXAF(parseInt(amount))} XAF
        </p>
      </div>
      
      <button
        onClick={() => setStep('proof')}
        className="w-full btn-primary-gradient flex items-center justify-center gap-2"
      >
        J'ai effectué le dépôt
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );

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
        disabled={!proofFile}
        className={cn(
          'w-full py-4 rounded-xl font-semibold transition-all',
          proofFile
            ? 'btn-primary-gradient'
            : 'bg-muted text-muted-foreground cursor-not-allowed'
        )}
      >
        Soumettre le dépôt
      </button>
      
      <button
        onClick={handleSubmit}
        className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        Envoyer la preuve plus tard
      </button>
    </div>
  );

  const renderSuccess = () => (
    <div className="animate-scale-in text-center py-12">
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-success/10 flex items-center justify-center">
        <Check className="w-10 h-10 text-success" />
      </div>
      <h2 className="text-2xl font-bold text-foreground mb-2">Dépôt soumis !</h2>
      <p className="text-muted-foreground mb-8">
        Votre dépôt de {formatXAF(parseInt(amount))} XAF est en cours de vérification
      </p>
      
      <div className="space-y-3">
        <button
          onClick={() => navigate('/deposits')}
          className="w-full btn-primary-gradient"
        >
          Voir mes dépôts
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
      method: 'Nouveau dépôt',
      amount: 'Montant',
      instructions: 'Instructions',
      proof: 'Preuve de dépôt',
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
        {/* Progress */}
        {step !== 'success' && (
          <div className="flex gap-1 mb-6">
            {['method', 'amount', 'instructions', 'proof'].map((s, i) => (
              <div
                key={s}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors',
                  ['method', 'amount', 'instructions', 'proof'].indexOf(step) >= i
                    ? 'bg-primary'
                    : 'bg-muted'
                )}
              />
            ))}
          </div>
        )}
        
        {step === 'method' && renderMethodSelection()}
        {step === 'amount' && renderAmountInput()}
        {step === 'instructions' && renderInstructions()}
        {step === 'proof' && renderProofUpload()}
        {step === 'success' && renderSuccess()}
      </div>
    </MobileLayout>
  );
};

export default NewDepositPage;
