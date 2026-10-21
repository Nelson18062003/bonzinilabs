/**
 * Équipe · Membres — refonte v2 (maquette 03/11). Le super admin seul
 * (`canManageUsers`, garde serveur sur `team_members`).
 *
 * Membres / Ventes en tête ; les puces Tous · un site chacun · une équipe
 * chacune · Inactifs ; la loupe ouvre la recherche (nom, email, téléphone,
 * site). Une ligne par membre : initiales, nom, « Rôle · Site », et à droite
 * sa dernière connexion (ou « Vous », « Désactivé », « Sans fiche »).
 * « + » : nouvel accès.
 */
import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useTeamMembers, type TeamMember } from '@/hooks/useTeam';
import { TEAMS, compareSites, lastSeen, matchesMember, memberName, roleLabel, teamOf, type TeamKey } from '@/lib/team';
import { Chip, EmptyLine, Initials, ItemList, ItemRow, RoundButton, SearchBox, TEXT } from '@/mobile/designKit';
import { ChipRow } from '@/mobile/screens/clients/parts';
import { TEAM_BASE, TeamTabs } from './teamParts';

type Filter = { kind: 'all' } | { kind: 'site'; id: string } | { kind: 'team'; key: TeamKey } | { kind: 'off' };

export function TeamMembersV2() {
  const { hasPermission } = useAdminAuth();
  if (!hasPermission('canManageUsers')) return <Navigate to="/m" replace />;
  return <Members />;
}

function Members() {
  const navigate = useNavigate();
  const { currentUser } = useAdminAuth();
  const members = useTeamMembers();
  const [filter, setFilter] = useState<Filter>({ kind: 'all' });
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState('');

  const all = useMemo(() => members.data ?? [], [members.data]);
  const active = all.filter((m) => !m.is_disabled);
  const sites = useMemo(() => {
    const byId = new Map<string, NonNullable<TeamMember['site']>>();
    for (const m of active) if (m.site) byId.set(m.site.id, m.site);
    return [...byId.values()].sort(compareSites);
  }, [active]);
  const teams = TEAMS.filter((t) => active.some((m) => teamOf(m.role).key === t.key));
  const off = all.length - active.length;

  const list = all
    .filter((m) => {
      if (filter.kind === 'off') return m.is_disabled;
      if (m.is_disabled) return filter.kind === 'all' && q.trim() !== '';
      if (filter.kind === 'site') return m.site?.id === filter.id;
      if (filter.kind === 'team') return teamOf(m.role).key === filter.key;
      return true;
    })
    .filter((m) => matchesMember(m, q))
    // Soi-même d'abord, les désactivés à la fin, le reste par nom.
    .sort((a, b) => Number(b.user_id === currentUser?.id) - Number(a.user_id === currentUser?.id) || Number(a.is_disabled) - Number(b.is_disabled) || memberName(a).localeCompare(memberName(b), 'fr'));

  const is = (f: Filter) => JSON.stringify(f) === JSON.stringify(filter);

  return (
    <div className="flex min-h-full flex-col pb-6">
      <TeamTabs
        tab="members"
        right={
          <>
            <RoundButton icon={Search} ariaLabel="Chercher un membre" onClick={() => setSearching((s) => !s)} />
            <RoundButton icon={Plus} ariaLabel="Nouvel accès" onClick={() => navigate(`${TEAM_BASE}/nouveau`)} />
          </>
        }
      />
      {searching && (
        <div className="px-5 pt-3">
          <SearchBox value={q} onChange={setQ} placeholder="Nom, email, téléphone, site…" autoFocus />
        </div>
      )}
      <ChipRow className="mt-3.5">
        <Chip label="Tous" count={active.length} active={is({ kind: 'all' })} onClick={() => setFilter({ kind: 'all' })} />
        {sites.map((s) => (
          <Chip key={s.id} label={s.label} count={active.filter((m) => m.site?.id === s.id).length} active={is({ kind: 'site', id: s.id })} onClick={() => setFilter({ kind: 'site', id: s.id })} />
        ))}
        {teams.map((t) => (
          <Chip key={t.key} label={t.label} count={active.filter((m) => teamOf(m.role).key === t.key).length} active={is({ kind: 'team', key: t.key })} onClick={() => setFilter({ kind: 'team', key: t.key })} />
        ))}
        {off > 0 && <Chip label="Inactifs" count={off} active={is({ kind: 'off' })} onClick={() => setFilter({ kind: 'off' })} />}
      </ChipRow>

      {members.isLoading ? (
        <ItemList className="mt-2">{Array.from({ length: 6 }, (_, i) => <div key={i} className="my-2 h-14 animate-pulse rounded-lg bg-[#F5F5F5] dark:bg-[#383838]" />)}</ItemList>
      ) : members.isError ? (
        <EmptyLine action={{ label: 'Réessayer', onClick: () => void members.refetch() }}>La liste n’a pas pu être chargée.</EmptyLine>
      ) : list.length === 0 ? (
        <EmptyLine action={filter.kind === 'team' && filter.key === 'ventes' ? { label: 'Ajouter un commercial', onClick: () => navigate(`${TEAM_BASE}/nouveau?role=commercial`) } : undefined}>
          Personne ici.
        </EmptyLine>
      ) : (
        <ItemList className="mt-1">
          {list.map((m) => {
            const name = memberName(m);
            const self = m.user_id === currentUser?.id;
            const noFiche = m.role === 'commercial' && !m.source;
            return (
              <ItemRow
                key={m.user_id}
                className={cn(m.is_disabled && '[&_span]:opacity-80')}
                leading={<Initials name={name} className={cn(m.is_disabled && 'text-[#757575]')} />}
                title={<span className={cn(m.is_disabled && 'text-[#757575] dark:text-[#B3B3B3]')}>{name}</span>}
                subtitle={[roleLabel(m.role), m.site?.label].filter(Boolean).join(' · ')}
                tag={
                  self ? { tone: 'neutral', label: 'Vous' }
                    : m.is_disabled ? { tone: 'danger', label: 'Désactivé' }
                      : noFiche ? { tone: 'pending', label: 'Sans fiche' }
                        : undefined
                }
                right={!self && !m.is_disabled && !noFiche ? <span className={cn('shrink-0 text-[15px]', TEXT.muted)}>{lastSeen(m.last_sign_in_at).replace('jamais connecté', 'jamais')}</span> : undefined}
                onClick={() => navigate(`${TEAM_BASE}/${m.user_id}`)}
              />
            );
          })}
        </ItemList>
      )}
    </div>
  );
}
