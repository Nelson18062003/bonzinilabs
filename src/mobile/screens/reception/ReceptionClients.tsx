// ============================================================
// RÉCEPTION — Les clients. Une recherche (nom, téléphone, code BZ) et, en
// dessous, les clients récents : ceux des derniers dépôts, puis les
// derniers inscrits. Une ligne ouvre la fiche : l'étiquette à réimprimer
// ou à envoyer, et un nouveau dépôt pour ce client. Identité seule.
// Refonte v2 (gabarit v2-2) : grand titre, « + » pour un nouveau client,
// la recherche, puis la liste.
// ============================================================
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { clientFullName, type ReceptionClient } from '@/lib/reception';
import { useReceptionSearch, useRecentClients } from '@/hooks/useReception';
import { EmptyLine, Initials, ItemList, ItemRow, RoundButton, ScreenLoader, SearchBox, SectionHead, SURFACE, TabTop } from '@/mobile/designKit';

function ClientRow({ client, onClick }: { client: ReceptionClient; onClick: () => void }) {
  const name = clientFullName(client);
  return (
    <ItemRow
      leading={<Initials name={name} />}
      title={name}
      subtitle={[client.customer_code, client.city, client.company_name].filter(Boolean).join(' · ')}
      onClick={onClick}
      chevron
    />
  );
}

export function ReceptionClients() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [params, setParams] = useSearchParams();
  // La recherche reste dans l'URL (?q=, sans ajouter d'entrée) : revenir d'une fiche la retrouve telle quelle.
  const [query, setQuery] = useState(() => params.get('q') ?? '');
  const [debounced, setDebounced] = useState(query);
  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(query);
      setParams((p) => { const n = new URLSearchParams(p); if (query.trim()) n.set('q', query.trim()); else n.delete('q'); return n; }, { replace: true });
    }, 250);
    return () => clearTimeout(id);
  }, [query, setParams]);
  const searching = debounced.trim().length >= 2;
  const search = useReceptionSearch(debounced);
  const recent = useRecentClients();

  const current = searching ? search : recent;
  const list = current.data ?? [];

  return (
    <div className={cn('flex min-h-[100dvh] flex-col pb-6', SURFACE.canvas)}>
      <TabTop title={t('rc_clients')} right={<RoundButton icon={Plus} ariaLabel={t('rc_new_client')} onClick={() => navigate('/r/new/client?from=clients')} />} />
      <div className="px-5 pt-3">
        <SearchBox value={query} onChange={setQuery} placeholder={t('rc_search_clients_ph')} />
      </div>
      <SectionHead title={searching ? t('rc_results') : t('rc_recent_clients')} />
      {current.isLoading ? <ScreenLoader /> : current.isError ? (
        <EmptyLine action={{ label: t('rc_retry'), onClick: () => void current.refetch() }}>{(current.error as Error).message}</EmptyLine>
      ) : list.length === 0 ? (
        <EmptyLine action={{ label: t('rc_new_client'), onClick: () => navigate('/r/new/client?from=clients') }}>{searching ? t('rc_no_result') : t('rc_no_client_yet')}</EmptyLine>
      ) : (
        <ItemList>
          {list.map((c) => <ClientRow key={c.user_id} client={c} onClick={() => navigate(`/r/clients/${c.user_id}`)} />)}
        </ItemList>
      )}
    </div>
  );
}
