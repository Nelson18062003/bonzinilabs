import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  User, 
  Send,
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  Eye,
  Upload,
  Play,
  Ban,
  FileText,
  Smartphone,
  Building,
  MapPin,
  QrCode,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { ROLE_PERMISSIONS } from '@/types/admin';
import { 
  getPaymentById,
  getPaymentBeneficiary,
  getPaymentProofs,
  getPaymentTimeline,
  getPaymentStatusLabel,
  getMethodLabel,
  clients,
} from '@/data/adminMockData';
import { formatCurrency, formatDate } from '@/data/mockData';

export function AdminPaymentDetailPage() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAdminAuth();
  
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showProofDialog, setShowProofDialog] = useState(false);
  const [showMarkPaidDialog, setShowMarkPaidDialog] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const payment = paymentId ? getPaymentById(paymentId) : undefined;
  const beneficiary = paymentId ? getPaymentBeneficiary(paymentId) : undefined;
  const proofs = paymentId ? getPaymentProofs(paymentId) : [];
  const timeline = paymentId ? getPaymentTimeline(paymentId) : [];
  const client = payment ? clients.find(c => c.id === payment.clientId) : undefined;

  const permissions = currentUser ? ROLE_PERMISSIONS[currentUser.role] : null;
  const canProcess = permissions?.canProcessPayments ?? false;

  if (!payment) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Paiement introuvable
            </h2>
            <p className="text-muted-foreground mb-4">
              Ce paiement n'existe pas ou a été supprimé.
            </p>
            <Button onClick={() => navigate('/admin/payments')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour aux paiements
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUBMITTED': return 'bg-gray-500/10 text-gray-600';
      case 'INFO_RECEIVED': return 'bg-blue-500/10 text-blue-600';
      case 'READY_TO_PAY': return 'bg-cyan-500/10 text-cyan-600';
      case 'PROCESSING': return 'bg-amber-500/10 text-amber-600';
      case 'COMPLETED': return 'bg-emerald-500/10 text-emerald-600';
      case 'PROOF_AVAILABLE': return 'bg-primary/10 text-primary';
      case 'CANCELLED': return 'bg-red-500/10 text-red-600';
      default: return 'bg-gray-500/10 text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SUBMITTED': return <Clock className="h-4 w-4" />;
      case 'INFO_RECEIVED': return <FileText className="h-4 w-4" />;
      case 'READY_TO_PAY': return <CreditCard className="h-4 w-4" />;
      case 'PROCESSING': return <Send className="h-4 w-4" />;
      case 'COMPLETED': return <CheckCircle className="h-4 w-4" />;
      case 'PROOF_AVAILABLE': return <Upload className="h-4 w-4" />;
      case 'CANCELLED': return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getTimelineIcon = (step: string) => {
    switch (step) {
      case 'SUBMITTED': return <Clock className="h-4 w-4" />;
      case 'INFO_RECEIVED': return <FileText className="h-4 w-4" />;
      case 'READY_TO_PAY': return <CreditCard className="h-4 w-4" />;
      case 'PROCESSING': return <Send className="h-4 w-4" />;
      case 'COMPLETED': return <CheckCircle className="h-4 w-4" />;
      case 'PROOF_UPLOADED': return <Upload className="h-4 w-4" />;
      case 'PROOF_AVAILABLE': return <Download className="h-4 w-4" />;
      case 'WALLET_DEBITED': return <CreditCard className="h-4 w-4" />;
      case 'CANCELLED': return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'ALIPAY':
      case 'WECHAT':
        return <Smartphone className="h-5 w-5" />;
      case 'BANK_TRANSFER':
        return <Building className="h-5 w-5" />;
      case 'CASH_COUNTER':
        return <MapPin className="h-5 w-5" />;
      default:
        return <CreditCard className="h-5 w-5" />;
    }
  };

  const handleStartProcessing = () => {
    setIsProcessing(true);
    setTimeout(() => {
      toast.success('Paiement marqué "En cours"');
      setIsProcessing(false);
    }, 500);
  };

  const handleMarkAsPaid = () => {
    setIsProcessing(true);
    setTimeout(() => {
      toast.success('Paiement marqué comme effectué. Wallet débité.');
      setShowMarkPaidDialog(false);
      setIsProcessing(false);
    }, 500);
  };

  const handleCancelPayment = () => {
    if (!cancellationReason.trim()) {
      toast.error('Veuillez indiquer un motif d\'annulation');
      return;
    }
    setIsProcessing(true);
    setTimeout(() => {
      toast.success('Paiement annulé');
      setShowCancelDialog(false);
      setCancellationReason('');
      setIsProcessing(false);
    }, 500);
  };

  const handleUploadProof = () => {
    setIsProcessing(true);
    setTimeout(() => {
      toast.success('Preuve de paiement uploadée');
      setShowProofDialog(false);
      setIsProcessing(false);
    }, 500);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigate('/admin/payments')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">
              Paiement #{payment.id.slice(-6).toUpperCase()}
            </h1>
            <Badge className={getStatusColor(payment.status)}>
              {getStatusIcon(payment.status)}
              <span className="ml-1">{getPaymentStatusLabel(payment.status)}</span>
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Créé le {formatDate(payment.createdAt)}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Client Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Client
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {payment.clientName.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">
                    {payment.clientName}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {payment.clientEmail}
                  </p>
                  {client && (
                    <p className="text-sm text-muted-foreground">
                      {client.whatsappNumber}
                    </p>
                  )}
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate(`/admin/clients/${payment.clientId}`)}
                >
                  Voir profil
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Payment Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Détails du paiement
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Montant XAF</p>
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency(payment.amountXAF)}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-primary/10">
                  <p className="text-sm text-muted-foreground">Montant RMB</p>
                  <p className="text-2xl font-bold text-primary">
                    ¥ {payment.amountRMB.toLocaleString()}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Taux utilisé</p>
                  <p className="font-medium text-foreground">
                    1 RMB = {payment.exchangeRate} XAF
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Frais</p>
                  <p className="font-medium text-foreground">
                    {formatCurrency(payment.fees)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Mode de paiement</p>
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    {getMethodIcon(payment.method)}
                    {getMethodLabel(payment.method)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Beneficiary Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Bénéficiaire
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  {getMethodIcon(payment.method)}
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="font-semibold text-foreground text-lg">
                      {payment.beneficiaryName}
                    </p>
                    {beneficiary?.recipientPhone && (
                      <p className="text-sm text-muted-foreground">
                        {beneficiary.recipientPhone}
                      </p>
                    )}
                  </div>

                  <Separator />

                  {/* Method-specific details */}
                  {payment.method === 'ALIPAY' && beneficiary && (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Alipay ID</p>
                        <p className="font-medium text-foreground">
                          {beneficiary.alipayId || 'N/A'}
                        </p>
                      </div>
                      {beneficiary.qrCodeUrl && (
                        <div>
                          <p className="text-muted-foreground">QR Code</p>
                          <Button variant="outline" size="sm" className="mt-1">
                            <QrCode className="h-4 w-4 mr-1" />
                            Voir QR
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {payment.method === 'WECHAT' && beneficiary && (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">WeChat ID</p>
                        <p className="font-medium text-foreground">
                          {beneficiary.wechatId || 'N/A'}
                        </p>
                      </div>
                      {beneficiary.qrCodeUrl && (
                        <div>
                          <p className="text-muted-foreground">QR Code</p>
                          <Button variant="outline" size="sm" className="mt-1">
                            <QrCode className="h-4 w-4 mr-1" />
                            Voir QR
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {payment.method === 'BANK_TRANSFER' && beneficiary && (
                    <div className="space-y-3 text-sm">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-muted-foreground">Banque</p>
                          <p className="font-medium text-foreground">
                            {beneficiary.bankName || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Code SWIFT</p>
                          <p className="font-medium text-foreground">
                            {beneficiary.swiftCode || 'N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-muted-foreground">Nom du compte</p>
                          <p className="font-medium text-foreground">
                            {beneficiary.accountName || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">N° de compte</p>
                          <p className="font-medium text-foreground font-mono">
                            {beneficiary.accountNumber || 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {payment.method === 'CASH_COUNTER' && beneficiary && (
                    <div className="space-y-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Point de retrait</p>
                        <p className="font-medium text-foreground">
                          {beneficiary.cashCounterLocation || 'N/A'}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-muted-foreground">Nom du receveur</p>
                          <p className="font-medium text-foreground">
                            {beneficiary.receiverName || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">N° pièce d'identité</p>
                          <p className="font-medium text-foreground font-mono">
                            {beneficiary.receiverIdNumber || 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Proofs */}
          {proofs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Preuves de paiement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {proofs.map((proof) => (
                    <div 
                      key={proof.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-background">
                          {proof.fileType === 'pdf' ? (
                            <FileText className="h-5 w-5 text-red-500" />
                          ) : (
                            <FileText className="h-5 w-5 text-blue-500" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm">
                            {proof.fileName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {proof.fileSize ? `${(proof.fileSize / 1024).toFixed(0)} Ko • ` : ''}
                            {formatDate(proof.uploadedAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cancellation Reason */}
          {payment.status === 'CANCELLED' && payment.cancellationReason && (
            <Card className="border-red-200 bg-red-50/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <XCircle className="h-5 w-5" />
                  Motif d'annulation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground">{payment.cancellationReason}</p>
                {payment.cancelledAt && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Annulé le {formatDate(payment.cancelledAt)}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          {canProcess && !['COMPLETED', 'PROOF_AVAILABLE', 'CANCELLED'].includes(payment.status) && (
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {payment.status === 'SUBMITTED' && (
                  <Button 
                    className="w-full" 
                    onClick={handleStartProcessing}
                    disabled={isProcessing}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Commencer le traitement
                  </Button>
                )}

                {['INFO_RECEIVED', 'READY_TO_PAY', 'PROCESSING'].includes(payment.status) && (
                  <Button 
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => setShowMarkPaidDialog(true)}
                    disabled={isProcessing}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Marquer comme payé
                  </Button>
                )}

                {!['CANCELLED', 'COMPLETED', 'PROOF_AVAILABLE'].includes(payment.status) && (
                  <Button 
                    variant="destructive" 
                    className="w-full"
                    onClick={() => setShowCancelDialog(true)}
                    disabled={isProcessing}
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Annuler le paiement
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Upload Proof (for COMPLETED status) */}
          {canProcess && payment.status === 'COMPLETED' && (
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full"
                  onClick={() => setShowProofDialog(true)}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Uploader preuve
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Historique
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {timeline.map((event, index) => (
                  <div key={event.id} className="flex gap-3">
                    <div className="relative">
                      <div className={`p-2 rounded-full ${
                        event.step === 'CANCELLED' 
                          ? 'bg-red-100 text-red-600' 
                          : event.step === 'COMPLETED' || event.step === 'PROOF_AVAILABLE'
                          ? 'bg-emerald-100 text-emerald-600'
                          : 'bg-primary/10 text-primary'
                      }`}>
                        {getTimelineIcon(event.step)}
                      </div>
                      {index < timeline.length - 1 && (
                        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-0.5 h-6 bg-border" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="font-medium text-foreground text-sm">
                        {event.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(event.timestamp)}
                        {event.performedByName && ` • ${event.performedByName}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mark as Paid Dialog */}
      <Dialog open={showMarkPaidDialog} onOpenChange={setShowMarkPaidDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer le paiement effectué</DialogTitle>
            <DialogDescription>
              Confirmez que le paiement de {payment.amountRMB.toLocaleString()} RMB 
              à {payment.beneficiaryName} a été effectué.
              <br /><br />
              <strong>Important:</strong> Cette action débitera automatiquement le 
              wallet du client de {formatCurrency(payment.amountXAF)}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowMarkPaidDialog(false)}
              disabled={isProcessing}
            >
              Annuler
            </Button>
            <Button 
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleMarkAsPaid}
              disabled={isProcessing}
            >
              {isProcessing ? 'Traitement...' : 'Confirmer paiement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Annuler le paiement</DialogTitle>
            <DialogDescription>
              Indiquez le motif d'annulation de ce paiement.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Motif d'annulation *</Label>
              <Textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Ex: Demande du client, informations bénéficiaire incorrectes..."
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowCancelDialog(false)}
              disabled={isProcessing}
            >
              Retour
            </Button>
            <Button 
              variant="destructive"
              onClick={handleCancelPayment}
              disabled={isProcessing || !cancellationReason.trim()}
            >
              {isProcessing ? 'Annulation...' : 'Confirmer annulation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Proof Dialog */}
      <Dialog open={showProofDialog} onOpenChange={setShowProofDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Uploader la preuve de paiement</DialogTitle>
            <DialogDescription>
              Ajoutez la preuve de paiement (capture d'écran, reçu, etc.)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Fichier</Label>
              <Input
                type="file"
                accept="image/*,.pdf"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Formats acceptés: JPG, PNG, PDF (max 10 Mo)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowProofDialog(false)}
              disabled={isProcessing}
            >
              Annuler
            </Button>
            <Button 
              onClick={handleUploadProof}
              disabled={isProcessing}
            >
              {isProcessing ? 'Upload...' : 'Uploader'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
