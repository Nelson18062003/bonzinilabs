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
  useUploadPaymentProof
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
  Banknote
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useState, useRef } from 'react';
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
    beneficiary_bank_name: '',
    beneficiary_bank_account: '',
    beneficiary_notes: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: payment, isLoading: paymentLoading } = usePaymentDetail(paymentId);
  const { data: timeline, isLoading: timelineLoading } = usePaymentTimeline(paymentId);
  const { data: proofs } = usePaymentProofs(paymentId);
  
  const updateBeneficiaryInfo = useUpdateBeneficiaryInfo();
  const uploadProof = useUploadPaymentProof();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !paymentId) return;

    await uploadProof.mutateAsync({ paymentId, file });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveBeneficiaryInfo = async () => {
    if (!paymentId) return;
    await updateBeneficiaryInfo.mutateAsync({
      paymentId,
      beneficiaryInfo: beneficiaryForm,
    });
    setIsEditDialogOpen(false);
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
  const canUploadProof = ['created', 'waiting_beneficiary_info', 'ready_for_payment'].includes(payment.status);

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
                      <div className="space-y-2">
                        <Label>Nom</Label>
                        <Input 
                          value={beneficiaryForm.beneficiary_name}
                          onChange={(e) => setBeneficiaryForm(prev => ({ ...prev, beneficiary_name: e.target.value }))}
                          placeholder="Nom du bénéficiaire"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Téléphone</Label>
                        <Input 
                          value={beneficiaryForm.beneficiary_phone}
                          onChange={(e) => setBeneficiaryForm(prev => ({ ...prev, beneficiary_phone: e.target.value }))}
                          placeholder="Numéro de téléphone"
                        />
                      </div>
                      {payment.method === 'bank_transfer' && (
                        <>
                          <div className="space-y-2">
                            <Label>Nom de la banque</Label>
                            <Input 
                              value={beneficiaryForm.beneficiary_bank_name}
                              onChange={(e) => setBeneficiaryForm(prev => ({ ...prev, beneficiary_bank_name: e.target.value }))}
                              placeholder="Nom de la banque"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Numéro de compte</Label>
                            <Input 
                              value={beneficiaryForm.beneficiary_bank_account}
                              onChange={(e) => setBeneficiaryForm(prev => ({ ...prev, beneficiary_bank_account: e.target.value }))}
                              placeholder="Numéro de compte"
                            />
                          </div>
                        </>
                      )}
                      <div className="space-y-2">
                        <Label>Notes</Label>
                        <Textarea 
                          value={beneficiaryForm.beneficiary_notes}
                          onChange={(e) => setBeneficiaryForm(prev => ({ ...prev, beneficiary_notes: e.target.value }))}
                          placeholder="Instructions supplémentaires"
                        />
                      </div>
                      <Button 
                        className="w-full" 
                        onClick={handleSaveBeneficiaryInfo}
                        disabled={updateBeneficiaryInfo.isPending}
                      >
                        {updateBeneficiaryInfo.isPending ? (
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
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Preuves</h3>
              {canUploadProof && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadProof.isPending}
                >
                  {uploadProof.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <Upload className="w-4 h-4 mr-1" />
                  )}
                  Ajouter
                </Button>
              )}
              <input 
                ref={fileInputRef}
                type="file" 
                accept="image/*,application/pdf" 
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>

            {proofs && proofs.length > 0 ? (
              <div className="space-y-2">
                {proofs.map((proof) => (
                  <div key={proof.id} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{proof.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          Par {proof.uploaded_by_type === 'admin' ? 'Bonzini' : 'Vous'} • {format(new Date(proof.created_at), 'dd/MM/yyyy', { locale: fr })}
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
                Aucune preuve pour le moment
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
            ) : timeline && timeline.length > 0 ? (
              <div className="relative">
                <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-border" />
                <div className="space-y-4">
                  {timeline.map((event, index) => (
                    <div key={event.id} className="relative pl-8">
                      <div className={`absolute left-1.5 w-3 h-3 rounded-full ${
                        index === timeline.length - 1 ? 'bg-primary' : 'bg-muted-foreground'
                      }`} />
                      <div>
                        <p className="text-sm font-medium">{event.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(event.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center">
                Aucun événement
              </p>
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
