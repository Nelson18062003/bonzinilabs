// ============================================================
// PAGE CLIENT — PaymentDetailPage (Redesign v2)
// Clean, hierarchical client payment detail page.
// Hero amount with payment method logo, beneficiary section
// with copyable fields, consolidated proofs, collapsible timeline.
// ============================================================
import { useParams, useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import {
  usePaymentDetail,
  usePaymentTimeline,
  usePaymentProofs,
  useUpdateBeneficiaryInfo,
} from '@/hooks/usePayments';
import { usePaymentProofMultiUpload } from '@/hooks/usePaymentProofUpload';
import { formatXAF, formatCurrencyRMB, formatCurrency, formatNumber, formatRelativeDate } from '@/lib/formatters';
import { PAYMENT_STATUS_CONFIG, PAYMENT_METHOD_LABELS } from '@/types/payment';
import type { PaymentStatus, PaymentMethod } from '@/types/payment';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Upload,
  Edit2,
  CreditCard,
  Building2,
  Banknote,
  QrCode,
  User,
  Phone,
  Mail,
  FileText,
  FileDown,
  Lock,
  ScanLine,
  TrendingUp,
  Download,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useEffect, useRef, useState, useMemo } from 'react';
import { PaymentTimelineDisplay } from '@/components/payment/PaymentTimelineDisplay';
import { buildPaymentTimelineSteps } from '@/lib/paymentTimeline';
import { PaymentMethodLogo } from '@/mobile/components/payments/PaymentMethodLogo';
import { CopyableField } from '@/mobile/components/payments/CopyableField';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PaymentProofUpload } from '@/components/payment/PaymentProofUpload';
import { PaymentProofGallery } from '@/components/payment/PaymentProofGallery';
import { CashQRCode } from '@/components/cash/CashQRCode';
import { CashReceiptDownloadButton } from '@/components/cash/CashReceiptDownloadButton';
import { downloadPDF } from '@/lib/pdf/downloadPDF';
import { PaymentReceiptPDF } from '@/lib/pdf/templates/PaymentReceiptPDF';
import type { PaymentReceiptData } from '@/lib/pdf/templates/PaymentReceiptPDF';
import { useMyProfile } from '@/hooks/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

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

export default function PaymentDetailPage() {
  const { paymentId } = useParams();
  const navigate = useNavigate();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
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

  // Proof upload state
  const [instructionFiles, setInstructionFiles] = useState<File[]>([]);
  const [uploadKey, setUploadKey] = useState(0);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // QR viewer drawer state
  const [selectedProof, setSelectedProof] = useState<string | null>(null);

  const { data: payment, isLoading: paymentLoading } = usePaymentDetail(paymentId);
  const { data: timeline, isLoading: timelineLoading } = usePaymentTimeline(paymentId);
  const { data: proofs } = usePaymentProofs(paymentId);
  const { data: clientProfile } = useMyProfile();
  const { user: authUser } = useAuth();

  const updateBeneficiaryInfo = useUpdateBeneficiaryInfo();
  const { uploadProofs, isUploading: isUploadingProofs } = usePaymentProofMultiUpload();

  // Build timeline steps — MUST be before any early return to respect Rules of Hooks
  const timelineSteps = useMemo(() => {
    if (!payment) return [];
    return buildPaymentTimelineSteps(payment.status, payment.method, timeline || []);
  }, [payment, timeline]);

  // Initialize form when payment loads
  useEffect(() => {
    if (!payment) return;

    setBeneficiaryForm({
      beneficiary_name: payment.beneficiary_name || '',
      beneficiary_phone: payment.beneficiary_phone || '',
      beneficiary_email: payment.beneficiary_email || '',
      beneficiary_qr_code_url: payment.beneficiary_qr_code_url || '',
      beneficiary_bank_name: payment.beneficiary_bank_name || '',
      beneficiary_bank_account: payment.beneficiary_bank_account || '',
      beneficiary_notes: payment.beneficiary_notes || '',
    });

    setQrFile(null);
    setQrPreview(null);
  }, [payment?.id]);

  // Handle QR file selection
  const handleQrFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setQrFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setQrPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Validate form based on payment method
  const validateForm = (): { valid: boolean; message?: string } => {
    if (!payment) return { valid: false };

    if (payment.method === 'alipay' || payment.method === 'wechat') {
      // At least one required: QR code, phone, or email
      const hasQr = qrFile || beneficiaryForm.beneficiary_qr_code_url;
      const hasPhone = beneficiaryForm.beneficiary_phone.trim();
      const hasEmail = beneficiaryForm.beneficiary_email.trim();

      if (!hasQr && !hasPhone && !hasEmail) {
        return {
          valid: false,
          message: 'Veuillez fournir au moins un QR code, un numéro de téléphone ou un email'
        };
      }
      return { valid: true };
    }

    if (payment.method === 'bank_transfer') {
      // Required: name, bank, account
      if (!beneficiaryForm.beneficiary_name.trim()) {
        return { valid: false, message: 'Le nom du bénéficiaire est requis' };
      }
      if (!beneficiaryForm.beneficiary_bank_name.trim()) {
        return { valid: false, message: 'Le nom de la banque est requis' };
      }
      if (!beneficiaryForm.beneficiary_bank_account.trim()) {
        return { valid: false, message: 'Le numéro de compte est requis' };
      }
      return { valid: true };
    }

    // Cash: no validation needed
    return { valid: true };
  };

  // Save beneficiary info
  const handleSaveBeneficiaryInfo = async () => {
    if (!paymentId || !payment) return;

    const validation = validateForm();
    if (!validation.valid) {
      toast.error(validation.message);
      return;
    }

    try {
      let qrUrl = beneficiaryForm.beneficiary_qr_code_url;

      // Upload QR code if selected
      if (qrFile && (payment.method === 'alipay' || payment.method === 'wechat')) {
        setIsUploadingQr(true);

        const filePath = `beneficiary/${paymentId}/${Date.now()}_${qrFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('payment-proofs')
          .upload(filePath, qrFile, { upsert: true });

        if (uploadError) throw uploadError;

        // Store the file path for later signed URL generation
        qrUrl = `payment-proofs/${filePath}`;
      }

      await updateBeneficiaryInfo.mutateAsync({
        paymentId,
        beneficiaryInfo: {
          beneficiary_name: beneficiaryForm.beneficiary_name || null,
          beneficiary_phone: beneficiaryForm.beneficiary_phone || null,
          beneficiary_email: beneficiaryForm.beneficiary_email || null,
          beneficiary_qr_code_url: qrUrl || null,
          beneficiary_bank_name: beneficiaryForm.beneficiary_bank_name || null,
          beneficiary_bank_account: beneficiaryForm.beneficiary_bank_account || null,
          beneficiary_notes: beneficiaryForm.beneficiary_notes || null,
        },
        paymentMethod: payment.method,
      });

      setIsEditDialogOpen(false);
      setQrFile(null);
      setQrPreview(null);
      toast.success('Votre paiement est prêt à être traité par Bonzini');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error(err?.message || 'Impossible d\'enregistrer les informations');
    } finally {
      setIsUploadingQr(false);
    }
  };

  // Handle "complete later" action
  const handleCompleteLater = () => {
    setIsEditDialogOpen(false);
    toast.info('Vous pourrez compléter les informations plus tard');
  };

  // Capture QR SVG from DOM and convert to data URL for PDF
  const captureQrDataUrl = (paymentId: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const svgElement = document.getElementById(`qr-${paymentId}`);
      if (!svgElement) { resolve(null); return; }
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new window.Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(null);
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    });
  };

  const handleDownloadReceipt = async () => {
    if (!payment || isGeneratingPDF) return;
    setIsGeneratingPDF(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clientName = clientProfile
        ? `${clientProfile.first_name} ${clientProfile.last_name}`
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        : (payment as any).profiles
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? `${(payment as any).profiles.first_name} ${(payment as any).profiles.last_name}`
          : 'Client';

      // Capture cash QR code from DOM if present
      let cashPaymentQrDataUrl: string | null = null;
      if (payment.method === 'cash' && !['completed', 'rejected'].includes(payment.status)) {
        cashPaymentQrDataUrl = await captureQrDataUrl(payment.id);
      }

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client_phone: clientProfile?.phone || (payment as any).profiles?.phone,
        client_email: authUser?.email || undefined,
        client_country: clientProfile?.country || undefined,
        beneficiary_name: payment.beneficiary_name,
        beneficiary_phone: payment.beneficiary_phone,
        beneficiary_email: payment.beneficiary_email,
        beneficiary_bank_name: payment.beneficiary_bank_name,
        beneficiary_bank_account: payment.beneficiary_bank_account,
        beneficiary_qr_code_url: payment.beneficiary_qr_code_url,
        cashPaymentQrDataUrl,
        adminProofs: adminProofs.map(p => ({
          file_url: p.file_url,
          file_type: p.file_type,
          file_name: p.file_name,
          created_at: p.created_at,
        })),
      };
      await downloadPDF(
        <PaymentReceiptPDF data={receiptData} />,
        `recu_paiement_${payment.reference}_${clientName.replace(/\s+/g, '_')}.pdf`,
      );
      toast.success('Relevé téléchargé');
    } catch (error) {
      console.error('Error generating payment PDF:', error);
      toast.error('Erreur lors de la génération du PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  if (paymentLoading) {
    return (
      <MobileLayout>
        <div className="p-4 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      </MobileLayout>
    );
  }

  if (!payment) {
    return (
      <MobileLayout>
        <div className="p-4 text-center">
          <p className="text-muted-foreground">Paiement non trouvé</p>
          <Button onClick={() => navigate('/payments')} className="mt-4">
            Retour aux paiements
          </Button>
        </div>
      </MobileLayout>
    );
  }

  const statusCfg = PAYMENT_STATUS_CONFIG[payment.status as PaymentStatus]
    || { label: payment.status, color: 'bg-gray-100 text-gray-700' };
  const methodLabel = PAYMENT_METHOD_LABELS[payment.method as PaymentMethod] || payment.method;
  const exchangeRateXAFPerRMB = payment.exchange_rate ? Math.round(1 / payment.exchange_rate) : 0;

  // Can edit beneficiary info when not yet processing/completed/rejected
  const canEditBeneficiary = ['created', 'waiting_beneficiary_info', 'ready_for_payment'].includes(payment.status);
  const isLocked = ['processing', 'completed', 'rejected'].includes(payment.status);
  const canUploadInstructions = ['created', 'waiting_beneficiary_info', 'ready_for_payment'].includes(payment.status);

  const clientProofs = (proofs ?? []).filter((p) => p.uploaded_by_type === 'client');
  const adminProofs = (proofs ?? []).filter((p) => p.uploaded_by_type === 'admin');

  // Handle instruction upload
  const handleUploadInstructions = async () => {
    if (!paymentId || instructionFiles.length === 0) return;
    await uploadProofs({ paymentId, files: instructionFiles });
    setInstructionFiles([]);
    setUploadKey(k => k + 1);
  };

  // Check if beneficiary info is provided
  const hasBeneficiaryInfo = payment.method === 'cash' ||
    payment.beneficiary_qr_code_url ||
    payment.beneficiary_name ||
    payment.beneficiary_phone ||
    payment.beneficiary_email ||
    payment.beneficiary_bank_account;

  // Render form fields based on payment method (for the dialog)
  const renderBeneficiaryFormFields = () => {
    if (payment.method === 'alipay' || payment.method === 'wechat') {
      return (
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-3 mb-4">
            <p className="text-sm text-muted-foreground">
              Fournissez <strong>au moins un</strong> des éléments suivants pour que Bonzini puisse effectuer le paiement.
            </p>
          </div>

          {/* QR Code Upload */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <QrCode className="w-4 h-4" />
              QR Code {payment.method === 'alipay' ? 'Alipay' : 'WeChat'}
            </Label>
            <div
              role="button"
              tabIndex={0}
              onClick={() => qrInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') qrInputRef.current?.click();
              }}
              className="border-2 border-dashed border-border rounded-xl p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors"
            >
              {qrPreview ? (
                <div className="flex flex-col items-center gap-2">
                  <img
                    src={qrPreview}
                    alt="Aperçu QR code"
                    className="w-32 h-32 rounded-lg border object-cover"
                  />
                  <span className="text-xs text-muted-foreground">Cliquez pour remplacer</span>
                </div>
              ) : beneficiaryForm.beneficiary_qr_code_url ? (
                <div className="flex flex-col items-center gap-2">
                  <img
                    src={beneficiaryForm.beneficiary_qr_code_url}
                    alt="QR code bénéficiaire"
                    className="w-32 h-32 rounded-lg border object-cover"
                    loading="lazy"
                  />
                  <span className="text-xs text-muted-foreground">Cliquez pour remplacer</span>
                </div>
              ) : (
                <>
                  <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium">Ajouter le QR code</p>
                  <p className="text-xs text-muted-foreground">du bénéficiaire</p>
                </>
              )}
            </div>
            <input
              ref={qrInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleQrFileChange}
            />
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">ou</span>
            </div>
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Numéro de téléphone
            </Label>
            <Input
              value={beneficiaryForm.beneficiary_phone}
              onChange={(e) =>
                setBeneficiaryForm((prev) => ({ ...prev, beneficiary_phone: e.target.value }))
              }
              placeholder="Ex: +86 138 0000 0000"
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email (optionnel)
            </Label>
            <Input
              type="email"
              value={beneficiaryForm.beneficiary_email}
              onChange={(e) =>
                setBeneficiaryForm((prev) => ({ ...prev, beneficiary_email: e.target.value }))
              }
              placeholder="email@exemple.com"
            />
          </div>

          {/* Name (optional) */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Nom du bénéficiaire (optionnel)
            </Label>
            <Input
              value={beneficiaryForm.beneficiary_name}
              onChange={(e) =>
                setBeneficiaryForm((prev) => ({ ...prev, beneficiary_name: e.target.value }))
              }
              placeholder="Nom complet"
            />
          </div>
        </div>
      );
    }

    if (payment.method === 'bank_transfer') {
      return (
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-3 mb-4">
            <p className="text-sm text-muted-foreground">
              Veuillez fournir les informations bancaires complètes du bénéficiaire.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Nom du bénéficiaire *
            </Label>
            <Input
              value={beneficiaryForm.beneficiary_name}
              onChange={(e) =>
                setBeneficiaryForm((prev) => ({ ...prev, beneficiary_name: e.target.value }))
              }
              placeholder="Nom complet du titulaire du compte"
              required
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Nom de la banque *
            </Label>
            <Input
              value={beneficiaryForm.beneficiary_bank_name}
              onChange={(e) =>
                setBeneficiaryForm((prev) => ({ ...prev, beneficiary_bank_name: e.target.value }))
              }
              placeholder="Ex: Bank of China, ICBC..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Numéro de compte *
            </Label>
            <Input
              value={beneficiaryForm.beneficiary_bank_account}
              onChange={(e) =>
                setBeneficiaryForm((prev) => ({ ...prev, beneficiary_bank_account: e.target.value }))
              }
              placeholder="Numéro de compte bancaire"
              required
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Commentaire (optionnel)
            </Label>
            <Textarea
              value={beneficiaryForm.beneficiary_notes}
              onChange={(e) =>
                setBeneficiaryForm((prev) => ({ ...prev, beneficiary_notes: e.target.value }))
              }
              placeholder="Instructions supplémentaires..."
              rows={3}
            />
          </div>
        </div>
      );
    }

    // Cash method - no form needed
    return (
      <div className="text-center py-6">
        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
        <p className="font-medium">Aucune information requise</p>
        <p className="text-sm text-muted-foreground mt-2">
          Pour les paiements Cash, un QR code sera généré automatiquement par Bonzini.
        </p>
      </div>
    );
  };

  // Render displayed beneficiary info
  const renderBeneficiaryDisplay = () => {
    if (payment.method === 'cash') {
      return (
        <div className="text-center py-4">
          <Banknote className="w-8 h-8 text-primary mx-auto mb-2" />
          <p className="text-sm font-medium">Paiement Cash</p>
          <p className="text-xs text-muted-foreground">
            Un QR code sera généré par Bonzini lors du traitement
          </p>
          {payment.cash_qr_code && (
            <div className="mt-3">
              <img
                src={payment.cash_qr_code}
                alt="QR Code Cash"
                className="w-32 h-32 mx-auto rounded-lg border"
              />
            </div>
          )}
        </div>
      );
    }

    if (!hasBeneficiaryInfo) {
      return (
        <div className="text-center py-6">
          <AlertCircle className="w-10 h-10 text-yellow-500 mx-auto mb-3" />
          <p className="font-medium">Informations manquantes</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Ajoutez les informations du bénéficiaire pour que Bonzini puisse effectuer le paiement.
          </p>
          {canEditBeneficiary && (
            <Button onClick={() => setIsEditDialogOpen(true)}>
              Ajouter les informations
            </Button>
          )}
        </div>
      );
    }

    return (
      <div>
        {/* QR Code display for Alipay/WeChat — prominent, tappable */}
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
      </div>
    );
  };

  return (
    <MobileLayout>
      {/* ── Header with status badge ─────────────────────────── */}
      <PageHeader
        title={payment.reference}
        showBack
        rightElement={
          <span className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap',
            STATUS_BADGE_STYLES[payment.status] || STATUS_BADGE_STYLES.created
          )}>
            {statusCfg.label}
          </span>
        }
      />

      <div className="px-4 py-4 space-y-6">
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
                  ¥{formatNumber(payment.amount_rmb, 2)} = {formatNumber(payment.amount_xaf)} XAF
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

        {/* ── Cash QR Code ──────────────────────────────────────── */}
        {payment.method === 'cash' && !['completed', 'rejected'].includes(payment.status) && (
          <CashQRCode
            paymentId={payment.id}
            paymentReference={payment.reference}
            amountRMB={payment.amount_rmb}
            beneficiaryName={payment.beneficiary_name || 'Client'}
          />
        )}

        {/* Cash scanned status */}
        {payment.method === 'cash' && payment.status === 'cash_scanned' && (
          <div className="bg-orange-50 dark:bg-orange-950/30 rounded-2xl p-5 border border-orange-200 dark:border-orange-800">
            <div className="flex items-start gap-3">
              <ScanLine className="w-5 h-5 text-orange-500 mt-0.5" />
              <div>
                <p className="font-medium text-orange-600">QR Code scanné au bureau</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Votre paiement est en cours de traitement au bureau Bonzini Guangzhou.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Cash completed with signature */}
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {payment.method === 'cash' && payment.status === 'completed' && (payment as any).cash_signature_url && (
          <div className="bg-green-50 dark:bg-green-950/30 rounded-2xl p-5 border border-green-200 dark:border-green-800">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-green-600">Paiement cash effectué</p>
                {/* eslint-disable @typescript-eslint/no-explicit-any */}
                <p className="text-sm text-muted-foreground mt-1">
                  Signature enregistrée le {(payment as any).cash_signature_timestamp &&
                    format(new Date((payment as any).cash_signature_timestamp), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                </p>
                {(payment as any).cash_signed_by_name && (
                  <p className="text-sm text-muted-foreground">
                    Signé par: {(payment as any).cash_signed_by_name}
                  </p>
                )}

                {/* Signature image */}
                <div className="mt-3 p-3 bg-white rounded-xl border border-green-200 dark:border-green-800">
                  <p className="text-xs text-muted-foreground mb-2 font-medium">Signature du bénéficiaire</p>
                  <img
                    src={(payment as any).cash_signature_url}
                    alt="Signature du bénéficiaire"
                    className="w-full max-w-xs h-auto rounded"
                    style={{ maxHeight: '120px', objectFit: 'contain' }}
                  />
                </div>

                <div className="mt-3">
                  <CashReceiptDownloadButton
                    payment={payment as any}
                    variant="outline"
                    size="sm"
                    label="Télécharger le reçu PDF"
                  />
                  {/* eslint-enable @typescript-eslint/no-explicit-any */}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Beneficiary Section ──────────────────────────────── */}
        <div className="bg-card rounded-2xl p-5 border border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <User className="w-4 h-4" />
              Bénéficiaire
            </h3>
            {isLocked ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                <Lock className="w-3 h-3" />
                Verrouillé
              </span>
            ) : canEditBeneficiary && hasBeneficiaryInfo && payment.method !== 'cash' ? (
              <button
                onClick={() => setIsEditDialogOpen(true)}
                className="text-xs font-medium text-primary active:scale-95 transition-transform flex items-center gap-1"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Modifier
              </button>
            ) : null}
          </div>

          {renderBeneficiaryDisplay()}
        </div>

        {/* ── Ready for payment message ─────────────────────────── */}
        {payment.status === 'ready_for_payment' && (
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-2xl p-5 border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-primary">Votre paiement est prêt à être traité</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Bonzini va procéder au paiement dans les meilleurs délais.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Documents Section (consolidated proofs) ──────────── */}
        <div className="bg-card rounded-2xl p-5 border border-border">
          <h3 className="text-base font-semibold mb-4">Documents</h3>

          {/* Admin proofs (Bonzini proof of payment) */}
          {adminProofs.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Preuves Bonzini ({adminProofs.length})
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Ces documents confirment que le paiement a été exécuté.
              </p>
              <PaymentProofGallery
                proofs={adminProofs}
                title=""
                emptyMessage=""
                showUploadedBy={false}
              />
            </div>
          )}

          {/* Client instruction proofs */}
          {clientProofs.length > 0 && (
            <div className={cn(adminProofs.length > 0 && "mt-4 pt-4 border-t border-border")}>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Mes instructions ({clientProofs.length})
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Ces documents indiquent à Bonzini où et comment effectuer le paiement.
              </p>
              <PaymentProofGallery
                proofs={clientProofs}
                title=""
                emptyMessage=""
                showUploadedBy={false}
              />
              {isLocked && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Lock className="w-3.5 h-3.5" />
                  Les modifications ne sont plus possibles
                </div>
              )}
            </div>
          )}

          {/* Client instruction upload area */}
          {canUploadInstructions && (
            <div className={cn(
              (adminProofs.length > 0 || clientProofs.length > 0) && "mt-4 pt-4 border-t border-border"
            )}>
              <PaymentProofUpload
                key={uploadKey}
                onFilesSelect={setInstructionFiles}
                selectedFiles={instructionFiles}
                onConfirm={handleUploadInstructions}
                isSubmitting={isUploadingProofs}
              />
            </div>
          )}

          {/* Empty state */}
          {adminProofs.length === 0 && clientProofs.length === 0 && !canUploadInstructions && (
            <p className="text-sm text-muted-foreground text-center py-3">Aucun document</p>
          )}
        </div>

        {/* ── Rejection reason ──────────────────────────────────── */}
        {payment.status === 'rejected' && payment.rejection_reason && (
          <div className="bg-red-50 dark:bg-red-950/30 rounded-2xl p-5 border border-red-200 dark:border-red-800">
            <p className="text-sm font-semibold text-red-800 dark:text-red-400 mb-1">Raison du refus</p>
            <p className="text-sm text-red-700 dark:text-red-300">{payment.rejection_reason}</p>
          </div>
        )}

        {/* ── Bonzini message ──────────────────────────────────── */}
        {payment.client_visible_comment && (
          <div className="bg-green-50 dark:bg-green-950/30 rounded-2xl p-5 border border-green-200 dark:border-green-800">
            <p className="text-sm font-semibold text-green-800 dark:text-green-400 mb-1">Message de Bonzini</p>
            <p className="text-sm text-green-700 dark:text-green-300">{payment.client_visible_comment}</p>
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

                  {/* Timeline */}
                  {timelineLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : (
                    <div className="pt-2">
                      <PaymentTimelineDisplay steps={timelineSteps} />
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </div>

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

      {/* ── Edit Beneficiary Dialog ───────────────────────────── */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {hasBeneficiaryInfo ? 'Modifier' : 'Ajouter'} les informations du bénéficiaire
            </DialogTitle>
            <DialogDescription>
              {payment.method === 'alipay' && 'Fournissez les informations Alipay du bénéficiaire'}
              {payment.method === 'wechat' && 'Fournissez les informations WeChat du bénéficiaire'}
              {payment.method === 'bank_transfer' && 'Fournissez les informations bancaires du bénéficiaire'}
              {payment.method === 'cash' && 'Aucune information requise pour le paiement Cash'}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {renderBeneficiaryFormFields()}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {(payment.method === 'alipay' || payment.method === 'wechat') && (
              <Button
                variant="outline"
                onClick={handleCompleteLater}
                className="w-full sm:w-auto"
              >
                Je compléterai plus tard
              </Button>
            )}
            {payment.method !== 'cash' && (
              <Button
                onClick={handleSaveBeneficiaryInfo}
                disabled={updateBeneficiaryInfo.isPending || isUploadingQr}
                className="w-full sm:w-auto"
              >
                {(updateBeneficiaryInfo.isPending || isUploadingQr) && (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                )}
                Enregistrer
              </Button>
            )}
            {payment.method === 'cash' && (
              <Button onClick={() => setIsEditDialogOpen(false)} className="w-full sm:w-auto">
                Fermer
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MobileLayout>
  );
}
