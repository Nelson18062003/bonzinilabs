import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ProofUpload } from '@/components/deposit/ProofUpload';
import { DepositTimelineDisplay } from '@/components/deposit/DepositTimelineDisplay';
import { CountdownTimer } from '@/components/deposit/CountdownTimer';
import { DepositInstructions } from '@/components/deposit/DepositInstructions';
import {
  useDepositDetail,
  useDepositProofs,
  useDepositTimeline,
  useResubmitDeposit,
  DEPOSIT_STATUS_LABELS,
  DEPOSIT_METHOD_LABELS
} from '@/hooks/useDeposits';
import { useUploadMultipleProofs } from '@/hooks/useDepositProofMultiUpload';
import { formatXAF } from '@/lib/formatters';
import { buildDepositTimelineSteps, safeFormatDate } from '@/lib/depositTimeline';
import {
  Copy,
  Check,
  ArrowLeft,
  Building2,
  Loader2,
  XCircle,
  AlertCircle,
  Smartphone,
  Store,
  Waves,
  FileText,
  Eye,
  Download,
  X,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DepositDetailPage = () => {
  const { depositId } = useParams<{ depositId: string }>();
  const navigate = useNavigate();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [uploadedProofs, setUploadedProofs] = useState<File[]>([]);
  const [viewingProof, setViewingProof] = useState<{ url: string; name: string } | null>(null);
  
  const { data: deposit, isLoading: loadingDeposit } = useDepositDetail(depositId);
  const { data: proofs, isLoading: loadingProofs } = useDepositProofs(depositId);
  const { data: timelineEvents, isLoading: loadingTimeline } = useDepositTimeline(depositId);
  const uploadProofs = useUploadMultipleProofs();
  const resubmitDeposit = useResubmitDeposit();

  // Build timeline steps from deposit status and events
  const timelineSteps = useMemo(() => {
    if (!deposit) return [];
    return buildDepositTimelineSteps(deposit.status, timelineEvents || []);
  }, [deposit, timelineEvents]);

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
      case 'pending_correction': return 'error';
      case 'admin_review': return 'processing';
      case 'proof_submitted': return 'info';
      default: return 'pending';
    }
  };

  const IconComponent = getMethodIcon();
  const canUploadProof = deposit.status === 'created' || deposit.status === 'awaiting_proof' || deposit.status === 'pending_correction';
  const isPendingCorrection = deposit.status === 'pending_correction';

  const handleResubmit = async () => {
    if (!depositId || !uploadedProofs.length) return;

    // First upload the new proofs
    await uploadProofs.mutateAsync({
      depositId,
      files: uploadedProofs,
    });

    // Then resubmit the deposit
    await resubmitDeposit.mutateAsync({ depositId });
    setUploadedProofs([]);
  };

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

  const handleProofsUpload = (files: File[]) => {
    setUploadedProofs(files);
  };

  const handleConfirmProofs = async () => {
    if (!uploadedProofs.length || !depositId) return;
    
    await uploadProofs.mutateAsync({
      depositId,
      files: uploadedProofs,
    });
    
    setUploadedProofs([]);
  };

  const isImageFile = (fileType: string | null) => {
    return fileType?.startsWith('image/');
  };

  const handleDownloadProof = (url: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <MobileLayout showNav={false}>
      <PageHeader 
        title={`Dépôt #${deposit.reference.slice(-6)}`}
        showBack
        subtitle={safeFormatDate(deposit.created_at) || ''}
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

        {/* Countdown Timer - Show for deposits awaiting action */}
        {canUploadProof && (
          <CountdownTimer createdAt={deposit.created_at} />
        )}

        {/* Deposit Instructions - Show for deposits awaiting proof */}
        {canUploadProof && (
          <Card className="p-4">
            <DepositInstructions deposit={deposit} />
          </Card>
        )}

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

        {/* Pending Correction Notice */}
        {isPendingCorrection && deposit.rejection_reason && (
          <Card className="p-4 border-amber-500/30 bg-amber-500/5">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-amber-600">Correction demandée</p>
                <p className="text-sm text-muted-foreground mt-1">{deposit.rejection_reason}</p>
                <p className="text-sm text-amber-600 mt-2">
                  Veuillez uploader une nouvelle preuve corrigée ci-dessous.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Proofs Section with Previews */}
        {proofs && proofs.length > 0 && (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-foreground">
                Preuves envoyées ({proofs.length})
              </h3>
            </div>
            
            {/* Grid of proof thumbnails */}
            <div className="grid grid-cols-3 gap-2">
              {proofs.map((proof) => (
                <div 
                  key={proof.id} 
                  className="relative group aspect-square rounded-lg overflow-hidden border border-border bg-muted/30"
                >
                  {isImageFile(proof.file_type) ? (
                    <>
                      <img 
                        src={proof.file_url} 
                        alt={proof.file_name}
                        className="w-full h-full object-cover"
                      />
                      {/* Overlay on hover */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button
                          variant="secondary"
                          size="icon"
                          className="w-8 h-8"
                          onClick={() => setViewingProof({ url: proof.file_url, name: proof.file_name })}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="w-8 h-8"
                          onClick={() => handleDownloadProof(proof.file_url, proof.file_name)}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div 
                      className="w-full h-full flex flex-col items-center justify-center p-2 cursor-pointer hover:bg-muted/50"
                      onClick={() => handleDownloadProof(proof.file_url, proof.file_name)}
                    >
                      <FileText className="w-8 h-8 text-primary mb-1" />
                      <p className="text-[10px] text-muted-foreground text-center truncate w-full">
                        {proof.file_name}
                      </p>
                    </div>
                  )}

                  {/* Date badge */}
                  <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                    {safeFormatDate(proof.uploaded_at)}
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
              onFilesSelect={handleProofsUpload}
              selectedFiles={uploadedProofs}
              onConfirm={isPendingCorrection ? handleResubmit : handleConfirmProofs}
              isSubmitting={uploadProofs.isPending || resubmitDeposit.isPending}
            />
            {isPendingCorrection && uploadedProofs.length > 0 && (
              <Button
                className="w-full mt-4"
                onClick={handleResubmit}
                disabled={uploadProofs.isPending || resubmitDeposit.isPending}
              >
                {(uploadProofs.isPending || resubmitDeposit.isPending) ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Renvoyer la preuve corrigée
              </Button>
            )}
          </Card>
        )}

        {/* Timeline Section - Now shows all steps */}
        <Card className="p-4">
          <h3 className="font-semibold text-foreground mb-4">Suivi du dépôt</h3>
          <DepositTimelineDisplay steps={timelineSteps} />
        </Card>

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

      {/* Proof Viewer Dialog */}
      <Dialog open={!!viewingProof} onOpenChange={() => setViewingProof(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center justify-between">
              <span className="truncate">{viewingProof?.name}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 pt-2">
            {viewingProof && (
              <>
                <img 
                  src={viewingProof.url} 
                  alt={viewingProof.name} 
                  className="w-full max-h-[70vh] object-contain rounded-lg"
                />
                <Button
                  className="w-full mt-4"
                  variant="outline"
                  onClick={() => handleDownloadProof(viewingProof.url, viewingProof.name)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Télécharger
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </MobileLayout>
  );
};

export default DepositDetailPage;