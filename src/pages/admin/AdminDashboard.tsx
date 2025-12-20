import { 
  Users, 
  Wallet, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  TrendingUp,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminStatCard, AdminCard, AdminCardHeader } from '@/components/admin/ui/AdminCard';
import { AdminPageHeader } from '@/components/admin/ui/AdminPageHeader';
import { DepositStatusBadge } from '@/components/admin/ui/AdminBadge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useDashboardStats, useAdminDeposits, useAdminAuditLogs } from '@/hooks/useAdminData';
import { formatXAF, formatDate } from '@/lib/formatters';
import { useNavigate } from 'react-router-dom';

export function AdminDashboard() {
  const navigate = useNavigate();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: deposits, isLoading: depositsLoading } = useAdminDeposits();
  const { data: logs, isLoading: logsLoading } = useAdminAuditLogs();

  const pendingDeposits = deposits?.filter(d => 
    ['created', 'awaiting_proof', 'proof_submitted', 'admin_review'].includes(d.status)
  ) || [];

  if (statsLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

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
          value={stats?.activeClients || 0}
          subtitle={`/ ${stats?.totalClients || 0} total`}
          icon={Users}
          iconColor="text-primary"
        />
        <AdminStatCard
          title="Solde total wallets"
          value={`${((stats?.totalWalletBalance || 0) / 1000000).toFixed(1)}M`}
          subtitle="XAF"
          icon={Wallet}
          iconColor="text-emerald-500"
        />
        <AdminStatCard
          title="Dépôts en attente"
          value={stats?.pendingDeposits || 0}
          subtitle="À traiter"
          icon={ArrowDownToLine}
          iconColor="text-amber-500"
        />
        <AdminStatCard
          title="Paiements en cours"
          value={stats?.pendingPayments || 0}
          subtitle="En traitement"
          icon={ArrowUpFromLine}
          iconColor="text-blue-500"
        />
      </div>

      {/* Rate Card */}
      <AdminStatCard
        variant="primary"
        title="Taux du jour"
        value={`1 RMB = ${stats?.currentRate || 87} XAF`}
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
            {depositsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : pendingDeposits.length === 0 ? (
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
                      <p className="text-xs text-muted-foreground">{formatXAF(deposit.amount_xaf)} XAF</p>
                    </div>
                  </div>
                  <DepositStatusBadge status={deposit.status} />
                </div>
              ))
            )}
          </div>
        </AdminCard>

        {/* Pending Payments - Empty for now */}
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
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucun paiement en cours
            </p>
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
          {logsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (logs?.length || 0) === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucune activité récente
            </p>
          ) : (
            logs?.slice(0, 5).map((log) => (
              <div key={log.id} className="flex items-start gap-3 p-4">
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                    {log.adminProfile 
                      ? `${log.adminProfile.first_name[0]}${log.adminProfile.last_name[0]}`
                      : 'AD'
                    }
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{log.action_type}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {log.adminProfile 
                      ? `${log.adminProfile.first_name} ${log.adminProfile.last_name}` 
                      : 'Admin'
                    } • {formatDate(log.created_at)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </AdminCard>
    </AdminLayout>
  );
}