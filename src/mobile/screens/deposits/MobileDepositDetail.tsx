// ============================================================
// MODULE DEPOTS — MobileDepositDetail (Premium Rebuild)
// Admin deposit command center: status banner, amount hero,
// horizontal proof gallery, glass action bar, bottom sheets
// ============================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import {
  useAdminDepositDetail,
  useAdminDepositProofs,
  useAdminDepositTimeline,
  useAdminWalletByUserId,
  useValidateDeposit,
  useRejectDeposit,
  useRequestCorrection,
  useStartDepositReview,
  useAdminUploadProofs,
  useAdminDeleteProof,
} from '@/hooks/useAdminDeposits';
import {
  DEPOSIT_STATUS_LABELS,
  DEPOSIT_METHOD_LABELS,
  DEPOSIT_STATUS_COLORS,
  REJECTION_REASONS,
  PROOF_DELETE_REASONS,
} from '@/types/deposit';
import { buildDepositTimelineSteps, getStepColors, getDepositSlaLevel } from '@/lib/depositTimeline';
import { formatXAF, formatCurrency, formatRelativeDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Loader2,
  User,
  Banknote,
  Clock,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Image as ImageIcon,
  Download,
  Eye,
  Wallet,
  Phone,
  Lock,
  Plus,
  Trash2,
  X,
  ExternalLink,
  Bell,
  BellOff,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { SkeletonDetail } from '@/mobile/components/ui/SkeletonCard';

// ── Status banner color map ─────────────────────────────────

const STATUS_BANNER_COLORS: Record<string, string> = {
  created: 'from-gray-500/10 to-gray-500/5 border-gray-500/20',
  awaiting_proof: 'from-yellow-500/10 to-yellow-500/5 border-yellow-500/20',
  proof_submitted: 'from-blue-500/10 to-blue-500/5 border-blue-500/20',
  admin_review: 'from-purple-500/10 to-purple-500/5 border-purple-500/20',
  pending_correction: 'from-orange-500/10 to-orange-500/5 border-orange-500/20',
  validated: 'from-green-500/10 to-green-500/5 border-green-500/20',
  rejected: 'from-red-500/10 to-red-500/5 border-red-500/20',
};

export function MobileDepositDetail() {
  const { depositId } = useParams<{ depositId: string }>();
  const navigate = useNavigate();
  const { data: deposit, isLoading } = useAdminDepositDetail(depositId);
  const { data: proofs } = useAdminDepositProofs(depositId);
  const { data: timeline } = useAdminDepositTimeline(depositId);
  const { data: wallet } = useAdminWalletByUserId(deposit?.user_id);

  const validateDeposit = useValidateDeposit();
  const rejectDeposit = useRejectDeposit();
  const requestCorrection = useRequestCorrection();
  const startReview = useStartDepositReview();
  const uploadProofs = useAdminUploadProofs();
  const deleteProof = useAdminDeleteProof();

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

  // Proof management state (signed URLs now come from the proofs query directly)
  const [viewingProof, setViewingProof] = useState<string | null>(null);
  const [showUploadSheet, setShowUploadSheet] = useState(false);
  const [showDeleteProofSheet, setShowDeleteProofSheet] = useState<string | null>(null);
  const [deleteProofReason, setDeleteProofReason] = useState('');
  const [customDeleteReason, setCustomDeleteReason] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // Details expandable
  const [showDetails, setShowDetails] = useState(false);

  // Initialize confirmed amount when deposit loads
  useEffect(() => {
    if (deposit) {
      setConfirmedAmount(deposit.amount_xaf.toString());
    }
  }, [deposit]);

  const timelineSteps = buildDepositTimelineSteps(
    deposit?.status || 'created',
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
    if (files) {
      setSelectedFiles(Array.from(files));
    }
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
      {
        proofId: showDeleteProofSheet,
        depositId,
        reason,
      },
      {
        onSuccess: () => {
          setShowDeleteProofSheet(null);
          setDeleteProofReason('');
          setCustomDeleteReason('');
        },
      },
    );
  }, [showDeleteProofSheet, depositId, deleteProofReason, customDeleteReason, deleteProof]);

  // ── Loading / Error ─────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-full">
        <MobileHeader title="Détail du dépôt" showBack />
        <SkeletonDetail />
      </div>
    );
  }

  if (!deposit) {
    return (
      <div className="flex flex-col min-h-full">
        <MobileHeader title="Détail du dépôt" showBack />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Dépôt introuvable
        </div>
      </div>
    );
  }

  // ── Computed values ─────────────────────────────────────────

  const clientName = deposit.profiles
    ? `${deposit.profiles.first_name} ${deposit.profiles.last_name}`
    : 'Client inconnu';
  const isLocked = ['validated', 'rejected'].includes(deposit.status);
  const canValidate = !isLocked;
  const canReject = !isLocked;
  const canStartReview = deposit.status === 'proof_submitted';
  const hasProofs = proofs && proofs.length > 0;
  const canAddProof = !isLocked;
  const confirmedAmountNum = Number(confirmedAmount) || 0;
  const amountDiffers = confirmedAmountNum !== deposit.amount_xaf && confirmedAmountNum > 0;
  const slaLevel = getDepositSlaLevel(deposit.created_at, deposit.status);
  const bannerColor = STATUS_BANNER_COLORS[deposit.status] || STATUS_BANNER_COLORS.created;

  return (
    <div className="flex flex-col min-h-full pb-32">
      <MobileHeader title={deposit.reference} showBack />

      <div className="flex-1 px-4 py-4 space-y-4">
        {/* ── Status Banner ──────────────────────────────────── */}
        <div className={cn('bg-gradient-to-r rounded-2xl p-4 border', bannerColor)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'px-3 py-1 rounded-full text-sm font-medium',
                  DEPOSIT_STATUS_COLORS[deposit.status],
                )}
              >
                {DEPOSIT_STATUS_LABELS[deposit.status]}
              </span>
              {isLocked && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="w-3 h-3" />
                </span>
              )}
              {slaLevel && (
                <span className={cn(
                  'sla-dot',
                  slaLevel === 'fresh' && 'sla-fresh',
                  slaLevel === 'aging' && 'sla-aging',
                  slaLevel === 'overdue' && 'sla-overdue animate',
                )} />
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {formatRelativeDate(deposit.created_at)}
            </span>
          </div>
        </div>

        {/* ── Amount Hero Card ────────────────────────────────── */}
        <div className="bg-card rounded-2xl p-5 border border-border text-center space-y-2">
          <p className="text-xs text-muted-foreground">Montant déclaré</p>
          <p className="amount-hero">{formatXAF(deposit.amount_xaf)}</p>
          <p className="text-sm text-muted-foreground">XAF</p>

          {deposit.confirmed_amount_xaf && deposit.confirmed_amount_xaf !== deposit.amount_xaf && (
            <div className="flex items-center justify-center gap-2 pt-2 border-t border-border mt-3">
              <span className="text-sm text-muted-foreground line-through">{formatXAF(deposit.amount_xaf)}</span>
              <ArrowRight className="w-4 h-4 text-green-600" />
              <span className="text-sm font-bold text-green-600">{formatXAF(deposit.confirmed_amount_xaf)}</span>
              <span className="text-xs text-green-600">crédité</span>
            </div>
          )}

          <div className="flex items-center justify-center gap-2 pt-2">
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {DEPOSIT_METHOD_LABELS[deposit.method]}
            </span>
            {deposit.bank_name && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                {deposit.bank_name}
              </span>
            )}
            {deposit.agency_name && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                {deposit.agency_name}
              </span>
            )}
          </div>
        </div>

        {/* ── Client Info Card ────────────────────────────────── */}
        <div className="bg-card rounded-2xl p-4 border space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold">{clientName}</p>
              {deposit.profiles?.phone && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {deposit.profiles.phone}
                </p>
              )}
              {deposit.profiles?.company_name && (
                <p className="text-xs text-muted-foreground">{deposit.profiles.company_name}</p>
              )}
            </div>
            <button
              onClick={() => navigate(`/m/clients/${deposit.user_id}`)}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted active:scale-95 transition-transform"
              title="Ouvrir profil client"
            >
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          {wallet && (
            <div className="flex items-center gap-2 pt-2 border-t">
              <Wallet className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Solde actuel:</span>
              <span className="text-sm font-bold">{formatCurrency(wallet.balance_xaf)}</span>
            </div>
          )}
        </div>

        {/* ── Proofs Section (horizontal scroll) ──────────────── */}
        <div className="bg-card rounded-2xl p-4 border space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Preuves ({proofs?.length || 0})
            </h3>
            {canAddProof && (
              <button
                onClick={() => setShowUploadSheet(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium active:scale-95 transition-transform"
              >
                <Plus className="w-3.5 h-3.5" />
                Ajouter
              </button>
            )}
          </div>

          {/* Warning when no proofs and can validate */}
          {!hasProofs && canValidate && (
            <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-xl p-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
              <span className="text-sm text-yellow-700 dark:text-yellow-400">
                Preuve manquante - validation impossible
              </span>
            </div>
          )}

          {hasProofs ? (
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
              {proofs!.map((proof) => {
                const signedUrl = proof.signedUrl;
                const isImage = proof.file_type?.startsWith('image/');
                return (
                  <div
                    key={proof.id}
                    className="proof-thumb flex-shrink-0 w-28 h-28"
                  >
                    {isImage && signedUrl ? (
                      <img
                        src={signedUrl}
                        alt={proof.file_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2">
                        <FileText className="w-7 h-7 text-muted-foreground" />
                        <span className="text-[9px] text-muted-foreground truncate w-full text-center">
                          {proof.file_name}
                        </span>
                      </div>
                    )}

                    {/* Metadata badge */}
                    <div className="absolute top-1 left-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded">
                      {proof.uploaded_by_type === 'admin' ? 'Admin' : 'Client'}
                    </div>

                    {/* Date badge */}
                    <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded">
                      {format(new Date(proof.uploaded_at), 'dd/MM HH:mm', { locale: fr })}
                    </div>

                    {/* Action buttons */}
                    <div className="absolute top-1 right-1 flex flex-col gap-1">
                      {signedUrl && (
                        <>
                          <button
                            onClick={() => setViewingProof(signedUrl)}
                            className="w-6 h-6 rounded-full bg-black/60 flex items-center justify-center"
                          >
                            <Eye className="w-3 h-3 text-white" />
                          </button>
                          <a
                            href={signedUrl}
                            download={proof.file_name}
                            className="w-6 h-6 rounded-full bg-black/60 flex items-center justify-center"
                          >
                            <Download className="w-3 h-3 text-white" />
                          </a>
                        </>
                      )}
                      {!isLocked && (
                        <button
                          onClick={() => setShowDeleteProofSheet(proof.id)}
                          className="w-6 h-6 rounded-full bg-red-600/80 flex items-center justify-center"
                        >
                          <Trash2 className="w-3 h-3 text-white" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            !canValidate && (
              <p className="text-sm text-muted-foreground text-center py-4">Aucune preuve</p>
            )
          )}
        </div>

        {/* ── Deposit Details Card (expandable) ───────────────── */}
        <div className="bg-card rounded-2xl border overflow-hidden">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between p-4 text-left"
          >
            <h3 className="font-semibold flex items-center gap-2">
              <Banknote className="w-4 h-4" />
              Détails du dépôt
            </h3>
            {showDetails ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>

          {showDetails && (
            <div className="px-4 pb-4 space-y-3 border-t pt-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Référence</p>
                  <p className="font-mono text-xs mt-0.5">{deposit.reference}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Méthode</p>
                  <p className="font-medium text-xs mt-0.5">{DEPOSIT_METHOD_LABELS[deposit.method]}</p>
                </div>
                {deposit.bank_name && (
                  <div>
                    <p className="text-muted-foreground text-xs">Banque</p>
                    <p className="font-medium text-xs mt-0.5">{deposit.bank_name}</p>
                  </div>
                )}
                {deposit.agency_name && (
                  <div>
                    <p className="text-muted-foreground text-xs">Agence</p>
                    <p className="font-medium text-xs mt-0.5">{deposit.agency_name}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground text-xs">Créé le</p>
                  <p className="text-xs mt-0.5">{format(new Date(deposit.created_at), 'dd MMM yyyy, HH:mm', { locale: fr })}</p>
                </div>
              </div>

              {deposit.admin_comment && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">Commentaire admin</p>
                  <p className="text-sm mt-0.5">{deposit.admin_comment}</p>
                </div>
              )}

              {deposit.rejection_reason && (
                <div className="pt-2 border-t bg-red-50 dark:bg-red-950/30 -mx-4 px-4 pb-2 rounded-b-xl">
                  <p className="text-xs text-red-600 font-medium">Motif du rejet</p>
                  {deposit.rejection_category && (
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400 mb-1">
                      {deposit.rejection_category}
                    </span>
                  )}
                  <p className="text-sm text-red-700 dark:text-red-400">{deposit.rejection_reason}</p>
                </div>
              )}

              {deposit.admin_internal_note && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">Note interne admin</p>
                  <p className="text-sm italic text-muted-foreground mt-0.5">{deposit.admin_internal_note}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Timeline Card ───────────────────────────────────── */}
        <div className="bg-card rounded-2xl p-4 border space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Timeline
          </h3>
          <div className="space-y-0">
            {timelineSteps.map((step, index) => (
              <div key={step.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                      getStepColors(step.key, step.status),
                    )}
                  >
                    {step.status === 'completed' && <CheckCircle className="w-3.5 h-3.5" />}
                    {step.status === 'current' && (
                      <div className="w-2 h-2 rounded-full bg-current" />
                    )}
                  </div>
                  {index < timelineSteps.length - 1 && (
                    <div
                      className={cn(
                        'w-0.5 h-8 my-1',
                        step.status === 'completed' ? 'bg-primary' : 'bg-muted',
                      )}
                    />
                  )}
                </div>
                <div className="pb-4 min-w-0">
                  <p
                    className={cn(
                      'text-sm font-medium',
                      step.status === 'pending' && 'text-muted-foreground',
                    )}
                  >
                    {step.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                  {step.formattedDate && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {step.formattedDate}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Glass Sticky Action Bar ──────────────────────────── */}
      {(canValidate || canReject || canStartReview) && (
        <div className="glass-action-bar bottom-16 space-y-2">
          {canStartReview && (
            <button
              onClick={handleStartReview}
              disabled={startReview.isPending}
              className="w-full h-12 rounded-xl bg-purple-600 text-white font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              {startReview.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
              Commencer la vérification
            </button>
          )}

          {canValidate && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowRejectSheet(true)}
                className="flex-1 h-12 rounded-xl border-2 border-red-500 text-red-600 font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                <XCircle className="w-4 h-4" />
                Rejeter
              </button>
              <button
                onClick={() => {
                  setConfirmedAmount(deposit.amount_xaf.toString());
                  setShowValidateConfirm(true);
                }}
                className="flex-1 h-12 rounded-xl bg-green-600 text-white font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                <CheckCircle className="w-4 h-4" />
                Valider
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Validate confirmation bottom sheet ─────────────────── */}
      {showValidateConfirm && (
        <div className="bottom-sheet-overlay" onClick={() => setShowValidateConfirm(false)}>
          <div
            className="bottom-sheet-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 pb-0">
              <h3 className="text-lg font-bold">Valider ce dépôt</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-6 pt-4 space-y-4">
              {/* Amount recap */}
              <div className="bg-muted rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Montant déclaré</span>
                  <span className="font-medium">{formatCurrency(deposit.amount_xaf)}</span>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Montant confirmé (XAF)</label>
                  <input
                    type="number"
                    value={confirmedAmount}
                    onChange={(e) => setConfirmedAmount(e.target.value)}
                    className="w-full mt-1 p-3 rounded-xl border bg-background text-sm font-bold text-lg"
                    min={0}
                  />
                </div>
              </div>

              {/* Warning if amount differs */}
              {amountDiffers && (
                <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-xl p-3 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">
                    Le montant confirmé ({formatCurrency(confirmedAmountNum)}) diffère du montant déclaré.
                  </p>
                </div>
              )}

              {/* Credit preview */}
              <div className="bg-green-50 dark:bg-green-950/30 rounded-xl p-4 border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-700 dark:text-green-400">
                  Le wallet sera crédité de{' '}
                  <strong>{formatCurrency(confirmedAmountNum || deposit.amount_xaf)}</strong>
                </p>
                {wallet && (
                  <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                    Nouveau solde estimé :{' '}
                    {formatCurrency(wallet.balance_xaf + (confirmedAmountNum || deposit.amount_xaf))}
                  </p>
                )}
              </div>

              {/* Admin comment */}
              <div>
                <label className="text-sm text-muted-foreground">Note interne (optionnel)</label>
                <textarea
                  value={adminComment}
                  onChange={(e) => setAdminComment(e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border bg-muted text-sm resize-none"
                  rows={2}
                  placeholder="Commentaire visible uniquement par les admins..."
                />
              </div>

              {/* Notification toggle */}
              <label className="flex items-center justify-between p-3 rounded-xl border cursor-pointer">
                <div className="flex items-center gap-2">
                  {sendNotification ? (
                    <Bell className="w-4 h-4 text-primary" />
                  ) : (
                    <BellOff className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className="text-sm">Notifier le client</span>
                </div>
                <input
                  type="checkbox"
                  checked={sendNotification}
                  onChange={(e) => setSendNotification(e.target.checked)}
                  className="w-5 h-5 rounded accent-primary"
                />
              </label>
            </div>

            {/* Sticky buttons */}
            <div className="px-6 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] border-t flex gap-2">
              <button
                onClick={() => setShowValidateConfirm(false)}
                className="flex-1 h-12 rounded-xl border text-sm font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleValidate}
                disabled={validateDeposit.isPending || confirmedAmountNum <= 0}
                className="flex-1 h-12 rounded-xl bg-green-600 text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {validateDeposit.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirmer la validation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject bottom sheet ────────────────────────────────── */}
      {showRejectSheet && (
        <div className="bottom-sheet-overlay" onClick={() => setShowRejectSheet(false)}>
          <div
            className="bottom-sheet-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 pb-0">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Refuser ce dépôt
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-6 pt-4 space-y-4">
              {/* Section 1: Rejection category */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">Motif du refus</p>
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
                        'w-full p-3 rounded-xl border text-left text-sm transition-all',
                        rejectionCategory === reason
                          ? 'border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400'
                          : 'border-border hover:border-muted-foreground',
                      )}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>

              {/* Section 2: Client-visible message */}
              <div>
                <label className="text-sm text-muted-foreground">
                  Message client <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={clientMessage}
                  onChange={(e) => setClientMessage(e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border bg-muted text-sm resize-none"
                  rows={2}
                  placeholder="Expliquez au client pourquoi son dépôt est refusé..."
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Ce message sera visible par le client
                </p>
              </div>

              {/* Section 3: Internal admin note */}
              <div>
                <label className="text-sm text-muted-foreground">Note interne (optionnel)</label>
                <textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border bg-muted text-sm resize-none"
                  rows={2}
                  placeholder="Note visible uniquement par les admins..."
                />
              </div>
            </div>

            {/* Sticky buttons */}
            <div className="px-6 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] border-t flex gap-2">
              <button
                onClick={() => {
                  setShowRejectSheet(false);
                  setRejectionCategory('');
                  setClientMessage('');
                  setAdminNote('');
                }}
                className="flex-1 h-12 rounded-xl border text-sm font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleReject}
                disabled={
                  rejectDeposit.isPending ||
                  !rejectionCategory ||
                  !clientMessage.trim()
                }
                className="flex-1 h-12 rounded-xl bg-red-600 text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {rejectDeposit.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirmer le refus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Upload proof bottom sheet ──────────────────────────── */}
      {showUploadSheet && (
        <div className="bottom-sheet-overlay" onClick={() => setShowUploadSheet(false)}>
          <div
            className="bottom-sheet-content p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold">Ajouter une preuve</h3>

            <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                id="proof-upload"
              />
              <label
                htmlFor="proof-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <Plus className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Choisir des fichiers
                </p>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG ou PDF
                </p>
              </label>
            </div>

            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                {selectedFiles.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted text-sm">
                    <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="truncate flex-1">{file.name}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {(file.size / 1024).toFixed(0)} Ko
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowUploadSheet(false);
                  setSelectedFiles([]);
                }}
                className="flex-1 h-12 rounded-xl border text-sm font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleUploadProofs}
                disabled={uploadProofs.isPending || selectedFiles.length === 0}
                className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {uploadProofs.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Ajouter ({selectedFiles.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete proof confirmation bottom sheet ─────────────── */}
      {showDeleteProofSheet && (
        <div className="bottom-sheet-overlay" onClick={() => setShowDeleteProofSheet(null)}>
          <div
            className="bottom-sheet-content p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              Supprimer cette preuve ?
            </h3>
            <p className="text-sm text-muted-foreground">Cette action est irréversible.</p>

            <div className="space-y-2">
              {PROOF_DELETE_REASONS.map((reason) => (
                <button
                  key={reason}
                  onClick={() => setDeleteProofReason(reason)}
                  className={cn(
                    'w-full p-3 rounded-xl border text-left text-sm transition-all',
                    deleteProofReason === reason
                      ? 'border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400'
                      : 'border-border hover:border-muted-foreground',
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
                className="w-full p-3 rounded-xl border bg-muted text-sm resize-none"
                rows={2}
                placeholder="Précisez le motif..."
              />
            )}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowDeleteProofSheet(null);
                  setDeleteProofReason('');
                  setCustomDeleteReason('');
                }}
                className="flex-1 h-12 rounded-xl border text-sm font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteProof}
                disabled={
                  deleteProof.isPending ||
                  !deleteProofReason ||
                  (deleteProofReason === 'Autre' && !customDeleteReason)
                }
                className="flex-1 h-12 rounded-xl bg-red-600 text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {deleteProof.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Full-screen proof viewer ───────────────────────────── */}
      {viewingProof && (
        <div
          className="fixed inset-0 z-[70] bg-black flex items-center justify-center"
          onClick={() => setViewingProof(null)}
        >
          <button
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
            onClick={() => setViewingProof(null)}
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <img
            src={viewingProof}
            className="max-w-full max-h-full object-contain p-4"
            onClick={(e) => e.stopPropagation()}
            alt="Preuve"
          />
        </div>
      )}
    </div>
  );
}
