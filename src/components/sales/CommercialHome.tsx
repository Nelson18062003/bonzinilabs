// ============================================================
// ESPACE COMMERCIAL — « Mon mois ». Le geste qui compte : « Nouveau
// prospect ». En dessous, ce que le commercial doit savoir en un coup
// d'œil : qui relancer, où il en est de ses objectifs, ce que ses clients
// ont payé et expédié ce mois-ci (avion en kg, bateau en m³), ses prospects.
// Les chiffres viennent de commercial_dashboard, limité à SA fiche.
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlarmClock, ChevronRight, LogOut, Plane, Ship, UserCheck, UserPlus, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCommercialDashboard } from '@/hooks/useSales';
import { currentMonth, fmtCbm, fmtCount, fmtKg, fmtXaf, monthLabel, type ObjectiveMetric } from '@/lib/sales';
import { Figure, LoadError, MonthSwitcher, ObjectiveList, SALES_CARD, UnlinkedNotice } from './SalesBits';
import { initialsOf, isUnlinkedError, plural } from './salesHelpers';

/** Dans SON espace, le commercial lit « mes clients », pas « ses clients ». */
const SELF_LABELS: Partial<Record<ObjectiveMetric, string>> = {
  payments_xaf: 'Paiements de mes clients',
};

function greeting(now = new Date()): string {
  const hour = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Africa/Douala' }).formatToParts(now).find((p) => p.type === 'hour')?.value;
  return Number(hour ?? 12) >= 18 ? 'Bonsoir' : 'Bonjour';
}

/** « de mars », « d’octobre ». */
const ofMonth = (name: string) => (/^[aeiouyàâéèêîôû]/i.test(name) ? `d’${name}` : `de ${name}`);

export function CommercialHome() {
  const navigate = useNavigate();
  const { currentUser } = useAdminAuth();
  const thisMonth = useMemo(() => currentMonth(), []);
  const [month, setMonth] = useState(thisMonth);
  const dash = useCommercialDashboard(month);
  const card = dash.data;
  const m = card?.metrics;
  const unlinked = dash.isError && isUnlinkedError(dash.error);
  const archived = !!card && !card.source.is_active;
  const isCurrent = month === thisMonth;
  const monthName = monthLabel(month).split(' ')[0];

  const reached = card ? card.objectives.filter((o) => o.target > 0 && o.actual >= o.target).length : 0;

  return (
    <div>
      <header className="flex items-start justify-between gap-4 px-4 pt-[calc(1.25rem+env(safe-area-inset-top))] sm:px-6">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-muted-foreground">Espace commercial</p>
          <h1 className="mt-0.5 break-words text-[28px] font-bold leading-tight tracking-tight">
            {greeting()}
            {currentUser?.firstName ? ` ${currentUser.firstName}` : ''}
          </h1>
          {card && (
            <p className="mt-1 text-[14px] text-muted-foreground">
              Fiche « {card.source.label} »{archived && <span className="ml-1.5 font-semibold text-amber-700 dark:text-amber-400">· archivée</span>}
            </p>
          )}
        </div>
        <AccountMenu />
      </header>

      <div className="space-y-6 px-4 pt-5 sm:px-6">
        {unlinked ? (
          <UnlinkedNotice message={(dash.error as Error).message} onRetry={() => void dash.refetch()} />
        ) : (
          <>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => navigate('/v/prospects/new')}
                disabled={archived}
                className="flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-primary text-[17px] font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
              >
                <UserPlus className="h-5 w-5" /> Nouveau prospect
              </button>
              {archived && (
                <p className="text-center text-[13px] text-muted-foreground">
                  Votre fiche est archivée : l’ajout de prospects est fermé. Parlez-en au responsable.
                </p>
              )}
            </div>

            {m && m.prospects_due > 0 && (
              <button
                type="button"
                onClick={() => navigate('/v/prospects?filtre=relancer')}
                className="flex w-full items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3.5 text-left ring-1 ring-amber-200 transition-colors hover:bg-amber-100/70 dark:bg-amber-500/10 dark:ring-amber-400/25 dark:hover:bg-amber-500/15"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                  <AlarmClock className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-amber-900 dark:text-amber-200">
                    {plural(m.prospects_due, 'prospect à relancer', 'prospects à relancer')}
                  </span>
                  <span className="block text-[13px] text-amber-800/80 dark:text-amber-300/80">La date de relance est arrivée</span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-amber-800 dark:text-amber-300" />
              </button>
            )}

            <div className="flex justify-center">
              <MonthSwitcher month={month} onChange={setMonth} max={thisMonth} className="w-full sm:w-auto" />
            </div>

            {dash.isLoading ? (
              <HomeSkeleton />
            ) : dash.isError || !card || !m ? (
              <div className={SALES_CARD}>
                <LoadError message="Vos chiffres n’ont pas pu être chargés." onRetry={() => void dash.refetch()} />
              </div>
            ) : (
              <>
                <section className={cn(SALES_CARD, 'p-5 sm:p-6')}>
                  <div className="mb-4 flex items-baseline justify-between gap-3">
                    <h2 className="text-[16px] font-semibold">Objectifs {isCurrent ? 'du mois' : ofMonth(monthName)}</h2>
                    {card.objectives.length > 0 && (
                      <span className="text-[13px] tabular-nums text-muted-foreground">
                        {reached} / {card.objectives.length} atteint{card.objectives.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <ObjectiveList objectives={card.objectives} labels={SELF_LABELS} emptyHint="Votre responsable les fixe chaque mois." />
                </section>

                <section>
                  <h2 className="mb-3 text-[16px] font-semibold">Mes clients · {monthName}</h2>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    <Figure
                      className="col-span-2 md:col-span-3"
                      size="lg"
                      icon={Wallet}
                      label="Paiements de mes clients"
                      value={fmtXaf(m.payments_xaf)}
                      hint={plural(m.payments_count, 'paiement terminé', 'paiements terminés')}
                    />
                    <Figure icon={Plane} label="Fret avion" value={fmtKg(m.air_kg)} hint={plural(m.air_parcels, 'colis', 'colis')} />
                    <Figure icon={Ship} label="Fret bateau" value={fmtCbm(m.sea_cbm)} hint={plural(m.sea_parcels, 'colis', 'colis')} />
                    <Figure
                      className="col-span-2 md:col-span-1"
                      icon={UserCheck}
                      label="Nouveaux clients"
                      value={fmtCount(m.new_clients)}
                      hint={`${plural(m.clients, 'client', 'clients')} au total`}
                      onClick={() => navigate('/v/clients')}
                    />
                  </div>
                </section>

                <section>
                  <h2 className="mb-3 text-[16px] font-semibold">Mes prospects</h2>
                  <div className="grid grid-cols-3 gap-3">
                    <Figure
                      label="Ouverts"
                      value={fmtCount(m.prospects_open)}
                      hint={m.prospects_new > 0 ? `+${fmtCount(m.prospects_new)} en ${monthName}` : undefined}
                      onClick={() => navigate('/v/prospects')}
                    />
                    <Figure
                      label="À relancer"
                      value={fmtCount(m.prospects_due)}
                      tone={m.prospects_due > 0 ? 'warn' : 'default'}
                      onClick={() => navigate('/v/prospects?filtre=relancer')}
                    />
                    <Figure
                      label="Devenus clients"
                      value={fmtCount(m.prospects_won)}
                      hint={`en ${monthName}`}
                      tone={m.prospects_won > 0 ? 'good' : 'default'}
                      onClick={() => navigate('/v/prospects?filtre=clients')}
                    />
                  </div>
                </section>

                <p className="pb-2 text-[12.5px] leading-relaxed text-muted-foreground">
                  Paiements : terminés dans le mois. Colis : enregistrés dans le mois (avion au bureau, bateau à l’entrepôt). Un client compte pour vous
                  quand vous êtes son origine.
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Chargement">
      <div className="h-40 animate-pulse rounded-2xl bg-muted" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="col-span-2 h-28 animate-pulse rounded-2xl bg-muted md:col-span-3" />
        <div className="h-24 animate-pulse rounded-2xl bg-muted" />
        <div className="h-24 animate-pulse rounded-2xl bg-muted" />
        <div className="col-span-2 h-24 animate-pulse rounded-2xl bg-muted md:col-span-1" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    </div>
  );
}

/** L'avatar en haut à droite : qui est connecté, et la sortie. */
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
      navigate('/m/login', { replace: true });
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
        className="flex h-11 w-11 items-center justify-center rounded-full bg-card text-[14px] font-bold ring-1 ring-black/[0.08] transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:ring-white/15"
      >
        {initialsOf(name)}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-[calc(100%+8px)] z-40 w-64 rounded-2xl bg-popover p-1.5 text-popover-foreground shadow-xl ring-1 ring-black/[0.08] dark:ring-white/10">
          <div className="px-3 py-2.5">
            <div className="truncate text-[15px] font-semibold">{name}</div>
            {currentUser?.email && <div className="truncate text-[13px] text-muted-foreground">{currentUser.email}</div>}
            <div className="mt-0.5 text-[13px] text-muted-foreground">Commercial</div>
          </div>
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            role="menuitem"
            onClick={() => void signOut()}
            disabled={leaving}
            className="flex h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[15px] font-semibold text-red-600 transition-colors hover:bg-accent disabled:opacity-50 dark:text-red-400"
          >
            <LogOut className="h-4 w-4" /> {leaving ? 'Déconnexion…' : 'Se déconnecter'}
          </button>
        </div>
      )}
    </div>
  );
}
