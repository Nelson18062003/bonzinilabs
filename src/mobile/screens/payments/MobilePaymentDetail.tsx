import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import {
  useAdminPaymentDetail,
  usePaymentTimeline,
  usePaymentProofs,
  useProcessPayment,
} from '@/hooks/usePayments';
import { useAdminPaymentProofUpload } from '@/hooks/usePaymentProofUpload';
import { formatCurrency, formatCurrencyRMB } from '@/lib/formatters';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Loader2,
  Phone,
  User,
  CheckCircle,
  XCircle,
  Play,
  Clock,
  Building2,
  CreditCard,
  Wallet as WalletIcon,
  Banknote,
  ChevronRight,
  TrendingUp,
  Image as ImageIcon,
  QrCode,
  AlertCircle,
  Upload,
  X,
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  created: { label: 'Créé', color: 'bg-blue-100 text-blue-700' },
  waiting_beneficiary_info: { label: 'En attente infos', color: 'bg-yellow-100 text-yellow-700' },
  ready_for_payment: { label: 'Prêt à payer', color: 'bg-purple-100 text-purple-700' },
  cash_pending: { label: 'QR Généré', color: 'bg-cyan-100 text-cyan-700' },
  cash_scanned: { label: 'Scanné', color: 'bg-orange-100 text-orange-700' },
  processing: { label: 'En cours', color: 'bg-orange-100 text-orange-700' },
  completed: { label: 'Effectué', color: 'bg-green-100 text-green-700' },
  rejected: { label: 'Refusé', color: 'bg-red-100 text-red-700' },
};

const METHOD_CONFIG: Record<string, { label: string; icon: React.ElementType }> = {
  alipay: { label: 'Alipay', icon: CreditCard },
  wechat: { label: 'WeChat Pay', icon: WalletIcon },
  bank_transfer: { label: 'Virement bancaire', icon: Building2 },
  cash: { label: 'Cash', icon: Banknote },
};

export function MobilePaymentDetail() {
  const { paymentId } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();

  const { data: payment, isLoading } = useAdminPaymentDetail(paymentId);
  const { data: timeline } = usePaymentTimeline(paymentId);
  const { data: proofs } = usePaymentProofs(paymentId);

  const processPayment = useProcessPayment();
  const adminProofUpload = useAdminPaymentProofUpload();

  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedProof, setSelectedProof] = useState<string | null>(null);
  const [completeProofFile, setCompleteProofFile] = useState<File | null>(null);
  const [completeProofPreview, setCompleteProofPreview] = useState<string | null>(null);
  const proofInputRef = useRef<HTMLInputElement>(null);

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
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
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

  const statusConfig = STATUS_CONFIG[payment.status] || { label: payment.status, color: 'bg-gray-100 text-gray-700' };
  const methodConfig = METHOD_CONFIG[payment.method] || { label: payment.method, icon: CreditCard };
  const MethodIcon = methodConfig.icon;

  const canStartProcessing = ['ready_for_payment', 'cash_scanned'].includes(payment.status);
  const canComplete = payment.status === 'processing';
  const canReject = !['completed', 'rejected'].includes(payment.status);
  const showActions = canProcess && (canStartProcessing || canComplete || canReject);

  return (
    <div className={cn("flex flex-col min-h-screen", showActions && "pb-24")}>
      <MobileHeader
        title={`Paiement #${payment.reference?.slice(-6) || ''}`}
        showBack
        backTo="/m/payments"
      />

      <div className="flex-1 px-4 py-4 space-y-4">
        {/* Status Badge */}
        <div className="flex items-center justify-center">
          <span className={cn(
            "px-4 py-2 rounded-full text-sm font-semibold",
            statusConfig.color
          )}>
            {statusConfig.label}
          </span>
        </div>

        {/* Amount Card */}
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-5 border border-primary/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <MethodIcon className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm font-medium">{methodConfig.label}</span>
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
              Taux: 1 RMB = {payment.exchange_rate ? (1 / payment.exchange_rate).toFixed(2) : '-'} XAF
            </span>
          </div>
        </div>

        {/* Client Info */}
        <button
          onClick={() => navigate(`/m/clients/${payment.user_id}`)}
          className="w-full bg-card rounded-xl p-4 border border-border text-left active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-base font-medium text-primary">
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
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </div>
        </button>

        {/* Beneficiary Info */}
        {(payment.beneficiary_name || payment.beneficiary_bank_name || payment.beneficiary_qr_code_url) && (
          <div className="bg-card rounded-xl p-4 border border-border">
            <h3 className="font-medium flex items-center gap-2 mb-3">
              <User className="w-4 h-4" />
              Bénéficiaire
            </h3>
            <div className="space-y-2 text-sm">
              {payment.beneficiary_name && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nom</span>
                  <span className="font-medium">{payment.beneficiary_name}</span>
                </div>
              )}
              {payment.beneficiary_phone && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Téléphone</span>
                  <span className="font-medium">{payment.beneficiary_phone}</span>
                </div>
              )}
              {payment.beneficiary_bank_name && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Banque</span>
                  <span className="font-medium">{payment.beneficiary_bank_name}</span>
                </div>
              )}
              {payment.beneficiary_bank_account && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Compte</span>
                  <span className="font-medium">{payment.beneficiary_bank_account}</span>
                </div>
              )}
              {payment.beneficiary_qr_code_url && (
                <div className="pt-2">
                  <button
                    onClick={() => setSelectedProof(payment.beneficiary_qr_code_url)}
                    className="flex items-center gap-2 text-primary"
                  >
                    <QrCode className="w-4 h-4" />
                    Voir le QR Code
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Proofs */}
        {proofs && proofs.length > 0 && (
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                Preuves ({proofs.length})
              </h3>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {proofs.map((proof) => (
                <button
                  key={proof.id}
                  onClick={() => setSelectedProof(proof.file_url)}
                  className="aspect-square rounded-lg bg-muted overflow-hidden active:scale-95 transition-transform"
                >
                  <img
                    src={proof.file_url}
                    alt="Preuve"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder.svg';
                    }}
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Rejection reason */}
        {payment.rejection_reason && (
          <div className="bg-red-50 rounded-xl p-4 border border-red-200">
            <p className="text-sm font-medium text-red-800 mb-1">Motif de rejet</p>
            <p className="text-sm text-red-700">{payment.rejection_reason}</p>
          </div>
        )}

        {/* Timeline */}
        {timeline && timeline.length > 0 && (
          <div className="bg-card rounded-xl p-4 border border-border">
            <h3 className="font-medium mb-4">Historique</h3>
            <div className="space-y-3">
              {timeline.map((event) => (
                <div key={event.id} className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{event.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(event.created_at), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fixed Bottom Actions */}
      {showActions && (
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-xl border-t border-border p-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
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

      {/* Reject Drawer */}
      <Drawer open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Rejeter le paiement</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 py-2 space-y-4">
            <div className="bg-red-50 rounded-xl p-4 border border-red-200">
              <p className="text-sm text-red-800">
                Cette action va rejeter le paiement et rembourser {formatCurrency(payment.amount_xaf)} au wallet du client.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Motif du rejet *</label>
              <textarea
                placeholder="Expliquez pourquoi le paiement est rejeté..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full h-24 p-3 rounded-xl border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
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

      {/* Complete Drawer */}
      <Drawer open={isCompleteOpen} onOpenChange={(open) => {
        setIsCompleteOpen(open);
        if (!open) clearProofFile();
      }}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Confirmer le paiement</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 py-2 space-y-4">
            <div className="bg-green-50 rounded-xl p-4 border border-green-200">
              <p className="text-sm text-green-800">
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

      {/* Proof/QR Viewer Drawer */}
      <Drawer open={!!selectedProof} onOpenChange={() => setSelectedProof(null)}>
        <DrawerContent className="max-h-[90vh]">
          <div className="p-4">
            {selectedProof && (
              <img
                src={selectedProof}
                alt="Image"
                className="w-full rounded-xl"
              />
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
