import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatusBadge, getStatusType } from '@/components/common/StatusBadge';
import { DepositTimeline } from '@/components/deposit/DepositTimeline';
import { ProofUpload } from '@/components/deposit/ProofUpload';
import { mockDeposits, formatXAF, getDepositStatusLabel, depositMethodsInfo } from '@/data/mockData';
import { format, addHours, differenceInHours } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Copy, Check, Clock, ArrowLeft, FileText, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import * as Icons from 'lucide-react';

// Simulated deposit data with more details
const getDepositDetails = (depositId: string) => {
  const deposit = mockDeposits.find(d => d.id === depositId);
  if (!deposit) return null;

  const methodInfo = depositMethodsInfo.find(m => m.method === deposit.method);
  
  return {
    ...deposit,
    methodInfo,
    bonziniInfo: methodInfo?.accountInfo || {},
    instructions: methodInfo?.instructions || [],
    expiresAt: addHours(deposit.createdAt, 48),
    timeline: [
      {
        id: '1',
        status: 'SUBMITTED',
        description: 'Demande créée',
        createdAt: deposit.createdAt,
        isCompleted: true,
        isCurrent: deposit.status === 'SUBMITTED',
      },
      {
        id: '2',
        status: 'AWAITING_DEPOSIT',
        description: 'En attente de votre dépôt',
        createdAt: deposit.status !== 'SUBMITTED' ? new Date(deposit.createdAt.getTime() + 5 * 60000) : new Date(),
        isCompleted: ['PROOF_UPLOADED', 'UNDER_VERIFICATION', 'VALIDATED', 'REJECTED'].includes(deposit.status),
        isCurrent: deposit.status === 'SUBMITTED',
      },
      {
        id: '3',
        status: 'PROOF_UPLOADED',
        description: 'Preuve envoyée',
        createdAt: ['PROOF_UPLOADED', 'UNDER_VERIFICATION', 'VALIDATED'].includes(deposit.status) 
          ? new Date(deposit.createdAt.getTime() + 30 * 60000) 
          : new Date(),
        isCompleted: ['UNDER_VERIFICATION', 'VALIDATED'].includes(deposit.status),
        isCurrent: deposit.status === 'PROOF_UPLOADED',
      },
      {
        id: '4',
        status: 'UNDER_VERIFICATION',
        description: 'Vérification en cours',
        createdAt: deposit.status === 'UNDER_VERIFICATION' || deposit.status === 'VALIDATED'
          ? new Date(deposit.createdAt.getTime() + 60 * 60000)
          : new Date(),
        isCompleted: deposit.status === 'VALIDATED',
        isCurrent: deposit.status === 'UNDER_VERIFICATION',
      },
      {
        id: '5',
        status: 'VALIDATED',
        description: 'Dépôt validé – Solde crédité',
        createdAt: deposit.status === 'VALIDATED' 
          ? deposit.updatedAt 
          : new Date(),
        isCompleted: deposit.status === 'VALIDATED',
        isCurrent: false,
      },
    ],
  };
};

const DepositDetailPage = () => {
  const { depositId } = useParams<{ depositId: string }>();
  const navigate = useNavigate();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [uploadedProof, setUploadedProof] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const deposit = getDepositDetails(depositId || '');

  if (!deposit) {
    return (
      <MobileLayout>
        <PageHeader title="Dépôt introuvable" showBack />
        <div className="p-4 text-center">
          <p className="text-muted-foreground">Ce dépôt n'existe pas.</p>
          <Button onClick={() => navigate('/deposits')} className="mt-4">
            Retour aux dépôts
          </Button>
        </div>
      </MobileLayout>
    );
  }

  const IconComponent = deposit.methodInfo ? (Icons as any)[deposit.methodInfo.icon] : Building2;
  const hoursRemaining = differenceInHours(deposit.expiresAt, new Date());
  const canUploadProof = deposit.status === 'SUBMITTED' || deposit.status === 'PROOF_UPLOADED';

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success('Copié !');
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error('Erreur lors de la copie');
    }
  };

  const copyAllInfo = () => {
    const info = [
      deposit.bonziniInfo.accountName && `Nom: ${deposit.bonziniInfo.accountName}`,
      deposit.bonziniInfo.bankName && `Banque: ${deposit.bonziniInfo.bankName}`,
      deposit.bonziniInfo.accountNumber && `Compte: ${deposit.bonziniInfo.accountNumber}`,
      deposit.bonziniInfo.phone && `Téléphone: ${deposit.bonziniInfo.phone}`,
      `Référence: ${deposit.reference}`,
      `Montant: ${formatXAF(deposit.amountXAF)} XAF`,
    ].filter(Boolean).join('\n');
    
    copyToClipboard(info, 'all');
  };

  const handleProofUpload = (file: File) => {
    setUploadedProof(file);
  };

  const handleConfirmProof = async () => {
    if (!uploadedProof) return;
    
    setIsSubmitting(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    toast.success('Preuve envoyée avec succès !', {
      description: 'Votre dépôt est maintenant en cours de vérification.',
    });
    setIsSubmitting(false);
    // In real app, would refresh deposit data
  };

  return (
    <MobileLayout showNav={false}>
      <PageHeader 
        title={`Dépôt #${deposit.reference.slice(-6)}`}
        showBack
        subtitle={format(deposit.createdAt, 'dd MMM yyyy, HH:mm', { locale: fr })}
      />

      <div className="px-4 py-4 space-y-4 pb-8">
        {/* Status Header */}
        <Card className="p-4 border-primary/20 bg-primary/5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <IconComponent className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">
                {deposit.methodInfo?.label || deposit.method}
              </p>
              <StatusBadge 
                status={getStatusType(deposit.status)} 
                label={getDepositStatusLabel(deposit.status)} 
              />
            </div>
          </div>
          
          <div className="text-center py-3 border-t border-border/50">
            <p className="text-2xl font-bold text-foreground">
              {formatXAF(deposit.amountXAF)} <span className="text-lg font-normal text-muted-foreground">XAF</span>
            </p>
          </div>

          {canUploadProof && hoursRemaining > 0 && (
            <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg mt-3">
              <Clock className="w-4 h-4" />
              <span>Ce dépôt doit être effectué dans les {hoursRemaining}h</span>
            </div>
          )}
        </Card>

        {/* Instructions Section */}
        {canUploadProof && (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-foreground">Instructions de dépôt</h3>
            </div>

            {/* Bonzini Account Info */}
            <div className="space-y-3 mb-4">
              {deposit.bonziniInfo.accountName && (
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground">Nom du compte</p>
                    <p className="font-medium text-foreground">{deposit.bonziniInfo.accountName}</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => copyToClipboard(deposit.bonziniInfo.accountName!, 'name')}
                  >
                    {copiedField === 'name' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              )}

              {deposit.bonziniInfo.bankName && (
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground">Banque</p>
                    <p className="font-medium text-foreground">{deposit.bonziniInfo.bankName}</p>
                  </div>
                </div>
              )}

              {deposit.bonziniInfo.accountNumber && (
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground">Numéro de compte</p>
                    <p className="font-medium text-foreground font-mono">{deposit.bonziniInfo.accountNumber}</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => copyToClipboard(deposit.bonziniInfo.accountNumber!, 'account')}
                  >
                    {copiedField === 'account' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              )}

              {deposit.bonziniInfo.phone && (
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground">Numéro de téléphone</p>
                    <p className="font-medium text-foreground font-mono">{deposit.bonziniInfo.phone}</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => copyToClipboard(deposit.bonziniInfo.phone!, 'phone')}
                  >
                    {copiedField === 'phone' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              )}

              <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20">
                <div>
                  <p className="text-xs text-muted-foreground">Référence obligatoire</p>
                  <p className="font-bold text-primary font-mono">{deposit.reference}</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => copyToClipboard(deposit.reference, 'reference')}
                >
                  {copiedField === 'reference' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <Button 
              variant="outline" 
              className="w-full mb-4"
              onClick={copyAllInfo}
            >
              {copiedField === 'all' ? (
                <>
                  <Check className="w-4 h-4 mr-2 text-green-500" />
                  Informations copiées
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copier toutes les informations
                </>
              )}
            </Button>

            {/* Step by step instructions */}
            <div className="border-t border-border pt-4">
              <p className="text-sm font-medium text-foreground mb-3">Étapes à suivre :</p>
              <ol className="space-y-2">
                {deposit.instructions.map((instruction, index) => (
                  <li key={index} className="flex gap-3 text-sm">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {index + 1}
                    </span>
                    <span className="text-muted-foreground">{instruction}</span>
                  </li>
                ))}
              </ol>
            </div>
          </Card>
        )}

        {/* Proof Upload Section */}
        {canUploadProof && (
          <Card className="p-4">
            <ProofUpload 
              onFileSelect={handleProofUpload}
              selectedFile={uploadedProof}
              onConfirm={handleConfirmProof}
              isSubmitting={isSubmitting}
            />
          </Card>
        )}

        {/* Timeline Section */}
        <Card className="p-4">
          <h3 className="font-semibold text-foreground mb-4">Suivi du dépôt</h3>
          <DepositTimeline steps={deposit.timeline} />
        </Card>

        {/* Back to deposits button */}
        <Button 
          variant="outline" 
          className="w-full"
          onClick={() => navigate('/deposits')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour à mes dépôts
        </Button>
      </div>
    </MobileLayout>
  );
};

export default DepositDetailPage;
