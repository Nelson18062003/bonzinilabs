import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminCard } from '@/components/admin/ui/AdminCard';
import { 
  AdminResponsiveHeader, 
  AdminScrollContainer,
  AdminButtonGroup 
} from '@/components/admin/ui/AdminResponsive';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminPayments } from '@/hooks/usePayments';
import { formatXAF, formatCurrencyRMB } from '@/lib/formatters';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  CreditCard, 
  Wallet, 
  Building2, 
  Banknote,
  ChevronRight,
  Search,
  FileCheck,
  Plus,
  Download,
  QrCode
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ExportablePayment } from '@/lib/generatePaymentsExportPDF';
import { PaymentExportPreviewModal } from '@/components/admin/PaymentExportPreviewModal';

const statusConfig: Record<string, { label: string; color: string }> = {
  created: { label: 'Créé', color: 'bg-blue-500' },
  waiting_beneficiary_info: { label: 'Attente infos', color: 'bg-yellow-500' },
  ready_for_payment: { label: 'Prêt', color: 'bg-purple-500' },
  cash_pending: { label: 'QR', color: 'bg-cyan-500' },
  cash_scanned: { label: 'Scanné', color: 'bg-orange-500' },
  processing: { label: 'En cours', color: 'bg-orange-500' },
  completed: { label: 'Effectué', color: 'bg-green-500' },
  rejected: { label: 'Refusé', color: 'bg-red-500' },
};

const methodIcons: Record<string, React.ElementType> = {
  alipay: CreditCard,
  wechat: Wallet,
  bank_transfer: Building2,
  cash: Banknote,
};

const methodLabels: Record<string, string> = {
  alipay: 'Alipay',
  wechat: 'WeChat',
  bank_transfer: 'Virement',
  cash: 'Cash',
};

export function AdminPaymentsPage() {
  const navigate = useNavigate();
  const { data: payments, isLoading } = useAdminPayments();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [showExportModal, setShowExportModal] = useState(false);

  const filteredPayments = payments?.filter(payment => {
    const matchesSearch = !searchQuery || 
      payment.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.profiles?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.profiles?.last_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
    const matchesMethod = methodFilter === 'all' || payment.method === methodFilter;
    
    return matchesSearch && matchesStatus && matchesMethod;
  });

  const statusCounts = {
    all: payments?.length || 0,
    ready_for_payment: payments?.filter(p => p.status === 'ready_for_payment').length || 0,
    processing: payments?.filter(p => p.status === 'processing').length || 0,
    waiting_beneficiary_info: payments?.filter(p => p.status === 'waiting_beneficiary_info').length || 0,
    completed: payments?.filter(p => p.status === 'completed').length || 0,
    cash_pending: payments?.filter(p => p.status === 'cash_pending' || p.status === 'cash_scanned').length || 0,
  };

  const exportablePayments = payments?.filter(p => {
    const isEligibleStatus = p.status === 'ready_for_payment' || p.status === 'processing';
    const hasBeneficiaryInfo = p.beneficiary_qr_code_url || p.beneficiary_name || p.beneficiary_bank_account || p.method === 'cash';
    return isEligibleStatus && hasBeneficiaryInfo;
  }) || [];

  const paymentsToExport: ExportablePayment[] = exportablePayments.map(p => ({
    id: p.id,
    reference: p.reference,
    created_at: p.created_at,
    amount_xaf: p.amount_xaf,
    amount_rmb: p.amount_rmb,
    exchange_rate: p.exchange_rate,
    method: p.method,
    status: p.status,
    beneficiary_name: p.beneficiary_name,
    beneficiary_phone: p.beneficiary_phone,
    beneficiary_bank_name: p.beneficiary_bank_name,
    beneficiary_bank_account: p.beneficiary_bank_account,
    beneficiary_qr_code_url: p.beneficiary_qr_code_url,
    client_name: p.profiles 
      ? `${p.profiles.first_name || ''} ${p.profiles.last_name || ''}`.trim() 
      : 'Client inconnu',
  }));

  return (
    <AdminLayout>
      <AdminResponsiveHeader 
        title="Paiements" 
        subtitle={`${statusCounts.ready_for_payment} à traiter`}
        actions={
          <AdminButtonGroup>
            <Button 
              onClick={() => navigate('/admin/payments/cash-scan')} 
              size="sm" 
              variant="outline"
              className="bg-cyan-500/10 border-cyan-500/30 text-cyan-600 hover:bg-cyan-500/20"
            >
              <QrCode className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Scanner</span>
            </Button>
            <Button 
              onClick={() => setShowExportModal(true)} 
              size="sm" 
              variant="outline"
              disabled={exportablePayments.length === 0}
            >
              <Download className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Export</span>
              <span className="ml-1">({exportablePayments.length})</span>
            </Button>
            <Button onClick={() => navigate('/admin/payments/new')} size="sm">
              <Plus className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Créer</span>
            </Button>
          </AdminButtonGroup>
        }
        className="mb-4"
      />

      {/* Filters */}
      <div className="space-y-3 sm:space-y-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Status filters - horizontal scroll on mobile */}
        <AdminScrollContainer>
          {[
            { value: 'all', label: 'Tous', count: statusCounts.all },
            { value: 'ready_for_payment', label: 'À traiter', count: statusCounts.ready_for_payment },
            { value: 'cash_pending', label: 'Cash', count: statusCounts.cash_pending },
            { value: 'processing', label: 'En cours', count: statusCounts.processing },
            { value: 'waiting_beneficiary_info', label: 'Attente', count: statusCounts.waiting_beneficiary_info },
            { value: 'completed', label: 'Effectués', count: statusCounts.completed },
          ].map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                statusFilter === filter.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {filter.label} ({filter.count})
            </button>
          ))}
        </AdminScrollContainer>

        {/* Method filters */}
        <AdminScrollContainer>
          {[
            { value: 'all', label: 'Toutes' },
            { value: 'alipay', label: 'Alipay' },
            { value: 'wechat', label: 'WeChat' },
            { value: 'bank_transfer', label: 'Virement' },
            { value: 'cash', label: 'Cash' },
          ].map((filter) => (
            <button
              key={filter.value}
              onClick={() => setMethodFilter(filter.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                methodFilter === filter.value
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </AdminScrollContainer>
      </div>

      {/* Payments list */}
      <div className="space-y-3">
        {isLoading ? (
          [1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))
        ) : filteredPayments && filteredPayments.length > 0 ? (
          filteredPayments.map((payment) => {
            const MethodIcon = methodIcons[payment.method] || CreditCard;
            const status = statusConfig[payment.status];
            const clientName = payment.profiles 
              ? `${payment.profiles.first_name || ''} ${payment.profiles.last_name || ''}`.trim() 
              : 'Client inconnu';

            return (
              <AdminCard 
                key={payment.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors active:scale-[0.99]"
                onClick={() => navigate(`/admin/payments/${payment.id}`)}
              >
                <div className="flex items-start gap-2 sm:gap-3">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <MethodIcon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-semibold text-xs sm:text-sm truncate">{payment.reference}</span>
                      <Badge className={`${status?.color} text-white text-[10px] sm:text-xs flex-shrink-0`}>
                        {status?.label}
                      </Badge>
                    </div>
                    
                    <p className="text-xs sm:text-sm text-muted-foreground mb-1 truncate">{clientName}</p>
                    
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] sm:text-xs text-muted-foreground">
                        {format(new Date(payment.created_at), 'dd MMM HH:mm', { locale: fr })}
                      </span>
                      <div className="text-right">
                        <p className="font-semibold text-xs sm:text-sm">{formatXAF(payment.amount_xaf)} XAF</p>
                        <p className="text-[10px] sm:text-xs text-primary">{formatCurrencyRMB(payment.amount_rmb)}</p>
                      </div>
                    </div>

                    {payment.beneficiary_name && (
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">
                        → {payment.beneficiary_name}
                      </p>
                    )}
                  </div>
                  
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground flex-shrink-0" />
                </div>
              </AdminCard>
            );
          })
        ) : (
          <AdminCard className="text-center py-12">
            <FileCheck className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-sm text-muted-foreground">Aucun paiement trouvé</p>
          </AdminCard>
        )}
      </div>

      <PaymentExportPreviewModal
        open={showExportModal}
        onOpenChange={setShowExportModal}
        payments={paymentsToExport}
      />
    </AdminLayout>
  );
}
