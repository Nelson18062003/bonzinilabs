// ============================================================
// MODULE PAIEMENTS — la fiche d'un paiement (mobile)
//
// Une seule identité en tête (référence + méthode), le montant comme
// point focal, puis quatre blocs dans l'ordre où l'opérateur les lit :
//   le client · le bénéficiaire · les montants · la preuve (ou la
//   signature) · la décision · le détail (replié).
// Les cartes vivent DANS les marges de l'écran (jamais de filet collé au
// bord), le mot « Paiement » n'apparaît plus deux fois, et chaque bloc
// modifiable porte son action « Modifier » à droite de son titre.
//
// Ce que la fiche sait faire (logique métier conservée de la V2) :
//   bénéficiaire éditable inline (Alipay / WeChat / virement), QR, preuves,
//   signature cash, refus (catégories + message client), validation, reçu PDF.
// Nouveau : modifier les montants et le taux d'un paiement en cours
// (admin_correct_payment), annuler un paiement même effectué, avec motif
// (cancel_payment). Les droits viennent de src/lib/paymentEdits.ts, miroir
// des gardes SQL.
// ============================================================
import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { useOnScreen } from '@/hooks/useOnScreen';
import { DecisionDock } from '@/mobile/components/layout/DecisionDock';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
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
  useCancelPayment,
  useDeletePaymentProof,
  useAdminUpdateBeneficiaryInfo,
  useAdminCorrectPayment,
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
import { isTerminalPayment } from '@/lib/terminalStatuses';
import { paymentMainAction } from '@/lib/paymentActions';
import {
  canCancelPayment,
  cancelRequiresReason,
  canEditPaymentAmounts,
  canEditPaymentBeneficiary,
  isClosedPayment,
  normalizeRateInt,
  rmbForXaf,
  amountsCoherent,
  walletDeltaForCorrection,
} from '@/lib/paymentEdits';
import {
  SURFACE,
  TEXT,
  TYPE,
  paymentStatusTone,
  StatusPill,
  Card,
  Button,
  IconButton,
  Avatar,
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
} from '@/mobile/designKit';
import { AmountField, NumberField } from '@/components/form';
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
  Copy,
  Eye,
  Plus,
  Pencil,
  Ban,
  RefreshCw,
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
        <p className={cn('text-[14px] leading-snug', TEXT.muted)}>{label}</p>
        <p className={cn('text-[16px] font-semibold leading-snug', mono && 'tabular-nums tracking-wide', multiline ? 'whitespace-pre-wrap break-words' : 'break-words', TEXT.strong)}>
          {value}
        </p>
      </div>
      <Copy className={cn('mt-1 h-5 w-5 shrink-0', TEXT.muted)} />
    </button>
  );
}

// ── Stat : une valeur chiffrée sous son étiquette ────────────
function Stat({ label, value, tone }: { label: string; value: string; tone?: 'bad' | 'warn' }) {
  return (
    <div className={cn('rounded-lg px-3 py-2.5', SURFACE.inset)}>
      <p className={cn('text-[14px] leading-snug', TEXT.muted)}>{label}</p>
      <p className={cn('mt-0.5 text-[18px] font-semibold leading-tight tabular-nums', tone === 'bad' ? 'text-[#C00F0C] dark:text-[#FCB3AD]' : tone === 'warn' ? 'text-[#975102] dark:text-[#E8B931]' : TEXT.strong)}>{value}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
export function MobilePaymentDetail() {
  const { paymentId } = useParams();
  const navigate      = useNavigate();
  const { hasPermission, currentUser } = useAdminAuth();
  const isSuperAdmin = currentUser?.role === 'super_admin';

  // ── Data hooks ────────────────────────────────────────────
  const { data: payment, isLoading } = useAdminPaymentDetail(paymentId);
  useAdminPaymentTimeline(paymentId);
  const { data: proofs }             = useAdminPaymentProofs(paymentId);

  // ── Mutation hooks ────────────────────────────────────────
  const processPayment             = useProcessPayment();
  const adminProofUpload           = useAdminUploadPaymentProof();
  const instructionUpload          = useAdminUploadPaymentInstruction();
  const adminUpdateBeneficiaryInfo = useAdminUpdateBeneficiaryInfo();
  const cancelPayment              = useCancelPayment();
  const correctPayment             = useAdminCorrectPayment();
  const deletePaymentProof         = useDeletePaymentProof();
  const confirmCash                = useAgentConfirmCashPayment();

  // ── Derived proof lists ───────────────────────────────────
  const clientProofs = useMemo(() => proofs?.filter(p => p.uploaded_by_type !== 'admin') ?? [], [proofs]);
  const adminProofs = useMemo(() => proofs?.filter(p => p.uploaded_by_type === 'admin') ?? [], [proofs]);
  const instructionProofs = useMemo(
    () => proofs?.filter(p => p.uploaded_by_type === 'client' || p.uploaded_by_type === 'admin_instruction') ?? [],
    [proofs],
  );
  const allProofs = useMemo(() => [...adminProofs, ...instructionProofs], [adminProofs, instructionProofs]);

  // ── Feuilles ──────────────────────────────────────────────
  const [isRejectOpen,    setIsRejectOpen]    = useState(false);
  const [isCompleteOpen,  setIsCompleteOpen]  = useState(false);
  const [isCancelOpen,    setIsCancelOpen]    = useState(false);
  const [isAmountsOpen,   setIsAmountsOpen]   = useState(false);
  const [proofToDelete,   setProofToDelete]   = useState<string | null>(null);
  const [fullscreenProof, setFullscreenProof] = useState<string | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [showDetail,      setShowDetail]      = useState(false);
  const decision = useOnScreen();

  // ── Refus ─────────────────────────────────────────────────
  const [rejectionCategory, setRejectionCategory] = useState('');
  const [rejectReason,      setRejectReason]      = useState('');

  // ── Annulation ────────────────────────────────────────────
  const [cancelReason, setCancelReason] = useState('');

  // ── Montants ──────────────────────────────────────────────
  const [editXaf,    setEditXaf]    = useState<number | null>(null);
  const [editRmb,    setEditRmb]    = useState<number | null>(null);
  const [editRate,   setEditRate]   = useState<number | null>(null);
  const [editReason, setEditReason] = useState('');

  // ── Validation (preuve jointe) ────────────────────────────
  const [completeProofFile,    setCompleteProofFile]    = useState<File | null>(null);
  const [completeProofPreview, setCompleteProofPreview] = useState<string | null>(null);
  const proofInputRef = useRef<HTMLInputElement>(null);
  const standaloneProofRef  = useRef<HTMLInputElement>(null);
  const instructionInputRef = useRef<HTMLInputElement>(null);

  // ── Bénéficiaire (édition inline) ─────────────────────────
  const [editBenef, setEditBenef] = useState(false);
  const [beneficiaryForm, setBeneficiaryForm] = useState({
    beneficiary_name: '', beneficiary_phone: '', beneficiary_email: '', beneficiary_qr_code_url: '',
    beneficiary_bank_name: '', beneficiary_bank_account: '', beneficiary_bank_extra: '', beneficiary_notes: '', beneficiary_identifier: '',
  });
  const [qrFile,        setQrFile]        = useState<File | null>(null);
  const [qrPreview,     setQrPreview]     = useState<string | null>(null);
  const [isUploadingQr, setIsUploadingQr] = useState(false);
  const [showQR,        setShowQR]        = useState(false);
  const qrInputRef = useRef<HTMLInputElement>(null);

  // ── Cash ──────────────────────────────────────────────────
  const [signing, setSigning] = useState(false);

  // ── Coller (Ctrl+V) — routé vers la zone active ───────────
  const isAlipayOrWechat = payment?.method === 'alipay' || payment?.method === 'wechat';
  const blockingSheetOpen = isRejectOpen || isCancelOpen || isAmountsOpen || !!proofToDelete || !!fullscreenProof || signing;

  const pasteTarget: 'qr' | 'complete' | 'proof' | null =
    !payment || blockingSheetOpen
      ? null
      : editBenef && isAlipayOrWechat
        ? 'qr'
        : isCompleteOpen
          ? 'complete'
          : hasPermission('canProcessPayments') && !isTerminalPayment(payment.status) && payment.method !== 'cash'
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
        for (const file of files) {
          try {
            await adminProofUpload.mutateAsync({ paymentId, file });
          } catch {
            break;
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

  // ── Handlers ──────────────────────────────────────────────
  const initBeneficiaryForm = () => {
    if (!payment) return;
    const p = payment as typeof payment & { beneficiary_bank_extra?: string | null; beneficiary_identifier?: string | null };
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
      if (!hasContact && !hasQr) { toast.error('Fournissez au moins un QR code, un téléphone ou un email'); return; }
    } else if (payment.method === 'bank_transfer') {
      if (!beneficiaryForm.beneficiary_name)         { toast.error('Le nom du bénéficiaire est requis'); return; }
      if (!beneficiaryForm.beneficiary_bank_name)    { toast.error('Le nom de la banque est requis');    return; }
      if (!beneficiaryForm.beneficiary_bank_account) { toast.error('Le numéro de compte est requis');   return; }
    }
    try {
      let qrUrl = toStoredPath(beneficiaryForm.beneficiary_qr_code_url) ?? '';
      if (qrFile && (payment.method === 'alipay' || payment.method === 'wechat')) {
        setIsUploadingQr(true);
        const compressed = await compressImage(qrFile);
        const filePath = `beneficiary/${paymentId}/${Date.now()}_${compressed.name}`;
        const { error: uploadError } = await supabaseAdmin.storage.from('payment-proofs').upload(filePath, compressed, { upsert: true });
        if (uploadError) throw uploadError;
        qrUrl = `payment-proofs/${filePath}`;
      }
      const identifier = beneficiaryForm.beneficiary_identifier.trim();
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
      /* géré par la mutation */
    } finally {
      setIsUploadingQr(false);
    }
  };

  const handleStartProcessing = async () => {
    if (!paymentId) return;
    try {
      await processPayment.mutateAsync({ paymentId, action: 'start_processing' });
      toast.success('Paiement marqué en cours');
    } catch { /* géré */ }
  };

  const handleComplete = async () => {
    if (!paymentId) return;
    try {
      if (completeProofFile) {
        await adminProofUpload.mutateAsync({ paymentId, file: completeProofFile });
        setCompleteProofFile(null);
        setCompleteProofPreview(null);
      }
      await processPayment.mutateAsync({ paymentId, action: 'complete' });
      setIsCompleteOpen(false);
      toast.success('Paiement effectué');
      navigate('/m/payments');
    } catch { /* géré */ }
  };

  const handleReject = async () => {
    if (!paymentId || !rejectReason.trim()) { toast.error('Veuillez indiquer un motif'); return; }
    try {
      await processPayment.mutateAsync({ paymentId, action: 'reject', comment: rejectReason });
      setIsRejectOpen(false);
      setRejectionCategory('');
      setRejectReason('');
      toast.success('Paiement refusé');
      navigate('/m/payments');
    } catch { /* géré */ }
  };

  const handleCancel = async () => {
    if (!paymentId || !payment) return;
    if (cancelRequiresReason(payment.status) && cancelReason.trim().length < 3) {
      toast.error('Indiquez le motif de l’annulation');
      return;
    }
    try {
      await cancelPayment.mutateAsync({ paymentId, reason: cancelReason });
      setIsCancelOpen(false);
      setCancelReason('');
      navigate('/m/payments');
    } catch { /* géré */ }
  };

  const openAmounts = () => {
    if (!payment) return;
    setEditXaf(payment.amount_xaf);
    setEditRmb(Number(payment.amount_rmb));
    setEditRate(normalizeRateInt(payment.exchange_rate));
    setEditReason('');
    setIsAmountsOpen(true);
  };

  const handleSaveAmounts = async () => {
    if (!payment || !paymentId) return;
    const xaf = editXaf ?? 0;
    const rmb = editRmb ?? 0;
    const rate = editRate ?? 0;
    if (xaf <= 0 || rmb <= 0 || rate <= 0) { toast.error('Les trois montants doivent être positifs'); return; }
    if (editReason.trim().length < 3) { toast.error('Indiquez le motif de la modification'); return; }
    const currentRate = normalizeRateInt(payment.exchange_rate);
    const changes = {
      amountXaf:    xaf !== payment.amount_xaf ? xaf : undefined,
      amountRmb:    rmb !== Number(payment.amount_rmb) ? rmb : undefined,
      exchangeRate: rate !== currentRate ? rate : undefined,
      rateIsCustom: rate !== currentRate ? true : undefined,
    };
    if (changes.amountXaf === undefined && changes.amountRmb === undefined && changes.exchangeRate === undefined) {
      toast.error('Aucune valeur ne change');
      return;
    }
    try {
      await correctPayment.mutateAsync({ paymentId, reason: editReason.trim(), ...changes });
      setIsAmountsOpen(false);
    } catch { /* géré */ }
  };

  const handleStandaloneProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (standaloneProofRef.current) standaloneProofRef.current.value = '';
    if (picked.length === 0 || !paymentId) return;
    const { accepted, rejected } = partitionUploadFiles(picked);
    const problem = rejectionMessage(rejected);
    if (problem) toast.error(problem);
    if (accepted.length === 0) return;
    try {
      await adminProofUpload.mutateAsync({ paymentId, file: accepted[0] });
      toast.success('Preuve ajoutée');
    } catch { /* géré */ }
  };

  const handleInstructionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (instructionInputRef.current) instructionInputRef.current.value = '';
    if (picked.length === 0 || !paymentId) return;
    const { accepted, rejected } = partitionUploadFiles(picked);
    const problem = rejectionMessage(rejected);
    if (problem) toast.error(problem);
    if (accepted.length === 0) return;
    try {
      await instructionUpload.mutateAsync({ paymentId, files: accepted });
      toast.success(`${accepted.length} instruction(s) ajoutée(s)`);
    } catch { /* géré */ }
  };

  const handleCashSignature = async (signatureDataUrl: string) => {
    if (!paymentId) return;
    const signedByName = currentUser ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Admin' : 'Admin';
    try {
      const result = await confirmCash.mutateAsync({ paymentId, signatureDataUrl, signedByName });
      if (result?.success) {
        setSigning(false);
        toast.success('Signature enregistrée — paiement confirmé');
      } else {
        toast.error((result as { error?: string })?.error || 'Erreur lors de la confirmation');
      }
    } catch { /* géré */ }
  };

  const handleDownloadReceipt = async () => {
    if (!payment || isGeneratingPDF) return;
    setIsGeneratingPDF(true);
    try {
      const clientName = payment.profiles ? `${payment.profiles.first_name} ${payment.profiles.last_name}` : 'Client';
      const receiptData: PaymentReceiptData = {
        id: payment.id, reference: payment.reference, created_at: payment.created_at, processed_at: payment.processed_at,
        amount_xaf: payment.amount_xaf, amount_rmb: payment.amount_rmb, exchange_rate: payment.exchange_rate,
        method: payment.method, status: payment.status, client_name: clientName, client_phone: payment.profiles?.phone,
        beneficiary_name: payment.beneficiary_name, beneficiary_phone: payment.beneficiary_phone, beneficiary_email: payment.beneficiary_email,
        beneficiary_bank_name: payment.beneficiary_bank_name, beneficiary_bank_account: payment.beneficiary_bank_account,
        beneficiary_qr_code_url: payment.beneficiary_qr_code_url,
        adminProofs: adminProofs.map(p => ({ file_url: p.file_url, file_type: p.file_type, file_name: p.file_name, created_at: p.created_at })),
      };
      await downloadPDF(<PaymentReceiptPDF data={receiptData} />, `recu_paiement_${payment.reference}_${clientName.replace(/\s+/g, '_')}.pdf`);
      toast.success('Reçu téléchargé');
    } catch (err) {
      console.error('PDF error:', err);
      toast.error('Erreur lors de la génération du PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Quand le paiement change de statut sous nos pieds, on ferme l'édition.
  useEffect(() => {
    if (payment && isClosedPayment(payment.status)) setEditBenef(false);
  }, [payment]);

  // ── Chargement / introuvable ──────────────────────────────
  if (isLoading) {
    return (
      <div className={cn('flex min-h-screen flex-col', SURFACE.canvas)}>
        <MobileHeader title="Paiement" showBack backTo="/m/payments" />
        <SkeletonDetail />
      </div>
    );
  }
  if (!payment) {
    return (
      <div className={cn('flex min-h-screen flex-col', SURFACE.canvas)}>
        <MobileHeader title="Paiement" showBack backTo="/m/payments" />
        <div className="flex flex-1 items-center justify-center p-4">
          <p className={TEXT.muted}>Paiement non trouvé</p>
        </div>
      </div>
    );
  }

  // ── Dérivés d'affichage ───────────────────────────────────
  const clientName = payment.profiles ? `${payment.profiles.first_name} ${payment.profiles.last_name}` : 'Client inconnu';
  const statusConfig = PAYMENT_STATUS_CONFIG[payment.status as PaymentStatus] || { label: payment.status };
  const methodLabel  = PAYMENT_METHOD_LABELS[payment.method as PaymentMethod] || payment.method;
  const slaLevel     = getPaymentSlaLevel(payment.created_at, payment.status);
  const rateInt      = normalizeRateInt(payment.exchange_rate);

  const canProcess         = hasPermission('canProcessPayments');
  const isLocked           = isTerminalPayment(payment.status);
  const isCash             = payment.method === 'cash';
  const mainKind           = paymentMainAction(payment.status, canProcess);
  const canStartProcessing = mainKind === 'start_processing';
  const canComplete        = mainKind === 'complete';
  const canReject          = canProcess && !isLocked;
  const canCancel          = canCancelPayment(payment.status, isSuperAdmin);
  const canEditBeneficiary = canEditPaymentBeneficiary(payment.status, payment.method, canProcess);
  const canEditAmounts     = canEditPaymentAmounts(payment.status, canProcess, isSuperAdmin);
  const canAddProof        = canProcess && !isLocked;
  const hasBeneficiaryInfo = !!(payment.beneficiary_name || payment.beneficiary_bank_account || payment.beneficiary_qr_code_url || payment.beneficiary_phone || payment.beneficiary_email);
  const missingBeneficiary = !hasBeneficiaryInfo && !isCash && !['completed', 'rejected', 'created', 'cancelled_by_admin'].includes(payment.status);
  const missingAdminProof  = payment.status === 'processing' && !isCash && adminProofs.length === 0;

  const extra = payment as typeof payment & {
    cash_beneficiary_type?: string | null; cash_beneficiary_first_name?: string | null; cash_beneficiary_last_name?: string | null;
    cash_beneficiary_phone?: string | null; cash_signature_url?: string | null; cash_paid_at?: string | null; cash_signed_by_name?: string | null;
    beneficiary_bank_extra?: string | null; beneficiary_identifier?: string | null; rate_is_custom?: boolean | null;
    cancelled_reason?: string | null; cancelled_at?: string | null;
  };
  const cashBeneficiaryName = extra.cash_beneficiary_type === 'other'
    ? [extra.cash_beneficiary_first_name, extra.cash_beneficiary_last_name].filter(Boolean).join(' ') || clientName
    : clientName;
  const isCashSelf = extra.cash_beneficiary_type !== 'other';

  const mainAction = canStartProcessing
    ? { label: 'Commencer le paiement', icon: <Play />, onClick: handleStartProcessing }
    : canComplete
    ? { label: 'Valider le paiement', icon: <CheckCircle />, onClick: () => setIsCompleteOpen(true) }
    : null;
  const sheetOpen = isRejectOpen || isCompleteOpen || isCancelOpen || isAmountsOpen || !!proofToDelete || !!fullscreenProof;
  const dockShown = !!mainAction && !decision.onScreen && !sheetOpen;

  const when = (iso: string) => format(new Date(iso), "d MMMM yyyy 'à' HH:mm", { locale: fr });
  const balanceAfter = payment.balance_after ?? null;
  const infoRows = [
    { l: 'Référence', v: payment.reference },
    { l: 'Méthode', v: methodLabel },
    { l: 'Client', v: payment.profiles?.phone ? `${clientName}, ${payment.profiles.phone}` : clientName },
    payment.profiles?.company_name ? { l: 'Entreprise', v: payment.profiles.company_name } : null,
    { l: 'Demandé le', v: when(payment.created_at) },
    payment.processed_at ? { l: 'Traité le', v: when(payment.processed_at) } : null,
    balanceAfter != null ? { l: 'Solde du client après ce paiement', v: `${formatNumber(balanceAfter)} XAF${balanceAfter < 0 ? ' (découvert)' : ''}` } : null,
    payment.rejection_reason ? { l: 'Motif du refus', v: payment.rejection_reason } : null,
    extra.cancelled_reason ? { l: 'Motif de l’annulation', v: extra.cancelled_reason } : null,
    extra.cancelled_at ? { l: 'Annulé le', v: when(extra.cancelled_at) } : null,
    payment.admin_comment ? { l: 'Commentaire', v: payment.admin_comment } : null,
  ].filter(Boolean) as { l: string; v: string }[];

  // Édition des montants : aperçu de l'effet.
  const editDelta = walletDeltaForCorrection(payment.status, payment.amount_xaf, editXaf ?? payment.amount_xaf);
  const editCoherent = amountsCoherent(editXaf ?? 0, editRmb ?? 0, editRate ?? 0);
  const editValid = (editXaf ?? 0) > 0 && (editRmb ?? 0) > 0 && (editRate ?? 0) > 0 && editReason.trim().length >= 3
    && (editXaf !== payment.amount_xaf || editRmb !== Number(payment.amount_rmb) || editRate !== rateInt);

  // ── Rendu ─────────────────────────────────────────────────
  return (
    <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
      <MobileHeader
        title={payment.reference}
        subtitle={`${methodLabel} · ${whenSentence(payment.created_at)}`}
        showBack
        backTo="/m/payments"
        alignStart
        rightElement={<IconButton icon={Download} variant="subtle" ariaLabel="Télécharger le reçu" onClick={handleDownloadReceipt} disabled={isGeneratingPDF} />}
      />

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 pb-8 pt-4">
        {/* ── Le montant ───────────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <PaymentMethodLogo method={logoMethod(payment.method)} size={44} />
            <div className="min-w-0 flex-1">
              <p className={cn('text-[14px]', TEXT.muted)}>{isCash ? 'Remis en espèces' : 'Le fournisseur reçoit'}</p>
              <p className={cn('text-[32px] font-semibold leading-none tracking-[-0.02em] tabular-nums', TEXT.strong)}>
                {formatCurrencyRMB(payment.amount_rmb)}
              </p>
            </div>
            <StatusPill tone={paymentStatusTone(payment.status)} label={statusConfig.label} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Client débité" value={`${formatNumber(payment.amount_xaf)} XAF`} />
            <Stat label={extra.rate_is_custom ? 'Taux (personnalisé)' : 'Taux'} value={`¥ ${formatNumber(rateInt)} / 1 M`} />
          </div>

          {payment.status === 'rejected' && payment.rejection_reason && <Line tone="bad">Refusé : {payment.rejection_reason}</Line>}
          {payment.status === 'cancelled_by_admin' && (
            <Line tone="bad">Annulé{extra.cancelled_reason ? ` : ${extra.cancelled_reason}` : ''}. Le client a été recrédité.</Line>
          )}
          {slaLevel === 'overdue' && <Line tone="bad">Ce paiement attend {sinceSentence(payment.created_at)}. Il faut le traiter.</Line>}
          {slaLevel === 'aging' && <Line tone="warn">Ce paiement attend {sinceSentence(payment.created_at)}.</Line>}
          {missingBeneficiary && <Line tone="warn">Il manque les coordonnées du bénéficiaire : on ne peut pas payer sans.</Line>}
          {missingAdminProof && (
            <Line tone="warn">
              {clientProofs.length > 0 ? 'Le client a envoyé sa facture. ' : ''}Il manque votre preuve de paiement (capture Alipay, WeChat ou banque) avant de valider.
            </Line>
          )}
          {balanceAfter != null && balanceAfter < 0 && (
            <Line tone="warn">Ce paiement a mis le client en découvert : solde après paiement {formatNumber(balanceAfter)} XAF.</Line>
          )}
        </section>

        {/* ── Le client ────────────────────────────────────── */}
        <section>
          <SectionTitle>Le client</SectionTitle>
          <Card className="p-0">
            <button
              type="button"
              onClick={() => navigate(`/m/clients/${payment.user_id}`)}
              className="flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-[#F5F5F5] dark:active:bg-[#383838]"
            >
              <Avatar name={clientName} />
              <span className="min-w-0 flex-1">
                <span className={cn('block truncate', TYPE.bodyStrong, TEXT.strong)}>{clientName}</span>
                <span className={cn('block truncate text-[14px]', TEXT.muted)}>
                  {[payment.profiles?.company_name, payment.profiles?.phone].filter(Boolean).join(' · ') || 'Voir la fiche'}
                </span>
              </span>
              <span className={cn('text-[14px] font-semibold', TEXT.muted)}>Fiche →</span>
            </button>
          </Card>
        </section>

        {/* ── QR Code cash ─────────────────────────────────── */}
        {isCash && !isLocked && (
          <CashQRCode paymentId={payment.id} paymentReference={payment.reference} amountRMB={payment.amount_rmb} beneficiaryName={cashBeneficiaryName} />
        )}

        {/* ── Le bénéficiaire ──────────────────────────────── */}
        <section>
          <SectionTitle action={hasBeneficiaryInfo && canEditBeneficiary && !editBenef ? { label: 'Modifier', onClick: openEdit } : undefined}>
            {isCash ? 'Qui reçoit le cash' : 'Le bénéficiaire'}
          </SectionTitle>
          <Card>
            {!editBenef && (
              <>
                {!hasBeneficiaryInfo && !isCash && (
                  <div className="space-y-3">
                    <Line tone="warn">Les coordonnées du bénéficiaire manquent encore.</Line>
                    {canEditBeneficiary && <Button className="w-full" onClick={openEdit}>Ajouter les coordonnées</Button>}
                  </div>
                )}

                {isCash && (
                  <Line>
                    <b className={TEXT.strong}>{cashBeneficiaryName}</b>
                    {isCashSelf ? ', le client lui-même' : ', une autre personne que le client'}
                    {extra.cash_beneficiary_phone && <>, joignable au {extra.cash_beneficiary_phone}</>}.
                  </Line>
                )}

                {payment.method === 'bank_transfer' && hasBeneficiaryInfo && (
                  <div className={cn('divide-y', SURFACE.divider)}>
                    {payment.beneficiary_name && <CopyRow label="Titulaire du compte" value={payment.beneficiary_name} />}
                    {payment.beneficiary_bank_name && <CopyRow label="Banque" value={payment.beneficiary_bank_name} />}
                    {payment.beneficiary_bank_account && <CopyRow label="Numéro de compte" value={payment.beneficiary_bank_account} mono />}
                    {extra.beneficiary_bank_extra && <CopyRow label="SWIFT / IBAN" value={extra.beneficiary_bank_extra} mono />}
                    {payment.beneficiary_phone && <CopyRow label="Téléphone" value={payment.beneficiary_phone} />}
                    {payment.beneficiary_email && <CopyRow label="Email" value={payment.beneficiary_email} />}
                    {payment.beneficiary_notes && <CopyRow label="Notes" value={payment.beneficiary_notes} multiline />}
                  </div>
                )}

                {(payment.method === 'alipay' || payment.method === 'wechat') && hasBeneficiaryInfo && (
                  <div className="space-y-3">
                    <div className={cn('divide-y', SURFACE.divider)}>
                      {payment.beneficiary_name && <CopyRow label="Nom" value={payment.beneficiary_name} />}
                      {extra.beneficiary_identifier && <CopyRow label={payment.method === 'wechat' ? 'Identifiant WeChat' : 'Identifiant Alipay'} value={extra.beneficiary_identifier} mono />}
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
                            <Button variant="neutral" onClick={() => qrInputRef.current?.click()} loading={isUploadingQr}>Changer le QR</Button>
                          )}
                        </div>
                        {showQR && (
                          <div className={cn('overflow-hidden rounded-lg', SURFACE.shadow)}>
                            <img src={payment.beneficiary_qr_code_url} alt="QR Code bénéficiaire" className="max-h-[260px] w-full bg-white object-contain" />
                            <div className="grid grid-cols-2 gap-2 p-3">
                              <Button variant="neutral" onClick={() => setFullscreenProof(payment.beneficiary_qr_code_url)}>Agrandir</Button>
                              <a href={payment.beneficiary_qr_code_url} download="qr-code-beneficiaire" className={cn('inline-flex h-10 items-center justify-center gap-2 px-3 text-[16px] font-medium no-underline', SOFT_PILL)}>
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
                          validateUploadFile(file);
                          const compressed = await compressImage(file);
                          const filePath = `beneficiary/${paymentId}/${Date.now()}_${compressed.name}`;
                          const { error } = await supabaseAdmin.storage.from('payment-proofs').upload(filePath, compressed, { upsert: true });
                          if (error) throw error;
                          await adminUpdateBeneficiaryInfo.mutateAsync({ paymentId, beneficiaryInfo: { beneficiary_qr_code_url: `payment-proofs/${filePath}` } });
                          toast.success('QR code mis à jour');
                        } catch (err) {
                          toast.error(err instanceof Error && err.message ? err.message : "Erreur lors de l'upload du QR code");
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

            {editBenef && (
              <div className="flex flex-col gap-3">
                {(payment.method === 'alipay' || payment.method === 'wechat') && (
                  <>
                    <FormField label={<>Nom <span className={cn('font-normal', TEXT.muted)}>(optionnel)</span></>}>
                      <TextInput value={beneficiaryForm.beneficiary_name} onChange={e => setBeneficiaryForm(f => ({ ...f, beneficiary_name: e.target.value }))} placeholder="Nom du bénéficiaire" autoComplete="off" />
                    </FormField>
                    <FormField label="QR Code">
                      {qrPreview || beneficiaryForm.beneficiary_qr_code_url ? (
                        <div className={cn('relative overflow-hidden rounded-lg', SURFACE.canvas)}>
                          <img src={qrPreview ?? beneficiaryForm.beneficiary_qr_code_url} alt="QR" className="max-h-40 w-full bg-white object-contain" />
                          <button
                            type="button"
                            onClick={() => { setQrFile(null); setQrPreview(null); setBeneficiaryForm(f => ({ ...f, beneficiary_qr_code_url: '' })); }}
                            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white"
                            aria-label="Retirer le QR"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <PasteDropZone onFiles={handlePastedFiles} enabled={false} single accept={ACCEPT_IMAGE} title="Collez, glissez ou cliquez le QR Code" hint="Ctrl+V colle la capture du QR — JPG, PNG ou WebP" />
                      )}
                    </FormField>
                    <FormField label={<>ID {methodLabel} <span className={cn('font-normal', TEXT.muted)}>(téléphone)</span></>}>
                      <TextInput type="tel" value={beneficiaryForm.beneficiary_phone} onChange={e => setBeneficiaryForm(f => ({ ...f, beneficiary_phone: e.target.value }))} placeholder="+86 138 0000 0000" />
                    </FormField>
                    <FormField label={<>Email <span className={cn('font-normal', TEXT.muted)}>(optionnel)</span></>}>
                      <TextInput type="email" value={beneficiaryForm.beneficiary_email} onChange={e => setBeneficiaryForm(f => ({ ...f, beneficiary_email: e.target.value }))} placeholder="beneficiaire@example.com" />
                    </FormField>
                    <FormField label={<>Identifiant {payment.method === 'wechat' ? 'WeChat' : 'Alipay'} <span className={cn('font-normal', TEXT.muted)}>(optionnel)</span></>}>
                      <TextInput value={beneficiaryForm.beneficiary_identifier} onChange={e => setBeneficiaryForm(f => ({ ...f, beneficiary_identifier: e.target.value }))} placeholder={payment.method === 'wechat' ? 'WeChat ID / 微信号' : 'Alipay ID / 支付宝账号'} autoComplete="off" />
                    </FormField>
                    <FormField label={<>Notes <span className={cn('font-normal', TEXT.muted)}>(optionnel)</span></>}>
                      <TextArea value={beneficiaryForm.beneficiary_notes} onChange={e => setBeneficiaryForm(f => ({ ...f, beneficiary_notes: e.target.value }))} placeholder="Instructions supplémentaires…" rows={3} />
                    </FormField>
                  </>
                )}

                {payment.method === 'bank_transfer' && (
                  <>
                    <FormField label={<>Titulaire <span className="text-[#900B09]">*</span></>}>
                      <TextInput value={beneficiaryForm.beneficiary_name} onChange={e => setBeneficiaryForm(f => ({ ...f, beneficiary_name: e.target.value }))} placeholder="Nom complet" autoComplete="off" />
                    </FormField>
                    <FormField label={<>Banque <span className="text-[#900B09]">*</span></>}>
                      <TextInput value={beneficiaryForm.beneficiary_bank_name} onChange={e => setBeneficiaryForm(f => ({ ...f, beneficiary_bank_name: e.target.value }))} placeholder="Bank of China, ICBC…" autoComplete="off" />
                    </FormField>
                    <FormField label={<>N° de compte <span className="text-[#900B09]">*</span></>}>
                      <TextInput className="tabular-nums" value={beneficiaryForm.beneficiary_bank_account} onChange={e => setBeneficiaryForm(f => ({ ...f, beneficiary_bank_account: e.target.value }))} placeholder="6214 8888 1234 5678" autoComplete="off" />
                    </FormField>
                    <FormField label={<>Infos complémentaires <span className={cn('font-normal', TEXT.muted)}>(SWIFT / IBAN / adresse)</span></>}>
                      <TextInput value={beneficiaryForm.beneficiary_bank_extra} onChange={e => setBeneficiaryForm(f => ({ ...f, beneficiary_bank_extra: e.target.value }))} placeholder="SWIFT / IBAN / adresse banque" autoComplete="off" />
                    </FormField>
                    <FormField label={<>Notes <span className={cn('font-normal', TEXT.muted)}>(optionnel)</span></>}>
                      <TextArea value={beneficiaryForm.beneficiary_notes} onChange={e => setBeneficiaryForm(f => ({ ...f, beneficiary_notes: e.target.value }))} placeholder="Instructions supplémentaires…" rows={3} />
                    </FormField>
                  </>
                )}

                <div className="flex gap-2">
                  <SoftPill onClick={() => { setEditBenef(false); setQrFile(null); setQrPreview(null); }} disabled={adminUpdateBeneficiaryInfo.isPending || isUploadingQr} className="flex-1">
                    Annuler
                  </SoftPill>
                  <PrimaryPill onClick={handleSaveBeneficiaryInfo} loading={adminUpdateBeneficiaryInfo.isPending || isUploadingQr} className="flex-1">
                    <CheckCircle className="h-4 w-4" />
                    Enregistrer
                  </PrimaryPill>
                </div>
              </div>
            )}
          </Card>
        </section>

        {/* ── Les montants ─────────────────────────────────── */}
        <section>
          <SectionTitle action={canEditAmounts ? { label: isClosedPayment(payment.status) ? 'Corriger' : 'Modifier', onClick: openAmounts } : undefined}>
            Les montants
          </SectionTitle>
          <Card className={cn('divide-y py-1', SURFACE.divider)}>
            <div className="flex items-center justify-between gap-3 py-2.5">
              <span className={cn('text-[16px]', TEXT.muted)}>Client débité</span>
              <span className={cn('text-[16px] font-semibold tabular-nums', TEXT.strong)}>{formatNumber(payment.amount_xaf)} XAF</span>
            </div>
            <div className="flex items-center justify-between gap-3 py-2.5">
              <span className={cn('text-[16px]', TEXT.muted)}>Fournisseur reçoit</span>
              <span className={cn('text-[16px] font-semibold tabular-nums', TEXT.strong)}>{formatCurrencyRMB(payment.amount_rmb)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 py-2.5">
              <span className={cn('text-[16px]', TEXT.muted)}>Taux{extra.rate_is_custom ? ' (personnalisé)' : ''}</span>
              <span className={cn('text-[16px] font-semibold tabular-nums', TEXT.strong)}>¥ {formatNumber(rateInt)} pour 1 M XAF</span>
            </div>
            {balanceAfter != null && (
              <div className="flex items-center justify-between gap-3 py-2.5">
                <span className={cn('text-[16px]', TEXT.muted)}>Solde du client après</span>
                <span className={cn('text-[16px] font-semibold tabular-nums', balanceAfter < 0 ? 'text-[#C00F0C] dark:text-[#FCB3AD]' : TEXT.strong)}>{formatNumber(balanceAfter)} XAF</span>
              </div>
            )}
          </Card>
        </section>

        {/* ── La signature (cash) OU la preuve ─────────────── */}
        {isCash ? (
          <section>
            <SectionTitle>La signature</SectionTitle>
            <Card className="space-y-3">
              {extra.cash_signature_url ? (
                <>
                  <img src={extra.cash_signature_url} alt="Signature" className={cn('max-h-[120px] w-full rounded-lg bg-white object-contain', SURFACE.shadow)} />
                  <Line>
                    {extra.cash_paid_at ? `Signé le ${when(extra.cash_paid_at)}` : 'Signature enregistrée'}
                    {extra.cash_signed_by_name && <>, devant {extra.cash_signed_by_name}</>}.
                  </Line>
                  {payment.status === 'completed' && (
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    <CashReceiptDownloadButton payment={payment as any} variant="outline" size="sm" label="Télécharger le reçu PDF" />
                  )}
                </>
              ) : signing ? (
                <SignatureCanvas onSave={handleCashSignature} onCancel={() => setSigning(false)} isLoading={confirmCash.isPending} />
              ) : (
                <>
                  <Line>La personne qui reçoit le cash doit signer avant la remise des fonds.</Line>
                  {!isLocked && <Button className="w-full" onClick={() => setSigning(true)}>Faire signer</Button>}
                </>
              )}
            </Card>
          </section>
        ) : (
          <section>
            <SectionTitle action={canAddProof && allProofs.length > 0 ? { label: 'Ajouter', onClick: () => standaloneProofRef.current?.click() } : undefined}>
              {allProofs.length > 1 ? `Les preuves (${allProofs.length})` : 'La preuve'}
            </SectionTitle>

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
                        <img src={proof.file_url} alt={proof.file_name || 'Preuve'} className="h-full w-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      </div>
                      <div className="space-y-3 p-4">
                        <Line>{who} {whenSentence(proof.created_at)}.</Line>
                        {proof.file_name && <p className={cn('break-all text-[14px] leading-snug', TEXT.muted)}>{proof.file_name}</p>}
                        <div className="grid grid-cols-2 gap-2">
                          <Button variant="neutral" onClick={() => setFullscreenProof(proof.file_url)}>
                            <Eye />
                            Agrandir
                          </Button>
                          <a href={proof.file_url} download={proof.file_name || 'preuve'} className={cn('inline-flex h-10 items-center justify-center gap-2 px-3 text-[16px] font-medium no-underline [&_svg]:h-5 [&_svg]:w-5', SOFT_PILL)}>
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

        {/* ── La décision ──────────────────────────────────── */}
        <section>
          <SectionTitle>La décision</SectionTitle>
          <Card className="space-y-2">
            {isLocked && (
              <Line>
                {payment.status === 'completed' ? 'Ce paiement est effectué.' : payment.status === 'rejected' ? 'Ce paiement a été refusé.' : 'Ce paiement a été annulé.'}
                {canCancel ? ' Vous pouvez encore l’annuler (le client sera recrédité).' : ' Il n’y a plus rien à faire.'}
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
            {canEditAmounts && !isLocked && (
              <Button className="w-full" variant="neutral" onClick={openAmounts}>
                <Pencil />
                Modifier les montants
              </Button>
            )}
            {canReject && (
              <Button className="w-full" variant="dangerSubtle" onClick={() => setIsRejectOpen(true)}>
                <XCircle />
                Refuser le paiement
              </Button>
            )}
            {canCancel && (
              <Button className="w-full" variant="dangerSubtle" onClick={() => setIsCancelOpen(true)}>
                <Ban />
                {payment.status === 'completed' ? 'Annuler ce paiement effectué' : 'Annuler ce paiement'}
              </Button>
            )}
          </Card>
        </section>

        {/* ── Le détail (replié) ───────────────────────────── */}
        <Fold title="Le détail" open={showDetail} onToggle={() => setShowDetail(!showDetail)}>
          <div className={cn('divide-y', SURFACE.divider)}>
            {infoRows.map((r) => (
              <div key={r.l} className="py-2">
                <p className={cn('text-[14px] leading-snug', TEXT.muted)}>{r.l}</p>
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

      {/* ══ Feuilles basses ══════════════════════════════════ */}

      {/* Refus */}
      <BottomSheet
        open={isRejectOpen}
        onClose={() => { setIsRejectOpen(false); setRejectionCategory(''); setRejectReason(''); }}
        title={<span className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-[#900B09] dark:text-[#FDD3D0]" />Refuser le paiement</span>}
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-[#FDD3D0] p-4 dark:bg-[#900B09]">
            <p className="text-[16px] text-[#900B09] dark:text-[#FDD3D0]">
              Le paiement sera refusé et {formatCurrency(payment.amount_xaf)} recrédités au client.
            </p>
          </div>
          <div>
            <p className={cn('mb-2 text-[16px]', TEXT.muted)}>Motif du refus</p>
            <div className="space-y-2">
              {PAYMENT_REJECTION_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => { setRejectionCategory(reason); if (!rejectReason.trim()) setRejectReason(`Paiement refusé : ${reason.toLowerCase()}.`); }}
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
          <FormField label={<>Message au client <span className="text-[#900B09]">*</span></>} hint="Ce message sera visible par le client">
            <TextArea placeholder="Expliquez pourquoi le paiement est refusé…" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} required />
          </FormField>
          <div className="flex gap-2">
            <SoftPill onClick={() => setIsRejectOpen(false)} className="flex-1">Retour</SoftPill>
            <PrimaryPill onClick={handleReject} loading={processPayment.isPending} disabled={!rejectReason.trim()} danger className="flex-1">
              <XCircle className="h-5 w-5" />
              Refuser
            </PrimaryPill>
          </div>
        </div>
      </BottomSheet>

      {/* Validation */}
      <BottomSheet
        open={isCompleteOpen}
        onClose={() => { setIsCompleteOpen(false); setCompleteProofFile(null); setCompleteProofPreview(null); }}
        title="Confirmer le paiement"
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-[#CFF7D3] p-4 dark:bg-[#02542D]">
            <p className="text-[16px] text-[#02542D] dark:text-[#CFF7D3]">
              Confirmez que <strong>{formatCurrencyRMB(payment.amount_rmb)}</strong> ont bien été envoyés au bénéficiaire.
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
                  type="button"
                  onClick={() => { setCompleteProofFile(null); setCompleteProofPreview(null); if (proofInputRef.current) proofInputRef.current.value = ''; }}
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white"
                  aria-label="Retirer la preuve"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <PasteDropZone onFiles={handlePastedFiles} enabled={false} single title="Collez, glissez ou cliquez" hint="Ctrl+V colle directement la capture du paiement" />
            )}
          </FormField>
          <div className="flex gap-2">
            <SoftPill onClick={() => setIsCompleteOpen(false)} className="flex-1">Retour</SoftPill>
            <PrimaryPill onClick={handleComplete} loading={processPayment.isPending || adminProofUpload.isPending} className="flex-1">
              <CheckCircle className="h-5 w-5" />
              Confirmer
            </PrimaryPill>
          </div>
        </div>
      </BottomSheet>

      {/* Annulation (même effectué) */}
      <BottomSheet
        open={isCancelOpen}
        onClose={() => { setIsCancelOpen(false); setCancelReason(''); }}
        title={<span className="flex items-center gap-2 text-[#900B09] dark:text-[#FDD3D0]"><Ban className="h-5 w-5" />Annuler ce paiement</span>}
      >
        <div className="space-y-4">
          {payment.status === 'completed' ? (
            <div className="rounded-lg bg-[#FDD3D0] p-4 dark:bg-[#900B09]">
              <p className="text-[16px] leading-relaxed text-[#900B09] dark:text-[#FDD3D0]">
                <b>Ce paiement est marqué effectué</b> : l'argent est normalement déjà parti chez le fournisseur.
                L'annuler recrédite quand même <b>{formatCurrency(payment.amount_xaf)}</b> au client et retire l'opération de son relevé.
              </p>
            </div>
          ) : (
            <Line>
              Le paiement sera marqué annulé et <b className={TEXT.strong}>{formatCurrency(payment.amount_xaf)}</b> recrédités au client.
            </Line>
          )}
          <FormField
            label={<>Motif {cancelRequiresReason(payment.status) ? <span className="text-[#900B09]">*</span> : <span className={cn('font-normal', TEXT.muted)}>(recommandé)</span>}</>}
            hint="Conservé sur la fiche et dans l'historique."
          >
            <TextArea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Ex. : facture en double, montant erroné, demande du client…" rows={3} />
          </FormField>
          <div className="flex flex-col gap-2">
            <PrimaryPill
              onClick={handleCancel}
              loading={cancelPayment.isPending}
              disabled={cancelRequiresReason(payment.status) && cancelReason.trim().length < 3}
              danger
              className="w-full"
            >
              Annuler et recréditer {formatCurrency(payment.amount_xaf)}
            </PrimaryPill>
            <SoftPill onClick={() => setIsCancelOpen(false)} className="w-full">Retour</SoftPill>
          </div>
        </div>
      </BottomSheet>

      {/* Montants / taux */}
      <BottomSheet
        open={isAmountsOpen}
        onClose={() => setIsAmountsOpen(false)}
        title={isClosedPayment(payment.status) ? 'Corriger les montants' : 'Modifier les montants'}
      >
        <div className="space-y-4">
          <AmountField id="edit-xaf" label="Client débité (XAF)" currency="XAF" value={editXaf} onValueChange={setEditXaf} max={null} />
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <AmountField id="edit-rmb" label="Fournisseur reçoit (¥)" currency="¥" value={editRmb} onValueChange={setEditRmb} decimals={2} max={null} />
            </div>
            <Button
              variant="neutral"
              ariaLabel="Recalculer les yuans depuis le taux"
              onClick={() => { if ((editXaf ?? 0) > 0 && (editRate ?? 0) > 0) setEditRmb(rmbForXaf(editXaf ?? 0, editRate ?? 0)); }}
              className="h-11 shrink-0"
            >
              <RefreshCw />
            </Button>
          </div>
          <NumberField id="edit-rate" label="Taux (¥ pour 1 000 000 XAF)" value={editRate} onValueChange={setEditRate} hint="Un entier, comme sur l'écran des taux." />

          {!editCoherent && (
            <div className="rounded-lg bg-[#FFF1C2] p-3 text-[14px] leading-relaxed text-[#682D03] dark:bg-[#522504] dark:text-[#FFF1C2]">
              Les trois valeurs ne se tiennent pas : {formatNumber(editXaf ?? 0)} XAF au taux {formatNumber(editRate ?? 0)} font ¥ {formatNumber(rmbForXaf(editXaf ?? 0, editRate ?? 0), 2)}.
            </div>
          )}

          {editDelta.kind === 'debit' && (
            <Line tone="warn">Le client sera débité de <b>{formatCurrency(editDelta.amount)}</b> en plus (jusqu'à son découvert autorisé).</Line>
          )}
          {editDelta.kind === 'credit' && (
            <Line tone="good">Le client sera recrédité de <b>{formatCurrency(editDelta.amount)}</b>.</Line>
          )}
          {editDelta.kind === 'refunded' && (
            <Line>Ce paiement a déjà été remboursé : seule la fiche change, pas le solde.</Line>
          )}

          <FormField label={<>Motif <span className="text-[#900B09]">*</span></>} hint="Visible dans l'historique du paiement.">
            <TextArea value={editReason} onChange={(e) => setEditReason(e.target.value)} placeholder="Ex. : erreur de saisie, taux négocié avec le client…" rows={2} />
          </FormField>

          <div className="flex gap-2">
            <SoftPill onClick={() => setIsAmountsOpen(false)} className="flex-1">Retour</SoftPill>
            <PrimaryPill onClick={handleSaveAmounts} loading={correctPayment.isPending} disabled={!editValid} className="flex-1">
              <CheckCircle className="h-5 w-5" />
              Enregistrer
            </PrimaryPill>
          </div>
        </div>
      </BottomSheet>

      {/* Supprimer une preuve */}
      <BottomSheet
        open={!!proofToDelete}
        onClose={() => setProofToDelete(null)}
        title={<span className="flex items-center gap-2 text-[#900B09] dark:text-[#FDD3D0]"><Trash2 className="h-5 w-5" />Supprimer cette preuve</span>}
      >
        <div className="space-y-4">
          <p className={cn('text-[16px]', TEXT.muted)}>Voulez-vous supprimer cette preuve de paiement ? Cette action est irréversible.</p>
          <div className="flex flex-col gap-2">
            <PrimaryPill
              onClick={() => { if (!proofToDelete) return; deletePaymentProof.mutate(proofToDelete, { onSuccess: () => setProofToDelete(null) }); }}
              loading={deletePaymentProof.isPending}
              danger
              className="w-full"
            >
              Supprimer
            </PrimaryPill>
            <SoftPill onClick={() => setProofToDelete(null)} className="w-full">Retour</SoftPill>
          </div>
        </div>
      </BottomSheet>

      {/* Aperçu plein écran */}
      <BottomSheet open={!!fullscreenProof} onClose={() => setFullscreenProof(null)} title="Aperçu">
        {fullscreenProof && (
          <div className="space-y-3">
            <img src={fullscreenProof} alt="Aperçu" className="w-full rounded-lg" />
            <a href={fullscreenProof} download className={cn('inline-flex h-10 w-full items-center justify-center gap-2 px-3 text-[16px] font-medium no-underline [&_svg]:h-5 [&_svg]:w-5', SOFT_PILL)}>
              <Download />
              Télécharger
            </a>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
