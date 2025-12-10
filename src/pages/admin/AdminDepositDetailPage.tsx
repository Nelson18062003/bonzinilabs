import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  User,
  Mail,
  Phone,
  Wallet,
  Calendar,
  FileText,
  Download,
  Image,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  ExternalLink,
  CreditCard,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { 
  getDepositById,
  getDepositProofs,
  getDepositTimeline,
  getDepositStatusLabel, 
  getMethodLabel,
  clients,
  getWalletByClientId,
} from '@/data/adminMockData';
import { formatCurrency, formatDate } from '@/data/mockData';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { DepositStatus, DepositTimelineEvent } from '@/types/admin';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

export function AdminDepositDetailPage() {
  const { depositId } = useParams();
  const navigate = useNavigate();
  const { hasPermission, logAction, currentUser } = useAdminAuth();
  
  const deposit = depositId ? getDepositById(depositId) : null;
  const proofs = depositId ? getDepositProofs(depositId) : [];
  const timeline = depositId ? getDepositTimeline(depositId) : [];
  const client = deposit ? clients.find(c => c.id === deposit.clientId) : null;
  const wallet = client ? getWalletByClientId(client.id) : null;
  
  const [isValidateDialogOpen, setIsValidateDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [adminComment, setAdminComment] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  const canProcess = hasPermission('canProcessDeposits');

  if (!deposit) {
    return (
      <AdminLayout>
        <div className="p-6">
          <Button variant="ghost" onClick={() => navigate('/admin/deposits')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
          <Card className="mt-4">
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">Dépôt non trouvé</p>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  const getStatusColor = (status: DepositStatus) => {
    switch (status) {
      case 'SUBMITTED': return 'bg-gray-500/10 text-gray-600';
      case 'PROOF_UPLOADED': return 'bg-blue-500/10 text-blue-600';
      case 'UNDER_VERIFICATION': return 'bg-amber-500/10 text-amber-600';
      case 'VALIDATED': return 'bg-emerald-500/10 text-emerald-600';
      case 'REJECTED': return 'bg-red-500/10 text-red-600';
      default: return 'bg-gray-500/10 text-gray-600';
    }
  };

  const getTimelineIcon = (step: string) => {
    switch (step) {
      case 'SUBMITTED': return <Clock className="h-4 w-4" />;
      case 'PROOF_UPLOADED': return <FileText className="h-4 w-4" />;
      case 'UNDER_VERIFICATION': return <AlertCircle className="h-4 w-4" />;
      case 'VALIDATED': return <CheckCircle className="h-4 w-4" />;
      case 'REJECTED': return <XCircle className="h-4 w-4" />;
      case 'WALLET_CREDITED': return <Wallet className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getTimelineColor = (step: string) => {
    switch (step) {
      case 'SUBMITTED': return 'bg-gray-100 text-gray-600 border-gray-300';
      case 'PROOF_UPLOADED': return 'bg-blue-100 text-blue-600 border-blue-300';
      case 'UNDER_VERIFICATION': return 'bg-amber-100 text-amber-600 border-amber-300';
      case 'VALIDATED': return 'bg-emerald-100 text-emerald-600 border-emerald-300';
      case 'WALLET_CREDITED': return 'bg-emerald-100 text-emerald-600 border-emerald-300';
      case 'REJECTED': return 'bg-red-100 text-red-600 border-red-300';
      default: return 'bg-gray-100 text-gray-600 border-gray-300';
    }
  };

  const handleValidate = () => {
    logAction(
      'DEPOSIT_VALIDATED', 
      'DEPOSIT', 
      `Dépôt validé pour ${deposit.clientName} - ${formatCurrency(deposit.amountXAF)}${adminComment ? ` (Commentaire: ${adminComment})` : ''}`,
      deposit.id
    );
    logAction(
      'WALLET_CREDITED',
      'WALLET',
      `Wallet crédité de ${formatCurrency(deposit.amountXAF)} suite au dépôt ${deposit.id}`,
      deposit.walletId
    );
    toast.success(`Dépôt validé et wallet crédité de ${formatCurrency(deposit.amountXAF)}`);
    setIsValidateDialogOpen(false);
    navigate('/admin/deposits');
  };

  const handleReject = () => {
    if (!rejectionReason.trim()) {
      toast.error('Veuillez indiquer un motif de rejet');
      return;
    }
    logAction(
      'DEPOSIT_REJECTED', 
      'DEPOSIT', 
      `Dépôt rejeté pour ${deposit.clientName} - Motif: ${rejectionReason}`,
      deposit.id
    );
    toast.error(`Dépôt rejeté`);
    setIsRejectDialogOpen(false);
    navigate('/admin/deposits');
  };

  const isPending = ['SUBMITTED', 'PROOF_UPLOADED', 'UNDER_VERIFICATION'].includes(deposit.status);

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/deposits')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">
                Dépôt #{deposit.id.slice(-4).toUpperCase()}
              </h1>
              <Badge className={getStatusColor(deposit.status)}>
                {getDepositStatusLabel(deposit.status)}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Créé le {formatDate(deposit.createdAt)}
            </p>
          </div>
          {canProcess && isPending && (
            <div className="flex gap-2">
              <Button 
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => setIsValidateDialogOpen(true)}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Valider & Créditer
              </Button>
              <Button 
                variant="destructive"
                onClick={() => setIsRejectDialogOpen(true)}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Rejeter
              </Button>
            </div>
          )}
        </div>

        {/* Amount Card */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <CreditCard className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Montant du dépôt</p>
                  <p className="text-3xl font-bold text-foreground">
                    {formatCurrency(deposit.amountXAF)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    ≈ {Math.round(deposit.amountXAF / 87).toLocaleString()} RMB
                  </p>
                </div>
              </div>
              <div className="text-right">
                <Badge variant="outline" className="text-base px-4 py-2">
                  {getMethodLabel(deposit.method)}
                </Badge>
                {deposit.reference && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Réf: {deposit.reference}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Client & Proofs */}
          <div className="lg:col-span-2 space-y-6">
            {/* Client Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Informations client
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-4">
                  <Avatar className="h-14 w-14">
                    <AvatarFallback className="bg-primary/10 text-primary text-lg">
                      {deposit.clientName.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <div>
                      <h3 className="font-semibold text-foreground text-lg">
                        {deposit.clientName}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        {deposit.clientEmail}
                      </div>
                      {client?.whatsappNumber && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-4 w-4" />
                          {client.whatsappNumber}
                        </div>
                      )}
                    </div>
                    {wallet && (
                      <div className="pt-2 border-t border-border">
                        <div className="flex items-center gap-2">
                          <Wallet className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Solde actuel:</span>
                          <span className="font-semibold text-foreground">
                            {formatCurrency(wallet.currentBalanceXAF)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate(`/admin/clients/${deposit.clientId}`)}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Voir fiche
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Proofs */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Preuves de dépôt
                  {proofs.length > 0 && (
                    <Badge variant="outline">{proofs.length} fichier(s)</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {proofs.length > 0 ? (
                  <div className="space-y-3">
                    {proofs.map((proof) => (
                      <div 
                        key={proof.id} 
                        className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            proof.fileType === 'image' 
                              ? 'bg-blue-500/10' 
                              : 'bg-red-500/10'
                          }`}>
                            {proof.fileType === 'image' ? (
                              <Image className="h-5 w-5 text-blue-600" />
                            ) : (
                              <FileText className="h-5 w-5 text-red-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{proof.fileName}</p>
                            <p className="text-xs text-muted-foreground">
                              {proof.fileSize ? `${Math.round(proof.fileSize / 1024)} KB • ` : ''}
                              Uploadé le {formatDate(proof.uploadedAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Voir
                          </Button>
                          <Button variant="outline" size="sm">
                            <Download className="h-4 w-4 mr-1" />
                            Télécharger
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : deposit.proofUrl ? (
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-500/10">
                        <Image className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {deposit.proofFileName || 'Preuve de dépôt'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Fichier disponible
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-1" />
                      Télécharger
                    </Button>
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">Aucune preuve uploadée</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Admin Comments */}
            {(deposit.adminComment || deposit.rejectionReason) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Commentaires admin</CardTitle>
                </CardHeader>
                <CardContent>
                  {deposit.adminComment && (
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                      <p className="text-sm text-emerald-800">{deposit.adminComment}</p>
                    </div>
                  )}
                  {deposit.rejectionReason && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                      <p className="text-sm font-medium text-red-800 mb-1">Motif de rejet:</p>
                      <p className="text-sm text-red-700">{deposit.rejectionReason}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Timeline */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                {timeline.length > 0 ? (
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                    <div className="space-y-4">
                      {timeline.map((event, index) => (
                        <div key={event.id} className="relative flex gap-4 pl-2">
                          <div className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 ${getTimelineColor(event.step)}`}>
                            {getTimelineIcon(event.step)}
                          </div>
                          <div className="flex-1 pb-4">
                            <p className="text-sm font-medium text-foreground">
                              {event.description}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground">
                                {formatDate(event.timestamp)}
                              </span>
                              {event.performedBy !== 'SYSTEM' && (
                                <>
                                  <span className="text-xs text-muted-foreground">•</span>
                                  <Badge variant="outline" className="text-xs">
                                    {event.performedBy === 'CLIENT' ? 'Client' : 'Admin'}
                                  </Badge>
                                  {event.performedByName && (
                                    <span className="text-xs text-muted-foreground">
                                      {event.performedByName}
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 text-center">
                    <p className="text-muted-foreground text-sm">Aucun événement</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Actions rapides</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => navigate(`/admin/clients/${deposit.clientId}`)}
                >
                  <User className="h-4 w-4 mr-2" />
                  Voir la fiche client
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => navigate(`/admin/wallets/${deposit.clientId}`)}
                >
                  <Wallet className="h-4 w-4 mr-2" />
                  Voir le wallet
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Validate Dialog */}
        <Dialog open={isValidateDialogOpen} onOpenChange={setIsValidateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Valider le dépôt</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                <p className="text-sm text-emerald-800">
                  Vous allez valider ce dépôt et créditer le wallet du client de{' '}
                  <strong>{formatCurrency(deposit.amountXAF)}</strong>.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Commentaire (optionnel)</Label>
                <Textarea
                  placeholder="Ajouter un commentaire..."
                  value={adminComment}
                  onChange={(e) => setAdminComment(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                <p className="text-muted-foreground">
                  Cette action sera loggée avec votre identifiant ({currentUser?.firstName} {currentUser?.lastName}).
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsValidateDialogOpen(false)}>
                Annuler
              </Button>
              <Button 
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={handleValidate}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Valider & Créditer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rejeter le dépôt</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                <p className="text-sm text-red-800">
                  Vous allez rejeter ce dépôt. Le wallet du client ne sera pas crédité.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Motif du rejet (obligatoire)</Label>
                <Textarea
                  placeholder="Indiquez la raison du rejet..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                <p className="text-muted-foreground">
                  Cette action sera loggée et le client sera notifié du rejet.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>
                Annuler
              </Button>
              <Button 
                variant="destructive"
                onClick={handleReject}
                disabled={!rejectionReason.trim()}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Rejeter le dépôt
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}