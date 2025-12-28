import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  User,
  Phone,
  Wallet,
  Calendar,
  FileText,
  CheckCircle,
  XCircle,
  ExternalLink,
  CreditCard,
  Loader2,
  Plus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { DepositTimelineDisplay } from '@/components/deposit/DepositTimelineDisplay';
import { AdminProofUpload } from '@/components/admin/AdminProofUpload';
import { ProofImageGallery } from '@/components/admin/ProofImageGallery';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  useDepositDetail,
  useDepositProofs,
  useDepositTimeline,
  useValidateDeposit,
  useRejectDeposit,
} from '@/hooks/useDeposits';
import { useWalletByUserId } from '@/hooks/useWallet';
import { DEPOSIT_STATUS_LABELS, DEPOSIT_METHOD_LABELS } from '@/data/staticData';
import { formatXAF } from '@/lib/formatters';
import { buildDepositTimelineSteps, safeFormatDate } from '@/lib/depositTimeline';

export function AdminDepositDetailPage() {
  const { depositId } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  
  const { data: deposit, isLoading: loadingDeposit } = useDepositDetail(depositId);
  const { data: proofs, isLoading: loadingProofs } = useDepositProofs(depositId);
  const { data: timelineEvents, isLoading: loadingTimeline } = useDepositTimeline(depositId);
  const { data: wallet } = useWalletByUserId(deposit?.user_id);
  
  const validateDeposit = useValidateDeposit();
  const rejectDeposit = useRejectDeposit();
  
  const [isValidateDialogOpen, setIsValidateDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [adminComment, setAdminComment] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  // Build timeline steps from deposit status and events
  const timelineSteps = useMemo(() => {
    if (!deposit) return [];
    return buildDepositTimelineSteps(deposit.status, timelineEvents || []);
  }, [deposit, timelineEvents]);

  const canProcess = hasPermission('canProcessDeposits');
  const isLoading = loadingDeposit || loadingProofs || loadingTimeline;

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="p-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

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

  const clientName = deposit.profiles 
    ? `${deposit.profiles.first_name} ${deposit.profiles.last_name}`
    : 'Client inconnu';
  const initials = deposit.profiles 
    ? `${deposit.profiles.first_name[0]}${deposit.profiles.last_name[0]}`
    : '??';

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'created':
      case 'awaiting_proof':
        return 'bg-gray-500/10 text-gray-600';
      case 'proof_submitted': return 'bg-blue-500/10 text-blue-600';
      case 'admin_review': return 'bg-amber-500/10 text-amber-600';
      case 'validated': return 'bg-emerald-500/10 text-emerald-600';
      case 'rejected': return 'bg-red-500/10 text-red-600';
      default: return 'bg-gray-500/10 text-gray-600';
    }
  };

  const handleValidate = async () => {
    try {
      await validateDeposit.mutateAsync({ 
        depositId: deposit.id, 
        adminComment: adminComment || undefined 
      });
      setIsValidateDialogOpen(false);
      navigate('/admin/deposits');
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Veuillez indiquer un motif de rejet');
      return;
    }
    try {
      await rejectDeposit.mutateAsync({ 
        depositId: deposit.id, 
        reason: rejectionReason 
      });
      setIsRejectDialogOpen(false);
      navigate('/admin/deposits');
    } catch (error) {
      // Error handled by mutation
    }
  };

  const isPending = ['created', 'awaiting_proof', 'proof_submitted', 'admin_review'].includes(deposit.status);

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
                Dépôt #{deposit.reference.slice(-6)}
              </h1>
              <Badge className={getStatusColor(deposit.status)}>
                {DEPOSIT_STATUS_LABELS[deposit.status]}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Créé le {safeFormatDate(deposit.created_at, 'dd MMMM yyyy') || ''}
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
                    {formatXAF(deposit.amount_xaf)} XAF
                  </p>
                  <p className="text-sm text-muted-foreground">
                    ≈ {Math.round(deposit.amount_xaf / 87).toLocaleString()} RMB
                  </p>
                </div>
              </div>
              <div className="text-right">
                <Badge variant="outline" className="text-base px-4 py-2">
                  {DEPOSIT_METHOD_LABELS[deposit.method]}
                </Badge>
                <p className="text-sm text-muted-foreground mt-2">
                  Réf: {deposit.reference}
                </p>
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
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <div>
                      <h3 className="font-semibold text-foreground text-lg">
                        {clientName}
                      </h3>
                      {deposit.profiles?.phone && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-4 w-4" />
                          {deposit.profiles.phone}
                        </div>
                      )}
                    </div>
                    {wallet && (
                      <div className="pt-2 border-t border-border">
                        <div className="flex items-center gap-2">
                          <Wallet className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Solde actuel:</span>
                          <span className="font-semibold text-foreground">
                            {formatXAF(wallet.balance_xaf)} XAF
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate(`/admin/clients/${deposit.user_id}`)}
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
                  {proofs && proofs.length > 0 && (
                    <Badge variant="outline">{proofs.length} fichier(s)</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ProofImageGallery proofs={proofs || []} canDelete={canProcess && isPending} />
                
                {/* Admin proof upload section */}
                {canProcess && isPending && (
                  <div className="pt-4 border-t border-border">
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Ajouter des preuves supplémentaires
                    </h4>
                    <AdminProofUpload depositId={deposit.id} />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Admin Comments */}
            {(deposit.admin_comment || deposit.rejection_reason) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Commentaires admin</CardTitle>
                </CardHeader>
                <CardContent>
                  {deposit.admin_comment && (
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                      <p className="text-sm text-emerald-800">{deposit.admin_comment}</p>
                    </div>
                  )}
                  {deposit.rejection_reason && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                      <p className="text-sm font-medium text-red-800 mb-1">Motif de rejet:</p>
                      <p className="text-sm text-red-700">{deposit.rejection_reason}</p>
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
                <DepositTimelineDisplay steps={timelineSteps} />
              </CardContent>
            </Card>

            {/* Quick Actions */}
            {canProcess && isPending && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Actions rapides</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button 
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => setIsValidateDialogOpen(true)}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Valider & Créditer
                  </Button>
                  <Button 
                    variant="destructive"
                    className="w-full"
                    onClick={() => setIsRejectDialogOpen(true)}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Rejeter
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
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
                Cette action va créditer le wallet du client de <strong>{formatXAF(deposit.amount_xaf)} XAF</strong>
              </p>
            </div>
            <div className="space-y-2">
              <Label>Commentaire (optionnel)</Label>
              <Textarea
                placeholder="Ajouter un commentaire..."
                value={adminComment}
                onChange={(e) => setAdminComment(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsValidateDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleValidate}
              disabled={validateDeposit.isPending}
            >
              {validateDeposit.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
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
                Cette action va rejeter le dépôt. Le client sera notifié avec votre motif.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Motif du rejet *</Label>
              <Textarea
                placeholder="Expliquez pourquoi le dépôt est rejeté..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              variant="destructive"
              onClick={handleReject}
              disabled={rejectDeposit.isPending || !rejectionReason.trim()}
            >
              {rejectDeposit.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Rejeter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}