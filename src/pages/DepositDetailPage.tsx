import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ProofUpload } from '@/components/deposit/ProofUpload';
import { DepositTimelineDisplay } from '@/components/deposit/DepositTimelineDisplay';
import { CountdownTimer } from '@/components/deposit/CountdownTimer';
import { DepositInstructions } from '@/components/deposit/DepositInstructions';
import { SkeletonDetail } from '@/mobile/components/ui/SkeletonCard';
import {
  useDepositDetail,
  useDepositProofs,
  useDepositTimeline,
  useResubmitDeposit,
  useUploadMultipleProofs,
  useDeleteDepositProof,
} from '@/hooks/useDeposits';
import { DEPOSIT_STATUS_LABELS, DEPOSIT_METHOD_LABELS, PROOF_DELETE_REASONS } from '@/types/deposit';
import { formatXAF } from '@/lib/formatters';
import { buildDepositTimelineSteps, safeFormatDate } from '@/lib/depositTimeline';
import {
  Copy,
  Check,
  ArrowLeft,
  Building2,
  XCircle,
  AlertCircle,
  Smartphone,
  Store,
  Waves,
  FileText,
  Eye,
  Download,
  RefreshCw,
  Loader2,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

// ── ProofImage: fallback when signed URL fails ──
function ProofImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className={cn('flex flex-col items-center justify-center bg-muted/50', className)}>
        <FileText className="w-8 h-8 text-muted-foreground mb-1" />
        <p className="text-[10px] text-muted-foreground text-center">Image indisponible</p>
      </div>
    );
  }
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />;
}

const DepositDetailPage = () => {
  const { depositId } = useParams<{ depositId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [uploadedProofs, setUploadedProofs] = useState<File[]>([]);
  const [viewingProof, setViewingProof] = useState<{ url: string; name: string } | null>(null);
  const [uploadKey, setUploadKey] = useState(0);
  const [deletingProofId, setDeletingProofId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [customDeleteReason, setCustomDeleteReason] = useState('');

  const { data: deposit, isLoading: loadingDeposit } = useDepositDetail(depositId);
  const { data: proofs, isLoading: loadingProofs } = useDepositProofs(depositId);
  const { data: timelineEvents, isLoading: loadingTimeline } = useDepositTimeline(depositId);
  const uploadProofs = useUploadMultipleProofs();
  const resubmitDeposit = useResubmitDeposit();
  const deleteProof = useDeleteDepositProof();

  // Show success toast when arriving from proof upload
  useEffect(() => {
    const state = location.state as { fromProofUpload?: boolean } | null;
    if (state?.fromProofUpload) {
      toast.success('Preuve envoyée avec succès !');
      // Clear the state so it doesn't re-trigger on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

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
        <SkeletonDetail />
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
  const canDeleteProofs = !['validated', 'rejected'].includes(deposit.status);

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
    setUploadKey(k => k + 1);
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
    setUploadKey(k => k + 1);
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
        <Card className="p-4 border-primary/20 bg-primary/5 animate-scale-in">
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
            <p className="text-2xl font-bold text-foreground tabular-nums">
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
          <div className="animate-slide-up" style={{ animationDelay: '80ms', animationFillMode: 'both' }}>
            <CountdownTimer createdAt={deposit.created_at} />
          </div>
        )}

        {/* Deposit Instructions - Show for deposits awaiting proof */}
        {canUploadProof && (
          <Card className="p-4 animate-slide-up" style={{ animationDelay: '120ms', animationFillMode: 'both' }}>
            <DepositInstructions deposit={deposit} />
          </Card>
        )}

        {/* Rejection Reason */}
        {deposit.status === 'rejected' && deposit.rejection_reason && (
          <Card className="p-4 border-destructive/30 bg-destructive/5 animate-slide-up" style={{ animationDelay: '80ms', animationFillMode: 'both' }}>
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
          <Card className="p-4 border-amber-500/30 bg-amber-500/5 animate-slide-up" style={{ animationDelay: '80ms', animationFillMode: 'both' }}>
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
          <Card className="p-4 animate-slide-up" style={{ animationDelay: '160ms', animationFillMode: 'both' }}>
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-foreground">
                Preuves envoyées ({proofs.length})
              </h3>
            </div>
            
            {/* Proof list — mobile-friendly (no hover needed) */}
            <div className="space-y-3">
              {proofs.map((proof) => (
                <div
                  key={proof.id}
                  className="flex items-center gap-3 p-2 rounded-lg border border-border bg-muted/20"
                >
                  {/* Thumbnail — tap to view */}
                  <div
                    className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden border border-border bg-muted/30 cursor-pointer active:scale-95 transition-transform"
                    onClick={() => {
                      if (isImageFile(proof.file_type) && proof.signedUrl) {
                        setViewingProof({ url: proof.signedUrl, name: proof.file_name });
                      } else if (proof.signedUrl) {
                        handleDownloadProof(proof.signedUrl, proof.file_name);
                      }
                    }}
                  >
                    {isImageFile(proof.file_type) && proof.signedUrl ? (
                      <ProofImage
                        src={proof.signedUrl}
                        alt={proof.file_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FileText className="w-6 h-6 text-primary" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {proof.file_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {safeFormatDate(proof.uploaded_at)}
                    </p>
                  </div>

                  {/* Action buttons — always visible */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8"
                      onClick={() => {
                        if (isImageFile(proof.file_type) && proof.signedUrl) {
                          setViewingProof({ url: proof.signedUrl, name: proof.file_name });
                        } else if (proof.signedUrl) {
                          handleDownloadProof(proof.signedUrl, proof.file_name);
                        }
                      }}
                    >
                      {isImageFile(proof.file_type) ? (
                        <Eye className="w-4 h-4" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                    </Button>
                    {proof.signedUrl && isImageFile(proof.file_type) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8"
                        onClick={() => handleDownloadProof(proof.signedUrl!, proof.file_name)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    )}
                    {canDeleteProofs && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          setDeletingProofId(proof.id);
                          setDeleteReason('');
                          setCustomDeleteReason('');
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Proof Upload Section */}
        {canUploadProof && (
          <Card className="p-4 animate-slide-up" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
            <ProofUpload
              key={uploadKey}
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
        <Card className="p-4 animate-slide-up" style={{ animationDelay: '240ms', animationFillMode: 'both' }}>
          <h3 className="font-semibold text-foreground mb-4">Suivi du dépôt</h3>
          <DepositTimelineDisplay steps={timelineSteps} />
        </Card>

        {/* Back button */}
        <Button
          variant="outline"
          className="w-full animate-slide-up"
          style={{ animationDelay: '280ms', animationFillMode: 'both' }}
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
                <ProofImage
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

      {/* Delete Proof Confirmation Dialog */}
      <AlertDialog open={!!deletingProofId} onOpenChange={(open) => { if (!open) setDeletingProofId(null); }}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              Supprimer cette preuve ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Veuillez indiquer le motif de suppression. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2 py-2">
            {PROOF_DELETE_REASONS.map((reason) => (
              <button
                key={reason}
                type="button"
                className={cn(
                  'w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors',
                  deleteReason === reason
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border hover:bg-muted/50 text-foreground',
                )}
                onClick={() => setDeleteReason(reason)}
              >
                {reason}
              </button>
            ))}
            {deleteReason === 'Autre' && (
              <textarea
                className="w-full mt-2 p-2 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                rows={2}
                placeholder="Précisez le motif..."
                value={customDeleteReason}
                onChange={(e) => setCustomDeleteReason(e.target.value)}
              />
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={!deleteReason || (deleteReason === 'Autre' && !customDeleteReason.trim()) || deleteProof.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deletingProofId || !depositId) return;
                const reason = deleteReason === 'Autre' ? customDeleteReason.trim() : deleteReason;
                deleteProof.mutate(
                  { proofId: deletingProofId, depositId, reason },
                  { onSettled: () => setDeletingProofId(null) },
                );
              }}
            >
              {deleteProof.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MobileLayout>
  );
};

export default DepositDetailPage;