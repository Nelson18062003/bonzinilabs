// ============================================================
// MODULE DEPOTS — DepositDetailPage (Revolut-inspired redesign)
// Premium fintech UI with hero zone, animated amount, structured details
// ============================================================
import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Button } from '@/components/ui/button';
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
  useCancelDeposit,
} from '@/hooks/useDeposits';
import { DEPOSIT_STATUS_LABELS, DEPOSIT_METHOD_LABELS } from '@/types/deposit';
import { formatXAF } from '@/lib/formatters';
import { buildDepositTimelineSteps, safeFormatDate } from '@/lib/depositTimeline';
import { useCountUp } from '@/hooks/useCountUp';
import {
  Copy,
  Check,
  ArrowLeft,
  Building2,
  XCircle,
  AlertCircle,
  Ban,
  Smartphone,
  Store,
  Waves,
  FileText,
  Eye,
  Download,
  FileDown,
  Loader2,
  Trash2,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { downloadPDF } from '@/lib/pdf/downloadPDF';
import { DepositReceiptPDF } from '@/lib/pdf/templates/DepositReceiptPDF';
import type { DepositReceiptData } from '@/lib/pdf/templates/DepositReceiptPDF';
import { useMyProfile } from '@/hooks/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { PROOF_DELETE_REASONS } from '@/types/deposit';
import { cn } from '@/lib/utils';

// ── Helpers ──────────────────────────────────────────────────

function ProofImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className={cn('flex flex-col items-center justify-center bg-muted/50', className)}>
        <FileText className="w-6 h-6 text-muted-foreground" />
      </div>
    );
  }
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />;
}

function DetailRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="revolut-detail-row">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn('text-sm font-medium text-foreground text-right', valueClassName)}>
        {value}
      </span>
    </div>
  );
}

function getHeroIconStyle(status: string) {
  switch (status) {
    case 'validated':
    case 'wallet_credited':
      return 'bg-success/10 text-success animate-success-glow';
    case 'rejected':
      return 'bg-destructive/10 text-destructive';
    case 'cancelled':
      return 'bg-muted text-muted-foreground';
    case 'pending_correction':
      return 'bg-amber-500/10 text-amber-600';
    default:
      return 'bg-primary/10 text-primary animate-glow-pulse';
  }
}

function getStatusTextColor(status: string) {
  switch (status) {
    case 'validated':
    case 'wallet_credited':
      return 'text-success';
    case 'rejected':
      return 'text-destructive';
    case 'cancelled':
      return 'text-muted-foreground';
    case 'pending_correction':
      return 'text-amber-600';
    case 'admin_review':
      return 'text-primary';
    default:
      return '';
  }
}

// ── Main Component ──────────────────────────────────────────

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
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const { data: deposit, isLoading: loadingDeposit } = useDepositDetail(depositId);
  const { data: proofs, isLoading: loadingProofs } = useDepositProofs(depositId);
  const { data: timelineEvents, isLoading: loadingTimeline } = useDepositTimeline(depositId);
  const { data: profile } = useMyProfile();
  const { user } = useAuth();
  const uploadProofs = useUploadMultipleProofs();
  const resubmitDeposit = useResubmitDeposit();
  const deleteProof = useDeleteDepositProof();
  const cancelDeposit = useCancelDeposit();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const animatedAmount = useCountUp(deposit?.amount_xaf ?? 0, { duration: 800 });

  useEffect(() => {
    const state = location.state as { fromProofUpload?: boolean } | null;
    if (state?.fromProofUpload) {
      toast.success('Preuve envoyée avec succès !');
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const timelineSteps = useMemo(() => {
    if (!deposit) return [];
    return buildDepositTimelineSteps(deposit.status, deposit.method, timelineEvents || []);
  }, [deposit, timelineEvents]);

  const isLoading = loadingDeposit || loadingProofs || loadingTimeline;

  if (isLoading) {
    return (
      <MobileLayout showNav={false}>
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl px-4 py-3 safe-area-top">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>
        <SkeletonDetail />
      </MobileLayout>
    );
  }

  if (!deposit) {
    return (
      <MobileLayout showNav={false}>
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl px-4 py-3 safe-area-top">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 text-center pt-20">
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
      case 'pending_correction': return 'info';
      case 'cancelled': return 'error';
      case 'admin_review': return 'processing';
      case 'proof_submitted': return 'info';
      default: return 'pending';
    }
  };

  const IconComponent = getMethodIcon();
  const canUploadProof = deposit.status === 'created' || deposit.status === 'awaiting_proof' || deposit.status === 'pending_correction';
  const isPendingCorrection = deposit.status === 'pending_correction';
  const canDeleteProofs = !['validated', 'rejected', 'cancelled'].includes(deposit.status);
  const canCancel = ['created', 'awaiting_proof', 'proof_submitted'].includes(deposit.status);
  const isTerminal = ['validated', 'wallet_credited', 'rejected', 'cancelled'].includes(deposit.status);

  const handleResubmit = async () => {
    if (!depositId || !uploadedProofs.length) return;
    // 1. D'abord resubmit (change status pending_correction → proof_submitted, clear rejection_reason)
    await resubmitDeposit.mutateAsync({ depositId });
    // 2. Puis upload les preuves (le statut est déjà proof_submitted, l'upload ne le re-set pas)
    await uploadProofs.mutateAsync({ depositId, files: uploadedProofs });
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
    await uploadProofs.mutateAsync({ depositId, files: uploadedProofs });
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

  const handleDownloadReceipt = async () => {
    if (!deposit || isGeneratingPDF) return;
    setIsGeneratingPDF(true);
    try {
      const clientName = profile
        ? `${profile.first_name} ${profile.last_name}`
        : (deposit as any).profiles
          ? `${(deposit as any).profiles.first_name} ${(deposit as any).profiles.last_name}`
          : 'Client';

      const receiptData: DepositReceiptData = {
        id: deposit.id,
        reference: deposit.reference,
        created_at: deposit.created_at,
        validated_at: deposit.validated_at,
        amount_xaf: deposit.amount_xaf,
        confirmed_amount_xaf: deposit.confirmed_amount_xaf,
        method: deposit.method,
        status: deposit.status,
        bank_name: deposit.bank_name,
        agency_name: deposit.agency_name,
        client_name: clientName,
        client_phone: profile?.phone || deposit.client_phone || undefined,
        client_email: user?.email || undefined,
        client_country: profile?.country || undefined,
        company_name: profile?.company_name || (deposit as any).profiles?.company_name,
      };
      await downloadPDF(
        <DepositReceiptPDF data={receiptData} />,
        `recu_depot_${deposit.reference}_${clientName.replace(/\s+/g, '_')}.pdf`,
      );
      toast.success('Relevé téléchargé');
    } catch (error) {
      console.error('Error generating deposit PDF:', error);
      toast.error('Erreur lors de la génération du PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <MobileLayout showNav={false}>
      {/* ── Sticky back button ── */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl px-4 py-3 safe-area-top">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {/* ── HERO ZONE ── */}
      <div className="flex flex-col items-center pt-2 pb-6 px-4">
        {/* Method icon with status-dependent glow */}
        <div
          className={cn(
            'w-16 h-16 rounded-2xl flex items-center justify-center mb-4 animate-scale-in',
            getHeroIconStyle(deposit.status),
          )}
        >
          <IconComponent className="w-8 h-8" />
        </div>

        {/* Method label */}
        <p className="text-sm font-medium text-muted-foreground mb-2 animate-fade-in">
          {DEPOSIT_METHOD_LABELS[deposit.method] || deposit.method}
        </p>

        {/* Status badge */}
        <div
          className="mb-4 animate-slide-up"
          style={{ animationDelay: '50ms', animationFillMode: 'both' }}
        >
          <StatusBadge
            status={mapStatusToType(deposit.status)}
            label={DEPOSIT_STATUS_LABELS[deposit.status] || deposit.status}
          />
        </div>

        {/* Animated amount */}
        <p className="text-4xl sm:text-5xl font-bold text-foreground tabular-nums tracking-tight">
          {formatXAF(animatedAmount)}
        </p>
        <p className="text-lg text-muted-foreground font-medium mt-1">XAF</p>

        {/* Date */}
        <p className="text-sm text-muted-foreground mt-3 animate-fade-in">
          {safeFormatDate(deposit.created_at)}
        </p>
      </div>

      {/* ── CONTENT SECTIONS ── */}
      <div className="space-y-4 px-4 pb-8">

        {/* Transaction ID strip */}
        <div
          className="flex items-center justify-between p-3.5 bg-muted/30 rounded-xl animate-slide-up"
          style={{ animationDelay: '150ms', animationFillMode: 'both' }}
        >
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground mb-0.5">Transaction ID</p>
            <p className="text-sm font-semibold text-foreground font-mono truncate">
              {deposit.reference}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            <button
              onClick={() => copyToClipboard(deposit.reference, 'reference')}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
            >
              {copiedField === 'reference' ? (
                <Check className="w-4 h-4 text-success" />
              ) : (
                <Copy className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
            <button
              onClick={handleDownloadReceipt}
              disabled={isGeneratingPDF}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              title="Télécharger le relevé"
            >
              {isGeneratingPDF ? (
                <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
              ) : (
                <FileDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>

        {/* ── Alert banners (conditional) ── */}

        {/* Countdown timer — only for initial states, not pending_correction */}
        {(deposit.status === 'created' || deposit.status === 'awaiting_proof') && (
          <div
            className="animate-slide-up"
            style={{ animationDelay: '180ms', animationFillMode: 'both' }}
          >
            <CountdownTimer createdAt={deposit.created_at} variant="banner" />
          </div>
        )}

        {/* Rejection notice */}
        {deposit.status === 'rejected' && deposit.rejection_reason && (
          <div
            className="revolut-alert-error animate-slide-up"
            style={{ animationDelay: '180ms', animationFillMode: 'both' }}
          >
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-sm text-destructive">Dépôt rejeté</p>
                <p className="text-sm text-muted-foreground mt-1">{deposit.rejection_reason}</p>
              </div>
            </div>
          </div>
        )}

        {/* Correction notice */}
        {isPendingCorrection && deposit.rejection_reason && (
          <div
            className="revolut-alert-warning animate-slide-up"
            style={{ animationDelay: '180ms', animationFillMode: 'both' }}
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-sm text-amber-600 dark:text-amber-400">
                  Correction demandée
                </p>
                <p className="text-sm text-muted-foreground mt-1">{deposit.rejection_reason}</p>
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                  Veuillez uploader une nouvelle preuve corrigée ci-dessous.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Cancelled notice */}
        {deposit.status === 'cancelled' && (
          <div
            className="revolut-alert-muted animate-slide-up"
            style={{ animationDelay: '180ms', animationFillMode: 'both' }}
          >
            <div className="flex items-start gap-3">
              <Ban className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-sm text-gray-600 dark:text-gray-400">
                  Dépôt annulé
                </p>
                <p className="text-sm text-muted-foreground mt-1">Ce dépôt a été annulé.</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Details card ── */}
        <div
          className="revolut-detail-section animate-slide-up"
          style={{ animationDelay: '220ms', animationFillMode: 'both' }}
        >
          <div className="revolut-detail-header">
            <h3 className="text-sm font-semibold text-foreground">Détails</h3>
          </div>
          <div className="divide-y divide-border/30">
            <DetailRow label="Méthode" value={DEPOSIT_METHOD_LABELS[deposit.method] || deposit.method} />
            {deposit.bank_name && (
              <DetailRow label="Banque" value={deposit.bank_name} />
            )}
            {deposit.agency_name && (
              <DetailRow label="Agence" value={deposit.agency_name} />
            )}
            <DetailRow label="Montant" value={`${formatXAF(deposit.amount_xaf)} XAF`} />
            <DetailRow
              label="Statut"
              value={DEPOSIT_STATUS_LABELS[deposit.status] || deposit.status}
              valueClassName={getStatusTextColor(deposit.status)}
            />
            <DetailRow label="Date" value={safeFormatDate(deposit.created_at) || '-'} />
          </div>
        </div>

        {/* ── Instructions section ── */}
        {!isTerminal && (
          <div
            className="revolut-detail-section animate-slide-up"
            style={{ animationDelay: '260ms', animationFillMode: 'both' }}
          >
            <div className="p-4">
              <DepositInstructions deposit={deposit} />
            </div>
          </div>
        )}
        {isTerminal && (
          <div
            className="animate-slide-up"
            style={{ animationDelay: '260ms', animationFillMode: 'both' }}
          >
            <button
              onClick={() => setInstructionsOpen(!instructionsOpen)}
              className="w-full flex items-center justify-between py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>Voir les instructions de dépôt</span>
              <ChevronDown
                className={cn(
                  'w-4 h-4 transition-transform duration-200',
                  instructionsOpen && 'rotate-180',
                )}
              />
            </button>
            {instructionsOpen && (
              <div className="revolut-detail-section animate-slide-up">
                <div className="p-4">
                  <DepositInstructions deposit={deposit} showTitle={false} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Proofs section (horizontal strip) ── */}
        {proofs && proofs.length > 0 && (
          <div
            className="animate-slide-up"
            style={{ animationDelay: '300ms', animationFillMode: 'both' }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Preuves</h3>
              <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                {proofs.length}
              </span>
            </div>
            <div className="proof-strip">
              {proofs.map((proof) => (
                <div
                  key={proof.id}
                  className="relative flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden border border-border/50 bg-muted/20 proof-thumb cursor-pointer"
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
                      <FileText className="w-8 h-8 text-primary" />
                    </div>
                  )}

                  {/* View overlay */}
                  <div className="absolute inset-0 bg-black/0 active:bg-black/20 transition-colors flex items-center justify-center">
                    <Eye className="w-5 h-5 text-white opacity-0 active:opacity-100 transition-opacity" />
                  </div>

                  {/* Delete button */}
                  {canDeleteProofs && (
                    <button
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingProofId(proof.id);
                        setDeleteReason('');
                        setCustomDeleteReason('');
                      }}
                    >
                      <Trash2 className="w-3 h-3 text-white" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Proof Upload ── */}
        {canUploadProof && (
          <div
            className="revolut-detail-section p-4 animate-slide-up"
            style={{ animationDelay: '340ms', animationFillMode: 'both' }}
          >
            <ProofUpload
              key={uploadKey}
              onFilesSelect={handleProofsUpload}
              selectedFiles={uploadedProofs}
              onConfirm={isPendingCorrection ? handleResubmit : handleConfirmProofs}
              isSubmitting={uploadProofs.isPending || resubmitDeposit.isPending}
            />
          </div>
        )}

        {/* ── Timeline ── */}
        <div
          className="revolut-detail-section animate-slide-up"
          style={{ animationDelay: '380ms', animationFillMode: 'both' }}
        >
          <div className="revolut-detail-header">
            <h3 className="text-sm font-semibold text-foreground">Suivi</h3>
          </div>
          <div className="p-4">
            <DepositTimelineDisplay steps={timelineSteps} variant="compact" />
          </div>
        </div>

        {/* ── Download Receipt ── */}
        {isTerminal && (
          <div
            className="animate-slide-up"
            style={{ animationDelay: '400ms', animationFillMode: 'both' }}
          >
            <Button
              variant="outline"
              className="w-full h-12 rounded-xl flex items-center justify-center gap-2 font-medium"
              onClick={handleDownloadReceipt}
              disabled={isGeneratingPDF}
            >
              {isGeneratingPDF ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileDown className="w-4 h-4" />
              )}
              Télécharger le relevé
            </Button>
          </div>
        )}

        {/* ── Actions ── */}
        {canCancel && (
          <div
            className="animate-slide-up"
            style={{ animationDelay: '420ms', animationFillMode: 'both' }}
          >
            <button
              className="w-full py-3 text-sm font-medium text-destructive hover:bg-destructive/5 rounded-xl transition-colors"
              onClick={() => setCancelDialogOpen(true)}
            >
              Annuler le dépôt
            </button>
          </div>
        )}

        {/* Back link */}
        <div
          className="text-center py-4 animate-slide-up"
          style={{ animationDelay: '460ms', animationFillMode: 'both' }}
        >
          <button
            className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5"
            onClick={() => navigate('/deposits')}
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à mes dépôts
          </button>
        </div>
      </div>

      {/* ── Proof Viewer Dialog ── */}
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

      {/* ── Cancel Deposit Dialog ── */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Ban className="w-5 h-5 text-destructive" />
              Annuler ce dépôt ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous vraiment annuler ce dépôt de {formatXAF(deposit.amount_xaf)} XAF ?
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Non, garder</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelDeposit.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!depositId) return;
                cancelDeposit.mutate(
                  { depositId },
                  { onSettled: () => setCancelDialogOpen(false) },
                );
              }}
            >
              {cancelDeposit.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Ban className="w-4 h-4 mr-2" />
              )}
              Oui, annuler
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete Proof Dialog ── */}
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
