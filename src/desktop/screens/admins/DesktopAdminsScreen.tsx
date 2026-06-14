/**
 * Desktop admin — administrators table with master-detail.
 *
 * Same data (useAdminUsers) and filters as MobileAdminsScreen, as a wide table;
 * selecting a row opens the admin's detail in the sticky right panel (reusing
 * the mobile detail screen).
 */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search, Plus, UserCog, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAdminUsers } from '@/hooks/useAdminData';
import { useAdminAuth, ADMIN_ROLE_LABELS, type AppRole, type AdminStatus } from '@/contexts/AdminAuthContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/lib/utils';
import {
  SURFACE,
  TEXT,
  PRIMARY_PILL,
  SOFT_PILL,
  roleMeta,
  Avatar,
  StatusPill,
  TextInput,
  Holder,
  ScreenLoader,
  Card,
} from '@/mobile/designKit';
import { MobileAdminDetail } from '@/mobile/screens/admins';
import { MasterDetailLayout } from '@/desktop/components/MasterDetailLayout';

type RoleFilter = AppRole | 'all';
type StatusFilter = AdminStatus | 'all';

const ROLE_FILTERS: { value: RoleFilter; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'ops', label: 'Ops' },
  { value: 'cash_agent', label: 'Agent Cash' },
];
const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'ACTIVE', label: 'Actifs' },
  { value: 'DISABLED', label: 'Désactivés' },
];

export function DesktopAdminsScreen() {
  const navigate = useNavigate();
  const { adminId } = useParams<{ adminId: string }>();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const { data: admins, isLoading } = useAdminUsers();
  const { currentUser, hasPermission } = useAdminAuth();
  const canManageUsers = hasPermission('canManageUsers');

  const filteredAdmins = admins?.filter((admin) => {
    if (roleFilter !== 'all' && admin.role !== roleFilter) return false;
    if (statusFilter !== 'all' && admin.status !== statusFilter) return false;
    if (debouncedSearch) {
      const search = debouncedSearch.toLowerCase();
      const name = `${admin.firstName || ''} ${admin.lastName || ''}`.toLowerCase();
      const email = admin.email?.toLowerCase() || '';
      if (!name.includes(search) && !email.includes(search)) return false;
    }
    return true;
  });

  return (
    <MasterDetailLayout detail={adminId ? <MobileAdminDetail /> : null}>
      <div className="space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className={cn('text-[26px] font-extrabold tracking-tight', TEXT.strong)}>Administrateurs</h2>
            <p className={cn('mt-1 text-[14px]', TEXT.muted)}>
              {filteredAdmins ? `${filteredAdmins.length} compte${filteredAdmins.length > 1 ? 's' : ''}` : '—'}
            </p>
          </div>
          {canManageUsers && (
            <button
              onClick={() => navigate('/m/more/admins/new')}
              className={cn('inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-bold', PRIMARY_PILL)}
            >
              <Plus className="h-4 w-4" /> Nouvel admin
            </button>
          )}
        </header>

        {/* Toolbar */}
        <section className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-full max-w-sm">
            <Search className={cn('pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2', TEXT.muted)} />
            <TextInput
              placeholder="Rechercher un admin…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10 text-[14px]"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} aria-label="Effacer" className={cn('absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1', TEXT.muted)}>
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {ROLE_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setRoleFilter(f.value)}
                className={cn('rounded-full px-3.5 py-2 text-[12px] font-semibold transition-colors', roleFilter === f.value ? PRIMARY_PILL : SOFT_PILL)}
              >
                {f.label}
              </button>
            ))}
            <span className="mx-1 h-5 w-px bg-black/10 dark:bg-white/10" />
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={cn('rounded-full px-3.5 py-2 text-[12px] font-semibold transition-colors', statusFilter === f.value ? PRIMARY_PILL : SOFT_PILL)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </section>

        {/* Table */}
        <Card className="overflow-hidden p-0">
          {isLoading ? (
            <ScreenLoader />
          ) : filteredAdmins && filteredAdmins.length > 0 ? (
            <table className="w-full text-left">
              <thead>
                <tr className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>
                  <th scope="col" className="px-5 py-3 font-bold">Administrateur</th>
                  <th scope="col" className="px-2 py-3 font-bold">Email</th>
                  <th scope="col" className="px-2 py-3 font-bold">Rôle</th>
                  <th scope="col" className="px-5 py-3 text-right font-bold">Dernière connexion</th>
                </tr>
              </thead>
              <tbody>
                {filteredAdmins.map((admin) => {
                  const name = `${admin.firstName ?? ''} ${admin.lastName ?? ''}`.trim() || '?';
                  return (
                    <tr
                      key={admin.id}
                      onClick={() => navigate(`/m/more/admins/${admin.id}`)}
                      className={cn(
                        'cursor-pointer border-t border-black/[0.05] transition hover:bg-[#EDEAFA]/40 dark:border-white/[0.05] dark:hover:bg-white/[0.04]',
                        adminId === admin.id && 'bg-[#EDEAFA]/70 dark:bg-white/[0.06]',
                      )}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="relative">
                            <Avatar name={name} size="sm" />
                            <span
                              className={cn(
                                'absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-[#211F2B]',
                                admin.status === 'ACTIVE' ? 'bg-[#2E7D52] dark:bg-[#7FCBA0]' : 'bg-[#C0504D] dark:bg-[#E79A9A]',
                              )}
                            />
                          </div>
                          <span className={cn('text-[13px] font-semibold', TEXT.strong)}>{name}</span>
                          {admin.id === currentUser?.id && <span className={cn('text-[11px]', TEXT.muted)}>(vous)</span>}
                        </div>
                      </td>
                      <td className={cn('px-2 py-3 text-[13px]', TEXT.muted)}>{admin.email}</td>
                      <td className="px-2 py-3">
                        <StatusPill tone={roleMeta(admin.role).tone} label={ADMIN_ROLE_LABELS[admin.role as AppRole] || admin.role} />
                      </td>
                      <td className={cn('px-5 py-3 text-right text-[12px]', TEXT.muted)}>
                        {admin.lastLoginAt ? formatDistanceToNow(new Date(admin.lastLoginAt), { addSuffix: true, locale: fr }) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Holder icon={UserCog} size="lg" />
              <p className={cn('mt-4 text-[14px] font-medium', TEXT.muted)}>Aucun admin trouvé</p>
            </div>
          )}
        </Card>
      </div>
    </MasterDetailLayout>
  );
}
