import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Clock,
  FileText,
  CheckCircle,
  XCircle,
  Eye,
  AlertCircle,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { 
  AdminResponsiveHeader, 
  AdminResponsiveFilters,
  AdminResponsiveGrid,
  AdminScrollContainer,
  AdminButtonGroup,
} from '@/components/admin/ui/AdminResponsive';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  useAdminDeposits, 
  useValidateDeposit, 
  useRejectDeposit,
  useDeleteDeposit,
} from '@/hooks/useDeposits';
import { DEPOSIT_STATUS_LABELS, DEPOSIT_METHOD_LABELS } from '@/data/staticData';
import { formatXAF, formatDate } from '@/lib/formatters';

export function AdminDepositsPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [depositToDelete, setDepositToDelete] = useState<{ id: string; reference: string } | null>(null);

  const { data: deposits, isLoading, error } = useAdminDeposits();
  const validateDeposit = useValidateDeposit();
  const rejectDeposit = useRejectDeposit();
  const deleteDeposit = useDeleteDeposit();

  const canProcessDeposits = hasPermission('canProcessDeposits');

  const filteredDeposits = (deposits || []).filter((deposit) => {
    const clientName = deposit.profiles 
      ? `${deposit.profiles.first_name} ${deposit.profiles.last_name}`.toLowerCase()
      : '';
    
    const matchesSearch = 
      clientName.includes(search.toLowerCase()) ||
      deposit.reference?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || deposit.status === statusFilter;
    const matchesMethod = methodFilter === 'all' || deposit.method === methodFilter;

    return matchesSearch && matchesStatus && matchesMethod;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'created': return 'bg-gray-500/10 text-gray-600';
      case 'awaiting_proof': return 'bg-gray-500/10 text-gray-600';
      case 'proof_submitted': return 'bg-blue-500/10 text-blue-600';
      case 'admin_review': return 'bg-amber-500/10 text-amber-600';
      case 'validated': return 'bg-emerald-500/10 text-emerald-600';
      case 'rejected': return 'bg-red-500/10 text-red-600';
      default: return 'bg-gray-500/10 text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'created':
      case 'awaiting_proof':
        return <Clock className="h-3 w-3 sm:h-4 sm:w-4" />;
      case 'proof_submitted': return <FileText className="h-3 w-3 sm:h-4 sm:w-4" />;
      case 'admin_review': return <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4" />;
      case 'validated': return <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" />;
      case 'rejected': return <XCircle className="h-3 w-3 sm:h-4 sm:w-4" />;
      default: return <Clock className="h-3 w-3 sm:h-4 sm:w-4" />;
    }
  };

  const handleValidate = (depositId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    validateDeposit.mutate({ depositId });
  };

  const handleReject = (depositId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const reason = prompt('Motif du rejet:');
    if (reason) {
      rejectDeposit.mutate({ depositId, reason });
    }
  };

  const handleDeleteClick = (deposit: { id: string; reference: string }, e: React.MouseEvent) => {
    e.stopPropagation();
    setDepositToDelete(deposit);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (depositToDelete) {
      deleteDeposit.mutate({ depositId: depositToDelete.id });
      setDeleteDialogOpen(false);
      setDepositToDelete(null);
    }
  };

  const pendingCount = (deposits || []).filter(d => 
    ['created', 'awaiting_proof', 'proof_submitted', 'admin_review'].includes(d.status)
  ).length;

  const statusCounts = {
    created: (deposits || []).filter(d => d.status === 'created').length,
    awaiting_proof: (deposits || []).filter(d => d.status === 'awaiting_proof').length,
    proof_submitted: (deposits || []).filter(d => d.status === 'proof_submitted').length,
    admin_review: (deposits || []).filter(d => d.status === 'admin_review').length,
    validated: (deposits || []).filter(d => d.status === 'validated').length,
    rejected: (deposits || []).filter(d => d.status === 'rejected').length,
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-destructive">Erreur lors du chargement des dépôts</p>
          </CardContent>
        </Card>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <AdminResponsiveHeader
          title="Dépôts"
          subtitle={`${pendingCount} dépôt(s) en attente`}
          actions={
            <Button onClick={() => navigate('/admin/deposits/new')} size="sm">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Déclarer un dépôt</span>
            </Button>
          }
        />

        {/* Stats Cards - Horizontal scroll on mobile, grid on desktop */}
        <AdminScrollContainer className="lg:hidden">
          {[
            { label: 'Créés', count: statusCounts.created, color: 'text-gray-600' },
            { label: 'Att. preuve', count: statusCounts.awaiting_proof, color: 'text-gray-600' },
            { label: 'Preuve reçue', count: statusCounts.proof_submitted, color: 'text-blue-600' },
            { label: 'En vérif.', count: statusCounts.admin_review, color: 'text-amber-600' },
            { label: 'Validés', count: statusCounts.validated, color: 'text-emerald-600' },
            { label: 'Rejetés', count: statusCounts.rejected, color: 'text-red-600' },
          ].map((item) => (
            <Card key={item.label} className="flex-shrink-0 w-[100px]">
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold text-foreground">{item.count}</p>
                <p className={`text-[10px] ${item.color}`}>{item.label}</p>
              </CardContent>
            </Card>
          ))}
        </AdminScrollContainer>

        {/* Stats grid for desktop */}
        <div className="hidden lg:grid grid-cols-6 gap-4">
          {[
            { label: 'Créés', status: 'created', color: 'text-gray-600', count: statusCounts.created },
            { label: 'Attente preuve', status: 'awaiting_proof', color: 'text-gray-600', count: statusCounts.awaiting_proof },
            { label: 'Preuve reçue', status: 'proof_submitted', color: 'text-blue-600', count: statusCounts.proof_submitted },
            { label: 'En vérification', status: 'admin_review', color: 'text-amber-600', count: statusCounts.admin_review },
            { label: 'Validés', status: 'validated', color: 'text-emerald-600', count: statusCounts.validated },
            { label: 'Rejetés', status: 'rejected', color: 'text-red-600', count: statusCounts.rejected },
          ].map((item) => (
            <Card key={item.status}>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{item.count}</p>
                <p className={`text-sm ${item.color}`}>{item.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <AdminResponsiveFilters>
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 w-full"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="created">Créé</SelectItem>
              <SelectItem value="awaiting_proof">Att. preuve</SelectItem>
              <SelectItem value="proof_submitted">Preuve reçue</SelectItem>
              <SelectItem value="admin_review">En vérif.</SelectItem>
              <SelectItem value="validated">Validé</SelectItem>
              <SelectItem value="rejected">Rejeté</SelectItem>
            </SelectContent>
          </Select>
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Méthode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              <SelectItem value="bank_transfer">Virement</SelectItem>
              <SelectItem value="bank_cash">Cash banque</SelectItem>
              <SelectItem value="agency_cash">Agence</SelectItem>
              <SelectItem value="om_transfer">Orange Money</SelectItem>
              <SelectItem value="mtn_transfer">MTN</SelectItem>
              <SelectItem value="wave">Wave</SelectItem>
            </SelectContent>
          </Select>
        </AdminResponsiveFilters>

        {/* Deposits List */}
        <div className="space-y-3">
          {filteredDeposits.map((deposit) => {
            const clientName = deposit.profiles 
              ? `${deposit.profiles.first_name} ${deposit.profiles.last_name}`
              : 'Client inconnu';
            const initials = deposit.profiles 
              ? `${deposit.profiles.first_name[0]}${deposit.profiles.last_name[0]}`
              : '??';
            
            return (
              <Card 
                key={deposit.id} 
                className="cursor-pointer hover:shadow-md transition-all active:scale-[0.99]"
                onClick={() => navigate(`/admin/deposits/${deposit.id}`)}
              >
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-2 sm:gap-4">
                    <div className="flex items-start gap-2 sm:gap-4 min-w-0 flex-1">
                      <Avatar className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs sm:text-sm">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-foreground text-sm sm:text-base truncate">
                            {clientName}
                          </h3>
                          <Badge className={`${getStatusColor(deposit.status)} text-[10px] sm:text-xs`}>
                            {getStatusIcon(deposit.status)}
                            <span className="ml-1 hidden sm:inline">{DEPOSIT_STATUS_LABELS[deposit.status]}</span>
                          </Badge>
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1 truncate">
                          {DEPOSIT_METHOD_LABELS[deposit.method]} • {formatDate(deposit.created_at)}
                        </p>
                        {deposit.reference && (
                          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">
                            Réf: {deposit.reference}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="text-sm sm:text-lg font-bold text-foreground">
                        {formatXAF(deposit.amount_xaf)}
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">XAF</p>
                    </div>
                  </div>

                  {canProcessDeposits && (
                    <div className="flex flex-wrap gap-2 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border">
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="text-xs h-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/admin/deposits/${deposit.id}`);
                        }}
                      >
                        <Eye className="h-3 w-3 sm:mr-1" />
                        <span className="hidden sm:inline">Voir</span>
                      </Button>
                      {['created', 'awaiting_proof', 'proof_submitted', 'admin_review'].includes(deposit.status) && (
                        <>
                          <Button 
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-xs h-8"
                            onClick={(e) => handleValidate(deposit.id, e)}
                            disabled={validateDeposit.isPending}
                          >
                            <CheckCircle className="h-3 w-3 sm:mr-1" />
                            <span className="hidden sm:inline">Valider</span>
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive"
                            className="text-xs h-8"
                            onClick={(e) => handleReject(deposit.id, e)}
                            disabled={rejectDeposit.isPending}
                          >
                            <XCircle className="h-3 w-3 sm:mr-1" />
                            <span className="hidden sm:inline">Rejeter</span>
                          </Button>
                        </>
                      )}
                      <Button 
                        size="sm" 
                        variant="ghost"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto h-8"
                        onClick={(e) => handleDeleteClick({ id: deposit.id, reference: deposit.reference }, e)}
                        disabled={deleteDeposit.isPending}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {filteredDeposits.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">Aucun dépôt trouvé</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer ce dépôt ?</AlertDialogTitle>
              <AlertDialogDescription>
                Vous êtes sur le point de supprimer le dépôt <strong>{depositToDelete?.reference}</strong>.
                Cette action est irréversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel className="w-full sm:w-auto">Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
}
