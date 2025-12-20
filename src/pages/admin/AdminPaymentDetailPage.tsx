import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminCard } from '@/components/admin/ui/AdminCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { 
  useAdminPaymentDetail, 
  usePaymentTimeline, 
  usePaymentProofs,
  useProcessPayment,
  useAdminUploadPaymentProof
} from '@/hooks/usePayments';
import { formatXAF, formatCurrencyRMB } from '@/lib/formatters';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  ArrowLeft,
  CreditCard, 
  Wallet, 
  Building2, 
  Banknote,
  CheckCircle2,
  XCircle,
  Loader2,
  Play,
  Upload,
  Download,
  Image as ImageIcon,
  User,
  Phone,
  AlertCircle,
  Clock
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  created: { label: 'Créé', color: 'bg-blue-500', icon: Clock },
  waiting_beneficiary_info: { label: 'En attente infos', color: 'bg-yellow-500', icon: AlertCircle },
  ready_for_payment: { label: 'Prêt à payer', color: 'bg-purple-500', icon: Clock },
  processing: { label: 'En cours', color: 'bg-orange-500', icon: Loader2 },
  completed: { label: 'Effectué', color: 'bg-green-500', icon: CheckCircle2 },
  rejected: { label: 'Refusé', color: 'bg-red-500', icon: XCircle },
};

const methodConfig: Record<string, { label: string; icon: React.ElementType }> = {
  alipay: { label: 'Alipay', icon: CreditCard },
  wechat: { label: 'WeChat Pay', icon: Wallet },
  bank_transfer: { label: 'Virement bancaire', icon: Building2 },
  cash: { label: 'Cash', icon: Banknote },
};

export function AdminPaymentDetailPage() {
  const { paymentId } = useParams();
  const navigate = useNavigate();
  
  const { data: payment, isLoading } = useAdminPaymentDetail(paymentId);
  const { data: timeline } = usePaymentTimeline(paymentId);
  const { data: proofs } = usePaymentProofs(paymentId);
  
  const processPayment = useProcessPayment();
  const uploadProof = useAdminUploadPaymentProof();
  
  const [rejectReason, setRejectReason] = useState('');
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [proofDescription, setProofDescription] = useState('');
  const [isProofDialogOpen, setIsProofDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleStartProcessing = async () => {
    if (!paymentId) return;
    await processPayment.mutateAsync({ paymentId, action: 'start_processing' });
  };

  const handleComplete = async () => {
    if (!paymentId) return;
    await processPayment.mutateAsync({ paymentId, action: 'complete' });
  };

  const handleReject = async () => {
    if (!paymentId || !rejectReason.trim()) return;
    await processPayment.mutateAsync({ 
      paymentId, 
      action: 'reject', 
      comment: rejectReason 
    });
    setIsRejectDialogOpen(false);
    setRejectReason('');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setIsProofDialogOpen(true);
    }
  };

  const handleUploadProof = async () => {
    if (!paymentId || !selectedFile) return;
    await uploadProof.mutateAsync({
      paymentId,
      file: selectedFile,
      description: proofDescription,
    });
    setIsProofDialogOpen(false);
    setSelectedFile(null);
    setProofDescription('');
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </AdminLayout>
    );
  }

  if (!payment) {
    return (
      <AdminLayout>
        <div className="p-6 text-center">
          <p className="text-muted-foreground">Paiement non trouvé</p>
          <Button onClick={() => navigate('/admin/payments')} className="mt-4">
            Retour aux paiements
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const status = statusConfig[payment.status];
  const method = methodConfig[payment.method];
  const StatusIcon = status?.icon || Clock;
  const MethodIcon = method?.icon || CreditCard;
  
  const canProcess = payment.status === 'ready_for_payment';
  const canComplete = payment.status === 'processing';
  const canReject = !['completed', 'rejected'].includes(payment.status);
  const canUploadProof = payment.status === 'processing' || payment.status === 'completed';

  const clientName = payment.profiles 
    ? `${payment.profiles.first_name || ''} ${payment.profiles.last_name || ''}`.trim() 
    : 'Client inconnu';

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/payments')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">{payment.reference}</h1>
            <p className="text-sm text-muted-foreground">
              {format(new Date(payment.created_at), 'dd MMMM yyyy à HH:mm', { locale: fr })}
            </p>
          </div>
          <Badge className={`${status?.color} text-white`}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {status?.label}
          </Badge>
        </div>

        {/* Client info */}
        <AdminCard>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <User className="w-4 h-4" />
            Informations client
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Client</span>
              <span className="font-medium">{clientName}</span>
            </div>
            {payment.profiles?.phone && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Téléphone</span>
                <span className="font-medium">{payment.profiles.phone}</span>
              </div>
            )}
            {payment.profiles?.company_name && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entreprise</span>
                <span className="font-medium">{payment.profiles.company_name}</span>
              </div>
            )}
          </div>
        </AdminCard>

        {/* Payment summary */}
        <AdminCard>
          <h3 className="font-semibold mb-3">Récapitulatif du paiement</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Montant débité</span>
              <span className="font-bold text-lg">{formatXAF(payment.amount_xaf)} XAF</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Montant à envoyer</span>
              <span className="font-bold text-lg text-primary">{formatCurrencyRMB(payment.amount_rmb)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Taux appliqué</span>
              <span>1 RMB = {(1 / payment.exchange_rate).toFixed(2)} XAF</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t">
              <span className="text-muted-foreground">Solde avant</span>
              <span>{formatXAF(payment.balance_before)} XAF</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Solde après</span>
              <span>{formatXAF(payment.balance_after)} XAF</span>
            </div>
          </div>
        </AdminCard>

        {/* Method & Beneficiary */}
        <AdminCard>
          <h3 className="font-semibold mb-3">Mode de paiement & Bénéficiaire</h3>
          
          <div className="flex items-center gap-3 mb-4 p-3 bg-muted rounded-lg">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <MethodIcon className="w-5 h-5 text-primary" />
            </div>
            <span className="font-medium">{method?.label}</span>
          </div>

          {payment.beneficiary_name || payment.beneficiary_phone || payment.beneficiary_bank_account || payment.beneficiary_qr_code_url ? (
            <div className="space-y-2">
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
                <div className="mt-3">
                  <p className="text-sm text-muted-foreground mb-2">QR Code fourni:</p>
                  <img 
                    src={payment.beneficiary_qr_code_url} 
                    alt="QR Code" 
                    className="w-32 h-32 rounded-lg border object-cover"
                  />
                </div>
              )}
              {payment.beneficiary_notes && (
                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground">Notes:</p>
                  <p className="text-sm">{payment.beneficiary_notes}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4 bg-yellow-500/10 rounded-lg">
              <AlertCircle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
              <p className="text-sm text-yellow-600 font-medium">Informations bénéficiaire manquantes</p>
              <p className="text-xs text-muted-foreground">Le client n'a pas encore fourni les informations</p>
            </div>
          )}
        </AdminCard>

        {/* Proofs */}
        <AdminCard>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Preuves de paiement</h3>
            {canUploadProof && (
              <>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4 mr-1" />
                  Ajouter
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </>
            )}
          </div>

          {proofs && proofs.length > 0 ? (
            <div className="space-y-2">
              {proofs.map((proof) => (
                <div key={proof.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{proof.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Par {proof.uploaded_by_type === 'admin' ? 'Admin' : 'Client'} • {format(new Date(proof.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
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
        </AdminCard>

        {/* Timeline */}
        <AdminCard>
          <h3 className="font-semibold mb-4">Timeline</h3>
          {timeline && timeline.length > 0 ? (
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
            <p className="text-sm text-muted-foreground text-center">Aucun événement</p>
          )}
        </AdminCard>

        {/* Rejection reason */}
        {payment.status === 'rejected' && payment.rejection_reason && (
          <AdminCard className="border-red-200 bg-red-50">
            <h3 className="font-semibold text-red-700 mb-2">Raison du refus</h3>
            <p className="text-sm text-red-600">{payment.rejection_reason}</p>
          </AdminCard>
        )}

        {/* Actions */}
        {(canProcess || canComplete || canReject) && (
          <AdminCard>
            <h3 className="font-semibold mb-4">Actions</h3>
            <div className="space-y-3">
              {canProcess && (
                <Button 
                  className="w-full" 
                  onClick={handleStartProcessing}
                  disabled={processPayment.isPending}
                >
                  {processPayment.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  Marquer "En cours de traitement"
                </Button>
              )}

              {canComplete && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button className="w-full bg-green-600 hover:bg-green-700">
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Marquer "Paiement effectué"
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmer le paiement</AlertDialogTitle>
                      <AlertDialogDescription>
                        Êtes-vous sûr d'avoir effectué ce paiement ? Cette action est irréversible.
                        N'oubliez pas d'ajouter la preuve de paiement.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={handleComplete}>
                        Confirmer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              {canReject && (
                <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="destructive" className="w-full">
                      <XCircle className="w-4 h-4 mr-2" />
                      Refuser le paiement
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Refuser le paiement</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                      <Textarea
                        placeholder="Raison du refus (obligatoire)..."
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        rows={4}
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        Cette raison sera visible par le client. Le montant sera recrédité.
                      </p>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>
                        Annuler
                      </Button>
                      <Button 
                        variant="destructive" 
                        onClick={handleReject}
                        disabled={!rejectReason.trim() || processPayment.isPending}
                      >
                        {processPayment.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        Confirmer le refus
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </AdminCard>
        )}
      </div>

      {/* Proof upload dialog */}
      <Dialog open={isProofDialogOpen} onOpenChange={setIsProofDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une preuve</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {selectedFile && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <ImageIcon className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm font-medium">{selectedFile.name}</span>
              </div>
            )}
            <Textarea
              placeholder="Description (optionnel)..."
              value={proofDescription}
              onChange={(e) => setProofDescription(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsProofDialogOpen(false); setSelectedFile(null); }}>
              Annuler
            </Button>
            <Button onClick={handleUploadProof} disabled={uploadProof.isPending}>
              {uploadProof.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Télécharger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
