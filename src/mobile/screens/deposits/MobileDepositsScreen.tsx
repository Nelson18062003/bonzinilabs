import { useState, useMemo } from 'react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminDeposits, useDepositStats, DEPOSIT_STATUS_LABELS, DEPOSIT_METHOD_LABELS } from '@/hooks/useDeposits';
import { Loader2, Plus, Search, Clock, AlertCircle, CheckCircle, FileText } from 'lucide-react';
import { formatXAF } from '@/lib/formatters';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

type DepositStatusType = 'created' | 'awaiting_proof' | 'proof_submitted' | 'admin_review' | 'validated' | 'rejected' | 'pending_correction';

const STATUS_COLORS: Record<string, string> = {
  created: 'bg-gray-100 text-gray-700',
  awaiting_proof: 'bg-yellow-100 text-yellow-700',
  proof_submitted: 'bg-blue-100 text-blue-700',
  admin_review: 'bg-purple-100 text-purple-700',
  pending_correction: 'bg-orange-100 text-orange-700',
  validated: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

const STATUS_FILTERS: { key: DepositStatusType | 'all' | 'to_process'; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'to_process', label: 'À traiter' },
  { key: 'pending_correction', label: 'À corriger' },
  { key: 'validated', label: 'Validés' },
  { key: 'rejected', label: 'Rejetés' },
];

// Statuts considérés comme "à traiter" pour le traitement admin
const TO_PROCESS_STATUSES = ['proof_submitted', 'admin_review'];

export function MobileDepositsScreen() {
  const [statusFilter, setStatusFilter] = useState<DepositStatusType | 'all' | 'to_process'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { data: deposits, isLoading } = useAdminDeposits();
  const { data: stats } = useDepositStats();
  const navigate = useNavigate();

  const filteredDeposits = useMemo(() => {
    if (!deposits) return [];

    let filtered = deposits;

    // Filtre par statut
    if (statusFilter === 'to_process') {
      filtered = filtered.filter(d => TO_PROCESS_STATUSES.includes(d.status));
    } else if (statusFilter !== 'all') {
      filtered = filtered.filter(d => d.status === statusFilter);
    }

    // Filtre par recherche
    if (searchQuery) {
      const search = searchQuery.toLowerCase();
      filtered = filtered.filter(deposit => {
        const clientName = `${deposit.profiles?.first_name || ''} ${deposit.profiles?.last_name || ''}`.toLowerCase();
        return clientName.includes(search) || deposit.reference?.toLowerCase().includes(search);
      });
    }

    return filtered;
  }, [deposits, statusFilter, searchQuery]);

  // Compteurs locaux si stats pas disponibles
  const counts = useMemo(() => {
    if (stats) {
      return {
        toProcess: stats.to_process,
        correction: stats.pending_correction,
        validated: stats.validated,
        total: stats.total,
      };
    }
    if (!deposits) return { toProcess: 0, correction: 0, validated: 0, total: 0 };
    return {
      toProcess: deposits.filter(d => TO_PROCESS_STATUSES.includes(d.status)).length,
      correction: deposits.filter(d => d.status === 'pending_correction').length,
      validated: deposits.filter(d => d.status === 'validated').length,
      total: deposits.length,
    };
  }, [deposits, stats]);

  return (
    <div className="flex flex-col min-h-full">
      <MobileHeader
        title="Dépôts"
        rightElement={
          <button
            onClick={() => navigate('/m/deposits/new')}
            className="w-10 h-10 flex items-center justify-center rounded-full active:bg-muted"
          >
            <Plus className="w-5 h-5" />
          </button>
        }
      />

      <div className="flex-1 px-4 py-4 space-y-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setStatusFilter('to_process')}
            className={cn(
              "p-3 rounded-xl border text-left transition-all",
              statusFilter === 'to_process'
                ? "border-blue-500 bg-blue-50"
                : "border-border bg-card"
            )}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-lg font-bold text-blue-700">{counts.toProcess}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">À traiter</p>
          </button>

          <button
            onClick={() => setStatusFilter('pending_correction')}
            className={cn(
              "p-3 rounded-xl border text-left transition-all",
              statusFilter === 'pending_correction'
                ? "border-orange-500 bg-orange-50"
                : "border-border bg-card"
            )}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <AlertCircle className="w-3.5 h-3.5 text-orange-600" />
              <span className="text-lg font-bold text-orange-700">{counts.correction}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">À corriger</p>
          </button>

          <button
            onClick={() => setStatusFilter('validated')}
            className={cn(
              "p-3 rounded-xl border text-left transition-all",
              statusFilter === 'validated'
                ? "border-green-500 bg-green-50"
                : "border-border bg-card"
            )}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle className="w-3.5 h-3.5 text-green-600" />
              <span className="text-lg font-bold text-green-700">{counts.validated}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Validés</p>
          </button>
        </div>

        {/* Today's validation stats */}
        {stats && stats.today_validated > 0 && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-3 border border-green-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">Aujourd'hui</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-green-700">{stats.today_validated} validé(s)</p>
                <p className="text-xs text-green-600">{formatXAF(stats.today_amount)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher par nom ou référence..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-lg bg-muted border-0 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {STATUS_FILTERS.map((filter) => {
            const count = filter.key === 'to_process' ? counts.toProcess :
                         filter.key === 'pending_correction' ? counts.correction :
                         filter.key === 'validated' ? counts.validated :
                         filter.key === 'all' ? counts.total : null;
            return (
              <button
                key={filter.key}
                onClick={() => setStatusFilter(filter.key)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5",
                  statusFilter === filter.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {filter.label}
                {count !== null && count > 0 && (
                  <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded-full",
                    statusFilter === filter.key
                      ? "bg-primary-foreground/20"
                      : "bg-background"
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Deposits List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredDeposits.length > 0 ? (
          <div className="space-y-3">
            {filteredDeposits.map((deposit) => {
              const initials = `${deposit.profiles?.first_name?.[0] || '?'}${deposit.profiles?.last_name?.[0] || ''}`;
              const clientName = deposit.profiles
                ? `${deposit.profiles.first_name} ${deposit.profiles.last_name}`
                : 'Client inconnu';

              return (
                <button
                  key={deposit.id}
                  onClick={() => navigate(`/m/deposits/${deposit.id}`)}
                  className="w-full bg-card rounded-xl p-4 border border-border text-left active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Client info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary flex-shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{clientName}</p>
                        <p className="text-xs text-muted-foreground truncate">{deposit.reference}</p>
                        <p className="text-xs text-muted-foreground">
                          {DEPOSIT_METHOD_LABELS[deposit.method] || deposit.method}
                        </p>
                      </div>
                    </div>

                    {/* Amount and status */}
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold">{formatXAF(deposit.amount_xaf)}</p>
                      <span className={cn(
                        "inline-block px-2 py-0.5 rounded-full text-[10px] font-medium mt-1",
                        STATUS_COLORS[deposit.status] || 'bg-gray-100 text-gray-700'
                      )}>
                        {DEPOSIT_STATUS_LABELS[deposit.status] || deposit.status}
                      </span>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {format(new Date(deposit.created_at), 'dd MMM', { locale: fr })}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <FileText className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">Aucun dépôt trouvé</p>
            <p className="text-sm text-muted-foreground mt-1">
              {statusFilter !== 'all' ? 'Essayez un autre filtre' : 'Les dépôts apparaîtront ici'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
