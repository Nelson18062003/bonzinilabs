// ============================================================
// MODULE PAIEMENTS — MobilePaymentDetail (Redesign v2)
// Clean, hierarchical admin payment detail page.
// Hero amount with payment method logo, beneficiary section,
// consolidated proofs, collapsible timeline, sticky action bar.
// ============================================================
import { useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { supabaseAdmin } from '@/integrations/supabase/client';
import {
  useAdminPaymentDetail,
  useAdminPaymentTimeline,
  useAdminPaymentProofs,
  useProcessPayment,
  useAdminUploadPaymentProof,
  useAdminUpdateBeneficiaryInfo,
} from '@/hooks/usePayments';
import { useAdminUploadPaymentInstruction } from '@/hooks/usePaymentProofUpload';
import {
  PAYMENT_STATUS_CONFIG,
  PAYMENT_METHOD_LABELS,
  PAYMENT_REJECTION_REASONS,
} from '@/types/payment';
import type { PaymentStatus, PaymentMethod } from '@/types/payment';
import { formatCurrency, formatCurrencyRMB, formatNumber, formatRelativeDate } from '@/lib/formatters';
import { getPaymentSlaLevel } from '@/lib/paymentSla';
import { CopyableField } from '@/mobile/components/payments/CopyableField';
import { PaymentMethodLogo } from '@/mobile/components/payments/PaymentMethodLogo';
import { PaymentProofGallery } from '@/components/payment/PaymentProofGallery';
import { PaymentTimelineDisplay } from '@/components/payment/PaymentTimelineDisplay';
import { buildPaymentTimelineSteps } from '@/lib/paymentTimeline';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Loader2,
  Phone,
  User,
  CheckCircle,
  XCircle,
  Play,
  ChevronRight,
  TrendingUp,
  Plus,
  X,
  AlertTriangle,
  Download,
  FileDown,
  Clock,
  Upload,
  Pencil,
  QrCode,
} from 'lucide-react';
import { SkeletonDetail } from '@/mobile/components/ui/SkeletonCard';
import { downloadPDF } from '@/lib/pdf/downloadPDF';
import { PaymentReceiptPDF } from '@/lib/pdf/templates/PaymentReceiptPDF';
import type { PaymentReceiptData } from '@/lib/pdf/templates/PaymentReceiptPDF';

// ── Status badge styles for header ──────────────────────────
const STATUS_BADGE_STYLES: Record<string, string> = {
  created: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  waiting_beneficiary_info: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  ready_for_payment: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  cash_pending: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300',
  cash_scanned: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  processing: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

export function MobilePaymentDetail() {
  const { paymentId } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();

  const { data: payment, isLoading } = useAdminPaymentDetail(paymentId);
  const { data: timeline } = useAdminPaymentTimeline(paymentId);
  const { data: proofs } = useAdminPaymentProofs(paymentId);

  const processPayment = useProcessPayment();
  const adminProofUpload = useAdminUploadPaymentProof();
  const instructionUpload = useAdminUploadPaymentInstruction();
  const adminUpdateBeneficiaryInfo = useAdminUpdateBeneficiaryInfo();

  const instructionProofs = useMemo(() => proofs?.filter(p => p.uploaded_by_type === 'client' || p.uploaded_by_type === 'admin_instruction') ?? [], [proofs]);
  const adminProofs = useMemo(() => proofs?.filter(p => p.uploaded_by_type === 'admin') ?? [], [proofs]);
  const timelineSteps = useMemo(
    () => payment ? buildPaymentTimelineSteps(payment.status, payment.method, timeline ?? []) : [],
    [payment?.status, payment?.method, timeline]
  );

  // Drawer states
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [selectedProof, setSelectedProof] = useState<string | null>(null);

  // Reject drawer state
  const [rejectionCategory, setRejectionCategory] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  // Complete drawer state
  const [completeProofFile, setCompleteProofFile] = useState<File | null>(null);
  const [completeProofPreview, setCompleteProofPreview] = useState<string | null>(null);
  const proofInputRef = useRef<HTMLInputElement>(null);

  // Standalone proof upload state
  const standaloneProofRef = useRef<HTMLInputElement>(null);

  // Instruction upload state
  const instructionInputRef = useRef<HTMLInputElement>(null);

  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Beneficiary edit drawer state
  const [isEditBeneficiaryOpen, setIsEditBeneficiaryOpen] = useState(false);
  const [beneficiaryForm, setBeneficiaryForm] = useState({
    beneficiary_name: '',
    beneficiary_phone: '',
    beneficiary_email: '',
    beneficiary_qr_code_url: '',
    beneficiary_bank_name: '',
    beneficiary_bank_account: '',
    beneficiary_notes: '',
  });
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [isUploadingQr, setIsUploadingQr] = useState(false);
  const qrInputRef = useRef<HTMLInputElement>(null);

  const handleProofSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompleteProofFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setCompleteProofPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearProofFile = () => {
    setCompleteProofFile(null);
    setCompleteProofPreview(null);
    if (proofInputRef.current) proofInputRef.current.value = '';
  };

  const handleStandaloneProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !paymentId) return;
    try {
      await adminProofUpload.mutateAsync({ paymentId, file });
      toast.success('Preuve ajoutée');
    } catch {
      // Error handled by mutation
    }
    if (standaloneProofRef.current) standaloneProofRef.current.value = '';
  };

  const handleInstructionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !paymentId) return;
    try {
      await instructionUpload.mutateAsync({ paymentId, files: Array.from(files) });
      toast.success(`${files.length} instruction(s) ajoutée(s)`);
    } catch {
      // Error handled by mutation
    }
    if (instructionInputRef.current) instructionInputRef.current.value = '';
  };

  const canProcess = hasPermission('canProcessPayments');

  const handleOpenBeneficiaryEdit = () => {
    if (!payment) return;
    setBeneficiaryForm({
      beneficiary_name: payment.beneficiary_name ?? '',
      beneficiary_phone: payment.beneficiary_phone ?? '',
      beneficiary_email: payment.beneficiary_email ?? '',
      beneficiary_qr_code_url: payment.beneficiary_qr_code_url ?? '',
      beneficiary_bank_name: payment.beneficiary_bank_name ?? '',
      beneficiary_bank_account: payment.beneficiary_bank_account ?? '',
      beneficiary_notes: payment.beneficiary_notes ?? '',
    });
    setQrFile(null);
    setQrPreview(null);
    setIsEditBeneficiaryOpen(true);
  };

  const handleSaveBeneficiaryInfo = async () => {
    if (!payment || !paymentId) return;

    if (payment.method === 'alipay' || payment.method === 'wechat') {
      const hasContact = !!(beneficiaryForm.beneficiary_phone || beneficiaryForm.beneficiary_email);
      const hasQr = !!(qrFile || beneficiaryForm.beneficiary_qr_code_url);
      if (!hasContact && !hasQr) {
        toast.error('Fournissez au moins un QR code, un téléphone ou un email');
        return;
      }
    } else if (payment.method === 'bank_transfer') {
      if (!beneficiaryForm.beneficiary_name) { toast.error('Le nom du bénéficiaire est requis'); return; }
      if (!beneficiaryForm.beneficiary_bank_name) { toast.error('Le nom de la banque est requis'); return; }
      if (!beneficiaryForm.beneficiary_bank_account) { toast.error('Le numéro de compte est requis'); return; }
    }

    try {
      let qrUrl = beneficiaryForm.beneficiary_qr_code_url;

      if (qrFile && (payment.method === 'alipay' || payment.method === 'wechat')) {
        setIsUploadingQr(true);
        const filePath = `beneficiary/${paymentId}/${Date.now()}_${qrFile.name}`;
        const { error: uploadError } = await supabaseAdmin.storage
          .from('payment-proofs')
          .upload(filePath, qrFile, { upsert: true });
        if (uploadError) throw uploadError;
        qrUrl = `payment-proofs/${filePath}`;
      }

      await adminUpdateBeneficiaryInfo.mutateAsync({
        paymentId,
        beneficiaryInfo: {
          beneficiary_name: beneficiaryForm.beneficiary_name || undefined,
          beneficiary_phone: beneficiaryForm.beneficiary_phone || undefined,
          beneficiary_email: beneficiaryForm.beneficiary_email || undefined,
          beneficiary_qr_code_url: qrUrl || undefined,
          beneficiary_bank_name: beneficiaryForm.beneficiary_bank_name || undefined,
          beneficiary_bank_account: beneficiaryForm.beneficiary_bank_account || undefined,
          beneficiary_notes: beneficiaryForm.beneficiary_notes || undefined,
        },
      });

      setIsEditBeneficiaryOpen(false);
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
    } catch {
      // Error handled by mutation
    }
  };

  const handleComplete = async () => {
    if (!paymentId) return;

    try {
      if (completeProofFile) {
        await adminProofUpload.mutateAsync({ paymentId, file: completeProofFile });
      }

      await processPayment.mutateAsync({ paymentId, action: 'complete' });
      setIsCompleteOpen(false);
      clearProofFile();
      toast.success('Paiement terminé');
      navigate('/m/payments');
    } catch {
      // Error handled by mutation
    }
  };

  const handleReject = async () => {
    if (!paymentId || !rejectReason.trim()) {
      toast.error('Veuillez indiquer un motif');
      return;
    }
    try {
      await processPayment.mutateAsync({
        paymentId,
        action: 'reject',
        comment: rejectReason,
      });
      setIsRejectOpen(false);
      setRejectionCategory('');
      setRejectReason('');
      toast.success('Paiement rejeté');
      navigate('/m/payments');
    } catch {
      // Error handled by mutation
    }
  };

  const handleDownloadReceipt = async () => {
    if (!payment || isGeneratingPDF) return;
    setIsGeneratingPDF(true);
    try {
      const clientName = payment.profiles
        ? `${payment.profiles.first_name} ${payment.profiles.last_name}`
        : 'Client';
      const receiptData: PaymentReceiptData = {
        id: payment.id,
        reference: payment.reference,
        created_at: payment.created_at,
        processed_at: payment.processed_at,
        amount_xaf: payment.amount_xaf,
        amount_rmb: payment.amount_rmb,
        exchange_rate: payment.exchange_rate,
        method: payment.method,
        status: payment.status,
        client_name: clientName,
        client_phone: payment.profiles?.phone,
        beneficiary_name: payment.beneficiary_name,
        beneficiary_phone: payment.beneficiary_phone,
        beneficiary_email: payment.beneficiary_email,
        beneficiary_bank_name: payment.beneficiary_bank_name,
        beneficiary_bank_account: payment.beneficiary_bank_account,
        beneficiary_qr_code_url: payment.beneficiary_qr_code_url,
      };
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      await downloadPDF(
        <PaymentReceiptPDF data={receiptData} />,
        `Paiement_${payment.reference}_${dateStr}.pdf`,
      );
      toast.success('Relevé téléchargé');
    } catch (error) {
      console.error('Error generating payment PDF:', error);
      toast.error('Erreur lors de la génération du PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <MobileHeader title="Détail paiement" showBack backTo="/m/payments" />
        <SkeletonDetail />
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="flex flex-col min-h-screen">
        <MobileHeader title="Détail paiement" showBack backTo="/m/payments" />
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-muted-foreground">Paiement non trouvé</p>
        </div>
      </div>
    );
  }

  const clientName = payment.profiles
    ? `${payment.profiles.first_name} ${payment.profiles.last_name}`
    : 'Client inconnu';
  const initials = payment.profiles
    ? `${payment.profiles.first_name?.[0] || ''}${payment.profiles.last_name?.[0] || ''}`
    : '??';

  const statusConfig = PAYMENT_STATUS_CONFIG[payment.status as PaymentStatus]
    || { label: payment.status, color: 'bg-gray-100 text-gray-700' };
  const methodLabel = PAYMENT_METHOD_LABELS[payment.method as PaymentMethod] || payment.method;
  const slaLevel = getPaymentSlaLevel(payment.created_at, payment.status);

  const canStartProcessing = ['ready_for_payment', 'cash_scanned'].includes(payment.status);
  const canComplete = payment.status === 'processing';
  const canReject = !['completed', 'rejected'].includes(payment.status);
  const isLocked = ['completed', 'rejected'].includes(payment.status);
  const showActions = canProcess && (canStartProcessing || canComplete || canReject);

  // Validation checks
  const hasBeneficiaryInfo = !!(payment.beneficiary_name || payment.beneficiary_bank_account || payment.beneficiary_qr_code_url || payment.beneficiary_phone || payment.beneficiary_email);
  const missingBeneficiary = !hasBeneficiaryInfo && !['completed', 'rejected', 'created'].includes(payment.status);
  const missingAdminProof = payment.status === 'processing' && adminProofs.length === 0;

  const exchangeRateXAFPerRMB = payment.exchange_rate ? Math.round(1 / payment.exchange_rate) : 0;

  return (
    <div className={cn("flex flex-col min-h-screen", showActions && "pb-28")}>
      {/* ── Header with status badge ─────────────────────────── */}
      <MobileHeader
        title={payment.reference || 'Paiement'}
        showBack
        backTo="/m/payments"
        rightElement={
          <span className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap',
            STATUS_BADGE_STYLES[payment.status] || STATUS_BADGE_STYLES.created
          )}>
            {slaLevel && (
              <span className={cn(
                'sla-dot',
                slaLevel === 'fresh' && 'sla-fresh',
                slaLevel === 'aging' && 'sla-aging',
                slaLevel === 'overdue' && 'sla-overdue animate',
              )} />
            )}
            {statusConfig.label}
          </span>
        }
      />

      <div className="flex-1 px-4 py-4 space-y-6">
        {/* ── Hero Amount Card ─────────────────────────────────── */}
        <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
          {/* Method logo + label + download button */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <PaymentMethodLogo method={payment.method as 'alipay' | 'wechat' | 'bank_transfer' | 'cash'} size={48} />
              <span className="text-lg font-semibold">{methodLabel}</span>
            </div>
            <button
              onClick={handleDownloadReceipt}
              disabled={isGeneratingPDF}
              className="w-10 h-10 rounded-xl border border-border flex items-center justify-center text-muted-foreground active:scale-95 transition-transform disabled:opacity-50"
              aria-label="Télécharger le relevé"
            >
              {isGeneratingPDF ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <FileDown className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Primary amount: RMB */}
          <p className="text-[32px] sm:text-[36px] font-bold tracking-tight leading-none">
            {formatCurrencyRMB(payment.amount_rmb)}
          </p>

          {/* Secondary amount: XAF */}
          <p className="text-xl sm:text-2xl font-semibold text-muted-foreground mt-1">
            {formatCurrency(payment.amount_xaf)}
          </p>

          {/* Exchange rate — explicit and visible */}
          <div className="mt-4 bg-muted/50 rounded-xl p-3 border border-border/50">
            <div className="flex items-start gap-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium">
                  Taux appliqué : 1 RMB = {formatNumber(exchangeRateXAFPerRMB)} XAF
                </p>
                <p className="text-muted-foreground mt-0.5">
                  {formatNumber(payment.amount_rmb, 2)} RMB = {formatNumber(payment.amount_xaf)} XAF
                </p>
              </div>
            </div>
          </div>

          {/* Date info */}
          <p className="text-xs text-muted-foreground mt-3">
            Créé {formatRelativeDate(payment.created_at)} · {format(new Date(payment.created_at), 'dd MMM yyyy, HH:mm', { locale: fr })}
            {isLocked && ' · Verrouillé'}
          </p>
        </div>

        {/* ── Beneficiary Section ──────────────────────────────── */}
        {payment.method !== 'cash' && (
          <div className="bg-card rounded-2xl p-5 border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <User className="w-4 h-4" />
                Bénéficiaire
              </h3>
              {canProcess && !isLocked && (
                <button
                  onClick={handleOpenBeneficiaryEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium active:scale-95 transition-transform"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Modifier
                </button>
              )}
            </div>

            {hasBeneficiaryInfo ? (
              <>
                {/* QR Code display for Alipay/WeChat — prominent */}
                {payment.beneficiary_qr_code_url && ['alipay', 'wechat'].includes(payment.method) && (
                  <div className="flex justify-center mb-4">
                    <button
                      onClick={() => setSelectedProof(payment.beneficiary_qr_code_url)}
                      className="active:scale-[0.98] transition-transform"
                    >
                      <img
                        src={payment.beneficiary_qr_code_url}
                        alt="QR Code bénéficiaire"
                        className="w-[200px] h-[200px] rounded-xl border-2 border-border object-contain bg-white"
                      />
                      <p className="text-xs text-primary mt-2 text-center">Appuyer pour agrandir</p>
                    </button>
                  </div>
                )}

                {/* Copyable fields */}
                <div className="space-y-2.5 text-sm">
                  {payment.beneficiary_name && (
                    <CopyableField label="Nom" value={payment.beneficiary_name} copyLabel="Nom bénéficiaire" />
                  )}
                  {payment.beneficiary_phone && (
                    <CopyableField label="Téléphone" value={payment.beneficiary_phone} copyLabel="Téléphone bénéficiaire" />
                  )}
                  {payment.beneficiary_email && (
                    <CopyableField label="Email" value={payment.beneficiary_email} copyLabel="Email bénéficiaire" />
                  )}
                  {payment.beneficiary_bank_name && (
                    <CopyableField label="Banque" value={payment.beneficiary_bank_name} copyLabel="Banque" />
                  )}
                  {payment.beneficiary_bank_account && (
                    <CopyableField label="N° de compte" value={payment.beneficiary_bank_account} copyLabel="N° de compte" />
                  )}
                  {payment.beneficiary_notes && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-1">Notes</p>
                      <p className="text-sm">{payment.beneficiary_notes}</p>
                    </div>
                  )}
                </div>
              </>
            ) : missingBeneficiary ? (
              <div className="bg-yellow-50 dark:bg-yellow-950/30 rounded-xl p-3 border border-yellow-200 dark:border-yellow-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                <span className="text-sm text-yellow-700 dark:text-yellow-400">
                  Infos manquantes — paiement impossible
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-2">
                Aucune information bénéficiaire
              </p>
            )}
          </div>
        )}

        {/* ── Client Section ───────────────────────────────────── */}
        <button
          onClick={() => navigate(`/m/clients/${payment.user_id}`)}
          className="w-full bg-card rounded-2xl p-5 border border-border text-left active:scale-[0.98] transition-transform"
        >
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Client</p>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-base font-semibold text-primary">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-base">{clientName}</p>
              {payment.profiles?.company_name && (
                <p className="text-sm text-muted-foreground">{payment.profiles.company_name}</p>
              )}
              {payment.profiles?.phone && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                  <Phone className="w-3.5 h-3.5" />
                  {payment.profiles.phone}
                </div>
              )}
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          </div>
        </button>

        {/* ── Payment Proofs Section (consolidated) ────────────── */}
        <div className="bg-card rounded-2xl p-5 border border-border">
          <h3 className="text-base font-semibold mb-4">Preuves de paiement</h3>

          {/* Missing proof warning — integrated */}
          {missingAdminProof && (
            <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-xl p-3 flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
              <span className="text-sm text-yellow-700 dark:text-yellow-400">
                Aucune preuve admin — ajoutez-en une avant de valider
              </span>
            </div>
          )}

          {/* Admin proofs */}
          {adminProofs.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Preuves Bonzini ({adminProofs.length})
              </p>
              <PaymentProofGallery
                proofs={adminProofs}
                title=""
                emptyMessage=""
                showUploadedBy={false}
              />
            </div>
          )}

          {/* Big add proof button */}
          {canProcess && !isLocked && (
            <>
              <input
                ref={standaloneProofRef}
                type="file"
                accept="image/*"
                onChange={handleStandaloneProofUpload}
                className="hidden"
              />
              <button
                onClick={() => standaloneProofRef.current?.click()}
                disabled={adminProofUpload.isPending}
                className="w-full h-12 rounded-xl border-2 border-dashed border-primary/30 text-primary font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                {adminProofUpload.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Plus className="w-5 h-5" />
                )}
                Ajouter une preuve
              </button>
            </>
          )}

          {/* Instruction proofs (sub-section) */}
          {instructionProofs.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Instructions ({instructionProofs.length})
                </p>
                {canProcess && !isLocked && (
                  <>
                    <input
                      ref={instructionInputRef}
                      type="file"
                      accept="image/*,application/pdf"
                      multiple
                      onChange={handleInstructionUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => instructionInputRef.current?.click()}
                      disabled={instructionUpload.isPending}
                      className="text-xs font-medium text-primary active:scale-95 transition-transform disabled:opacity-50"
                    >
                      {instructionUpload.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        '+ Ajouter'
                      )}
                    </button>
                  </>
                )}
              </div>
              <PaymentProofGallery
                proofs={instructionProofs}
                title=""
                emptyMessage=""
                showUploadedBy={false}
              />
            </div>
          )}

          {/* Empty state */}
          {adminProofs.length === 0 && instructionProofs.length === 0 && !missingAdminProof && (
            <p className="text-sm text-muted-foreground text-center py-3">Aucune preuve</p>
          )}
        </div>

        {/* ── Rejection reason ──────────────────────────────────── */}
        {payment.rejection_reason && (
          <div className="bg-red-50 dark:bg-red-950/30 rounded-2xl p-5 border border-red-200 dark:border-red-800">
            <p className="text-sm font-semibold text-red-800 dark:text-red-400 mb-1">Motif de rejet</p>
            <p className="text-sm text-red-700 dark:text-red-300">{payment.rejection_reason}</p>
          </div>
        )}

        {/* ── Timeline & Details (collapsed by default) ─────────── */}
        {timelineSteps.length > 0 && (
          <Accordion type="single" collapsible className="bg-card rounded-2xl border border-border overflow-hidden">
            <AccordionItem value="timeline" className="border-0">
              <AccordionTrigger className="px-5 py-4 hover:no-underline">
                <span className="flex items-center gap-2 font-semibold text-base">
                  <Clock className="w-4 h-4" />
                  Historique & Détails
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-5">
                <div className="space-y-4">
                  {/* Secondary info grid */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Référence</p>
                      <p className="font-mono text-xs mt-0.5">{payment.reference}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Méthode</p>
                      <p className="font-medium text-xs mt-0.5">{methodLabel}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Créé le</p>
                      <p className="text-xs mt-0.5">
                        {format(new Date(payment.created_at), 'dd MMM yyyy, HH:mm', { locale: fr })}
                      </p>
                    </div>
                    {payment.processed_at && (
                      <div>
                        <p className="text-muted-foreground text-xs">Traité le</p>
                        <p className="text-xs mt-0.5">
                          {format(new Date(payment.processed_at), 'dd MMM yyyy, HH:mm', { locale: fr })}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Admin comment */}
                  {payment.admin_comment && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground">Commentaire admin</p>
                      <p className="text-sm mt-0.5">{payment.admin_comment}</p>
                    </div>
                  )}

                  {/* Client visible comment */}
                  {payment.client_visible_comment && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground">Message client</p>
                      <p className="text-sm mt-0.5">{payment.client_visible_comment}</p>
                    </div>
                  )}

                  {/* Timeline */}
                  <div className="pt-2">
                    <PaymentTimelineDisplay steps={timelineSteps} />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </div>

      {/* ── Sticky Bottom Action Bar ───────────────────────────── */}
      {showActions && (
        <div className="fixed bottom-16 left-0 right-0 bg-background/95 backdrop-blur-xl border-t border-border px-4 py-3 z-40">
          <div className="flex gap-2.5 max-w-lg mx-auto">
            {canReject && (
              <button
                onClick={() => setIsRejectOpen(true)}
                className="h-12 px-4 rounded-xl border-2 border-red-500 text-red-500 font-semibold text-sm flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform flex-shrink-0"
              >
                <XCircle className="w-4 h-4" />
                Rejeter
              </button>
            )}
            {canStartProcessing && (
              <button
                onClick={handleStartProcessing}
                disabled={processPayment.isPending}
                className="flex-1 h-12 rounded-xl bg-amber-500 text-white font-semibold text-sm flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                {processPayment.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                En cours
              </button>
            )}
            {canComplete && (
              <button
                onClick={() => setIsCompleteOpen(true)}
                className="flex-[2] h-12 rounded-xl bg-green-500 text-white font-bold text-sm flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
              >
                <CheckCircle className="w-5 h-5" />
                Valider le paiement
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Reject Drawer (with categories) ───────────────────── */}
      <Drawer open={isRejectOpen} onOpenChange={(open) => {
        setIsRejectOpen(open);
        if (!open) {
          setRejectionCategory('');
          setRejectReason('');
        }
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

            {/* Rejection categories */}
            <div>
              <p className="text-sm text-muted-foreground mb-2">Motif du refus</p>
              <div className="space-y-2">
                {PAYMENT_REJECTION_REASONS.map((reason) => (
                  <button
                    key={reason}
                    onClick={() => {
                      setRejectionCategory(reason);
                      if (!rejectReason.trim()) {
                        setRejectReason(`Paiement refusé : ${reason.toLowerCase()}.`);
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

            {/* Client-visible message */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Message au client <span className="text-red-500">*</span>
              </label>
              <textarea
                placeholder="Expliquez pourquoi le paiement est rejeté..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                enterKeyHint="done"
                className="w-full h-24 p-3 rounded-xl border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Ce message sera visible par le client
              </p>
            </div>
          </div>
          <DrawerFooter className="flex-row gap-3">
            <button
              onClick={() => setIsRejectOpen(false)}
              className="flex-1 h-12 rounded-xl border border-border font-medium"
            >
              Annuler
            </button>
            <button
              onClick={handleReject}
              disabled={processPayment.isPending || !rejectReason.trim()}
              className="flex-1 h-12 rounded-xl bg-red-500 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {processPayment.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <XCircle className="w-5 h-5" />
              )}
              Rejeter
            </button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* ── Complete Drawer ────────────────────────────────────── */}
      <Drawer open={isCompleteOpen} onOpenChange={(open) => {
        setIsCompleteOpen(open);
        if (!open) clearProofFile();
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

            {/* Proof Upload */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Preuve de paiement (optionnel)
              </label>
              <input
                ref={proofInputRef}
                type="file"
                accept="image/*"
                onChange={handleProofSelect}
                className="hidden"
              />
              {completeProofPreview ? (
                <div className="relative">
                  <img
                    src={completeProofPreview}
                    alt="Preuve"
                    className="w-full h-40 object-cover rounded-xl border border-border"
                  />
                  <button
                    onClick={clearProofFile}
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
            <button
              onClick={() => setIsCompleteOpen(false)}
              className="flex-1 h-12 rounded-xl border border-border font-medium"
            >
              Annuler
            </button>
            <button
              onClick={handleComplete}
              disabled={processPayment.isPending || adminProofUpload.isPending}
              className="flex-1 h-12 rounded-xl bg-green-500 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {(processPayment.isPending || adminProofUpload.isPending) ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <CheckCircle className="w-5 h-5" />
              )}
              Confirmer
            </button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* ── Edit Beneficiary Drawer ───────────────────────────── */}
      <Drawer open={isEditBeneficiaryOpen} onOpenChange={(open) => {
        setIsEditBeneficiaryOpen(open);
        if (!open) { setQrFile(null); setQrPreview(null); }
      }}>
        <DrawerContent className="flex flex-col max-h-[85vh]">
          <DrawerHeader className="flex-shrink-0 border-b border-border/20">
            <DrawerTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Infos bénéficiaire
            </DrawerTitle>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-4">
            {/* Bank Transfer fields */}
            {payment?.method === 'bank_transfer' && (
              <>
                <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3 border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-800 dark:text-blue-400">
                    Renseignez les coordonnées bancaires complètes du bénéficiaire.
                  </p>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Nom <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={beneficiaryForm.beneficiary_name}
                      onChange={(e) => setBeneficiaryForm(f => ({ ...f, beneficiary_name: e.target.value }))}
                      placeholder="Nom complet"
                      autoComplete="off"
                      className="w-full h-12 px-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-base"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Banque <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={beneficiaryForm.beneficiary_bank_name}
                      onChange={(e) => setBeneficiaryForm(f => ({ ...f, beneficiary_bank_name: e.target.value }))}
                      placeholder="Bank of China, ICBC…"
                      autoComplete="off"
                      className="w-full h-12 px-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-base"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">N° de compte <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={beneficiaryForm.beneficiary_bank_account}
                      onChange={(e) => setBeneficiaryForm(f => ({ ...f, beneficiary_bank_account: e.target.value }))}
                      placeholder="Numéro de compte bancaire"
                      autoComplete="off"
                      inputMode="text"
                      className="w-full h-12 px-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-base font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Notes <span className="text-muted-foreground text-xs">(optionnel)</span></label>
                    <textarea
                      value={beneficiaryForm.beneficiary_notes}
                      onChange={(e) => setBeneficiaryForm(f => ({ ...f, beneficiary_notes: e.target.value }))}
                      placeholder="Instructions supplémentaires…"
                      rows={2}
                      className="w-full px-3 py-3 rounded-xl border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary text-base"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Alipay / WeChat fields */}
            {(payment?.method === 'alipay' || payment?.method === 'wechat') && (
              <>
                <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3 border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-800 dark:text-blue-400">
                    Fournissez au moins un élément : QR code, téléphone ou email.
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">QR Code</label>
                  <input
                    ref={qrInputRef}
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
                  />
                  {qrPreview || beneficiaryForm.beneficiary_qr_code_url ? (
                    <div className="relative">
                      <img
                        src={qrPreview ?? beneficiaryForm.beneficiary_qr_code_url}
                        alt="QR Code"
                        className="w-full h-40 object-contain rounded-xl border border-border bg-muted"
                      />
                      <button
                        onClick={() => {
                          setQrFile(null);
                          setQrPreview(null);
                          setBeneficiaryForm(f => ({ ...f, beneficiary_qr_code_url: '' }));
                          if (qrInputRef.current) qrInputRef.current.value = '';
                        }}
                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => qrInputRef.current?.click()}
                      className="w-full h-24 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground active:bg-muted/50"
                    >
                      <QrCode className="w-6 h-6" />
                      <span className="text-sm">Importer un QR Code</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">ou</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Téléphone</label>
                    <input
                      type="tel"
                      value={beneficiaryForm.beneficiary_phone}
                      onChange={(e) => setBeneficiaryForm(f => ({ ...f, beneficiary_phone: e.target.value }))}
                      placeholder="+86 138 0000 0000"
                      inputMode="tel"
                      className="w-full h-12 px-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-base"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Email <span className="text-muted-foreground text-xs">(optionnel)</span></label>
                    <input
                      type="email"
                      value={beneficiaryForm.beneficiary_email}
                      onChange={(e) => setBeneficiaryForm(f => ({ ...f, beneficiary_email: e.target.value }))}
                      placeholder="beneficiaire@example.com"
                      inputMode="email"
                      className="w-full h-12 px-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-base"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Nom <span className="text-muted-foreground text-xs">(optionnel)</span></label>
                    <input
                      type="text"
                      value={beneficiaryForm.beneficiary_name}
                      onChange={(e) => setBeneficiaryForm(f => ({ ...f, beneficiary_name: e.target.value }))}
                      placeholder="Nom du bénéficiaire"
                      autoComplete="off"
                      className="w-full h-12 px-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-base"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          <DrawerFooter className="flex-row gap-3 flex-shrink-0">
            <button
              onClick={() => setIsEditBeneficiaryOpen(false)}
              disabled={adminUpdateBeneficiaryInfo.isPending || isUploadingQr}
              className="flex-1 h-12 rounded-xl border border-border font-medium disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={handleSaveBeneficiaryInfo}
              disabled={adminUpdateBeneficiaryInfo.isPending || isUploadingQr}
              className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {(adminUpdateBeneficiaryInfo.isPending || isUploadingQr) ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <CheckCircle className="w-5 h-5" />
              )}
              Enregistrer
            </button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* ── QR Code Viewer Drawer ─────────────────────────────── */}
      <Drawer open={!!selectedProof} onOpenChange={() => setSelectedProof(null)}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>QR Code bénéficiaire</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 space-y-3">
            {payment.beneficiary_name && (
              <p className="text-center text-sm font-medium">{payment.beneficiary_name}</p>
            )}
            {selectedProof && (
              <img
                src={selectedProof}
                alt="QR Code"
                className="w-full rounded-xl"
              />
            )}
            {selectedProof && (
              <a
                href={selectedProof}
                download="qr-code-beneficiaire"
                className="flex items-center justify-center gap-2 w-full h-12 rounded-xl border border-border font-medium text-sm active:scale-[0.98] transition-transform"
              >
                <Download className="w-4 h-4" />
                Télécharger le QR Code
              </a>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
