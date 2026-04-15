import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useMyDeposits } from '@/hooks/useDeposits';
import { DEPOSIT_METHOD_LABELS } from '@/types/deposit';
import { formatXAF } from '@/lib/formatters';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { enUS } from 'date-fns/locale';
import { Plus, ChevronRight, Loader2, Inbox, Building2, Smartphone, Store, Waves } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const DepositsPage = () => {
  const navigate = useNavigate();
  const { data: deposits, isLoading, error } = useMyDeposits();
  const { t, i18n } = useTranslation('deposits');
  const dateLocale = i18n.language?.startsWith('fr') ? fr : enUS;

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'bank_transfer':
      case 'bank_cash':
        return Building2;
      case 'agency_cash':
        return Store;
      case 'wave':
        return Waves;
      default:
        return Smartphone;
    }
  };

  const mapStatusToType = (status: string): 'pending' | 'processing' | 'success' | 'error' | 'info' => {
    switch (status) {
      case 'validated': return 'success';
      case 'rejected': return 'error';
      case 'cancelled': return 'error';
      case 'pending_correction': return 'info';
      case 'admin_review': return 'processing';
      case 'proof_submitted': return 'info';
      default: return 'pending';
    }
  };

  if (isLoading) {
    return (
      <MobileLayout>
        <PageHeader title={t('title')} subtitle={t('subtitle')} />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MobileLayout>
    );
  }

  if (error) {
    return (
      <MobileLayout>
        <PageHeader title={t('title')} subtitle={t('subtitle')} />
        <div className="px-4 py-12 text-center">
          <p className="text-destructive">{t('loading_error')}</p>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        rightElement={
          <button
            onClick={() => navigate('/deposits/new')}
            className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-purple"
          >
            <Plus className="w-5 h-5" />
          </button>
        }
      />

      <div className="px-4 py-4 space-y-3">
        {deposits && deposits.length > 0 ? (
          deposits.map((deposit, index) => {
            const IconComponent = getMethodIcon(deposit.method);

            return (
              <div
                key={deposit.id}
                onClick={() => navigate(`/deposits/${deposit.id}`)}
                className="card-elevated p-4 cursor-pointer hover:border-primary/30 transition-all animate-slide-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <IconComponent className="w-6 h-6 text-primary" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-foreground">
                          {DEPOSIT_METHOD_LABELS[deposit.method] || deposit.method}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(deposit.created_at), 'dd MMM yyyy, HH:mm', { locale: dateLocale })}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>

                    <div className="flex items-center justify-between">
                      <StatusBadge
                        status={mapStatusToType(deposit.status)}
                        label={deposit.status}
                      />
                      <p className="font-bold text-foreground">
                        {formatXAF(deposit.amount_xaf)} <span className="text-muted-foreground font-normal text-sm">XAF</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Inbox className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">{t('no_deposits')}</p>
            <button
              onClick={() => navigate('/deposits/new')}
              className="mt-4 btn-primary-gradient"
            >
              {t('new_deposit')}
            </button>
          </div>
        )}
      </div>
    </MobileLayout>
  );
};

export default DepositsPage;
