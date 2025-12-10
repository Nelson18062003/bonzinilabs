import { 
  Users, 
  Wallet, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { 
  dashboardStats, 
  adminDeposits, 
  adminPayments, 
  adminLogs,
  getDepositStatusLabel,
  getPaymentStatusLabel,
} from '@/data/adminMockData';
import { formatCurrency, formatDate } from '@/data/mockData';
import { useNavigate } from 'react-router-dom';

export function AdminDashboard() {
  const navigate = useNavigate();

  const pendingDeposits = adminDeposits.filter(d => 
    ['SUBMITTED', 'PROOF_UPLOADED', 'UNDER_VERIFICATION'].includes(d.status)
  );
  const pendingPayments = adminPayments.filter(p => 
    ['SUBMITTED', 'INFO_RECEIVED', 'PROCESSING'].includes(p.status)
  );

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tableau de bord</h1>
          <p className="text-muted-foreground">Vue d'ensemble des opérations Bonzini</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Clients actifs</p>
                  <p className="text-2xl font-bold text-foreground">{dashboardStats.activeClients}</p>
                  <p className="text-xs text-muted-foreground">/ {dashboardStats.totalClients} total</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Solde total wallets</p>
                  <p className="text-2xl font-bold text-foreground">
                    {(dashboardStats.totalWalletBalance / 1000000).toFixed(1)}M
                  </p>
                  <p className="text-xs text-muted-foreground">XAF</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Wallet className="h-6 w-6 text-emerald-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Dépôts en attente</p>
                  <p className="text-2xl font-bold text-foreground">{dashboardStats.pendingDeposits}</p>
                  <p className="text-xs text-muted-foreground">À traiter</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <ArrowDownToLine className="h-6 w-6 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Paiements en cours</p>
                  <p className="text-2xl font-bold text-foreground">{dashboardStats.pendingPayments}</p>
                  <p className="text-xs text-muted-foreground">En traitement</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <ArrowUpFromLine className="h-6 w-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Rate Card */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Taux du jour</p>
                  <p className="text-xl font-bold text-foreground">
                    1 RMB = {dashboardStats.currentRate} XAF
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={() => navigate('/admin/rates')}>
                Gérer les taux
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pending Deposits */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ArrowDownToLine className="h-5 w-5 text-amber-500" />
                  Dépôts en attente
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate('/admin/deposits')}>
                  Voir tout
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingDeposits.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucun dépôt en attente
                </p>
              ) : (
                pendingDeposits.slice(0, 5).map((deposit) => (
                  <div
                    key={deposit.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                    onClick={() => navigate(`/admin/deposits/${deposit.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                        {deposit.status === 'SUBMITTED' && <Clock className="h-5 w-5 text-amber-500" />}
                        {deposit.status === 'PROOF_UPLOADED' && <CheckCircle className="h-5 w-5 text-blue-500" />}
                        {deposit.status === 'UNDER_VERIFICATION' && <AlertCircle className="h-5 w-5 text-orange-500" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{deposit.clientName}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(deposit.amountXAF)}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {getDepositStatusLabel(deposit.status)}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Pending Payments */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ArrowUpFromLine className="h-5 w-5 text-blue-500" />
                  Paiements en cours
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate('/admin/payments')}>
                  Voir tout
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingPayments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucun paiement en cours
                </p>
              ) : (
                pendingPayments.slice(0, 5).map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                    onClick={() => navigate(`/admin/payments/${payment.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <ArrowUpFromLine className="h-5 w-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{payment.clientName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(payment.amountXAF)} → {payment.amountRMB.toLocaleString()} RMB
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {getPaymentStatusLabel(payment.status)}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Activité récente</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin/history')}>
                Voir tout
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {adminLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium text-muted-foreground">
                      {log.adminUserName.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{log.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {log.adminUserName} • {formatDate(log.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
