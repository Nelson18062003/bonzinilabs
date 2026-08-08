/**
 * Administrateurs — accounts, roles and access.
 *
 * A screen consulted a few times a month, so it earns fewer controls than the
 * ones an operator lives in. Two structural fixes over the first pass:
 *
 *  · The role filter covers **all six** roles, so `treasurer`, `support` and
 *    `customer_success` accounts stop being invisible in the only screen that
 *    lists them.
 *  · The per-role headcount is *on* the role chips instead of in a parallel row
 *    of look-alike badges above them. The badge row was not clickable, said the
 *    same six words as the chips 8px below it, and — being computed over the
 *    unfiltered roster while the table rendered the filtered one — contradicted
 *    the list as soon as any filter was on.
 *
 * Data layer unchanged (`useAdminUsers`); the detail panel reuses the mobile
 * admin file so the profile / role / password workflows stay identical.
 */
import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Plus, RefreshCw, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAdminUsers } from '@/hooks/useAdminData';
import { useAdminAuth, ADMIN_ROLE_LABELS, type AppRole, type AdminStatus } from '@/contexts/AdminAuthContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { formatDate } from '@/lib/formatters';
import { roleMeta } from '@/mobile/designKit';
import { cn } from '@/lib/utils';
import { MobileAdminDetail } from '@/mobile/screens/admins';
import { DT, DFG } from '@/desktop/ui/tokens';
import { Avatar, Badge, Button, Chip, EmptyState, SearchField } from '@/desktop/ui/primitives';
import { FilterPopover, MenuButton, type FilterOption } from '@/desktop/ui/Popover';
import { DataTable, type Column } from '@/desktop/ui/DataTable';
import { ScreenHead, Toolbar, Workbench } from '@/desktop/ui/layout';

type RoleFilter = AppRole | 'all';
type StatusFilter = AdminStatus | 'all';

const ROLES = Object.keys(ADMIN_ROLE_LABELS) as AppRole[];

/** Every role the platform defines — the old list only showed three of six. */
const ROLE_FILTERS: { value: RoleFilter; label: string }[] = [
  { value: 'all', label: 'Tous' },
  ...ROLES.map((r) => ({ value: r as RoleFilter, label: ADMIN_ROLE_LABELS[r] })),
];

/** `all` first: `FilterPopover` treats the first option as the neutral value. */
const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Tous les comptes' },
  { value: 'ACTIVE', label: 'Actifs' },
  { value: 'DISABLED', label: 'Désactivés' },
];

export function DesktopAdminsScreen() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { adminId } = useParams<{ adminId: string }>();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const debouncedSearch = useDebouncedValue(search);

  const { data: admins, isLoading, isError, isFetching, refetch } = useAdminUsers();
  const { currentUser, hasPermission } = useAdminAuth();
  const canManageUsers = hasPermission('canManageUsers');

  /* The roster narrowed by search only — the common pool both filter axes and
     their counts are derived from. */
  const searched = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const list = admins ?? [];
    if (!q) return list;
    return list.filter(
      (a) => `${a.firstName} ${a.lastName}`.toLowerCase().includes(q) || a.email.toLowerCase().includes(q),
    );
  }, [admins, debouncedSearch]);

  const rows = useMemo(
    () =>
      searched.filter(
        (a) =>
          (roleFilter === 'all' || a.role === roleFilter) &&
          (statusFilter === 'all' || a.status === statusFilter),
      ),
    [searched, roleFilter, statusFilter],
  );

  /* ── THE COUNT RULE — do not "simplify" this to `admins` ───────────────
   *
   * Every count shown next to a filter option is computed over the set that
   * option selects from: the roster narrowed by the *other* axes, but never by
   * its own axis.
   *
   *   rôle counts   ← searched, narrowed by statut   (never by rôle)
   *   statut counts ← searched, narrowed by rôle     (never by statut)
   *
   * The count is then a promise: "Trésorier · 2" means clicking it returns two
   * rows, in every filter state. Two consequences a future edit will break if
   * it swaps the pool for the unfiltered `admins`:
   *
   *  1. It reintroduces the defect this screen was rebuilt to remove. The old
   *     headcount badges counted `admins` while the table rendered `rows`, so
   *     filtering to "Désactivés" still announced the full headcount.
   *  2. It makes the `disabled` gate on the chips lie. A role can hold three
   *     people and still match zero rows under the current statut filter; with
   *     unfiltered counts that chip renders enabled and returns nothing.
   *
   * Note the counts are *not* narrowed by the axis they belong to, which is
   * why selecting an option never rewrites its own number — the row of chips
   * stays stable as the operator moves through it. And with no other axis
   * engaged the pool is the whole roster, so the default view still reads as a
   * plain headcount per role, which is the question this screen exists to
   * answer.
   * ────────────────────────────────────────────────────────────────────── */
  const roleCounts = useMemo(() => {
    const pool = searched.filter((a) => statusFilter === 'all' || a.status === statusFilter);
    const map = new Map<RoleFilter, number>([['all', pool.length]]);
    for (const a of pool) map.set(a.role, (map.get(a.role) ?? 0) + 1);
    return map;
  }, [searched, statusFilter]);

  const statusCounts = useMemo(() => {
    const pool = searched.filter((a) => roleFilter === 'all' || a.role === roleFilter);
    const map = new Map<StatusFilter, number>([['all', pool.length]]);
    for (const a of pool) map.set(a.status, (map.get(a.status) ?? 0) + 1);
    return map;
  }, [searched, roleFilter]);

  if (!canManageUsers) return <Navigate to="/m" replace />;

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'name',
      header: 'Administrateur',
      cell: (a) => {
        const name = `${a.firstName} ${a.lastName}`.trim();
        return (
          <span className="flex items-center gap-2">
            <Avatar name={name} />
            <span className="min-w-0">
              <span className={cn('flex items-center gap-1 truncate font-semibold', DFG.strong)}>
                {name || '—'}
                {a.id === currentUser?.id ? <Badge tone="info">Vous</Badge> : null}
              </span>
              <span className={cn('block truncate', DT.label, DFG.muted)}>{a.email}</span>
            </span>
          </span>
        );
      },
    },
    {
      key: 'role',
      header: 'Rôle',
      width: '180px',
      cell: (a) => <Badge tone={roleMeta(a.role).tone}>{ADMIN_ROLE_LABELS[a.role] ?? a.role}</Badge>,
    },
    {
      key: 'status',
      header: 'Statut',
      width: '120px',
      cell: (a) => (
        <Badge tone={a.status === 'ACTIVE' ? 'success' : 'danger'}>{a.status === 'ACTIVE' ? 'Actif' : 'Désactivé'}</Badge>
      ),
    },
    {
      // `user_roles` exposes no last-sign-in column, so the previous
      // "Dernière connexion" column could only ever read "Jamais" for
      // everyone — including the account reading the page. Creation date is
      // the strongest fact this hook actually returns.
      key: 'createdAt',
      header: 'Compte créé',
      align: 'right',
      width: '170px',
      cell: (a) => (
        <span className={cn('whitespace-nowrap', DFG.muted)}>{a.createdAt ? formatDate(a.createdAt) : '—'}</span>
      ),
    },
  ];

  const statusOptions: FilterOption<string>[] = STATUS_FILTERS.map((f) => ({
    value: f.value,
    label: f.label,
    meta: statusCounts.get(f.value) ?? 0,
    disabled: f.value !== 'all' && f.value !== statusFilter && (statusCounts.get(f.value) ?? 0) === 0,
  }));

  return (
    <Workbench
      head={
        <ScreenHead
          title={t('administrators', { defaultValue: 'Administrateurs' })}
          /* The roster total, and only that: it never moves with the filters,
             so it cannot contradict the counts on the chips. The selection
             counts live on the chips and in the popover. */
          subtitle={`${admins?.length ?? 0} compte${(admins?.length ?? 0) > 1 ? 's' : ''} au total`}
          actions={
            <>
              <MenuButton
                items={[
                  {
                    label: 'Actualiser',
                    icon: RefreshCw,
                    onSelect: () => void refetch(),
                    disabled: isFetching,
                    hint: 'Actualisation déjà en cours',
                  },
                ]}
              />
              <Button variant="primary" icon={Plus} onClick={() => navigate('/m/more/admins/new')}>
                Nouvel administrateur
              </Button>
            </>
          }
        />
      }
      toolbar={
        <Toolbar>
          <SearchField
            aria-label="Rechercher un administrateur"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom ou email…"
          />
          {ROLE_FILTERS.map((f) => {
            const n = roleCounts.get(f.value) ?? 0;
            return (
              <Chip
                key={f.value}
                active={roleFilter === f.value}
                // A role nobody holds can only ever return an empty table.
                // Never disable the active chip: that would trap the operator
                // in a selection they cannot leave.
                disabled={f.value !== 'all' && f.value !== roleFilter && n === 0}
                count={n}
                onClick={() => setRoleFilter(f.value)}
              >
                {f.label}
              </Chip>
            );
          })}
          <FilterPopover
            axes={[
              {
                id: 'status',
                label: 'Statut',
                value: statusFilter,
                onChange: (v) => setStatusFilter(v as StatusFilter),
                options: statusOptions,
                neutral: 'all',
              },
            ]}
            /* The popover owns the statut axis only; rôle stays a chip row and
               search is raw (offered on the keystroke, not one debounce later).
               Both narrow the list without touching an axis this popover counts,
               so they have to be declared here or the reset never appears. */
            clearable={!!search || roleFilter !== 'all'}
            onClear={() => {
              setRoleFilter('all');
              setStatusFilter('all');
              setSearch('');
            }}
          />
        </Toolbar>
      }
      inspector={adminId ? <MobileAdminDetail /> : null}
      onCloseInspector={() => navigate('/m/more/admins')}
    >
      <DataTable
        label="Liste des administrateurs"
        rows={rows}
        columns={columns}
        getRowId={(a) => a.id}
        activeId={adminId ?? null}
        onRowClick={(a) => navigate(`/m/more/admins/${a.id}`)}
        isLoading={isLoading}
        empty={
          isError ? (
            <EmptyState
              icon={AlertTriangle}
              title="Impossible de charger les comptes"
              hint="La requête a échoué — la liste n'est pas vide, elle n'a pas pu être lue."
              action={<Button icon={RefreshCw} onClick={() => refetch()}>Réessayer</Button>}
            />
          ) : (
            <EmptyState
              icon={ShieldCheck}
              title="Aucun administrateur"
              hint={
                roleFilter !== 'all' || statusFilter !== 'all' || search.trim() !== ''
                  ? 'Essayez de modifier ou réinitialiser vos filtres.'
                  : undefined
              }
            />
          )
        }
      />
    </Workbench>
  );
}
