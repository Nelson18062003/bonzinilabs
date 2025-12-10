import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Filter,
  Clock,
  FileText,
  CheckCircle,
  XCircle,
  Eye,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  adminDeposits, 
  getDepositStatusLabel, 
  getMethodLabel 
} from '@/data/adminMockData';
import { formatCurrency, formatDate } from '@/data/mockData';
import { toast } from 'sonner';

export function AdminDepositsPage() {
  const navigate = useNavigate();
  const { hasPermission, logAction } = useAdminAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');

  const canProcessDeposits = hasPermission('canProcessDeposits');

  const filteredDeposits = adminDeposits.filter((deposit) => {
    const matchesSearch = 
      deposit.clientName.toLowerCase().includes(search.toLowerCase()) ||
      deposit.clientEmail.toLowerCase().includes(search.toLowerCase()) ||
      deposit.reference?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || deposit.status === statusFilter;
    const matchesMethod = methodFilter === 'all' || deposit.method === methodFilter;

    return matchesSearch && matchesStatus && matchesMethod;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUBMITTED': return 'bg-gray-500/10 text-gray-600';
      case 'PROOF_UPLOADED': return 'bg-blue-500/10 text-blue-600';
      case 'UNDER_VERIFICATION': return 'bg-amber-500/10 text-amber-600';
      case 'VALIDATED': return 'bg-emerald-500/10 text-emerald-600';
      case 'REJECTED': return 'bg-red-500/10 text-red-600';
      default: return 'bg-gray-500/10 text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SUBMITTED': return <Clock className="h-4 w-4" />;
      case 'PROOF_UPLOADED': return <FileText className="h-4 w-4" />;
      case 'UNDER_VERIFICATION': return <AlertCircle className="h-4 w-4" />;
      case 'VALIDATED': return <CheckCircle className="h-4 w-4" />;
      case 'REJECTED': return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const handleValidate = (deposit: typeof adminDeposits[0], e: React.MouseEvent) => {
    e.stopPropagation();
    logAction('DEPOSIT_VALIDATED', 'DEPOSIT', `Dépôt validé pour ${deposit.clientName} - ${formatCurrency(deposit.amountXAF)}`, deposit.id);
    toast.success(`Dépôt de ${formatCurrency(deposit.amountXAF)} validé`);
  };

  const handleReject = (deposit: typeof adminDeposits[0], e: React.MouseEvent) => {
    e.stopPropagation();
    logAction('DEPOSIT_REJECTED', 'DEPOSIT', `Dépôt rejeté pour ${deposit.clientName} - ${formatCurrency(deposit.amountXAF)}`, deposit.id);
    toast.error(`Dépôt rejeté`);
  };

  const pendingCount = adminDeposits.filter(d => 
    ['SUBMITTED', 'PROOF_UPLOADED', 'UNDER_VERIFICATION'].includes(d.status)
  ).length;

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
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Soumis', status: 'SUBMITTED', color: 'text-gray-600' },
            { label: 'Preuve reçue', status: 'PROOF_UPLOADED', color: 'text-blue-600' },
            { label: 'En vérification', status: 'UNDER_VERIFICATION', color: 'text-amber-600' },
            { label: 'Validés', status: 'VALIDATED', color: 'text-emerald-600' },
            { label: 'Rejetés', status: 'REJECTED', color: 'text-red-600' },
          ].map((item) => (
            <Card key={item.status}>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground">
                  {adminDeposits.filter(d => d.status === item.status).length}
                </p>
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
                  placeholder="Rechercher par client, email, référence..."
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
                  <SelectItem value="SUBMITTED">Soumis</SelectItem>
                  <SelectItem value="PROOF_UPLOADED">Preuve reçue</SelectItem>
                  <SelectItem value="UNDER_VERIFICATION">En vérification</SelectItem>
                  <SelectItem value="VALIDATED">Validé</SelectItem>
                  <SelectItem value="REJECTED">Rejeté</SelectItem>
                </SelectContent>
              </Select>
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="Méthode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes méthodes</SelectItem>
                  <SelectItem value="BANK_TRANSFER">Virement</SelectItem>
                  <SelectItem value="CASH_DEPOSIT">Dépôt cash</SelectItem>
                  <SelectItem value="ORANGE_MONEY_TRANSFER">Orange Money</SelectItem>
                  <SelectItem value="MTN_MONEY_TRANSFER">MTN Money</SelectItem>
                  <SelectItem value="WAVE">Wave</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Deposits List */}
        <div className="space-y-3">
          {filteredDeposits.map((deposit) => (
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
                        {deposit.clientName.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground">
                          {deposit.clientName}
                        </h3>
                        <Badge className={getStatusColor(deposit.status)}>
                          {getStatusIcon(deposit.status)}
                          <span className="ml-1">{getDepositStatusLabel(deposit.status)}</span>
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {getMethodLabel(deposit.method)} • {formatDate(deposit.createdAt)}
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
                      {formatCurrency(deposit.amountXAF)}
                    </p>
                    {deposit.proofUrl && (
                      <div className="flex items-center gap-1 text-xs text-blue-600 mt-1">
                        <FileText className="h-3 w-3" />
                        Preuve jointe
                      </div>
                    )}
                  </div>
                </div>

                {canProcessDeposits && ['SUBMITTED', 'PROOF_UPLOADED', 'UNDER_VERIFICATION'].includes(deposit.status) && (
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
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Valider
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={(e) => handleReject(deposit, e)}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Rejeter
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

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
