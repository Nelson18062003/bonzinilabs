// ============================================================
// MODULE PAIEMENTS — MobilePaymentDetail V2
// Redesign basé sur maquette_admin_fiche_paiement_v4.jsx
// UI épurée, logique métier 100% préservée de l'ancienne version.
// ============================================================
import { useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { compressImage } from '@/lib/imageCompression';
import {
  useAdminPaymentDetail,
  useAdminPaymentTimeline,
  useAdminPaymentProofs,
  useProcessPayment,
  useAdminUploadPaymentProof,
  useAdminUpdateBeneficiaryInfo,
} from '@/hooks/usePayments';
import { useDeletePayment, useDeletePaymentProof } from '@/hooks/useAdminPayments';
import { useAdminUploadPaymentInstruction } from '@/hooks/usePaymentProofUpload';
import { useAgentConfirmCashPayment } from '@/hooks/useAgentCashActions';
import {
  PAYMENT_STATUS_CONFIG,
  PAYMENT_METHOD_LABELS,
  PAYMENT_REJECTION_REASONS,
} from '@/types/payment';
import type { PaymentStatus, PaymentMethod } from '@/types/payment';
import { formatCurrency, formatCurrencyRMB, formatNumber } from '@/lib/formatters';
import { getPaymentSlaLevel } from '@/lib/paymentSla';
import { SignatureCanvas } from '@/components/cash/SignatureCanvas';
import { CashQRCode } from '@/components/cash/CashQRCode';
import { CashReceiptDownloadButton } from '@/components/cash/CashReceiptDownloadButton';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
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
  ZoomIn,
  FileDown,
} from 'lucide-react';
import { SkeletonDetail } from '@/mobile/components/ui/SkeletonCard';
import { downloadPDF } from '@/lib/pdf/downloadPDF';
import { PaymentReceiptPDF } from '@/lib/pdf/templates/PaymentReceiptPDF';
import type { PaymentReceiptData } from '@/lib/pdf/templates/PaymentReceiptPDF';

// ── Design tokens (maquette v4) ──────────────────────────────
const C = {
  V:      '#A947FE',  // violet – primaire
  G:      '#F3A745',  // or    – warning
  O:      '#FE560D',  // orange – cash
  GR:     '#34d399',  // vert   – terminé
  RED:    '#ef4444',  // rouge  – refus/suppr
  AL:     '#1677ff',  // alipay
  WC:     '#07c160',  // wechat
  bg:     '#f8f6fa',
  card:   '#ffffff',
  text:   '#1a1028',
  sub:    '#7a7290',
  dim:    '#c4bdd0',
  border: '#ebe6f0',
} as const;

// ── Statut → couleur ─────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  created:                  C.dim,
  waiting_beneficiary_info: C.G,
  ready_for_payment:        '#3b82f6',
  processing:               C.V,
  completed:                C.GR,
  rejected:                 C.RED,
  cash_pending:             C.G,
  cash_scanned:             C.V,
};

// ── Méthode → icône + couleur ────────────────────────────────
const METHOD_CFG: Record<string, { icon: string; color: string }> = {
  alipay:        { icon: '支', color: C.AL },
  wechat:        { icon: '微', color: C.WC },
  bank_transfer: { icon: 'B',  color: C.V  },
  cash:          { icon: '¥',  color: C.O  },
};

// ── Style input inline bénéficiaire ──────────────────────────
// fontSize must stay ≥ 16 so iOS Safari doesn't zoom on focus.
const INP: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 10,
  border: `1.5px solid ${C.border}`, background: C.bg,
  fontSize: 16, fontWeight: 600, color: C.text,
  fontFamily: "'DM Sans',sans-serif", outline: 'none', boxSizing: 'border-box',
};

// ── CopyRow: label + value tap-to-copy (lisible, complet, monospace opt-in)
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
  const onCopy = () => {
    copyToClipboard(value, label);
  };
  return (
    <button
      onClick={onCopy}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 3,
        padding: '8px 10px',
        borderRadius: 10,
        background: highlight ? `${highlight}08` : C.bg,
        border: `1px solid ${highlight ? `${highlight}30` : C.border}`,
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: highlight || C.sub,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: mono ? 15 : 14,
          fontWeight: 700,
          color: C.text,
          fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : "'DM Sans',sans-serif",
          letterSpacing: mono ? 0.3 : 0,
          wordBreak: 'break-word',
          whiteSpace: multiline ? 'pre-wrap' : 'normal',
          lineHeight: 1.3,
        }}
      >
        {value}
      </div>
    </button>
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
  const { data: timeline }           = useAdminPaymentTimeline(paymentId);
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
      let qrUrl = beneficiaryForm.beneficiary_qr_code_url;

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
      <div className="flex flex-col min-h-screen">
        <MobileHeader title="Paiement" showBack backTo="/m/payments" />
        <SkeletonDetail />
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="flex flex-col min-h-screen">
        <MobileHeader title="Paiement" showBack backTo="/m/payments" />
        <div className="flex-1 flex items-center justify-center p-4">
          <p style={{ color: C.sub }}>Paiement non trouvé</p>
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
  const methodCfg    = METHOD_CFG[payment.method] || { icon: '?', color: C.dim };
  const statusColor  = STATUS_COLOR[payment.status] || C.dim;
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

  // Main action
  const mainAction = canStartProcessing
    ? { label: 'Passer en cours', color: C.V, icon: <Play className="w-4 h-4" />, onClick: handleStartProcessing }
    : canComplete
    ? { label: 'Valider le paiement', color: C.GR, icon: <CheckCircle className="w-4 h-4" />, onClick: () => setIsCompleteOpen(true) }
    : null;

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: "'DM Sans',sans-serif", maxWidth: 480, margin: '0 auto' }}>

      {/* ── Header ────────────────────────────────────────── */}
      <MobileHeader
        title={payment.reference}
        showBack
        backTo="/m/payments"
        rightElement={
          <button
            onClick={handleDownloadReceipt}
            disabled={isGeneratingPDF}
            style={{ padding: '5px 12px', borderRadius: 7, background: C.V, border: 'none', fontSize: 11, fontWeight: 700, color: '#fff', cursor: 'pointer', opacity: isGeneratingPDF ? 0.6 : 1 }}
          >
            {isGeneratingPDF ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : 'Reçu'}
          </button>
        }
      />

      {/* ── Contenu scrollable ────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '0 16px 24px' }}>

        {/* ── Statut + Méthode ──────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {slaLevel && (
              <span className={`sla-dot sla-${slaLevel}${slaLevel === 'overdue' ? ' animate' : ''}`} />
            )}
            <span style={{
              padding: '4px 10px', borderRadius: 6,
              background: `${statusColor}18`,
              fontSize: 12, fontWeight: 800, color: statusColor,
            }}>
              {statusConfig.label}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              width: 22, height: 22, borderRadius: 5,
              background: `${methodCfg.color}15`,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 800, color: methodCfg.color,
            }}>
              {methodCfg.icon}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700 }}>{methodLabel}</span>
          </div>
        </div>

        {/* ── Carte montant ─────────────────────────────────── */}
        <div style={{
          padding: '20px 16px', borderRadius: 14,
          background: C.card, border: `1px solid ${C.border}`,
          textAlign: 'center', marginBottom: 8,
        }}>
          <div style={{ fontSize: 38, fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1 }}>
            {formatCurrencyRMB(payment.amount_rmb)}
          </div>
          <div style={{ fontSize: 14, color: C.sub, marginTop: 6 }}>
            {formatNumber(payment.amount_xaf)} XAF
          </div>
          <div style={{ height: 1, background: C.border, margin: '12px 32px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: 11 }}>
            <div>
              <span style={{ color: C.dim }}>Taux </span>
              <span style={{ fontWeight: 700 }}>1M XAF = ¥{formatNumber(rateInt)}</span>
            </div>
            <button
              onClick={() => navigate(`/m/clients/${payment.user_id}`)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <span style={{ color: C.dim }}>Client </span>
              <span style={{ fontWeight: 700, color: C.V }}>{clientName}</span>
            </button>
          </div>
        </div>

        {/* ── QR Code cash (cash_pending / cash_scanned) ────── */}
        {isCash && !['completed', 'rejected'].includes(payment.status) && (
          <div style={{ marginBottom: 8 }}>
            <CashQRCode
              paymentId={payment.id}
              paymentReference={payment.reference}
              amountRMB={payment.amount_rmb}
              beneficiaryName={cashBeneficiaryName}
            />
          </div>
        )}

        {/* ── Bénéficiaire ──────────────────────────────────── */}
        <div style={{
          padding: '12px 14px', borderRadius: 12,
          background: C.card, border: `1px solid ${C.border}`, marginBottom: 8,
        }}>
          {/* Header bénéficiaire */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 800 }}>Bénéficiaire</span>
            {hasBeneficiaryInfo && canEditBeneficiary && !editBenef && !isCash && (
              <button
                onClick={openEdit}
                style={{ fontSize: 10, fontWeight: 600, color: C.V, background: 'none', border: 'none', cursor: 'pointer' }}
              >
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
                  <div style={{
                    padding: 14, borderRadius: 8, textAlign: 'center',
                    border: `2px dashed ${C.G}30`, background: `${C.G}05`, marginBottom: 6,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>Infos manquantes</div>
                    <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>
                      Ajoutez les infos pour traiter ce paiement
                    </div>
                  </div>
                  {canEditBeneficiary && (
                    <button
                      onClick={openEdit}
                      style={{
                        width: '100%', padding: 10, borderRadius: 8,
                        background: C.V, border: 'none',
                        fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer',
                      }}
                    >
                      Ajouter
                    </button>
                  )}
                  {missingBeneficiary && (
                    <div style={{
                      marginTop: 6, display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 10px', borderRadius: 8,
                      background: `${C.G}10`, border: `1px solid ${C.G}30`,
                    }}>
                      <AlertTriangle className="w-4 h-4" style={{ color: C.G, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: C.G, fontWeight: 600 }}>
                        Paiement impossible sans ces infos
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* CASH */}
              {isCash && (
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{cashBeneficiaryName}</div>
                  <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>
                    {isCashSelf ? 'Le client' : 'Tiers'}
                    {(payment as { cash_beneficiary_phone?: string | null }).cash_beneficiary_phone && (
                      <> · {(payment as { cash_beneficiary_phone?: string | null }).cash_beneficiary_phone}</>
                    )}
                  </div>
                </div>
              )}

              {/* VIREMENT */}
              {payment.method === 'bank_transfer' && hasBeneficiaryInfo && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                  {payment.beneficiary_name && (
                    <CopyRow label="Titulaire" value={payment.beneficiary_name} />
                  )}
                  {payment.beneficiary_bank_name && (
                    <CopyRow label="Banque" value={payment.beneficiary_bank_name} />
                  )}
                  {payment.beneficiary_bank_account && (
                    <CopyRow
                      label="N° de compte"
                      value={payment.beneficiary_bank_account}
                      mono
                    />
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                  {payment.beneficiary_name && (
                    <CopyRow label="Nom" value={payment.beneficiary_name} />
                  )}
                  {(payment as { beneficiary_identifier?: string | null }).beneficiary_identifier && (
                    <CopyRow
                      label={payment.method === 'wechat' ? 'WeChat ID' : 'Alipay ID'}
                      value={(payment as { beneficiary_identifier?: string | null }).beneficiary_identifier as string}
                      mono
                      highlight={methodCfg.color}
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
                      <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                        <button
                          onClick={() => setShowQR(v => !v)}
                          style={{
                            padding: '4px 10px', borderRadius: 5,
                            background: `${methodCfg.color}08`, border: `1px solid ${methodCfg.color}15`,
                            fontSize: 10, fontWeight: 700, color: methodCfg.color, cursor: 'pointer',
                          }}
                        >
                          {showQR ? 'Masquer QR' : 'Voir QR'}
                        </button>
                        {canEditBeneficiary && (
                          <button
                            onClick={() => qrInputRef.current?.click()}
                            style={{
                              padding: '4px 8px', borderRadius: 5,
                              background: 'none', border: `1px solid ${C.border}`,
                              fontSize: 10, fontWeight: 600, color: C.sub, cursor: 'pointer',
                            }}
                          >
                            Changer QR
                          </button>
                        )}
                      </div>
                      {showQR && (
                        <div style={{
                          marginTop: 8, borderRadius: 10, overflow: 'hidden',
                          border: `1px solid ${C.border}`, background: C.bg,
                        }}>
                          <img
                            src={payment.beneficiary_qr_code_url}
                            alt="QR Code bénéficiaire"
                            style={{ width: '100%', maxHeight: 220, objectFit: 'contain', background: '#fff' }}
                          />
                          <div style={{ display: 'flex', gap: 4, padding: '6px 8px' }}>
                            <button
                              onClick={() => setFullscreenProof(payment.beneficiary_qr_code_url)}
                              style={{ padding: '3px 8px', borderRadius: 4, background: 'none', border: `1px solid ${C.border}`, fontSize: 9, fontWeight: 600, color: C.sub, cursor: 'pointer' }}
                            >
                              Agrandir
                            </button>
                            <a
                              href={payment.beneficiary_qr_code_url}
                              download="qr-code-beneficiaire"
                              style={{ padding: '3px 8px', borderRadius: 4, background: 'none', border: `1px solid ${C.border}`, fontSize: 9, fontWeight: 600, color: C.sub, textDecoration: 'none' }}
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
                      style={{
                        marginTop: 8, width: '100%', padding: 10, borderRadius: 8,
                        background: 'none', border: `1.5px dashed ${C.border}`,
                        fontSize: 11, fontWeight: 600, color: C.sub, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                      }}
                    >
                      <QrCode className="w-4 h-4" />
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* ALIPAY / WECHAT */}
              {(payment.method === 'alipay' || payment.method === 'wechat') && (
                <>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                      Nom <span style={{ fontWeight: 400, color: C.dim }}>(optionnel)</span>
                    </label>
                    <input
                      style={INP}
                      value={beneficiaryForm.beneficiary_name}
                      onChange={e => setBeneficiaryForm(f => ({ ...f, beneficiary_name: e.target.value }))}
                      placeholder="Nom du bénéficiaire"
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                      QR Code
                    </label>
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
                      <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.border}` }}>
                        <img
                          src={qrPreview ?? beneficiaryForm.beneficiary_qr_code_url}
                          alt="QR"
                          style={{ width: '100%', maxHeight: 160, objectFit: 'contain', background: '#fff' }}
                        />
                        <button
                          onClick={() => { setQrFile(null); setQrPreview(null); setBeneficiaryForm(f => ({ ...f, beneficiary_qr_code_url: '' })); }}
                          style={{ position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <X className="w-4 h-4" style={{ color: '#fff' }} />
                        </button>
                      </div>
                    ) : (
                      <label
                        htmlFor="qr-edit-input"
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          gap: 4, width: '100%', padding: '14px 10px', borderRadius: 8,
                          border: `2px dashed ${C.border}`, background: C.bg, cursor: 'pointer',
                          fontSize: 12, fontWeight: 700, color: C.sub,
                        }}
                      >
                        <QrCode className="w-5 h-5" />
                        Importer le QR Code
                      </label>
                    )}
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                      ID {methodLabel} <span style={{ fontWeight: 400, color: C.dim }}>(téléphone)</span>
                    </label>
                    <input
                      style={INP}
                      type="tel"
                      value={beneficiaryForm.beneficiary_phone}
                      onChange={e => setBeneficiaryForm(f => ({ ...f, beneficiary_phone: e.target.value }))}
                      placeholder="+86 138 0000 0000"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                      Email <span style={{ fontWeight: 400, color: C.dim }}>(optionnel)</span>
                    </label>
                    <input
                      style={INP}
                      type="email"
                      value={beneficiaryForm.beneficiary_email}
                      onChange={e => setBeneficiaryForm(f => ({ ...f, beneficiary_email: e.target.value }))}
                      placeholder="beneficiaire@example.com"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                      Identifiant {payment.method === 'wechat' ? 'WeChat' : 'Alipay'}{' '}
                      <span style={{ fontWeight: 400, color: C.dim }}>(optionnel)</span>
                    </label>
                    <input
                      style={INP}
                      value={beneficiaryForm.beneficiary_identifier}
                      onChange={e => setBeneficiaryForm(f => ({ ...f, beneficiary_identifier: e.target.value }))}
                      placeholder={payment.method === 'wechat' ? 'WeChat ID / 微信号' : 'Alipay ID / 支付宝账号'}
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                      Notes <span style={{ fontWeight: 400, color: C.dim }}>(optionnel)</span>
                    </label>
                    <textarea
                      style={{ ...INP, height: 72, resize: 'none' }}
                      value={beneficiaryForm.beneficiary_notes}
                      onChange={e => setBeneficiaryForm(f => ({ ...f, beneficiary_notes: e.target.value }))}
                      placeholder="Instructions supplémentaires…"
                      rows={3}
                    />
                  </div>
                </>
              )}

              {/* VIREMENT */}
              {payment.method === 'bank_transfer' && (
                <>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                      Titulaire <span style={{ color: C.RED }}>*</span>
                    </label>
                    <input
                      style={INP}
                      value={beneficiaryForm.beneficiary_name}
                      onChange={e => setBeneficiaryForm(f => ({ ...f, beneficiary_name: e.target.value }))}
                      placeholder="Nom complet"
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                      Banque <span style={{ color: C.RED }}>*</span>
                    </label>
                    <input
                      style={INP}
                      value={beneficiaryForm.beneficiary_bank_name}
                      onChange={e => setBeneficiaryForm(f => ({ ...f, beneficiary_bank_name: e.target.value }))}
                      placeholder="Bank of China, ICBC…"
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                      N° de compte <span style={{ color: C.RED }}>*</span>
                    </label>
                    <input
                      style={{ ...INP, fontFamily: 'monospace' }}
                      value={beneficiaryForm.beneficiary_bank_account}
                      onChange={e => setBeneficiaryForm(f => ({ ...f, beneficiary_bank_account: e.target.value }))}
                      placeholder="6214 8888 1234 5678"
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                      Infos complémentaires <span style={{ fontWeight: 400, color: C.dim }}>(SWIFT / IBAN / adresse)</span>
                    </label>
                    <input
                      style={INP}
                      value={beneficiaryForm.beneficiary_bank_extra}
                      onChange={e => setBeneficiaryForm(f => ({ ...f, beneficiary_bank_extra: e.target.value }))}
                      placeholder="SWIFT / IBAN / adresse banque"
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                      Notes <span style={{ fontWeight: 400, color: C.dim }}>(optionnel)</span>
                    </label>
                    <textarea
                      style={{ ...INP, height: 72, resize: 'none' }}
                      value={beneficiaryForm.beneficiary_notes}
                      onChange={e => setBeneficiaryForm(f => ({ ...f, beneficiary_notes: e.target.value }))}
                      placeholder="Instructions supplémentaires…"
                      rows={3}
                    />
                  </div>
                </>
              )}

              {/* Boutons Annuler / Enregistrer */}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button
                  onClick={() => { setEditBenef(false); setQrFile(null); setQrPreview(null); }}
                  disabled={adminUpdateBeneficiaryInfo.isPending || isUploadingQr}
                  style={{
                    flex: 1, padding: 10, borderRadius: 8, background: 'none',
                    border: `1px solid ${C.border}`,
                    fontSize: 12, fontWeight: 700, color: C.sub, cursor: 'pointer',
                    opacity: adminUpdateBeneficiaryInfo.isPending || isUploadingQr ? 0.5 : 1,
                  }}
                >
                  Annuler
                </button>
                <button
                  onClick={handleSaveBeneficiaryInfo}
                  disabled={adminUpdateBeneficiaryInfo.isPending || isUploadingQr}
                  style={{
                    flex: 1, padding: 10, borderRadius: 8, background: C.V,
                    border: 'none', fontSize: 12, fontWeight: 700, color: '#fff',
                    cursor: 'pointer', opacity: adminUpdateBeneficiaryInfo.isPending || isUploadingQr ? 0.6 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  }}
                >
                  {(adminUpdateBeneficiaryInfo.isPending || isUploadingQr)
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <CheckCircle className="w-4 h-4" />
                  }
                  OK
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Preuves OU Signature (selon mode) ─────────────── */}
        {isCash ? (
          /* ─── CASH : bloc signature ─── */
          <div style={{
            padding: '12px 14px', borderRadius: 12,
            background: C.card, border: `1px solid ${C.border}`, marginBottom: 8,
          }}>
            <span style={{ fontSize: 12, fontWeight: 800, display: 'block', marginBottom: 8 }}>Signature</span>

            {/* Signature existante */}
            {(payment as { cash_signature_url?: string | null }).cash_signature_url ? (
              <div>
                <img
                  src={(payment as { cash_signature_url?: string | null }).cash_signature_url!}
                  alt="Signature"
                  style={{ width: '100%', maxHeight: 100, objectFit: 'contain', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff' }}
                />
                <div style={{ fontSize: 10, color: C.dim, marginTop: 4 }}>
                  {(payment as { cash_signature_url?: string | null; cash_paid_at?: string | null }).cash_paid_at
                    ? `Signé le ${format(new Date((payment as { cash_paid_at?: string | null }).cash_paid_at!), 'dd MMM yyyy à HH:mm', { locale: fr })}`
                    : 'Signature capturée'}
                  {(payment as { cash_signed_by_name?: string | null }).cash_signed_by_name && (
                    <> · {(payment as { cash_signed_by_name?: string | null }).cash_signed_by_name}</>
                  )}
                </div>
                {/* Reçu PDF pour cash complété */}
                {payment.status === 'completed' && (
                  <div style={{ marginTop: 8 }}>
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
                <div style={{
                  padding: 16, borderRadius: 8, textAlign: 'center',
                  border: `2px dashed ${C.border}`, background: C.bg, marginBottom: 8,
                }}>
                  <div style={{ fontSize: 12, color: C.sub }}>
                    Le bénéficiaire doit signer avant la remise des fonds
                  </div>
                </div>
                {!isLocked && (
                  <button
                    onClick={() => setSigning(true)}
                    style={{
                      width: '100%', padding: 10, borderRadius: 8,
                      background: C.O, border: 'none',
                      fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer',
                    }}
                  >
                    Faire signer
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          /* ─── NON-CASH : preuves ─── */
          <div style={{
            padding: '12px 14px', borderRadius: 12,
            background: C.card, border: `1px solid ${C.border}`, marginBottom: 8,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 800 }}>
                Preuves ({allProofs.length})
              </span>
              {canAddProof && (
                <button
                  onClick={() => standaloneProofRef.current?.click()}
                  disabled={adminProofUpload.isPending}
                  style={{ fontSize: 10, fontWeight: 700, color: C.V, background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  {adminProofUpload.isPending ? <Loader2 className="w-3 h-3 animate-spin inline" /> : '+ Ajouter'}
                </button>
              )}
            </div>

            {/* Warning preuve manquante */}
            {missingAdminProof && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
                padding: '8px 10px', borderRadius: 8,
                background: `${C.G}10`, border: `1px solid ${C.G}30`,
              }}>
                <AlertTriangle className="w-4 h-4" style={{ color: C.G, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: C.G, fontWeight: 600 }}>
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
                <div style={{
                  padding: 14, borderRadius: 8, textAlign: 'center',
                  border: `2px dashed ${C.border}`, background: C.bg,
                }}>
                  <div style={{ fontSize: 12, color: C.sub }}>Aucune preuve ajoutée</div>
                </div>
                {canAddProof && (
                  <button
                    onClick={() => standaloneProofRef.current?.click()}
                    disabled={adminProofUpload.isPending}
                    style={{
                      width: '100%', padding: 10, borderRadius: 8, marginTop: 6,
                      background: 'none', border: `1px solid ${C.V}25`,
                      fontSize: 12, fontWeight: 700, color: C.V, cursor: 'pointer',
                    }}
                  >
                    + Ajouter une preuve
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {allProofs.map((proof, idx) => {
                  const isAdminProof = proof.uploaded_by_type === 'admin';
                  const canDeleteThis = canProcess && (isAdminProof || isSuperAdmin) && (!isLocked || isSuperAdmin);
                  return (
                    <div key={proof.id} style={{ borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                      {/* Preview */}
                      <div style={{
                        width: '100%', aspectRatio: idx === 0 ? '16/9' : '16/7',
                        background: `linear-gradient(135deg, #e8eef6, #f0ecf8)`,
                        position: 'relative',
                      }}>
                        <img
                          src={proof.file_url}
                          alt={proof.file_name || 'Preuve'}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            // Fallback visuel si l'image ne charge pas
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        {/* Badge type */}
                        <div style={{
                          position: 'absolute', top: 4, left: 4,
                          padding: '2px 5px', borderRadius: 3,
                          background: 'rgba(255,255,255,0.85)',
                          fontSize: 8, fontWeight: 700, color: C.sub,
                        }}>
                          {proof.file_name ? proof.file_name.slice(0, 20) : 'Preuve'}
                          {!isAdminProof && ' · Client'}
                        </div>
                      </div>
                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 4, padding: '6px 8px', background: C.bg }}>
                        <button
                          onClick={() => setFullscreenProof(proof.file_url)}
                          style={{ padding: '3px 6px', borderRadius: 4, background: 'none', border: `1px solid ${C.border}`, fontSize: 9, fontWeight: 600, color: C.sub, cursor: 'pointer' }}
                        >
                          Agrandir
                        </button>
                        <a
                          href={proof.file_url}
                          download={proof.file_name || 'preuve'}
                          style={{ padding: '3px 6px', borderRadius: 4, background: 'none', border: `1px solid ${C.border}`, fontSize: 9, fontWeight: 600, color: C.sub, textDecoration: 'none' }}
                        >
                          Télécharger
                        </a>
                        {canDeleteThis && (
                          <>
                            <span style={{ flex: 1 }} />
                            <button
                              onClick={() => setProofToDelete(proof.id)}
                              style={{ padding: '3px 6px', borderRadius: 4, background: 'none', border: `1px solid ${C.RED}15`, fontSize: 9, fontWeight: 600, color: C.RED, cursor: 'pointer' }}
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
                    style={{
                      marginTop: 6, width: '100%', padding: 8, borderRadius: 8,
                      background: 'none', border: `1px solid ${C.border}`,
                      fontSize: 11, fontWeight: 600, color: C.dim, cursor: 'pointer',
                    }}
                  >
                    {instructionUpload.isPending
                      ? <Loader2 className="w-3 h-3 animate-spin inline" />
                      : '+ Ajouter une instruction'}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Infos ─────────────────────────────────────────── */}
        <div style={{
          padding: '10px 14px', borderRadius: 10,
          background: C.card, border: `1px solid ${C.border}`, marginBottom: 8,
        }}>
          {[
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
              color: C.RED,
            } : null,
            payment.admin_comment ? {
              l: 'Commentaire',
              v: payment.admin_comment,
            } : null,
          ].filter(Boolean).map((row, i, arr) => (
            <div
              key={i}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                padding: '6px 0',
                borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 11, color: C.sub, flexShrink: 0 }}>{row!.l}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: (row as { color?: string }).color || C.text, textAlign: 'right' }}>
                {row!.v}
              </span>
            </div>
          ))}
        </div>

        {/* ── Actions ───────────────────────────────────────── */}
        {(mainAction || canReject || canDelete) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 4 }}>
            {mainAction && (
              <button
                onClick={mainAction.onClick}
                disabled={processPayment.isPending}
                style={{
                  width: '100%', padding: 13, borderRadius: 10,
                  background: mainAction.color, border: 'none',
                  fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  opacity: processPayment.isPending ? 0.6 : 1,
                }}
              >
                {processPayment.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : mainAction.icon}
                {mainAction.label}
              </button>
            )}
            {canReject && (
              <button
                onClick={() => setIsRejectOpen(true)}
                style={{
                  width: '100%', padding: 11, borderRadius: 10,
                  background: 'none', border: `1px solid ${C.RED}20`,
                  fontSize: 12, fontWeight: 600, color: C.RED, cursor: 'pointer',
                }}
              >
                Refuser
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => setIsDeletePaymentOpen(true)}
                style={{
                  width: '100%', padding: 11, borderRadius: 10,
                  background: 'none', border: `1px solid ${C.border}`,
                  fontSize: 11, fontWeight: 600, color: C.dim, cursor: 'pointer',
                }}
              >
                Annuler ce paiement
              </button>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          DRAWERS
      ══════════════════════════════════════════════════════ */}

      {/* ── Reject Drawer ────────────────────────────────── */}
      <Drawer open={isRejectOpen} onOpenChange={(open) => {
        setIsRejectOpen(open);
        if (!open) { setRejectionCategory(''); setRejectReason(''); }
      }}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Rejeter le paiement
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 py-2 space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="bg-red-50 dark:bg-red-950/30 rounded-xl p-4 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-800 dark:text-red-400">
                Cette action va rejeter le paiement et rembourser {formatCurrency(payment.amount_xaf)} au wallet du client.
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Motif du refus</p>
              <div className="space-y-2">
                {PAYMENT_REJECTION_REASONS.map((reason) => (
                  <button
                    key={reason}
                    onClick={() => {
                      setRejectionCategory(reason);
                      if (!rejectReason.trim()) setRejectReason(`Paiement refusé : ${reason.toLowerCase()}.`);
                    }}
                    className={`w-full p-3 rounded-xl border text-left text-sm transition-all ${
                      rejectionCategory === reason
                        ? 'border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400'
                        : 'border-border hover:border-muted-foreground'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                Message au client <span className="text-red-500">*</span>
              </label>
              <textarea
                placeholder="Expliquez pourquoi le paiement est rejeté..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full h-24 p-3 rounded-xl border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
              <p className="text-[10px] text-muted-foreground mt-1">Ce message sera visible par le client</p>
            </div>
          </div>
          <DrawerFooter className="flex-row gap-3">
            <button onClick={() => setIsRejectOpen(false)} className="flex-1 h-12 rounded-xl border border-border font-medium">
              Annuler
            </button>
            <button
              onClick={handleReject}
              disabled={processPayment.isPending || !rejectReason.trim()}
              className="flex-1 h-12 rounded-xl bg-red-500 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {processPayment.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <XCircle className="w-5 h-5" />}
              Rejeter
            </button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* ── Complete Drawer ──────────────────────────────── */}
      <Drawer open={isCompleteOpen} onOpenChange={(open) => {
        setIsCompleteOpen(open);
        if (!open) { setCompleteProofFile(null); setCompleteProofPreview(null); }
      }}>
        <DrawerContent className="flex flex-col" style={{ maxHeight: '92dvh' }}>
          <DrawerHeader className="flex-shrink-0 border-b border-border/20">
            <DrawerTitle>Confirmer le paiement</DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-4">
            <div className="bg-green-50 dark:bg-green-950/30 rounded-xl p-4 border border-green-200 dark:border-green-800">
              <p className="text-sm text-green-800 dark:text-green-400">
                Confirmez que le paiement de <strong>{formatCurrencyRMB(payment.amount_rmb)}</strong> a été effectué au bénéficiaire.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Preuve de paiement (optionnel)</label>
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
                  <img src={completeProofPreview} alt="Preuve" className="w-full h-40 object-cover rounded-xl border border-border" />
                  <button
                    onClick={() => { setCompleteProofFile(null); setCompleteProofPreview(null); if (proofInputRef.current) proofInputRef.current.value = ''; }}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => proofInputRef.current?.click()}
                  className="w-full h-24 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground active:bg-muted/50"
                >
                  <Upload className="w-6 h-6" />
                  <span className="text-sm">Ajouter une preuve</span>
                </button>
              )}
            </div>
          </div>
          <DrawerFooter className="flex-row gap-3">
            <button onClick={() => setIsCompleteOpen(false)} className="flex-1 h-12 rounded-xl border border-border font-medium">
              Annuler
            </button>
            <button
              onClick={handleComplete}
              disabled={processPayment.isPending || adminProofUpload.isPending}
              className="flex-1 h-12 rounded-xl bg-green-500 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {(processPayment.isPending || adminProofUpload.isPending)
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : <CheckCircle className="w-5 h-5" />}
              Confirmer
            </button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* ── Cancel Payment Drawer ────────────────────────── */}
      <Drawer open={isDeletePaymentOpen} onOpenChange={setIsDeletePaymentOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Annuler ce paiement
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4">
            <p className="text-muted-foreground text-sm">
              Voulez-vous vraiment annuler ce paiement ?
              Le paiement sera marqué comme annulé et le solde du client sera recrédité si nécessaire.
            </p>
          </div>
          <DrawerFooter>
            <button
              onClick={() => {
                if (!paymentId) return;
                deletePayment.mutate(paymentId, {
                  onSuccess: () => navigate('/m/payments'),
                });
              }}
              disabled={deletePayment.isPending}
              className="w-full h-12 rounded-xl bg-destructive text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {deletePayment.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirmer l'annulation
            </button>
            <button onClick={() => setIsDeletePaymentOpen(false)} className="w-full h-12 rounded-xl border border-border font-medium text-sm">
              Retour
            </button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* ── Delete Proof Drawer ──────────────────────────── */}
      <Drawer open={!!proofToDelete} onOpenChange={(open) => { if (!open) setProofToDelete(null); }}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Supprimer cette preuve
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4">
            <p className="text-muted-foreground text-sm">
              Voulez-vous supprimer cette preuve de paiement ? Cette action est irréversible.
            </p>
          </div>
          <DrawerFooter>
            <button
              onClick={() => {
                if (!proofToDelete) return;
                deletePaymentProof.mutate(proofToDelete, {
                  onSuccess: () => setProofToDelete(null),
                });
              }}
              disabled={deletePaymentProof.isPending}
              className="w-full h-12 rounded-xl bg-destructive text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {deletePaymentProof.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Supprimer
            </button>
            <button onClick={() => setProofToDelete(null)} className="w-full h-12 rounded-xl border border-border font-medium text-sm">
              Annuler
            </button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* ── Fullscreen Image Drawer ──────────────────────── */}
      <Drawer open={!!fullscreenProof} onOpenChange={() => setFullscreenProof(null)}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>Aperçu</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 space-y-3">
            {fullscreenProof && (
              <>
                <img src={fullscreenProof} alt="Aperçu" className="w-full rounded-xl" />
                <a
                  href={fullscreenProof}
                  download
                  className="flex items-center justify-center gap-2 w-full h-12 rounded-xl border border-border font-medium text-sm active:scale-[0.98] transition-transform"
                >
                  <Download className="w-4 h-4" />
                  Télécharger
                </a>
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>

    </div>
  );
}
