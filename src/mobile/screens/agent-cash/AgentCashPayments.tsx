// ============================================================
// AGENT-CASH — AgentCashPayments (liste, onglets À payer / Payés)
// Présentation migrée sur le design kit (Ofspace/Mola) :
//   canvas doux · Segmented (onglets) · lignes Card + Holder + Amount +
//   StatusPill toné + Row · ScreenLoader · empty-state Holder.
// Logique 100% préservée : useAgentCashPayments(pending|paid), onglets,
// logout, bascule EN/ZH, navigation détail, libellés de statut.
// ============================================================
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAgentCashPayments, CashPayment } from '@/hooks/useAgentCashPayments';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { formatCurrencyRMB, formatDate } from '@/lib/formatters';
import { LogOut, ChevronRight, Banknote, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SURFACE,
  TEXT,
  Segmented,
  Card,
  Holder,
  Amount,
  Row,
  StatusPill,
  ScreenLoader,
  type Tone,
} from '@/mobile/designKit';

// Statut paiement cash → tone (conserve l'intention visuelle d'origine :
// payé=vert, scanné=bleu/info, à payer=ambre/pending).
function cashStatusTone(status: string): Tone {
  if (status === 'completed') return 'success';
  if (status === 'cash_scanned' || status === 'cash_pending') return 'info';
  return 'pending';
}

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

  const statusLabel = (status: string) =>
    status === 'completed'
      ? t('status_paid')
      : status === 'cash_scanned' || status === 'cash_pending'
        ? t('status_scanned') || 'Scanné'
        : t('status_to_pay'); /* covers ready_for_payment + processing */

  return (
    <div className={cn('min-h-screen', SURFACE.canvas)}>
      <MobileHeader
        title={t('cash_payments')}
        rightElement={
          <div className="flex items-center gap-1">
            <button
              onClick={toggleLanguage}
              className={cn('px-2 py-1 rounded-md text-xs font-medium transition-colors hover:text-foreground', TEXT.muted)}
            >
              {language === 'en' ? '中文' : 'EN'}
            </button>
            <button
              onClick={handleLogout}
              className={cn('w-8 h-8 flex items-center justify-center rounded-full transition-colors hover:text-foreground', TEXT.muted)}
              aria-label={t('logout')}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        }
      />

      <div className="px-4 pt-4 pb-28 space-y-4">
        {/* Segment tabs */}
        <Segmented
          value={activeTab}
          onChange={setActiveTab}
          options={[
            {
              value: 'pending',
              label: (
                <span className="inline-flex items-center justify-center gap-1.5">
                  {t('to_pay')}
                  {pendingPayments && pendingPayments.length > 0 && (
                    <span className="rounded-full bg-[#F8EFD8] px-1.5 py-0.5 text-[11px] font-bold text-[#9A6B12] dark:bg-[#372D14] dark:text-[#E7C083]">
                      {pendingPayments.length}
                    </span>
                  )}
                </span>
              ),
            },
            { value: 'paid', label: t('paid') },
          ]}
        />

        {/* Loading state */}
        {isLoading && <ScreenLoader />}

        {/* Empty state */}
        {!isLoading && (!payments || payments.length === 0) && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Holder icon={Inbox} size="lg" className="mb-4" />
            <p className={cn('text-sm', TEXT.muted)}>
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
                className="w-full text-left animate-slide-up"
                style={{ animationDelay: `${index * 40}ms`, animationFillMode: 'both' }}
              >
                <Card className="transition active:scale-[0.99]">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Holder icon={Banknote} />
                      <Amount value={formatCurrencyRMB(payment.amount_rmb)} size="md" />
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <StatusPill tone={cashStatusTone(payment.status)} label={statusLabel(payment.status)} />
                      <ChevronRight className={cn('h-4 w-4', TEXT.muted)} />
                    </div>
                  </div>

                  <div>
                    <Row label={t('beneficiary')} value={getBeneficiaryName(payment)} />
                    <Row label={t('client')} value={getClientName(payment)} />
                    <Row label={t('reference')} value={<span className="font-mono text-xs">{payment.reference}</span>} />
                    <Row label={t('date')} value={formatDate(payment.created_at, 'datetime')} />
                  </div>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
