// ============================================================
// MODULE PAIEMENTS — MobilePaymentDetail (Premium Rebuild)
// Admin payment command center: status banner with SLA,
// copyable beneficiary info, expandable details,
// rejection categories, standalone proof upload, validation warnings
// ============================================================
import { useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import {
  useAdminPaymentDetail,
  useAdminPaymentTimeline,
  useAdminPaymentProofs,
  useProcessPayment,
  useAdminUploadPaymentProof,
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
import { PaymentProofGallery } from '@/components/payment/PaymentProofGallery';
import { PaymentTimelineDisplay } from '@/components/payment/PaymentTimelineDisplay';
import { buildPaymentTimelineSteps } from '@/lib/paymentTimeline';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
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
  Building2,
  CreditCard,
  Wallet as WalletIcon,
  Banknote,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Image as ImageIcon,
  QrCode,
  Upload,
  Plus,
  X,
  AlertTriangle,
  Download,
  Clock,
} from 'lucide-react';
import { SkeletonDetail } from '@/mobile/components/ui/SkeletonCard';

// ── Method icon mapping ─────────────────────────────────────
const METHOD_ICONS: Record<string, React.ElementType> = {
  alipay: CreditCard,
  wechat: WalletIcon,
  bank_transfer: Building2,
  cash: Banknote,
};

// ── Status banner color map (gradient backgrounds) ──────────
const STATUS_BANNER_COLORS: Record<string, string> = {
  created: 'from-gray-500/10 to-gray-500/5 border-gray-500/20',
  waiting_beneficiary_info: 'from-yellow-500/10 to-yellow-500/5 border-yellow-500/20',
  ready_for_payment: 'from-blue-500/10 to-blue-500/5 border-blue-500/20',
  cash_pending: 'from-cyan-500/10 to-cyan-500/5 border-cyan-500/20',
  cash_scanned: 'from-orange-500/10 to-orange-500/5 border-orange-500/20',
  processing: 'from-purple-500/10 to-purple-500/5 border-purple-500/20',
  completed: 'from-green-500/10 to-green-500/5 border-green-500/20',
  rejected: 'from-red-500/10 to-red-500/5 border-red-500/20',
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

  // Expandable details
  const [showDetails, setShowDetails] = useState(false);

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
      // Upload proof if provided
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
  const MethodIcon = METHOD_ICONS[payment.method] || CreditCard;
  const slaLevel = getPaymentSlaLevel(payment.created_at, payment.status);
  const bannerColor = STATUS_BANNER_COLORS[payment.status] || STATUS_BANNER_COLORS.created;

  const canStartProcessing = ['ready_for_payment', 'cash_scanned'].includes(payment.status);
  const canComplete = payment.status === 'processing';
  const canReject = !['completed', 'rejected'].includes(payment.status);
  const isLocked = ['completed', 'rejected'].includes(payment.status);
  const showActions = canProcess && (canStartProcessing || canComplete || canReject);

  // Validation checks
  const hasBeneficiaryInfo = !!(payment.beneficiary_name || payment.beneficiary_bank_account || payment.beneficiary_qr_code_url);
  const missingBeneficiary = !hasBeneficiaryInfo && !['completed', 'rejected', 'created'].includes(payment.status);
  const missingAdminProof = payment.status === 'processing' && adminProofs.length === 0;

  return (
    <div className={cn("flex flex-col min-h-screen", showActions && "pb-24 sm:pb-32")}>
      <MobileHeader
        title={payment.reference || 'Paiement'}
        showBack
        backTo="/m/payments"
      />

      <div className="flex-1 px-3 sm:px-4 lg:px-6 py-3 sm:py-4 space-y-3 sm:space-y-4">
        {/* ── Status Banner with SLA ──────────────────────────── */}
        <div className={cn('bg-gradient-to-r rounded-2xl p-4 border', bannerColor)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={cn(
                "px-3 py-1 rounded-full text-sm font-semibold",
                statusConfig.color
              )}>
                {statusConfig.label}
              </span>
              {isLocked && (
                <span className="text-xs text-muted-foreground">Verrouillé</span>
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
              {formatRelativeDate(payment.created_at)}
            </span>
          </div>
        </div>

        {/* ── Validation Warnings ─────────────────────────────── */}
        {missingBeneficiary && (
          <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-xl p-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
            <span className="text-sm text-yellow-700 dark:text-yellow-400">
              Infos bénéficiaire manquantes — paiement impossible
            </span>
          </div>
        )}
        {missingAdminProof && (
          <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-xl p-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
            <span className="text-sm text-yellow-700 dark:text-yellow-400">
              Aucune preuve admin — ajoutez une preuve avant de terminer
            </span>
          </div>
        )}

        {/* ── Amount Card ─────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-5 border border-primary/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <MethodIcon className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm font-medium">{methodLabel}</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Montant RMB</p>
              <p className="text-2xl font-bold">{formatCurrencyRMB(payment.amount_rmb)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Montant XAF</p>
              <p className="text-lg font-semibold text-muted-foreground">{formatCurrency(payment.amount_xaf)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-primary/10">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Taux: 1 RMB = {payment.exchange_rate ? formatNumber(Math.round(1 / payment.exchange_rate)) : '-'} XAF
            </span>
          </div>
        </div>

        {/* ── Client Info ─────────────────────────────────────── */}
        <button
          onClick={() => navigate(`/m/clients/${payment.user_id}`)}
          className="w-full bg-card rounded-xl p-4 border border-border text-left active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 flex items-center justify-center text-sm sm:text-base font-medium text-primary">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium">{clientName}</p>
              {payment.profiles?.phone && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Phone className="w-3 h-3" />
                  {payment.profiles.phone}
                </div>
              )}
              {payment.profiles?.company_name && (
                <p className="text-xs text-muted-foreground">{payment.profiles.company_name}</p>
              )}
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </div>
        </button>

        {/* ── Beneficiary Info (Copyable) ─────────────────────── */}
        {(payment.beneficiary_name || payment.beneficiary_bank_name || payment.beneficiary_qr_code_url) && (
          <div className="bg-card rounded-xl p-4 border border-border">
            <h3 className="font-medium flex items-center gap-2 mb-3">
              <User className="w-4 h-4" />
              Bénéficiaire
            </h3>
            <div className="space-y-2 text-sm">
              {payment.beneficiary_name && (
                <CopyableField label="Nom" value={payment.beneficiary_name} copyLabel="Nom bénéficiaire" />
              )}
              {payment.beneficiary_phone && (
                <CopyableField label="Téléphone" value={payment.beneficiary_phone} copyLabel="Téléphone bénéficiaire" />
              )}
              {payment.beneficiary_bank_name && (
                <CopyableField label="Banque" value={payment.beneficiary_bank_name} copyLabel="Banque" />
              )}
              {payment.beneficiary_bank_account && (
                <CopyableField label="Compte" value={payment.beneficiary_bank_account} copyLabel="N° de compte" />
              )}
              {payment.beneficiary_email && (
                <CopyableField label="Email" value={payment.beneficiary_email} copyLabel="Email bénéficiaire" />
              )}
              {payment.beneficiary_notes && (
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-1">Notes bénéficiaire</p>
                  <p className="text-sm">{payment.beneficiary_notes}</p>
                </div>
              )}
              {payment.beneficiary_qr_code_url && (
                <div className="pt-2">
                  <button
                    onClick={() => setSelectedProof(payment.beneficiary_qr_code_url)}
                    className="flex items-center gap-2 text-primary active:scale-95 transition-transform"
                  >
                    <QrCode className="w-4 h-4" />
                    Voir le QR Code
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Payment Instructions (client + admin) ─────────── */}
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium flex items-center gap-2">
              <Upload className="w-4 h-4 text-blue-500" />
              Instructions ({instructionProofs.length})
            </h3>
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
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-medium active:scale-95 transition-transform disabled:opacity-50"
                >
                  {instructionUpload.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  Ajouter
                </button>
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Documents indiquant où et comment effectuer le paiement (QR codes, infos bancaires, etc.)
          </p>
          {instructionProofs.length > 0 ? (
            <PaymentProofGallery
              proofs={instructionProofs}
              title=""
              emptyMessage=""
              showUploadedBy={false}
            />
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Aucune instruction</p>
          )}
        </div>

        {/* ── Admin Proofs (with standalone upload) ───────────── */}
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-green-500" />
              Preuves Bonzini ({adminProofs.length})
            </h3>
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
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium active:scale-95 transition-transform disabled:opacity-50"
                >
                  {adminProofUpload.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  Ajouter
                </button>
              </>
            )}
          </div>
          {adminProofs.length > 0 ? (
            <>
              <p className="text-xs text-muted-foreground mb-3">
                Preuves de paiement ajoutées par l'équipe Bonzini.
              </p>
              <PaymentProofGallery
                proofs={adminProofs}
                title=""
                emptyMessage=""
                showUploadedBy={false}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Aucune preuve</p>
          )}
        </div>

        {/* ── Rejection reason ────────────────────────────────── */}
        {payment.rejection_reason && (
          <div className="bg-red-50 dark:bg-red-950/30 rounded-xl p-4 border border-red-200 dark:border-red-800">
            <p className="text-sm font-medium text-red-800 dark:text-red-400 mb-1">Motif de rejet</p>
            <p className="text-sm text-red-700 dark:text-red-300">{payment.rejection_reason}</p>
          </div>
        )}

        {/* ── Payment Details (expandable) ────────────────────── */}
        <div className="bg-card rounded-2xl border overflow-hidden">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between p-4 text-left"
          >
            <h3 className="font-semibold flex items-center gap-2">
              <Banknote className="w-4 h-4" />
              Détails du paiement
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

              {payment.admin_comment && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">Commentaire admin</p>
                  <p className="text-sm mt-0.5">{payment.admin_comment}</p>
                </div>
              )}

              {payment.client_visible_comment && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">Message client</p>
                  <p className="text-sm mt-0.5">{payment.client_visible_comment}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Timeline ────────────────────────────────────────── */}
        {timelineSteps.length > 0 && (
          <div className="bg-card rounded-xl p-4 border border-border">
            <h3 className="font-medium flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4" />
              Historique
            </h3>
            <PaymentTimelineDisplay steps={timelineSteps} />
          </div>
        )}
      </div>

      {/* ── Fixed Bottom Actions ──────────────────────────────── */}
      {showActions && (
        <div className="fixed bottom-16 left-0 right-0 bg-background/95 backdrop-blur-xl border-t border-border p-4 z-40">
          <div className="flex gap-3 max-w-lg mx-auto">
            {canReject && (
              <button
                onClick={() => setIsRejectOpen(true)}
                className="flex-1 h-12 rounded-xl border-2 border-red-500 text-red-500 font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                <XCircle className="w-5 h-5" />
                Rejeter
              </button>
            )}
            {canStartProcessing && (
              <button
                onClick={handleStartProcessing}
                disabled={processPayment.isPending}
                className="flex-1 h-12 rounded-xl bg-orange-500 text-white font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                {processPayment.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
                En cours
              </button>
            )}
            {canComplete && (
              <button
                onClick={() => setIsCompleteOpen(true)}
                className="flex-1 h-12 rounded-xl bg-green-500 text-white font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                <CheckCircle className="w-5 h-5" />
                Terminer
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
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Confirmer le paiement</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 py-2 space-y-4">
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
