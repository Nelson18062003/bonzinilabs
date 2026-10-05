// ============================================================
// ESPACE COMMERCIAL — « Prospects ». Ses prospects seulement (la RLS de
// `prospects` le garantit), filtrés par statut, avec « À relancer » en
// tête : les ouverts dont la date de relance est arrivée. Une recherche
// (nom, entreprise, téléphone) ; une ligne ouvre la fiche.
// `?filtre=relancer` ouvre directement les relances (lien de l'accueil).
// ============================================================
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlarmClock, ChevronRight, Plus, Search, UserSearch } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeText } from '@/lib/clientSearch';
import { useCommercialDashboard, useProspects, type Prospect } from '@/hooks/useSales';
import { currentMonth, type ProspectStatus } from '@/lib/sales';
import { TextInput } from '@/mobile/designKit';
import { ListSkeleton, LoadError, PhoneNumber, ProspectStatusPill, SALES_CARD, ScreenHeader, UnlinkedNotice } from './SalesBits';
import { followUpLabel, initialsOf, isDue, isOpenProspect, isUnlinkedError, plural, prospectName } from './salesHelpers';

type Filter = 'open' | 'due' | ProspectStatus | 'all';

/** Les filtres, dans l'ordre des puces ; `param` est la valeur de `?filtre=`. */
const FILTERS: { value: Filter; label: string; param: string | null }[] = [
  { value: 'open', label: 'Ouverts', param: null },
  { value: 'due', label: 'À relancer', param: 'relancer' },
  { value: 'new', label: 'À contacter', param: 'a-contacter' },
  { value: 'contacted', label: 'Contacté', param: 'contacte' },
  { value: 'interested', label: 'Intéressé', param: 'interesse' },
  { value: 'won', label: 'Devenus clients', param: 'clients' },
  { value: 'lost', label: 'Perdus', param: 'perdus' },
  { value: 'all', label: 'Tous', param: 'tous' },
];

function matches(p: Prospect, f: Filter, now: Date): boolean {
  if (f === 'all') return true;
  if (f === 'open') return isOpenProspect(p);
  if (f === 'due') return isDue(p, now);
  return p.status === f;
}

const time = (iso: string | null) => (iso ? new Date(iso).getTime() : Number.POSITIVE_INFINITY);

/** Ouverts : les relances échues d'abord, puis la prochaine relance, puis le plus récent. Clos : le plus récent. Tous : les ouverts, puis les clos. */
function sortFor(f: Filter, list: Prospect[], now: Date): Prospect[] {
  if (f === 'won' || f === 'lost') return list;
  if (f === 'all') return [...sortFor('open', list.filter(isOpenProspect), now), ...list.filter((p) => !isOpenProspect(p))];
  return [...list].sort(
    (a, b) =>
      Number(isDue(b, now)) - Number(isDue(a, now)) ||
      time(a.next_action_at) - time(b.next_action_at) ||
      time(b.status_changed_at) - time(a.status_changed_at),
  );
}

export function CommercialProspects() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const prospects = useProspects();
  // Le tableau de bord du mois dit si le compte est relié à sa fiche (la
  // liste, elle, revient simplement vide) ; il est en cache depuis l'accueil.
  const fiche = useCommercialDashboard(currentMonth());
  const unlinked = fiche.isError && isUnlinkedError(fiche.error);

  const filter: Filter = FILTERS.find((f) => f.param && f.param === params.get('filtre'))?.value ?? 'open';
  const setFilter = (f: Filter) => {
    const param = FILTERS.find((x) => x.value === f)?.param;
    const next = new URLSearchParams(params);
    if (param) next.set('filtre', param);
    else next.delete('filtre');
    setParams(next, { replace: true });
  };

  // Quelques centaines de lignes au plus : on recalcule à chaque rendu, avec l'heure du rendu.
  const now = new Date();
  const all = prospects.data ?? [];
  const counts = {} as Record<Filter, number>;
  for (const f of FILTERS) counts[f.value] = all.filter((p) => matches(p, f.value, now)).length;

  const nq = normalizeText(q);
  const digits = q.replace(/\D/g, '');
  const shown = sortFor(
    filter,
    all.filter(
      (p) =>
        matches(p, filter, now) &&
        (!nq ||
          normalizeText(`${prospectName(p)} ${p.company ?? ''} ${p.city ?? ''}`).includes(nq) ||
          (digits.length >= 3 && `${p.phone_e164} ${p.phone.replace(/\D/g, '')}`.includes(digits))),
    ),
    now,
  );

  const label = FILTERS.find((f) => f.value === filter)?.label ?? '';

  return (
    <div>
      <ScreenHeader
        title="Mes prospects"
        subtitle={prospects.data ? plural(counts.open, 'prospect ouvert', 'prospects ouverts') : '\u00a0'}
        action={
          !unlinked && (
            <button
              type="button"
              onClick={() => navigate('/v/prospects/new')}
              className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-primary px-4 text-[15px] font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Plus className="h-4 w-4" /> Nouveau
            </button>
          )
        }
      />

      <div className="space-y-4 px-4 pt-4 sm:px-6">
        {unlinked ? (
          <UnlinkedNotice message={(fiche.error as Error).message} onRetry={() => void fiche.refetch()} />
        ) : (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <TextInput
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nom, entreprise, téléphone"
                aria-label="Rechercher un prospect"
                inputMode="search"
                autoComplete="off"
                className="h-12 rounded-xl border-input bg-card pl-11 dark:bg-card"
              />
            </div>

            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6" role="tablist" aria-label="Filtrer par statut">
              {FILTERS.map((f) => {
                const active = f.value === filter;
                const n = counts[f.value] ?? 0;
                return (
                  <button
                    key={f.value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setFilter(f.value)}
                    className={cn(
                      'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      active ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground ring-1 ring-black/10 hover:bg-accent dark:ring-white/15',
                      !active && f.value === 'due' && n > 0 && 'text-amber-800 ring-amber-300 dark:text-amber-300 dark:ring-amber-400/30',
                    )}
                  >
                    {f.value === 'due' && <AlarmClock className="h-4 w-4" />}
                    {f.label}
                    {prospects.data && n > 0 && <span className={cn('tabular-nums', active ? 'opacity-80' : 'text-muted-foreground')}>{n}</span>}
                  </button>
                );
              })}
            </div>

            <div className={cn('overflow-hidden', SALES_CARD)}>
              {prospects.isLoading ? (
                <ListSkeleton rows={5} />
              ) : prospects.isError ? (
                <LoadError message="La liste n’a pas pu être chargée." onRetry={() => void prospects.refetch()} />
              ) : shown.length === 0 ? (
                <Empty filter={filter} label={label} searching={!!q.trim()} total={all.length} onNew={() => navigate('/v/prospects/new')} />
              ) : (
                <ul className="divide-y divide-border/60">
                  {shown.map((p) => (
                    <li key={p.id}>
                      <ProspectRow p={p} now={now} onClick={() => navigate(`/v/prospects/${p.id}`)} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ProspectRow({ p, now, onClick }: { p: Prospect; now: Date; onClick: () => void }) {
  const name = prospectName(p);
  const due = isDue(p, now);
  const where = [p.company, p.city].filter(Boolean).join(' · ');
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/40 active:bg-muted/60 sm:px-5">
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[14px] font-bold',
          p.status === 'won' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-muted text-foreground',
        )}
        aria-hidden
      >
        {initialsOf(name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">{name}</span>
        {where && <span className="block truncate text-[13px] text-muted-foreground">{where}</span>}
        <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] tabular-nums">
          <PhoneNumber e164={p.phone_e164} className="text-muted-foreground" />
          {isOpenProspect(p) && p.next_action_at && (
            <span className={cn('inline-flex items-center gap-1', due ? 'font-semibold text-amber-700 dark:text-amber-400' : 'text-muted-foreground')}>
              <AlarmClock className="h-3.5 w-3.5" />
              Relance {followUpLabel(p.next_action_at, now).toLowerCase()}
            </span>
          )}
        </span>
      </span>
      <ProspectStatusPill status={p.status} />
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function Empty({ filter, label, searching, total, onNew }: { filter: Filter; label: string; searching: boolean; total: number; onNew: () => void }) {
  const text = searching
    ? 'Aucun prospect ne correspond à cette recherche.'
    : total === 0
      ? 'Pas encore de prospect. Ajoutez le premier : il apparaîtra ici avec sa date de relance.'
      : filter === 'due'
        ? 'Rien à relancer pour l’instant.'
        : `Aucun prospect « ${label} ».`;
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <UserSearch className="h-6 w-6 text-muted-foreground" />
      <p className="max-w-xs text-[14px] text-muted-foreground">{text}</p>
      {total === 0 && !searching && (
        <button type="button" onClick={onNew} className="mt-1 inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-[14px] font-semibold text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Nouveau prospect
        </button>
      )}
    </div>
  );
}
