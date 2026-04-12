import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAgentCashPayments, CashPayment } from '@/hooks/useAgentCashPayments';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { formatCurrencyRMB, formatDate } from '@/lib/formatters';
import { Loader2, LogOut, ChevronRight, Banknote, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AgentCashPayments() {
  const navigate = useNavigate();
  const { currentUser, logout } = useAdminAuth();
  const { t, language, setLanguage } = useLanguage();
  const [activeTab, setActiveTab] = useState<'pending' | 'paid'>('pending');

  const { data: pendingPayments, isLoading: loadingPending } = useAgentCashPayments('pending');
  const { data: paidPayments, isLoading: loadingPaid } = useAgentCashPayments('paid', currentUser?.id);

  const payments = activeTab === 'pending' ? pendingPayments : paidPayments;
  const isLoading = activeTab === 'pending' ? loadingPending : loadingPaid;

  const handleLogout = async () => {
    await logout();
    navigate('/a/login');
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'zh' : 'en');
  };

  const getBeneficiaryName = (payment: CashPayment) => {
    if (payment.cash_beneficiary_first_name && payment.cash_beneficiary_last_name) {
      return `${payment.cash_beneficiary_first_name} ${payment.cash_beneficiary_last_name}`;
    }
    return payment.beneficiary_name || '—';
  };

  const getClientName = (payment: CashPayment) => {
    if (payment.profile) {
      return `${payment.profile.first_name} ${payment.profile.last_name}`;
    }
    return '—';
  };

  return (
    <div>
      <MobileHeader
        title={t('cash_payments')}
        rightElement={
          <div className="flex items-center gap-1">
            <button
              onClick={toggleLanguage}
              className="px-2 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {language === 'en' ? '中文' : 'EN'}
            </button>
            <button
              onClick={handleLogout}
              className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors"
              aria-label={t('logout')}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        }
      />

      <div className="px-4 pt-4 pb-28 space-y-4">
        {/* Segment tabs */}
        <div className="bg-muted rounded-xl p-1 flex">
          <button
            onClick={() => setActiveTab('pending')}
            className={cn(
              'flex-1 py-2.5 rounded-lg text-sm font-medium transition-all',
              activeTab === 'pending'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground',
            )}
          >
            {t('to_pay')}
            {pendingPayments && pendingPayments.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-xs font-semibold">
                {pendingPayments.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('paid')}
            className={cn(
              'flex-1 py-2.5 rounded-lg text-sm font-medium transition-all',
              activeTab === 'paid'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground',
            )}
          >
            {t('paid')}
          </button>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && (!payments || payments.length === 0) && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Inbox className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm">
              {activeTab === 'pending' ? t('no_pending_payments') : t('no_paid_payments')}
            </p>
          </div>
        )}

        {/* Payment cards */}
        {!isLoading && payments && payments.length > 0 && (
          <div className="space-y-3">
            {payments.map((payment, index) => (
              <button
                key={payment.id}
                onClick={() => navigate(`/a/payment/${payment.id}`)}
                className="w-full card-glass p-4 rounded-2xl text-left animate-slide-up"
                style={{ animationDelay: `${index * 40}ms`, animationFillMode: 'both' }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Banknote className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-bold text-lg" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrencyRMB(payment.amount_rmb)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-xs font-medium',
                      payment.status === 'completed'
                        ? 'bg-green-500/10 text-green-600'
                        : (payment.status === 'cash_scanned' || payment.status === 'cash_pending')
                          ? 'bg-blue-500/10 text-blue-600'
                          : (payment.status === 'ready_for_payment' || payment.status === 'processing')
                            ? 'bg-amber-500/10 text-amber-600'
                            : 'bg-amber-500/10 text-amber-600',
                    )}>
                      {payment.status === 'completed'
                        ? t('status_paid')
                        : (payment.status === 'cash_scanned' || payment.status === 'cash_pending')
                          ? (t('status_scanned') || 'Scanné')
                          : t('status_to_pay') /* covers ready_for_payment + processing */}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>

                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('beneficiary')}</span>
                    <span className="font-medium">{getBeneficiaryName(payment)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('client')}</span>
                    <span className="font-medium">{getClientName(payment)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('reference')}</span>
                    <span className="font-mono text-xs">{payment.reference}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('date')}</span>
                    <span>{formatDate(payment.created_at, 'datetime')}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
