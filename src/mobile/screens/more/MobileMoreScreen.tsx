import { useTranslation } from 'react-i18next';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAdminNotificationCount } from '@/hooks/useAdminNotifications';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  FileText,
  History,
  Bell,
  UserCog,
  BarChart3,
  Bot,
  LogOut,
  ChevronRight,
  Settings,
  Coins,
  MessageCircle,
  MessageSquareQuote,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggleCompact } from '@/components/ui/ThemeToggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useAdminConversations } from '@/hooks/useAdminChat';
import { SURFACE, TEXT, TONE_HOLDER, Card, SectionTitle } from '@/mobile/designKit';

interface MenuRowProps {
  icon: React.ElementType;
  label: string;
  description?: string;
  onClick: () => void;
  destructive?: boolean;
  badge?: string;
}

// Nav row in the Ofspace/Mola language: neutral round holder + label/desc + an
// optional count pill + chevron. No divider hairlines (cards group items).
function MenuRow({ icon: Icon, label, description, onClick, destructive, badge }: MenuRowProps) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3.5 rounded-2xl px-2 py-2.5 text-left transition active:scale-[0.99]"
    >
      <span
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
          destructive ? TONE_HOLDER.danger : SURFACE.holder,
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
      {badge && (
        <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#D14343] px-1.5 text-[11px] font-bold text-white">
          {badge}
        </span>
      )}
      <ChevronRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
    </button>
  );
}

export function MobileMoreScreen() {
  const { t } = useTranslation('common');
  const { profile, logout, canManageUsers, hasPermission } = useAdminAuth();
  const canViewTreasury = hasPermission('canViewTreasury');
  const canAccessSupportChat = hasPermission('canAccessSupportChat');
  const { data: notifCount } = useAdminNotificationCount();
  const { data: convs } = useAdminConversations();
  const supportUnreadTotal = canAccessSupportChat
    ? (convs ?? []).reduce((sum, c) => sum + (c.unread_count_admin || 0), 0)
    : 0;
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/m/login');
  };

  return (
    <div className="flex min-h-full flex-col">
      <MobileHeader title={t('more', { defaultValue: 'Plus' })} />

      <div className={cn('flex-1 space-y-5 px-4 py-5', SURFACE.canvas)}>
        {/* Profile — cliquable pour éditer */}
        <button
          onClick={() => navigate('/m/more/profile')}
          className={cn('flex w-full items-center gap-4 rounded-[22px] p-4 text-left transition active:scale-[0.99]', SURFACE.card, SURFACE.shadow)}
        >
          <div className={cn('flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full text-xl font-bold', SURFACE.holder)}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <>{profile?.first_name?.[0] || '?'}{profile?.last_name?.[0] || ''}</>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className={cn('truncate text-[18px] font-bold', TEXT.strong)}>
              {profile?.first_name || 'Mon profil'} {profile?.last_name}
            </p>
            <p className={cn('text-[13px]', TEXT.muted)}>Modifier mes informations</p>
          </div>
          <ChevronRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
        </button>

        {/* Outils */}
        <div>
          <SectionTitle>{t('tools', { defaultValue: 'Outils' })}</SectionTitle>
          <Card className="space-y-0.5 p-2">
            <MenuRow
              icon={Bot}
              label="Mola"
              description="Pose une question sur la plateforme"
              onClick={() => navigate('/m/assistant')}
            />
            <MenuRow
              icon={BarChart3}
              label="Dashboard"
              description={t('reportsAndKPIs', { defaultValue: 'Rapports et indicateurs clés' })}
              onClick={() => navigate('/m/dashboard')}
            />
            <MenuRow
              icon={TrendingUp}
              label={t('exchangeRate', { defaultValue: 'Taux de change' })}
              description={t('manageRates', { defaultValue: 'Gérer les taux XAF/RMB' })}
              onClick={() => navigate('/m/more/rates')}
            />
            {canViewTreasury && (
              <MenuRow
                icon={Coins}
                label="Trésorerie"
                description="Achats/ventes USDT, soldes, inventaire"
                onClick={() => navigate('/m/more/treasury')}
              />
            )}
          </Card>
        </div>

        {/* Activité */}
        <div>
          <SectionTitle>{t('activity', { defaultValue: 'Activité' })}</SectionTitle>
          <Card className="space-y-0.5 p-2">
            <MenuRow
              icon={FileText}
              label={t('proofs', { defaultValue: 'Justificatifs' })}
              description={t('viewDepositProofs', { defaultValue: 'Voir les preuves de dépôts' })}
              onClick={() => navigate('/m/more/proofs')}
            />
            <MenuRow
              icon={History}
              label={t('history', { defaultValue: 'Historique' })}
              description={t('activityLog', { defaultValue: "Journal d'activité" })}
              onClick={() => navigate('/m/more/history')}
            />
            <MenuRow
              icon={Bell}
              label={t('notifications', { defaultValue: 'Notifications' })}
              description={t('notificationCenter', { defaultValue: 'Centre de notifications' })}
              onClick={() => navigate('/m/more/notifications')}
              badge={notifCount && notifCount > 0 ? String(notifCount) : undefined}
            />
          </Card>
        </div>

        {/* Support */}
        {canAccessSupportChat && (
          <div>
            <SectionTitle>{t('support', { defaultValue: 'Support' })}</SectionTitle>
            <Card className="space-y-0.5 p-2">
              <MenuRow
                icon={MessageCircle}
                label="Support chat"
                description="Conversations avec les clients"
                onClick={() => navigate('/m/support')}
                badge={supportUnreadTotal > 0 ? String(supportUnreadTotal) : undefined}
              />
              <MenuRow
                icon={MessageSquareQuote}
                label="Templates support"
                description="Réponses pré-enregistrées avec variables"
                onClick={() => navigate('/m/more/canned-responses')}
              />
              <MenuRow
                icon={Sparkles}
                label="Quick replies clients"
                description="Suggestions affichées aux nouveaux clients"
                onClick={() => navigate('/m/more/quick-replies')}
              />
            </Card>
          </div>
        )}

        {/* Administration */}
        <div>
          <SectionTitle>{t('administration', { defaultValue: 'Administration' })}</SectionTitle>
          <Card className="space-y-0.5 p-2">
            {canManageUsers && (
              <MenuRow
                icon={UserCog}
                label={t('administrators', { defaultValue: 'Administrateurs' })}
                description={t('manageAdminAccess', { defaultValue: 'Gérer les accès admin' })}
                onClick={() => navigate('/m/more/admins')}
              />
            )}
            <MenuRow
              icon={Settings}
              label={t('settings', { defaultValue: 'Paramètres' })}
              description={t('themePreferences', { defaultValue: 'Thème, préférences' })}
              onClick={() => navigate('/m/more/settings')}
            />
          </Card>
        </div>

        {/* Langue & Thème */}
        <Card className="space-y-1 p-4">
          <div className="flex items-center justify-between py-1">
            <span className={cn('text-[13.5px] font-medium', TEXT.muted)}>{t('language', { defaultValue: 'Langue' })}</span>
            <LanguageSwitcher />
          </div>
          <div className="flex items-center justify-between py-1">
            <span className={cn('text-[13.5px] font-medium', TEXT.muted)}>{t('theme', { defaultValue: 'Thème' })}</span>
            <ThemeToggleCompact />
          </div>
        </Card>

        {/* Déconnexion */}
        <Card className="p-2">
          <MenuRow
            icon={LogOut}
            label={t('logout', { defaultValue: 'Déconnexion' })}
            onClick={handleLogout}
            destructive
          />
        </Card>
      </div>
    </div>
  );
}
