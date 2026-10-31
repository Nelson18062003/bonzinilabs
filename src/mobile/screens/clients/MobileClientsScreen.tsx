/**
 * Clients — l'onglet (refonte v2, maquette 03/01).
 *
 * Une recherche (nom, téléphone, e-mail, entreprise, BZ-), trois filtres
 * (Tous · Avec solde · Découvert N) et le bouton de tri ⇅, qui ouvre une
 * feuille : le tri (nom, solde, dépôts, paiements, ancienneté) et les autres
 * statuts (Actifs, Inactifs, Suspendus, KYC, Solde nul). Une ligne par
 * client : initiales, nom, BZ + téléphone, solde à droite (tag Découvert,
 * Inactif, Suspendu ou KYC). La liste se charge au fil du défilement, 40 par
 * 40, au lieu de tout rendre d'un coup. Scanner et « + » en haut à droite.
 *
 * Données : `useClients()` (supabaseAdmin), recherche et tri locaux
 * (`clientSearch.ts`). Le desktop a son propre écran (DesktopClientsScreen).
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpDown, Check, Megaphone, Plus, ScanLine } from 'lucide-react';
import { useClients } from '@/hooks/useClientManagement';
import { matchesClientSearch, compareClients, type ClientSortField } from '@/lib/clientSearch';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { InfiniteScrollTrigger } from '@/mobile/components/ui/InfiniteScrollTrigger';
import { cn } from '@/lib/utils';
import {
  BottomSheet, Chip, EmptyLine, IconCircle, Initials, ItemList, ItemRow, RoundButton, SearchBox, SectionHead, Tag, TabTop, TEXT, type Tone,
} from '@/mobile/designKit';
import type { ClientStatus } from '@/types/admin';
import { ChipRow, xaf } from './parts';

type Filter = 'all' | 'balance' | 'overdraft' | 'zero' | ClientStatus;
type SortKey = `${ClientSortField}-${'asc' | 'desc'}`;

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'created-desc', label: 'Plus récents' },
  { value: 'created-asc', label: 'Plus anciens' },
  { value: 'name-asc', label: 'Nom A → Z' },
  { value: 'name-desc', label: 'Nom Z → A' },
  { value: 'balance-desc', label: 'Solde le plus haut' },
  { value: 'balance-asc', label: 'Solde le plus bas' },
  { value: 'deposits-desc', label: 'Plus de dépôts' },
  { value: 'payments-desc', label: 'Plus de paiements' },
];

const MORE_FILTERS: { value: Filter; label: string }[] = [
  { value: 'ACTIVE', label: 'Actifs' },
  { value: 'INACTIVE', label: 'Inactifs' },
  { value: 'SUSPENDED', label: 'Suspendus' },
  { value: 'PENDING_KYC', label: 'KYC' },
  { value: 'zero', label: 'Solde nul' },
];

const PAGE = 40;

/** « +237 690 55 66 77 » → « 690 55 66 77 » : le Cameroun va sans indicatif. */
export function shortPhone(raw: string | null | undefined): string {
  const p = (raw ?? '').trim();
  return p.startsWith('+237') ? p.slice(4).trim() : p;
}

/** Le tag d'un client dans une liste : découvert d'abord, sinon son statut s'il n'est pas actif. */
export function clientTag(status: string, balance: number): { tone: Tone; label: string } | null {
  if (balance < 0) return { tone: 'danger', label: 'Découvert' };
  if (status === 'INACTIVE') return { tone: 'neutral', label: 'Inactif' };
  if (status === 'SUSPENDED') return { tone: 'danger', label: 'Suspendu' };
  if (status === 'PENDING_KYC') return { tone: 'pending', label: 'KYC' };
  return null;
}

export function MobileClientsScreen() {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<SortKey>('created-desc');
  const [sheet, setSheet] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const { data: clients, isLoading, isError, refetch } = useClients();

  const all = useMemo(() => clients ?? [], [clients]);
  const overdraftCount = useMemo(() => all.filter((c) => (c.walletBalance || 0) < 0).length, [all]);

  const list = useMemo(() => {
    let l = all;
    if (filter === 'balance') l = l.filter((c) => (c.walletBalance || 0) > 0);
    else if (filter === 'overdraft') l = l.filter((c) => (c.walletBalance || 0) < 0);
    else if (filter === 'zero') l = l.filter((c) => (c.walletBalance || 0) === 0);
    else if (filter !== 'all') l = l.filter((c) => c.status === filter);
    const q = query.trim();
    if (q) l = l.filter((c) => matchesClientSearch(c, q));
    const [field, dir] = sort.split('-') as [ClientSortField, 'asc' | 'desc'];
    return [...l].sort(compareClients(field, dir === 'asc'));
  }, [all, filter, query, sort]);

  // Une nouvelle recherche ou un autre filtre repart du haut.
  useEffect(() => setShown(PAGE), [filter, query, sort]);

  const extraFilter = MORE_FILTERS.find((f) => f.value === filter);

  return (
    <div className="flex min-h-full flex-col pb-6">
      <TabTop
        title="Clients"
        right={
          <>
            <RoundButton icon={ScanLine} ariaLabel="Scanner un code client" onClick={() => navigate('/m/clients/scan')} />
            <RoundButton icon={Plus} ariaLabel="Nouveau client" onClick={() => navigate('/m/clients/new')} />
          </>
        }
      />

      <div className="px-5 pt-2.5">
        <SearchBox value={query} onChange={setQuery} placeholder="Nom, téléphone ou BZ-…" />
      </div>

      <ChipRow className="mt-3.5">
        <Chip label="Tous" active={filter === 'all'} onClick={() => setFilter('all')} />
        <Chip label="Avec solde" active={filter === 'balance'} onClick={() => setFilter('balance')} />
        <Chip label="Découvert" count={overdraftCount} active={filter === 'overdraft'} onClick={() => setFilter('overdraft')} />
        {extraFilter && <Chip label={extraFilter.label} active onClick={() => setFilter('all')} />}
        <Chip label={<ArrowUpDown className="h-5 w-5" aria-label="Trier et filtrer" />} active={sort !== 'created-desc'} onClick={() => setSheet(true)} />
      </ChipRow>

      {isLoading ? (
        <ItemList className="mt-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-3.5 border-b border-[#D9D9D9] py-3.5 last:border-b-0 dark:border-[#444444]">
              <span className="h-11 w-11 animate-pulse rounded-full bg-[#F5F5F5] dark:bg-[#383838]" />
              <span className="h-10 flex-1 animate-pulse rounded-lg bg-[#F5F5F5] dark:bg-[#383838]" />
            </div>
          ))}
        </ItemList>
      ) : isError ? (
        <EmptyLine action={{ label: 'Réessayer', onClick: () => void refetch() }}>La liste n'a pas pu être chargée.</EmptyLine>
      ) : list.length === 0 ? (
        <EmptyLine action={{ label: 'Nouveau client', onClick: () => navigate('/m/clients/new') }}>
          {query || filter !== 'all' ? 'Aucun client trouvé.' : 'Aucun client pour le moment.'}
        </EmptyLine>
      ) : (
        <ItemList className="mt-1">
          {list.slice(0, shown).map((c) => {
            const name = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || '?';
            const bal = c.walletBalance || 0;
            const tag = clientTag(c.status, bal);
            return (
              <ItemRow
                key={c.id}
                leading={<Initials name={name} />}
                title={name}
                subtitle={[c.customerCode, shortPhone(c.phone)].filter(Boolean).join(' · ')}
                right={
                  <span className="shrink-0 text-right">
                    <span className={cn('block text-[17px] font-bold tabular-nums', TEXT.strong)}>{xaf(bal)}</span>
                    {tag ? <Tag tone={tag.tone} className="mt-[5px]">{tag.label}</Tag> : <span className={cn('block text-[15px]', TEXT.muted)}>XAF</span>}
                  </span>
                }
                onClick={() => navigate(`/m/clients/${c.id}`)}
              />
            );
          })}
          <InfiniteScrollTrigger onLoadMore={() => setShown((n) => n + PAGE)} hasNextPage={shown < list.length} isFetchingNextPage={false} />
        </ItemList>
      )}

      <BottomSheet open={sheet} onClose={() => setSheet(false)}>
        <h3 className={cn('text-[22px] font-semibold', TEXT.strong)}>Trier</h3>
        <div className="mt-2">
          {SORTS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { setSort(o.value); setSheet(false); }}
              className="flex min-h-[52px] w-full items-center justify-between border-b border-[#D9D9D9] text-left last:border-b-0 dark:border-[#444444]"
            >
              <span className={cn('text-[17px] font-semibold', TEXT.strong)}>{o.label}</span>
              {sort === o.value && <Check className="h-5 w-5" />}
            </button>
          ))}
        </div>
        <SectionHead title="Statut" className="px-0" />
        <div className="flex flex-wrap gap-2 pt-1">
          {MORE_FILTERS.map((f) => (
            <Chip key={f.value} label={f.label} active={filter === f.value} onClick={() => { setFilter(filter === f.value ? 'all' : f.value); setSheet(false); }} />
          ))}
        </div>
        {hasPermission('canViewClients') && (
          <ItemRow
            className="mt-4 border-t border-[#D9D9D9] dark:border-[#444444]"
            leading={<IconCircle icon={Megaphone} />}
            title="Sources des clients"
            chevron
            onClick={() => { setSheet(false); navigate('/m/clients/sources'); }}
          />
        )}
      </BottomSheet>
    </div>
  );
}
