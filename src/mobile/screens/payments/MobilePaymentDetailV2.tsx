// ============================================================
// MODULE PAIEMENTS — MobilePaymentDetail V2
// Le paiement en phrases : combien · qui · comment · quand, puis le
//   bénéficiaire (à copier d'un geste), la preuve ou la signature, la
//   décision. Le détail est replié. Rien sous 16 px, rien de tronqué.
// Logique métier 100% préservée de l'ancienne version :
//   bénéficiaire éditable inline (Alipay/WeChat/Virement), QR, preuves
//   upload/delete, signature cash, reject (catégories + message client),
//   complete, annulation, taux XAF/CNY, relevé PDF.
// ============================================================
import { useState, useRef, useMemo, useCallback } from 'react';
import { useOnScreen } from '@/hooks/useOnScreen';
import { DecisionDock } from '@/mobile/components/layout/DecisionDock';
import { useParams, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { compressImage } from '@/lib/imageCompression';
import { toStoredPath } from '@/lib/signedUrls';
import {
  useAdminPaymentDetail,
  useAdminPaymentTimeline,
  useAdminPaymentProofs,
  useProcessPayment,
  useAdminUploadPaymentProof,
} from '@/hooks/usePayments';
import {
  useDeletePayment,
  useDeletePaymentProof,
  useAdminUpdateBeneficiaryInfo,
} from '@/hooks/useAdminPayments';
import { useAdminUploadPaymentInstruction } from '@/hooks/usePaymentProofUpload';
import { useAgentConfirmCashPayment } from '@/hooks/useAgentCashActions';
import {
  PAYMENT_STATUS_CONFIG,
  PAYMENT_METHOD_LABELS,
  PAYMENT_REJECTION_REASONS,
} from '@/types/payment';
import type { PaymentStatus, PaymentMethod } from '@/types/payment';
import { cn, validateUploadFile } from '@/lib/utils';
import {
  SURFACE,
  TEXT,
  paymentStatusTone,
  StatusPill,
  Card,
  Button,
  SectionTitle,
  Line,
  Fold,
  SOFT_PILL,
  PrimaryPill,
  SoftPill,
  BottomSheet,
  FormField,
  TextInput,
  TextArea,
  FOCUS_RING,
} from '@/mobile/designKit';
import { PaymentMethodLogo } from '@/mobile/components/payments/PaymentMethodLogo';
import { formatCurrency, formatCurrencyRMB, formatNumber } from '@/lib/formatters';
import { getPaymentSlaLevel } from '@/lib/paymentSla';
import { whenSentence, sinceSentence } from '@/lib/plainTime';
import { SignatureCanvas } from '@/components/cash/SignatureCanvas';
import { CashQRCode } from '@/components/cash/CashQRCode';
import { CashReceiptDownloadButton } from '@/components/cash/CashReceiptDownloadButton';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/clipboard';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  CheckCircle,
  XCircle,
  Play,
  X,
  AlertTriangle,
  Download,
  QrCode,
  Trash2,
  ChevronLeft,
  Copy,
  Eye,
  Plus,
} from 'lucide-react';
import { SkeletonDetail } from '@/mobile/components/ui/SkeletonCard';
import { PasteDropZone } from '@/components/upload/PasteDropZone';
import { usePasteFiles } from '@/hooks/usePasteFiles';
import { partitionUploadFiles, rejectionMessage, ACCEPT_UPLOAD, ACCEPT_IMAGE } from '@/lib/clipboardFiles';
import { downloadPDF } from '@/lib/pdf/downloadPDF';
import { PaymentReceiptPDF } from '@/lib/pdf/templates/PaymentReceiptPDF';
import type { PaymentReceiptData } from '@/lib/pdf/templates/PaymentReceiptPDF';

// Map méthode DB → logo (PaymentMethodLogo n'accepte que 4 clés).
function logoMethod(method: string): 'alipay' | 'wechat' | 'bank_transfer' | 'cash' {
  if (method === 'alipay' || method === 'wechat' || method === 'cash') return method;
  return 'bank_transfer';
}

// ── En-tête simple (back + titre + action) — réutilisé loading/error ──
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

// ── CopyRow : étiquette + valeur, un appui copie ────────────
function CopyRow({ label, value, mono, multiline }: { label: string; value: string; mono?: boolean; multiline?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => copyToClipboard(value, label)}
      aria-label={`Copier : ${label}`}
      className="flex w-full items-start justify-between gap-3 py-2.5 text-left transition active:opacity-70"
    >
      <div className="min-w-0 flex-1">
        <p className={cn('text-[16px] leading-snug', TEXT.muted)}>{label}</p>
        <p className={cn('text-[16px] font-semibold leading-snug', mono && 'tabular-nums tracking-wide', multiline ? 'whitespace-pre-wrap break-words' : 'break-words', TEXT.strong)}>
          {value}
        </p>
      </div>
      <Copy className={cn('mt-1 h-5 w-5 shrink-0', TEXT.muted)} />
    </button>
  );
}

// ── Textarea au gabarit kit ──────────────────────────────────

// ─────────────────────────────────────────────────────────────
export function MobilePaymentDetail() {
  const { paymentId } = useParams();
  const navigate      = useNavigate();
  const { hasPermission, currentUser } = useAdminAuth();
  const isSuperAdmin = currentUser?.role === 'super_admin';

  // ── Data hooks ────────────────────────────────────────────
  const { data: payment, isLoading } = useAdminPaymentDetail(paymentId);
  // Préchauffe le cache de la timeline (parité avec l'ancienne version).
  useAdminPaymentTimeline(paymentId);
  const { data: proofs }             = useAdminPaymentProofs(paymentId);

  // ── Mutation hooks ────────────────────────────────────────
  const processPayment           = useProcessPayment();
  const adminProofUpload         = useAdminUploadPaymentProof();
  const instructionUpload        = useAdminUploadPaymentInstruction();
  const adminUpdateBeneficiaryInfo = useAdminUpdateBeneficiaryInfo();
  const deletePayment            = useDeletePayment();
  const deletePaymentProof       = useDeletePaymentProof();
  const confirmCash              = useAgentConfirmCashPayment();

  // ── Derived proof lists ───────────────────────────────────
  const clientProofs = useMemo(
    () => proofs?.filter(p => p.uploaded_by_type !== 'admin') ?? [],
    [proofs],
  );
  const adminProofs = useMemo(
    () => proofs?.filter(p => p.uploaded_by_type === 'admin') ?? [],
    [proofs],
  );
  const instructionProofs = useMemo(
    () => proofs?.filter(p => p.uploaded_by_type === 'client' || p.uploaded_by_type === 'admin_instruction') ?? [],
    [proofs],
  );
  const allProofs = useMemo(
    () => [...adminProofs, ...instructionProofs],
    [adminProofs, instructionProofs],
  );

  // ── Drawer / modal states ─────────────────────────────────
  const [isRejectOpen,        setIsRejectOpen]        = useState(false);
  const [isCompleteOpen,      setIsCompleteOpen]       = useState(false);
  const [isDeletePaymentOpen, setIsDeletePaymentOpen]  = useState(false);
  const [proofToDelete,       setProofToDelete]        = useState<string | null>(null);
  const [fullscreenProof,     setFullscreenProof]      = useState<string | null>(null);
  const [isGeneratingPDF,     setIsGeneratingPDF]      = useState(false);
  const [showDetail,          setShowDetail]           = useState(false);
  // Le bouton principal de « La décision » est-il à l'écran ? (barre collante)
  const decision = useOnScreen();

  // ── Reject drawer ────────────────────────────────────────
  const [rejectionCategory, setRejectionCategory] = useState('');
  const [rejectReason,      setRejectReason]      = useState('');

  // ── Complete drawer ───────────────────────────────────────
  const [completeProofFile,    setCompleteProofFile]    = useState<File | null>(null);
  const [completeProofPreview, setCompleteProofPreview] = useState<string | null>(null);
  const proofInputRef = useRef<HTMLInputElement>(null);

  // ── Standalone proof upload ───────────────────────────────
  const standaloneProofRef  = useRef<HTMLInputElement>(null);
  const instructionInputRef = useRef<HTMLInputElement>(null);

  // ── Inline bénéficiaire edit ──────────────────────────────
  const [editBenef, setEditBenef] = useState(false);
  const [beneficiaryForm, setBeneficiaryForm] = useState({
    beneficiary_name:         '',
    beneficiary_phone:        '',
    beneficiary_email:        '',
    beneficiary_qr_code_url:  '',
    beneficiary_bank_name:    '',
    beneficiary_bank_account: '',
    beneficiary_bank_extra:   '',
    beneficiary_notes:        '',
    beneficiary_identifier:   '',
  });
  const [qrFile,       setQrFile]       = useState<File | null>(null);
  const [qrPreview,    setQrPreview]    = useState<string | null>(null);
  const [isUploadingQr,setIsUploadingQr]= useState(false);
  const [showQR,       setShowQR]       = useState(false);
  const qrInputRef = useRef<HTMLInputElement>(null);

  // ── Cash signature ────────────────────────────────────────
  const [signing, setSigning] = useState(false);

  // ─────────────────────────────────────────────────────────
  // Coller (Ctrl+V) — routé vers la zone active
  // ─────────────────────────────────────────────────────────
  // A screenshot pasted on this screen can mean three different things, so a
  // SINGLE window listener routes by what is currently open. Priority runs from
  // the most specific surface outwards; when a destructive sheet is up, paste
  // is off entirely rather than silently landing behind it.
  const isAlipayOrWechat = payment?.method === 'alipay' || payment?.method === 'wechat';
  const blockingSheetOpen =
    isRejectOpen || isDeletePaymentOpen || !!proofToDelete || !!fullscreenProof || signing;

  const pasteTarget: 'qr' | 'complete' | 'proof' | null =
    !payment || blockingSheetOpen
      ? null
      : editBenef && isAlipayOrWechat
        ? 'qr'
        : isCompleteOpen
          ? 'complete'
          : hasPermission('canProcessPayments') &&
              !['completed', 'rejected'].includes(payment.status) &&
              payment.method !== 'cash'
            ? 'proof'
            : null;

  const handlePastedFiles = useCallback(
    async (files: File[]) => {
      if (!paymentId) return;

      if (pasteTarget === 'qr') {
        const file = files[0];
        setQrFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setQrPreview(reader.result as string);
        reader.readAsDataURL(file);
        return;
      }

      if (pasteTarget === 'complete') {
        const file = files[0];
        setCompleteProofFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setCompleteProofPreview(reader.result as string);
        reader.readAsDataURL(file);
        return;
      }

      if (pasteTarget === 'proof') {
        // Upload straight away — the admin pasted it *because* it is the proof.
        // Sequential, not parallel: the storage helper retries on flaky mobile
        // networks and concurrent retries would fight over the same bucket.
        for (const file of files) {
          try {
            await adminProofUpload.mutateAsync({ paymentId, file });
          } catch {
            break; // the hook already toasted; stop rather than repeat the error
          }
        }
      }
    },
    [pasteTarget, paymentId, adminProofUpload],
  );

  usePasteFiles({
    onFiles: handlePastedFiles,
    enabled: pasteTarget !== null,
    single: pasteTarget === 'qr' || pasteTarget === 'complete',
  });

  // ─────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────

  const initBeneficiaryForm = () => {
    if (!payment) return;
    const p = payment as typeof payment & {
      beneficiary_bank_extra?: string | null;
      beneficiary_identifier?: string | null;
    };
    setBeneficiaryForm({
      beneficiary_name:         payment.beneficiary_name         || '',
      beneficiary_phone:        payment.beneficiary_phone        || '',
      beneficiary_email:        payment.beneficiary_email        || '',
      beneficiary_qr_code_url:  payment.beneficiary_qr_code_url  || '',
      beneficiary_bank_name:    payment.beneficiary_bank_name    || '',
      beneficiary_bank_account: payment.beneficiary_bank_account || '',
      beneficiary_bank_extra:   p.beneficiary_bank_extra         || '',
      beneficiary_notes:        payment.beneficiary_notes        || '',
      beneficiary_identifier:   p.beneficiary_identifier         || '',
    });
    setQrFile(null);
    setQrPreview(null);
  };

  const openEdit = () => {
    initBeneficiaryForm();
    setEditBenef(true);
  };

  const handleSaveBeneficiaryInfo = async () => {
    if (!payment || !paymentId) return;

    if (payment.method === 'alipay' || payment.method === 'wechat') {
      const hasContact = !!(beneficiaryForm.beneficiary_phone || beneficiaryForm.beneficiary_email);
      const hasQr      = !!(qrFile || beneficiaryForm.beneficiary_qr_code_url);
      if (!hasContact && !hasQr) {
        toast.error('Fournissez au moins un QR code, un téléphone ou un email');
        return;
      }
    } else if (payment.method === 'bank_transfer') {
      if (!beneficiaryForm.beneficiary_name)         { toast.error('Le nom du bénéficiaire est requis'); return; }
      if (!beneficiaryForm.beneficiary_bank_name)    { toast.error('Le nom de la banque est requis');    return; }
      if (!beneficiaryForm.beneficiary_bank_account) { toast.error('Le numéro de compte est requis');   return; }
    }

    try {
      // Normalize to the durable "<bucket>/<path>" form: never persist the
      // temporary signed URL that the detail hook injected for display.
      let qrUrl = toStoredPath(beneficiaryForm.beneficiary_qr_code_url) ?? '';

      if (qrFile && (payment.method === 'alipay' || payment.method === 'wechat')) {
        setIsUploadingQr(true);
        const compressed = await compressImage(qrFile);
        const filePath = `beneficiary/${paymentId}/${Date.now()}_${compressed.name}`;
        const { error: uploadError } = await supabaseAdmin.storage
          .from('payment-proofs')
          .upload(filePath, compressed, { upsert: true });
        if (uploadError) throw uploadError;
        qrUrl = `payment-proofs/${filePath}`;
      }

      const identifier = beneficiaryForm.beneficiary_identifier.trim();
      const isAlipayOrWechat =
        payment.method === 'alipay' || payment.method === 'wechat';

      await adminUpdateBeneficiaryInfo.mutateAsync({
        paymentId,
        beneficiaryInfo: {
          beneficiary_name:         beneficiaryForm.beneficiary_name         || undefined,
          beneficiary_phone:        beneficiaryForm.beneficiary_phone        || undefined,
          beneficiary_email:        beneficiaryForm.beneficiary_email        || undefined,
          beneficiary_qr_code_url:  qrUrl                                   || undefined,
          beneficiary_bank_name:    beneficiaryForm.beneficiary_bank_name    || undefined,
          beneficiary_bank_account: beneficiaryForm.beneficiary_bank_account || undefined,
          beneficiary_bank_extra:   beneficiaryForm.beneficiary_bank_extra   || undefined,
          beneficiary_notes:        beneficiaryForm.beneficiary_notes        || undefined,
          beneficiary_identifier:   identifier || undefined,
          beneficiary_identifier_type: isAlipayOrWechat && identifier ? 'id' : undefined,
        },
      });

      setEditBenef(false);
      setQrFile(null);
      setQrPreview(null);
    } catch {
      // Error handled by mutation
    } finally {
      setIsUploadingQr(false);
    }
  };

  const handleStartProcessing = async () => {
    if (!paymentId) return;
    try {
      await processPayment.mutateAsync({ paymentId, action: 'start_processing' });
      toast.success('Paiement marqué en cours');
    } catch { /* handled */ }
  };

  const handleComplete = async () => {
    if (!paymentId) return;
    try {
      if (completeProofFile) {
        await adminProofUpload.mutateAsync({ paymentId, file: completeProofFile });
      }
      await processPayment.mutateAsync({ paymentId, action: 'complete' });
      setIsCompleteOpen(false);
      setCompleteProofFile(null);
      setCompleteProofPreview(null);
      toast.success('Paiement terminé');
      navigate('/m/payments');
    } catch { /* handled */ }
  };

  const handleReject = async () => {
    if (!paymentId || !rejectReason.trim()) {
      toast.error('Veuillez indiquer un motif');
      return;
    }
    try {
      await processPayment.mutateAsync({ paymentId, action: 'reject', comment: rejectReason });
      setIsRejectOpen(false);
      setRejectionCategory('');
      setRejectReason('');
      toast.success('Paiement rejeté');
      navigate('/m/payments');
    } catch { /* handled */ }
  };

  const handleStandaloneProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    // Reset before the await: leaving the value set means re-picking the SAME
    // file later fires no `change` event at all.
    if (standaloneProofRef.current) standaloneProofRef.current.value = '';
    if (picked.length === 0 || !paymentId) return;

    const { accepted, rejected } = partitionUploadFiles(picked);
    const problem = rejectionMessage(rejected);
    if (problem) toast.error(problem);
    if (accepted.length === 0) return;

    try {
      await adminProofUpload.mutateAsync({ paymentId, file: accepted[0] });
      toast.success('Preuve ajoutée');
    } catch { /* handled */ }
  };

  const handleInstructionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (instructionInputRef.current) instructionInputRef.current.value = '';
    if (picked.length === 0 || !paymentId) return;

    // The instruction hook does no validation of its own, so a 40 MB PDF would
    // otherwise fail deep inside Storage with an opaque error.
    const { accepted, rejected } = partitionUploadFiles(picked);
    const problem = rejectionMessage(rejected);
    if (problem) toast.error(problem);
    if (accepted.length === 0) return;

    try {
      await instructionUpload.mutateAsync({ paymentId, files: accepted });
      toast.success(`${accepted.length} instruction(s) ajoutée(s)`);
    } catch { /* handled */ }
  };

  const handleCashSignature = async (signatureDataUrl: string) => {
    if (!paymentId) return;
    const signedByName = currentUser
      ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Admin'
      : 'Admin';
    try {
      const result = await confirmCash.mutateAsync({ paymentId, signatureDataUrl, signedByName });
      if (result?.success) {
        setSigning(false);
        toast.success('Signature enregistrée — paiement confirmé');
      } else {
        toast.error((result as { error?: string })?.error || 'Erreur lors de la confirmation');
      }
    } catch { /* handled by mutation */ }
  };

  const handleDownloadReceipt = async () => {
    if (!payment || isGeneratingPDF) return;
    setIsGeneratingPDF(true);
    try {
      const clientName = payment.profiles
        ? `${payment.profiles.first_name} ${payment.profiles.last_name}`
        : 'Client';

      const receiptData: PaymentReceiptData = {
        id:                      payment.id,
        reference:               payment.reference,
        created_at:              payment.created_at,
        processed_at:            payment.processed_at,
        amount_xaf:              payment.amount_xaf,
        amount_rmb:              payment.amount_rmb,
        exchange_rate:           payment.exchange_rate,
        method:                  payment.method,
        status:                  payment.status,
        client_name:             clientName,
        client_phone:            payment.profiles?.phone,
        beneficiary_name:        payment.beneficiary_name,
        beneficiary_phone:       payment.beneficiary_phone,
        beneficiary_email:       payment.beneficiary_email,
        beneficiary_bank_name:   payment.beneficiary_bank_name,
        beneficiary_bank_account:payment.beneficiary_bank_account,
        beneficiary_qr_code_url: payment.beneficiary_qr_code_url,
        adminProofs:             adminProofs.map(p => ({
          file_url:   p.file_url,
          file_type:  p.file_type,
          file_name:  p.file_name,
          created_at: p.created_at,
        })),
      };

      await downloadPDF(
        <PaymentReceiptPDF data={receiptData} />,
        `recu_paiement_${payment.reference}_${clientName.replace(/\s+/g, '_')}.pdf`,
      );
      toast.success('Relevé téléchargé');
    } catch (err) {
      console.error('PDF error:', err);
      toast.error('Erreur lors de la génération du PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  // Loading / not found
  // ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className={cn('flex min-h-screen flex-col', SURFACE.canvas)}>
        <DetailHeader title="Paiement" onBack={() => navigate('/m/payments')} />
        <SkeletonDetail />
      </div>
    );
  }

  if (!payment) {
    return (
      <div className={cn('flex min-h-screen flex-col', SURFACE.canvas)}>
        <DetailHeader title="Paiement" onBack={() => navigate('/m/payments')} />
        <div className="flex flex-1 items-center justify-center p-4">
          <p className={TEXT.muted}>Paiement non trouvé</p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // Derived display vars
  // ─────────────────────────────────────────────────────────
  const clientName = payment.profiles
    ? `${payment.profiles.first_name} ${payment.profiles.last_name}`
    : 'Client inconnu';

  const statusConfig = PAYMENT_STATUS_CONFIG[payment.status as PaymentStatus]
    || { label: payment.status };
  const methodLabel  = PAYMENT_METHOD_LABELS[payment.method as PaymentMethod] || payment.method;
  const slaLevel     = getPaymentSlaLevel(payment.created_at, payment.status);

  // Rétro-compat taux : anciens paiements stockent décimal (0.01153), admin stocke entier (11530)
  const rateInt = payment.exchange_rate
    ? (payment.exchange_rate < 1
        ? Math.round(payment.exchange_rate * 1_000_000)
        : Math.round(payment.exchange_rate))
    : 0;

  // Permissions
  const canProcess           = hasPermission('canProcessPayments');
  const isLocked             = ['completed', 'rejected', 'cancelled_by_admin'].includes(payment.status);
  const isCash               = payment.method === 'cash';
  const canStartProcessing   = canProcess && ['ready_for_payment', 'cash_scanned'].includes(payment.status);
  const canComplete          = canProcess && payment.status === 'processing';
  const canReject            = canProcess && !isLocked;
  const canDelete            = isSuperAdmin;
  const canEditBeneficiary   = canProcess && !isLocked &&
    ['created', 'waiting_beneficiary_info', 'ready_for_payment'].includes(payment.status);
  const canAddProof          = canProcess && !isLocked;
  const hasBeneficiaryInfo   = !!(
    payment.beneficiary_name || payment.beneficiary_bank_account ||
    payment.beneficiary_qr_code_url || payment.beneficiary_phone || payment.beneficiary_email
  );
  const missingBeneficiary   = !hasBeneficiaryInfo && !isCash &&
    !['completed', 'rejected', 'created'].includes(payment.status);
  const missingAdminProof    = payment.status === 'processing' && !isCash && adminProofs.length === 0;

  // Cash beneficiary display name
  const cashBeneficiaryName = (payment as { cash_beneficiary_type?: string | null; cash_beneficiary_first_name?: string | null; cash_beneficiary_last_name?: string | null }).cash_beneficiary_type === 'other'
    ? [
        (payment as { cash_beneficiary_first_name?: string | null }).cash_beneficiary_first_name,
        (payment as { cash_beneficiary_last_name?: string | null }).cash_beneficiary_last_name,
      ].filter(Boolean).join(' ') || clientName
    : clientName;
  const isCashSelf = (payment as { cash_beneficiary_type?: string | null }).cash_beneficiary_type !== 'other';

  // Le geste principal, s'il y en a un.
  const mainAction = canStartProcessing
    ? { label: 'Commencer le paiement', icon: <Play />, onClick: handleStartProcessing }
    : canComplete
    ? { label: 'Valider le paiement', icon: <CheckCircle />, onClick: () => setIsCompleteOpen(true) }
    : null;

  // Barre de décision collante : tant que le bouton principal se voit, elle
  // reste rangée ; elle se range aussi sous les feuilles basses.
  const sheetOpen = isRejectOpen || isCompleteOpen || isDeletePaymentOpen || !!proofToDelete || !!fullscreenProof;
  const dockShown = !!mainAction && !decision.onScreen && !sheetOpen;

  const cashPhone = (payment as { cash_beneficiary_phone?: string | null }).cash_beneficiary_phone;
  const signatureUrl = (payment as { cash_signature_url?: string | null }).cash_signature_url;
  const cashPaidAt = (payment as { cash_paid_at?: string | null }).cash_paid_at;
  const cashSignedBy = (payment as { cash_signed_by_name?: string | null }).cash_signed_by_name;
  const bankExtra = (payment as { beneficiary_bank_extra?: string | null }).beneficiary_bank_extra;
  const identifier = (payment as { beneficiary_identifier?: string | null }).beneficiary_identifier;

  const when = (iso: string) => format(new Date(iso), "d MMMM yyyy 'à' HH:mm", { locale: fr });
  const infoRows = [
    { l: 'Référence', v: payment.reference },
    { l: 'Méthode', v: methodLabel },
    { l: 'Montant en XAF', v: `${formatNumber(payment.amount_xaf)} XAF` },
    { l: 'Taux appliqué', v: `1 million XAF = ¥${formatNumber(rateInt)}` },
    { l: 'Client', v: payment.profiles?.phone ? `${clientName}, ${payment.profiles.phone}` : clientName },
    payment.profiles?.company_name ? { l: 'Entreprise', v: payment.profiles.company_name } : null,
    { l: 'Demandé le', v: when(payment.created_at) },
    payment.processed_at ? { l: 'Traité le', v: when(payment.processed_at) } : null,
    payment.balance_after != null ? { l: 'Solde du client après ce paiement', v: `${formatNumber(payment.balance_after)} XAF` } : null,
    payment.rejection_reason ? { l: 'Motif du refus', v: payment.rejection_reason } : null,
    payment.admin_comment ? { l: 'Commentaire', v: payment.admin_comment } : null,
  ].filter(Boolean) as { l: string; v: string }[];

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────
  return (
    <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
      {/* ── En-tête : ← Paiement + [Reçu] ────────────────── */}
      <DetailHeader
        title="Paiement"
        onBack={() => navigate('/m/payments')}
        right={
          <Button variant="neutral" onClick={handleDownloadReceipt} loading={isGeneratingPDF}>
            <Download />
            Reçu
          </Button>
        }
      />

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 pb-8 pt-2">
        {/* ── En une phrase : combien, qui, comment, quand ──── */}
        <section className="space-y-3">
          <div className="flex items-start gap-3">
            <PaymentMethodLogo method={logoMethod(payment.method)} size={44} />
            <div className="min-w-0 flex-1 space-y-2">
              <StatusPill tone={paymentStatusTone(payment.status)} label={statusConfig.label} />
              <p className={cn('text-[28px] font-semibold leading-none tracking-[-0.02em] tabular-nums', TEXT.strong)}>
                {formatCurrencyRMB(payment.amount_rmb)}
              </p>
              <Line>
                Demandé par{' '}
                <button type="button" onClick={() => navigate(`/m/clients/${payment.user_id}`)} className={cn('-mx-1 px-1 py-3 font-semibold underline decoration-[#B3B3B3] underline-offset-4', FOCUS_RING, TEXT.strong)}>
                  {clientName}
                </button>
                , via {methodLabel}, {whenSentence(payment.created_at)}.
              </Line>
            </div>
          </div>
          <Line>
            Soit <b className={cn('tabular-nums', TEXT.strong)}>{formatNumber(payment.amount_xaf)} XAF</b>, au taux de 1 million XAF = ¥{formatNumber(rateInt)}.
          </Line>
          {payment.status === 'rejected' && payment.rejection_reason && <Line tone="bad">Refusé : {payment.rejection_reason}</Line>}
          {slaLevel === 'overdue' && <Line tone="bad">Ce paiement attend {sinceSentence(payment.created_at)}. Il faut le traiter.</Line>}
          {slaLevel === 'aging' && <Line tone="warn">Ce paiement attend {sinceSentence(payment.created_at)}.</Line>}
          {missingBeneficiary && <Line tone="warn">Il manque les coordonnées du bénéficiaire : on ne peut pas payer sans.</Line>}
          {missingAdminProof && (
            <Line tone="warn">
              {clientProofs.length > 0 ? 'Le client a envoyé sa facture. ' : ''}Il manque votre preuve de paiement (la capture Alipay, WeChat ou banque) avant de valider.
            </Line>
          )}
        </section>

        {/* ── QR Code cash (cash_pending / cash_scanned) ────── */}
        {isCash && !['completed', 'rejected'].includes(payment.status) && (
          <CashQRCode
            paymentId={payment.id}
            paymentReference={payment.reference}
            amountRMB={payment.amount_rmb}
            beneficiaryName={cashBeneficiaryName}
          />
        )}

        {/* ── Le bénéficiaire ───────────────────────────────── */}
        <section>
          <SectionTitle
            action={hasBeneficiaryInfo && canEditBeneficiary && !editBenef && !isCash ? { label: 'Modifier', onClick: openEdit } : undefined}
          >
            {isCash ? 'Qui reçoit le cash' : 'Le bénéficiaire'}
          </SectionTitle>
          <Card>
            {/* ── Mode lecture ─── */}
            {!editBenef && (
              <>
                {!hasBeneficiaryInfo && !isCash && (
                  <div className="space-y-3">
                    <Line tone="warn">Les coordonnées du bénéficiaire manquent encore.</Line>
                    {canEditBeneficiary && (
                      <Button className="w-full" onClick={openEdit}>Ajouter les coordonnées</Button>
                    )}
                  </div>
                )}

                {isCash && (
                  <Line>
                    <b className={TEXT.strong}>{cashBeneficiaryName}</b>
                    {isCashSelf ? ', le client lui-même' : ', une autre personne que le client'}
                    {cashPhone && <>, joignable au {cashPhone}</>}.
                  </Line>
                )}

                {payment.method === 'bank_transfer' && hasBeneficiaryInfo && (
                  <div className={cn('divide-y', SURFACE.divider)}>
                    {payment.beneficiary_name && <CopyRow label="Titulaire du compte" value={payment.beneficiary_name} />}
                    {payment.beneficiary_bank_name && <CopyRow label="Banque" value={payment.beneficiary_bank_name} />}
                    {payment.beneficiary_bank_account && <CopyRow label="Numéro de compte" value={payment.beneficiary_bank_account} mono />}
                    {bankExtra && <CopyRow label="SWIFT / IBAN" value={bankExtra} mono />}
                    {payment.beneficiary_phone && <CopyRow label="Téléphone" value={payment.beneficiary_phone} />}
                    {payment.beneficiary_email && <CopyRow label="Email" value={payment.beneficiary_email} />}
                    {payment.beneficiary_notes && <CopyRow label="Notes" value={payment.beneficiary_notes} multiline />}
                  </div>
                )}

                {(payment.method === 'alipay' || payment.method === 'wechat') && hasBeneficiaryInfo && (
                  <div className="space-y-3">
                    <div className={cn('divide-y', SURFACE.divider)}>
                      {payment.beneficiary_name && <CopyRow label="Nom" value={payment.beneficiary_name} />}
                      {identifier && <CopyRow label={payment.method === 'wechat' ? 'Identifiant WeChat' : 'Identifiant Alipay'} value={identifier} mono />}
                      {payment.beneficiary_phone && <CopyRow label="Téléphone" value={payment.beneficiary_phone} />}
                      {payment.beneficiary_email && <CopyRow label="Email" value={payment.beneficiary_email} />}
                      {payment.beneficiary_notes && <CopyRow label="Notes" value={payment.beneficiary_notes} multiline />}
                    </div>

                    {payment.beneficiary_qr_code_url ? (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <Button variant="neutral" onClick={() => setShowQR(v => !v)}>
                            <QrCode />
                            {showQR ? 'Masquer le QR' : 'Voir le QR'}
                          </Button>
                          {canEditBeneficiary && (
                            <Button variant="neutral" onClick={() => qrInputRef.current?.click()} loading={isUploadingQr}>
                              Changer le QR
                            </Button>
                          )}
                        </div>
                        {showQR && (
                          <div className={cn('overflow-hidden rounded-lg', SURFACE.shadow)}>
                            <img
                              src={payment.beneficiary_qr_code_url}
                              alt="QR Code bénéficiaire"
                              className="max-h-[260px] w-full bg-white object-contain"
                            />
                            <div className="grid grid-cols-2 gap-2 p-3">
                              <Button variant="neutral" onClick={() => setFullscreenProof(payment.beneficiary_qr_code_url)}>Agrandir</Button>
                              <a
                                href={payment.beneficiary_qr_code_url}
                                download="qr-code-beneficiaire"
                                className={cn('inline-flex h-10 items-center justify-center gap-2 px-3 text-[16px] font-medium no-underline', SOFT_PILL)}
                              >
                                Télécharger
                              </a>
                            </div>
                          </div>
                        )}
                      </>
                    ) : canEditBeneficiary && (
                      <Button variant="neutral" className="w-full" onClick={() => qrInputRef.current?.click()} loading={isUploadingQr}>
                        <QrCode />
                        Ajouter un QR code
                      </Button>
                    )}

                  {/* Input QR caché (pour "Changer QR" sans ouvrir edit form) */}
                  <input
                    ref={qrInputRef}
                    type="file"
                    accept={ACCEPT_IMAGE}
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !paymentId) return;
                      setIsUploadingQr(true);
                      try {
                        // Le bucket refuse déjà les mauvais types et > 10 Mo,
                        // mais avec une erreur opaque : on le dit clairement ici.
                        validateUploadFile(file);
                        const compressed = await compressImage(file);
                        const filePath = `beneficiary/${paymentId}/${Date.now()}_${compressed.name}`;
                        const { error } = await supabaseAdmin.storage
                          .from('payment-proofs')
                          .upload(filePath, compressed, { upsert: true });
                        if (error) throw error;
                        const qrUrl = `payment-proofs/${filePath}`;
                        await adminUpdateBeneficiaryInfo.mutateAsync({
                          paymentId,
                          beneficiaryInfo: { beneficiary_qr_code_url: qrUrl },
                        });
                        toast.success('QR code mis à jour');
                      } catch (err) {
                        toast.error(err instanceof Error && err.message ? err.message : 'Erreur lors de l\'upload du QR code');
                      } finally {
                        setIsUploadingQr(false);
                        if (qrInputRef.current) qrInputRef.current.value = '';
                      }
                    }}
                  />
                  </div>
                )}
              </>
            )}

          {/* ── Mode édition inline ─── */}
          {editBenef && (
            <div className="flex flex-col gap-3">

              {/* ALIPAY / WECHAT */}
              {(payment.method === 'alipay' || payment.method === 'wechat') && (
                <>
                  <FormField label={<>Nom <span className={cn('font-normal', TEXT.muted)}>(optionnel)</span></>}>
                    <TextInput
                      value={beneficiaryForm.beneficiary_name}
                      onChange={e => setBeneficiaryForm(f => ({ ...f, beneficiary_name: e.target.value }))}
                      placeholder="Nom du bénéficiaire"
                      autoComplete="off"
                    />
                  </FormField>
                  <FormField label="QR Code">
                    {qrPreview || beneficiaryForm.beneficiary_qr_code_url ? (
                      <div className={cn('relative overflow-hidden rounded-lg', SURFACE.canvas)}>
                        <img
                          src={qrPreview ?? beneficiaryForm.beneficiary_qr_code_url}
                          alt="QR"
                          className="max-h-40 w-full bg-white object-contain"
                        />
                        <button
                          onClick={() => { setQrFile(null); setQrPreview(null); setBeneficiaryForm(f => ({ ...f, beneficiary_qr_code_url: '' })); }}
                          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <PasteDropZone
                        onFiles={handlePastedFiles}
                        enabled={false}
                        single
                        accept={ACCEPT_IMAGE}
                        title="Collez, glissez ou cliquez le QR Code"
                        hint="Ctrl+V colle la capture du QR — JPG, PNG ou WebP"
                      />
                    )}
                  </FormField>
                  <FormField label={<>ID {methodLabel} <span className={cn('font-normal', TEXT.muted)}>(téléphone)</span></>}>
                    <TextInput
                      type="tel"
                      value={beneficiaryForm.beneficiary_phone}
                      onChange={e => setBeneficiaryForm(f => ({ ...f, beneficiary_phone: e.target.value }))}
                      placeholder="+86 138 0000 0000"
                    />
                  </FormField>
                  <FormField label={<>Email <span className={cn('font-normal', TEXT.muted)}>(optionnel)</span></>}>
                    <TextInput
                      type="email"
                      value={beneficiaryForm.beneficiary_email}
                      onChange={e => setBeneficiaryForm(f => ({ ...f, beneficiary_email: e.target.value }))}
                      placeholder="beneficiaire@example.com"
                    />
                  </FormField>
                  <FormField label={<>Identifiant {payment.method === 'wechat' ? 'WeChat' : 'Alipay'} <span className={cn('font-normal', TEXT.muted)}>(optionnel)</span></>}>
                    <TextInput
                      value={beneficiaryForm.beneficiary_identifier}
                      onChange={e => setBeneficiaryForm(f => ({ ...f, beneficiary_identifier: e.target.value }))}
                      placeholder={payment.method === 'wechat' ? 'WeChat ID / 微信号' : 'Alipay ID / 支付宝账号'}
                      autoComplete="off"
                    />
                  </FormField>
                  <FormField label={<>Notes <span className={cn('font-normal', TEXT.muted)}>(optionnel)</span></>}>
                    <TextArea
                      value={beneficiaryForm.beneficiary_notes}
                      onChange={e => setBeneficiaryForm(f => ({ ...f, beneficiary_notes: e.target.value }))}
                      placeholder="Instructions supplémentaires…"
                      rows={3}
                    />
                  </FormField>
                </>
              )}

              {/* VIREMENT */}
              {payment.method === 'bank_transfer' && (
                <>
                  <FormField label={<>Titulaire <span className="text-[#900B09]">*</span></>}>
                    <TextInput
                      value={beneficiaryForm.beneficiary_name}
                      onChange={e => setBeneficiaryForm(f => ({ ...f, beneficiary_name: e.target.value }))}
                      placeholder="Nom complet"
                      autoComplete="off"
                    />
                  </FormField>
                  <FormField label={<>Banque <span className="text-[#900B09]">*</span></>}>
                    <TextInput
                      value={beneficiaryForm.beneficiary_bank_name}
                      onChange={e => setBeneficiaryForm(f => ({ ...f, beneficiary_bank_name: e.target.value }))}
                      placeholder="Bank of China, ICBC…"
                      autoComplete="off"
                    />
                  </FormField>
                  <FormField label={<>N° de compte <span className="text-[#900B09]">*</span></>}>
                    <TextInput
                      className="font-mono"
                      value={beneficiaryForm.beneficiary_bank_account}
                      onChange={e => setBeneficiaryForm(f => ({ ...f, beneficiary_bank_account: e.target.value }))}
                      placeholder="6214 8888 1234 5678"
                      autoComplete="off"
                    />
                  </FormField>
                  <FormField label={<>Infos complémentaires <span className={cn('font-normal', TEXT.muted)}>(SWIFT / IBAN / adresse)</span></>}>
                    <TextInput
                      value={beneficiaryForm.beneficiary_bank_extra}
                      onChange={e => setBeneficiaryForm(f => ({ ...f, beneficiary_bank_extra: e.target.value }))}
                      placeholder="SWIFT / IBAN / adresse banque"
                      autoComplete="off"
                    />
                  </FormField>
                  <FormField label={<>Notes <span className={cn('font-normal', TEXT.muted)}>(optionnel)</span></>}>
                    <TextArea
                      value={beneficiaryForm.beneficiary_notes}
                      onChange={e => setBeneficiaryForm(f => ({ ...f, beneficiary_notes: e.target.value }))}
                      placeholder="Instructions supplémentaires…"
                      rows={3}
                    />
                  </FormField>
                </>
              )}

              {/* Boutons Annuler / Enregistrer */}
              <div className="flex gap-2">
                <SoftPill
                  onClick={() => { setEditBenef(false); setQrFile(null); setQrPreview(null); }}
                  disabled={adminUpdateBeneficiaryInfo.isPending || isUploadingQr}
                  className="flex-1"
                >
                  Annuler
                </SoftPill>
                <PrimaryPill
                  onClick={handleSaveBeneficiaryInfo}
                  loading={adminUpdateBeneficiaryInfo.isPending || isUploadingQr}
                  className="flex-1"
                >
                  <CheckCircle className="h-4 w-4" />
                  OK
                </PrimaryPill>
              </div>
            </div>
          )}
          </Card>
        </section>

        {/* ── La signature (cash) OU la preuve ─────────────── */}
        {isCash ? (
          <section>
            <SectionTitle>La signature</SectionTitle>
            <Card className="space-y-3">
              {signatureUrl ? (
                <>
                  <img
                    src={signatureUrl}
                    alt="Signature"
                    className={cn('max-h-[120px] w-full rounded-lg bg-white object-contain', SURFACE.shadow)}
                  />
                  <Line>
                    {cashPaidAt ? `Signé le ${when(cashPaidAt)}` : 'Signature enregistrée'}
                    {cashSignedBy && <>, devant {cashSignedBy}</>}.
                  </Line>
                  {payment.status === 'completed' && (
                    <CashReceiptDownloadButton
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      payment={payment as any}
                      variant="outline"
                      size="sm"
                      label="Télécharger le reçu PDF"
                    />
                  )}
                </>
              ) : signing ? (
                <SignatureCanvas
                  onSave={handleCashSignature}
                  onCancel={() => setSigning(false)}
                  isLoading={confirmCash.isPending}
                />
              ) : (
                <>
                  <Line>La personne qui reçoit le cash doit signer avant la remise des fonds.</Line>
                  {!isLocked && (
                    <Button className="w-full" onClick={() => setSigning(true)}>Faire signer</Button>
                  )}
                </>
              )}
            </Card>
          </section>
        ) : (
          <section>
            <SectionTitle
              action={canAddProof && allProofs.length > 0 ? { label: 'Ajouter', onClick: () => standaloneProofRef.current?.click() } : undefined}
            >
              {allProofs.length > 1 ? `Les preuves (${allProofs.length})` : 'La preuve'}
            </SectionTitle>

            {/* Inputs cachés : preuve, instruction du client */}
            <input ref={standaloneProofRef} type="file" accept={ACCEPT_UPLOAD} className="hidden" onChange={handleStandaloneProofUpload} />
            <input ref={instructionInputRef} type="file" accept={ACCEPT_UPLOAD} multiple className="hidden" onChange={handleInstructionUpload} />

            {allProofs.length === 0 ? (
              <Card className="space-y-3">
                <Line>Aucune preuve pour l'instant.</Line>
                {canAddProof && (
                  <Button variant="neutral" className="w-full" onClick={() => standaloneProofRef.current?.click()} loading={adminProofUpload.isPending}>
                    <Plus />
                    Ajouter une preuve
                  </Button>
                )}
              </Card>
            ) : (
              <div className="flex flex-col gap-3">
                {allProofs.map((proof) => {
                  const isAdminProof = proof.uploaded_by_type === 'admin';
                  const canDeleteThis = canProcess && (isAdminProof || isSuperAdmin) && (!isLocked || isSuperAdmin);
                  const who = proof.uploaded_by_type === 'admin' ? 'Preuve ajoutée par un administrateur'
                    : proof.uploaded_by_type === 'admin_instruction' ? 'Instruction ajoutée par un administrateur'
                    : 'Instruction envoyée par le client';
                  return (
                    <Card key={proof.id} className="overflow-hidden p-0">
                      <div className="relative w-full bg-[#F5F5F5] dark:bg-[#383838]" style={{ aspectRatio: '16/10' }}>
                        <img
                          src={proof.file_url}
                          alt={proof.file_name || 'Preuve'}
                          className="h-full w-full object-contain"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      </div>
                      <div className="space-y-3 p-4">
                        <Line>{who} {whenSentence(proof.created_at)}.</Line>
                        {proof.file_name && <p className={cn('break-all text-[16px] leading-snug', TEXT.muted)}>{proof.file_name}</p>}
                        <div className="grid grid-cols-2 gap-2">
                          <Button variant="neutral" onClick={() => setFullscreenProof(proof.file_url)}>
                            <Eye />
                            Agrandir
                          </Button>
                          <a
                            href={proof.file_url}
                            download={proof.file_name || 'preuve'}
                            className={cn('inline-flex h-10 items-center justify-center gap-2 px-3 text-[16px] font-medium no-underline [&_svg]:h-5 [&_svg]:w-5', SOFT_PILL)}
                          >
                            <Download />
                            Télécharger
                          </a>
                          {canDeleteThis && (
                            <Button variant="dangerSubtle" onClick={() => setProofToDelete(proof.id)}>
                              <Trash2 />
                              Supprimer
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {canAddProof && instructionProofs.length === 0 && (
              <Button variant="subtle" className="mt-2 w-full" onClick={() => instructionInputRef.current?.click()} loading={instructionUpload.isPending}>
                <Plus />
                Ajouter une instruction du client
              </Button>
            )}
          </section>
        )}

        {/* ── La décision ───────────────────────────────────── */}
        <section className="space-y-2">
          <SectionTitle>La décision</SectionTitle>
          {isLocked && (
            <Line>
              {payment.status === 'completed' ? 'Ce paiement est effectué.' : 'Ce paiement a été refusé.'} Il n'y a plus rien à faire.
            </Line>
          )}
          {!isLocked && !mainAction && !canReject && (
            <Line>{canProcess ? 'Rien à décider pour le moment.' : "Vous n'avez pas le droit de traiter les paiements."}</Line>
          )}
          {mainAction && (
            <div ref={decision.ref}>
              <Button className="w-full" onClick={mainAction.onClick} loading={processPayment.isPending}>
                {mainAction.icon}
                {mainAction.label}
              </Button>
            </div>
          )}
          {canReject && (
            <Button className="w-full" variant="dangerSubtle" onClick={() => setIsRejectOpen(true)}>
              Refuser le paiement
            </Button>
          )}
          {canDelete && (
            <Button className="w-full" variant="subtle" onClick={() => setIsDeletePaymentOpen(true)}>
              <Trash2 />
              Annuler ce paiement
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

        {mainAction && (
          <DecisionDock show={dockShown}>
            <Button className="w-full" onClick={mainAction.onClick} loading={processPayment.isPending}>
              {mainAction.icon}
              {mainAction.label}
            </Button>
          </DecisionDock>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          BOTTOM-SHEETS
      ══════════════════════════════════════════════════════ */}

      {/* ── Reject ───────────────────────────────────────── */}
      <BottomSheet
        open={isRejectOpen}
        onClose={() => { setIsRejectOpen(false); setRejectionCategory(''); setRejectReason(''); }}
        title={
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-[#900B09] dark:text-[#FDD3D0]" />
            Rejeter le paiement
          </span>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-[#FDD3D0] p-4 dark:bg-[#900B09]">
            <p className="text-[16px] text-[#900B09] dark:text-[#FDD3D0]">
              Cette action va rejeter le paiement et rembourser {formatCurrency(payment.amount_xaf)} au wallet du client.
            </p>
          </div>
          <div>
            <p className={cn('mb-2 text-[16px]', TEXT.muted)}>Motif du refus</p>
            <div className="space-y-2">
              {PAYMENT_REJECTION_REASONS.map((reason) => (
                <button
                  key={reason}
                  onClick={() => {
                    setRejectionCategory(reason);
                    if (!rejectReason.trim()) setRejectReason(`Paiement refusé : ${reason.toLowerCase()}.`);
                  }}
                  className={cn(
                    'w-full rounded-lg p-3 text-left text-[16px] ring-1 transition-all',
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
          <FormField label={<>Message au client <span className="text-[#900B09]">*</span></>}>
            <TextArea
              placeholder="Expliquez pourquoi le paiement est rejeté..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              required
            />
            <p className={cn('mt-1 text-[16px]', TEXT.muted)}>Ce message sera visible par le client</p>
          </FormField>
          <div className="flex gap-2">
            <SoftPill onClick={() => setIsRejectOpen(false)} className="flex-1">Annuler</SoftPill>
            <PrimaryPill
              onClick={handleReject}
              loading={processPayment.isPending}
              disabled={!rejectReason.trim()}
              danger
              className="flex-1"
            >
              <XCircle className="h-5 w-5" />
              Rejeter
            </PrimaryPill>
          </div>
        </div>
      </BottomSheet>

      {/* ── Complete ─────────────────────────────────────── */}
      <BottomSheet
        open={isCompleteOpen}
        onClose={() => { setIsCompleteOpen(false); setCompleteProofFile(null); setCompleteProofPreview(null); }}
        title="Confirmer le paiement"
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-[#CFF7D3] p-4 dark:bg-[#02542D]">
            <p className="text-[16px] text-[#02542D] dark:text-[#CFF7D3]">
              Confirmez que le paiement de <strong>{formatCurrencyRMB(payment.amount_rmb)}</strong> a été effectué au bénéficiaire.
            </p>
          </div>
          <FormField label="Preuve de paiement (optionnel)">
            <input
              ref={proofInputRef}
              type="file"
              accept={ACCEPT_UPLOAD}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setCompleteProofFile(file);
                const reader = new FileReader();
                reader.onloadend = () => setCompleteProofPreview(reader.result as string);
                reader.readAsDataURL(file);
              }}
            />
            {completeProofPreview ? (
              <div className="relative">
                <img src={completeProofPreview} alt="Preuve" className={cn('h-40 w-full rounded-lg object-cover', SURFACE.shadow)} />
                <button
                  onClick={() => { setCompleteProofFile(null); setCompleteProofPreview(null); if (proofInputRef.current) proofInputRef.current.value = ''; }}
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              /* Window-level Ctrl+V is routed here while this sheet is open
                 (pasteTarget === 'complete'), so the zone itself stays passive. */
              <PasteDropZone
                onFiles={handlePastedFiles}
                enabled={false}
                single
                title="Collez, glissez ou cliquez"
                hint="Ctrl+V colle directement la capture du paiement"
              />
            )}
          </FormField>
          <div className="flex gap-2">
            <SoftPill onClick={() => setIsCompleteOpen(false)} className="flex-1">Annuler</SoftPill>
            <PrimaryPill
              onClick={handleComplete}
              loading={processPayment.isPending || adminProofUpload.isPending}
              className="flex-1 bg-[#2C2C2C] text-white dark:bg-[#2C2C2C] dark:text-white"
            >
              <CheckCircle className="h-5 w-5" />
              Confirmer
            </PrimaryPill>
          </div>
        </div>
      </BottomSheet>

      {/* ── Cancel Payment ───────────────────────────────── */}
      <BottomSheet
        open={isDeletePaymentOpen}
        onClose={() => setIsDeletePaymentOpen(false)}
        title={
          <span className="flex items-center gap-2 text-[#900B09] dark:text-[#FDD3D0]">
            <Trash2 className="h-5 w-5" />
            Annuler ce paiement
          </span>
        }
      >
        <div className="space-y-4">
          <p className={cn('text-[16px]', TEXT.muted)}>
            Voulez-vous vraiment annuler ce paiement ? Le paiement sera marqué comme annulé et le solde du client sera recrédité si nécessaire.
          </p>
          <div className="flex flex-col gap-2">
            <PrimaryPill
              onClick={() => {
                if (!paymentId) return;
                deletePayment.mutate(paymentId, {
                  onSuccess: () => navigate('/m/payments'),
                });
              }}
              loading={deletePayment.isPending}
              danger
              className="w-full"
            >
              Confirmer l'annulation
            </PrimaryPill>
            <SoftPill onClick={() => setIsDeletePaymentOpen(false)} className="w-full">Retour</SoftPill>
          </div>
        </div>
      </BottomSheet>

      {/* ── Delete Proof ─────────────────────────────────── */}
      <BottomSheet
        open={!!proofToDelete}
        onClose={() => setProofToDelete(null)}
        title={
          <span className="flex items-center gap-2 text-[#900B09] dark:text-[#FDD3D0]">
            <Trash2 className="h-5 w-5" />
            Supprimer cette preuve
          </span>
        }
      >
        <div className="space-y-4">
          <p className={cn('text-[16px]', TEXT.muted)}>
            Voulez-vous supprimer cette preuve de paiement ? Cette action est irréversible.
          </p>
          <div className="flex flex-col gap-2">
            <PrimaryPill
              onClick={() => {
                if (!proofToDelete) return;
                deletePaymentProof.mutate(proofToDelete, {
                  onSuccess: () => setProofToDelete(null),
                });
              }}
              loading={deletePaymentProof.isPending}
              danger
              className="w-full"
            >
              Supprimer
            </PrimaryPill>
            <SoftPill onClick={() => setProofToDelete(null)} className="w-full">Annuler</SoftPill>
          </div>
        </div>
      </BottomSheet>

      {/* ── Fullscreen Image ─────────────────────────────── */}
      <BottomSheet
        open={!!fullscreenProof}
        onClose={() => setFullscreenProof(null)}
        title="Aperçu"
      >
        {fullscreenProof && (
          <div className="space-y-3">
            <img src={fullscreenProof} alt="Aperçu" className="w-full rounded-lg" />
            <a
              href={fullscreenProof}
              download
              className={cn('inline-flex h-10 w-full items-center justify-center gap-2 px-3 text-[16px] font-medium no-underline [&_svg]:h-5 [&_svg]:w-5', SOFT_PILL)}
            >
              <Download />
              Télécharger
            </a>
          </div>
        )}
      </BottomSheet>

    </div>
  );
}
