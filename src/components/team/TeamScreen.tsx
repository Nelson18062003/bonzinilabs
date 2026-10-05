// ============================================================
// Mes équipes — toute l'équipe Bonzini, rangée par équipe (Direction,
// Bureau, Commerciaux, Guangzhou, Douala, Douane). Le fondateur y crée
// chaque accès, voit qui s'est connecté et quand, et ouvre la fiche d'un
// membre. Un seul écran pour l'ordinateur et le téléphone.
// Lecture : team_members (canManageUsers, garde serveur).
//
// Sites (06/10) : chaque ligne montre le site du membre et son numéro
// principal lisible ; une rangée de puces filtre par site ; la recherche
// porte aussi sur le site et sur tous les numéros.
// ============================================================
import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ChevronRight, Plus, TrendingUp, UserX } from 'lucide-react';
import { SearchField } from '@/components/form';
import { CountryFlag } from '@/components/form/CountryFlag';
import { formatE164ForDisplay } from '@/components/form/PhoneNumberInput';
import { cn } from '@/lib/utils';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useTeamMembers, type TeamMember } from '@/hooks/useTeam';
import { TEAMS, compareSites, lastSeen, matchesMember, memberName, memberPhones, teamOf, type TeamKey } from '@/lib/team';
import { BTN_PRIMARY, BTN_SOFT, CARD, Initials, RolePill, SiteTag, Skeleton } from './TeamBits';

export const TEAM_BASE = '/m/equipe';

export function TeamScreen() {
  const { hasPermission } = useAdminAuth();
  if (!hasPermission('canManageUsers')) return <Navigate to="/m" replace />;
  return <TeamList />;
}

function TeamList() {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const members = useTeamMembers();
  const [team, setTeam] = useState<TeamKey | 'all'>('all');
  const [query, setQuery] = useState('');
  const [showDisabled, setShowDisabled] = useState(false);
  /** Le filtre par site : un id de site, « sans site », ou tous. */
  const [site, setSite] = useState<string>(ALL_SITES);

  const all = useMemo(() => members.data ?? [], [members.data]);
  const disabledCount = all.filter((m) => m.is_disabled).length;
  // Les sites où quelqu'un travaille (les autres n'ont rien à filtrer).
  const sites = useMemo(() => {
    const byId = new Map<string, NonNullable<TeamMember['site']>>();
    for (const m of all) if (m.site) byId.set(m.site.id, m.site);
    return [...byId.values()].sort(compareSites);
  }, [all]);
  const someWithoutSite = all.some((m) => !m.site);
  const inSite = (m: TeamMember, key: string) => key === ALL_SITES || (key === NO_SITE ? !m.site : m.site?.id === key);
  const inTeam = (m: TeamMember) => team === 'all' || teamOf(m.role).key === team;

  const searched = all.filter((m) => (showDisabled || !m.is_disabled) && matchesMember(m, query));
  const visible = searched.filter((m) => inSite(m, site));
  const filtering = query.trim() !== '' || site !== ALL_SITES;
  const byTeam = TEAMS.map((t) => ({ team: t, rows: visible.filter((m) => teamOf(m.role).key === t.key) })).filter(
    // « Commerciaux » reste affiché vide (pour inviter à en créer un), sauf pendant une recherche ou un filtre.
    (g) => (team === 'all' ? g.rows.length > 0 || (g.team.key === 'ventes' && !filtering) : g.team.key === team),
  );
  const shownInSite = (key: string) => searched.filter((m) => inTeam(m) && inSite(m, key)).length;
  const activeCount = all.length - disabledCount;
  // Une seule règle pour les puces et les en-têtes de section : on compte ce
  // que la liste montre (désactivés compris quand ils sont affichés, recherche comprise).
  const shownIn = (key: TeamKey) => visible.filter((m) => teamOf(m.role).key === key).length;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-0">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">Mes équipes</h1>
          <p className="mt-0.5 text-[14px] text-muted-foreground">
            {members.isLoading
              ? '…'
              : `${activeCount} accès actif${activeCount > 1 ? 's' : ''}${disabledCount ? ` · ${disabledCount} désactivé${disabledCount > 1 ? 's' : ''}` : ''}`}{' '}
            · vous seul créez et retirez les accès
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasPermission('canManageSales') && (
            <button type="button" onClick={() => navigate(`${TEAM_BASE}/ventes`)} className={BTN_SOFT}>
              <TrendingUp className="h-4 w-4" /> Chiffres des commerciaux
            </button>
          )}
          <button type="button" onClick={() => navigate(`${TEAM_BASE}/nouveau`)} className={BTN_PRIMARY}>
            <Plus className="h-4 w-4" /> Nouvel accès
          </button>
        </div>
      </header>

      {/* Les équipes en un coup d'œil : un filtre chacune */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        <TeamChip label="Toute l’équipe" count={visible.length} active={team === 'all'} onClick={() => setTeam('all')} />
        {TEAMS.map((t) => (
          <TeamChip
            key={t.key}
            label={t.label}
            count={shownIn(t.key)}
            active={team === t.key}
            onClick={() => setTeam(team === t.key ? 'all' : t.key)}
          />
        ))}
      </div>

      {/* Les sites : où chacun travaille (Guangzhou · bureau, Douala…) */}
      {sites.length > 0 && (
        <div className="-mx-4 -mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filtrer par site">
          <SiteChip label="Tous les sites" count={shownInSite(ALL_SITES)} active={site === ALL_SITES} onClick={() => setSite(ALL_SITES)} />
          {sites.map((s) => (
            <SiteChip
              key={s.id}
              label={s.label}
              iso={s.country_iso}
              count={shownInSite(s.id)}
              active={site === s.id}
              onClick={() => setSite(site === s.id ? ALL_SITES : s.id)}
            />
          ))}
          {someWithoutSite && (
            <SiteChip label="Sans site" count={shownInSite(NO_SITE)} active={site === NO_SITE} onClick={() => setSite(site === NO_SITE ? ALL_SITES : NO_SITE)} />
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <SearchField
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery('')}
          placeholder="Nom, email, téléphone, site…"
          aria-label="Chercher un membre"
          wrapperClassName="min-w-[220px] flex-1"
          controlClassName="rounded-xl bg-card"
        />
        {disabledCount > 0 && (
          <button type="button" onClick={() => setShowDisabled((v) => !v)} className={cn(BTN_SOFT, 'h-11', showDisabled && 'bg-accent')}>
            <UserX className="h-4 w-4" /> {showDisabled ? 'Masquer' : 'Voir'} les désactivés
          </button>
        )}
      </div>

      {members.isLoading ? (
        <div className={CARD}>
          <Skeleton rows={5} />
        </div>
      ) : members.isError ? (
        <div className={cn(CARD, 'p-8 text-center text-[14px]')}>
          La liste n’a pas pu être chargée.{' '}
          <button type="button" onClick={() => void members.refetch()} className="font-semibold underline">
            Réessayer
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {byTeam.map(({ team: t, rows }) => (
            <section key={t.key} className={cn(CARD, 'overflow-hidden')}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 pb-2 pt-4">
                <div>
                  <h2 className="text-[16px] font-semibold">
                    {t.label} <span className="ml-1 text-[13px] font-medium text-muted-foreground">{rows.length}</span>
                  </h2>
                  <p className="text-[12.5px] text-muted-foreground">{t.hint}</p>
                </div>
                {t.key === 'ventes' && (
                  <button type="button" onClick={() => navigate(`${TEAM_BASE}/nouveau?role=commercial`)} className="text-[13px] font-semibold text-primary hover:underline">
                    + Ajouter un commercial
                  </button>
                )}
              </div>
              {rows.length === 0 ? (
                <p className="px-5 pb-5 text-[13.5px] text-muted-foreground">
                  {t.key === 'ventes' ? 'Aucun commercial pour l’instant. Créez son accès : il suivra ses prospects et ses clients depuis son téléphone.' : 'Personne dans cette équipe.'}
                </p>
              ) : (
                <ul className="px-2 pb-2">
                  {rows.map((m) => (
                    <MemberRow key={m.user_id} m={m} onOpen={() => navigate(`${TEAM_BASE}/${m.user_id}`)} />
                  ))}
                </ul>
              )}
            </section>
          ))}
          {byTeam.length === 0 && <div className={cn(CARD, 'p-10 text-center text-[14px] text-muted-foreground')}>Personne ne correspond à cette recherche.</div>}
        </div>
      )}
    </div>
  );
}

const ALL_SITES = 'all';
const NO_SITE = 'none';

function SiteChip({ label, iso, count, active, onClick }: { label: string; iso?: string | null; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground ring-1 ring-black/10 hover:bg-accent hover:text-foreground dark:ring-white/15',
      )}
    >
      {iso && <CountryFlag iso={iso} size={16} />}
      {label}
      <span className={cn('tabular-nums text-[12px]', active ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{count}</span>
    </button>
  );
}

function TeamChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-[14px] font-medium transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground ring-1 ring-black/10 hover:bg-accent dark:ring-white/15',
      )}
    >
      {label}
      <span className={cn('tabular-nums text-[12.5px]', active ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{count}</span>
    </button>
  );
}

function MemberRow({ m, onOpen }: { m: TeamMember; onOpen: () => void }) {
  const name = memberName(m);
  const noSource = m.role === 'commercial' && !m.source;
  const phones = memberPhones(m);
  const phone = phones[0]
    ? `${formatE164ForDisplay(phones[0].phone_e164)}${phones.length > 1 ? ` et ${phones.length - 1} autre${phones.length > 2 ? 's' : ''}` : ''}`
    : null;
  const contact = [m.email, phone, m.role === 'commercial' && m.source ? `fiche « ${m.source.label} »` : null].filter(Boolean);
  return (
    <li>
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-muted/40 active:bg-muted/60">
        <Initials name={name} disabled={m.is_disabled} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn('truncate text-[15px] font-semibold', m.is_disabled && 'text-muted-foreground line-through decoration-1')}>{name}</span>
            <RolePill role={m.role} />
            {m.site && <SiteTag site={m.site} className="text-[12.5px] font-medium text-muted-foreground" />}
            {m.is_disabled && <span className="rounded-full bg-muted px-2 py-0.5 text-[11.5px] font-semibold text-muted-foreground">désactivé</span>}
          </span>
          {/* Téléphone : une ligne chacun (email, numéro, fiche) pour que le numéro reste lisible ; une seule ligne sur ordinateur. */}
          <span className="mt-0.5 block text-[12.5px] text-muted-foreground sm:truncate">
            {contact.map((part, i) => (
              <span key={i} className="block truncate sm:inline">
                {i > 0 && <span className="hidden sm:inline"> · </span>}
                {part}
              </span>
            ))}
          </span>
          {noSource && <span className="mt-0.5 block text-[12.5px] font-medium text-amber-700 dark:text-amber-400">Pas encore relié à sa fiche commercial</span>}
        </span>
        <span className="hidden shrink-0 text-right text-[12.5px] text-muted-foreground sm:block">{lastSeen(m.last_sign_in_at)}</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
    </li>
  );
}
