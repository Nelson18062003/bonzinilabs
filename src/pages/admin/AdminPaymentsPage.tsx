import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Clock,
  FileText,
  CheckCircle,
  Send,
  Upload,
  Eye,
  Play,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminPageHeader } from '@/components/admin/ui/AdminPageHeader';
import { AdminStatCard, AdminCard } from '@/components/admin/ui/AdminCard';
import { AdminFilters, AdminSearchInput } from '@/components/admin/ui/AdminFilters';
import { PaymentStatusBadge } from '@/components/admin/ui/AdminBadge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  adminPayments, 
  getMethodLabel 
} from '@/data/adminMockData';
import { formatCurrency, formatDate } from '@/data/mockData';

export function AdminPaymentsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');

  const filteredPayments = adminPayments.filter((payment) => {
    const matchesSearch = 
      payment.clientName.toLowerCase().includes(search.toLowerCase()) ||
      payment.clientEmail.toLowerCase().includes(search.toLowerCase()) ||
      payment.beneficiaryName.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
    const matchesMethod = methodFilter === 'all' || payment.method === methodFilter;

    return matchesSearch && matchesStatus && matchesMethod;
  });

  const pendingCount = adminPayments.filter(p => 
    ['SUBMITTED', 'INFO_RECEIVED', 'PROCESSING'].includes(p.status)
  ).length;

  return (
    <AdminLayout>
      <AdminPageHeader 
        title="Paiements" 
        subtitle={`${pendingCount} paiement(s) en cours de traitement`}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Soumis', status: 'SUBMITTED', iconColor: 'text-muted-foreground' },
          { label: 'Infos reçues', status: 'INFO_RECEIVED', iconColor: 'text-blue-500' },
          { label: 'En cours', status: 'PROCESSING', iconColor: 'text-amber-500' },
          { label: 'Effectués', status: 'COMPLETED', iconColor: 'text-emerald-500' },
          { label: 'Preuve dispo', status: 'PROOF_AVAILABLE', iconColor: 'text-primary' },
        ].map((item) => (
          <AdminStatCard
            key={item.status}
            title={item.label}
            value={adminPayments.filter(p => p.status === item.status).length}
          />
        ))}
      </div>

      {/* Filters */}
      <AdminFilters className="mb-6">
        <AdminSearchInput
          value={search}
          onChange={setSearch}
          placeholder="Rechercher par client, bénéficiaire..."
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44 bg-card">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="SUBMITTED">Soumis</SelectItem>
            <SelectItem value="INFO_RECEIVED">Infos reçues</SelectItem>
            <SelectItem value="READY_TO_PAY">Prêt à payer</SelectItem>
            <SelectItem value="PROCESSING">En cours</SelectItem>
            <SelectItem value="COMPLETED">Effectué</SelectItem>
            <SelectItem value="PROOF_AVAILABLE">Preuve dispo</SelectItem>
            <SelectItem value="CANCELLED">Annulé</SelectItem>
          </SelectContent>
        </Select>
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-full sm:w-44 bg-card">
            <SelectValue placeholder="Mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les modes</SelectItem>
            <SelectItem value="ALIPAY">Alipay</SelectItem>
            <SelectItem value="WECHAT">WeChat</SelectItem>
            <SelectItem value="BANK_TRANSFER">Virement</SelectItem>
            <SelectItem value="CASH_COUNTER">Cash Counter</SelectItem>
          </SelectContent>
        </Select>
      </AdminFilters>

      {/* Payments List */}
      <div className="space-y-3">
        {filteredPayments.map((payment) => (
          <AdminCard 
            key={payment.id} 
            clickable
            onClick={() => navigate(`/admin/payments/${payment.id}`)}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                    {payment.clientName.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-foreground">
                      {payment.clientName}
                    </h3>
                    <PaymentStatusBadge status={payment.status} />
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    → {payment.beneficiaryName} • {getMethodLabel(payment.method)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDate(payment.createdAt)}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-lg font-semibold text-foreground">
                  {formatCurrency(payment.amountXAF)}
                </p>
                <p className="text-sm text-primary font-medium">
                  → {payment.amountRMB.toLocaleString()} RMB
                </p>
                <p className="text-xs text-muted-foreground">
                  Taux: {payment.exchangeRate}
                </p>
              </div>
            </div>

            {['SUBMITTED', 'INFO_RECEIVED', 'PROCESSING'].includes(payment.status) && (
              <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Détails
                </Button>
                {payment.status === 'SUBMITTED' && (
                  <Button 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Traiter
                  </Button>
                )}
                {payment.status === 'PROCESSING' && (
                  <Button 
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Marquer effectué
                  </Button>
                )}
                {payment.status === 'COMPLETED' && (
                  <Button 
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    Ajouter preuve
                  </Button>
                )}
              </div>
            )}
          </AdminCard>
        ))}

        {filteredPayments.length === 0 && (
          <AdminCard className="text-center py-12">
            <p className="text-muted-foreground">Aucun paiement trouvé</p>
          </AdminCard>
        )}
      </div>
    </AdminLayout>
  );
}
