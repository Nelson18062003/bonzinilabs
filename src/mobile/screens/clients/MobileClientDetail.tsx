import { useParams, useNavigate } from 'react-router-dom';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminClientDetail } from '@/hooks/useAdminData';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { DEPOSIT_STATUS_LABELS } from '@/data/staticData';
import { cn } from '@/lib/utils';
import {
  Loader2,
  Phone,
  Calendar,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronRight,
  Building2,
  MapPin,
} from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  created: 'bg-gray-100 text-gray-700',
  awaiting_proof: 'bg-yellow-100 text-yellow-700',
  proof_submitted: 'bg-blue-100 text-blue-700',
  admin_review: 'bg-purple-100 text-purple-700',
  validated: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

export function MobileClientDetail() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const { data: client, isLoading } = useAdminClientDetail(clientId || '');

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <MobileHeader title="Détail client" showBack backTo="/m/clients" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex flex-col min-h-screen">
        <MobileHeader title="Détail client" showBack backTo="/m/clients" />
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-muted-foreground">Client non trouvé</p>
        </div>
      </div>
    );
  }

  const initials = `${client.first_name?.[0] || ''}${client.last_name?.[0] || ''}`;
  const recentDeposits = client.deposits?.slice(0, 5) || [];

  return (
    <div className="flex flex-col min-h-screen">
      <MobileHeader
        title="Détail client"
        showBack
        backTo="/m/clients"
      />

      <div className="flex-1 px-4 py-4 space-y-4">
        {/* Profile Header */}
        <div className="bg-card rounded-2xl p-5 border border-border text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-semibold text-primary mx-auto mb-3">
            {initials}
          </div>
          <h2 className="text-xl font-semibold">
            {client.first_name} {client.last_name}
          </h2>
          {client.phone && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground mt-1">
              <Phone className="w-4 h-4" />
              {client.phone}
            </div>
          )}
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-2">
            <Calendar className="w-3 h-3" />
            Client depuis {formatDate(client.created_at)}
          </div>

          {/* Additional info */}
          <div className="flex flex-wrap gap-2 justify-center mt-3">
            {client.company_name && (
              <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-muted text-xs">
                <Building2 className="w-3 h-3" />
                {client.company_name}
              </span>
            )}
            {client.city && (
              <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-muted text-xs">
                <MapPin className="w-3 h-3" />
                {client.city}
              </span>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Wallet Balance */}
          <button
            onClick={() => navigate(`/m/clients/${client.user_id}/wallet`)}
            className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-4 border border-primary/20 text-left active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-primary" />
              </div>
            </div>
            <p className="text-lg font-bold">{formatCurrency(client.wallet?.balance_xaf || 0)}</p>
            <p className="text-xs text-muted-foreground">Solde wallet</p>
          </button>

          {/* Total Deposits */}
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                <ArrowDownCircle className="w-4 h-4 text-green-500" />
              </div>
            </div>
            <p className="text-lg font-bold text-green-600">{formatCurrency(client.totalDeposits || 0)}</p>
            <p className="text-xs text-muted-foreground">Total dépôts</p>
          </div>

          {/* Total Payments */}
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                <ArrowUpCircle className="w-4 h-4 text-blue-500" />
              </div>
            </div>
            <p className="text-lg font-bold text-blue-600">{formatCurrency(client.totalPayments || 0)}</p>
            <p className="text-xs text-muted-foreground">Total paiements</p>
          </div>

          {/* Last Deposit */}
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-amber-500" />
              </div>
            </div>
            <p className="text-lg font-bold">
              {recentDeposits[0] ? formatDate(recentDeposits[0].created_at) : 'N/A'}
            </p>
            <p className="text-xs text-muted-foreground">Dernier dépôt</p>
          </div>
        </div>

        {/* Recent Deposits */}
        {recentDeposits.length > 0 && (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-medium">Dépôts récents</h3>
              <button
                onClick={() => navigate('/m/deposits')}
                className="text-sm text-primary font-medium"
              >
                Voir tous
              </button>
            </div>
            <div className="divide-y divide-border">
              {recentDeposits.map((deposit) => (
                <button
                  key={deposit.id}
                  onClick={() => navigate(`/m/deposits/${deposit.id}`)}
                  className="w-full flex items-center justify-between p-4 active:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="font-medium">{formatCurrency(deposit.amount_xaf)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(deposit.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-medium",
                      STATUS_COLORS[deposit.status]
                    )}>
                      {DEPOSIT_STATUS_LABELS[deposit.status]}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="space-y-2">
          <button
            onClick={() => navigate(`/m/clients/${client.user_id}/wallet`)}
            className="w-full flex items-center justify-between p-4 bg-card rounded-xl border border-border active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-medium">Voir le wallet</p>
                <p className="text-xs text-muted-foreground">Historique des mouvements</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}
