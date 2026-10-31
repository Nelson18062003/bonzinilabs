/**
 * Messages clients — refonte v2 (maquette 06/01). Une rangée de puces
 * (Ouvertes · À moi · À prendre · Fermées · Toutes), une ligne par client :
 * initiales, nom, dernier message (gras si non lu), assigné ou « À prendre »,
 * heure et rond noir des non-lus. Le rare — recherche dans les messages,
 * statistiques, réponses types, suggestions — est dans « … ».
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { BarChart3, MessageSquareQuote, Search, Sparkles } from 'lucide-react';
import { HighlightedSnippet } from '@/components/support/HighlightedSnippet';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAdminConversations } from '@/hooks/useAdminChat';
import { useSearchConversations, useSupportAdmins } from '@/hooks/useAdminChatTools';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/lib/utils';
import type { ChatConversationWithClient } from '@/types/chat';
import {
  ActionSheet, Chip, EmptyLine, FOCUS_RING, Initials, MoreButton, ScreenLoader, SearchBox, SURFACE, Tag, TabTop, TEXT, useSheet,
} from '@/mobile/designKit';
import { UnreadBadge } from '@/mobile/screens/more/parts';

type Filter = 'open' | 'mine' | 'unassigned' | 'closed' | 'all';

const statusOf = (f: Filter): 'open' | 'closed' | 'all' => (f === 'closed' ? 'closed' : f === 'all' ? 'all' : 'open');

/** « 09:24 », « Hier », « 14 oct. » : l'heure du dernier message. */
export function chatTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Hier';
  return format(d, 'd MMM', { locale: fr });
}

export function MobileSupportListScreen() {
  const navigate = useNavigate();
  const { hasPermission, currentUser } = useAdminAuth();
  const canAccess = hasPermission('canAccessSupportChat');
  const more = useSheet();

  const [filter, setFilter] = useState<Filter>('open');
  const [searching, setSearching] = useState(false);
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search);
  const query = debounced.trim().length >= 2 ? debounced.trim() : '';

  const openList = useAdminConversations('open');
  const list = useAdminConversations(statusOf(filter));
  const { data: searchResults, isLoading: searchLoading } = useSearchConversations(query);
  const { data: admins } = useSupportAdmins();

  const myRoleId = admins?.find((a) => a.user_id === currentUser?.id)?.id ?? null;
  const open = openList.data ?? [];
  const mineCount = myRoleId ? open.filter((c) => c.assigned_admin_id === myRoleId).length : 0;
  const toTakeCount = open.filter((c) => !c.assigned_admin_id).length;

  const snippets = useMemo(() => new Map((searchResults ?? []).map((r) => [r.conversation_id, r.snippet])), [searchResults]);

  const rows = useMemo(() => {
    let l = list.data ?? [];
    if (filter === 'mine') l = myRoleId ? l.filter((c) => c.assigned_admin_id === myRoleId) : [];
    if (filter === 'unassigned') l = l.filter((c) => !c.assigned_admin_id);
    if (query && searchResults) l = l.filter((c) => snippets.has(c.id));
    return l;
  }, [list.data, filter, myRoleId, query, searchResults, snippets]);

  const adminName = (id: string | null) => {
    const a = admins?.find((x) => x.id === id);
    return a ? (a.first_name || `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || 'Admin') : null;
  };

  if (!canAccess) {
    return (
      <div className="flex min-h-full flex-col">
        <TabTop title="Messages clients" />
        <EmptyLine action={{ label: 'Ouvrir Plus', onClick: () => navigate('/m/more') }}>Réservé à l'équipe des messages.</EmptyLine>
      </div>
    );
  }

  const chips: { value: Filter; label: string; count?: number }[] = [
    { value: 'open', label: 'Ouvertes' },
    { value: 'mine', label: 'À moi', count: mineCount },
    { value: 'unassigned', label: 'À prendre', count: toTakeCount },
    { value: 'closed', label: 'Fermées' },
    { value: 'all', label: 'Toutes' },
  ];

  return (
    <div className="flex min-h-full flex-col pb-6">
      <TabTop
        title="Messages clients"
        right={<MoreButton bordered onClick={more.show} />}
      />

      {searching && (
        <div className="flex items-center gap-3 px-5 pt-2">
          <SearchBox value={search} onChange={setSearch} placeholder="Rechercher dans les messages" autoFocus className="flex-1" />
          <button type="button" onClick={() => { setSearching(false); setSearch(''); }} className={cn('h-11 shrink-0 rounded text-[17px] font-semibold', FOCUS_RING, TEXT.strong)}>Annuler</button>
        </div>
      )}

      <div className="scrollbar-hide flex gap-2.5 overflow-x-auto px-5 pb-1 pt-4">
        {chips.map((c) => (
          <Chip key={c.value} label={c.label} count={c.count} active={filter === c.value} onClick={() => setFilter(c.value)} className="h-12 px-4 text-[17px]" />
        ))}
      </div>

      {list.isLoading || (query && searchLoading) ? (
        <ScreenLoader />
      ) : list.isError ? (
        <EmptyLine action={{ label: 'Réessayer', onClick: () => void list.refetch() }}>Les conversations n'ont pas pu être chargées.</EmptyLine>
      ) : rows.length === 0 ? (
        <EmptyLine>{query ? 'Aucun message ne correspond.' : 'Aucune conversation ici.'}</EmptyLine>
      ) : (
        <div className="px-5 pt-1">
          {rows.map((c) => (
            <ConversationRow
              key={c.id}
              c={c}
              assignee={adminName(c.assigned_admin_id)}
              snippet={query ? snippets.get(c.id) : undefined}
              query={query}
              onClick={() => navigate(`/m/support/${c.id}`)}
            />
          ))}
        </div>
      )}

      <ActionSheet
        open={more.open}
        onClose={more.hide}
        actions={[
          { label: 'Rechercher dans les messages', icon: Search, onClick: () => setSearching(true) },
          { label: 'Statistiques', icon: BarChart3, onClick: () => navigate('/m/support/stats') },
          { label: 'Réponses types', icon: MessageSquareQuote, onClick: () => navigate('/m/more/canned-responses') },
          { label: 'Suggestions aux nouveaux clients', icon: Sparkles, onClick: () => navigate('/m/more/quick-replies') },
        ]}
      />
    </div>
  );
}

function ConversationRow({
  c, assignee, snippet, query, onClick,
}: {
  c: ChatConversationWithClient;
  assignee: string | null;
  snippet?: string;
  query: string;
  onClick: () => void;
}) {
  const name = `${c.client_first_name ?? ''} ${c.client_last_name ?? ''}`.trim() || 'Client';
  const unread = c.unread_count_admin || 0;
  const fromUs = !!c.last_admin_message_at && (!c.last_client_message_at || c.last_admin_message_at >= c.last_client_message_at);
  // L'aperçu du hook porte un emoji (« 🖼️ Photo ») : le mot suffit.
  const preview = (c.last_message_preview || c.subject || '—').replace(/^\p{Extended_Pictographic}\uFE0F?\s*/u, '');
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('flex w-full items-center gap-3.5 border-b py-4 text-left last:border-b-0 active:bg-[#F5F5F5] dark:active:bg-[#383838]', SURFACE.divider, FOCUS_RING, c.status === 'closed' && 'opacity-70')}
    >
      <Initials name={name} size={52} />
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-[18px] font-semibold leading-tight', TEXT.strong)}>{name}</span>
        {snippet ? (
          <HighlightedSnippet text={snippet} query={query} maxLength={90} className={cn('mt-1 block truncate text-[16px]', TEXT.muted)} />
        ) : (
          <span className={cn('mt-1 block truncate text-[16px]', unread > 0 ? cn('font-semibold', TEXT.strong) : TEXT.muted)}>
            {fromUs && unread === 0 ? `Vous : ${preview}` : preview}
          </span>
        )}
        <span className="mt-2 block">
          {c.status === 'closed'
            ? <Tag tone="neutral">Fermée</Tag>
            : assignee
              ? <Tag tone="neutral">{assignee}</Tag>
              : <Tag tone="pending">À prendre</Tag>}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-2 self-stretch justify-center">
        <span className={cn('text-[16px] tabular-nums', TEXT.muted)}>{chatTime(c.last_message_at)}</span>
        <UnreadBadge count={unread} />
      </span>
    </button>
  );
}

