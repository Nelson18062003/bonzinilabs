// ============================================================
// MODULE DEPOTS V2 — MobileDepositDetailV2
// Présentation migrée sur le design kit (Ofspace/Mola) :
//   canvas doux · cartes à ombre douce · hero Amount · StatusPill
//   toné (depositStatusTone) · MIcon · SlaDot · bottom-sheets du kit.
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
  DEPOSIT_METHOD_LABELS_SHORT,
  REJECTION_REASONS,
  PROOF_DELETE_REASONS,
} from '@/types/deposit';
import { buildDepositTimelineSteps, getStepColors, getDepositSlaLevel, type SlaLevel } from '@/lib/depositTimeline';
import { formatCurrency, formatRelativeDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import {
  SURFACE,
  TEXT,
  SOFT_PILL,
  depositStatusTone,
  StatusPill,
  Card,
  Amount,
  Holder,
  Row,
  PrimaryPill,
  SoftPill,
  BottomSheet,
  FormField,
  TextInput,
} from '@/mobile/designKit';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Loader2,
  FileText,
  CheckCircle,
  AlertTriangle,
  Bell,
  BellOff,
  ArrowRight,
  ChevronDown,
  ChevronUp,
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
      className="flex shrink-0 items-center justify-center font-black"
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

// ── Point SLA ────────────────────────────────────────────────
function SlaDot({ level }: { level: SlaLevel }) {
  const color = level === 'fresh' ? '#34d399' : level === 'aging' ? '#F3A745' : '#ef4444';
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{
        width: 6,
        height: 6,
        background: color,
        animation: level === 'overdue' ? 'sla-pulse 1.5s infinite' : undefined,
      }}
    />
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
          className={cn('-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-95', TEXT.muted)}
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <span className={cn('truncate text-[15px] font-bold', TEXT.strong)}>{title}</span>
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [replaceProofId, setReplaceProofId] = useState<string | null>(null);

  // Delete deposit state
  const [showDeleteDepositSheet, setShowDeleteDepositSheet] = useState(false);

  // Suivi collapsible
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
    if (!amt || amt <= 0) return;
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) setSelectedFiles(Array.from(files));
  };

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
          if (fileInputRef.current) fileInputRef.current.value = '';
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
    const file = e.target.files?.[0];
    if (!file || !replaceProofId || !depositId || !deposit) return;
    const oldProofId = replaceProofId;
    setReplaceProofId(null);
    if (replaceFileRef.current) replaceFileRef.current.value = '';
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
          <p className={cn('text-[14px] font-medium', TEXT.muted)}>Dépôt introuvable</p>
        </div>
      </div>
    );
  }

  // ── Computed values ─────────────────────────────────────────

  const clientName = deposit.profiles
    ? `${deposit.profiles.first_name} ${deposit.profiles.last_name}`
    : 'Client inconnu';
  const isLocked = ['validated', 'rejected', 'cancelled'].includes(deposit.status);
  const canValidate = !isLocked;
  const canReject = !isLocked;
  const canStartReview = deposit.status === 'proof_submitted';
  const hasProofs = proofs && proofs.length > 0;
  const canAddProof = !isLocked;
  const confirmedAmountNum = Number(confirmedAmount) || 0;
  const amountDiffers = confirmedAmountNum !== deposit.amount_xaf && confirmedAmountNum > 0;
  const slaLevel = getDepositSlaLevel(deposit.created_at, deposit.status);
  const statusLabel = DEPOSIT_STATUS_LABELS[deposit.status] || deposit.status;
  const family = getFamilyFromMethod(deposit.method);
  const methodShort = DEPOSIT_METHOD_LABELS_SHORT[deposit.method] || deposit.method;

  const infoRows = [
    { l: 'Référence', v: deposit.reference },
    { l: 'Méthode', v: methodShort },
    deposit.bank_name ? { l: 'Banque', v: deposit.bank_name } : null,
    deposit.agency_name ? { l: 'Agence', v: deposit.agency_name } : null,
    { l: 'Date', v: format(new Date(deposit.created_at), 'dd MMM yyyy, HH:mm', { locale: fr }) },
    deposit.admin_comment ? { l: 'Note admin', v: deposit.admin_comment } : null,
  ].filter(Boolean) as { l: string; v: string }[];

  return (
    <div className={cn('flex min-h-full flex-col pb-6', SURFACE.canvas)}>
      <style>{`@keyframes sla-pulse { 0%,100%{opacity:1} 50%{opacity:.3} }`}</style>

      {/* ── Header : ← REF + [Relevé] ──────────────────────── */}
      <DetailHeader
        title={deposit.reference}
        onBack={() => navigate('/m/deposits')}
        right={
          <button
            onClick={handleDownloadReceipt}
            disabled={isGeneratingPDF}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#10B981] px-3.5 py-2 text-[12px] font-bold text-white transition active:scale-95',
              isGeneratingPDF && 'opacity-60',
            )}
          >
            {isGeneratingPDF && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Relevé
          </button>
        }
      />

      <div className="flex flex-col gap-3 px-5 pt-2">
        {/* ── Sous-header : badge · méthode · date + SLA ────── */}
        <div className="flex items-center justify-between gap-2 px-1">
          <StatusPill tone={depositStatusTone(deposit.status)} label={statusLabel} />
          <div className="flex items-center gap-1.5">
            <MIcon family={family} size={20} />
            <span className={cn('text-[12px] font-semibold', TEXT.strong)}>{methodShort}</span>
            {slaLevel && <SlaDot level={slaLevel} />}
            <span className={cn('text-[11px]', TEXT.muted)}>{formatRelativeDate(deposit.created_at)}</span>
          </div>
        </div>

        {/* ── Hero montant ──────────────────────────────────── */}
        <Card className="flex flex-col items-center gap-3 py-6 text-center">
          <Amount value={fmt(deposit.amount_xaf)} unit="XAF" size="xl" />
          <div className={cn('text-[12px]', TEXT.muted)}>
            Client : <span className={cn('font-bold', TEXT.strong)}>{clientName}</span>
          </div>
          {deposit.confirmed_amount_xaf && deposit.confirmed_amount_xaf !== deposit.amount_xaf && (
            <div className="flex items-center justify-center gap-1.5">
              <span className={cn('text-[12px] line-through', TEXT.muted)}>{fmt(deposit.amount_xaf)} XAF</span>
              <ArrowRight className="h-3.5 w-3.5 text-[#2E7D52] dark:text-[#7FCBA0]" />
              <span className="text-[12px] font-bold text-[#2E7D52] dark:text-[#7FCBA0]">
                {fmt(deposit.confirmed_amount_xaf)} XAF crédité
              </span>
            </div>
          )}
          {wallet && (
            <div className={cn('text-[11px]', TEXT.muted)}>
              Solde wallet : <strong className={TEXT.strong}>{formatCurrency(wallet.balance_xaf)}</strong>
            </div>
          )}
        </Card>

        {/* ── Section preuves ───────────────────────────────── */}
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <span className={cn('text-[13px] font-bold', TEXT.strong)}>Preuves ({proofs?.length || 0})</span>
            {canAddProof && (
              <button
                onClick={() => setShowUploadSheet(true)}
                className="inline-flex items-center gap-1 rounded-full bg-[#DEEFE5] px-2.5 py-1 text-[11px] font-bold text-[#2E7D52] transition active:scale-95 dark:bg-[#1E3A2C] dark:text-[#7FCBA0]"
              >
                <Plus className="h-3 w-3" />
                Ajouter
              </button>
            )}
          </div>

          {/* Input caché pour remplacement */}
          <input
            ref={replaceFileRef}
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            onChange={handleReplaceFileSelect}
            className="hidden"
          />

          {!hasProofs ? (
            <div>
              <div className="rounded-2xl border-2 border-dashed border-black/10 p-4 text-center dark:border-white/10">
                <div className={cn('text-[12px] font-bold', TEXT.muted)}>Preuve manquante</div>
                <div className={cn('mt-0.5 text-[11px]', TEXT.muted)}>Le client doit envoyer un justificatif</div>
              </div>
              {canAddProof && (
                <button
                  onClick={() => setShowUploadSheet(true)}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full bg-[#DEEFE5] py-2.5 text-[12px] font-bold text-[#2E7D52] transition active:scale-[0.99] dark:bg-[#1E3A2C] dark:text-[#7FCBA0]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Ajouter une preuve
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {proofs!.map((proof, idx) => {
                const signedUrl = proof.signedUrl;
                const isImage = proof.file_type?.startsWith('image/');
                const isPdf = proof.file_type === 'application/pdf';
                return (
                  <div key={proof.id} className="overflow-hidden rounded-2xl ring-1 ring-black/[0.06] dark:ring-white/[0.06]">
                    {/* Preview */}
                    <div
                      className="relative w-full bg-black/5 dark:bg-white/5"
                      style={{ aspectRatio: idx === 0 ? '16/9' : '16/7' }}
                    >
                      {isImage && signedUrl ? (
                        <img src={signedUrl} alt={proof.file_name} className="h-full w-full object-cover" />
                      ) : isPdf ? (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5">
                          <FileText className={cn('h-8 w-8', TEXT.muted)} />
                          <span className={cn('text-[11px] font-bold', TEXT.muted)}>PDF</span>
                        </div>
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5">
                          <FileText className={cn('h-8 w-8', TEXT.muted)} />
                          <span className={cn('px-4 text-center text-[10px]', TEXT.muted)}>{proof.file_name}</span>
                        </div>
                      )}
                      {/* Overlay nom fichier — haut gauche */}
                      <div className="absolute left-1.5 top-1.5 max-w-[55%] truncate rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {proof.file_name}
                      </div>
                      {/* Badge uploader — haut droite */}
                      <div className="absolute right-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {proof.uploaded_by_type === 'admin' ? 'Admin' : 'Client'}
                      </div>
                    </div>

                    {/* Boutons d'action */}
                    <div className={cn('flex gap-1.5 p-2', SURFACE.canvas)}>
                      <button
                        onClick={() => signedUrl && isImage && setViewingProof(signedUrl)}
                        disabled={!signedUrl || !isImage}
                        className={cn('flex h-8 flex-1 items-center justify-center gap-1 rounded-lg text-[10px] font-semibold transition active:scale-95', SOFT_PILL, (!signedUrl || !isImage) && 'opacity-40')}
                      >
                        <Eye className="h-3 w-3" />
                        Agrandir
                      </button>
                      <a
                        href={signedUrl ?? undefined}
                        download={proof.file_name}
                        className={cn('flex h-8 flex-1 items-center justify-center gap-1 rounded-lg text-[10px] font-semibold no-underline', SOFT_PILL, !signedUrl && 'pointer-events-none opacity-40')}
                      >
                        <Download className="h-3 w-3" />
                        Télécharger
                      </a>
                      {!isLocked && (
                        <>
                          <button
                            onClick={() => { setReplaceProofId(proof.id); replaceFileRef.current?.click(); }}
                            disabled={uploadProofs.isPending}
                            className={cn('flex h-8 flex-1 items-center justify-center gap-1 rounded-lg text-[10px] font-semibold transition active:scale-95', SOFT_PILL, uploadProofs.isPending && 'opacity-40')}
                          >
                            <ArrowRight className="h-3 w-3" />
                            Remplacer
                          </button>
                          <button
                            onClick={() => setShowDeleteProofSheet(proof.id)}
                            className="flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-[#FBE7E7] text-[10px] font-semibold text-[#C0504D] transition active:scale-95 dark:bg-[#3A2526] dark:text-[#E79A9A]"
                          >
                            <Trash2 className="h-3 w-3" />
                            Supprimer
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* ── Section infos + actions ───────────────────────── */}
        <Card>
          {infoRows.map((r, i) => (
            <Row key={i} label={r.l} value={<span className="block max-w-[60vw] truncate">{r.v}</span>} />
          ))}

          {/* ── Boutons d'action ───────────────────────────── */}
          {(canValidate || canReject || canStartReview || isSuperAdmin) && (
            <div className="mt-3 flex flex-col gap-2 border-t border-black/[0.06] pt-3 dark:border-white/[0.06]">
              {canStartReview && (
                <button
                  onClick={handleStartReview}
                  disabled={startReview.isPending}
                  className={cn(
                    'flex w-full items-center justify-center gap-1.5 rounded-full bg-[#7C3AED] py-3 text-[13px] font-bold text-white transition active:scale-[0.99]',
                    startReview.isPending && 'opacity-60',
                  )}
                >
                  {startReview.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Commencer la vérification
                </button>
              )}

              {canValidate && (
                <>
                  <button
                    onClick={() => {
                      setConfirmedAmount(deposit.amount_xaf.toString());
                      setShowValidateConfirm(true);
                    }}
                    className="w-full rounded-full bg-[#10B981] py-3 text-[13px] font-bold text-white transition active:scale-[0.99]"
                  >
                    Valider le dépôt
                  </button>
                  <button
                    onClick={() => setShowRejectSheet(true)}
                    className="w-full rounded-full bg-[#FBE7E7] py-2.5 text-[12px] font-semibold text-[#C0504D] transition active:scale-[0.99] dark:bg-[#3A2526] dark:text-[#E79A9A]"
                  >
                    Rejeter
                  </button>
                  {/* Correction button removed — soit on valide, soit on refuse */}
                </>
              )}

              {isSuperAdmin && (
                <button
                  onClick={() => setShowDeleteDepositSheet(true)}
                  className={cn('flex w-full items-center justify-center gap-1.5 rounded-full py-2.5 text-[11px] font-semibold transition active:scale-[0.99]', SOFT_PILL, TEXT.muted)}
                >
                  <Trash2 className="h-3 w-3" />
                  Annuler
                </button>
              )}
            </div>
          )}
        </Card>

        {/* ── Section suivi collapsible ─────────────────────── */}
        <Card className="overflow-hidden p-0">
          <button
            onClick={() => setShowSuivi(!showSuivi)}
            className="flex w-full items-center justify-between p-4"
          >
            <span className={cn('text-[13px] font-bold', TEXT.strong)}>Suivi</span>
            {showSuivi ? (
              <ChevronUp className={cn('h-4 w-4', TEXT.muted)} />
            ) : (
              <ChevronDown className={cn('h-4 w-4', TEXT.muted)} />
            )}
          </button>

          {showSuivi && (
            <div className="border-t border-black/[0.06] px-4 pb-4 pt-3 dark:border-white/[0.06]">
              {timelineSteps.map((step, index) => (
                <div key={step.id} className="flex gap-2.5">
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
                        getStepColors(step.key, step.status),
                      )}
                    >
                      {step.status === 'completed' && <CheckCircle className="h-3 w-3" />}
                      {step.status === 'current' && <span className="h-2 w-2 rounded-full bg-current" />}
                    </div>
                    {index < timelineSteps.length - 1 && (
                      <div
                        className="my-0.5 w-0.5"
                        style={{ height: 28, background: step.status === 'completed' ? '#34d399' : 'rgba(0,0,0,0.08)' }}
                      />
                    )}
                  </div>
                  <div className="min-w-0 pb-3">
                    <p className={cn('text-[12px] font-semibold', step.status === 'pending' ? TEXT.muted : TEXT.strong)}>
                      {step.label}
                    </p>
                    <p className={cn('text-[11px]', TEXT.muted)}>{step.description}</p>
                    {step.formattedDate && <p className={cn('text-[10px]', TEXT.muted)}>{step.formattedDate}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── BottomSheet validation ────────────────────────── */}
      <BottomSheet open={showValidateConfirm} onClose={() => setShowValidateConfirm(false)} title="Valider ce dépôt">
        <div className="space-y-4">
          <div className={cn('space-y-2 rounded-2xl p-3', SURFACE.canvas)}>
            <div className="flex items-center justify-between text-[13px]">
              <span className={TEXT.muted}>Montant déclaré</span>
              <span className={cn('font-semibold tabular-nums', TEXT.strong)}>{formatCurrency(deposit.amount_xaf)}</span>
            </div>
            <FormField label="Montant confirmé (XAF)" htmlFor="confirmed-amount-v2">
              <TextInput
                id="confirmed-amount-v2"
                inputMode="decimal"
                enterKeyHint="done"
                value={confirmedAmount}
                onChange={(e) => setConfirmedAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                className="font-bold"
              />
            </FormField>
          </div>
          {amountDiffers && (
            <div className="flex items-start gap-2 rounded-2xl bg-[#F8EFD8] p-3 dark:bg-[#372D14]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#9A6B12] dark:text-[#E7C083]" />
              <p className="text-[13px] text-[#9A6B12] dark:text-[#E7C083]">
                Le montant confirmé ({formatCurrency(confirmedAmountNum)}) diffère du montant déclaré.
              </p>
            </div>
          )}
          <div className="rounded-2xl bg-[#DEEFE5] p-4 dark:bg-[#1E3A2C]">
            <p className="text-[13px] text-[#2E7D52] dark:text-[#7FCBA0]">
              Le wallet sera crédité de <strong>{formatCurrency(confirmedAmountNum || deposit.amount_xaf)}</strong>
            </p>
            {wallet && (
              <p className="mt-1 text-[12px] text-[#2E7D52] dark:text-[#7FCBA0]">
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
              className={cn('w-full resize-none rounded-2xl p-3 text-[16px] outline-none transition', SURFACE.card, SURFACE.shadow, TEXT.strong, 'placeholder:text-[#9B98AD] focus:ring-2 focus:ring-[#C9C2F0] dark:focus:ring-[#4A4660]')}
            />
          </FormField>
          <button
            type="button"
            onClick={() => setSendNotification(!sendNotification)}
            className={cn('flex w-full items-center justify-between rounded-2xl p-3', SURFACE.canvas)}
          >
            <div className="flex items-center gap-2">
              {sendNotification ? (
                <Bell className="h-4 w-4 text-[#5B4CC4] dark:text-[#B5AAF0]" />
              ) : (
                <BellOff className={cn('h-4 w-4', TEXT.muted)} />
              )}
              <span className={cn('text-[13px]', TEXT.strong)}>Notifier le client</span>
            </div>
            <span
              className={cn(
                'relative h-6 w-10 rounded-full transition-colors',
                sendNotification ? 'bg-[#10B981]' : 'bg-black/15 dark:bg-white/15',
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
              disabled={confirmedAmountNum <= 0}
              className="flex-1 bg-[#10B981] text-white dark:bg-[#10B981] dark:text-white"
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
            <AlertTriangle className="h-5 w-5 text-[#C0504D] dark:text-[#E79A9A]" />
            Refuser ce dépôt
          </span>
        }
      >
        <div className="space-y-4">
          <div>
            <p className={cn('mb-2 text-[13px]', TEXT.muted)}>Motif du refus</p>
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
                    'w-full rounded-2xl p-3 text-left text-[13px] transition-all ring-1',
                    rejectionCategory === reason
                      ? 'bg-[#FBE7E7] text-[#C0504D] ring-[#C0504D]/40 dark:bg-[#3A2526] dark:text-[#E79A9A]'
                      : cn(SURFACE.card, 'ring-black/[0.06] dark:ring-white/[0.06]', TEXT.strong),
                  )}
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>
          <FormField
            label={<>Message client <span className="text-[#C0504D]">*</span></>}
          >
            <textarea
              value={clientMessage}
              onChange={(e) => setClientMessage(e.target.value)}
              rows={2}
              placeholder="Expliquez au client pourquoi son dépôt est refusé..."
              className={cn('w-full resize-none rounded-2xl p-3 text-[16px] outline-none transition', SURFACE.card, SURFACE.shadow, TEXT.strong, 'placeholder:text-[#9B98AD] focus:ring-2 focus:ring-[#C9C2F0] dark:focus:ring-[#4A4660]')}
            />
            <p className={cn('mt-1 text-[10px]', TEXT.muted)}>Ce message sera visible par le client</p>
          </FormField>
          <FormField label="Note interne (optionnel)">
            <textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              enterKeyHint="done"
              rows={2}
              placeholder="Note visible uniquement par les admins..."
              className={cn('w-full resize-none rounded-2xl p-3 text-[16px] outline-none transition', SURFACE.card, SURFACE.shadow, TEXT.strong, 'placeholder:text-[#9B98AD] focus:ring-2 focus:ring-[#C9C2F0] dark:focus:ring-[#4A4660]')}
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
          <div className="rounded-2xl border-2 border-dashed border-black/10 p-6 text-center dark:border-white/10">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              id="proof-upload-v2"
            />
            <label htmlFor="proof-upload-v2" className="flex cursor-pointer flex-col items-center gap-2">
              <Holder icon={Plus} />
              <p className={cn('text-[13px]', TEXT.muted)}>Choisir des fichiers</p>
              <p className={cn('text-[12px]', TEXT.muted)}>JPG, PNG ou PDF</p>
            </label>
          </div>
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              {selectedFiles.map((file, i) => (
                <div key={i} className={cn('flex items-center gap-2 rounded-xl p-2 text-[13px]', SURFACE.canvas)}>
                  <FileText className={cn('h-4 w-4 shrink-0', TEXT.muted)} />
                  <span className={cn('flex-1 truncate', TEXT.strong)}>{file.name}</span>
                  <span className={cn('shrink-0 text-[12px]', TEXT.muted)}>{(file.size / 1024).toFixed(0)} Ko</span>
                </div>
              ))}
            </div>
          )}
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
            <Trash2 className="h-5 w-5 text-[#C0504D] dark:text-[#E79A9A]" />
            Supprimer cette preuve ?
          </span>
        }
      >
        <div className="space-y-4">
          <p className={cn('text-[13px]', TEXT.muted)}>Cette action est irréversible.</p>
          <div className="space-y-2">
            {PROOF_DELETE_REASONS.map((reason) => (
              <button
                key={reason}
                onClick={() => setDeleteProofReason(reason)}
                className={cn(
                  'w-full rounded-2xl p-3 text-left text-[13px] transition-all ring-1',
                  deleteProofReason === reason
                    ? 'bg-[#FBE7E7] text-[#C0504D] ring-[#C0504D]/40 dark:bg-[#3A2526] dark:text-[#E79A9A]'
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
              className={cn('w-full resize-none rounded-2xl p-3 text-[16px] outline-none transition', SURFACE.card, SURFACE.shadow, TEXT.strong, 'placeholder:text-[#9B98AD] focus:ring-2 focus:ring-[#C9C2F0] dark:focus:ring-[#4A4660]')}
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
            <Trash2 className="h-5 w-5 text-[#C0504D] dark:text-[#E79A9A]" />
            Annuler ce dépôt ?
          </span>
        }
      >
        <div className="space-y-4">
          <p className={cn('text-[13px]', TEXT.muted)}>
            Voulez-vous annuler ce dépôt ? Le dépôt sera marqué comme annulé et le solde sera ajusté si nécessaire.
          </p>
          <div className={cn('text-center text-[13px]', TEXT.muted)}>
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
