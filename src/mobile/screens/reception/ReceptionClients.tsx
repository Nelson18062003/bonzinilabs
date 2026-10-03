// ============================================================
// RÉCEPTION — Les clients. Une recherche (nom, téléphone, code BZ) et, en
// dessous, les clients récents : ceux des derniers dépôts, puis les
// derniers inscrits. Une ligne ouvre la fiche : l'étiquette à réimprimer
// ou à envoyer, et un nouveau dépôt pour ce client. Identité seule.
// ============================================================
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Search, UserPlus } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { clientFullName, initials, type ReceptionClient } from '@/lib/reception';
import { useReceptionSearch, useRecentClients } from '@/hooks/useReception';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { SURFACE, TEXT, TYPE, Button, Card, Holder, ScreenLoader, TextInput } from '@/mobile/designKit';

function ClientRow({ client, onClick }: { client: ReceptionClient; onClick: () => void }) {
  const name = clientFullName(client);
  return (
    <button type="button" onClick={onClick} className={cn('flex w-full items-center gap-3 py-4 text-left active:bg-[#F5F5F5] dark:active:bg-[#383838]')}>
      <Holder size="lg">{initials(name)}</Holder>
      <span className="min-w-0 flex-1">
        <span className={cn('block break-words', TYPE.bodyStrong, TEXT.strong)}>{name}</span>
        <span className={cn('mt-0.5 block tabular-nums', TYPE.small, TEXT.muted)}>{client.customer_code}{client.city ? ` · ${client.city}` : ''}{client.company_name ? ` · ${client.company_name}` : ''}</span>
      </span>
      <ChevronRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
    </button>
  );
}

export function ReceptionClients() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => { const id = setTimeout(() => setDebounced(query), 250); return () => clearTimeout(id); }, [query]);
  const searching = debounced.trim().length >= 2;
  const search = useReceptionSearch(debounced);
  const recent = useRecentClients();

  const list = searching ? search.data ?? [] : recent.data ?? [];
  const loading = searching ? search.isLoading : recent.isLoading;

  return (
    <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
      <MobileHeader title={t('rc_clients')} alignStart />
      <div className="space-y-5 px-5 pb-8 pt-4">
        <div className="relative">
          <Search className={cn('pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2', TEXT.muted)} />
          <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('rc_search_clients_ph')} className="h-14 pl-12 text-[17px]" autoComplete="off" inputMode="search" aria-label={t('rc_search_clients_ph')} />
        </div>

        <section>
          <h2 className={cn('mb-2', TYPE.smallStrong, TEXT.muted)}>{searching ? t('rc_results') : t('rc_recent_clients')}</h2>
          {loading ? (
            <ScreenLoader />
          ) : list.length === 0 ? (
            <Card className={cn('text-center', SURFACE.inset, 'border-0')}>
              <p className={cn(TYPE.body, TEXT.muted)}>{searching ? t('rc_no_result') : t('rc_no_client_yet')}</p>
            </Card>
          ) : (
            <Card className="py-0 [&>*]:border-b [&>*]:border-[#D9D9D9] [&>*:last-child]:border-b-0 dark:[&>*]:border-[#444444]">
              {list.map((c) => <ClientRow key={c.user_id} client={c} onClick={() => navigate(`/r/clients/${c.user_id}`)} />)}
            </Card>
          )}
        </section>

        <Button variant="neutral" className="h-14 w-full text-[17px]" onClick={() => navigate('/r/new/client')}>
          <UserPlus /> {t('rc_new_client')}
        </Button>
      </div>
    </div>
  );
}
