import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useDashboardStats, useAdminDeposits, useAdminAuditLogs } from '@/hooks/useAdminData';
import { useCurrentExchangeRate } from '@/hooks/useExchangeRates';
import { Loader2, Users, Wallet, ArrowDownToLine, ArrowUpFromLine, TrendingUp } from 'lucide-react';
import { formatCurrency, formatCurrencyRMB } from '@/lib/formatters';
import { useNavigate } from 'react-router-dom';

export function MobileDashboard() {
  const { profile } = useAdminAuth();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: currentRate } = useCurrentExchangeRate();
  const { data: pendingDeposits } = useAdminDeposits('proof_submitted');
  const navigate = useNavigate();

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
  };

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      <MobileHeader title="Bonzini Admin" />

      <div className="flex-1 px-4 py-4 space-y-6">
        {/* Greeting */}
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">
            {greeting()}, {profile?.first_name || 'Admin'}
          </h2>
          {pendingDeposits && pendingDeposits.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {pendingDeposits.length} dépôt{pendingDeposits.length > 1 ? 's' : ''} en attente de validation
            </p>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Clients */}
          <button
            onClick={() => navigate('/m/clients')}
            className="bg-card rounded-xl p-4 border border-border text-left active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-blue-500" />
              </div>
            </div>
            <p className="text-2xl font-bold">{stats?.activeClients || 0}</p>
            <p className="text-xs text-muted-foreground">Clients actifs</p>
          </button>

          {/* Wallet Balance */}
          <button
            onClick={() => navigate('/m/clients')}
            className="bg-card rounded-xl p-4 border border-border text-left active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-green-500" />
              </div>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(stats?.totalWalletBalance || 0)}</p>
            <p className="text-xs text-muted-foreground">Solde total</p>
          </button>

          {/* Pending Deposits */}
          <button
            onClick={() => navigate('/m/deposits')}
            className="bg-card rounded-xl p-4 border border-border text-left active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center">
                <ArrowDownToLine className="w-4 h-4 text-orange-500" />
              </div>
            </div>
            <p className="text-2xl font-bold">{stats?.pendingDeposits || 0}</p>
            <p className="text-xs text-muted-foreground">Dépôts en attente</p>
          </button>

          {/* Pending Payments */}
          <button
            onClick={() => navigate('/m/payments')}
            className="bg-card rounded-xl p-4 border border-border text-left active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center">
                <ArrowUpFromLine className="w-4 h-4 text-purple-500" />
              </div>
            </div>
            <p className="text-2xl font-bold">{stats?.pendingPayments || 0}</p>
            <p className="text-xs text-muted-foreground">Paiements en attente</p>
          </button>
        </div>

        {/* Exchange Rate Card */}
        {currentRate && (
          <button
            onClick={() => navigate('/m/more/rates')}
            className="w-full bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-4 border border-primary/20 text-left active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Taux du jour</p>
                  <p className="text-lg font-semibold">
                    1M XAF = {formatCurrencyRMB(1000000 * currentRate.rate_xaf_to_rmb)}
                  </p>
                </div>
              </div>
            </div>
          </button>
        )}

        {/* Pending Deposits List */}
        {pendingDeposits && pendingDeposits.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Dépôts à valider</h3>
              <button
                onClick={() => navigate('/m/deposits')}
                className="text-sm text-primary font-medium"
              >
                Voir tous
              </button>
            </div>

            <div className="space-y-2">
              {pendingDeposits.slice(0, 3).map((deposit) => (
                <button
                  key={deposit.id}
                  onClick={() => navigate(`/m/deposits/${deposit.id}`)}
                  className="w-full bg-card rounded-xl p-4 border border-border text-left active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                        {deposit.profiles?.first_name?.[0] || '?'}
                        {deposit.profiles?.last_name?.[0] || ''}
                      </div>
                      <div>
                        <p className="font-medium">
                          {deposit.profiles?.first_name} {deposit.profiles?.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {deposit.reference}
                        </p>
                      </div>
                    </div>
                    <p className="font-semibold">{formatCurrency(deposit.amount_xaf)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
