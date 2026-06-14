// ============================================================
// PAGE — DepositDetailPage (orchestrateur), refonte « Direction A ».
// En-tête drill-in (retour + référence) · action en tête (reçu si crédité,
// carte ROUGE « Ajouter la preuve » + countdown si preuve attendue) · hero
// montant XAF · messages de statut · coordonnées Bonzini · preuve (strip +
// upload) · suivi (jalons cycle de vie) · annuler · détails. Reçu PDF,
// upload/suppression preuves, countdown, timeline 100% PRÉSERVÉS.
// ============================================================
import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, ArrowRight, XCircle, Ban, FileText, Eye, Download,
  FileDown, Loader2, Trash2, ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Button } from '@/components/ui/button';
import { TextArea } from '@/components/form';
import { SURFACE, TEXT, PRIMARY_PILL, SOFT_PILL } from '@/mobile/designKit';
import { DepositMethodLogo } from '@/mobile/components/deposits/DepositLogos';
import { ProofUpload } from '@/components/deposit/ProofUpload';
import { DepositTimelineDisplay } from '@/components/deposit/DepositTimelineDisplay';
import { CountdownTimer } from '@/components/deposit/CountdownTimer';
import { DepositInstructions } from '@/components/deposit/DepositInstructions';
import {
  useDepositDetail,
  useDepositProofs,
  useDepositTimeline,
  useUploadMultipleProofs,
  useDeleteDepositProof,
  useCancelDeposit,
} from '@/hooks/useDeposits';
import { formatNumber } from '@/lib/formatters';
import { buildDepositTimelineSteps, safeFormatDate } from '@/lib/depositTimeline';
import { depositLifecycle, depositStatusLabel, LIFECYCLE_COLOR } from '@/lib/depositLifecycle';
import { downloadPDF } from '@/lib/pdf/downloadPDF';
import { DepositReceiptPDF } from '@/lib/pdf/templates/DepositReceiptPDF';
import type { DepositReceiptData } from '@/lib/pdf/templates/DepositReceiptPDF';
import { useMyProfile } from '@/hooks/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PROOF_DELETE_REASONS } from '@/types/deposit';

function ProofImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className={cn('flex flex-col items-center justify-center', SURFACE.holder, className)}>
        <FileText className="h-6 w-6" />
      </div>
    );
  }
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />;
}

const DepositDetailPage = () => {
  const { depositId } = useParams<{ depositId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation('deposits');
  const [uploadedProofs, setUploadedProofs] = useState<File[]>([]);
  const [viewingProof, setViewingProof] = useState<{ url: string; name: string } | null>(null);
  const [uploadKey, setUploadKey] = useState(0);
  const [deletingProofId, setDeletingProofId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [customDeleteReason, setCustomDeleteReason] = useState('');
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const uploadRef = useRef<HTMLDivElement | null>(null);

  const { data: deposit, isLoading: loadingDeposit } = useDepositDetail(depositId);
  const { data: proofs, isLoading: loadingProofs } = useDepositProofs(depositId);
  const { data: timelineEvents, isLoading: loadingTimeline } = useDepositTimeline(depositId);
  const { data: profile } = useMyProfile();
  const { user } = useAuth();
  const uploadProofs = useUploadMultipleProofs();
  const deleteProof = useDeleteDepositProof();
  const cancelDeposit = useCancelDeposit();

  useEffect(() => {
    const state = location.state as { fromProofUpload?: boolean } | null;
    if (state?.fromProofUpload) {
      toast.success(t('detail.proofUploadedSuccess'));
      window.history.replaceState({}, document.title);
    }
  }, [location.state, t]);

  const timelineSteps = useMemo(() => {
    if (!deposit) return [];
    return buildDepositTimelineSteps(deposit.status, deposit.method, timelineEvents || []);
  }, [deposit, timelineEvents]);

  const isLoading = loadingDeposit || loadingProofs || loadingTimeline;

  // ── En-tête drill-in réutilisable ──
  const Header = ({ title }: { title: string }) => (
    <div className="flex items-center gap-3 px-4 pb-1 pt-4">
      <button
        onClick={() => navigate('/deposits')}
        aria-label={t('detail.backToDeposits')}
        className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition active:scale-95', SURFACE.card, SURFACE.shadow)}
      >
        <ArrowLeft className={cn('h-5 w-5', TEXT.strong)} />
      </button>
      <span className={cn('truncate text-[17px] font-black', TEXT.strong)}>{title}</span>
    </div>
  );

  if (isLoading) {
    return (
      <MobileLayout showNav={false} showHeader={false}>
        <div className={cn('min-h-[100dvh] space-y-4 p-4', SURFACE.canvas)}>
          <div className={cn('h-10 w-44 animate-pulse rounded-full', SURFACE.card, SURFACE.shadow)} />
          <div className={cn('h-52 w-full animate-pulse rounded-[26px]', SURFACE.card, SURFACE.shadow)} />
          <div className={cn('h-40 w-full animate-pulse rounded-[22px]', SURFACE.card, SURFACE.shadow)} />
        </div>
      </MobileLayout>
    );
  }

  if (!deposit) {
    return (
      <MobileLayout showNav={false} showHeader={false}>
        <div className={cn('min-h-[100dvh]', SURFACE.canvas)}>
          <Header title="" />
          <div className="flex flex-col items-center justify-center px-6 pt-24 text-center">
            <p className={cn('text-[15px]', TEXT.muted)}>{t('detail.notFound')}</p>
            <button onClick={() => navigate('/deposits')} className={cn('mt-5 px-6 py-[13px] text-[14px] font-bold', PRIMARY_PILL)}>
              {t('detail.backToDeposits')}
            </button>
          </div>
        </div>
      </MobileLayout>
    );
  }

  const lc = depositLifecycle(deposit.status);
  const lcColor = LIFECYCLE_COLOR[lc.kind];
  const canUploadProof = deposit.status === 'created' || deposit.status === 'awaiting_proof';
  const canDeleteProofs = !['validated', 'rejected', 'cancelled', 'cancelled_by_admin'].includes(deposit.status);
  const canCancel = ['created', 'awaiting_proof', 'proof_submitted'].includes(deposit.status);
  const isTerminal = ['validated', 'wallet_credited', 'rejected', 'cancelled', 'cancelled_by_admin'].includes(deposit.status);
  const isValidated = deposit.status === 'validated' || deposit.status === 'wallet_credited';
  const showCountdown = deposit.status === 'created' || deposit.status === 'awaiting_proof';
  const creditedAmount = deposit.confirmed_amount_xaf ?? deposit.amount_xaf;
  const amountDiffers = deposit.confirmed_amount_xaf != null && deposit.confirmed_amount_xaf !== deposit.amount_xaf;

  const handleProofsUpload = (files: File[]) => setUploadedProofs(files);

  const handleConfirmProofs = async () => {
    if (!uploadedProofs.length || !depositId) return;
    await uploadProofs.mutateAsync({ depositId, files: uploadedProofs });
    setUploadedProofs([]);
    setUploadKey((k) => k + 1);
  };

  const isImageFile = (fileType: string | null) => fileType?.startsWith('image/');

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        : (deposit as any).profiles
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        company_name: profile?.company_name || (deposit as any).profiles?.company_name,
      };
      await downloadPDF(
        <DepositReceiptPDF data={receiptData} />,
        `recu_depot_${deposit.reference}_${clientName.replace(/\s+/g, '_')}.pdf`,
      );
      toast.success(t('detail.receiptDownloaded'));
    } catch (error) {
      console.error('Error generating deposit PDF:', error);
      toast.error(t('detail.receiptError'));
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const methodLabel = t(`method.${deposit.method}`, deposit.method);

  return (
    <MobileLayout showNav={false} showHeader={false}>
      <div className={cn('min-h-[100dvh]', SURFACE.canvas)}>
        <Header title={deposit.reference} />

        <div className="space-y-5 px-4 pb-8 pt-3">
          {/* Action en tête : reçu (crédité) OU action rouge (preuve attendue / à corriger) */}
          {isValidated ? (
            <button
              onClick={handleDownloadReceipt}
              disabled={isGeneratingPDF}
              className={cn('flex w-full items-center justify-center gap-2 py-[15px] text-[15px] font-bold transition active:scale-[0.99] disabled:opacity-60', PRIMARY_PILL)}
            >
              {isGeneratingPDF ? <Loader2 className="h-[17px] w-[17px] animate-spin" /> : <FileDown className="h-[17px] w-[17px]" />}
              {t('detail.downloadReceipt')}
            </button>
          ) : showCountdown ? (
            <div className="rounded-[22px] bg-[#FBE7E7] p-4 dark:bg-[#3A2526]">
              <div className="flex items-center justify-between gap-2">
                <p className="px-1 text-[13px] font-semibold" style={{ color: LIFECYCLE_COLOR.todo }}>
                  Ajoutez votre preuve de versement
                </p>
                <CountdownTimer createdAt={deposit.created_at} compact />
              </div>
              {canUploadProof && (
                <button
                  onClick={() => uploadRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                  className={cn('mt-3 flex w-full items-center justify-center gap-2 py-2.5 text-[13px] font-bold transition active:scale-[0.99]', PRIMARY_PILL)}
                >
                  Ajouter la preuve <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          ) : deposit.status === 'pending_correction' ? (
            <div className="rounded-[22px] bg-[#FBE7E7] p-4 dark:bg-[#3A2526]">
              <p className="px-1 text-[13px] font-bold" style={{ color: LIFECYCLE_COLOR.todo }}>{t('status.pending_correction')}</p>
              {deposit.admin_comment && (
                <p className={cn('mt-1 px-1 text-[13px]', TEXT.muted)}>{deposit.admin_comment}</p>
              )}
            </div>
          ) : null}

          {/* Hero — montant */}
          <div className={cn('rounded-[26px] p-6', SURFACE.card, SURFACE.shadow)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DepositMethodLogo method={deposit.method} bankName={deposit.bank_name} size={30} radius={9} />
                <span className={cn('text-[13px] font-bold', TEXT.strong)}>{methodLabel}</span>
              </div>
              <span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ color: lcColor, background: `${lcColor}1F` }}>
                {depositStatusLabel(deposit.status)}
              </span>
            </div>

            <div className={cn('mt-5 text-[13px] font-semibold', TEXT.muted)}>
              {isValidated ? 'Montant crédité sur votre solde' : lc.kind === 'failed' ? 'Montant du dépôt' : 'Montant à verser'}
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              {isValidated && <span className="text-[34px] font-black" style={{ color: LIFECYCLE_COLOR.done }}>+</span>}
              <span className={cn('text-[52px] font-black leading-none tracking-tight tabular-nums', TEXT.strong)}>
                {formatNumber(creditedAmount)}
              </span>
              <span className="text-[18px] font-extrabold text-[#E8932A]">XAF</span>
            </div>
            {isValidated && (
              <div className={cn('mt-2.5 text-[15px] font-bold tabular-nums', TEXT.muted)}>
                Crédité le {safeFormatDate(deposit.validated_at || deposit.updated_at)}
              </div>
            )}
            {amountDiffers && (
              <div className={cn('mt-2 text-[12px] tabular-nums', TEXT.muted)}>
                Montant demandé : {formatNumber(deposit.amount_xaf)} XAF
              </div>
            )}
          </div>

          {/* Messages de statut */}
          {deposit.status === 'rejected' && deposit.rejection_reason && (
            <div className="rounded-[22px] bg-[#FBE7E7] p-5 dark:bg-[#3A2526]">
              <div className="flex items-start gap-3">
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#C0504D] dark:text-[#E79A9A]" />
                <div>
                  <p className="text-[15px] font-bold text-[#C0504D] dark:text-[#E79A9A]">{t('detail.depositRejected')}</p>
                  <p className={cn('mt-1 text-[13px]', TEXT.muted)}>{deposit.rejection_reason}</p>
                </div>
              </div>
            </div>
          )}
          {(deposit.status === 'cancelled' || deposit.status === 'cancelled_by_admin') && (
            <div className={cn('rounded-[22px] p-5', SURFACE.card, SURFACE.shadow)}>
              <div className="flex items-start gap-3">
                <Ban className="mt-0.5 h-5 w-5 shrink-0 text-[#8E8BA0]" />
                <div>
                  <p className={cn('text-[15px] font-bold', TEXT.strong)}>{t('detail.depositCancelled')}</p>
                  <p className={cn('mt-1 text-[13px]', TEXT.muted)}>{t('detail.depositCancelledDesc')}</p>
                </div>
              </div>
            </div>
          )}

          {/* Coordonnées Bonzini — où verser (repli si terminal) */}
          {!isTerminal ? (
            <DepositInstructions deposit={deposit} />
          ) : (
            <div>
              <button
                onClick={() => setInstructionsOpen((o) => !o)}
                className={cn('flex w-full items-center justify-between rounded-[22px] px-5 py-4 text-[14px] font-bold', SURFACE.card, SURFACE.shadow, TEXT.strong)}
              >
                <span>{t('detail.viewInstructions')}</span>
                <ChevronDown className={cn('h-4 w-4 transition-transform', instructionsOpen && 'rotate-180', TEXT.muted)} />
              </button>
              {instructionsOpen && (
                <div className="mt-4">
                  <DepositInstructions deposit={deposit} showTitle={false} />
                </div>
              )}
            </div>
          )}

          {/* Preuve de versement — strip + upload */}
          {(proofs && proofs.length > 0) || canUploadProof ? (
            <section ref={uploadRef}>
              <h2 className={cn('mb-2 px-1 text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>{t('detail.proofs')}</h2>
              <div className={cn('rounded-[22px] p-5', SURFACE.card, SURFACE.shadow)}>
                {proofs && proofs.length > 0 && (
                  <div className={cn('flex gap-3 overflow-x-auto pb-1', canUploadProof && 'mb-4')}>
                    {proofs.map((proof) => (
                      <div
                        key={proof.id}
                        className="relative h-24 w-24 shrink-0 cursor-pointer overflow-hidden rounded-2xl ring-1 ring-black/[0.06] dark:ring-white/[0.08]"
                        onClick={() => {
                          if (isImageFile(proof.file_type) && proof.signedUrl) setViewingProof({ url: proof.signedUrl, name: proof.file_name });
                          else if (proof.signedUrl) handleDownloadProof(proof.signedUrl, proof.file_name);
                        }}
                      >
                        {isImageFile(proof.file_type) && proof.signedUrl ? (
                          <ProofImage src={proof.signedUrl} alt={proof.file_name} className="h-full w-full object-cover" />
                        ) : (
                          <div className={cn('flex h-full w-full items-center justify-center', SURFACE.holder)}>
                            <FileText className="h-8 w-8" />
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors active:bg-black/20">
                          <Eye className="h-5 w-5 text-white opacity-0 transition-opacity active:opacity-100" />
                        </div>
                        {canDeleteProofs && (
                          <button
                            className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/50"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingProofId(proof.id);
                              setDeleteReason('');
                              setCustomDeleteReason('');
                            }}
                          >
                            <Trash2 className="h-3 w-3 text-white" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {canUploadProof && (
                  <ProofUpload
                    key={uploadKey}
                    onFilesSelect={handleProofsUpload}
                    selectedFiles={uploadedProofs}
                    onConfirm={handleConfirmProofs}
                    isSubmitting={uploadProofs.isPending}
                  />
                )}
              </div>
            </section>
          ) : null}

          {/* Suivi */}
          <section>
            <h2 className={cn('mb-2 px-1 text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>{t('detail.timeline')}</h2>
            <div className={cn('rounded-[22px] p-5', SURFACE.card, SURFACE.shadow)}>
              <DepositTimelineDisplay steps={timelineSteps} />
            </div>
          </section>

          {/* Détails */}
          <section>
            <h2 className={cn('mb-2 px-1 text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>{t('detail.details')}</h2>
            <div className={cn('rounded-[22px] p-5', SURFACE.card, SURFACE.shadow)}>
              <DetailRow label={t('detail.reference')} value={deposit.reference} mono />
              <DetailRow label={t('detail.method')} value={methodLabel} />
              {deposit.bank_name && <DetailRow label={t('detail.bank')} value={deposit.bank_name} />}
              {deposit.agency_name && <DetailRow label={t('detail.agency')} value={deposit.agency_name} />}
              <DetailRow label={t('detail.date')} value={safeFormatDate(deposit.created_at) || '-'} />
              {isValidated && deposit.validated_at && (
                <DetailRow label="Crédité le" value={safeFormatDate(deposit.validated_at) || '-'} last />
              )}
            </div>
          </section>

          {/* Reçu (terminal non crédité) */}
          {isTerminal && !isValidated && (
            <button
              onClick={handleDownloadReceipt}
              disabled={isGeneratingPDF}
              className={cn('flex w-full items-center justify-center gap-2 py-3 text-[13px] font-bold transition active:scale-[0.99] disabled:opacity-50', SOFT_PILL)}
            >
              {isGeneratingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              {t('detail.downloadReceipt')}
            </button>
          )}

          {/* Annuler */}
          {canCancel && (
            <button
              onClick={() => setCancelDialogOpen(true)}
              className="w-full py-3 text-center text-[13px] font-semibold text-[#C0504D] transition active:opacity-70 dark:text-[#E79A9A]"
            >
              {t('detail.cancelDeposit')}
            </button>
          )}
        </div>
      </div>

      {/* Proof Viewer */}
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
                <ProofImage src={viewingProof.url} alt={viewingProof.name} className="max-h-[70vh] w-full rounded-lg object-contain" />
                <Button className="mt-4 w-full" variant="outline" onClick={() => handleDownloadProof(viewingProof.url, viewingProof.name)}>
                  <Download className="mr-2 h-4 w-4" />
                  {t('detail.download')}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Deposit */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-destructive" />
              {t('detail.cancelDialogTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('detail.cancelDialogDesc', { amount: `${formatNumber(deposit.amount_xaf)} XAF` })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('detail.cancelDialogKeep')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelDeposit.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!depositId) return;
                cancelDeposit.mutate({ depositId }, { onSettled: () => setCancelDialogOpen(false) });
              }}
            >
              {cancelDeposit.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ban className="mr-2 h-4 w-4" />}
              {t('detail.cancelDialogConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Proof */}
      <AlertDialog open={!!deletingProofId} onOpenChange={(open) => { if (!open) setDeletingProofId(null); }}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              {t('detail.deleteProofTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('detail.deleteProofDesc')}</AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2 py-2">
            {PROOF_DELETE_REASONS.map((reason, index) => {
              const reasonKeys = ['incorrectUpload', 'wrongDeposit', 'duplicate', 'illegibleImage', 'other'] as const;
              return (
                <button
                  key={reason}
                  type="button"
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                    deleteReason === reason ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-border text-foreground hover:bg-muted/50',
                  )}
                  onClick={() => setDeleteReason(reason)}
                >
                  {t(`proofDeleteReasons.${reasonKeys[index]}`)}
                </button>
              );
            })}
            {deleteReason === 'Autre' && (
              <TextArea
                wrapperClassName="mt-2"
                rows={2}
                placeholder={t('detail.specifyReason')}
                value={customDeleteReason}
                onChange={(e) => setCustomDeleteReason(e.target.value)}
                controlClassName="min-h-[56px] resize-none"
              />
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>{t('detail.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={!deleteReason || (deleteReason === 'Autre' && !customDeleteReason.trim()) || deleteProof.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deletingProofId || !depositId) return;
                const reason = deleteReason === 'Autre' ? customDeleteReason.trim() : deleteReason;
                deleteProof.mutate({ proofId: deletingProofId, depositId, reason }, { onSettled: () => setDeletingProofId(null) });
              }}
            >
              {deleteProof.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              {t('detail.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MobileLayout>
  );
};

function DetailRow({ label, value, mono, last }: { label: string; value: string; mono?: boolean; last?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 py-2', !last && 'border-b border-black/[0.05] dark:border-white/[0.07]')}>
      <span className="text-[13px] text-[#8E8BA0]">{label}</span>
      <span className={cn('truncate text-[13px] font-bold', mono && 'font-mono', 'text-[#1B1A24] dark:text-[#F2F1F7]')}>{value}</span>
    </div>
  );
}

export default DepositDetailPage;
