// ============================================================
// ESPACE COMMERCIAL — « Prospects ». Ses prospects seulement (la RLS de
// `prospects` le garantit), filtrés par statut, avec « À relancer » en
// tête : les ouverts dont la date de relance est arrivée. Une recherche
// (nom, entreprise, ville, email, l'un QUELCONQUE de ses numéros) ; une
// ligne ouvre la fiche. `?filtre=relancer` ouvre directement les relances
// (lien de l'accueil). Un prospect en cours de saisie (brouillon gardé dans
// le téléphone, sous SON compte) se reprend d'ici. Une fiche OUVERTE à
// laquelle il manque quelque chose (nom, sexe, ville, « ses plus gros
// problèmes ») porte « À compléter ».
// Lignes à la RECORDS TABLE, filtres à la FILTER TABLE (beautifului.dev).
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlarmClock, PenLine, Plus, UserSearch } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeText } from '@/lib/clientSearch';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCommercialDashboard, useProspects, type Prospect } from '@/hooks/useSales';
import { currentMonth, type ProspectStatus } from '@/lib/sales';
import { ListSkeleton, LoadError, PhoneNumber, SALES_CARD, ScreenHeader, UnlinkedNotice } from './SalesBits';
import { SearchField, StatusTag } from './SalesUi';
import { btn } from './uiClasses';
import { isDraftEmpty, loadDraft, missingOf } from './prospectDraft';
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

/** Le texte et les chiffres où chercher : nom, entreprise, ville, email ; tous ses numéros. */
function haystack(p: Prospect): { text: string; digits: string } {
  const numbers = [p.phone_e164, p.phone, ...(p.phones ?? []).map((x) => x.phone_e164)];
  return {
    text: normalizeText(`${prospectName(p)} ${p.company ?? ''} ${p.city ?? ''} ${p.email ?? ''}`),
    digits: numbers.map((n) => (n ?? '').replace(/\D/g, '')).join(' '),
  };
}

export function CommercialProspects() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  // Le brouillon de CE compte seulement (un collègue sur le même téléphone ne voit pas le sien).
  const owner = useAdminAuth().currentUser?.id ?? null;
  const [draft] = useState(() => loadDraft(owner));
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
    all.filter((p) => {
      if (!matches(p, filter, now)) return false;
      if (!nq) return true;
      const h = haystack(p);
      return h.text.includes(nq) || (digits.length >= 3 && h.digits.includes(digits));
    }),
    now,
  );

  const label = FILTERS.find((f) => f.value === filter)?.label ?? '';

  // Le filtre choisi reste en vue dans la rangée qui défile (« Devenus clients » ouvert par un lien).
  const filtersRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    filtersRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
  }, [filter]);
  const draftName = (() => {
    if (!draft || isDraftEmpty(draft.draft)) return null;
    return [draft.draft.firstName, draft.draft.lastName].map((x) => x.trim()).filter(Boolean).join(' ') || 'sans nom';
  })();

  return (
    <div>
      <ScreenHeader
        title="Mes prospects"
        subtitle={prospects.data ? plural(counts.open, 'prospect ouvert', 'prospects ouverts') : '\u00a0'}
        action={
          !unlinked && (
            <button type="button" onClick={() => navigate('/v/prospects/new')} className={btn('ink', 'md', 'gap-1.5 rounded-full pl-3.5')}>
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
            {draftName && (
              <button
                type="button"
                onClick={() => navigate('/v/prospects/new')}
                data-tone="accent"
                className="s-note s-enter flex w-full items-center gap-3 rounded-[16px] px-4 py-3 text-left"
              >
                <PenLine className="h-5 w-5 shrink-0 s-accent" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold s-ink">Saisie en cours : {draftName}</span>
                  <span className="block text-[13px] s-ink-2">Pas encore enregistré. Touchez pour reprendre.</span>
                </span>
                <span className="text-[14px] font-semibold s-accent">Reprendre</span>
              </button>
            )}

            <SearchField value={q} onChange={setQ} placeholder="Nom, entreprise, ville, numéro" ariaLabel="Rechercher un prospect" />

            {/* Une rangée qui défile, fondue aux deux bords : une puce coupée se lit « il y en a d'autres ». */}
            <div
              ref={filtersRef}
              className="s-fade-x -mx-4 flex gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden"
              role="group"
              aria-label="Filtrer par statut"
            >
              {FILTERS.map((f) => {
                const active = f.value === filter;
                const n = counts[f.value] ?? 0;
                return (
                  <button
                    key={f.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFilter(f.value)}
                    className="s-filter inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[14px] font-medium"
                  >
                    {f.value === 'due' && n > 0 && <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--s-orange))]" aria-hidden />}
                    {f.label}
                    {prospects.data && n > 0 && <span className="s-count rounded-[5px] px-1 text-[12px] tabular-nums">{n}</span>}
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
                <ul className="s-divide">
                  {shown.map((p, i) => (
                    <li key={p.id} className="s-enter" style={i < 12 ? { animationDelay: `${i * 28}ms` } : undefined}>
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
  const more = (p.phones ?? []).length;
  // Seulement sur les ouverts : c'est là que l'entretien peut encore la compléter (un client ou un perdu ne se relance plus).
  const incomplete = isOpenProspect(p) && missingOf(p).length > 0;
  return (
    <button type="button" onClick={onClick} className="s-row flex w-full items-start gap-3 px-4 py-3.5 text-left sm:px-5">
      <span
        className={cn(
          'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold',
          p.status === 'won' ? 's-good bg-[hsl(var(--s-green-tint))]' : 's-field-bg s-ink',
        )}
        aria-hidden
      >
        {initialsOf(name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0 truncate pt-0.5 text-[16px] font-semibold s-ink">{name}</span>
          <StatusTag status={p.status} />
        </span>
        {where && <span className="block truncate text-[14px] s-ink-2">{where}</span>}
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] tabular-nums">
          <span className="inline-flex items-center gap-1.5 s-ink-2">
            <PhoneNumber e164={p.phone_e164} />
            {more > 0 && <span className="s-ink-3">+{more}</span>}
          </span>
          {incomplete && (
            <span data-tone="warn" className="s-tag inline-flex h-[22px] items-center rounded-md px-1.5 text-[12px] font-medium">
              À compléter
            </span>
          )}
          {isOpenProspect(p) && p.next_action_at && (
            <span className={cn('inline-flex items-center gap-1', due ? 'font-semibold s-warn' : 's-ink-2')}>
              <AlarmClock className="h-3.5 w-3.5" aria-hidden />
              Relance {followUpLabel(p.next_action_at, now).toLowerCase()}
            </span>
          )}
        </span>
      </span>
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
    <div className="s-enter flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="s-inset flex h-10 w-10 items-center justify-center rounded-xl">
        <UserSearch className="h-5 w-5 s-ink-3" aria-hidden />
      </span>
      <p className="max-w-xs text-[15px] s-ink-2">{text}</p>
      {total === 0 && !searching && (
        <button type="button" onClick={onNew} className={btn('ink', 'md', 'mt-1 gap-1.5')}>
          <Plus className="h-4 w-4" /> Nouveau prospect
        </button>
      )}
    </div>
  );
}
