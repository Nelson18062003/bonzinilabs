import { useState } from 'react';
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
  Loader2,
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
  X,
} from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const ROLE_BADGE_COLORS: Record<AppRole, string> = {
  super_admin: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  ops: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  support: 'bg-green-500/10 text-green-600 dark:text-green-400',
  customer_success: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  cash_agent: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
};

const MANAGEABLE_ROLES: AppRole[] = ['super_admin', 'ops', 'cash_agent'];

export function MobileAdminDetail() {
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
  const canPerformActions = canManageUsers && !isSelf;

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
      <div className="flex flex-col min-h-screen">
        <MobileHeader title="Détail admin" showBack backTo="/m/more/admins" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="flex flex-col min-h-screen">
        <MobileHeader title="Détail admin" showBack backTo="/m/more/admins" />
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-muted-foreground">Admin non trouvé</p>
        </div>
      </div>
    );
  }

  const initials = `${admin.firstName?.[0] || ''}${admin.lastName?.[0] || ''}`;

  return (
    <div className="flex flex-col min-h-screen pb-4">
      <MobileHeader title="Détail admin" showBack backTo="/m/more/admins" />

      <div className="flex-1 px-4 py-4 space-y-4">
        {/* Profile Header */}
        <div className="bg-card rounded-2xl p-5 border border-border text-center">
          <div className="relative inline-block">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-semibold text-primary mx-auto mb-3">
              {initials}
            </div>
            {/* Status indicator */}
            <div
              className={cn(
                'absolute bottom-3 right-0 w-4 h-4 rounded-full border-2 border-card',
                admin.status === 'ACTIVE' ? 'bg-green-500' : 'bg-red-500'
              )}
            />
          </div>

          <h2 className="text-xl font-semibold">
            {admin.firstName} {admin.lastName}
          </h2>

          <div className="flex items-center justify-center gap-2 text-muted-foreground mt-1">
            <Mail className="w-4 h-4" />
            {admin.email}
          </div>

          <div className="flex flex-wrap gap-2 justify-center mt-3">
            {/* Role Badge */}
            <span
              className={cn(
                'px-3 py-1 rounded-full text-sm font-medium',
                ROLE_BADGE_COLORS[admin.role as AppRole] || 'bg-gray-500/10 text-gray-600 dark:text-gray-400'
              )}
            >
              {ADMIN_ROLE_LABELS[admin.role as AppRole] || admin.role}
            </span>

            {/* Status Badge */}
            <span
              className={cn(
                'px-3 py-1 rounded-full text-sm font-medium',
                admin.status === 'ACTIVE'
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                  : 'bg-red-500/10 text-red-600 dark:text-red-400'
              )}
            >
              {admin.status === 'ACTIVE' ? 'Actif' : 'Désactivé'}
            </span>

            {isSelf && (
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-muted text-muted-foreground">
                C'est vous
              </span>
            )}
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-blue-500" />
              </div>
            </div>
            <p className="text-sm font-medium">{formatDate(admin.createdAt)}</p>
            <p className="text-xs text-muted-foreground">Créé le</p>
          </div>

          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
            </div>
            <p className="text-sm font-medium">
              {admin.lastLoginAt
                ? formatDistanceToNow(new Date(admin.lastLoginAt), {
                    addSuffix: true,
                    locale: fr,
                  })
                : 'Jamais'}
            </p>
            <p className="text-xs text-muted-foreground">Dernière connexion</p>
          </div>
        </div>

        {/* Role Info */}
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="font-medium">
                {ADMIN_ROLE_LABELS[admin.role as AppRole] || admin.role}
              </p>
              <p className="text-sm text-muted-foreground">Rôle attribué</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Cards */}
      {canManageUsers && (
        <div className="px-4 pb-4 space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground px-1">Actions</h3>
          <div className="space-y-2">
            <button
              onClick={handleOpenEditDrawer}
              className="w-full flex items-center gap-3 bg-card rounded-xl p-4 border border-border active:scale-[0.98] transition-transform"
            >
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <Edit2 className="w-5 h-5 text-blue-500" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium">Modifier le profil</p>
                <p className="text-xs text-muted-foreground">Nom, prénom, rôle</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </button>

            {!isSelf && (
              <button
                onClick={() => setStatusDrawerOpen(true)}
                className="w-full flex items-center gap-3 bg-card rounded-xl p-4 border border-border active:scale-[0.98] transition-transform"
              >
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                  admin.status === 'ACTIVE' ? 'bg-red-500/10' : 'bg-green-500/10'
                )}>
                  <Power className={cn('w-5 h-5', admin.status === 'ACTIVE' ? 'text-red-500' : 'text-green-500')} />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium">{admin.status === 'ACTIVE' ? 'Désactiver' : 'Activer'} le compte</p>
                  <p className="text-xs text-muted-foreground">
                    {admin.status === 'ACTIVE' ? 'Bloquer l\'accès' : 'Restaurer l\'accès'}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </button>
            )}

            <button
              onClick={() => setResetDrawerOpen(true)}
              className="w-full flex items-center gap-3 bg-card rounded-xl p-4 border border-border active:scale-[0.98] transition-transform"
            >
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <Key className="w-5 h-5 text-amber-500" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium">{isSelf ? 'Changer mon mot de passe' : 'Réinitialiser mot de passe'}</p>
                <p className="text-xs text-muted-foreground">
                  {isSelf ? 'Générer un nouveau mot de passe' : 'Générer un mot de passe temporaire'}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </button>
          </div>
        </div>
      )}

      {/* Edit Drawer */}
      <Drawer open={editDrawerOpen} onOpenChange={setEditDrawerOpen}>
        <DrawerContent className="flex flex-col" style={{ maxHeight: '92dvh' }}>
          <DrawerHeader className="flex-shrink-0 border-b border-border/20">
            <DrawerTitle>Modifier l'admin</DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-4">
            <div>
              <Label htmlFor="firstName">Prénom</Label>
              <Input
                id="firstName"
                value={editFirstName}
                onChange={(e) => setEditFirstName(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="lastName">Nom</Label>
              <Input
                id="lastName"
                value={editLastName}
                onChange={(e) => setEditLastName(e.target.value)}
                className="mt-1.5"
              />
            </div>
            {!isSelf && (
              <div>
                <Label>Rôle</Label>
                <div className="grid grid-cols-1 gap-2 mt-1.5">
                  {MANAGEABLE_ROLES.map((role) => (
                    <button
                      key={role}
                      onClick={() => setEditRole(role)}
                      className={cn(
                        'p-3 rounded-lg border text-left transition-colors',
                        editRole === role
                          ? 'border-primary bg-primary/5'
                          : 'border-border'
                      )}
                    >
                      <span className="font-medium">{ADMIN_ROLE_LABELS[role]}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DrawerFooter>
            <Button
              onClick={handleSaveEdit}
              disabled={updateProfileMutation.isPending || updateRoleMutation.isPending}
            >
              {(updateProfileMutation.isPending || updateRoleMutation.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Enregistrer
            </Button>
            <Button variant="outline" onClick={() => setEditDrawerOpen(false)}>
              Annuler
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Toggle Status Drawer */}
      <Drawer open={statusDrawerOpen} onOpenChange={setStatusDrawerOpen}>
        <DrawerContent className="flex flex-col" style={{ maxHeight: '92dvh' }}>
          <DrawerHeader className="flex-shrink-0 border-b border-border/20">
            <DrawerTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              {admin.status === 'ACTIVE' ? 'Désactiver' : 'Réactiver'} l'admin
            </DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
            <p className="text-muted-foreground">
              {admin.status === 'ACTIVE'
                ? `Voulez-vous vraiment désactiver ${admin.firstName} ${admin.lastName} ? Cet admin ne pourra plus se connecter.`
                : `Voulez-vous vraiment réactiver ${admin.firstName} ${admin.lastName} ? Cet admin pourra à nouveau se connecter.`}
            </p>
          </div>
          <DrawerFooter>
            <Button
              onClick={handleToggleStatus}
              variant={admin.status === 'ACTIVE' ? 'destructive' : 'default'}
              disabled={toggleStatusMutation.isPending}
            >
              {toggleStatusMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {admin.status === 'ACTIVE' ? 'Désactiver' : 'Réactiver'}
            </Button>
            <Button variant="outline" onClick={() => setStatusDrawerOpen(false)}>
              Annuler
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Reset Password Drawer */}
      <Drawer open={resetDrawerOpen} onOpenChange={setResetDrawerOpen}>
        <DrawerContent className="flex flex-col" style={{ maxHeight: '92dvh' }}>
          <DrawerHeader className="flex-shrink-0 border-b border-border/20">
            <DrawerTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-primary" />
              Réinitialiser le mot de passe
            </DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
            <p className="text-muted-foreground">
              {isSelf
                ? 'Un nouveau mot de passe sera généré pour votre compte. Vous devrez vous reconnecter avec ce nouveau mot de passe.'
                : <>Un nouveau mot de passe temporaire sera généré pour{' '}
                  <strong>{admin.firstName} {admin.lastName}</strong>. Vous devrez le
                  transmettre manuellement à l'administrateur.</>}
            </p>
          </div>
          <DrawerFooter>
            <Button
              onClick={handleResetPassword}
              disabled={resetPasswordMutation.isPending}
            >
              {resetPasswordMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Générer nouveau mot de passe
            </Button>
            <Button variant="outline" onClick={() => setResetDrawerOpen(false)}>
              Annuler
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Password Result Drawer */}
      <Drawer open={passwordResultDrawerOpen} onOpenChange={setPasswordResultDrawerOpen}>
        <DrawerContent className="flex flex-col" style={{ maxHeight: '92dvh' }}>
          <DrawerHeader className="flex-shrink-0 border-b border-border/20">
            <DrawerTitle className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-500" />
              Mot de passe généré
            </DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-4">
            <p className="text-muted-foreground">
              {isSelf
                ? 'Voici votre nouveau mot de passe. Copiez-le avant de fermer cette fenêtre.'
                : 'Voici le nouveau mot de passe temporaire. Transmettez-le de manière sécurisée à l\'administrateur.'}
            </p>
            <div className="bg-muted rounded-lg p-4 flex items-center justify-between">
              <code className="text-lg font-mono">{newPassword}</code>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopyPassword}
              >
                {passwordCopied ? (
                  <Check className="w-5 h-5 text-green-500" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </Button>
            </div>
            <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-500/10 p-3 rounded-lg">
              Ce mot de passe ne sera plus affiché après fermeture de cette fenêtre.
            </p>
          </div>
          <DrawerFooter>
            <Button onClick={() => setPasswordResultDrawerOpen(false)}>
              Fermer
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
