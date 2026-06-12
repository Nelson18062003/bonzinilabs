import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminUsers } from '@/hooks/useAdminData';
import { useAdminAuth, ADMIN_ROLE_LABELS, type AppRole, type AdminStatus } from '@/contexts/AdminAuthContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Search, Plus, UserCog } from 'lucide-react';
import { SkeletonListScreen } from '@/mobile/components/ui/SkeletonCard';
import { PullToRefresh } from '@/mobile/components/ui/PullToRefresh';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
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
} from '@/mobile/designKit';

type RoleFilter = AppRole | 'all';
type StatusFilter = AdminStatus | 'all';

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
    <div className="flex min-h-full flex-col pb-20">
      <MobileHeader title={t('administrators', { defaultValue: 'Administrateurs' })} showBack />

      <PullToRefresh
        onRefresh={refetch}
        className={cn('flex-1 space-y-4 overflow-y-auto px-4 py-5', SURFACE.canvas)}
      >
        {/* Search */}
        <div className="relative">
          <Search className={cn('absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2', TEXT.muted)} />
          <TextInput
            type="text"
            placeholder={t('searchAdmin', { defaultValue: 'Rechercher un admin...' })}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Role Filter Chips */}
        <div className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {roleOptions.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setRoleFilter(filter.value)}
              className={cn(
                'whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-semibold transition-colors',
                roleFilter === filter.value ? PRIMARY_PILL : SOFT_PILL,
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Status Filter Chips */}
        <div className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {statusOptions.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              className={cn(
                'whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-semibold transition-colors',
                statusFilter === filter.value ? PRIMARY_PILL : SOFT_PILL,
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Admins List */}
        {isLoading ? (
          <SkeletonListScreen count={4} />
        ) : filteredAdmins && filteredAdmins.length > 0 ? (
          <div className="space-y-3">
            {filteredAdmins.map((admin) => {
              const name = `${admin.firstName ?? ''} ${admin.lastName ?? ''}`.trim() || '?';
              return (
                <button
                  key={admin.id}
                  onClick={() => navigate(`/m/more/admins/${admin.id}`)}
                  className={cn(
                    'w-full rounded-[22px] p-4 text-left transition-transform active:scale-[0.98]',
                    SURFACE.card,
                    SURFACE.shadow,
                  )}
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar + status dot */}
                    <div className="relative">
                      <Avatar name={name} />
                      <span
                        className={cn(
                          'absolute bottom-0 right-0 h-3 w-3 rounded-full ring-2 ring-white dark:ring-[#211F2B]',
                          admin.status === 'ACTIVE'
                            ? 'bg-[#2E7D52] dark:bg-[#7FCBA0]'
                            : 'bg-[#C0504D] dark:bg-[#E79A9A]',
                        )}
                      />
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className={cn('truncate text-[14px] font-semibold', TEXT.strong)}>
                          {admin.firstName} {admin.lastName}
                        </p>
                        {admin.id === currentUser?.id && (
                          <span className={cn('shrink-0 text-[11px]', TEXT.muted)}>
                            ({t('you', { defaultValue: 'vous' })})
                          </span>
                        )}
                      </div>
                      <p className={cn('truncate text-[13px]', TEXT.muted)}>{admin.email}</p>
                    </div>

                    {/* Role badge + last login */}
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <StatusPill
                        tone={roleMeta(admin.role).tone}
                        label={ADMIN_ROLE_LABELS[admin.role as AppRole] || admin.role}
                      />
                      {admin.lastLoginAt && (
                        <span className={cn('text-[10px]', TEXT.muted)}>
                          {formatDistanceToNow(new Date(admin.lastLoginAt), {
                            addSuffix: true,
                            locale: fr,
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Holder icon={UserCog} size="lg" />
            <p className={cn('mt-4 text-[14px] font-medium', TEXT.muted)}>
              {t('noAdminFound', { defaultValue: 'Aucun admin trouvé' })}
            </p>
          </div>
        )}
      </PullToRefresh>

      {/* FAB - Create Admin */}
      {canManageUsers && (
        <button
          onClick={() => navigate('/m/more/admins/new')}
          className={cn(
            'fixed bottom-20 right-4 z-10 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95',
            PRIMARY_PILL,
          )}
        >
          <Plus className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}
