import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ProofUpload } from '@/components/deposit/ProofUpload';
import { 
  useDepositDetail, 
  useDepositProofs, 
  useDepositTimeline,
  useUploadProof,
  DEPOSIT_STATUS_LABELS, 
  DEPOSIT_METHOD_LABELS 
} from '@/hooks/useDeposits';
import { formatXAF } from '@/lib/formatters';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  Copy, 
  Check, 
  Clock, 
  ArrowLeft, 
  FileText, 
  Building2, 
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Image,
  Smartphone,
  Store,
  Waves
} from 'lucide-react';
import { toast } from 'sonner';

const DepositDetailPage = () => {
  const { depositId } = useParams<{ depositId: string }>();
  const navigate = useNavigate();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [uploadedProof, setUploadedProof] = useState<File | null>(null);
  
  const { data: deposit, isLoading: loadingDeposit } = useDepositDetail(depositId);
  const { data: proofs, isLoading: loadingProofs } = useDepositProofs(depositId);
  const { data: timeline, isLoading: loadingTimeline } = useDepositTimeline(depositId);
  const uploadProof = useUploadProof();

  const isLoading = loadingDeposit || loadingProofs || loadingTimeline;

  if (isLoading) {
    return (
      <MobileLayout showNav={false}>
        <PageHeader title="Détails du dépôt" showBack />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MobileLayout>
    );
  }

  if (!deposit) {
    return (
      <MobileLayout showNav={false}>
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

  const getMethodIcon = () => {
    switch (deposit.method) {
      case 'bank_transfer':
      case 'bank_cash':
        return Building2;
      case 'agency_cash':
        return Store;
      case 'wave':
        return Waves;
      default:
        return Smartphone;
    }
  };

  const mapStatusToType = (status: string): 'pending' | 'processing' | 'success' | 'error' | 'info' => {
    switch (status) {
      case 'validated': return 'success';
      case 'rejected': return 'error';
      case 'admin_review': return 'processing';
      case 'proof_submitted': return 'info';
      default: return 'pending';
    }
  };

  const getTimelineIcon = (eventType: string) => {
    switch (eventType) {
      case 'created': return <Clock className="w-4 h-4" />;
      case 'proof_submitted': return <FileText className="w-4 h-4" />;
      case 'admin_review': return <AlertCircle className="w-4 h-4" />;
      case 'validated': return <CheckCircle className="w-4 h-4" />;
      case 'wallet_credited': return <CheckCircle className="w-4 h-4" />;
      case 'rejected': return <XCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getTimelineColor = (eventType: string) => {
    switch (eventType) {
      case 'validated':
      case 'wallet_credited':
        return 'bg-emerald-100 text-emerald-600 border-emerald-300';
      case 'rejected':
        return 'bg-red-100 text-red-600 border-red-300';
      case 'admin_review':
        return 'bg-amber-100 text-amber-600 border-amber-300';
      case 'proof_submitted':
        return 'bg-blue-100 text-blue-600 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-300';
    }
  };

  const IconComponent = getMethodIcon();
  const canUploadProof = deposit.status === 'created' || deposit.status === 'awaiting_proof';

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

  const handleProofUpload = (file: File) => {
    setUploadedProof(file);
  };

  const handleConfirmProof = async () => {
    if (!uploadedProof || !depositId) return;
    
    await uploadProof.mutateAsync({
      depositId,
      file: uploadedProof,
    });
    
    setUploadedProof(null);
  };

  return (
    <MobileLayout showNav={false}>
      <PageHeader 
        title={`Dépôt #${deposit.reference.slice(-6)}`}
        showBack
        subtitle={format(new Date(deposit.created_at), 'dd MMM yyyy, HH:mm', { locale: fr })}
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
                {DEPOSIT_METHOD_LABELS[deposit.method] || deposit.method}
              </p>
              <StatusBadge 
                status={mapStatusToType(deposit.status)} 
                label={DEPOSIT_STATUS_LABELS[deposit.status] || deposit.status} 
              />
            </div>
          </div>
          
          <div className="text-center py-3 border-t border-border/50">
            <p className="text-2xl font-bold text-foreground">
              {formatXAF(deposit.amount_xaf)} <span className="text-lg font-normal text-muted-foreground">XAF</span>
            </p>
          </div>

          {/* Reference */}
          <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20 mt-3">
            <div>
              <p className="text-xs text-muted-foreground">Référence</p>
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
        </Card>

        {/* Rejection Reason */}
        {deposit.status === 'rejected' && deposit.rejection_reason && (
          <Card className="p-4 border-destructive/30 bg-destructive/5">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-destructive mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Dépôt rejeté</p>
                <p className="text-sm text-muted-foreground mt-1">{deposit.rejection_reason}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Proofs Section */}
        {proofs && proofs.length > 0 && (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-foreground">Preuves envoyées</h3>
            </div>
            <div className="space-y-2">
              {proofs.map((proof) => (
                <div key={proof.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Image className="w-5 h-5 text-blue-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{proof.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(proof.uploaded_at), 'dd MMM yyyy, HH:mm', { locale: fr })}
                    </p>
                  </div>
                </div>
              ))}
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
              isSubmitting={uploadProof.isPending}
            />
          </Card>
        )}

        {/* Timeline Section */}
        {timeline && timeline.length > 0 && (
          <Card className="p-4">
            <h3 className="font-semibold text-foreground mb-4">Suivi du dépôt</h3>
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
              <div className="space-y-4">
                {timeline.map((event) => (
                  <div key={event.id} className="relative flex gap-4 pl-2">
                    <div className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 ${getTimelineColor(event.event_type)}`}>
                      {getTimelineIcon(event.event_type)}
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="text-sm font-medium text-foreground">
                        {event.description}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(event.created_at), 'dd MMM yyyy, HH:mm', { locale: fr })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* Back button */}
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