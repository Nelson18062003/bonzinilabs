// ============================================================
// APP CLIENT — DepositsPage (liste des dépôts) · refonte « Direction A ».
// Carte « Faire un dépôt » (icône argent entrant) + solde · FILTRES statut
// (Tous/À traiter/En cours/Terminés + compteur) · cartes avec barre
// d'AVANCEMENT du cycle de vie (rouge=preuve à ajouter · lilas=Bonzini
// vérifie · vert=crédité) · les « à traiter » remontent en tête. Référence
// affichée. Logique 100% PRÉSERVÉE : useMyDeposits, nav.
// ============================================================
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowDownToLine, ChevronRight, ArrowRight, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { DepositMethodLogo } from '@/mobile/components/deposits/DepositLogos';
import { useMyDeposits } from '@/hooks/useDeposits';
import { useMyWallet } from '@/hooks/useWallet';
import { formatNumber } from '@/lib/formatters';
import { SURFACE, TEXT, PrimaryPill } from '@/mobile/designKit';
import {
  depositLifecycle,
  depositStatusLabel,
  matchesDepositFilterTab,
  LIFECYCLE_COLOR,
  type DepositFilterTab,
} from '@/lib/depositLifecycle';
import type { Deposit } from '@/types/deposit';

const TABS: { key: DepositFilterTab; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'todo', label: 'À traiter' },
  { key: 'progress', label: 'En cours' },
  { key: 'done', label: 'Terminés' },
];

function statusHint(d: Deposit): string {
  switch (d.status) {
    case 'created':
    case 'awaiting_proof':
      return 'Preuve de versement manquante';
    case 'pending_correction':
      return d.admin_comment || 'À corriger';
    default:
      return '';
  }
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

const DepositsPage = () => {
  const { t } = useTranslation('deposits');
  const navigate = useNavigate();
  const { data: deposits, isLoading } = useMyDeposits();
  const { data: wallet } = useMyWallet();

  const [tab, setTab] = useState<DepositFilterTab>('all');
  const [search, setSearch] = useState('');

  const todoCount = useMemo(
    () => (deposits ?? []).filter((d) => depositLifecycle(d.status).kind === 'todo').length,
    [deposits],
  );

  // Filtre + recherche + tri (à-traiter en tête, puis récent).
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (deposits ?? [])
      .filter((d) => matchesDepositFilterTab(d.status, tab))
      .filter((d) => {
        if (!q) return true;
        return [d.reference, t(`method.${d.method}`, d.method), d.bank_name, d.agency_name]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q));
      })
      .sort((a, b) => {
        const at = depositLifecycle(a.status).kind === 'todo' ? 0 : 1;
        const bt = depositLifecycle(b.status).kind === 'todo' ? 0 : 1;
        if (at !== bt) return at - bt;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [deposits, tab, search, t]);

  return (
    <MobileLayout>
      <div className={cn('min-h-[100dvh] space-y-5 px-4 pb-6 pt-6', SURFACE.canvas)}>
        {/* En-tête */}
        <div className="px-1">
          <h1 className={cn('text-[26px] font-black leading-tight', TEXT.strong)}>{t('title')}</h1>
          <p className={cn('mt-0.5 text-[13px]', TEXT.muted)}>{t('subtitle')}</p>
        </div>

        {/* Action principale — argent entrant + solde */}
        <button
          onClick={() => navigate('/deposits/new')}
          className={cn('flex w-full items-center gap-4 rounded-[24px] p-5 text-left', SURFACE.card, SURFACE.shadow)}
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#1C1B22] dark:bg-[#F2F1F7]">
            <ArrowDownToLine className="h-[26px] w-[26px] text-white dark:text-[#1B1A24]" strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className={cn('text-[17px] font-black', TEXT.strong)}>{t('newDeposit')}</div>
            {wallet ? (
              <div className={cn('mt-0.5 text-[12px] tabular-nums', TEXT.muted)}>
                Solde · <span className={cn('font-bold', TEXT.strong)}>{formatNumber(wallet.balance_xaf)} XAF</span>
              </div>
            ) : null}
          </div>
          <ArrowRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
        </button>

        {/* Recherche */}
        <label className={cn('flex items-center gap-2.5 rounded-full px-4 py-3', SURFACE.card, SURFACE.shadow)}>
          <Search className={cn('h-[18px] w-[18px] shrink-0', TEXT.muted)} />
          {/* input nu volontaire 16px (anti auto-zoom iOS) */}
          {/* eslint-disable-next-line no-restricted-syntax */}
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder', { defaultValue: 'Rechercher (référence, méthode…)' })}
            className={cn('min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-[#9B98AD]', TEXT.strong)}
          />
        </label>

        {/* Filtres statut */}
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
        </div>

        {/* Liste */}
        {isLoading ? (
          <div className="space-y-3 pt-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className={cn('h-[104px] animate-pulse rounded-[22px]', SURFACE.card, SURFACE.shadow)} />
            ))}
          </div>
        ) : !deposits || deposits.length === 0 ? (
          <div className={cn('mt-4 rounded-[24px] p-10 text-center', SURFACE.card, SURFACE.shadow)}>
            <div className={cn('mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full', SURFACE.holder)}>
              <ArrowDownToLine className="h-7 w-7" />
            </div>
            <p className={cn('text-[15px]', TEXT.muted)}>{t('noDeposits')}</p>
            <div className="mt-5 flex justify-center">
              <PrimaryPill onClick={() => navigate('/deposits/new')}>
                <ArrowDownToLine className="h-[16px] w-[16px]" /> {t('newDeposit')}
              </PrimaryPill>
            </div>
          </div>
        ) : visible.length === 0 ? (
          <div className={cn('mt-2 rounded-[22px] p-8 text-center', SURFACE.card, SURFACE.shadow)}>
            <p className={cn('text-[14px]', TEXT.muted)}>Aucun dépôt pour ce filtre.</p>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            {visible.map((d) => {
              const lc = depositLifecycle(d.status);
              const color = LIFECYCLE_COLOR[lc.kind];
              const todo = lc.kind === 'todo';
              return (
                <button
                  key={d.id}
                  onClick={() => navigate(`/deposits/${d.id}`)}
                  className={cn(
                    'w-full rounded-[22px] p-4 text-left transition active:scale-[0.99]',
                    todo ? 'bg-[#FBE7E7] dark:bg-[#3A2526]' : cn(SURFACE.card, SURFACE.shadow),
                  )}
                >
                  <div className="flex items-center gap-3">
                    <DepositMethodLogo method={d.method} bankName={d.bank_name} size={44} radius={22} />
                    <div className="min-w-0 flex-1">
                      <div className={cn('truncate text-[16px] font-bold', TEXT.strong)}>
                        {t(`method.${d.method}`, d.method)}
                      </div>
                      {todo ? (
                        <div className="mt-0.5 truncate text-[12px] font-semibold" style={{ color }}>{statusHint(d)}</div>
                      ) : (
                        <div className={cn('mt-0.5 text-[13px] font-bold tabular-nums', TEXT.strong)}>
                          +{formatNumber(d.amount_xaf)} <span className={cn('text-[11px] font-semibold', TEXT.muted)}>XAF</span>
                        </div>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ color, background: `${color}1F` }}>
                      {depositStatusLabel(d.status)}
                    </span>
                  </div>

                  {todo && (
                    <div className="mt-3 flex items-baseline gap-1.5">
                      <span className={cn('text-[20px] font-black tabular-nums', TEXT.strong)}>{formatNumber(d.amount_xaf)}</span>
                      <span className="text-[12px] font-bold" style={{ color }}>XAF</span>
                    </div>
                  )}

                  <div className="mt-3"><Progress step={lc.step} color={color} /></div>

                  {todo ? (
                    <div
                      className={cn('mt-3 flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-[13px] font-bold', 'bg-[#1C1B22] text-white dark:bg-[#F2F1F7] dark:text-[#1B1A24]')}
                    >
                      Ajouter la preuve <ArrowRight className="h-4 w-4" />
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center justify-between">
                      <span className={cn('truncate text-[12px]', TEXT.muted)}>
                        {d.reference} · {format(new Date(d.created_at), 'd MMM yyyy', { locale: fr })}
                      </span>
                      <ChevronRight className={cn('h-4 w-4 shrink-0', TEXT.muted)} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </MobileLayout>
  );
};

export default DepositsPage;
