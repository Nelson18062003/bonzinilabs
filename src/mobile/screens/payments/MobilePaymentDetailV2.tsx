// ============================================================
// MODULE PAIEMENTS — MobilePaymentDetail V2
// Présentation migrée sur le design kit (Ofspace/Mola) :
//   canvas doux · DetailHeader · cartes à ombre douce · hero Amount ·
//   StatusPill toné (paymentStatusTone) · CopyRow · bottom-sheets du kit.
// Logique métier 100% préservée de l'ancienne version :
//   bénéficiaire éditable inline (Alipay/WeChat/Virement), QR, preuves
//   upload/delete, signature cash, reject (catégories + message client),
//   complete, annulation, taux XAF/CNY, relevé PDF.
// ============================================================
import { useState, useRef, useMemo } from 'react';
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
import { cn } from '@/lib/utils';
import {
  SURFACE,
  TEXT,
  paymentStatusTone,
  StatusPill,
  Card,
  Amount,
  Row,
  PrimaryPill,
  SoftPill,
  BottomSheet,
  FormField,
  TextInput,
} from '@/mobile/designKit';
import { PaymentMethodLogo } from '@/mobile/components/payments/PaymentMethodLogo';
import { formatCurrency, formatCurrencyRMB, formatNumber } from '@/lib/formatters';
import { getPaymentSlaLevel, type SlaLevel } from '@/lib/paymentSla';
import { SignatureCanvas } from '@/components/cash/SignatureCanvas';
import { CashQRCode } from '@/components/cash/CashQRCode';
import { CashReceiptDownloadButton } from '@/components/cash/CashReceiptDownloadButton';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/clipboard';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Loader2,
  CheckCircle,
  XCircle,
  Play,
  X,
  AlertTriangle,
  Download,
  Upload,
  QrCode,
  Trash2,
  ChevronLeft,
  Copy,
} from 'lucide-react';
import { SkeletonDetail } from '@/mobile/components/ui/SkeletonCard';
import { downloadPDF } from '@/lib/pdf/downloadPDF';
import { PaymentReceiptPDF } from '@/lib/pdf/templates/PaymentReceiptPDF';
import type { PaymentReceiptData } from '@/lib/pdf/templates/PaymentReceiptPDF';

// Map méthode DB → logo (PaymentMethodLogo n'accepte que 4 clés).
function logoMethod(method: string): 'alipay' | 'wechat' | 'bank_transfer' | 'cash' {
  if (method === 'alipay' || method === 'wechat' || method === 'cash') return method;
  return 'bank_transfer';
}

// ── Point SLA (calqué sur deposits/payments V2) ──────────────
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

// ── En-tête simple (back + titre + action) — réutilisé loading/error ──
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

// ── CopyRow: label + value tap-to-copy (sur le kit) ──────────
function CopyRow({
  label,
  value,
  mono,
  highlight,
  multiline,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: string;
  multiline?: boolean;
}) {
  return (
    <button
      onClick={() => copyToClipboard(value, label)}
      style={highlight ? { borderColor: `${highlight}55` } : undefined}
      className={cn(
        'group flex w-full items-start justify-between gap-3 rounded-2xl px-3.5 py-2.5 text-left transition active:scale-[0.99]',
        highlight ? 'ring-1' : SURFACE.canvas,
        !highlight && 'ring-0',
      )}
    >
      <div className="min-w-0 flex-1">
        <div
          className="text-[10px] font-bold uppercase tracking-wider"
          style={highlight ? { color: highlight } : undefined}
        >
          <span className={highlight ? '' : TEXT.muted}>{label}</span>
        </div>
        <div
          className={cn(
            'mt-0.5 text-[14px] font-bold leading-snug',
            mono && 'font-mono tracking-tight',
            multiline ? 'whitespace-pre-wrap break-words' : 'break-words',
            TEXT.strong,
          )}
        >
          {value}
        </div>
      </div>
      <Copy className={cn('mt-0.5 h-3.5 w-3.5 shrink-0 opacity-0 transition group-hover:opacity-60 group-active:opacity-100', TEXT.muted)} />
    </button>
  );
}

// ── Textarea au gabarit kit ──────────────────────────────────
function KitTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, ...rest } = props;
  return (
    <textarea
      className={cn(
        'w-full resize-none rounded-2xl p-3 text-[16px] outline-none transition',
        SURFACE.card,
        SURFACE.shadow,
        TEXT.strong,
        'placeholder:text-[#9B98AD] focus:ring-2 focus:ring-[#C9C2F0] dark:focus:ring-[#4A4660]',
        className,
      )}
      {...rest}
    />
  );
}

// ── Petite pill d'action sur une vignette (Agrandir/Télécharger…) ──
const TILE_BTN =
  'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold transition active:scale-95';

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
    const file = e.target.files?.[0];
    if (!file || !paymentId) return;
    try {
      await adminProofUpload.mutateAsync({ paymentId, file });
      toast.success('Preuve ajoutée');
    } catch { /* handled */ }
    if (standaloneProofRef.current) standaloneProofRef.current.value = '';
  };

  const handleInstructionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !paymentId) return;
    try {
      await instructionUpload.mutateAsync({ paymentId, files: Array.from(files) });
      toast.success(`${files.length} instruction(s) ajoutée(s)`);
    } catch { /* handled */ }
    if (instructionInputRef.current) instructionInputRef.current.value = '';
  };

  const handleCashSignature = async (signatureDataUrl: string) => {
    if (!paymentId) return;
    const signedByName = currentUser
      ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || 'Admin'
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
  const isLocked             = ['completed', 'rejected'].includes(payment.status);
  const isCash               = payment.method === 'cash';
  const canStartProcessing   = canProcess && ['ready_for_payment', 'cash_scanned'].includes(payment.status);
  const canComplete          = canProcess && payment.status === 'processing';
  const canReject            = canProcess && !['completed', 'rejected'].includes(payment.status);
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

  // Couleur de marque de la méthode (accent QR / IDs).
  const methodColor = isCash ? '#E0322B'
    : payment.method === 'alipay' ? '#1677FF'
    : payment.method === 'wechat' ? '#07C160'
    : '#8B5CF6';

  // Main action
  const mainAction = canStartProcessing
    ? { label: 'Passer en cours', tone: 'info' as const, icon: <Play className="h-4 w-4" />, onClick: handleStartProcessing }
    : canComplete
    ? { label: 'Valider le paiement', tone: 'success' as const, icon: <CheckCircle className="h-4 w-4" />, onClick: () => setIsCompleteOpen(true) }
    : null;

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────
  return (
    <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
      <style>{`@keyframes sla-pulse { 0%,100%{opacity:1} 50%{opacity:.3} }`}</style>

      {/* ── Header ────────────────────────────────────────── */}
      <DetailHeader
        title={payment.reference}
        onBack={() => navigate('/m/payments')}
        right={
          <button
            onClick={handleDownloadReceipt}
            disabled={isGeneratingPDF}
            className="flex h-9 items-center gap-1.5 rounded-full bg-[#8B5CF6] px-3.5 text-[12px] font-bold text-white transition active:scale-95 disabled:opacity-60"
          >
            {isGeneratingPDF ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Reçu'}
          </button>
        }
      />

      {/* ── Contenu scrollable ────────────────────────────── */}
      <div className="flex-1 space-y-2.5 overflow-y-auto px-4 pb-8 pt-1">

        {/* ── Statut + Méthode ──────────────────────────────── */}
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2">
            {slaLevel && <SlaDot level={slaLevel} />}
            <StatusPill tone={paymentStatusTone(payment.status)} label={statusConfig.label} />
          </div>
          <div className="flex items-center gap-2">
            <PaymentMethodLogo method={logoMethod(payment.method)} size={22} />
            <span className={cn('text-[12px] font-bold', TEXT.strong)}>{methodLabel}</span>
          </div>
        </div>

        {/* ── Carte montant ─────────────────────────────────── */}
        <Card className="text-center">
          <Amount value={formatCurrencyRMB(payment.amount_rmb)} size="xl" />
          <div className={cn('mt-1.5 text-[14px]', TEXT.muted)}>
            {formatNumber(payment.amount_xaf)} XAF
          </div>
          <div className="mt-3 flex items-center justify-around text-[11px]">
            <div>
              <span className={TEXT.muted}>Taux </span>
              <span className={cn('font-bold', TEXT.strong)}>1M XAF = ¥{formatNumber(rateInt)}</span>
            </div>
            <button
              onClick={() => navigate(`/m/clients/${payment.user_id}`)}
              className="active:opacity-70"
            >
              <span className={TEXT.muted}>Client </span>
              <span className="font-bold text-[#6B5BD2] dark:text-[#A99BF0]">{clientName}</span>
            </button>
          </div>
        </Card>

        {/* ── QR Code cash (cash_pending / cash_scanned) ────── */}
        {isCash && !['completed', 'rejected'].includes(payment.status) && (
          <CashQRCode
            paymentId={payment.id}
            paymentReference={payment.reference}
            amountRMB={payment.amount_rmb}
            beneficiaryName={cashBeneficiaryName}
          />
        )}

        {/* ── Bénéficiaire ──────────────────────────────────── */}
        <Card>
          {/* Header bénéficiaire */}
          <div className="mb-2 flex items-center justify-between">
            <span className={cn('text-[12px] font-extrabold uppercase tracking-wider', TEXT.muted)}>Bénéficiaire</span>
            {hasBeneficiaryInfo && canEditBeneficiary && !editBenef && !isCash && (
              <button onClick={openEdit} className="text-[12px] font-semibold text-[#6B5BD2] dark:text-[#A99BF0]">
                Modifier
              </button>
            )}
          </div>

          {/* ── Mode lecture ─── */}
          {!editBenef && (
            <>
              {/* ÉTAT : infos manquantes */}
              {!hasBeneficiaryInfo && !isCash && (
                <div>
                  <div className="mb-2 rounded-2xl bg-[#F8EFD8] p-3.5 text-center dark:bg-[#372D14]">
                    <div className="text-[13px] font-bold text-[#9A6B12] dark:text-[#E7C083]">Infos manquantes</div>
                    <div className="mt-0.5 text-[11px] text-[#9A6B12]/80 dark:text-[#E7C083]/80">
                      Ajoutez les infos pour traiter ce paiement
                    </div>
                  </div>
                  {canEditBeneficiary && (
                    <PrimaryPill onClick={openEdit} className="w-full">Ajouter</PrimaryPill>
                  )}
                  {missingBeneficiary && (
                    <div className="mt-2 flex items-center gap-2 rounded-2xl bg-[#F8EFD8] px-3 py-2.5 dark:bg-[#372D14]">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-[#9A6B12] dark:text-[#E7C083]" />
                      <span className="text-[11px] font-semibold text-[#9A6B12] dark:text-[#E7C083]">
                        Paiement impossible sans ces infos
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* CASH */}
              {isCash && (
                <div>
                  <div className={cn('text-[15px] font-bold', TEXT.strong)}>{cashBeneficiaryName}</div>
                  <div className={cn('mt-0.5 text-[11px]', TEXT.muted)}>
                    {isCashSelf ? 'Le client' : 'Tiers'}
                    {(payment as { cash_beneficiary_phone?: string | null }).cash_beneficiary_phone && (
                      <> · {(payment as { cash_beneficiary_phone?: string | null }).cash_beneficiary_phone}</>
                    )}
                  </div>
                </div>
              )}

              {/* VIREMENT */}
              {payment.method === 'bank_transfer' && hasBeneficiaryInfo && (
                <div className="flex flex-col gap-2">
                  {payment.beneficiary_name && (
                    <CopyRow label="Titulaire" value={payment.beneficiary_name} />
                  )}
                  {payment.beneficiary_bank_name && (
                    <CopyRow label="Banque" value={payment.beneficiary_bank_name} />
                  )}
                  {payment.beneficiary_bank_account && (
                    <CopyRow label="N° de compte" value={payment.beneficiary_bank_account} mono />
                  )}
                  {(payment as { beneficiary_bank_extra?: string | null }).beneficiary_bank_extra && (
                    <CopyRow
                      label="SWIFT / IBAN"
                      value={(payment as { beneficiary_bank_extra?: string | null }).beneficiary_bank_extra as string}
                      mono
                    />
                  )}
                  {payment.beneficiary_phone && (
                    <CopyRow label="Téléphone" value={payment.beneficiary_phone} />
                  )}
                  {payment.beneficiary_email && (
                    <CopyRow label="Email" value={payment.beneficiary_email} />
                  )}
                  {payment.beneficiary_notes && (
                    <CopyRow label="Notes" value={payment.beneficiary_notes} multiline />
                  )}
                </div>
              )}

              {/* ALIPAY / WECHAT */}
              {(payment.method === 'alipay' || payment.method === 'wechat') && hasBeneficiaryInfo && (
                <div className="flex flex-col gap-2">
                  {payment.beneficiary_name && (
                    <CopyRow label="Nom" value={payment.beneficiary_name} />
                  )}
                  {(payment as { beneficiary_identifier?: string | null }).beneficiary_identifier && (
                    <CopyRow
                      label={payment.method === 'wechat' ? 'WeChat ID' : 'Alipay ID'}
                      value={(payment as { beneficiary_identifier?: string | null }).beneficiary_identifier as string}
                      mono
                      highlight={methodColor}
                    />
                  )}
                  {payment.beneficiary_phone && (
                    <CopyRow label="Téléphone" value={payment.beneficiary_phone} />
                  )}
                  {payment.beneficiary_email && (
                    <CopyRow label="Email" value={payment.beneficiary_email} />
                  )}
                  {payment.beneficiary_notes && (
                    <CopyRow label="Notes" value={payment.beneficiary_notes} multiline />
                  )}

                  {/* QR Code controls */}
                  {payment.beneficiary_qr_code_url && (
                    <>
                      <div className="mt-1 flex gap-2">
                        <button
                          onClick={() => setShowQR(v => !v)}
                          style={{ background: `${methodColor}15`, color: methodColor }}
                          className={TILE_BTN}
                        >
                          {showQR ? 'Masquer QR' : 'Voir QR'}
                        </button>
                        {canEditBeneficiary && (
                          <button
                            onClick={() => qrInputRef.current?.click()}
                            className={cn(TILE_BTN, SURFACE.canvas, TEXT.muted)}
                          >
                            Changer QR
                          </button>
                        )}
                      </div>
                      {showQR && (
                        <div className={cn('mt-1 overflow-hidden rounded-2xl', SURFACE.canvas)}>
                          <img
                            src={payment.beneficiary_qr_code_url}
                            alt="QR Code bénéficiaire"
                            className="max-h-[220px] w-full bg-white object-contain"
                          />
                          <div className="flex gap-2 p-2">
                            <button
                              onClick={() => setFullscreenProof(payment.beneficiary_qr_code_url)}
                              className={cn(TILE_BTN, SURFACE.card, SURFACE.shadow, TEXT.muted)}
                            >
                              Agrandir
                            </button>
                            <a
                              href={payment.beneficiary_qr_code_url}
                              download="qr-code-beneficiaire"
                              className={cn(TILE_BTN, SURFACE.card, SURFACE.shadow, TEXT.muted)}
                            >
                              Télécharger
                            </a>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {!payment.beneficiary_qr_code_url && canEditBeneficiary && (
                    <button
                      onClick={() => qrInputRef.current?.click()}
                      className={cn(
                        'mt-1 flex w-full items-center justify-center gap-1.5 rounded-2xl py-2.5 text-[12px] font-semibold ring-1 ring-dashed ring-black/15 dark:ring-white/15',
                        TEXT.muted,
                      )}
                    >
                      <QrCode className="h-4 w-4" />
                      Ajouter un QR code
                    </button>
                  )}

                  {/* Input QR caché (pour "Changer QR" sans ouvrir edit form) */}
                  <input
                    ref={qrInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !paymentId) return;
                      setIsUploadingQr(true);
                      try {
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
                      } catch {
                        toast.error('Erreur lors de l\'upload du QR code');
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
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setQrFile(file);
                        const reader = new FileReader();
                        reader.onloadend = () => setQrPreview(reader.result as string);
                        reader.readAsDataURL(file);
                      }}
                      id="qr-edit-input"
                    />
                    {qrPreview || beneficiaryForm.beneficiary_qr_code_url ? (
                      <div className={cn('relative overflow-hidden rounded-2xl', SURFACE.canvas)}>
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
                      <label
                        htmlFor="qr-edit-input"
                        className={cn(
                          'flex w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl py-4 text-[12px] font-bold ring-1 ring-dashed ring-black/15 dark:ring-white/15',
                          TEXT.muted,
                        )}
                      >
                        <QrCode className="h-5 w-5" />
                        Importer le QR Code
                      </label>
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
                    <KitTextarea
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
                  <FormField label={<>Titulaire <span className="text-[#C0504D]">*</span></>}>
                    <TextInput
                      value={beneficiaryForm.beneficiary_name}
                      onChange={e => setBeneficiaryForm(f => ({ ...f, beneficiary_name: e.target.value }))}
                      placeholder="Nom complet"
                      autoComplete="off"
                    />
                  </FormField>
                  <FormField label={<>Banque <span className="text-[#C0504D]">*</span></>}>
                    <TextInput
                      value={beneficiaryForm.beneficiary_bank_name}
                      onChange={e => setBeneficiaryForm(f => ({ ...f, beneficiary_bank_name: e.target.value }))}
                      placeholder="Bank of China, ICBC…"
                      autoComplete="off"
                    />
                  </FormField>
                  <FormField label={<>N° de compte <span className="text-[#C0504D]">*</span></>}>
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
                    <KitTextarea
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

        {/* ── Preuves OU Signature (selon mode) ─────────────── */}
        {isCash ? (
          /* ─── CASH : bloc signature ─── */
          <Card>
            <span className={cn('mb-2 block text-[12px] font-extrabold uppercase tracking-wider', TEXT.muted)}>Signature</span>

            {/* Signature existante */}
            {(payment as { cash_signature_url?: string | null }).cash_signature_url ? (
              <div>
                <img
                  src={(payment as { cash_signature_url?: string | null }).cash_signature_url!}
                  alt="Signature"
                  className={cn('max-h-[100px] w-full rounded-2xl bg-white object-contain', SURFACE.shadow)}
                />
                <div className={cn('mt-1.5 text-[10px]', TEXT.muted)}>
                  {(payment as { cash_signature_url?: string | null; cash_paid_at?: string | null }).cash_paid_at
                    ? `Signé le ${format(new Date((payment as { cash_paid_at?: string | null }).cash_paid_at!), 'dd MMM yyyy à HH:mm', { locale: fr })}`
                    : 'Signature capturée'}
                  {(payment as { cash_signed_by_name?: string | null }).cash_signed_by_name && (
                    <> · {(payment as { cash_signed_by_name?: string | null }).cash_signed_by_name}</>
                  )}
                </div>
                {/* Reçu PDF pour cash complété */}
                {payment.status === 'completed' && (
                  <div className="mt-2">
                    <CashReceiptDownloadButton
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      payment={payment as any}
                      variant="outline"
                      size="sm"
                      label="Télécharger le reçu PDF"
                    />
                  </div>
                )}
              </div>
            ) : signing ? (
              /* Zone de signature active */
              <SignatureCanvas
                onSave={handleCashSignature}
                onCancel={() => setSigning(false)}
                isLoading={confirmCash.isPending}
              />
            ) : (
              /* Pas encore signé */
              <div>
                <div className={cn('mb-2 rounded-2xl p-4 text-center', SURFACE.canvas)}>
                  <div className={cn('text-[12px]', TEXT.muted)}>
                    Le bénéficiaire doit signer avant la remise des fonds
                  </div>
                </div>
                {!isLocked && (
                  <button
                    onClick={() => setSigning(true)}
                    className="w-full rounded-full bg-[#E0322B] py-3 text-[13px] font-bold text-white transition active:scale-[0.99]"
                  >
                    Faire signer
                  </button>
                )}
              </div>
            )}
          </Card>
        ) : (
          /* ─── NON-CASH : preuves ─── */
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <span className={cn('text-[12px] font-extrabold uppercase tracking-wider', TEXT.muted)}>
                Preuves ({allProofs.length})
              </span>
              {canAddProof && (
                <button
                  onClick={() => standaloneProofRef.current?.click()}
                  disabled={adminProofUpload.isPending}
                  className="text-[12px] font-semibold text-[#6B5BD2] dark:text-[#A99BF0]"
                >
                  {adminProofUpload.isPending ? <Loader2 className="inline h-3 w-3 animate-spin" /> : '+ Ajouter'}
                </button>
              )}
            </div>

            {/* Warning preuve manquante */}
            {missingAdminProof && (
              <div className="mb-2 flex items-center gap-2 rounded-2xl bg-[#F8EFD8] px-3 py-2.5 dark:bg-[#372D14]">
                <AlertTriangle className="h-4 w-4 shrink-0 text-[#9A6B12] dark:text-[#E7C083]" />
                <span className="text-[11px] font-semibold text-[#9A6B12] dark:text-[#E7C083]">
                  Ajoutez une preuve avant de valider
                </span>
              </div>
            )}

            {/* Input upload caché */}
            <input
              ref={standaloneProofRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleStandaloneProofUpload}
            />

            {allProofs.length === 0 ? (
              <div>
                <div className={cn('rounded-2xl p-3.5 text-center', SURFACE.canvas)}>
                  <div className={cn('text-[12px]', TEXT.muted)}>Aucune preuve ajoutée</div>
                </div>
                {canAddProof && (
                  <button
                    onClick={() => standaloneProofRef.current?.click()}
                    disabled={adminProofUpload.isPending}
                    className="mt-2 w-full rounded-2xl py-2.5 text-[12px] font-bold text-[#6B5BD2] ring-1 ring-[#6B5BD2]/25 dark:text-[#A99BF0] dark:ring-[#A99BF0]/25"
                  >
                    + Ajouter une preuve
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {allProofs.map((proof) => {
                  const isAdminProof = proof.uploaded_by_type === 'admin';
                  const canDeleteThis = canProcess && (isAdminProof || isSuperAdmin) && (!isLocked || isSuperAdmin);
                  return (
                    <div key={proof.id} className={cn('overflow-hidden rounded-2xl', SURFACE.canvas)}>
                      {/* Preview */}
                      <div className="relative aspect-[16/9] w-full bg-gradient-to-br from-[#e8eef6] to-[#f0ecf8] dark:from-[#272233] dark:to-[#2A2536]">
                        <img
                          src={proof.file_url}
                          alt={proof.file_name || 'Preuve'}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        {/* Badge type */}
                        <div className={cn('absolute left-2 top-2 rounded-full bg-white/85 px-2 py-0.5 text-[9px] font-bold dark:bg-black/55', TEXT.muted)}>
                          {proof.file_name ? proof.file_name.slice(0, 20) : 'Preuve'}
                          {!isAdminProof && ' · Client'}
                        </div>
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-2 p-2">
                        <button
                          onClick={() => setFullscreenProof(proof.file_url)}
                          className={cn(TILE_BTN, SURFACE.card, SURFACE.shadow, TEXT.muted)}
                        >
                          Agrandir
                        </button>
                        <a
                          href={proof.file_url}
                          download={proof.file_name || 'preuve'}
                          className={cn(TILE_BTN, SURFACE.card, SURFACE.shadow, TEXT.muted)}
                        >
                          Télécharger
                        </a>
                        {canDeleteThis && (
                          <>
                            <span className="flex-1" />
                            <button
                              onClick={() => setProofToDelete(proof.id)}
                              className={cn(TILE_BTN, 'bg-[#FBE7E7] text-[#C0504D] dark:bg-[#3A2526] dark:text-[#E79A9A]')}
                            >
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

            {/* Instructions upload */}
            {canAddProof && (
              <>
                <input
                  ref={instructionInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  className="hidden"
                  onChange={handleInstructionUpload}
                />
                {instructionProofs.length === 0 && (
                  <button
                    onClick={() => instructionInputRef.current?.click()}
                    disabled={instructionUpload.isPending}
                    className={cn('mt-2 w-full rounded-2xl py-2 text-[11px] font-semibold ring-1 ring-black/[0.08] dark:ring-white/[0.08]', TEXT.muted)}
                  >
                    {instructionUpload.isPending
                      ? <Loader2 className="inline h-3 w-3 animate-spin" />
                      : '+ Ajouter une instruction'}
                  </button>
                )}
              </>
            )}
          </Card>
        )}

        {/* ── Infos ─────────────────────────────────────────── */}
        <Card className="py-2">
          {([
            { l: 'Référence', v: payment.reference },
            {
              l: 'Date',
              v: format(new Date(payment.created_at), 'dd MMM yyyy, HH:mm', { locale: fr }),
            },
            payment.processed_at ? {
              l: 'Traité le',
              v: format(new Date(payment.processed_at), 'dd MMM yyyy, HH:mm', { locale: fr }),
            } : null,
            payment.rejection_reason ? {
              l: 'Motif refus',
              v: payment.rejection_reason,
              danger: true,
            } : null,
            payment.admin_comment ? {
              l: 'Commentaire',
              v: payment.admin_comment,
            } : null,
          ].filter(Boolean) as { l: string; v: string; danger?: boolean }[]).map((row, i) => (
            <Row
              key={i}
              label={row.l}
              value={
                <span className={row.danger ? 'text-[#C0504D] dark:text-[#E79A9A]' : undefined}>{row.v}</span>
              }
            />
          ))}
        </Card>

        {/* ── Actions ───────────────────────────────────────── */}
        {(mainAction || canReject || canDelete) && (
          <div className="flex flex-col gap-2 pt-1">
            {mainAction && (
              <PrimaryPill
                onClick={mainAction.onClick}
                loading={processPayment.isPending}
                className={cn(
                  'w-full',
                  mainAction.tone === 'info'
                    ? 'bg-[#6B5BD2] text-white dark:bg-[#6B5BD2] dark:text-white'
                    : 'bg-[#10B981] text-white dark:bg-[#10B981] dark:text-white',
                )}
              >
                {mainAction.icon}
                {mainAction.label}
              </PrimaryPill>
            )}
            {canReject && (
              <button
                onClick={() => setIsRejectOpen(true)}
                className="w-full rounded-full py-3 text-[12px] font-semibold text-[#C0504D] ring-1 ring-[#C0504D]/20 transition active:scale-[0.99] dark:text-[#E79A9A] dark:ring-[#E79A9A]/20"
              >
                Refuser
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => setIsDeletePaymentOpen(true)}
                className={cn('w-full rounded-full py-3 text-[11px] font-semibold ring-1 ring-black/[0.08] transition active:scale-[0.99] dark:ring-white/[0.08]', TEXT.muted)}
              >
                Annuler ce paiement
              </button>
            )}
          </div>
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
            <AlertTriangle className="h-5 w-5 text-[#C0504D] dark:text-[#E79A9A]" />
            Rejeter le paiement
          </span>
        }
      >
        <div className="space-y-4">
          <div className="rounded-2xl bg-[#FBE7E7] p-4 dark:bg-[#3A2526]">
            <p className="text-[13px] text-[#C0504D] dark:text-[#E79A9A]">
              Cette action va rejeter le paiement et rembourser {formatCurrency(payment.amount_xaf)} au wallet du client.
            </p>
          </div>
          <div>
            <p className={cn('mb-2 text-[13px]', TEXT.muted)}>Motif du refus</p>
            <div className="space-y-2">
              {PAYMENT_REJECTION_REASONS.map((reason) => (
                <button
                  key={reason}
                  onClick={() => {
                    setRejectionCategory(reason);
                    if (!rejectReason.trim()) setRejectReason(`Paiement refusé : ${reason.toLowerCase()}.`);
                  }}
                  className={cn(
                    'w-full rounded-2xl p-3 text-left text-[13px] ring-1 transition-all',
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
          <FormField label={<>Message au client <span className="text-[#C0504D]">*</span></>}>
            <KitTextarea
              placeholder="Expliquez pourquoi le paiement est rejeté..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              required
            />
            <p className={cn('mt-1 text-[10px]', TEXT.muted)}>Ce message sera visible par le client</p>
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
          <div className="rounded-2xl bg-[#DEEFE5] p-4 dark:bg-[#1E3A2C]">
            <p className="text-[13px] text-[#2E7D52] dark:text-[#7FCBA0]">
              Confirmez que le paiement de <strong>{formatCurrencyRMB(payment.amount_rmb)}</strong> a été effectué au bénéficiaire.
            </p>
          </div>
          <FormField label="Preuve de paiement (optionnel)">
            <input
              ref={proofInputRef}
              type="file"
              accept="image/*"
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
                <img src={completeProofPreview} alt="Preuve" className={cn('h-40 w-full rounded-2xl object-cover', SURFACE.shadow)} />
                <button
                  onClick={() => { setCompleteProofFile(null); setCompleteProofPreview(null); if (proofInputRef.current) proofInputRef.current.value = ''; }}
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => proofInputRef.current?.click()}
                className={cn('flex h-24 w-full flex-col items-center justify-center gap-2 rounded-2xl ring-1 ring-dashed ring-black/15 transition active:scale-[0.99] dark:ring-white/15', TEXT.muted)}
              >
                <Upload className="h-6 w-6" />
                <span className="text-[13px]">Ajouter une preuve</span>
              </button>
            )}
          </FormField>
          <div className="flex gap-2">
            <SoftPill onClick={() => setIsCompleteOpen(false)} className="flex-1">Annuler</SoftPill>
            <PrimaryPill
              onClick={handleComplete}
              loading={processPayment.isPending || adminProofUpload.isPending}
              className="flex-1 bg-[#10B981] text-white dark:bg-[#10B981] dark:text-white"
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
          <span className="flex items-center gap-2 text-[#C0504D] dark:text-[#E79A9A]">
            <Trash2 className="h-5 w-5" />
            Annuler ce paiement
          </span>
        }
      >
        <div className="space-y-4">
          <p className={cn('text-[13px]', TEXT.muted)}>
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
          <span className="flex items-center gap-2 text-[#C0504D] dark:text-[#E79A9A]">
            <Trash2 className="h-5 w-5" />
            Supprimer cette preuve
          </span>
        }
      >
        <div className="space-y-4">
          <p className={cn('text-[13px]', TEXT.muted)}>
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
            <img src={fullscreenProof} alt="Aperçu" className="w-full rounded-2xl" />
            <a
              href={fullscreenProof}
              download
              className={cn('flex h-12 w-full items-center justify-center gap-2 rounded-full text-[14px] font-semibold transition active:scale-[0.99]', SURFACE.canvas, TEXT.strong)}
            >
              <Download className="h-4 w-4" />
              Télécharger
            </a>
          </div>
        )}
      </BottomSheet>

    </div>
  );
}
