// ============================================================
// ESPACE COMMERCIAL — « Prospects » (refonte v2, maquette 03/16). Ses
// prospects seulement (la RLS de `prospects` le garantit), filtrés par
// statut : Ouverts · Relances · Clients · Perdus, puis (en faisant glisser
// la rangée) À vérifier, À contacter, Contacté, Intéressé, Tous. Une
// recherche (nom, entreprise, ville, email, l'un QUELCONQUE de ses numéros) ;
// une ligne ouvre la fiche. `?filtre=relancer` ouvre directement les relances
// (lien de l'accueil). Un prospect en cours de saisie (brouillon gardé dans
// le téléphone, sous SON compte) se reprend en tête de liste. Une fiche
// OUVERTE à laquelle il manque quelque chose porte « À compléter ».
// « À vérifier » (07/10) : un numéro déjà celui d'un client Bonzini, en
// attente de la direction ; sa puce n'apparaît que s'il y en a.
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PenLine, Plus } from 'lucide-react';
import { normalizeText } from '@/lib/clientSearch';
import { formatE164ForDisplay } from '@/components/form/PhoneNumberInput';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCommercialDashboard, useProspects, type Prospect } from '@/hooks/useSales';
import { currentMonth, type ProspectStatus } from '@/lib/sales';
import { Chip, EmptyLine, IconCircle, Initials, ItemList, ItemRow, RoundButton, SearchBox, TabTop } from '@/mobile/designKit';
import { ChipRow } from '@/mobile/screens/clients/parts';
import { prospectTag } from '@/mobile/screens/team/prospectBits';
import { UnlinkedNotice } from './SalesBits';
import { isDraftEmpty, loadDraft, missingOf, stepIndex, STEPS } from './prospectDraft';
import { isDue, isOpenProspect, isUnlinkedError, prospectName } from './salesHelpers';

type Filter = 'open' | 'due' | ProspectStatus | 'all';

/** Les filtres, dans l'ordre des puces ; `param` est la valeur de `?filtre=`. */
const FILTERS: { value: Filter; label: string; param: string | null }[] = [
  { value: 'open', label: 'Ouverts', param: null },
  { value: 'due', label: 'Relances', param: 'relancer' },
  { value: 'won', label: 'Clients', param: 'clients' },
  { value: 'lost', label: 'Perdus', param: 'perdus' },
  { value: 'to_verify', label: 'À vérifier', param: 'a-verifier' },
  { value: 'new', label: 'À contacter', param: 'a-contacter' },
  { value: 'contacted', label: 'Contacté', param: 'contacte' },
  { value: 'interested', label: 'Intéressé', param: 'interesse' },
  { value: 'all', label: 'Tous', param: 'tous' },
];

function matches(p: Prospect, f: Filter, now: Date): boolean {
  if (f === 'all') return true;
  if (f === 'open') return isOpenProspect(p);
  if (f === 'due') return isDue(p, now);
  return p.status === f;
}

const time = (iso: string | null) => (iso ? new Date(iso).getTime() : Number.POSITIVE_INFINITY);

/** Les puces qui ne se montrent que s'il y a quelque chose dedans (ou si elles sont choisies). */
const ONLY_IF_ANY: Filter[] = ['to_verify'];

/**
 * Ouverts : les relances échues d'abord, puis la prochaine relance, puis le
 * plus récent. À vérifier, clos : le plus récent (l'ordre de la liste lue).
 * Tous : les ouverts, puis les « À vérifier », puis les clos.
 */
function sortFor(f: Filter, list: Prospect[], now: Date): Prospect[] {
  if (f === 'won' || f === 'lost' || f === 'to_verify') return list;
  if (f === 'all') {
    const waiting = list.filter((p) => p.status === 'to_verify');
    const closed = list.filter((p) => !isOpenProspect(p) && p.status !== 'to_verify');
    return [...sortFor('open', list.filter(isOpenProspect), now), ...waiting, ...closed];
  }
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

  // Le filtre choisi reste en vue dans la rangée qui défile (« Perdus » ouvert par un lien).
  const filtersRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    filtersRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
  }, [filter]);
  const draftName = (() => {
    if (!draft || isDraftEmpty(draft.draft)) return null;
    return [draft.draft.firstName, draft.draft.lastName].map((x) => x.trim()).filter(Boolean).join(' ') || 'sans nom';
  })();

  return (
    <div className="flex min-h-full flex-col bg-white pb-6 dark:bg-[#1E1E1E]">
      <TabTop title="Prospects" right={!unlinked ? <RoundButton icon={Plus} ariaLabel="Nouveau prospect" onClick={() => navigate('/v/prospects/new')} /> : undefined} />
      {unlinked ? (
        <div className="px-5 pt-4">
          <UnlinkedNotice message={(fiche.error as Error).message} onRetry={() => void fiche.refetch()} />
        </div>
      ) : (
        <>
          <div className="px-5 pt-2.5">
            <SearchBox value={q} onChange={setQ} placeholder="Nom, entreprise ou téléphone" />
          </div>
          <div ref={filtersRef}>
            <ChipRow className="mt-3.5">
              {FILTERS.map((f) => {
                const n = counts[f.value] ?? 0;
                if (ONLY_IF_ANY.includes(f.value) && f.value !== filter && (!prospects.data || n === 0)) return null;
                return <Chip key={f.value} label={f.label} count={f.value === 'due' || f.value === 'to_verify' ? n : null} active={f.value === filter} onClick={() => setFilter(f.value)} />;
              })}
            </ChipRow>
          </div>

          <ItemList className="mt-1">
            {draftName && (
              <ItemRow
                leading={<IconCircle icon={PenLine} />}
                title={`Brouillon · ${draftName}`}
                subtitle={`Étape ${Math.max(1, stepIndex(draft!.step) + 1)} sur ${STEPS.length}`}
                tag={{ tone: 'neutral', label: 'Reprendre' }}
                onClick={() => navigate('/v/prospects/new')}
              />
            )}
            {prospects.isLoading ? (
              [0, 1, 2, 3].map((i) => <div key={i} className="my-2 h-14 animate-pulse rounded-lg bg-[#F5F5F5] dark:bg-[#383838]" />)
            ) : prospects.isError ? (
              <EmptyLine action={{ label: 'Réessayer', onClick: () => void prospects.refetch() }}>La liste n’a pas pu être chargée.</EmptyLine>
            ) : shown.length === 0 ? (
              <EmptyLine action={all.length === 0 && !q.trim() ? { label: 'Nouveau prospect', onClick: () => navigate('/v/prospects/new') } : undefined}>
                {q.trim() ? 'Aucun prospect ne correspond.' : all.length === 0 ? 'Pas encore de prospect.' : filter === 'due' ? 'Rien à relancer.' : 'Aucun prospect ici.'}
              </EmptyLine>
            ) : (
              shown.map((p) => {
                const due = isDue(p, now);
                const incomplete = isOpenProspect(p) && missingOf(p).length > 0;
                const tag = due ? { tone: 'pending' as const, label: 'À relancer' } : incomplete ? { tone: 'pending' as const, label: 'À compléter' } : prospectTag(p);
                return (
                  <ItemRow
                    key={p.id}
                    leading={<Initials name={prospectName(p)} />}
                    title={prospectName(p)}
                    subtitle={[p.company, p.city].filter(Boolean).join(' · ') || formatE164ForDisplay(p.phone_e164 || p.phone)}
                    tag={tag}
                    onClick={() => navigate(`/v/prospects/${p.id}`)}
                  />
                );
              })
            )}
          </ItemList>
        </>
      )}
    </div>
  );
}
