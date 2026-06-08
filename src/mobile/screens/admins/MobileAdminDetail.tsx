import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminUsers } from '@/hooks/useAdminData';
import {
  useUpdateAdminProfile,
  useUpdateAdminRole,
  useToggleAdminStatus,
  useResetAdminPassword,
} from '@/hooks/useAdminManagement';
import { useAdminAuth, ADMIN_ROLE_LABELS, type AppRole } from '@/contexts/AdminAuthContext';
import { formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import {
  Mail,
  Calendar,
  Clock,
  Shield,
  Edit2,
  Power,
  Key,
  Copy,
  Check,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  SURFACE,
  TEXT,
  TONE_HOLDER,
  type Tone,
  roleMeta,
  Card,
  StatCard,
  StatusPill,
  Holder,
  BottomSheet,
  FormField,
  TextInput,
  PrimaryPill,
  SoftPill,
  ScreenLoader,
} from '@/mobile/designKit';

const MANAGEABLE_ROLES: AppRole[] = ['super_admin', 'ops', 'cash_agent'];

// Action row in the Ofspace/Mola language: toned round holder + label/desc +
// chevron. No divider hairlines (the card groups items). Mirrors MobileClientDetail.
function ActionRow({
  icon: Icon,
  tone = 'neutral',
  label,
  description,
  onClick,
  destructive,
}: {
  icon: React.ElementType;
  tone?: Tone;
  label: string;
  description?: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3.5 rounded-2xl px-2 py-2.5 text-left transition active:scale-[0.99]"
    >
      <span
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
          destructive ? TONE_HOLDER.danger : TONE_HOLDER[tone],
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-[15px] font-semibold', destructive ? 'text-[#C0504D] dark:text-[#E79A9A]' : TEXT.strong)}>
          {label}
        </span>
        {description && <span className={cn('block truncate text-[12.5px]', TEXT.muted)}>{description}</span>}
      </span>
      <ChevronRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
    </button>
  );
}

export function MobileAdminDetail() {
  const { t } = useTranslation('common');
  const { adminId } = useParams();
  const navigate = useNavigate();
  const { data: admins, isLoading } = useAdminUsers();
  const { currentUser, hasPermission } = useAdminAuth();

  // Mutations
  const updateProfileMutation = useUpdateAdminProfile();
  const updateRoleMutation = useUpdateAdminRole();
  const toggleStatusMutation = useToggleAdminStatus();
  const resetPasswordMutation = useResetAdminPassword();

  // Drawer states
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [statusDrawerOpen, setStatusDrawerOpen] = useState(false);
  const [resetDrawerOpen, setResetDrawerOpen] = useState(false);
  const [passwordResultDrawerOpen, setPasswordResultDrawerOpen] = useState(false);

  // Form states
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editRole, setEditRole] = useState<AppRole>('ops');
  const [newPassword, setNewPassword] = useState('');
  const [passwordCopied, setPasswordCopied] = useState(false);

  const canManageUsers = hasPermission('canManageUsers');
  const admin = admins?.find(a => a.id === adminId);
  const isSelf = admin?.id === currentUser?.id;

  const handleOpenEditDrawer = () => {
    if (!admin) return;
    setEditFirstName(admin.firstName);
    setEditLastName(admin.lastName);
    setEditRole(admin.role as AppRole);
    setEditDrawerOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!admin) return;

    // Update profile
    await updateProfileMutation.mutateAsync({
      userId: admin.id,
      firstName: editFirstName,
      lastName: editLastName,
    });

    // Update role if changed and not self
    if (editRole !== admin.role && !isSelf) {
      await updateRoleMutation.mutateAsync({
        userId: admin.id,
        role: editRole,
      });
    }

    setEditDrawerOpen(false);
  };

  const handleToggleStatus = async () => {
    if (!admin) return;
    await toggleStatusMutation.mutateAsync({
      userId: admin.id,
      disabled: admin.status === 'ACTIVE',
    });
    setStatusDrawerOpen(false);
  };

  const handleResetPassword = async () => {
    if (!admin) return;
    const result = await resetPasswordMutation.mutateAsync(admin.id);
    if (result.tempPassword) {
      setNewPassword(result.tempPassword);
      setResetDrawerOpen(false);
      setPasswordResultDrawerOpen(true);
    }
  };

  const handleCopyPassword = async () => {
    await navigator.clipboard.writeText(newPassword);
    setPasswordCopied(true);
    setTimeout(() => setPasswordCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <MobileHeader title={t('adminDetail', { defaultValue: 'Détail admin' })} showBack backTo="/m/more/admins" />
        <div className={cn('flex-1', SURFACE.canvas)}>
          <ScreenLoader />
        </div>
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="flex min-h-screen flex-col">
        <MobileHeader title={t('adminDetail', { defaultValue: 'Détail admin' })} showBack backTo="/m/more/admins" />
        <div className={cn('flex flex-1 items-center justify-center p-4', SURFACE.canvas)}>
          <p className={TEXT.muted}>{t('adminNotFound', { defaultValue: 'Admin non trouvé' })}</p>
        </div>
      </div>
    );
  }

  const initials = `${admin.firstName?.[0] || ''}${admin.lastName?.[0] || ''}`;
  const isActive = admin.status === 'ACTIVE';

  return (
    <div className="flex min-h-screen flex-col">
      <MobileHeader title={t('adminDetail', { defaultValue: 'Détail admin' })} showBack backTo="/m/more/admins" />

      <div className={cn('flex-1 space-y-4 px-4 py-5', SURFACE.canvas)}>
        {/* Profile Card */}
        <Card className="p-5 text-center">
          <div className="relative mx-auto mb-3 inline-block">
            <div className={cn('flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold', SURFACE.holder)}>
              {initials || '?'}
            </div>
            <span
              className={cn(
                'absolute bottom-1 right-1 h-4 w-4 rounded-full ring-2 ring-white dark:ring-[#211F2B]',
                isActive ? 'bg-[#2E7D52] dark:bg-[#7FCBA0]' : 'bg-[#C0504D] dark:bg-[#E79A9A]',
              )}
            />
          </div>

          <h2 className={cn('text-[20px] font-bold', TEXT.strong)}>
            {admin.firstName} {admin.lastName}
          </h2>

          <div className={cn('mt-1 flex items-center justify-center gap-1.5 text-[13px]', TEXT.muted)}>
            <Mail className="h-3.5 w-3.5" />
            {admin.email}
          </div>

          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <StatusPill
              tone={roleMeta(admin.role).tone}
              label={ADMIN_ROLE_LABELS[admin.role as AppRole] || admin.role}
            />
            <StatusPill
              tone={isActive ? 'success' : 'danger'}
              label={isActive ? t('active', { defaultValue: 'Actif' }) : t('disabled', { defaultValue: 'Désactivé' })}
            />
            {isSelf && (
              <StatusPill tone="neutral" label={t('itsYou', { defaultValue: "C'est vous" })} />
            )}
          </div>
        </Card>

        {/* Info Cards */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={Calendar}
            tone="info"
            label={t('createdOn', { defaultValue: 'Créé le' })}
            value={<span className="text-[15px]">{formatDate(admin.createdAt)}</span>}
          />
          <StatCard
            icon={Clock}
            tone="pending"
            label={t('lastLogin', { defaultValue: 'Dernière connexion' })}
            value={
              <span className="text-[15px]">
                {admin.lastLoginAt
                  ? formatDistanceToNow(new Date(admin.lastLoginAt), { addSuffix: true, locale: fr })
                  : t('never', { defaultValue: 'Jamais' })}
              </span>
            }
          />
        </div>

        {/* Role Info */}
        <Card>
          <div className="flex items-center gap-3">
            <Holder icon={Shield} tone={roleMeta(admin.role).tone} />
            <div>
              <p className={cn('text-[15px] font-semibold', TEXT.strong)}>
                {ADMIN_ROLE_LABELS[admin.role as AppRole] || admin.role}
              </p>
              <p className={cn('text-[13px]', TEXT.muted)}>{t('assignedRole', { defaultValue: 'Rôle attribué' })}</p>
            </div>
          </div>
        </Card>

        {/* Action Cards */}
        {canManageUsers && (
          <Card className="space-y-0.5 p-2">
            <ActionRow
              icon={Edit2}
              tone="info"
              label={t('editProfile', { defaultValue: 'Modifier le profil' })}
              description={t('nameAndRole', { defaultValue: 'Nom, prénom, rôle' })}
              onClick={handleOpenEditDrawer}
            />

            {!isSelf && (
              <ActionRow
                icon={Power}
                tone={isActive ? 'danger' : 'success'}
                label={isActive ? t('deactivateAccount', { defaultValue: 'Désactiver le compte' }) : t('activateAccount', { defaultValue: 'Activer le compte' })}
                description={isActive ? t('blockAccess', { defaultValue: "Bloquer l'accès" }) : t('restoreAccess', { defaultValue: "Restaurer l'accès" })}
                onClick={() => setStatusDrawerOpen(true)}
              />
            )}

            <ActionRow
              icon={Key}
              tone="pending"
              label={isSelf ? t('changeMyPassword', { defaultValue: 'Changer mon mot de passe' }) : t('resetPassword', { defaultValue: 'Réinitialiser mot de passe' })}
              description={isSelf ? t('generateNewPassword', { defaultValue: 'Générer un nouveau mot de passe' }) : t('generateTempPassword', { defaultValue: 'Générer un mot de passe temporaire' })}
              onClick={() => setResetDrawerOpen(true)}
            />
          </Card>
        )}
      </div>

      {/* Edit Sheet */}
      <BottomSheet
        open={editDrawerOpen}
        onClose={() => setEditDrawerOpen(false)}
        title={
          <span className="flex items-center gap-2">
            <Edit2 className="h-5 w-5 text-[#6B5BD2] dark:text-[#A99BF0]" />
            {t('editAdmin', { defaultValue: "Modifier l'admin" })}
          </span>
        }
      >
        <div className="space-y-3">
          <FormField label={t('firstName', { defaultValue: 'Prénom' })} htmlFor="ad-firstName">
            <TextInput
              id="ad-firstName"
              value={editFirstName}
              onChange={(e) => setEditFirstName(e.target.value)}
              autoComplete="given-name"
              enterKeyHint="next"
            />
          </FormField>
          <FormField label={t('lastName', { defaultValue: 'Nom' })} htmlFor="ad-lastName">
            <TextInput
              id="ad-lastName"
              value={editLastName}
              onChange={(e) => setEditLastName(e.target.value)}
              autoComplete="family-name"
              enterKeyHint="done"
            />
          </FormField>
          {!isSelf && (
            <FormField label={t('role', { defaultValue: 'Rôle' })}>
              <div className="grid grid-cols-1 gap-2">
                {MANAGEABLE_ROLES.map((role) => {
                  const active = editRole === role;
                  return (
                    <button
                      key={role}
                      onClick={() => setEditRole(role)}
                      className={cn(
                        'flex items-center gap-3 rounded-2xl p-3 text-left transition',
                        SURFACE.card,
                        SURFACE.shadow,
                        active && 'ring-2 ring-[#6B5BD2] dark:ring-[#A99BF0]',
                      )}
                    >
                      <Holder icon={Shield} tone={roleMeta(role).tone} size="sm" />
                      <span className={cn('flex-1 text-[14px] font-semibold', TEXT.strong)}>{ADMIN_ROLE_LABELS[role]}</span>
                      {active && <Check className="h-4 w-4 text-[#6B5BD2] dark:text-[#A99BF0]" />}
                    </button>
                  );
                })}
              </div>
            </FormField>
          )}
        </div>
        <div className="mt-5 flex flex-col gap-2">
          <PrimaryPill
            onClick={handleSaveEdit}
            loading={updateProfileMutation.isPending || updateRoleMutation.isPending}
            className="w-full"
          >
            {t('save', { defaultValue: 'Enregistrer' })}
          </PrimaryPill>
          <SoftPill onClick={() => setEditDrawerOpen(false)} className="w-full">
            {t('cancel', { defaultValue: 'Annuler' })}
          </SoftPill>
        </div>
      </BottomSheet>

      {/* Toggle Status Sheet */}
      <BottomSheet
        open={statusDrawerOpen}
        onClose={() => setStatusDrawerOpen(false)}
        title={
          <span className={cn('flex items-center gap-2', isActive ? 'text-[#C0504D] dark:text-[#E79A9A]' : TEXT.strong)}>
            <AlertTriangle className="h-5 w-5" />
            {isActive ? t('deactivate', { defaultValue: 'Désactiver' }) : t('reactivate', { defaultValue: 'Réactiver' })} {t('theAdmin', { defaultValue: "l'admin" })}
          </span>
        }
      >
        <p className={cn('text-[14px]', TEXT.muted)}>
          {isActive
            ? t('confirmDeactivateAdmin', { defaultValue: `Voulez-vous vraiment désactiver ${admin.firstName} ${admin.lastName} ? Cet admin ne pourra plus se connecter.`, name: `${admin.firstName} ${admin.lastName}` })
            : t('confirmReactivateAdmin', { defaultValue: `Voulez-vous vraiment réactiver ${admin.firstName} ${admin.lastName} ? Cet admin pourra à nouveau se connecter.`, name: `${admin.firstName} ${admin.lastName}` })}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <PrimaryPill
            danger={isActive}
            onClick={handleToggleStatus}
            loading={toggleStatusMutation.isPending}
            className="w-full"
          >
            {isActive ? t('deactivate', { defaultValue: 'Désactiver' }) : t('reactivate', { defaultValue: 'Réactiver' })}
          </PrimaryPill>
          <SoftPill onClick={() => setStatusDrawerOpen(false)} className="w-full">
            {t('cancel', { defaultValue: 'Annuler' })}
          </SoftPill>
        </div>
      </BottomSheet>

      {/* Reset Password Sheet */}
      <BottomSheet
        open={resetDrawerOpen}
        onClose={() => setResetDrawerOpen(false)}
        title={
          <span className="flex items-center gap-2">
            <Key className="h-5 w-5 text-[#6B5BD2] dark:text-[#A99BF0]" />
            {t('resetPassword', { defaultValue: 'Réinitialiser le mot de passe' })}
          </span>
        }
      >
        <p className={cn('text-[14px]', TEXT.muted)}>
          {isSelf
            ? t('resetPasswordSelfMessage', { defaultValue: 'Un nouveau mot de passe sera généré pour votre compte. Vous devrez vous reconnecter avec ce nouveau mot de passe.' })
            : <>{t('resetPasswordOtherMessage', { defaultValue: 'Un nouveau mot de passe temporaire sera généré pour' })}{' '}
              <strong className={TEXT.strong}>{admin.firstName} {admin.lastName}</strong>. {t('resetPasswordOtherMessageSuffix', { defaultValue: "Vous devrez le transmettre manuellement à l'administrateur." })}</>}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <PrimaryPill onClick={handleResetPassword} loading={resetPasswordMutation.isPending} className="w-full">
            {t('generateNewPassword', { defaultValue: 'Générer nouveau mot de passe' })}
          </PrimaryPill>
          <SoftPill onClick={() => setResetDrawerOpen(false)} className="w-full">
            {t('cancel', { defaultValue: 'Annuler' })}
          </SoftPill>
        </div>
      </BottomSheet>

      {/* Password Result Sheet */}
      <BottomSheet
        open={passwordResultDrawerOpen}
        onClose={() => setPasswordResultDrawerOpen(false)}
        title={
          <span className="flex items-center gap-2">
            <Check className="h-5 w-5 text-[#2E7D52] dark:text-[#7FCBA0]" />
            {t('passwordGenerated', { defaultValue: 'Mot de passe généré' })}
          </span>
        }
      >
        <div className="space-y-4">
          <p className={cn('text-[14px]', TEXT.muted)}>
            {isSelf
              ? t('copyPasswordSelfMessage', { defaultValue: 'Voici votre nouveau mot de passe. Copiez-le avant de fermer cette fenêtre.' })
              : t('copyPasswordOtherMessage', { defaultValue: "Voici le nouveau mot de passe temporaire. Transmettez-le de manière sécurisée à l'administrateur." })}
          </p>
          <div className={cn('flex items-center justify-between gap-3 rounded-2xl p-4', SURFACE.canvas)}>
            <code className={cn('font-mono text-[18px]', TEXT.strong)}>{newPassword}</code>
            <Holder icon={passwordCopied ? Check : Copy} tone={passwordCopied ? 'success' : 'neutral'} size="sm" onClick={handleCopyPassword} />
          </div>
          <p className="rounded-2xl bg-[#F8EFD8] p-3 text-[13px] text-[#9A6B12] dark:bg-[#372D14] dark:text-[#E7C083]">
            {t('passwordWontBeShownAgain', { defaultValue: 'Ce mot de passe ne sera plus affiché après fermeture de cette fenêtre.' })}
          </p>
        </div>
        <div className="mt-5">
          <PrimaryPill onClick={() => setPasswordResultDrawerOpen(false)} className="w-full">
            {t('close', { defaultValue: 'Fermer' })}
          </PrimaryPill>
        </div>
      </BottomSheet>
    </div>
  );
}
