/**
 * Desktop admin — deposit detail as a real desktop panel (the archetype's
 * split-detail surface, docs/admin-redesign 02-foundation §2B/§3).
 *
 * Replaces the mobile fiche previously squeezed into the aside. Same data
 * layer and mutations as MobileDepositDetailV2; the presentation is built for
 * 560px: pinned verdict header (ONE primary, status-aware), verdict zone that
 * puts the proof beside the amount it must match, facts grid, open timeline,
 * centered dialogs instead of bottom-sheets.
 *
 * Fixes the audit's permission gap: every action is gated on
 * hasPermission('canProcessDeposits'), not on status alone.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  useCancelDeposit,
} from '@/hooks/useAdminDeposits';
import { DEPOSIT_STATUS_LABELS, DEPOSIT_METHOD_LABELS_SHORT, REJECTION_REASONS, PROOF_DELETE_REASONS } from '@/types/deposit';
import { buildDepositTimelineSteps, getDepositSlaLevel } from '@/lib/depositTimeline';
import { getFamilyFromMethod } from '@/lib/depositsList';
import { formatCurrency } from '@/lib/formatters';
import { MIN_DEPOSIT_XAF, isValidXafAmount, xafAmountError } from '@/lib/amountLimits';
import { cn } from '@/lib/utils';
import {
  SURFACE,
  TEXT,
  SOFT_PILL,
  depositStatusTone,
  StatusPill,
  Holder,
  TextInput,
  FormField,
  PrimaryPill,
  SoftPill,
  MIcon,
  Age,
  SecLabel,
  KV,
  RefChip,
  CenterDialog,
  EMERALD_PILL,
  DANGER_SOFT_PILL,
  absShort,
} from '@/desktop/designKit';
import {
  Loader2,
  FileText,
  CheckCircle,
  AlertTriangle,
  Bell,
  BellOff,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Download,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { downloadPDF } from '@/lib/pdf/downloadPDF';
import { DepositReceiptPDF, type DepositReceiptData } from '@/lib/pdf/templates/DepositReceiptPDF';
import { PasteDropZone } from '@/components/upload/PasteDropZone';
import { FilePreviewGrid } from '@/components/upload/FilePreviewGrid';
import { usePasteFiles } from '@/hooks/usePasteFiles';
import { partitionUploadFiles, rejectionMessage, ACCEPT_UPLOAD } from '@/lib/clipboardFiles';

function fmt(n: number) {
  return Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function TimelineStep({
  label,
  meta,
  state,
  last,
}: {
  label: string;
  meta?: string;
  state: 'completed' | 'current' | 'pending';
  last?: boolean;
}) {
  return (
    <div className="flex gap-2.5">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
            state === 'completed'
              ? 'border-[#34d399] bg-[#DEEFE5] text-[#2E7D52] dark:bg-[#1E3A2C] dark:text-[#7FCBA0]'
              : state === 'current'
                ? 'border-[#7C3AED] text-[#7C3AED]'
                : cn('border-black/[0.12] dark:border-white/[0.15]', TEXT.muted),
          )}
        >
          {state === 'completed' && <CheckCircle className="h-3 w-3" />}
          {state === 'current' && <span className="h-2 w-2 rounded-full bg-current" />}
        </div>
        {!last && (
          <div
            className="my-0.5 w-0.5"
            style={{ height: 8, background: state === 'completed' ? '#34d399' : 'rgba(0,0,0,0.08)' }}
          />
        )}
      </div>
      <div className="flex min-w-0 flex-1 items-baseline justify-between gap-2 pb-0.5">
        <p className={cn('text-[12px] font-semibold', state === 'pending' ? TEXT.muted : TEXT.strong)}>{label}</p>
        {meta && <p className={cn('shrink-0 text-[11px] tabular-nums', TEXT.muted)}>{meta}</p>}
      </div>
    </div>
  );
}

export function DesktopDepositPanel({ depositId }: { depositId: string }) {
  const navigate = useNavigate();
  const { currentUser, hasPermission } = useAdminAuth();
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const { data: deposit, isLoading } = useAdminDepositDetail(depositId);
  const { data: proofs } = useAdminDepositProofs(depositId);
  const { data: timeline } = useAdminDepositTimeline(depositId);
  const { data: wallet } = useAdminWalletByUserId(deposit?.user_id);

  const validateDeposit = useValidateDeposit();
  const rejectDeposit = useRejectDeposit();
  const startReview = useStartDepositReview();
  const uploadProofs = useAdminUploadProofs();
  const deleteProof = useAdminDeleteProof();
  const cancelDeposit = useCancelDeposit();

  const [proofIndex, setProofIndex] = useState(0);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [confirmedAmount, setConfirmedAmount] = useState('');
  const [adminComment, setAdminComment] = useState('');
  const [sendNotification, setSendNotification] = useState(true);
  const [showValidate, setShowValidate] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectionCategory, setRejectionCategory] = useState('');
  const [clientMessage, setClientMessage] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [deleteProofId, setDeleteProofId] = useState<string | null>(null);
  const [deleteProofReason, setDeleteProofReason] = useState('');
  const [customDeleteReason, setCustomDeleteReason] = useState('');
  const [replaceProofId, setReplaceProofId] = useState<string | null>(null);
  const replaceFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (deposit) setConfirmedAmount(deposit.amount_xaf.toString());
    setProofIndex(0);
  }, [deposit?.id, deposit]);

  // Quick actions from the table row open the matching dialog directly.
  const [searchParams, setSearchParams] = useSearchParams();
  const pendingAction = searchParams.get('action');
  useEffect(() => {
    if (!deposit || !pendingAction) return;
    const locked = ['validated', 'rejected', 'cancelled', 'cancelled_by_admin'].includes(deposit.status);
    if (!locked && hasPermission('canProcessDeposits')) {
      if (pendingAction === 'validate') setShowValidate(true);
      if (pendingAction === 'reject') setShowReject(true);
    }
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deposit?.id, pendingAction]);

  const close = useCallback(() => navigate('/m/deposits'), [navigate]);

  const canProcess = hasPermission('canProcessDeposits');
  const isLocked = !deposit || ['validated', 'rejected', 'cancelled', 'cancelled_by_admin'].includes(deposit.status);
  const canValidate = canProcess && !isLocked;
  const canReject = canProcess && !isLocked;
  const canStartReview = canProcess && deposit?.status === 'proof_submitted';

  // Ctrl+V anywhere on the panel stages a proof (same affordance as the fiche).
  const addSelectedFiles = useCallback((files: File[]) => {
    setSelectedFiles((prev) => [...prev, ...files]);
  }, []);
  usePasteFiles({
    onFiles: useCallback(
      (files: File[]) => {
        setShowUpload(true);
        addSelectedFiles(files);
      },
      [addSelectedFiles],
    ),
    enabled: canProcess && !isLocked && !showReject && !showValidate && !showCancel && !lightbox,
  });

  const confirmedAmountNum = Number(confirmedAmount) || 0;
  const confirmedAmountValid = isValidXafAmount(confirmedAmountNum, MIN_DEPOSIT_XAF);
  const amountDiffers = !!deposit && confirmedAmountNum > 0 && confirmedAmountNum !== deposit.amount_xaf;

  const handleValidate = useCallback(() => {
    if (!deposit) return;
    const problem = xafAmountError(confirmedAmountNum, MIN_DEPOSIT_XAF, 'Le montant confirmé');
    if (problem) {
      toast.error(problem);
      return;
    }
    validateDeposit.mutate(
      {
        depositId,
        adminComment: adminComment || undefined,
        confirmedAmount: confirmedAmountNum !== deposit.amount_xaf ? confirmedAmountNum : undefined,
        sendNotification,
      },
      { onSuccess: () => setShowValidate(false) },
    );
  }, [deposit, depositId, confirmedAmountNum, adminComment, sendNotification, validateDeposit]);

  const handleReject = useCallback(() => {
    if (!rejectionCategory || !clientMessage.trim()) return;
    rejectDeposit.mutate(
      { depositId, reason: clientMessage, rejectionCategory, adminNote: adminNote || undefined },
      {
        onSuccess: () => {
          setShowReject(false);
          setRejectionCategory('');
          setClientMessage('');
          setAdminNote('');
        },
      },
    );
  }, [depositId, rejectionCategory, clientMessage, adminNote, rejectDeposit]);

  const handleDeleteProof = useCallback(() => {
    if (!deleteProofId) return;
    const reason = deleteProofReason === 'Autre' ? customDeleteReason : deleteProofReason;
    if (!reason) return;
    deleteProof.mutate(
      { proofId: deleteProofId, depositId, reason },
      {
        onSuccess: () => {
          setDeleteProofId(null);
          setDeleteProofReason('');
          setCustomDeleteReason('');
          setProofIndex(0);
        },
      },
    );
  }, [deleteProofId, depositId, deleteProofReason, customDeleteReason, deleteProof]);

  // Remplacement : upload de la nouvelle version PUIS suppression tracée de
  // l'ancienne (même séquence que la fiche mobile — jamais l'inverse).
  const handleReplaceFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const picked = e.target.files?.[0];
      if (replaceFileRef.current) replaceFileRef.current.value = '';
      if (!picked || !replaceProofId || !deposit) return;
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
            deleteProof.mutate({ proofId: oldProofId, depositId, reason: 'Remplacée par une nouvelle version' });
          },
        },
      );
    },
    [replaceProofId, deposit, depositId, uploadProofs, deleteProof],
  );

  const handleUpload = useCallback(() => {
    if (!deposit || selectedFiles.length === 0) return;
    uploadProofs.mutate(
      { depositId, userId: deposit.user_id, files: selectedFiles, depositStatus: deposit.status },
      {
        onSuccess: () => {
          setShowUpload(false);
          setSelectedFiles([]);
        },
      },
    );
  }, [deposit, depositId, selectedFiles, uploadProofs]);

  const handleReceipt = useCallback(async () => {
    if (!deposit || isGeneratingPDF) return;
    setIsGeneratingPDF(true);
    try {
      const clientName = deposit.profiles ? `${deposit.profiles.first_name} ${deposit.profiles.last_name}` : 'Client';
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
    } catch {
      toast.error('Erreur lors de la génération du PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  }, [deposit, isGeneratingPDF]);

  const panelClasses = cn(
    'flex w-[560px] shrink-0 flex-col overflow-hidden rounded-[24px]',
    SURFACE.card,
    'ring-1 ring-black/[0.06] dark:ring-white/[0.06]',
  );

  if (isLoading || !deposit) {
    return (
      <aside className={panelClasses}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16">
          {isLoading ? (
            <Loader2 className={cn('h-6 w-6 animate-spin', TEXT.muted)} />
          ) : (
            <>
              <Holder icon={AlertTriangle} tone="danger" size="lg" />
              <p className={cn('text-[13px]', TEXT.muted)}>Dépôt introuvable</p>
            </>
          )}
        </div>
      </aside>
    );
  }

  const clientName = deposit.profiles ? `${deposit.profiles.first_name} ${deposit.profiles.last_name}` : 'Client inconnu';
  const slaLevel = getDepositSlaLevel(deposit.created_at, deposit.status);
  const family = getFamilyFromMethod(deposit.method);
  const methodShort = DEPOSIT_METHOD_LABELS_SHORT[deposit.method] || deposit.method;
  const timelineSteps = buildDepositTimelineSteps(deposit.status, deposit.method, timeline || []);
  const proof = proofs?.[proofIndex];
  const proofIsImage = proof?.file_type?.startsWith('image/');

  return (
    <aside className={panelClasses}>
      {/* ── En-tête épinglé : identité + LE verdict ─────────────────────── */}
      <div className="flex items-center gap-2 border-b border-black/[0.06] px-4 py-2.5 dark:border-white/[0.06]">
        <RefChip>{deposit.reference}</RefChip>
        <StatusPill tone={depositStatusTone(deposit.status)} label={DEPOSIT_STATUS_LABELS[deposit.status] || deposit.status} />
        {slaLevel && <Age date={deposit.created_at} level={slaLevel} relOnly />}
        <div className="ml-auto flex items-center gap-1.5">
          {canStartReview ? (
            <button
              type="button"
              onClick={() => startReview.mutate({ depositId })}
              disabled={startReview.isPending}
              className="flex items-center gap-1 rounded-full bg-[#7C3AED] px-3.5 py-2 text-[12px] font-bold text-white disabled:opacity-60"
            >
              {startReview.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              Vérifier
            </button>
          ) : (
            canValidate && (
              <button
                type="button"
                onClick={() => setShowValidate(true)}
                className={cn('px-3.5 py-2 text-[12px]', EMERALD_PILL)}
              >
                Valider
              </button>
            )
          )}
          {canReject && (
            <button type="button" onClick={() => setShowReject(true)} className={cn('px-3.5 py-2 text-[12px]', DANGER_SOFT_PILL)}>
              Rejeter
            </button>
          )}
          <div className="relative">
            <Holder icon={MoreHorizontal} size="sm" onClick={() => setMenuOpen((v) => !v)} ariaLabel="Plus d'actions" />
            {menuOpen && (
              <div
                className={cn(
                  'absolute right-0 top-[calc(100%+6px)] z-40 min-w-[210px] overflow-hidden rounded-2xl p-1.5',
                  SURFACE.card,
                  'ring-1 ring-black/[0.10] dark:ring-white/[0.10]',
                )}
              >
                {canStartReview && canValidate && (
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); setShowValidate(true); }}
                    className={cn('flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] font-semibold', TEXT.strong, 'hover:bg-[#EDEAFA]/50 dark:hover:bg-white/[0.05]')}
                  >
                    <CheckCircle className="h-3.5 w-3.5" /> Valider sans vérification
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); handleReceipt(); }}
                  className={cn('flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] font-semibold', TEXT.strong, 'hover:bg-[#EDEAFA]/50 dark:hover:bg-white/[0.05]')}
                >
                  {isGeneratingPDF ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                  Relevé PDF
                </button>
                {canProcess && !isLocked && (
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); setShowUpload(true); }}
                    className={cn('flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] font-semibold', TEXT.strong, 'hover:bg-[#EDEAFA]/50 dark:hover:bg-white/[0.05]')}
                  >
                    <Plus className="h-3.5 w-3.5" /> Ajouter une preuve
                  </button>
                )}
                {isSuperAdmin && !isLocked && (
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); setShowCancel(true); }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] font-semibold text-[#C0504D] hover:bg-[#FBE7E7]/60 dark:text-[#E79A9A] dark:hover:bg-[#3A2526]/60"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Annuler le dépôt
                  </button>
                )}
              </div>
            )}
          </div>
          <Holder icon={X} size="sm" onClick={close} ariaLabel="Fermer" />
        </div>
      </div>

      {/* ── Contenu ─────────────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3.5">
        {/* Zone de verdict : la preuve à côté des montants qu'elle doit prouver */}
        <div className="grid grid-cols-[244px_1fr] items-start gap-3">
          <div>
            <SecLabel
              className="mb-2"
              right={
                proofs && proofs.length > 0 ? (
                  <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold', TEXT.muted)}>
                    {proof?.uploaded_by_type === 'admin' ? 'Admin' : 'Client'}
                    {proof && ` · ${absShort(proof.uploaded_at)}`}
                    <button type="button" disabled={proofIndex <= 0} onClick={() => setProofIndex((i) => i - 1)} className="disabled:opacity-30">
                      <ChevronLeft className="ml-1 h-3 w-3" />
                    </button>
                    {proofIndex + 1}/{proofs.length}
                    <button
                      type="button"
                      disabled={proofIndex >= proofs.length - 1}
                      onClick={() => setProofIndex((i) => i + 1)}
                      className="disabled:opacity-30"
                    >
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </span>
                ) : undefined
              }
            >
              Preuves · {proofs?.length ?? 0}
            </SecLabel>

            {proof ? (
              <>
                <div className="overflow-hidden rounded-2xl ring-1 ring-black/[0.06] dark:ring-white/[0.06]">
                  {proofIsImage && proof.signedUrl ? (
                    <img src={proof.signedUrl} alt={proof.file_name} className="max-h-[260px] w-full bg-black/5 object-contain dark:bg-white/5" />
                  ) : (
                    <div className={cn('flex h-[160px] w-full flex-col items-center justify-center gap-1.5', SURFACE.canvas)}>
                      <FileText className={cn('h-8 w-8', TEXT.muted)} />
                      <span className={cn('max-w-full truncate px-3 text-[11px] font-bold', TEXT.muted)}>{proof.file_name}</span>
                    </div>
                  )}
                </div>
                <div className="mt-2 flex gap-1.5">
                  <button
                    type="button"
                    disabled={!proofIsImage || !proof.signedUrl}
                    onClick={() => proof.signedUrl && setLightbox(proof.signedUrl)}
                    className={cn('flex h-8 flex-1 items-center justify-center gap-1 rounded-lg text-[10px] font-semibold disabled:opacity-40', SOFT_PILL)}
                  >
                    <Maximize2 className="h-3 w-3" /> Agrandir
                  </button>
                  <a
                    href={proof.signedUrl ?? undefined}
                    download={proof.file_name}
                    className={cn('flex h-8 flex-1 items-center justify-center gap-1 rounded-lg text-[10px] font-semibold no-underline', SOFT_PILL, !proof.signedUrl && 'pointer-events-none opacity-40')}
                  >
                    <Download className="h-3 w-3" /> Télécharger
                  </a>
                </div>
                {canProcess && !isLocked && (
                  <div className="mt-1.5 flex gap-1.5">
                    <button
                      type="button"
                      disabled={uploadProofs.isPending}
                      onClick={() => {
                        setReplaceProofId(proof.id);
                        replaceFileRef.current?.click();
                      }}
                      className={cn('flex h-8 flex-1 items-center justify-center gap-1 rounded-lg text-[10px] font-semibold disabled:opacity-40', SOFT_PILL)}
                    >
                      <RefreshCw className="h-3 w-3" /> Remplacer
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteProofId(proof.id)}
                      className="flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-[#FBE7E7] text-[10px] font-semibold text-[#C0504D] dark:bg-[#3A2526] dark:text-[#E79A9A]"
                    >
                      <Trash2 className="h-3 w-3" /> Supprimer
                    </button>
                  </div>
                )}
                <input ref={replaceFileRef} type="file" accept={ACCEPT_UPLOAD} onChange={handleReplaceFileSelect} className="hidden" />
              </>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-black/10 p-4 text-center dark:border-white/10">
                <div className={cn('text-[12px] font-bold', TEXT.muted)}>Preuve manquante</div>
                <div className={cn('mt-0.5 text-[11px]', TEXT.muted)}>Le client doit envoyer un justificatif</div>
                {canProcess && !isLocked && (
                  <button
                    type="button"
                    onClick={() => setShowUpload(true)}
                    className="mx-auto mt-2 flex items-center gap-1 rounded-full bg-[#DEEFE5] px-3 py-1.5 text-[11px] font-bold text-[#2E7D52] dark:bg-[#1E3A2C] dark:text-[#7FCBA0]"
                  >
                    <Plus className="h-3 w-3" /> Ajouter (Ctrl+V)
                  </button>
                )}
              </div>
            )}
          </div>

          <div className={cn('rounded-2xl p-3', SURFACE.canvas)}>
            <SecLabel>Vérification du montant</SecLabel>
            <div className="mt-2 flex items-center justify-between text-[13px]">
              <span className={TEXT.muted}>Montant déclaré</span>
              <span className={cn('font-semibold tabular-nums', TEXT.strong)}>{formatCurrency(deposit.amount_xaf)}</span>
            </div>
            {deposit.confirmed_amount_xaf && deposit.confirmed_amount_xaf !== deposit.amount_xaf && (
              <div className="mt-1 flex items-center justify-between text-[13px]">
                <span className={TEXT.muted}>Montant crédité</span>
                <span className="font-bold tabular-nums text-[#2E7D52] dark:text-[#7FCBA0]">
                  {formatCurrency(deposit.confirmed_amount_xaf)}
                </span>
              </div>
            )}
            {canValidate && (
              <FormField label="Montant confirmé (XAF)" className="mt-1.5" htmlFor="dd-confirmed">
                <TextInput
                  id="dd-confirmed"
                  inputMode="numeric"
                  value={confirmedAmount ? fmt(Number(confirmedAmount)) : ''}
                  onChange={(e) => setConfirmedAmount(e.target.value.replace(/[^0-9]/g, ''))}
                  className="h-10 font-bold tabular-nums"
                />
              </FormField>
            )}
            <div className="mt-2.5 border-t border-black/[0.06] pt-2 dark:border-white/[0.08]">
              <div className="flex items-center justify-between text-[12px]">
                <span className={cn('inline-flex items-center gap-1', TEXT.muted)}>
                  <Wallet className="h-3 w-3" /> Solde wallet
                </span>
                <span className={cn('font-semibold tabular-nums', TEXT.strong)}>{wallet ? fmt(wallet.balance_xaf) : '—'}</span>
              </div>
              {canValidate && wallet && (
                <div className="mt-1 flex items-center justify-between text-[12px]">
                  <span className={TEXT.muted}>Après validation</span>
                  <span className="font-bold tabular-nums text-[#2E7D52] dark:text-[#7FCBA0]">
                    {fmt(wallet.balance_xaf + (confirmedAmountNum || deposit.amount_xaf))}
                  </span>
                </div>
              )}
            </div>
            {amountDiffers && (
              <div className="mt-2 flex items-start gap-1.5 rounded-xl bg-[#F8EFD8] p-2 dark:bg-[#372D14]">
                <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-[#9A6B12] dark:text-[#E7C083]" />
                <p className="text-[11px] leading-[15px] text-[#9A6B12] dark:text-[#E7C083]">
                  Diffère du montant déclaré — le wallet sera crédité de {formatCurrency(confirmedAmountNum)}.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Faits */}
        <div className="mt-3 grid grid-cols-3 gap-x-4 gap-y-2 border-t border-black/[0.06] pt-3 dark:border-white/[0.06]">
          <KV
            k="Client"
            v={
              <button type="button" onClick={() => navigate(`/m/clients/${deposit.user_id}`)} className="text-[#6B5BD2] dark:text-[#A99BF0]">
                {clientName}
              </button>
            }
          />
          <KV k="Téléphone" v={deposit.profiles?.phone || '—'} />
          <KV k="Société" v={deposit.profiles?.company_name || '—'} />
          <KV
            k="Méthode"
            v={
              <span className="inline-flex items-center gap-1.5">
                <MIcon family={family} size={18} /> {methodShort}
              </span>
            }
          />
          <KV k={deposit.bank_name ? 'Banque' : deposit.agency_name ? 'Agence' : 'Créé le'} v={deposit.bank_name || deposit.agency_name || format(new Date(deposit.created_at), 'd MMM, HH:mm', { locale: fr })} />
          {(deposit.bank_name || deposit.agency_name) && (
            <KV k="Créé le" v={format(new Date(deposit.created_at), 'd MMM, HH:mm', { locale: fr })} />
          )}
        </div>

        {/* Note interne */}
        {deposit.admin_comment && (
          <div className={cn('mt-3 flex items-baseline gap-2.5 rounded-2xl px-3 py-2', SURFACE.canvas)}>
            <span className={cn('shrink-0 text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>Note interne</span>
            <p className={cn('truncate text-[12.5px]', TEXT.strong)}>{deposit.admin_comment}</p>
          </div>
        )}

        {/* Suivi — ouvert */}
        <div className="mt-3 border-t border-black/[0.06] pt-2.5 dark:border-white/[0.06]">
          <SecLabel className="mb-1.5">Suivi</SecLabel>
          {timelineSteps.map((step, i) => (
            <TimelineStep
              key={step.id}
              state={step.status}
              label={step.label}
              meta={step.formattedDate ?? undefined}
              last={i === timelineSteps.length - 1}
            />
          ))}
        </div>
      </div>

      {/* ── Dialogue : valider ──────────────────────────────────────────── */}
      <CenterDialog
        open={showValidate}
        onClose={() => setShowValidate(false)}
        onConfirm={confirmedAmountValid && !validateDeposit.isPending ? handleValidate : undefined}
        title={`Valider le dépôt ${deposit.reference}`}
        footer={
          <>
            <SoftPill onClick={() => setShowValidate(false)} className="flex-1">
              Annuler
            </SoftPill>
            <PrimaryPill
              onClick={handleValidate}
              loading={validateDeposit.isPending}
              disabled={!confirmedAmountValid}
              className="flex-[1.4] bg-[#10B981] text-white dark:bg-[#10B981] dark:text-white"
            >
              Créditer {formatCurrency(confirmedAmountNum || deposit.amount_xaf)}
            </PrimaryPill>
          </>
        }
      >
        <div className="space-y-4">
          <div className={cn('space-y-2 rounded-2xl p-3', SURFACE.canvas)}>
            <div className="flex items-center justify-between text-[13px]">
              <span className={TEXT.muted}>Montant déclaré</span>
              <span className={cn('font-semibold tabular-nums', TEXT.strong)}>{formatCurrency(deposit.amount_xaf)}</span>
            </div>
            <FormField label="Montant confirmé (XAF)" htmlFor="dd-confirmed-dialog">
              <TextInput
                id="dd-confirmed-dialog"
                inputMode="numeric"
                value={confirmedAmount ? fmt(Number(confirmedAmount)) : ''}
                onChange={(e) => setConfirmedAmount(e.target.value.replace(/[^0-9]/g, ''))}
                className="font-bold tabular-nums"
              />
            </FormField>
          </div>
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
              rows={2}
              placeholder="Commentaire visible uniquement par les admins…"
              className={cn('w-full resize-none rounded-2xl p-3 text-[14px] outline-none', SURFACE.canvas, TEXT.strong, 'placeholder:text-[#9B98AD] focus:ring-2 focus:ring-[#C9C2F0] dark:focus:ring-[#4A4660]')}
            />
          </FormField>
          <button
            type="button"
            onClick={() => setSendNotification(!sendNotification)}
            className={cn('flex w-full items-center justify-between rounded-2xl p-3', SURFACE.canvas)}
          >
            <span className={cn('inline-flex items-center gap-2 text-[13px]', TEXT.strong)}>
              {sendNotification ? <Bell className="h-4 w-4 text-[#5B4CC4] dark:text-[#B5AAF0]" /> : <BellOff className={cn('h-4 w-4', TEXT.muted)} />}
              Notifier le client
            </span>
            <span className={cn('relative h-6 w-10 rounded-full transition-colors', sendNotification ? 'bg-[#10B981]' : 'bg-black/15 dark:bg-white/15')}>
              <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white ring-1 ring-black/[0.10] transition-all', sendNotification ? 'left-[18px]' : 'left-0.5')} />
            </span>
          </button>
          <p className={cn('text-center text-[11px]', TEXT.muted)}>⌘⏎ pour confirmer · Esc pour annuler</p>
        </div>
      </CenterDialog>

      {/* ── Dialogue : rejeter ──────────────────────────────────────────── */}
      <CenterDialog
        open={showReject}
        onClose={() => setShowReject(false)}
        onConfirm={rejectionCategory && clientMessage.trim() && !rejectDeposit.isPending ? handleReject : undefined}
        title={`Refuser le dépôt ${deposit.reference}`}
        footer={
          <>
            <SoftPill onClick={() => setShowReject(false)} className="flex-1">
              Annuler
            </SoftPill>
            <PrimaryPill
              onClick={handleReject}
              loading={rejectDeposit.isPending}
              disabled={!rejectionCategory || !clientMessage.trim()}
              danger
              className="flex-[1.4]"
            >
              Confirmer le refus
            </PrimaryPill>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <SecLabel className="mb-2">Motif du refus</SecLabel>
            <div className="grid grid-cols-2 gap-1.5">
              {REJECTION_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => {
                    setRejectionCategory(reason);
                    if (!clientMessage.trim()) setClientMessage(`Votre dépôt a été refusé : ${reason.toLowerCase()}.`);
                  }}
                  className={cn(
                    'rounded-xl px-3 py-2 text-left text-[12.5px] font-semibold ring-1 transition-colors',
                    rejectionCategory === reason
                      ? 'bg-[#FBE7E7] text-[#C0504D] ring-[#C0504D]/40 dark:bg-[#3A2526] dark:text-[#E79A9A]'
                      : cn(SURFACE.canvas, 'ring-transparent', TEXT.strong),
                  )}
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>
          <FormField label={<>Message client <span className="text-[#C0504D]">*</span></>} hint="Ce message sera visible par le client">
            <textarea
              value={clientMessage}
              onChange={(e) => setClientMessage(e.target.value)}
              rows={2}
              placeholder="Expliquez au client pourquoi son dépôt est refusé…"
              className={cn('w-full resize-none rounded-2xl p-3 text-[14px] outline-none', SURFACE.canvas, TEXT.strong, 'placeholder:text-[#9B98AD] focus:ring-2 focus:ring-[#C9C2F0] dark:focus:ring-[#4A4660]')}
            />
          </FormField>
          <FormField label="Note interne (optionnel)">
            <textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              rows={2}
              placeholder="Note visible uniquement par les admins…"
              className={cn('w-full resize-none rounded-2xl p-3 text-[14px] outline-none', SURFACE.canvas, TEXT.strong, 'placeholder:text-[#9B98AD] focus:ring-2 focus:ring-[#C9C2F0] dark:focus:ring-[#4A4660]')}
            />
          </FormField>
        </div>
      </CenterDialog>

      {/* ── Dialogue : ajouter des preuves ──────────────────────────────── */}
      <CenterDialog
        open={showUpload}
        onClose={() => {
          setShowUpload(false);
          setSelectedFiles([]);
        }}
        onConfirm={selectedFiles.length > 0 && !uploadProofs.isPending ? handleUpload : undefined}
        title="Ajouter une preuve"
        footer={
          <>
            <SoftPill
              onClick={() => {
                setShowUpload(false);
                setSelectedFiles([]);
              }}
              className="flex-1"
            >
              Annuler
            </SoftPill>
            <PrimaryPill onClick={handleUpload} loading={uploadProofs.isPending} disabled={selectedFiles.length === 0} className="flex-1">
              Ajouter ({selectedFiles.length})
            </PrimaryPill>
          </>
        }
      >
        <div className="space-y-4">
          <PasteDropZone onFiles={addSelectedFiles} enabled={false} busy={uploadProofs.isPending} />
          <FilePreviewGrid files={selectedFiles} onRemove={(i) => setSelectedFiles((prev) => prev.filter((_, idx) => idx !== i))} />
        </div>
      </CenterDialog>

      {/* ── Dialogue : annuler (super admin) ────────────────────────────── */}
      <CenterDialog
        open={showCancel}
        onClose={() => setShowCancel(false)}
        title={`Annuler le dépôt ${deposit.reference} ?`}
        footer={
          <>
            <SoftPill onClick={() => setShowCancel(false)} className="flex-1">
              Retour
            </SoftPill>
            <PrimaryPill
              onClick={() => cancelDeposit.mutate({ depositId }, { onSuccess: close })}
              loading={cancelDeposit.isPending}
              danger
              className="flex-[1.4]"
            >
              Confirmer l'annulation
            </PrimaryPill>
          </>
        }
      >
        <p className={cn('text-[13px]', TEXT.muted)}>
          Le dépôt sera marqué comme annulé et le solde ajusté si nécessaire. {clientName} — {fmt(deposit.amount_xaf)} XAF.
        </p>
      </CenterDialog>

      {/* ── Dialogue : supprimer une preuve (motif obligatoire, tracé) ──── */}
      <CenterDialog
        open={!!deleteProofId}
        onClose={() => {
          setDeleteProofId(null);
          setDeleteProofReason('');
          setCustomDeleteReason('');
        }}
        onConfirm={
          deleteProofReason && (deleteProofReason !== 'Autre' || customDeleteReason) && !deleteProof.isPending
            ? handleDeleteProof
            : undefined
        }
        title="Supprimer cette preuve ?"
        footer={
          <>
            <SoftPill
              onClick={() => {
                setDeleteProofId(null);
                setDeleteProofReason('');
                setCustomDeleteReason('');
              }}
              className="flex-1"
            >
              Annuler
            </SoftPill>
            <PrimaryPill
              onClick={handleDeleteProof}
              loading={deleteProof.isPending}
              disabled={!deleteProofReason || (deleteProofReason === 'Autre' && !customDeleteReason)}
              danger
              className="flex-[1.4]"
            >
              Supprimer
            </PrimaryPill>
          </>
        }
      >
        <div className="space-y-4">
          <p className={cn('text-[13px]', TEXT.muted)}>Cette action est irréversible et journalisée avec son motif.</p>
          <div className="grid grid-cols-2 gap-1.5">
            {PROOF_DELETE_REASONS.map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() => setDeleteProofReason(reason)}
                className={cn(
                  'rounded-xl px-3 py-2 text-left text-[12.5px] font-semibold ring-1 transition-colors',
                  deleteProofReason === reason
                    ? 'bg-[#FBE7E7] text-[#C0504D] ring-[#C0504D]/40 dark:bg-[#3A2526] dark:text-[#E79A9A]'
                    : cn(SURFACE.canvas, 'ring-transparent', TEXT.strong),
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
              placeholder="Précisez le motif…"
              className={cn('w-full resize-none rounded-2xl p-3 text-[14px] outline-none', SURFACE.canvas, TEXT.strong, 'placeholder:text-[#9B98AD] focus:ring-2 focus:ring-[#C9C2F0] dark:focus:ring-[#4A4660]')}
            />
          )}
        </div>
      </CenterDialog>

      {/* ── Visionneuse plein écran ─────────────────────────────────────── */}
      {lightbox && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black" onClick={() => setLightbox(null)}>
          <button
            type="button"
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/20"
            onClick={() => setLightbox(null)}
            aria-label="Fermer"
          >
            <X className="h-6 w-6 text-white" />
          </button>
          <img src={lightbox} className="max-h-full max-w-full object-contain p-4" onClick={(e) => e.stopPropagation()} alt="Preuve" />
        </div>
      )}
    </aside>
  );
}
