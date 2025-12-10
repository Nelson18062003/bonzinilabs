import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Mail, 
  Phone, 
  Building2, 
  MapPin,
  Calendar,
  Edit,
  MessageCircle,
  UserCheck,
  UserX,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  Plus,
  X,
  Save,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { 
  clients, 
  tags, 
  adminDeposits, 
  adminPayments,
  getClientStatusLabel, 
  getDepositStatusLabel,
  getPaymentStatusLabel,
  getMethodLabel,
  getClientWithTags,
} from '@/data/adminMockData';
import { formatCurrency, formatDate } from '@/data/mockData';
import { ClientStatus, Tag } from '@/types/admin';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';

export function AdminClientDetailPage() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const { hasPermission, logAction } = useAdminAuth();
  
  const client = clients.find(c => c.id === clientId);
  const clientWithTags = client ? getClientWithTags(client) : null;
  
  const [notes, setNotes] = useState(client?.notes || '');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(client?.tagIds || []);
  const [isTagDialogOpen, setIsTagDialogOpen] = useState(false);

  if (!client || !clientWithTags) {
    return (
      <AdminLayout>
        <div className="p-6">
          <Button variant="ghost" onClick={() => navigate('/admin/clients')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
          <Card className="mt-4">
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">Client non trouvé</p>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  // Get client's deposits and payments
  const clientDeposits = adminDeposits
    .filter(d => d.clientId === clientId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5);

  const clientPayments = adminPayments
    .filter(p => p.clientId === clientId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5);

  const getStatusColor = (status: ClientStatus) => {
    switch (status) {
      case 'ACTIVE': return 'bg-emerald-500/10 text-emerald-600';
      case 'INACTIVE': return 'bg-gray-500/10 text-gray-600';
      case 'SUSPENDED': return 'bg-red-500/10 text-red-600';
      case 'PENDING_KYC': return 'bg-amber-500/10 text-amber-600';
      default: return 'bg-gray-500/10 text-gray-600';
    }
  };

  const getGenderLabel = (gender: string) => {
    switch (gender) {
      case 'MALE': return 'Homme';
      case 'FEMALE': return 'Femme';
      case 'OTHER': return 'Autre';
      default: return gender;
    }
  };

  const handleSaveNotes = () => {
    // In real app, this would save to database
    logAction('CLIENT_UPDATED', 'CLIENT', client.id, `Notes modifiées pour ${client.firstName} ${client.lastName}`);
    setIsEditingNotes(false);
  };

  const handleSaveTags = () => {
    // In real app, this would save to database
    logAction('CLIENT_UPDATED', 'CLIENT', client.id, `Tags modifiés pour ${client.firstName} ${client.lastName}`);
    setIsTagDialogOpen(false);
  };

  const handleToggleStatus = () => {
    const newStatus = client.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    logAction(
      newStatus === 'SUSPENDED' ? 'CLIENT_SUSPENDED' : 'CLIENT_UPDATED',
      'CLIENT',
      client.id,
      `Statut client ${newStatus === 'SUSPENDED' ? 'suspendu' : 'réactivé'}: ${client.firstName} ${client.lastName}`
    );
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/clients')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14">
                <AvatarFallback className="bg-primary/10 text-primary text-lg">
                  {client.firstName[0]}{client.lastName[0]}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-foreground">
                    {client.firstName} {client.lastName}
                  </h1>
                  <Badge className={getStatusColor(client.status)}>
                    {getClientStatusLabel(client.status)}
                  </Badge>
                  {client.kycVerified && (
                    <Badge variant="outline" className="text-emerald-600 border-emerald-600">
                      KYC Vérifié
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground">
                  Client depuis le {formatDate(client.createdAt)}
                </p>
              </div>
            </div>
          </div>
          {hasPermission('canEditClients') && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleToggleStatus}>
                {client.status === 'SUSPENDED' ? (
                  <>
                    <UserCheck className="h-4 w-4 mr-2" />
                    Réactiver
                  </>
                ) : (
                  <>
                    <UserX className="h-4 w-4 mr-2" />
                    Suspendre
                  </>
                )}
              </Button>
              <Button>
                <Edit className="h-4 w-4 mr-2" />
                Modifier
              </Button>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Solde Wallet</p>
                  <p className="text-xl font-bold text-foreground">{formatCurrency(client.walletBalance)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <ArrowDownCircle className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Dépôts</p>
                  <p className="text-xl font-bold text-emerald-600">{formatCurrency(client.totalDeposits)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <ArrowUpCircle className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Paiements</p>
                  <p className="text-xl font-bold text-blue-600">{formatCurrency(client.totalPayments)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Calendar className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Dernier dépôt</p>
                  <p className="text-lg font-semibold text-foreground">
                    {client.lastDepositAt ? formatDate(client.lastDepositAt) : 'N/A'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Client Info */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">{client.whatsappNumber}</span>
                </div>
                {client.email && (
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">{client.email}</span>
                  </div>
                )}
                {client.company && (
                  <div className="flex items-center gap-3 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">{client.company}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">
                    {client.city ? `${client.city}, ` : ''}{client.country}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <MessageCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">{getGenderLabel(client.gender)}</span>
                </div>
              </div>

              <Separator />

              {/* Tags */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-muted-foreground">Tags</p>
                  {hasPermission('canEditClients') && (
                    <Dialog open={isTagDialogOpen} onOpenChange={setIsTagDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-3 w-3" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Modifier les tags</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3 py-4">
                          {tags.map((tag) => (
                            <div key={tag.id} className="flex items-center gap-3">
                              <Checkbox
                                id={tag.id}
                                checked={selectedTagIds.includes(tag.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedTagIds([...selectedTagIds, tag.id]);
                                  } else {
                                    setSelectedTagIds(selectedTagIds.filter(id => id !== tag.id));
                                  }
                                }}
                              />
                              <label htmlFor={tag.id} className="flex items-center gap-2 cursor-pointer">
                                <Badge className={tag.color}>{tag.name}</Badge>
                                {tag.description && (
                                  <span className="text-sm text-muted-foreground">{tag.description}</span>
                                )}
                              </label>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setIsTagDialogOpen(false)}>
                            Annuler
                          </Button>
                          <Button onClick={handleSaveTags}>
                            <Save className="h-4 w-4 mr-2" />
                            Enregistrer
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {clientWithTags.tags.length > 0 ? (
                    clientWithTags.tags.map((tag) => (
                      <Badge key={tag.id} className={tag.color}>
                        {tag.name}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">Aucun tag</span>
                  )}
                </div>
              </div>

              <Separator />

              {/* Notes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-muted-foreground">Notes internes</p>
                  {hasPermission('canEditClients') && !isEditingNotes && (
                    <Button variant="ghost" size="sm" onClick={() => setIsEditingNotes(true)}>
                      <Edit className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                {isEditingNotes ? (
                  <div className="space-y-2">
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ajouter une note..."
                      rows={4}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveNotes}>
                        <Save className="h-3 w-3 mr-1" />
                        Sauvegarder
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setIsEditingNotes(false)}>
                        Annuler
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-foreground">
                    {notes || <span className="text-muted-foreground italic">Aucune note</span>}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <div className="lg:col-span-2 space-y-6">
            {/* Recent Deposits */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Derniers dépôts</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate('/admin/deposits')}>
                  Voir tout
                </Button>
              </CardHeader>
              <CardContent>
                {clientDeposits.length > 0 ? (
                  <div className="space-y-3">
                    {clientDeposits.map((deposit) => (
                      <div key={deposit.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-emerald-500/10">
                            <ArrowDownCircle className="h-4 w-4 text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {getMethodLabel(deposit.method)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(deposit.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-emerald-600">
                            +{formatCurrency(deposit.amountXAF)}
                          </p>
                          <Badge variant="outline" className="text-xs">
                            {getDepositStatusLabel(deposit.status)}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucun dépôt
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Recent Payments */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Derniers paiements</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate('/admin/payments')}>
                  Voir tout
                </Button>
              </CardHeader>
              <CardContent>
                {clientPayments.length > 0 ? (
                  <div className="space-y-3">
                    {clientPayments.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-blue-500/10">
                            <ArrowUpCircle className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {payment.beneficiaryName} ({getMethodLabel(payment.method)})
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(payment.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-blue-600">
                            -{formatCurrency(payment.amountXAF)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ≈ ¥{payment.amountRMB.toLocaleString()}
                          </p>
                          <Badge variant="outline" className="text-xs">
                            {getPaymentStatusLabel(payment.status)}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucun paiement
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}