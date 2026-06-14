import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { WalletOperation } from '@/hooks/useWallet';
import { formatNumber } from '@/lib/formatters';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT } from '@/mobile/designKit';

interface OperationsListProps {
  operations: WalletOperation[];
}

const GREEN = '#2E7D52';

export const OperationsList = ({ operations }: OperationsListProps) => {
  const { t } = useTranslation('client');
  const navigate = useNavigate();
  const getOperationType = (op: WalletOperation): 'CREDIT' | 'DEBIT' =>
    op.operation_type === 'deposit' ? 'CREDIT' : 'DEBIT';

  return (
    <section className="animate-slide-up" style={{ animationDelay: '200ms' }}>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className={cn('text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>{t('wallet.recentOperations')}</h2>
        <button onClick={() => navigate('/history')} className="text-[12px] font-bold text-[#5B4CC4] active:opacity-70 dark:text-[#B5AAF0]">
          {t('wallet.viewAll')}
        </button>
      </div>

      <div className="space-y-2.5">
        {operations.slice(0, 5).map((op) => {
          const credit = getOperationType(op) === 'CREDIT';
          const date = parseISO(op.created_at);
          return (
            <div key={op.id} className={cn('flex items-center gap-3 rounded-[18px] p-3.5', SURFACE.card, SURFACE.shadow)}>
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ background: credit ? `${GREEN}1F` : 'rgba(0,0,0,0.05)' }}
              >
                {credit ? (
                  <ArrowDownLeft className="h-5 w-5" style={{ color: GREEN }} />
                ) : (
                  <ArrowUpRight className={cn('h-5 w-5', TEXT.muted)} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn('truncate text-[14px] font-bold', TEXT.strong)}>{op.description || t('wallet.operation')}</p>
                <p className={cn('mt-0.5 text-[12px]', TEXT.muted)}>{format(date, 'd MMM · HH:mm', { locale: fr })}</p>
              </div>
              <div
                className={cn('shrink-0 text-right text-[14px] font-black tabular-nums', !credit && TEXT.strong)}
                style={credit ? { color: GREEN } : undefined}
              >
                {credit ? '+' : '−'} {formatNumber(op.amount_xaf)}
                <div className={cn('text-[10px] font-semibold', TEXT.muted)}>XAF</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
