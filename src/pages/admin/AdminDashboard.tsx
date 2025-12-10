import { 
  Users, 
  Wallet, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminStatCard, AdminCard, AdminCardHeader } from '@/components/admin/ui/AdminCard';
import { AdminPageHeader } from '@/components/admin/ui/AdminPageHeader';
import { DepositStatusBadge, PaymentStatusBadge } from '@/components/admin/ui/AdminBadge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  dashboardStats, 
  adminDeposits, 
  adminPayments, 
  adminLogs,
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
      <AdminPageHeader 
        title="Tableau de bord" 
        subtitle="Vue d'ensemble des opérations Bonzini"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <AdminStatCard
          title="Clients actifs"
          value={dashboardStats.activeClients}
          subtitle={`/ ${dashboardStats.totalClients} total`}
          icon={Users}
          iconColor="text-primary"
        />
        <AdminStatCard
          title="Solde total wallets"
          value={`${(dashboardStats.totalWalletBalance / 1000000).toFixed(1)}M`}
          subtitle="XAF"
          icon={Wallet}
          iconColor="text-emerald-500"
        />
        <AdminStatCard
          title="Dépôts en attente"
          value={dashboardStats.pendingDeposits}
          subtitle="À traiter"
          icon={ArrowDownToLine}
          iconColor="text-amber-500"
        />
        <AdminStatCard
          title="Paiements en cours"
          value={dashboardStats.pendingPayments}
          subtitle="En traitement"
          icon={ArrowUpFromLine}
          iconColor="text-blue-500"
        />
      </div>

      {/* Rate Card */}
      <AdminStatCard
        variant="primary"
        title="Taux du jour"
        value={`1 RMB = ${dashboardStats.currentRate} XAF`}
        subtitle={`Mis à jour le ${formatDate(new Date())}`}
        icon={TrendingUp}
        className="mb-6"
      />

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Pending Deposits */}
        <AdminCard padding="none">
          <div className="p-5 border-b border-border">
            <AdminCardHeader 
              title="Dépôts en attente"
              icon={ArrowDownToLine}
              iconColor="text-amber-500"
              action={
                <Button variant="ghost" size="sm" onClick={() => navigate('/admin/deposits')}>
                  Voir tout <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              }
              className="mb-0"
            />
          </div>
          <div className="divide-y divide-border">
            {pendingDeposits.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucun dépôt en attente
              </p>
            ) : (
              pendingDeposits.slice(0, 5).map((deposit) => (
                <div
                  key={deposit.id}
                  className="flex items-center justify-between p-4 hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => navigate(`/admin/deposits/${deposit.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                        {deposit.clientName.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-foreground">{deposit.clientName}</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(deposit.amountXAF)}</p>
                    </div>
                  </div>
                  <DepositStatusBadge status={deposit.status} />
                </div>
              ))
            )}
          </div>
        </AdminCard>

        {/* Pending Payments */}
        <AdminCard padding="none">
          <div className="p-5 border-b border-border">
            <AdminCardHeader 
              title="Paiements en cours"
              icon={ArrowUpFromLine}
              iconColor="text-blue-500"
              action={
                <Button variant="ghost" size="sm" onClick={() => navigate('/admin/payments')}>
                  Voir tout <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              }
              className="mb-0"
            />
          </div>
          <div className="divide-y divide-border">
            {pendingPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucun paiement en cours
              </p>
            ) : (
              pendingPayments.slice(0, 5).map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-4 hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => navigate(`/admin/payments/${payment.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                        {payment.clientName.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-foreground">{payment.clientName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(payment.amountXAF)} → {payment.amountRMB.toLocaleString()} RMB
                      </p>
                    </div>
                  </div>
                  <PaymentStatusBadge status={payment.status} />
                </div>
              ))
            )}
          </div>
        </AdminCard>
      </div>

      {/* Recent Activity */}
      <AdminCard padding="none">
        <div className="p-5 border-b border-border">
          <AdminCardHeader 
            title="Activité récente"
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin/history')}>
                Voir tout <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            }
            className="mb-0"
          />
        </div>
        <div className="divide-y divide-border">
          {adminLogs.slice(0, 5).map((log) => (
            <div key={log.id} className="flex items-start gap-3 p-4">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                  {log.adminUserName.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">{log.description}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {log.adminUserName} • {formatDate(log.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </AdminCard>
    </AdminLayout>
  );
}
