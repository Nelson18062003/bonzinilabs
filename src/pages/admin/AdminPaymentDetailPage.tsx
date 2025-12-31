import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminCard } from '@/components/admin/ui/AdminCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  useAdminPaymentDetail, 
  usePaymentTimeline, 
  usePaymentProofs,
  useProcessPayment,
  useAdminUploadPaymentProof
} from '@/hooks/usePayments';
import { useDeletePayment, useDeletePaymentProof, useAdminUpdateBeneficiaryInfo } from '@/hooks/useAdminPayments';
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
  AlertCircle,
  Clock,
  Trash2,
  Plus,
  ExternalLink,
  QrCode
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
  const deletePayment = useDeletePayment();
  const deleteProof = useDeletePaymentProof();
  const updateBeneficiary = useAdminUpdateBeneficiaryInfo();
  
  const [rejectReason, setRejectReason] = useState('');
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [proofDescription, setProofDescription] = useState('');
  const [isProofDialogOpen, setIsProofDialogOpen] = useState(false);
  const [isAddQrDialogOpen, setIsAddQrDialogOpen] = useState(false);
  const [proofToDelete, setProofToDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qrInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedQrFile, setSelectedQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);

  // Beneficiary edit state
  const [isEditBeneficiaryOpen, setIsEditBeneficiaryOpen] = useState(false);
  const [editBeneficiaryName, setEditBeneficiaryName] = useState('');
  const [editBeneficiaryPhone, setEditBeneficiaryPhone] = useState('');
  const [editBeneficiaryBankName, setEditBeneficiaryBankName] = useState('');
  const [editBeneficiaryBankAccount, setEditBeneficiaryBankAccount] = useState('');

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

  const handleDeletePayment = async () => {
    if (!paymentId) return;
    await deletePayment.mutateAsync(paymentId);
    navigate('/admin/payments');
  };

  const handleDeleteProof = async () => {
    if (!proofToDelete) return;
    await deleteProof.mutateAsync(proofToDelete);
    setProofToDelete(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setIsProofDialogOpen(true);
    }
  };

  const handleQrFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedQrFile(file);
      setQrPreview(URL.createObjectURL(file));
      setIsAddQrDialogOpen(true);
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

  const handleUploadQrCode = async () => {
    if (!paymentId || !selectedQrFile) return;
    await updateBeneficiary.mutateAsync({
      paymentId,
      beneficiaryInfo: {},
      qrCodeFile: selectedQrFile,
    });
    setIsAddQrDialogOpen(false);
    setSelectedQrFile(null);
    if (qrPreview) {
      URL.revokeObjectURL(qrPreview);
      setQrPreview(null);
    }
  };

  const handleUpdateBeneficiary = async () => {
    if (!paymentId) return;
    await updateBeneficiary.mutateAsync({
      paymentId,
      beneficiaryInfo: {
        beneficiary_name: editBeneficiaryName || undefined,
        beneficiary_phone: editBeneficiaryPhone || undefined,
        beneficiary_bank_name: editBeneficiaryBankName || undefined,
        beneficiary_bank_account: editBeneficiaryBankAccount || undefined,
      },
    });
    setIsEditBeneficiaryOpen(false);
  };

  const openEditBeneficiary = () => {
    setEditBeneficiaryName(payment?.beneficiary_name || '');
    setEditBeneficiaryPhone(payment?.beneficiary_phone || '');
    setEditBeneficiaryBankName(payment?.beneficiary_bank_name || '');
    setEditBeneficiaryBankAccount(payment?.beneficiary_bank_account || '');
    setIsEditBeneficiaryOpen(true);
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
  const canDelete = !['completed'].includes(payment.status);
  const canUploadProof = !['rejected'].includes(payment.status);
  const canDeleteProofs = !['processing', 'completed'].includes(payment.status);
  const canAddQrCode = !['processing', 'completed', 'rejected'].includes(payment.status);
  const canEditBeneficiary = !['processing', 'completed', 'rejected'].includes(payment.status);

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
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Mode de paiement & Bénéficiaire</h3>
            {canEditBeneficiary && (
              <Button variant="outline" size="sm" onClick={openEditBeneficiary}>
                Modifier
              </Button>
            )}
          </div>
          
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
                    className="w-32 h-32 rounded-lg border object-cover cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => window.open(payment.beneficiary_qr_code_url!, '_blank')}
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
              <p className="text-xs text-muted-foreground mb-3">Le client n'a pas encore fourni les informations</p>
              {canAddQrCode && (
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" size="sm" onClick={openEditBeneficiary}>
                    <Plus className="w-4 h-4 mr-1" />
                    Ajouter infos
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => qrInputRef.current?.click()}>
                    <QrCode className="w-4 h-4 mr-1" />
                    Ajouter QR code
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Add QR code button if info exists but no QR */}
          {canAddQrCode && !payment.beneficiary_qr_code_url && (payment.beneficiary_name || payment.beneficiary_bank_account) && (
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-3 w-full"
              onClick={() => qrInputRef.current?.click()}
            >
              <QrCode className="w-4 h-4 mr-1" />
              Ajouter un QR code
            </Button>
          )}

          <input
            ref={qrInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleQrFileSelect}
          />
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
                <div key={proof.id} className="flex items-center justify-between p-3 bg-muted rounded-lg group">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {proof.file_type?.startsWith('image/') ? (
                      <img 
                        src={proof.file_url} 
                        alt={proof.file_name}
                        className="w-10 h-10 rounded object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{proof.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Par {proof.uploaded_by_type === 'admin' ? 'Admin' : 'Client'} • {format(new Date(proof.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" asChild>
                      <a href={proof.file_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                    <Button variant="ghost" size="icon" asChild>
                      <a href={proof.file_url} download={proof.file_name}>
                        <Download className="w-4 h-4" />
                      </a>
                    </Button>
                    {canDeleteProofs && (
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setProofToDelete(proof.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucune preuve pour le moment
            </p>
          )}
        </AdminCard>

        {/* Client visible comment */}
        {payment.client_visible_comment && (
          <AdminCard>
            <h3 className="font-semibold mb-2">Motif (visible client)</h3>
            <p className="text-sm">{payment.client_visible_comment}</p>
          </AdminCard>
        )}

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
        {(canProcess || canComplete || canReject || canDelete) && (
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

              {canDelete && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="w-full text-destructive border-destructive hover:bg-destructive/10">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Supprimer le paiement
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer le paiement ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Cette action est irréversible. Le montant de {formatXAF(payment.amount_xaf)} XAF 
                        sera recrédité sur le compte du client.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleDeletePayment}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        {deletePayment.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        Supprimer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
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

      {/* QR code upload dialog */}
      <Dialog open={isAddQrDialogOpen} onOpenChange={(open) => {
        setIsAddQrDialogOpen(open);
        if (!open && qrPreview) {
          URL.revokeObjectURL(qrPreview);
          setQrPreview(null);
          setSelectedQrFile(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un QR code de paiement</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {qrPreview && (
              <img 
                src={qrPreview} 
                alt="QR Code preview" 
                className="w-48 h-48 mx-auto rounded-lg border object-cover"
              />
            )}
            <p className="text-xs text-muted-foreground text-center mt-2">
              Ce QR code sera enregistré comme méthode de paiement pour ce bénéficiaire
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddQrDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleUploadQrCode} disabled={updateBeneficiary.isPending}>
              {updateBeneficiary.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete proof confirmation */}
      <AlertDialog open={!!proofToDelete} onOpenChange={(open) => !open && setProofToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette preuve ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteProof}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteProof.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit beneficiary dialog */}
      <Dialog open={isEditBeneficiaryOpen} onOpenChange={setIsEditBeneficiaryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier les informations bénéficiaire</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label>Nom du bénéficiaire</Label>
              <Input
                value={editBeneficiaryName}
                onChange={(e) => setEditBeneficiaryName(e.target.value)}
                placeholder="Nom complet"
              />
            </div>
            <div>
              <Label>Téléphone</Label>
              <Input
                value={editBeneficiaryPhone}
                onChange={(e) => setEditBeneficiaryPhone(e.target.value)}
                placeholder="+86..."
              />
            </div>
            {(payment.method === 'bank_transfer') && (
              <>
                <div>
                  <Label>Banque</Label>
                  <Input
                    value={editBeneficiaryBankName}
                    onChange={(e) => setEditBeneficiaryBankName(e.target.value)}
                    placeholder="Nom de la banque"
                  />
                </div>
                <div>
                  <Label>Numéro de compte</Label>
                  <Input
                    value={editBeneficiaryBankAccount}
                    onChange={(e) => setEditBeneficiaryBankAccount(e.target.value)}
                    placeholder="Numéro de compte bancaire"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditBeneficiaryOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleUpdateBeneficiary} disabled={updateBeneficiary.isPending}>
              {updateBeneficiary.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
