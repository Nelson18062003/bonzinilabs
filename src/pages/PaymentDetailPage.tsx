import { useParams, useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  usePaymentDetail,
  usePaymentTimeline,
  usePaymentProofs,
  useUpdateBeneficiaryInfo,
} from '@/hooks/usePayments';
import { usePaymentProofMultiUpload } from '@/hooks/usePaymentProofUpload';
import { formatXAF, formatCurrencyRMB } from '@/lib/formatters';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Loader2,
  Upload,
  Edit2,
  CreditCard,
  Wallet,
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
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useEffect, useRef, useState, useMemo } from 'react';
import { PaymentTimelineDisplay } from '@/components/payment/PaymentTimelineDisplay';
import { buildPaymentTimelineSteps } from '@/lib/paymentTimeline';
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

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  created: { label: 'Créé', color: 'bg-blue-500', icon: Clock },
  waiting_beneficiary_info: { label: 'En attente d\'infos bénéficiaire', color: 'bg-yellow-500', icon: AlertCircle },
  ready_for_payment: { label: 'Prêt à être payé', color: 'bg-purple-500', icon: Clock },
  cash_pending: { label: 'QR Code généré', color: 'bg-cyan-500', icon: QrCode },
  cash_scanned: { label: 'Scanné au bureau', color: 'bg-orange-500', icon: ScanLine },
  processing: { label: 'En cours de paiement', color: 'bg-orange-500', icon: Loader2 },
  completed: { label: 'Paiement effectué', color: 'bg-green-500', icon: CheckCircle2 },
  rejected: { label: 'Refusé', color: 'bg-red-500', icon: XCircle },
};

const methodConfig = {
  alipay: { label: 'Alipay', icon: CreditCard },
  wechat: { label: 'WeChat Pay', icon: Wallet },
  bank_transfer: { label: 'Virement bancaire', icon: Building2 },
  cash: { label: 'Cash', icon: Banknote },
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

  const handleDownloadReceipt = async () => {
    if (!payment || isGeneratingPDF) return;
    setIsGeneratingPDF(true);
    try {
      const clientName = clientProfile
        ? `${clientProfile.first_name} ${clientProfile.last_name}`
        : (payment as any).profiles
          ? `${(payment as any).profiles.first_name} ${(payment as any).profiles.last_name}`
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
        client_phone: clientProfile?.phone || (payment as any).profiles?.phone,
        client_email: authUser?.email || undefined,
        client_country: clientProfile?.country || undefined,
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

  if (paymentLoading) {
    return (
      <MobileLayout>
        <div className="p-4 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
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

  const StatusIcon = statusConfig[payment.status]?.icon || Clock;
  const MethodIcon = methodConfig[payment.method]?.icon || CreditCard;
  
  // Can edit beneficiary info when not yet processing/completed/rejected
  const canEditBeneficiary = ['created', 'waiting_beneficiary_info', 'ready_for_payment'].includes(payment.status);
  const isLocked = ['processing', 'completed', 'rejected'].includes(payment.status);
  const canUploadInstructions = ['created', 'waiting_beneficiary_info', 'ready_for_payment'].includes(payment.status);

  const clientProofs = (proofs ?? []).filter((p) => p.uploaded_by_type === 'client');
  const adminProofs = (proofs ?? []).filter((p) => p.uploaded_by_type === 'admin');

  const isRejected = payment.status === 'rejected';

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

  // Render form fields based on payment method
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
      <div className="space-y-3">
        {/* QR Code display */}
        {payment.beneficiary_qr_code_url && (
          <div className="flex justify-center mb-4">
            <img
              src={payment.beneficiary_qr_code_url}
              alt="QR Code bénéficiaire"
              className="w-28 h-28 rounded-lg border object-cover"
            />
          </div>
        )}

        <div className="space-y-2 text-sm">
          {payment.beneficiary_name && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2">
                <User className="w-4 h-4" /> Nom
              </span>
              <span className="font-medium">{payment.beneficiary_name}</span>
            </div>
          )}
          {payment.beneficiary_phone && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2">
                <Phone className="w-4 h-4" /> Téléphone
              </span>
              <span className="font-medium">{payment.beneficiary_phone}</span>
            </div>
          )}
          {payment.beneficiary_email && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2">
                <Mail className="w-4 h-4" /> Email
              </span>
              <span className="font-medium">{payment.beneficiary_email}</span>
            </div>
          )}
          {payment.beneficiary_bank_name && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2">
                <Building2 className="w-4 h-4" /> Banque
              </span>
              <span className="font-medium">{payment.beneficiary_bank_name}</span>
            </div>
          )}
          {payment.beneficiary_bank_account && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2">
                <CreditCard className="w-4 h-4" /> Compte
              </span>
              <span className="font-medium">{payment.beneficiary_bank_account}</span>
            </div>
          )}
          {payment.beneficiary_notes && (
            <div className="pt-2 border-t">
              <span className="text-muted-foreground text-xs">Notes:</span>
              <p className="text-sm mt-1">{payment.beneficiary_notes}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <MobileLayout>
      <PageHeader 
        title={payment.reference}
        subtitle="Détail du paiement"
        showBack
      />

      <div className="px-4 py-4 space-y-4">
        {/* Status Card */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <Badge className={`${statusConfig[payment.status]?.color} text-white`}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {statusConfig[payment.status]?.label}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {format(new Date(payment.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Montant débité</span>
                <span className="font-bold text-lg">{formatXAF(payment.amount_xaf)} XAF</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Montant envoyé</span>
                <span className="font-bold text-lg text-primary">{formatCurrencyRMB(payment.amount_rmb)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Taux appliqué</span>
                <span>1 RMB = {formatXAF(Math.round(1 / payment.exchange_rate))} XAF</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">ID Paiement</span>
                <span className="font-mono text-xs">{payment.id.substring(0, 8)}...</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Download receipt */}
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={handleDownloadReceipt}
          disabled={isGeneratingPDF}
        >
          {isGeneratingPDF ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileDown className="w-4 h-4" />
          )}
          Télécharger le relevé
        </Button>

        {/* Payment Method */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">Mode de paiement</h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <MethodIcon className="w-5 h-5 text-primary" />
              </div>
              <span className="font-medium">{methodConfig[payment.method]?.label}</span>
            </div>
          </CardContent>
        </Card>

        {/* Cash QR Code - Show for cash payments that are not yet completed/rejected */}
        {payment.method === 'cash' && !['completed', 'rejected'].includes(payment.status) && (
          <CashQRCode
            paymentId={payment.id}
            paymentReference={payment.reference}
            amountRMB={payment.amount_rmb}
            beneficiaryName={payment.beneficiary_name || 'Client'}
          />
        )}

        {/* Cash payment status info */}
        {payment.method === 'cash' && payment.status === 'cash_scanned' && (
          <Card className="border-orange-500/30 bg-orange-500/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <ScanLine className="w-5 h-5 text-orange-500 mt-0.5" />
                <div>
                  <p className="font-medium text-orange-600">QR Code scanné au bureau</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Votre paiement est en cours de traitement au bureau Bonzini Guangzhou.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cash payment completed with signature */}
        {payment.method === 'cash' && payment.status === 'completed' && (payment as any).cash_signature_url && (
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-green-600">Paiement cash effectué</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Signature enregistrée le {(payment as any).cash_signature_timestamp && 
                      format(new Date((payment as any).cash_signature_timestamp), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                  </p>
                  {(payment as any).cash_signed_by_name && (
                    <p className="text-sm text-muted-foreground">
                      Signé par: {(payment as any).cash_signed_by_name}
                    </p>
                  )}
                  
                  {/* Download PDF Receipt */}
                  <div className="mt-3">
                    <CashReceiptDownloadButton
                      payment={payment as any}
                      variant="outline"
                      size="sm"
                      label="Télécharger le reçu PDF"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Beneficiary Info */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Informations du bénéficiaire</h3>
              {isLocked ? (
                <Badge variant="secondary" className="gap-1">
                  <Lock className="w-3 h-3" />
                  Verrouillé
                </Badge>
              ) : canEditBeneficiary && hasBeneficiaryInfo && payment.method !== 'cash' ? (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setIsEditDialogOpen(true)}
                >
                  <Edit2 className="w-4 h-4 mr-1" />
                  Modifier
                </Button>
              ) : null}
            </div>

            {renderBeneficiaryDisplay()}
          </CardContent>
        </Card>

        {/* Ready for payment message */}
        {payment.status === 'ready_for_payment' && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-primary">Votre paiement est prêt à être traité</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Bonzini va procéder au paiement dans les meilleurs délais.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Client Instructions Upload */}
        {canUploadInstructions && (
          <Card>
            <CardContent className="p-4">
              <PaymentProofUpload
                key={uploadKey}
                onFilesSelect={setInstructionFiles}
                selectedFiles={instructionFiles}
                onConfirm={handleUploadInstructions}
                isSubmitting={isUploadingProofs}
              />
            </CardContent>
          </Card>
        )}

        {/* Client Instructions Gallery */}
        {clientProofs.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Mes instructions de paiement
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                Ces documents indiquent à Bonzini où et comment effectuer le paiement.
              </p>
              <PaymentProofGallery
                proofs={clientProofs}
                title=""
                emptyMessage="Aucune instruction ajoutée"
                showUploadedBy={false}
              />
              {isLocked && (
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Lock className="w-3.5 h-3.5" />
                  Les modifications ne sont plus possibles
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Admin Proofs */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-2">Preuves de paiement Bonzini</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Ces documents confirment que le paiement a été exécuté.
            </p>
            <PaymentProofGallery
              proofs={adminProofs}
              title=""
              emptyMessage="Aucune preuve disponible pour le moment"
              showUploadedBy={false}
            />
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-4">Historique</h3>

            {timelineLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <PaymentTimelineDisplay steps={timelineSteps} />
            )}
          </CardContent>
        </Card>

        {/* Rejection reason */}
        {payment.status === 'rejected' && payment.rejection_reason && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-4">
              <h3 className="font-semibold text-destructive mb-2">Raison du refus</h3>
              <p className="text-sm">{payment.rejection_reason}</p>
            </CardContent>
          </Card>
        )}

        {/* Admin comment */}
        {payment.client_visible_comment && (
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="p-4">
              <h3 className="font-semibold text-green-700 mb-2">Message de Bonzini</h3>
              <p className="text-sm">{payment.client_visible_comment}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Beneficiary Dialog */}
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
