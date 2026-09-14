// ============================================================
// MODULE DEPOTS V2 — MobileDepositDetailV2
// Le dépôt en phrases, pour quelqu'un qui lit vite sur un téléphone :
//   combien · qui · comment · quand, puis la preuve, puis la décision.
//   Le détail (référence, banque, date) et le suivi sont repliés.
//   Rien sous 16 px, rien de tronqué.
// Logique 100% préservée : validate/reject/start-review, upload &
//   suppression de preuves, suppression dépôt, timeline, PDF reçu.
// ============================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useAdminDepositDetail,
  useAdminDepositProofs,
  useAdminDepositTimeline,
  useAdminWalletByUserId,
  useValidateDeposit,
  useRejectDeposit,
  useStartDepositReview,
  useAdminUploadProofs,
  useAdminDeleteProof,
  useDeleteDeposit,
} from '@/hooks/useAdminDeposits';
import {
  DEPOSIT_STATUS_LABELS,
  DEPOSIT_METHOD_LABELS,
  REJECTION_REASONS,
  PROOF_DELETE_REASONS,
} from '@/types/deposit';
import { buildDepositTimelineSteps, getStepColors, getDepositSlaLevel } from '@/lib/depositTimeline';
import { formatCurrency } from '@/lib/formatters';
import { whenSentence } from '@/lib/plainTime';
import { MIN_DEPOSIT_XAF, isValidXafAmount, xafAmountError } from '@/lib/amountLimits';
import { cn } from '@/lib/utils';
import {
  SURFACE,
  TEXT,
  SOFT_PILL,
  DISABLED_PILL,
  depositStatusTone,
  StatusPill,
  Card,
  Button,
  SectionTitle,
  Line,
  Fold,
  Holder,
  PrimaryPill,
  SoftPill,
  BottomSheet,
  FormField,
  TextInput,
} from '@/mobile/designKit';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  FileText,
  CheckCircle,
  AlertTriangle,
  Bell,
  BellOff,
  ArrowRight,
  ChevronLeft,
  Trash2,
  X,
  Plus,
  Eye,
  Download,
} from 'lucide-react';
import { SkeletonDetail } from '@/mobile/components/ui/SkeletonCard';
import { downloadPDF } from '@/lib/pdf/downloadPDF';
import { DepositReceiptPDF } from '@/lib/pdf/templates/DepositReceiptPDF';
import type { DepositReceiptData } from '@/lib/pdf/templates/DepositReceiptPDF';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { PasteDropZone } from '@/components/upload/PasteDropZone';
import { FilePreviewGrid } from '@/components/upload/FilePreviewGrid';
import { usePasteFiles } from '@/hooks/usePasteFiles';
import { partitionUploadFiles, rejectionMessage, ACCEPT_UPLOAD } from '@/lib/clipboardFiles';

// ── Familles de méthode (identité de marque conservée) ───────
const FAMILIES_CONF: Record<string, { letter: string; bg: string; dark?: boolean }> = {
  BANK: { letter: 'B', bg: '#1e3a5f' },
  AGENCY_BONZINI: { letter: 'A', bg: '#A947FE' },
  ORANGE_MONEY: { letter: 'O', bg: '#ff6600' },
  MTN_MONEY: { letter: 'M', bg: '#ffcb05', dark: true },
  WAVE: { letter: 'W', bg: '#1dc3e3' },
};

function getFamilyFromMethod(method: string): string {
  if (['bank_transfer', 'bank_cash'].includes(method)) return 'BANK';
  if (method === 'agency_cash') return 'AGENCY_BONZINI';
  if (['om_transfer', 'om_withdrawal'].includes(method)) return 'ORANGE_MONEY';
  if (['mtn_transfer', 'mtn_withdrawal'].includes(method)) return 'MTN_MONEY';
  if (method === 'wave') return 'WAVE';
  return 'BANK';
}

// ── Composant MIcon (vignette méthode, couleur de marque) ────
function MIcon({ family, size = 20 }: { family: string; size?: number }) {
  const f = FAMILIES_CONF[family];
  if (!f) return null;
  return (
    <div
      className="flex shrink-0 items-center justify-center font-bold"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        background: f.bg,
        fontSize: Math.round(size * 0.38),
        color: f.dark ? '#1a1028' : '#fff',
      }}
    >
      {f.letter}
    </div>
  );
}

// ── Formatage montant ────────────────────────────────────────
function fmt(n: number) {
  return Math.abs(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

// ── En-tête simple (back + titre) — réutilisé loading/error ──
function DetailHeader({ title, onBack, right }: { title: string; onBack: () => void; right?: React.ReactNode }) {
  return (
    <header className={cn('sticky top-0 z-40 flex shrink-0 items-center justify-between gap-2 px-4 pt-[env(safe-area-inset-top)]', SURFACE.canvas)}>
      <div className="flex h-14 min-w-0 flex-1 items-center gap-1">
        <button
          onClick={onBack}
          aria-label="Retour"
          className={cn('-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition active:bg-[#F5F5F5] dark:active:bg-[#383838]', TEXT.strong)}
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <span className={cn('truncate text-[16px] font-bold', TEXT.strong)}>{title}</span>
      </div>
      {right}
    </header>
  );
}

// ── Composant principal ──────────────────────────────────────
export function MobileDepositDetailV2() {
  const { depositId } = useParams<{ depositId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAdminAuth();
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const { data: deposit, isLoading } = useAdminDepositDetail(depositId);
  const { data: proofs } = useAdminDepositProofs(depositId);
  const { data: timeline } = useAdminDepositTimeline(depositId);
  const { data: wallet } = useAdminWalletByUserId(deposit?.user_id);

  const validateDeposit = useValidateDeposit();
  const rejectDeposit = useRejectDeposit();
  // requestCorrection removed — correction flow suppressed
  const startReview = useStartDepositReview();
  const uploadProofs = useAdminUploadProofs();
  const deleteProof = useAdminDeleteProof();
  const deleteDeposit = useDeleteDeposit();

  // Validate modal state
  const [showValidateConfirm, setShowValidateConfirm] = useState(false);
  const [confirmedAmount, setConfirmedAmount] = useState('');
  const [adminComment, setAdminComment] = useState('');
  const [sendNotification, setSendNotification] = useState(true);

  // Reject modal state
  const [showRejectSheet, setShowRejectSheet] = useState(false);
  const [rejectionCategory, setRejectionCategory] = useState('');
  const [clientMessage, setClientMessage] = useState('');
  const [adminNote, setAdminNote] = useState('');

  // Correction modal removed — correction flow suppressed

  // Proof management state
  const [viewingProof, setViewingProof] = useState<string | null>(null);
  const [showUploadSheet, setShowUploadSheet] = useState(false);
  const [showDeleteProofSheet, setShowDeleteProofSheet] = useState<string | null>(null);
  const [deleteProofReason, setDeleteProofReason] = useState('');
  const [customDeleteReason, setCustomDeleteReason] = useState('');
  const replaceFileRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [replaceProofId, setReplaceProofId] = useState<string | null>(null);

  // Delete deposit state
  const [showDeleteDepositSheet, setShowDeleteDepositSheet] = useState(false);

  // Sections repliées
  const [showDetail, setShowDetail] = useState(false);
  const [showSuivi, setShowSuivi] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Initialize confirmed amount when deposit loads
  useEffect(() => {
    if (deposit) {
      setConfirmedAmount(deposit.amount_xaf.toString());
    }
  }, [deposit]);

  const timelineSteps = buildDepositTimelineSteps(
    deposit?.status || 'created',
    deposit?.method || 'bank_transfer',
    timeline || [],
  );

  // ── Handlers ────────────────────────────────────────────────

  const handleValidate = useCallback(() => {
    if (!depositId || !deposit) return;
    const amt = Number(confirmedAmount);
    // This number is credited straight to the client's wallet, so it gets the
    // same 50 M ceiling / safe-integer check as the creation forms. The previous
    // guard was `!amt || amt <= 0` and returned SILENTLY — an admin who typed a
    // bad amount saw the button do nothing and no explanation.
    const problem = xafAmountError(amt, MIN_DEPOSIT_XAF, 'Le montant confirmé');
    if (problem) {
      toast.error(problem);
      return;
    }
    validateDeposit.mutate(
      {
        depositId,
        adminComment: adminComment || undefined,
        confirmedAmount: amt !== deposit.amount_xaf ? amt : undefined,
        sendNotification,
      },
      { onSuccess: () => setShowValidateConfirm(false) },
    );
  }, [depositId, deposit, confirmedAmount, adminComment, sendNotification, validateDeposit]);

  const handleReject = useCallback(() => {
    if (!depositId || !rejectionCategory || !clientMessage) return;
    rejectDeposit.mutate(
      {
        depositId,
        reason: clientMessage,
        rejectionCategory,
        adminNote: adminNote || undefined,
      },
      {
        onSuccess: () => {
          setShowRejectSheet(false);
          setRejectionCategory('');
          setClientMessage('');
          setAdminNote('');
        },
      },
    );
  }, [depositId, rejectionCategory, clientMessage, adminNote, rejectDeposit]);

  const handleStartReview = useCallback(() => {
    if (!depositId) return;
    startReview.mutate({ depositId });
  }, [depositId, startReview]);

  /**
   * Stage more proofs for upload.
   *
   * Appends rather than replaces: the sheet is opened once and files trickle in
   * (a paste, then a second paste, then a PDF from disk). The previous handler
   * overwrote the whole selection on every pick, so choosing a second file
   * silently dropped the first.
   */
  const addSelectedFiles = useCallback((files: File[]) => {
    setSelectedFiles((prev) => [...prev, ...files]);
  }, []);

  const removeSelectedFile = useCallback((index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Ctrl+V anywhere on the fiche stages a proof — and opens the sheet if it is
  // still closed, so a pasted screenshot is never silently swallowed.
  const canPasteProof = !!deposit && !['validated', 'rejected', 'cancelled'].includes(deposit.status);
  usePasteFiles({
    onFiles: useCallback(
      (files: File[]) => {
        setShowUploadSheet(true);
        addSelectedFiles(files);
      },
      [addSelectedFiles],
    ),
    enabled: canPasteProof && !showRejectSheet && !showDeleteDepositSheet && !showDeleteProofSheet && !viewingProof,
  });

  const handleUploadProofs = useCallback(() => {
    if (!depositId || !deposit || selectedFiles.length === 0) return;
    uploadProofs.mutate(
      {
        depositId,
        userId: deposit.user_id,
        files: selectedFiles,
        depositStatus: deposit.status,
      },
      {
        onSuccess: () => {
          setShowUploadSheet(false);
          setSelectedFiles([]);
        },
      },
    );
  }, [depositId, deposit, selectedFiles, uploadProofs]);

  const handleDeleteProof = useCallback(() => {
    if (!showDeleteProofSheet || !depositId) return;
    const reason = deleteProofReason === 'Autre' ? customDeleteReason : deleteProofReason;
    if (!reason) return;
    deleteProof.mutate(
      { proofId: showDeleteProofSheet, depositId, reason },
      {
        onSuccess: () => {
          setShowDeleteProofSheet(null);
          setDeleteProofReason('');
          setCustomDeleteReason('');
        },
      },
    );
  }, [showDeleteProofSheet, depositId, deleteProofReason, customDeleteReason, deleteProof]);

  const handleReplaceFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (replaceFileRef.current) replaceFileRef.current.value = '';
    if (!picked || !replaceProofId || !depositId || !deposit) return;

    // Reject up front: a bad replacement that fails mid-flight would delete
    // nothing and leave the admin unsure whether the swap happened.
    const { accepted, rejected } = partitionUploadFiles([picked]);
    const problem = rejectionMessage(rejected);
    if (problem) {
      toast.error(problem);
      setReplaceProofId(null);
      return;
    }
    const file = accepted[0];
    const oldProofId = replaceProofId;
    setReplaceProofId(null);
    uploadProofs.mutate(
      { depositId, userId: deposit.user_id, files: [file], depositStatus: deposit.status },
      {
        onSuccess: () => {
          deleteProof.mutate({
            proofId: oldProofId,
            depositId,
            reason: 'Remplacée par une nouvelle version',
          });
        },
      },
    );
  }, [replaceProofId, depositId, deposit, uploadProofs, deleteProof]);

  const handleDownloadReceipt = async () => {
    if (!deposit || isGeneratingPDF) return;
    setIsGeneratingPDF(true);
    try {
      const clientName = deposit.profiles
        ? `${deposit.profiles.first_name} ${deposit.profiles.last_name}`
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
        client_phone: deposit.profiles?.phone,
        company_name: deposit.profiles?.company_name,
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

  // ── Loading / Error ─────────────────────────────────────────

  if (isLoading) {
    return (
      <div className={cn('flex min-h-full flex-col', SURFACE.canvas)}>
        <DetailHeader title="Dépôt" onBack={() => navigate('/m/deposits')} />
        <SkeletonDetail />
      </div>
    );
  }

  if (!deposit) {
    return (
      <div className={cn('flex min-h-full flex-col', SURFACE.canvas)}>
        <DetailHeader title="Dépôt" onBack={() => navigate('/m/deposits')} />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          <Holder icon={AlertTriangle} tone="danger" size="lg" />
          <p className={cn('text-[16px] font-medium', TEXT.muted)}>Dépôt introuvable</p>
        </div>
      </div>
    );
  }

  // ── Computed values ─────────────────────────────────────────

  const clientName = deposit.profiles
    ? `${deposit.profiles.first_name} ${deposit.profiles.last_name}`
    : 'Client inconnu';
  const isLocked = ['validated', 'rejected', 'cancelled', 'cancelled_by_admin'].includes(deposit.status);
  const canStartReview = deposit.status === 'proof_submitted';
  const hasProofs = proofs && proofs.length > 0;
  const canAddProof = !isLocked;
  const confirmedAmountNum = Number(confirmedAmount) || 0;
  const confirmedAmountValid = isValidXafAmount(confirmedAmountNum, MIN_DEPOSIT_XAF);
  const amountDiffers = confirmedAmountNum !== deposit.amount_xaf && confirmedAmountNum > 0;
  const slaLevel = getDepositSlaLevel(deposit.created_at, deposit.status);
  const statusLabel = DEPOSIT_STATUS_LABELS[deposit.status] || deposit.status;
  const family = getFamilyFromMethod(deposit.method);
  const methodLabel = DEPOSIT_METHOD_LABELS[deposit.method] || deposit.method;
  const phone = deposit.client_phone || deposit.profiles?.phone;

  const infoRows = [
    { l: 'Référence', v: deposit.reference },
    { l: 'Méthode', v: methodLabel },
    deposit.bank_name ? { l: 'Banque', v: deposit.bank_name } : null,
    deposit.agency_name ? { l: 'Agence', v: deposit.agency_name } : null,
    phone ? { l: 'Téléphone du client', v: phone } : null,
    deposit.profiles?.company_name ? { l: 'Entreprise', v: deposit.profiles.company_name } : null,
    { l: 'Envoyé le', v: format(new Date(deposit.created_at), "d MMMM yyyy 'à' HH:mm", { locale: fr }) },
    deposit.validated_at ? { l: 'Validé le', v: format(new Date(deposit.validated_at), "d MMMM yyyy 'à' HH:mm", { locale: fr }) } : null,
    deposit.admin_comment ? { l: 'Note pour le client', v: deposit.admin_comment } : null,
    deposit.admin_internal_note ? { l: 'Note interne', v: deposit.admin_internal_note } : null,
  ].filter(Boolean) as { l: string; v: string }[];

  return (
    <div className={cn('flex min-h-full flex-col pb-6', SURFACE.canvas)}>
      {/* ── En-tête : ← Dépôt + [Relevé] ──────────────────── */}
      <DetailHeader
        title="Dépôt"
        onBack={() => navigate('/m/deposits')}
        right={
          <Button variant="neutral" onClick={handleDownloadReceipt} loading={isGeneratingPDF}>
            <Download />
            Relevé
          </Button>
        }
      />

      <div className="flex flex-col gap-6 px-5 pt-2">
        {/* ── En une phrase : combien, qui, comment, quand ──── */}
        <section className="space-y-3">
          <div className="flex items-start gap-3">
            <MIcon family={family} size={44} />
            <div className="min-w-0 flex-1 space-y-2">
              <StatusPill tone={depositStatusTone(deposit.status)} label={statusLabel} />
              <p className={cn('text-[28px] font-semibold leading-none tracking-[-0.02em] tabular-nums', TEXT.strong)}>
                {fmt(deposit.amount_xaf)} XAF
              </p>
              <Line>
                Envoyé par <b className={TEXT.strong}>{clientName}</b> via {methodLabel}, {whenSentence(deposit.created_at)}.
              </Line>
            </div>
          </div>
          {deposit.confirmed_amount_xaf != null && deposit.confirmed_amount_xaf !== deposit.amount_xaf && (
            <Line tone="good">
              Le client a été crédité de {fmt(deposit.confirmed_amount_xaf)} XAF, au lieu de {fmt(deposit.amount_xaf)} XAF.
            </Line>
          )}
          {deposit.status === 'rejected' && deposit.rejection_reason && (
            <Line tone="bad">Refusé : {deposit.rejection_reason}</Line>
          )}
          {slaLevel === 'overdue' && <Line tone="bad">Ce dépôt attend depuis plus de 8 heures. Il faut le traiter.</Line>}
          {slaLevel === 'aging' && <Line tone="warn">Ce dépôt attend depuis plus de 2 heures.</Line>}
          {wallet && (
            <Line>
              Solde du client : <b className={cn('tabular-nums', TEXT.strong)}>{fmt(wallet.balance_xaf)} XAF</b>.
            </Line>
          )}
        </section>

        {/* ── La preuve ─────────────────────────────────────── */}
        <section>
          <SectionTitle
            action={canAddProof && hasProofs ? { label: 'Ajouter', onClick: () => setShowUploadSheet(true) } : undefined}
          >
            {hasProofs && proofs!.length > 1 ? `Les preuves (${proofs!.length})` : 'La preuve'}
          </SectionTitle>

          {/* Input caché pour remplacement */}
          <input
            ref={replaceFileRef}
            type="file"
            accept={ACCEPT_UPLOAD}
            onChange={handleReplaceFileSelect}
            className="hidden"
          />

          {!hasProofs ? (
            <Card className="space-y-3">
              <Line>Le client n'a pas encore envoyé de preuve de paiement.</Line>
              {canAddProof && (
                <Button variant="neutral" className="w-full" onClick={() => setShowUploadSheet(true)}>
                  <Plus />
                  Ajouter une preuve
                </Button>
              )}
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {proofs!.map((proof) => {
                const signedUrl = proof.signedUrl;
                const isImage = proof.file_type?.startsWith('image/');
                const isPdf = proof.file_type === 'application/pdf';
                return (
                  <Card key={proof.id} className="overflow-hidden p-0">
                    <div className="relative w-full bg-[#F5F5F5] dark:bg-[#383838]" style={{ aspectRatio: '16/10' }}>
                      {isImage && signedUrl ? (
                        <img src={signedUrl} alt={proof.file_name} className="h-full w-full object-contain" />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-2">
                          <FileText className={cn('h-10 w-10', TEXT.muted)} />
                          <span className={cn('text-[16px] font-semibold', TEXT.muted)}>{isPdf ? 'Document PDF' : 'Fichier'}</span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-3 p-4">
                      <Line>
                        {proof.uploaded_by_type === 'admin' ? 'Ajoutée par un administrateur' : 'Envoyée par le client'}{' '}
                        {whenSentence(proof.uploaded_at)}.
                      </Line>
                      <p className={cn('break-all text-[16px] leading-snug', TEXT.muted)}>{proof.file_name}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="neutral"
                          onClick={() => signedUrl && isImage && setViewingProof(signedUrl)}
                          disabled={!signedUrl || !isImage}
                        >
                          <Eye />
                          Agrandir
                        </Button>
                        <a
                          href={signedUrl ?? undefined}
                          download={proof.file_name}
                          className={cn(
                            'inline-flex h-10 items-center justify-center gap-2 px-3 text-[16px] font-medium no-underline [&_svg]:h-5 [&_svg]:w-5',
                            signedUrl ? SOFT_PILL : cn(DISABLED_PILL, 'pointer-events-none'),
                          )}
                        >
                          <Download />
                          Télécharger
                        </a>
                        {!isLocked && (
                          <>
                            <Button
                              variant="neutral"
                              onClick={() => { setReplaceProofId(proof.id); replaceFileRef.current?.click(); }}
                              disabled={uploadProofs.isPending}
                            >
                              <ArrowRight />
                              Remplacer
                            </Button>
                            <Button variant="dangerSubtle" onClick={() => setShowDeleteProofSheet(proof.id)}>
                              <Trash2 />
                              Supprimer
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* ── La décision ───────────────────────────────────── */}
        <section className="space-y-2">
          <SectionTitle>La décision</SectionTitle>
          {isLocked ? (
            <Line>
              {deposit.status === 'validated'
                ? 'Ce dépôt est validé : le client a été crédité.'
                : deposit.status === 'rejected'
                  ? 'Ce dépôt a été refusé.'
                  : 'Ce dépôt a été annulé.'}{' '}
              Il n'y a plus rien à faire.
            </Line>
          ) : (
            <>
              {canStartReview && (
                <Button className="w-full" onClick={handleStartReview} loading={startReview.isPending}>
                  Commencer la vérification
                </Button>
              )}
              <Button
                className="w-full"
                variant={canStartReview ? 'neutral' : 'primary'}
                onClick={() => {
                  setConfirmedAmount(deposit.amount_xaf.toString());
                  setShowValidateConfirm(true);
                }}
              >
                Valider le dépôt
              </Button>
              <Button className="w-full" variant="dangerSubtle" onClick={() => setShowRejectSheet(true)}>
                Refuser le dépôt
              </Button>
            </>
          )}
          {isSuperAdmin && (
            <Button className="w-full" variant="subtle" onClick={() => setShowDeleteDepositSheet(true)}>
              <Trash2 />
              Annuler ce dépôt
            </Button>
          )}
        </section>

        {/* ── Le détail (replié) ────────────────────────────── */}
        <Fold title="Le détail" open={showDetail} onToggle={() => setShowDetail(!showDetail)}>
          <div className={cn('divide-y', SURFACE.divider)}>
            {infoRows.map((r) => (
              <div key={r.l} className="py-2">
                <p className={cn('text-[16px] leading-snug', TEXT.muted)}>{r.l}</p>
                <p className={cn('break-words text-[16px] font-semibold leading-snug tabular-nums', TEXT.strong)}>{r.v}</p>
              </div>
            ))}
          </div>
        </Fold>

        {/* ── Le suivi (replié) ─────────────────────────────── */}
        <Fold title="Le suivi" open={showSuivi} onToggle={() => setShowSuivi(!showSuivi)}>
          {timelineSteps.map((step, index) => (
            <div key={step.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2',
                    getStepColors(step.key, step.status),
                  )}
                >
                  {step.status === 'completed' && <CheckCircle className="h-4 w-4" />}
                  {step.status === 'current' && <span className="h-2.5 w-2.5 rounded-full bg-current" />}
                </div>
                {index < timelineSteps.length - 1 && (
                  <div
                    className="my-0.5 w-0.5 flex-1"
                    style={{ minHeight: 24, background: step.status === 'completed' ? '#14AE5C' : '#D9D9D9' }}
                  />
                )}
              </div>
              <div className="min-w-0 pb-4">
                <p className={cn('text-[16px] font-semibold leading-snug', step.status === 'pending' ? TEXT.muted : TEXT.strong)}>
                  {step.label}
                </p>
                {/* La description s'adresse au client (« Votre dépôt… ») : ici on ne garde que la date. */}
                {step.formattedDate
                  ? <p className={cn('text-[16px] leading-snug', TEXT.muted)}>{step.formattedDate}</p>
                  : step.status !== 'completed' && <p className={cn('text-[16px] leading-snug', TEXT.muted)}>{step.status === 'current' ? 'En cours' : 'Pas encore'}</p>}
              </div>
            </div>
          ))}
        </Fold>
      </div>

      {/* ── BottomSheet validation ────────────────────────── */}
      <BottomSheet open={showValidateConfirm} onClose={() => setShowValidateConfirm(false)} title="Valider ce dépôt">
        <div className="space-y-4">
          <div className={cn('space-y-2 rounded-lg p-3', SURFACE.canvas)}>
            <div className="flex items-center justify-between text-[16px]">
              <span className={TEXT.muted}>Montant déclaré</span>
              <span className={cn('font-semibold tabular-nums', TEXT.strong)}>{formatCurrency(deposit.amount_xaf)}</span>
            </div>
            <FormField label="Montant confirmé (XAF)" htmlFor="confirmed-amount-v2">
              <TextInput
                id="confirmed-amount-v2"
                inputMode="decimal"
                enterKeyHint="done"
                value={confirmedAmount}
                /* XAF has no subunit — allowing "." let `100.5.2` through to
                   Number() as NaN, and a fractional amount into the ledger. */
                onChange={(e) => setConfirmedAmount(e.target.value.replace(/[^0-9]/g, ''))}
                className="font-bold"
              />
            </FormField>
          </div>
          {amountDiffers && (
            <div className="flex items-start gap-2 rounded-lg bg-[#FFF1C2] p-3 dark:bg-[#522504]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#682D03] dark:text-[#FFF1C2]" />
              <p className="text-[16px] text-[#682D03] dark:text-[#FFF1C2]">
                Le montant confirmé ({formatCurrency(confirmedAmountNum)}) diffère du montant déclaré.
              </p>
            </div>
          )}
          <div className="rounded-lg bg-[#CFF7D3] p-4 dark:bg-[#02542D]">
            <p className="text-[16px] text-[#02542D] dark:text-[#CFF7D3]">
              Le wallet sera crédité de <strong>{formatCurrency(confirmedAmountNum || deposit.amount_xaf)}</strong>
            </p>
            {wallet && (
              <p className="mt-1 text-[16px] text-[#02542D] dark:text-[#CFF7D3]">
                Nouveau solde estimé : {formatCurrency(wallet.balance_xaf + (confirmedAmountNum || deposit.amount_xaf))}
              </p>
            )}
          </div>
          <FormField label="Note interne (optionnel)">
            <textarea
              value={adminComment}
              onChange={(e) => setAdminComment(e.target.value)}
              enterKeyHint="done"
              rows={2}
              placeholder="Commentaire visible uniquement par les admins..."
              className={cn('w-full resize-none rounded-lg p-3 text-[16px] outline-none transition', SURFACE.card, SURFACE.shadow, TEXT.strong, 'placeholder:text-[#B3B3B3] focus:ring-2 focus:ring-[#2C2C2C] dark:focus:ring-[#E3E3E3]')}
            />
          </FormField>
          <button
            type="button"
            onClick={() => setSendNotification(!sendNotification)}
            className={cn('flex w-full items-center justify-between rounded-lg p-3', SURFACE.canvas)}
          >
            <div className="flex items-center gap-2">
              {sendNotification ? (
                <Bell className="h-4 w-4 text-[#1E1E1E] dark:text-[#F5F5F5]" />
              ) : (
                <BellOff className={cn('h-4 w-4', TEXT.muted)} />
              )}
              <span className={cn('text-[16px]', TEXT.strong)}>Notifier le client</span>
            </div>
            <span
              className={cn(
                'relative h-6 w-10 rounded-full transition-colors',
                sendNotification ? 'bg-[#2C2C2C] dark:bg-[#E3E3E3]' : 'bg-[#D9D9D9] dark:bg-[#444444]',
              )}
            >
              <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all', sendNotification ? 'left-[18px]' : 'left-0.5')} />
            </span>
          </button>
          <div className="flex gap-2">
            <SoftPill onClick={() => setShowValidateConfirm(false)} className="flex-1">
              Annuler
            </SoftPill>
            <PrimaryPill
              onClick={handleValidate}
              loading={validateDeposit.isPending}
              disabled={!confirmedAmountValid}
              className="flex-1"
            >
              Confirmer la validation
            </PrimaryPill>
          </div>
        </div>
      </BottomSheet>

      {/* ── BottomSheet rejet ─────────────────────────────── */}
      <BottomSheet
        open={showRejectSheet}
        onClose={() => { setShowRejectSheet(false); setRejectionCategory(''); setClientMessage(''); setAdminNote(''); }}
        title={
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-[#900B09] dark:text-[#FDD3D0]" />
            Refuser ce dépôt
          </span>
        }
      >
        <div className="space-y-4">
          <div>
            <p className={cn('mb-2 text-[16px]', TEXT.muted)}>Motif du refus</p>
            <div className="space-y-2">
              {REJECTION_REASONS.map((reason) => (
                <button
                  key={reason}
                  onClick={() => {
                    setRejectionCategory(reason);
                    if (!clientMessage.trim()) {
                      setClientMessage(`Votre dépôt a été refusé : ${reason.toLowerCase()}.`);
                    }
                  }}
                  className={cn(
                    'w-full rounded-lg p-3 text-left text-[16px] transition-all ring-1',
                    rejectionCategory === reason
                      ? 'bg-[#FDD3D0] text-[#900B09] ring-[#EC221F]/40 dark:bg-[#900B09] dark:text-[#FDD3D0]'
                      : cn(SURFACE.card, 'ring-black/[0.06] dark:ring-white/[0.06]', TEXT.strong),
                  )}
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>
          <FormField
            label={<>Message client <span className="text-[#900B09]">*</span></>}
          >
            <textarea
              value={clientMessage}
              onChange={(e) => setClientMessage(e.target.value)}
              rows={2}
              placeholder="Expliquez au client pourquoi son dépôt est refusé..."
              className={cn('w-full resize-none rounded-lg p-3 text-[16px] outline-none transition', SURFACE.card, SURFACE.shadow, TEXT.strong, 'placeholder:text-[#B3B3B3] focus:ring-2 focus:ring-[#2C2C2C] dark:focus:ring-[#E3E3E3]')}
            />
            <p className={cn('mt-1 text-[16px]', TEXT.muted)}>Ce message sera visible par le client</p>
          </FormField>
          <FormField label="Note interne (optionnel)">
            <textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              enterKeyHint="done"
              rows={2}
              placeholder="Note visible uniquement par les admins..."
              className={cn('w-full resize-none rounded-lg p-3 text-[16px] outline-none transition', SURFACE.card, SURFACE.shadow, TEXT.strong, 'placeholder:text-[#B3B3B3] focus:ring-2 focus:ring-[#2C2C2C] dark:focus:ring-[#E3E3E3]')}
            />
          </FormField>
          <div className="flex gap-2">
            <SoftPill
              onClick={() => { setShowRejectSheet(false); setRejectionCategory(''); setClientMessage(''); setAdminNote(''); }}
              className="flex-1"
            >
              Annuler
            </SoftPill>
            <PrimaryPill
              onClick={handleReject}
              loading={rejectDeposit.isPending}
              disabled={!rejectionCategory || !clientMessage.trim()}
              danger
              className="flex-1"
            >
              Confirmer le refus
            </PrimaryPill>
          </div>
        </div>
      </BottomSheet>

      {/* Correction modal removed — correction flow suppressed */}

      {/* ── BottomSheet upload preuve ─────────────────────── */}
      <BottomSheet open={showUploadSheet} onClose={() => setShowUploadSheet(false)} title="Ajouter une preuve">
        <div className="space-y-4">
          {/* The fiche-level usePasteFiles already routes Ctrl+V here, so this
              zone stays passive and only serves drag / click / "Coller". */}
          <PasteDropZone onFiles={addSelectedFiles} enabled={false} busy={uploadProofs.isPending} />
          <FilePreviewGrid files={selectedFiles} onRemove={removeSelectedFile} />
          <div className="flex gap-2">
            <SoftPill onClick={() => { setShowUploadSheet(false); setSelectedFiles([]); }} className="flex-1">
              Annuler
            </SoftPill>
            <PrimaryPill
              onClick={handleUploadProofs}
              loading={uploadProofs.isPending}
              disabled={selectedFiles.length === 0}
              className="flex-1"
            >
              Ajouter ({selectedFiles.length})
            </PrimaryPill>
          </div>
        </div>
      </BottomSheet>

      {/* ── BottomSheet suppression preuve ────────────────── */}
      <BottomSheet
        open={!!showDeleteProofSheet}
        onClose={() => { setShowDeleteProofSheet(null); setDeleteProofReason(''); setCustomDeleteReason(''); }}
        title={
          <span className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-[#900B09] dark:text-[#FDD3D0]" />
            Supprimer cette preuve ?
          </span>
        }
      >
        <div className="space-y-4">
          <p className={cn('text-[16px]', TEXT.muted)}>Cette action est irréversible.</p>
          <div className="space-y-2">
            {PROOF_DELETE_REASONS.map((reason) => (
              <button
                key={reason}
                onClick={() => setDeleteProofReason(reason)}
                className={cn(
                  'w-full rounded-lg p-3 text-left text-[16px] transition-all ring-1',
                  deleteProofReason === reason
                    ? 'bg-[#FDD3D0] text-[#900B09] ring-[#EC221F]/40 dark:bg-[#900B09] dark:text-[#FDD3D0]'
                    : cn(SURFACE.card, 'ring-black/[0.06] dark:ring-white/[0.06]', TEXT.strong),
                )}
              >
                {reason}
              </button>
            ))}
          </div>
          {deleteProofReason === 'Autre' && (
            <textarea
              value={customDeleteReason}
              onChange={(e) => setCustomDeleteReason(e.target.value)}
              rows={2}
              placeholder="Précisez le motif..."
              className={cn('w-full resize-none rounded-lg p-3 text-[16px] outline-none transition', SURFACE.card, SURFACE.shadow, TEXT.strong, 'placeholder:text-[#B3B3B3] focus:ring-2 focus:ring-[#2C2C2C] dark:focus:ring-[#E3E3E3]')}
            />
          )}
          <div className="flex gap-2">
            <SoftPill
              onClick={() => { setShowDeleteProofSheet(null); setDeleteProofReason(''); setCustomDeleteReason(''); }}
              className="flex-1"
            >
              Annuler
            </SoftPill>
            <PrimaryPill
              onClick={handleDeleteProof}
              loading={deleteProof.isPending}
              disabled={!deleteProofReason || (deleteProofReason === 'Autre' && !customDeleteReason)}
              danger
              className="flex-1"
            >
              Supprimer
            </PrimaryPill>
          </div>
        </div>
      </BottomSheet>

      {/* ── BottomSheet annulation dépôt ──────────────────── */}
      <BottomSheet
        open={showDeleteDepositSheet}
        onClose={() => setShowDeleteDepositSheet(false)}
        title={
          <span className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-[#900B09] dark:text-[#FDD3D0]" />
            Annuler ce dépôt ?
          </span>
        }
      >
        <div className="space-y-4">
          <p className={cn('text-[16px]', TEXT.muted)}>
            Voulez-vous annuler ce dépôt ? Le dépôt sera marqué comme annulé et le solde sera ajusté si nécessaire.
          </p>
          <div className={cn('text-center text-[16px]', TEXT.muted)}>
            {clientName} — {fmt(deposit.amount_xaf)} XAF
          </div>
          <div className="flex gap-2">
            <SoftPill onClick={() => setShowDeleteDepositSheet(false)} className="flex-1">
              Retour
            </SoftPill>
            <PrimaryPill
              onClick={() => {
                if (!depositId) return;
                deleteDeposit.mutate({ depositId }, {
                  onSuccess: () => navigate('/m/deposits'),
                });
              }}
              loading={deleteDeposit.isPending}
              danger
              className="flex-1"
            >
              Confirmer l'annulation
            </PrimaryPill>
          </div>
        </div>
      </BottomSheet>

      {/* ── Visionneuse preuve plein écran ────────────────── */}
      {viewingProof && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black"
          onClick={() => setViewingProof(null)}
        >
          <button
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/20"
            onClick={() => setViewingProof(null)}
          >
            <X className="h-6 w-6 text-white" />
          </button>
          <img
            src={viewingProof}
            className="max-h-full max-w-full object-contain p-4"
            onClick={(e) => e.stopPropagation()}
            alt="Preuve"
          />
        </div>
      )}
    </div>
  );
}
