// ============================================================
// ESPACE COMMERCIAL — « Mon mois ». Le geste qui compte : « Nouveau
// prospect ». Puis ce qui demande d'agir (prospects à relancer, fiches « À
// vérifier »), le mois choisi, et ce que le commercial doit voir d'un coup
// d'œil, carte par carte (HomeSections.tsx) : les paiements et dépôts de
// ses clients et leur courbe sur 6 mois, ses objectifs et le rythme à
// tenir, ses clients, ses prospects, le fret de ses clients (avion, vols,
// bateau). Chaque chiffre se compare au mois d'avant.
//
// Deux lectures, limitées à SA fiche : commercial_dashboard (sa fiche, ses
// objectifs, ses prospects ouverts et à relancer) et sales_series (les 6
// mois qui finissent au mois choisi). Si sales_series ne répond pas, les
// chiffres du mois viennent de commercial_dashboard : rien ne disparaît,
// seules les tendances et les courbes manquent (HomeData.ts).
// ============================================================
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlarmClock, ChevronRight, KeyRound, LogOut, ShieldQuestion, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCommercialDashboard, useProspects, useSalesSeries } from '@/hooks/useSales';
import { currentMonth } from '@/lib/sales';
import { LoadError, MonthSwitcher, SALES_CARD, UnlinkedNotice } from './SalesBits';
import { btn } from './uiClasses';
import { initialsOf, isUnlinkedError, plural } from './salesHelpers';
import { figuresFromMetrics, figuresFromSeries, homeRange, isQuiet, monthClock, previousFigures } from './HomeData';
import { ClientsCard, FreightCard, MoneyCard, ObjectivesCard, ProspectsCard, QuietCard, type HomeView } from './HomeSections';

function greeting(now = new Date()): string {
  const hour = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Africa/Douala' }).formatToParts(now).find((p) => p.type === 'hour')?.value;
  return Number(hour ?? 12) >= 18 ? 'Bonsoir' : 'Bonjour';
}

/**
 * La dernière valeur reçue : en changeant de mois, l'écran garde l'image
 * précédente, estompée, le temps de la réponse — pas de squelette, pas de saut.
 */
function useLastDefined<T>(value: T | undefined): T | undefined {
  const [last, setLast] = useState(value);
  useEffect(() => {
    if (value !== undefined) setLast(value);
  }, [value]);
  return value ?? last;
}

export function CommercialHome() {
  const navigate = useNavigate();
  const { currentUser } = useAdminAuth();
  const thisMonth = useMemo(() => currentMonth(), []);
  const [month, setMonth] = useState(thisMonth);
  const dash = useCommercialDashboard(month);
  const unlinked = dash.isError && isUnlinkedError(dash.error);
  const range = useMemo(() => homeRange(month), [month]);
  const seriesQ = useSalesSeries(range, !unlinked);
  const prospects = useProspects();

  const card = useLastDefined(dash.data);
  const lastSeries = useLastDefined(seriesQ.data);
  // Une série d'un autre mois n'est gardée que tant que la nouvelle charge (une erreur l'efface).
  const series = seriesQ.data ?? (seriesQ.isError ? undefined : lastSeries);
  const stale = (!dash.data && !!card) || (!seriesQ.data && !!series);

  const m = card?.metrics;
  const archived = !!card && !card.source.is_active;
  const toVerify = useMemo(() => (prospects.data ?? []).filter((p) => p.status === 'to_verify').length, [prospects.data]);

  const seriesError = seriesQ.isError;
  const refetchSeries = seriesQ.refetch;
  const view: HomeView | null = useMemo(() => {
    const figures = figuresFromSeries(series, month) ?? figuresFromMetrics(m);
    if (!figures) return null;
    return {
      month,
      clock: monthClock(month),
      figures,
      previous: previousFigures(series, month),
      series: series ?? null,
      seriesState: series ? 'ready' : seriesError ? 'error' : 'loading',
      onRetrySeries: () => void refetchSeries(),
    };
  }, [series, month, m, seriesError, refetchSeries]);

  return (
    <div>
      <header className="s-enter flex items-start justify-between gap-4 px-4 pt-[calc(1.25rem+env(safe-area-inset-top))] sm:px-6">
        <div className="min-w-0">
          <p className="text-[13px] font-medium s-ink-3">Espace commercial</p>
          <h1 className="mt-1 break-words text-[30px] font-semibold leading-[1.1] tracking-[-0.025em] s-ink">
            {greeting()}
            {currentUser?.firstName ? ` ${currentUser.firstName}` : ''}
          </h1>
          {card && (
            <p className="mt-1.5 text-[15px] s-ink-2">
              Fiche « {card.source.label} »{archived && <span className="ml-1.5 font-semibold s-warn">· archivée</span>}
            </p>
          )}
        </div>
        <AccountMenu />
      </header>

      <div className="space-y-4 px-4 pt-5 sm:px-6">
        {unlinked ? (
          <UnlinkedNotice message={(dash.error as Error).message} onRetry={() => void dash.refetch()} />
        ) : (
          <>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => navigate('/v/prospects/new')}
                disabled={archived}
                className={btn('ink', 'xl', 's-enter w-full gap-2.5')}
                style={{ animationDelay: '40ms' }}
              >
                <UserPlus className="h-5 w-5" /> Nouveau prospect
              </button>
              {archived && (
                <p className="text-center text-[13px] s-ink-2">
                  Votre fiche est archivée : l’ajout de prospects est fermé. Parlez-en au responsable.
                </p>
              )}
            </div>

            {m && m.prospects_due > 0 && (
              <ActionNote
                tone="warn"
                icon={<AlarmClock className="h-5 w-5 s-warn" />}
                title={plural(m.prospects_due, 'prospect à relancer', 'prospects à relancer')}
                hint="La date de relance est arrivée"
                onClick={() => navigate('/v/prospects?filtre=relancer')}
              />
            )}
            {toVerify > 0 && (
              <ActionNote
                tone="accent"
                icon={<ShieldQuestion className="h-5 w-5 s-accent" />}
                title={plural(toVerify, 'fiche à vérifier', 'fiches à vérifier')}
                hint={toVerify > 1 ? 'Leur numéro est déjà celui d’un client\u00a0: la direction tranche' : 'Son numéro est déjà celui d’un client\u00a0: la direction tranche'}
                onClick={() => navigate('/v/prospects?filtre=a-verifier')}
              />
            )}

            <div className="flex justify-center pt-2">
              <MonthSwitcher month={month} onChange={setMonth} max={thisMonth} className="w-full sm:w-auto" />
            </div>

            {!card && dash.isLoading ? (
              <HomeSkeleton />
            ) : !card || !view ? (
              <div className={SALES_CARD}>
                <LoadError message="Vos chiffres n’ont pas pu être chargés." onRetry={() => void dash.refetch()} />
              </div>
            ) : (
              <div className={cn('space-y-4 transition-opacity duration-200', stale && 'pointer-events-none opacity-55')} aria-busy={stale || undefined}>
                {isQuiet(view.series) && !stale ? (
                  <>
                    <ObjectivesCard month={month} objectives={card.objectives} clock={view.clock} delay={40} />
                    <QuietCard delay={80} />
                  </>
                ) : (
                  <>
                    <MoneyCard view={view} delay={40} />
                    <ObjectivesCard month={month} objectives={card.objectives} clock={view.clock} delay={80} />
                    <ClientsCard view={view} delay={120} />
                    <ProspectsCard view={view} delay={160} />
                    <FreightCard view={view} delay={200} />
                  </>
                )}
                <p className="px-1 pb-2 pt-1 text-[13px] leading-relaxed s-ink-3">
                  Paiements : terminés dans le mois. Dépôts : validés. Colis : reçus dans le mois (avion au bureau de Guangzhou, bateau à l’entrepôt). Vols : ceux
                  qui ont emporté au moins un colis de vos clients. Un client compte pour vous quand vous êtes son origine.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Ce qui demande d'agir : une ligne teintée, touchée elle ouvre la liste filtrée. */
function ActionNote({ tone, icon, title, hint, onClick }: { tone: 'warn' | 'accent'; icon: ReactNode; title: string; hint: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-tone={tone}
      className="s-note s-enter flex w-full items-center gap-3 rounded-[16px] px-4 py-3.5 text-left transition-transform active:scale-[0.99]"
      style={{ animationDelay: '80ms' }}
    >
      <span
        className="s-surface flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        style={{ boxShadow: `0 0 0 1px hsl(var(${tone === 'warn' ? '--s-orange' : '--s-accent'}) / 0.2)` }}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-semibold s-ink">{title}</span>
        <span className="block text-[13px] leading-snug s-ink-2">{hint}</span>
      </span>
      <ChevronRight className={cn('h-5 w-5 shrink-0', tone === 'warn' ? 's-warn' : 's-accent')} />
    </button>
  );
}

function HomeSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Chargement">
      <div className={cn(SALES_CARD, 'p-4')}>
        <div className="s-skeleton h-5 w-40 animate-pulse rounded-md bg-muted" />
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <div className="s-skeleton h-[118px] animate-pulse rounded-[14px] bg-muted" />
          <div className="s-skeleton h-[118px] animate-pulse rounded-[14px] bg-muted" />
        </div>
        <div className="s-skeleton mt-4 h-[200px] animate-pulse rounded-[14px] bg-muted" />
      </div>
      <div className="s-skeleton h-56 animate-pulse rounded-[18px] bg-muted" />
      <div className="s-skeleton h-72 animate-pulse rounded-[18px] bg-muted" />
    </div>
  );
}

/** L'avatar en haut à droite : qui est connecté, son mot de passe, et la sortie. */
function AccountMenu() {
  const navigate = useNavigate();
  const { currentUser, logout } = useAdminAuth();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const name = [currentUser?.firstName, currentUser?.lastName].filter(Boolean).join(' ') || currentUser?.email || '';

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const signOut = async () => {
    setLeaving(true);
    try {
      await logout();
    } finally {
      navigate('/v/login', { replace: true });
    }
  };

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Mon compte"
        className={btn('quiet', 'icon', 'text-[14px] font-semibold')}
      >
        {initialsOf(name)}
      </button>
      {open && (
        <div
          role="menu"
          className="s-overlay s-pop absolute right-0 top-[calc(100%+8px)] z-40 w-72 origin-top-right rounded-2xl p-1.5 text-popover-foreground"
        >
          <div className="px-3 py-2.5">
            <div className="truncate text-[15px] font-semibold">{name}</div>
            {currentUser?.email && <div className="truncate text-[13px] text-muted-foreground">{currentUser.email}</div>}
            <div className="mt-0.5 text-[13px] text-muted-foreground">Commercial</div>
          </div>
          <div className="s-rule my-1 h-px bg-border" />
          <button
            type="button"
            role="menuitem"
            onClick={() => navigate('/v/password')}
            className="s-row flex h-11 w-full items-center gap-2.5 whitespace-nowrap rounded-xl px-3 text-left text-[15px] font-semibold transition-colors hover:bg-accent"
          >
            <KeyRound className="h-4 w-4" /> Changer mon mot de passe
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => void signOut()}
            disabled={leaving}
            className="s-row flex h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[15px] font-semibold text-red-600 transition-colors hover:bg-accent disabled:opacity-50 dark:text-red-400"
          >
            <LogOut className="h-4 w-4" /> {leaving ? 'Déconnexion…' : 'Se déconnecter'}
          </button>
        </div>
      )}
    </div>
  );
}
