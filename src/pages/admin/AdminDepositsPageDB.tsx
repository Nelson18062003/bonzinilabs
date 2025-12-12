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
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  useAdminDeposits, 
  useValidateDeposit, 
  useRejectDeposit,
  DEPOSIT_STATUS_LABELS,
  DEPOSIT_METHOD_LABELS,
  DepositWithProfile,
} from '@/hooks/useDeposits';
import { formatCurrency, formatDate } from '@/lib/formatters';

export function AdminDepositsPageDB() {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');

  const { data: deposits = [], isLoading, error } = useAdminDeposits();
  const validateMutation = useValidateDeposit();
  const rejectMutation = useRejectDeposit();

  const canProcessDeposits = hasPermission('canProcessDeposits');

  const filteredDeposits = deposits.filter((deposit) => {
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
      case 'awaiting_proof': return 'bg-yellow-500/10 text-yellow-600';
      case 'proof_submitted': return 'bg-blue-500/10 text-blue-600';
      case 'admin_review': return 'bg-amber-500/10 text-amber-600';
      case 'validated': return 'bg-emerald-500/10 text-emerald-600';
      case 'rejected': return 'bg-red-500/10 text-red-600';
      default: return 'bg-gray-500/10 text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'created': return <Clock className="h-4 w-4" />;
      case 'awaiting_proof': return <Clock className="h-4 w-4" />;
      case 'proof_submitted': return <FileText className="h-4 w-4" />;
      case 'admin_review': return <AlertCircle className="h-4 w-4" />;
      case 'validated': return <CheckCircle className="h-4 w-4" />;
      case 'rejected': return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const handleValidate = (deposit: DepositWithProfile, e: React.MouseEvent) => {
    e.stopPropagation();
    validateMutation.mutate({ depositId: deposit.id });
  };

  const handleReject = (deposit: DepositWithProfile, e: React.MouseEvent) => {
    e.stopPropagation();
    // In a real app, you'd show a dialog to get the reason
    const reason = prompt('Motif de rejet:');
    if (reason) {
      rejectMutation.mutate({ depositId: deposit.id, reason });
    }
  };

  const pendingStatuses = ['created', 'awaiting_proof', 'proof_submitted', 'admin_review'];
  const pendingCount = deposits.filter(d => pendingStatuses.includes(d.status)).length;

  const statusCounts = {
    created: deposits.filter(d => d.status === 'created').length,
    awaiting_proof: deposits.filter(d => d.status === 'awaiting_proof').length,
    proof_submitted: deposits.filter(d => d.status === 'proof_submitted').length,
    admin_review: deposits.filter(d => d.status === 'admin_review').length,
    validated: deposits.filter(d => d.status === 'validated').length,
    rejected: deposits.filter(d => d.status === 'rejected').length,
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="p-6">
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-destructive">Erreur: {(error as Error).message}</p>
              <p className="text-muted-foreground mt-2">
                Vérifiez que vous êtes connecté en tant qu'admin.
              </p>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dépôts</h1>
            <p className="text-muted-foreground">
              {pendingCount} dépôt(s) en attente de traitement
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          {[
            { label: 'Créés', status: 'created', color: 'text-gray-600', count: statusCounts.created },
            { label: 'Attente preuve', status: 'awaiting_proof', color: 'text-yellow-600', count: statusCounts.awaiting_proof },
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
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par client, référence..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="created">Créé</SelectItem>
                  <SelectItem value="awaiting_proof">Attente preuve</SelectItem>
                  <SelectItem value="proof_submitted">Preuve reçue</SelectItem>
                  <SelectItem value="admin_review">En vérification</SelectItem>
                  <SelectItem value="validated">Validé</SelectItem>
                  <SelectItem value="rejected">Rejeté</SelectItem>
                </SelectContent>
              </Select>
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="Méthode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes méthodes</SelectItem>
                  <SelectItem value="bank_transfer">Virement</SelectItem>
                  <SelectItem value="bank_cash">Dépôt cash</SelectItem>
                  <SelectItem value="agency_cash">Agence</SelectItem>
                  <SelectItem value="om_transfer">Orange Money</SelectItem>
                  <SelectItem value="mtn_transfer">MTN Money</SelectItem>
                  <SelectItem value="wave">Wave</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

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
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/admin/deposits/${deposit.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-foreground">
                            {clientName}
                          </h3>
                          <Badge className={getStatusColor(deposit.status)}>
                            {getStatusIcon(deposit.status)}
                            <span className="ml-1">{DEPOSIT_STATUS_LABELS[deposit.status]}</span>
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {DEPOSIT_METHOD_LABELS[deposit.method]} • {formatDate(deposit.created_at)}
                        </p>
                        {deposit.reference && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Réf: {deposit.reference}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-lg font-bold text-foreground">
                        {formatCurrency(deposit.amount_xaf)}
                      </p>
                    </div>
                  </div>

                  {canProcessDeposits && pendingStatuses.includes(deposit.status) && (
                    <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Voir
                      </Button>
                      <Button 
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={(e) => handleValidate(deposit, e)}
                        disabled={validateMutation.isPending}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Valider
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={(e) => handleReject(deposit, e)}
                        disabled={rejectMutation.isPending}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Rejeter
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
      </div>
    </AdminLayout>
  );
}
