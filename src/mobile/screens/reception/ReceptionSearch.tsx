// ============================================================
// RÉCEPTION — Étape 1 bis : « Qui est le client ? » quand il n'y a pas de
// QR. Un champ, une liste, un bouton pour créer le client. Rien d'autre.
// Avec `?assign=<dépôt>`, la ligne choisie attribue le dépôt en attente,
// puis on revient là d'où l'on venait ; un refus laisse l'écran utilisable.
// La flèche ramène à la caméra (étape 1) ; la recherche tapée reste dans
// l'URL (?q=) pour qu'un retour la retrouve.
// ============================================================
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { clientFullName, type ReceptionClient } from '@/lib/reception';
import { useAssignDeposit, useReceptionSearch } from '@/hooks/useReception';
import { EmptyLine, IconCircle, Initials, ItemList, ItemRow, ScreenTop, SearchBox, SURFACE } from '@/mobile/designKit';
import { useAssignFlow } from '@/mobile/components/reception/useAssignFlow';

export function ReceptionSearch() {
  const navigate = useNavigate();
  const flow = useAssignFlow();
  const { assignId, qs } = flow;
  const [params, setParams] = useSearchParams();
  const { t } = useLanguage();
  const [query, setQuery] = useState(() => params.get('q') ?? '');
  const [debounced, setDebounced] = useState(query);
  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(query);
      // La recherche reste dans l'URL (sans ajouter d'entrée) : un retour la retrouve.
      setParams((p) => { const n = new URLSearchParams(p); if (query.trim()) n.set('q', query.trim()); else n.delete('q'); return n; }, { replace: true });
    }, 250);
    return () => clearTimeout(id);
  }, [query, setParams]);
  const search = useReceptionSearch(debounced);
  const assign = useAssignDeposit();

  const pick = async (client: ReceptionClient) => {
    if (assignId) {
      if (assign.isPending) return;
      try {
        await assign.mutateAsync({ depositId: assignId, clientUserId: client.user_id });
      } catch {
        return; // le hook a dit le refus ; la liste reste là
      }
      flow.assigned(clientFullName(client));
      return;
    }
    navigate(`/r/new/how?client=${client.user_id}&name=${encodeURIComponent(clientFullName(client))}&code=${client.customer_code}`, { replace: true });
  };

  const results = search.data ?? [];
  const searching = debounced.trim().length >= 2;

  return (
    <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
      <ScreenTop title={assignId ? t('rc_assign') : t('rc_search_title')} step={assignId ? undefined : '1/4'} onBack={() => navigate(`/r/new${qs}`, { replace: true })} />
      <div className="px-5 pt-4">
        <SearchBox value={query} onChange={setQuery} placeholder={t('rc_search_clients_ph')} autoFocus />
      </div>
      {searching && (
        search.isLoading ? <EmptyLine>…</EmptyLine>
        : search.isError ? <EmptyLine action={{ label: t('rc_retry'), onClick: () => void search.refetch() }}>{(search.error as Error).message}</EmptyLine>
        : results.length === 0 ? <EmptyLine>{t('rc_no_result')}</EmptyLine>
        : (
          <ItemList className="pt-2">
            {results.map((c) => {
              const name = clientFullName(c);
              return (
                <ItemRow
                  key={c.user_id}
                  leading={<Initials name={name} />}
                  title={name}
                  subtitle={[c.customer_code, c.phone, c.city].filter(Boolean).join(' · ')}
                  onClick={assign.isPending ? undefined : () => void pick(c)}
                  chevron
                />
              );
            })}
          </ItemList>
        )
      )}
      <ItemList className="pt-2">
        <ItemRow leading={<IconCircle icon={Plus} />} title={t('rc_new_client')} subtitle={t('rc_v2_name_phone')} onClick={() => navigate(`/r/new/client${qs}`, { replace: true })} chevron />
      </ItemList>
    </div>
  );
}
