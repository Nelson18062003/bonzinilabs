import { useState, useMemo } from 'react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminPayments } from '@/hooks/usePayments';
import { Loader2, Plus, Search, QrCode, Clock, PlayCircle } from 'lucide-react';
import { formatCurrency, formatCurrencyRMB } from '@/lib/formatters';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type PaymentStatus = Database['public']['Enums']['payment_status'];
type PaymentMethod = Database['public']['Enums']['payment_method'];

const STATUS_LABELS: Record<PaymentStatus, string> = {
  created: 'Créé',
  waiting_beneficiary_info: 'Info att.',
  ready_for_payment: 'Prêt',
  processing: 'En cours',
  completed: 'Terminé',
  rejected: 'Rejeté',
  cash_pending: 'Cash att.',
  cash_scanned: 'Cash scanné',
};

const STATUS_COLORS: Record<PaymentStatus, string> = {
  created: 'bg-gray-100 text-gray-700',
  waiting_beneficiary_info: 'bg-yellow-100 text-yellow-700',
  ready_for_payment: 'bg-blue-100 text-blue-700',
  processing: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  cash_pending: 'bg-orange-100 text-orange-700',
  cash_scanned: 'bg-cyan-100 text-cyan-700',
};

const METHOD_ICONS: Record<PaymentMethod, string> = {
  alipay: '支',
  wechat: '微',
  bank_transfer: '🏦',
  cash: '💵',
};

const STATUS_FILTERS: { key: PaymentStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'ready_for_payment', label: 'Prêts' },
  { key: 'processing', label: 'En cours' },
  { key: 'completed', label: 'Terminés' },
];

export function MobilePaymentsScreen() {
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { data: payments, isLoading } = useAdminPayments();
  const navigate = useNavigate();

  const filteredPayments = payments?.filter(payment => {
    // Status filter
    if (statusFilter !== 'all' && payment.status !== statusFilter) return false;

    // Search filter
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    const clientName = `${payment.profiles?.first_name || ''} ${payment.profiles?.last_name || ''}`.toLowerCase();
    return clientName.includes(search) || payment.reference?.toLowerCase().includes(search);
  });

  // Calculate stats
  const stats = useMemo(() => {
    if (!payments) return { toProcess: 0, inProgress: 0 };
    return {
      toProcess: payments.filter(p => p.status === 'ready_for_payment' || p.status === 'cash_scanned').length,
      inProgress: payments.filter(p => p.status === 'processing').length,
    };
  }, [payments]);

  return (
    <div className="flex flex-col min-h-full">
      <MobileHeader
        title="Paiements"
        rightElement={
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate('/m/payments/cash-scan')}
              className="w-10 h-10 flex items-center justify-center rounded-full active:bg-muted"
              title="Scanner Cash"
            >
              <QrCode className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate('/m/payments/new')}
              className="w-10 h-10 flex items-center justify-center rounded-full active:bg-muted"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        }
      />

      <div className="flex-1 px-4 py-4 space-y-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setStatusFilter('ready_for_payment')}
            className={cn(
              "p-4 rounded-xl border text-left transition-all",
              statusFilter === 'ready_for_payment'
                ? "border-primary bg-primary/5"
                : "border-border bg-card"
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium">À traiter</span>
            </div>
            <p className="text-2xl font-bold">{stats.toProcess}</p>
          </button>
          <button
            onClick={() => setStatusFilter('processing')}
            className={cn(
              "p-4 rounded-xl border text-left transition-all",
              statusFilter === 'processing'
                ? "border-primary bg-primary/5"
                : "border-border bg-card"
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <PlayCircle className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-medium">En cours</span>
            </div>
            <p className="text-2xl font-bold">{stats.inProgress}</p>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher un paiement..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-lg bg-muted border-0 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.key}
              onClick={() => setStatusFilter(filter.key)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                statusFilter === filter.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Payments List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredPayments && filteredPayments.length > 0 ? (
          <div className="space-y-3">
            {filteredPayments.map((payment) => (
              <button
                key={payment.id}
                onClick={() => navigate(`/m/payments/${payment.id}`)}
                className="w-full bg-card rounded-xl p-4 border border-border text-left active:scale-[0.98] transition-transform"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg flex-shrink-0">
                      {METHOD_ICONS[payment.method]}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {payment.profiles?.first_name} {payment.profiles?.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {payment.reference}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold">{formatCurrencyRMB(payment.amount_rmb)}</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(payment.amount_xaf)}</p>
                    <span className={cn(
                      "inline-block px-2 py-0.5 rounded-full text-[10px] font-medium mt-1",
                      STATUS_COLORS[payment.status]
                    )}>
                      {STATUS_LABELS[payment.status]}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Search className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">Aucun paiement trouvé</p>
          </div>
        )}
      </div>
    </div>
  );
}
