// ============================================================
// APP CLIENT — PaymentsPage (liste des paiements) · STRUCTURE v8.
// Repensée : carte « Payer un fournisseur » (icône d'envoi) + taux du
// jour · barre de RECHERCHE (fournisseur / référence) · FILTRES statut
// (Tous/À traiter/En cours/Terminés) + période · cartes avec barre
// d'AVANCEMENT du cycle de vie (rouge=à traiter · lilas=en cours ·
// vert=payé) · les « à traiter » remontent en tête. Référence affichée
// (pas de numérotation). Logique 100% PRÉSERVÉE : useMyPayments, nav.
// ============================================================
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, isAfter, startOfMonth, subWeeks } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Send, Search, ChevronDown, ChevronRight, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PaymentMethodLogo } from '@/mobile/components/payments/PaymentMethodLogo';
import { useMyPayments, type Payment } from '@/hooks/usePayments';
import { useClientRates } from '@/hooks/useDailyRates';
import { formatCurrencyRMB, formatNumber } from '@/lib/formatters';
import { SURFACE, TEXT, PrimaryPill } from '@/mobile/designKit';
import {
  paymentLifecycle,
  matchesFilterTab,
  LIFECYCLE_COLOR,
  type PaymentFilterTab,
  type LifecycleKind,
} from '@/lib/paymentLifecycle';

type Period = 'all' | 'month' | 'week';
const PERIOD_LABEL: Record<Period, string> = { all: 'Tout', month: 'Ce mois', week: 'Cette semaine' };
const PERIOD_ORDER: Period[] = ['all', 'month', 'week'];

const TABS: { key: PaymentFilterTab; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'todo', label: 'À traiter' },
  { key: 'progress', label: 'En cours' },
  { key: 'done', label: 'Terminés' },
];

function statusLabel(status: string, kind: LifecycleKind): string {
  if (kind === 'done') return 'Payé';
  if (kind === 'failed') return status === 'rejected' ? 'Refusé' : 'Annulé';
  if (kind === 'todo') return status === 'cash_pending' ? 'À présenter' : 'À compléter';
  return 'En cours';
}

function statusHint(payment: Payment, kind: LifecycleKind): string {
  if (payment.status === 'waiting_beneficiary_info') return 'Coordonnées du bénéficiaire manquantes';
  if (payment.status === 'cash_pending') return 'QR à présenter au bureau';
  if (kind === 'progress') return 'Bonzini règle votre fournisseur';
  if (kind === 'done') return `Payé le ${format(new Date(payment.updated_at ?? payment.created_at), 'd MMM', { locale: fr })}`;
  if (payment.status === 'rejected') return 'Paiement refusé';
  if (payment.status === 'cancelled_by_admin') return 'Paiement annulé';
  return '';
}

function Progress({ step, color }: { step: number; color: string }) {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={cn('h-1.5 flex-1 rounded-full', i > step && 'bg-black/[0.08] dark:bg-white/[0.10]')}
          style={i <= step ? { background: color } : undefined}
        />
      ))}
    </div>
  );
}

const PaymentsPage = () => {
  const { t } = useTranslation('payments');
  const navigate = useNavigate();
  const { data: payments, isLoading } = useMyPayments();
  const { data: ratesData } = useClientRates();

  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<PaymentFilterTab>('all');
  const [period, setPeriod] = useState<Period>('all');

  const dayRate = ratesData?.activeRate?.rate_cash;

  // Compteurs (badges d'onglet) sur l'ensemble.
  const todoCount = useMemo(
    () => (payments ?? []).filter((p) => paymentLifecycle(p.status).kind === 'todo').length,
    [payments],
  );

  // Filtre + recherche + tri (à-traiter en tête, puis récent).
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const weekAgo = subWeeks(new Date(), 1);
    const monthStart = startOfMonth(new Date());
    return (payments ?? [])
      .filter((p) => matchesFilterTab(p.status, tab))
      .filter((p) => {
        if (period === 'all') return true;
        const d = new Date(p.created_at);
        return isAfter(d, period === 'week' ? weekAgo : monthStart);
      })
      .filter((p) => {
        if (!q) return true;
        return (
          (p.beneficiary_name ?? '').toLowerCase().includes(q) ||
          (p.reference ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const at = paymentLifecycle(a.status).kind === 'todo' ? 0 : 1;
        const bt = paymentLifecycle(b.status).kind === 'todo' ? 0 : 1;
        if (at !== bt) return at - bt;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [payments, tab, period, search]);

  const cyclePeriod = () =>
    setPeriod((p) => PERIOD_ORDER[(PERIOD_ORDER.indexOf(p) + 1) % PERIOD_ORDER.length]);

  return (
    <MobileLayout>
      <div className={cn('min-h-[100dvh] space-y-4 px-4 pb-6 pt-5', SURFACE.canvas)}>
        {/* En-tête */}
        <div className="px-1">
          <h1 className={cn('text-[26px] font-black leading-tight', TEXT.strong)}>{t('title')}</h1>
          <p className={cn('mt-0.5 text-[13px]', TEXT.muted)}>{t('subtitle')}</p>
        </div>

        {/* Action principale — icône d'envoi + taux du jour */}
        <button
          onClick={() => navigate('/payments/new')}
          className={cn('flex w-full items-center gap-4 rounded-[24px] p-5 text-left', SURFACE.card, SURFACE.shadow)}
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#1C1B22] dark:bg-[#F2F1F7]">
            <Send className="h-[26px] w-[26px] text-white dark:text-[#1B1A24]" strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className={cn('text-[17px] font-black', TEXT.strong)}>{t('newPayment')}</div>
            {dayRate ? (
              <div className={cn('mt-0.5 text-[12px]', TEXT.muted)}>
                Taux du jour · <span className="font-bold text-[#E8932A]">{formatNumber(dayRate)}</span> ¥ / 1 000 000 XAF
              </div>
            ) : null}
          </div>
          <ArrowRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
        </button>

        {/* Recherche */}
        <label className={cn('flex items-center gap-2.5 rounded-full px-4 py-3', SURFACE.card, SURFACE.shadow)}>
          <Search className={cn('h-[18px] w-[18px] shrink-0', TEXT.muted)} />
          {/* Pilule de recherche douce : input nu volontaire à 16px (≥16 → pas d'auto-zoom iOS). */}
          {/* eslint-disable-next-line no-restricted-syntax */}
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un fournisseur, une référence…"
            className={cn('min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-[#9B98AD]', TEXT.strong)}
          />
        </label>

        {/* Filtres : statut + période */}
        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((tb) => {
            const active = tab === tb.key;
            return (
              <button
                key={tb.key}
                onClick={() => setTab(tb.key)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-bold transition-colors',
                  active ? 'bg-[#8B5CF6] text-white' : cn(SURFACE.card, SURFACE.shadow, TEXT.muted),
                )}
              >
                {tb.label}
                {tb.key === 'todo' && todoCount > 0 ? (
                  <span className="rounded-full bg-[#C0504D] px-1.5 text-[10px] text-white">{todoCount}</span>
                ) : null}
              </button>
            );
          })}
          <div className="mx-1 h-5 w-px shrink-0 bg-black/[0.08] dark:bg-white/[0.10]" />
          <button
            onClick={cyclePeriod}
            className={cn('flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-bold', SURFACE.card, SURFACE.shadow, TEXT.muted)}
          >
            {PERIOD_LABEL[period]} <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Liste */}
        {isLoading ? (
          <div className="space-y-3 pt-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className={cn('h-[112px] animate-pulse rounded-[22px]', SURFACE.card, SURFACE.shadow)} />
            ))}
          </div>
        ) : !payments || payments.length === 0 ? (
          <div className={cn('mt-4 rounded-[24px] p-10 text-center', SURFACE.card, SURFACE.shadow)}>
            <div className={cn('mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full', SURFACE.holder)}>
              <Send className="h-7 w-7" />
            </div>
            <p className={cn('text-[15px]', TEXT.muted)}>{t('noPayments')}</p>
            <div className="mt-5 flex justify-center">
              <PrimaryPill onClick={() => navigate('/payments/new')}>
                <Send className="h-[16px] w-[16px]" /> {t('newPayment')}
              </PrimaryPill>
            </div>
          </div>
        ) : visible.length === 0 ? (
          <div className={cn('mt-2 rounded-[22px] p-8 text-center', SURFACE.card, SURFACE.shadow)}>
            <p className={cn('text-[14px]', TEXT.muted)}>Aucun paiement pour ce filtre.</p>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            {visible.map((p) => {
              const lc = paymentLifecycle(p.status);
              const color = LIFECYCLE_COLOR[lc.kind];
              const todo = lc.kind === 'todo';
              const name = p.beneficiary_name || 'Bénéficiaire à compléter';
              return (
                <button
                  key={p.id}
                  onClick={() => navigate(`/payments/${p.id}`)}
                  className={cn(
                    'w-full rounded-[22px] p-4 text-left transition active:scale-[0.99]',
                    todo ? 'bg-[#FBE7E7] dark:bg-[#3A2526]' : cn(SURFACE.card, SURFACE.shadow),
                  )}
                >
                  <div className="flex items-center gap-3">
                    <PaymentMethodLogo method={p.method as 'alipay' | 'wechat' | 'bank_transfer' | 'cash'} size={44} />
                    <div className="min-w-0 flex-1">
                      <div className={cn('truncate text-[16px] font-bold', TEXT.strong)}>{name}</div>
                      {todo ? (
                        <div className="mt-0.5 truncate text-[12px] font-semibold" style={{ color }}>{statusHint(p, lc.kind)}</div>
                      ) : (
                        <div className={cn('mt-0.5 truncate text-[12px] tabular-nums', TEXT.muted)}>
                          {formatCurrencyRMB(p.amount_rmb)} · −{formatNumber(p.amount_xaf)} XAF
                        </div>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ color, background: `${color}1F` }}>
                      {statusLabel(p.status, lc.kind)}
                    </span>
                  </div>
                  <div className="mt-3.5"><Progress step={lc.step} color={color} /></div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className={cn('truncate text-[12px]', todo ? 'font-semibold' : TEXT.muted)} style={todo ? { color } : undefined}>
                      {p.reference} · {todo ? 'à compléter' : format(new Date(p.created_at), 'd MMM yyyy', { locale: fr })}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0" style={{ color: todo ? color : undefined }} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </MobileLayout>
  );
};

export default PaymentsPage;
