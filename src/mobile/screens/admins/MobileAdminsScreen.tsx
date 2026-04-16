import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminUsers } from '@/hooks/useAdminData';
import { useAdminAuth, ADMIN_ROLE_LABELS, type AppRole, type AdminStatus } from '@/contexts/AdminAuthContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Search, Plus, UserCog } from 'lucide-react';
import { SkeletonListScreen } from '@/mobile/components/ui/SkeletonCard';
import { PullToRefresh } from '@/mobile/components/ui/PullToRefresh';
import { MobileFilterChips } from '@/mobile/components/ui/MobileFilterChips';
import { MobileEmptyState } from '@/mobile/components/ui/MobileEmptyState';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

type RoleFilter = AppRole | 'all';
type StatusFilter = AdminStatus | 'all';

const ROLE_BADGE_COLORS: Record<AppRole, string> = {
  super_admin: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  ops: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  support: 'bg-green-500/10 text-green-600 dark:text-green-400',
  customer_success: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  cash_agent: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
};

export function MobileAdminsScreen() {
  const { t } = useTranslation('common');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const { data: admins, isLoading, refetch } = useAdminUsers();
  const { currentUser, hasPermission } = useAdminAuth();
  const navigate = useNavigate();

  const canManageUsers = hasPermission('canManageUsers');

  const filteredAdmins = admins?.filter(admin => {
    // Role filter
    if (roleFilter !== 'all' && admin.role !== roleFilter) return false;

    // Status filter
    if (statusFilter !== 'all' && admin.status !== statusFilter) return false;

    // Search filter (debounced)
    if (debouncedSearch) {
      const search = debouncedSearch.toLowerCase();
      const name = `${admin.firstName || ''} ${admin.lastName || ''}`.toLowerCase();
      const email = admin.email?.toLowerCase() || '';
      if (!name.includes(search) && !email.includes(search)) return false;
    }

    return true;
  });

  const roleOptions: { value: RoleFilter; label: string }[] = [
    { value: 'all', label: t('all', { defaultValue: 'Tous' }) },
    { value: 'super_admin', label: 'Super Admin' },
    { value: 'ops', label: 'Ops' },
    { value: 'cash_agent', label: 'Agent Cash' },
  ];

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: t('all', { defaultValue: 'Tous' }) },
    { value: 'ACTIVE', label: t('activeUsers', { defaultValue: 'Actifs' }) },
    { value: 'DISABLED', label: t('disabledUsers', { defaultValue: 'Désactivés' }) },
  ];

  return (
    <div className="flex flex-col min-h-full">
      <MobileHeader title={t('administrators', { defaultValue: 'Administrateurs' })} showBack />

      <PullToRefresh onRefresh={refetch} className="flex-1 px-4 py-4 space-y-4 overflow-y-auto">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('searchAdmin', { defaultValue: 'Rechercher un admin...' })}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-lg bg-muted border-0 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Role Filters */}
        <MobileFilterChips
          filters={roleOptions}
          activeKey={roleFilter}
          onChange={setRoleFilter}
        />

        {/* Status Filters */}
        <MobileFilterChips
          filters={statusOptions}
          activeKey={statusFilter}
          onChange={setStatusFilter}
        />

        {/* Admins List */}
        {isLoading ? (
          <SkeletonListScreen count={4} />
        ) : filteredAdmins && filteredAdmins.length > 0 ? (
          <div className="space-y-3">
            {filteredAdmins.map((admin) => (
              <button
                key={admin.id}
                onClick={() => navigate(`/m/more/admins/${admin.id}`)}
                className="w-full bg-card rounded-xl p-4 border border-border text-left active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-base font-medium text-primary flex-shrink-0">
                      {admin.firstName?.[0] || '?'}
                      {admin.lastName?.[0] || ''}
                    </div>
                    {/* Status indicator */}
                    <div
                      className={cn(
                        'absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-card',
                        admin.status === 'ACTIVE' ? 'bg-green-500' : 'bg-red-500'
                      )}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">
                        {admin.firstName} {admin.lastName}
                      </p>
                      {admin.id === currentUser?.id && (
                        <span className="text-xs text-muted-foreground">({t('you', { defaultValue: 'vous' })})</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {admin.email}
                    </p>
                  </div>

                  {/* Role Badge */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-full text-xs font-medium',
                        ROLE_BADGE_COLORS[admin.role as AppRole] || 'bg-gray-100 text-gray-700'
                      )}
                    >
                      {ADMIN_ROLE_LABELS[admin.role as AppRole] || admin.role}
                    </span>
                    {admin.lastLoginAt && (
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(admin.lastLoginAt), {
                          addSuffix: true,
                          locale: fr,
                        })}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <MobileEmptyState icon={UserCog} title={t('noAdminFound', { defaultValue: 'Aucun admin trouvé' })} />
        )}
      </PullToRefresh>

      {/* FAB - Create Admin */}
      {canManageUsers && (
        <button
          onClick={() => navigate('/m/more/admins/new')}
          className="fixed bottom-20 right-4 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform z-10"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}
