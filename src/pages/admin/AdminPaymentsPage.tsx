import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Clock,
  FileText,
  CheckCircle,
  Send,
  Upload,
  Eye,
  Play,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  adminPayments, 
  getPaymentStatusLabel, 
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUBMITTED': return 'bg-gray-500/10 text-gray-600';
      case 'INFO_RECEIVED': return 'bg-blue-500/10 text-blue-600';
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
      case 'PROCESSING': return <Send className="h-4 w-4" />;
      case 'COMPLETED': return <CheckCircle className="h-4 w-4" />;
      case 'PROOF_AVAILABLE': return <Upload className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const pendingCount = adminPayments.filter(p => 
    ['SUBMITTED', 'INFO_RECEIVED', 'PROCESSING'].includes(p.status)
  ).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Paiements</h1>
          <p className="text-muted-foreground">
            {pendingCount} paiement(s) en cours de traitement
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Soumis', status: 'SUBMITTED', color: 'text-gray-600' },
          { label: 'Infos reçues', status: 'INFO_RECEIVED', color: 'text-blue-600' },
          { label: 'En cours', status: 'PROCESSING', color: 'text-amber-600' },
          { label: 'Effectués', status: 'COMPLETED', color: 'text-emerald-600' },
          { label: 'Preuve dispo', status: 'PROOF_AVAILABLE', color: 'text-primary' },
        ].map((item) => (
          <Card key={item.status}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">
                {adminPayments.filter(p => p.status === item.status).length}
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
                placeholder="Rechercher par client, bénéficiaire..."
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
                <SelectItem value="INFO_RECEIVED">Infos reçues</SelectItem>
                <SelectItem value="PROCESSING">En cours</SelectItem>
                <SelectItem value="COMPLETED">Effectué</SelectItem>
                <SelectItem value="PROOF_AVAILABLE">Preuve dispo</SelectItem>
              </SelectContent>
            </Select>
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="w-full sm:w-44">
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
          </div>
        </CardContent>
      </Card>

      {/* Payments List */}
      <div className="space-y-3">
        {filteredPayments.map((payment) => (
          <Card 
            key={payment.id} 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate(`/admin/payments/${payment.id}`)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {payment.clientName.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground">
                        {payment.clientName}
                      </h3>
                      <Badge className={getStatusColor(payment.status)}>
                        {getStatusIcon(payment.status)}
                        <span className="ml-1">{getPaymentStatusLabel(payment.status)}</span>
                      </Badge>
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
                  <p className="text-lg font-bold text-foreground">
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
            </CardContent>
          </Card>
        ))}

        {filteredPayments.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">Aucun paiement trouvé</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
