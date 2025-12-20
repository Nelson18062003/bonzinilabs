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
import { formatXAF, formatCurrencyRMB } from '@/lib/formatters';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Loader2,
  Upload,
  Image as ImageIcon,
  Download,
  Edit2,
  CreditCard,
  Wallet,
  Building2,
  Banknote,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const statusConfig = {
  created: { label: 'Créé', color: 'bg-blue-500', icon: Clock },
  waiting_beneficiary_info: { label: 'En attente d\'infos', color: 'bg-yellow-500', icon: AlertCircle },
  ready_for_payment: { label: 'Prêt à payer', color: 'bg-purple-500', icon: Clock },
  processing: { label: 'En cours', color: 'bg-orange-500', icon: Loader2 },
  completed: { label: 'Effectué', color: 'bg-green-500', icon: CheckCircle2 },
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
  const [isUploadingQr, setIsUploadingQr] = useState(false);
  const qrInputRef = useRef<HTMLInputElement>(null);

  const { data: payment, isLoading: paymentLoading } = usePaymentDetail(paymentId);
  const { data: timeline, isLoading: timelineLoading } = usePaymentTimeline(paymentId);
  const { data: proofs } = usePaymentProofs(paymentId);

  const updateBeneficiaryInfo = useUpdateBeneficiaryInfo();

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
  }, [payment?.id]);

  const handleQrFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setQrFile(file);
  };

  const handleSaveBeneficiaryInfo = async () => {
    if (!paymentId) return;

    try {
      let qrUrl = beneficiaryForm.beneficiary_qr_code_url;

      if (qrFile && (payment?.method === 'alipay' || payment?.method === 'wechat')) {
        setIsUploadingQr(true);

        const fileName = `beneficiary/${paymentId}/${Date.now()}_${qrFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('payment-proofs')
          .upload(fileName, qrFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('payment-proofs').getPublicUrl(fileName);
        qrUrl = data.publicUrl;
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
      });

      setIsEditDialogOpen(false);
      setQrFile(null);
    } catch (err: any) {
      toast.error(err?.message || 'Impossible d\'enregistrer les informations');
    } finally {
      setIsUploadingQr(false);
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
  const canEditBeneficiary = ['created', 'waiting_beneficiary_info'].includes(payment.status);

  const adminProofs = (proofs ?? []).filter((p) => p.uploaded_by_type === 'admin');

  const isRejected = payment.status === 'rejected';

  const stepOrder: string[] = isRejected
    ? ['created', 'waiting_beneficiary_info', 'ready_for_payment', 'processing', 'rejected']
    : ['created', 'waiting_beneficiary_info', 'ready_for_payment', 'processing', 'completed', 'proof_available'];

  const currentStepKey =
    isRejected
      ? 'rejected'
      : payment.status === 'completed' && adminProofs.length > 0
        ? 'proof_available'
        : payment.status;

  const stepMeta: Record<string, { label: string; description: string; icon: React.ElementType }> = {
    created: { label: 'Paiement créé', description: 'Montant réservé', icon: Clock },
    waiting_beneficiary_info: { label: 'Infos bénéficiaire', description: 'Ajoutez les infos pour que Bonzini puisse payer', icon: AlertCircle },
    ready_for_payment: { label: 'Prêt à être traité', description: 'Dans la file Bonzini', icon: Clock },
    processing: { label: 'En cours de traitement', description: 'Paiement en cours', icon: Loader2 },
    completed: { label: 'Paiement effectué', description: 'Paiement réalisé', icon: CheckCircle2 },
    proof_available: { label: 'Preuve disponible', description: 'Preuve ajoutée par Bonzini', icon: CheckCircle2 },
    rejected: { label: 'Paiement refusé', description: 'Solde recrédité', icon: XCircle },
  };

  const eventTypeToStepKey: Record<string, string | undefined> = {
    created: 'created',
    waiting_info: 'waiting_beneficiary_info',
    info_provided: 'ready_for_payment',
    processing: 'processing',
    completed: 'completed',
    rejected: 'rejected',
    proof_uploaded: 'proof_available',
  };

  const stepTimestamps = new Map<string, string>();
  (timeline ?? []).forEach((evt) => {
    const stepKey = eventTypeToStepKey[evt.event_type];
    if (stepKey && !stepTimestamps.has(stepKey)) {
      stepTimestamps.set(stepKey, evt.created_at);
    }
  });

  if (!isRejected && adminProofs.length > 0 && !stepTimestamps.has('proof_available')) {
    stepTimestamps.set('proof_available', adminProofs[adminProofs.length - 1].created_at);
  }

  const currentIndex = stepOrder.indexOf(currentStepKey);

  const timelineSteps = stepOrder.map((key, idx) => {
    const status =
      currentIndex === -1
        ? idx === 0
          ? 'current'
          : 'pending'
        : idx < currentIndex
          ? 'completed'
          : idx === currentIndex
            ? 'current'
            : 'pending';

    return {
      key,
      ...stepMeta[key],
      status,
      created_at: stepTimestamps.get(key),
    };
  });


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
                <span>1 RMB = {(1 / payment.exchange_rate).toFixed(2)} XAF</span>
              </div>
            </div>
          </CardContent>
        </Card>

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

        {/* Beneficiary Info */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Informations du bénéficiaire</h3>
              {canEditBeneficiary && (
                <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <Edit2 className="w-4 h-4 mr-1" />
                      Modifier
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Informations du bénéficiaire</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      {(payment.method === 'alipay' || payment.method === 'wechat') && (
                        <div className="space-y-2">
                          <Label>QR code (Alipay / WeChat)</Label>
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => qrInputRef.current?.click()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') qrInputRef.current?.click();
                            }}
                            className="border-2 border-dashed border-border rounded-xl p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                          >
                            {qrFile ? (
                              <div className="flex items-center justify-center gap-2">
                                <ImageIcon className="w-5 h-5 text-primary" />
                                <span className="text-sm font-medium">{qrFile.name}</span>
                              </div>
                            ) : beneficiaryForm.beneficiary_qr_code_url ? (
                              <div className="flex flex-col items-center gap-2">
                                <img
                                  src={beneficiaryForm.beneficiary_qr_code_url}
                                  alt="QR code bénéficiaire"
                                  className="w-28 h-28 rounded-lg border object-cover"
                                  loading="lazy"
                                />
                                <span className="text-xs text-muted-foreground">Cliquez pour remplacer</span>
                              </div>
                            ) : (
                              <>
                                <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                                <p className="text-sm text-muted-foreground">Cliquez pour ajouter le QR code</p>
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
                          <p className="text-xs text-muted-foreground">
                            Optionnel — vous pourrez aussi l’ajouter plus tard (avant que le paiement passe en cours).
                          </p>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>Nom</Label>
                        <Input
                          value={beneficiaryForm.beneficiary_name}
                          onChange={(e) =>
                            setBeneficiaryForm((prev) => ({ ...prev, beneficiary_name: e.target.value }))
                          }
                          placeholder="Nom du bénéficiaire"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Téléphone</Label>
                        <Input
                          value={beneficiaryForm.beneficiary_phone}
                          onChange={(e) =>
                            setBeneficiaryForm((prev) => ({ ...prev, beneficiary_phone: e.target.value }))
                          }
                          placeholder="Numéro de téléphone"
                        />
                      </div>
                      {payment.method === 'bank_transfer' && (
                        <>
                          <div className="space-y-2">
                            <Label>Nom de la banque</Label>
                            <Input
                              value={beneficiaryForm.beneficiary_bank_name}
                              onChange={(e) =>
                                setBeneficiaryForm((prev) => ({ ...prev, beneficiary_bank_name: e.target.value }))
                              }
                              placeholder="Nom de la banque"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Numéro de compte</Label>
                            <Input
                              value={beneficiaryForm.beneficiary_bank_account}
                              onChange={(e) =>
                                setBeneficiaryForm((prev) => ({ ...prev, beneficiary_bank_account: e.target.value }))
                              }
                              placeholder="Numéro de compte"
                            />
                          </div>
                        </>
                      )}
                      <div className="space-y-2">
                        <Label>Notes</Label>
                        <Textarea
                          value={beneficiaryForm.beneficiary_notes}
                          onChange={(e) =>
                            setBeneficiaryForm((prev) => ({ ...prev, beneficiary_notes: e.target.value }))
                          }
                          placeholder="Instructions supplémentaires"
                        />
                      </div>
                      <Button
                        className="w-full"
                        onClick={handleSaveBeneficiaryInfo}
                        disabled={updateBeneficiaryInfo.isPending || isUploadingQr}
                      >
                        {updateBeneficiaryInfo.isPending || isUploadingQr ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : null}
                        Enregistrer
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {payment.beneficiary_name || payment.beneficiary_phone || payment.beneficiary_bank_account ? (
              <div className="space-y-2 text-sm">
                {payment.beneficiary_name && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nom</span>
                    <span>{payment.beneficiary_name}</span>
                  </div>
                )}
                {payment.beneficiary_phone && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Téléphone</span>
                    <span>{payment.beneficiary_phone}</span>
                  </div>
                )}
                {payment.beneficiary_bank_name && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Banque</span>
                    <span>{payment.beneficiary_bank_name}</span>
                  </div>
                )}
                {payment.beneficiary_bank_account && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Compte</span>
                    <span>{payment.beneficiary_bank_account}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <AlertCircle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Aucune information fournie</p>
                {canEditBeneficiary && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => setIsEditDialogOpen(true)}
                  >
                    Ajouter les informations
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Proofs */}
        <Card>
          <CardContent className="p-4">
            <div className="mb-3">
              <h3 className="font-semibold">Preuves de paiement</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Les preuves sont ajoutées par Bonzini après exécution. Vous pouvez uniquement les consulter.
              </p>
            </div>

            {adminProofs.length > 0 ? (
              <div className="space-y-2">
                {adminProofs.map((proof) => (
                  <div key={proof.id} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{proof.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          Ajouté par Bonzini • {format(new Date(proof.created_at), 'dd/MM/yyyy', { locale: fr })}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" asChild>
                      <a href={proof.file_url} target="_blank" rel="noopener noreferrer">
                        <Download className="w-4 h-4" />
                      </a>
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucune preuve disponible pour le moment
              </p>
            )}
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
              <div className="relative">
                <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-border" />
                <div className="space-y-4">
                  {timelineSteps.map((step, index) => {
                    const Icon = step.icon;
                    const isLast = index === timelineSteps.length - 1;

                    return (
                      <div key={step.key} className="relative pl-8">
                        <div
                          className={
                            `absolute left-1.5 w-3 h-3 rounded-full ` +
                            (step.status === 'completed'
                              ? 'bg-primary'
                              : step.status === 'current'
                                ? 'bg-primary'
                                : 'bg-muted-foreground')
                          }
                        />

                        {!isLast && (
                          <div className="absolute left-3 top-3 bottom-0 w-0.5 bg-border" />
                        )}

                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">{step.label}</p>
                            {step.status !== 'pending' && step.description ? (
                              <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                            ) : null}
                            {step.created_at ? (
                              <p className="text-xs text-muted-foreground mt-1">
                                {format(new Date(step.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                              </p>
                            ) : null}
                          </div>

                          <div className="pt-0.5">
                            <Icon
                              className={
                                'w-4 h-4 ' +
                                (step.status === 'completed'
                                  ? 'text-primary'
                                  : step.status === 'current'
                                    ? (step.key === 'processing' ? 'text-primary animate-spin' : 'text-primary')
                                    : 'text-muted-foreground')
                              }
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rejection reason */}
        {payment.status === 'rejected' && payment.rejection_reason && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <h3 className="font-semibold text-red-700 mb-2">Raison du refus</h3>
              <p className="text-sm text-red-600">{payment.rejection_reason}</p>
            </CardContent>
          </Card>
        )}

        {/* Admin comment */}
        {payment.client_visible_comment && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4">
              <h3 className="font-semibold text-green-700 mb-2">Message de Bonzini</h3>
              <p className="text-sm text-green-600">{payment.client_visible_comment}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </MobileLayout>
  );
}
