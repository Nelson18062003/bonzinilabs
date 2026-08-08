/**
 * Administrateurs — accounts, roles and access.
 *
 * Two substantive fixes on top of the visual rework:
 *  · the role filter now covers **all six** roles instead of three, so
 *    `treasurer`, `support` and `customer_success` accounts stop being
 *    invisible in the only screen that lists them;
 *  · a per-role headcount strip, because "who can move money" is the question
 *    this screen exists to answer.
 *
 * Data layer unchanged (`useAdminUsers`); the detail panel reuses the mobile
 * admin file so the profile / role / password workflows stay identical.
 */
import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Plus, RefreshCw, Search, ShieldCheck, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAdminUsers } from '@/hooks/useAdminData';
import { useAdminAuth, ADMIN_ROLE_LABELS, type AppRole, type AdminStatus } from '@/contexts/AdminAuthContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { formatDate } from '@/lib/formatters';
import { roleMeta } from '@/mobile/designKit';
import { cn } from '@/lib/utils';
import { MobileAdminDetail } from '@/mobile/screens/admins';
import { DT, DFG } from '@/desktop/ui/tokens';
import { Avatar, Badge, Button, Chip, EmptyState, IconButton, Input } from '@/desktop/ui/primitives';
import { DataTable, type Column } from '@/desktop/ui/DataTable';
import { FilterGroup, ScreenHead, Toolbar, Workbench } from '@/desktop/ui/layout';

type RoleFilter = AppRole | 'all';
type StatusFilter = AdminStatus | 'all';

/** Every role the platform defines — the old list only showed three of six. */
const ROLE_FILTERS: { value: RoleFilter; label: string }[] = [
  { value: 'all', label: 'Tous' },
  ...(Object.keys(ADMIN_ROLE_LABELS) as AppRole[]).map((r) => ({ value: r, label: ADMIN_ROLE_LABELS[r] })),
];

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Tous' },
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

  const rows = useMemo(
    () =>
      (admins ?? []).filter((a) => {
        if (roleFilter !== 'all' && a.role !== roleFilter) return false;
        if (statusFilter !== 'all' && a.status !== statusFilter) return false;
        if (!debouncedSearch) return true;
        const q = debouncedSearch.toLowerCase();
        return `${a.firstName} ${a.lastName}`.toLowerCase().includes(q) || a.email.toLowerCase().includes(q);
      }),
    [admins, roleFilter, statusFilter, debouncedSearch],
  );

  const countByRole = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of admins ?? []) map.set(a.role, (map.get(a.role) ?? 0) + 1);
    return map;
  }, [admins]);

  if (!canManageUsers) return <Navigate to="/m" replace />;

  const disabledCount = (admins ?? []).filter((a) => a.status === 'DISABLED').length;
  const hasFilters = roleFilter !== 'all' || statusFilter !== 'all' || !!debouncedSearch;

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'name',
      header: 'Administrateur',
      cell: (a) => {
        const name = `${a.firstName} ${a.lastName}`.trim();
        return (
          <span className="flex items-center gap-2.5">
            <Avatar name={name} />
            <span className="min-w-0">
              <span className={cn('flex items-center gap-1.5 truncate font-semibold', DFG.strong)}>
                {name || '—'}
                {a.id === currentUser?.id ? <Badge tone="info">Vous</Badge> : null}
              </span>
              <span className={cn('block truncate text-[11px]', DFG.muted)}>{a.email}</span>
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

  return (
    <Workbench
      head={
        <ScreenHead
          title={t('administrators', { defaultValue: 'Administrateurs' })}
          subtitle={
            hasFilters
              ? `${rows.length} sur ${admins?.length ?? 0} compte${(admins?.length ?? 0) > 1 ? 's' : ''}`
              : `${admins?.length ?? 0} compte${(admins?.length ?? 0) > 1 ? 's' : ''}${disabledCount ? ` · ${disabledCount} désactivé${disabledCount > 1 ? 's' : ''}` : ''}`
          }
          actions={
            <>
              <IconButton icon={RefreshCw} label="Actualiser" loading={isFetching} onClick={() => refetch()} />
              <Button variant="primary" icon={Plus} onClick={() => navigate('/m/more/admins/new')}>
                Nouvel administrateur
              </Button>
            </>
          }
        />
      }
      metrics={
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cn(DT.micro, DFG.muted, 'mr-1')}>Effectif par rôle</span>
          {(Object.keys(ADMIN_ROLE_LABELS) as AppRole[]).map((r) => (
            <Badge key={r} tone={roleMeta(r).tone}>
              {ADMIN_ROLE_LABELS[r]} · {countByRole.get(r) ?? 0}
            </Badge>
          ))}
        </div>
      }
      toolbar={
        <Toolbar
          trailing={
            hasFilters ? (
              <Button variant="ghost" icon={X} onClick={() => { setRoleFilter('all'); setStatusFilter('all'); setSearch(''); }}>
                Réinitialiser
              </Button>
            ) : undefined
          }
        >
          <div className="relative mr-1 w-64">
            <Search className={cn('pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2', DFG.muted)} />
            <Input
              type="search"
              aria-label="Rechercher un administrateur"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom ou email…"
              className="pl-8"
            />
          </div>
          <FilterGroup label="Rôle">
            {ROLE_FILTERS.map((f) => (
              <Chip key={f.value} active={roleFilter === f.value} onClick={() => setRoleFilter(f.value)}>
                {f.label}
              </Chip>
            ))}
          </FilterGroup>
          <FilterGroup label="Statut">
            {STATUS_FILTERS.map((f) => (
              <Chip key={f.value} active={statusFilter === f.value} onClick={() => setStatusFilter(f.value)}>
                {f.label}
              </Chip>
            ))}
          </FilterGroup>
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
              hint={hasFilters ? 'Essayez de modifier ou réinitialiser vos filtres.' : undefined}
            />
          )
        }
      />
    </Workbench>
  );
}
