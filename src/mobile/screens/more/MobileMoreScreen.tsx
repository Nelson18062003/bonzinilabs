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
  LogOut,
  ChevronRight,
  Settings,
  Coins,
  MessageCircle,
  MessageSquareQuote,
  Sparkles,
  Newspaper,
  Banknote,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import { supportedLanguages, languageNames, type SupportedLanguage } from '@/i18n';
import { persistPreferredLocale } from '@/lib/persistLocale';
import { useAdminConversations } from '@/hooks/useAdminChat';
import { SURFACE, TEXT, TONE_HOLDER, Card, Chip, SectionTitle, Segmented } from '@/mobile/designKit';

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
      className="flex w-full items-center gap-3.5 rounded-lg px-2 py-2.5 text-left transition active:scale-[0.99]"
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
        <span className={cn('block text-[16px] font-semibold', destructive ? 'text-[#900B09] dark:text-[#FDD3D0]' : TEXT.strong)}>
          {label}
        </span>
        {description && <span className={cn('block break-words text-[16px]', TEXT.muted)}>{description}</span>}
      </span>
      {badge && (
        <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-lg bg-[#EC221F] px-1.5 text-[16px] font-bold text-white">
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
  const { theme, setTheme } = useTheme();
  const { i18n } = useTranslation();
  const currentLang = (i18n.language?.slice(0, 2) ?? 'fr') as SupportedLanguage;
  const selectLanguage = (lang: SupportedLanguage) => { i18n.changeLanguage(lang); void persistPreferredLocale(lang); };

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
          className={cn('flex w-full items-center gap-4 rounded-lg p-4 text-left transition active:scale-[0.99]', SURFACE.card, SURFACE.shadow)}
        >
          <div className={cn('flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full text-xl font-bold', SURFACE.holder)}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <>{profile?.first_name?.[0] || '?'}{profile?.last_name?.[0] || ''}</>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className={cn('break-words text-[20px] font-bold', TEXT.strong)}>
              {profile?.first_name || 'Mon profil'} {profile?.last_name}
            </p>
            <p className={cn('text-[16px]', TEXT.muted)}>Modifier mes informations</p>
          </div>
          <ChevronRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
        </button>

        {/* Outils */}
        <div>
          <SectionTitle>{t('tools', { defaultValue: 'Outils' })}</SectionTitle>
          <Card className="space-y-0.5 p-2">
            <MenuRow
              icon={Banknote}
              label="Coordonnées de paiement"
              description="Banques et Mobile Money · PDF et image à envoyer"
              onClick={() => navigate('/m/more/payment-details')}
            />
            <MenuRow
              icon={BarChart3}
              label="Tableau de bord"
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
                description="Achats et ventes de dollars numériques, soldes"
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
            <MenuRow
              icon={Newspaper}
              label="Veille macro"
              description="Actualité économique et prévisions"
              onClick={() => navigate('/m/more/briefs')}
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
                label="Messages des clients"
                description="Conversations avec les clients"
                onClick={() => navigate('/m/support')}
                badge={supportUnreadTotal > 0 ? String(supportUnreadTotal) : undefined}
              />
              <MenuRow
                icon={MessageSquareQuote}
                label="Réponses toutes faites"
                description="Les phrases qu'on réutilise dans les messages"
                onClick={() => navigate('/m/more/canned-responses')}
              />
              <MenuRow
                icon={Sparkles}
                label="Suggestions aux nouveaux clients"
                description="Ce qu'on propose à un client qui vient d'arriver"
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

        {/* Langue & Thème — des choix qu'on voit tous en même temps, pas un bouton qui tourne. */}
        <Card className="space-y-4">
          <div className="space-y-2">
            <p className={cn('text-[16px] font-semibold', TEXT.strong)}>{t('language', { defaultValue: 'Langue' })}</p>
            <div className="flex flex-wrap gap-2">
              {supportedLanguages.map((lang) => (
                <Chip key={lang} label={languageNames[lang]} active={currentLang === lang} onClick={() => selectLanguage(lang)} />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className={cn('text-[16px] font-semibold', TEXT.strong)}>{t('theme', { defaultValue: 'Thème' })}</p>
            <Segmented
              options={[{ value: 'light', label: 'Clair' }, { value: 'dark', label: 'Sombre' }, { value: 'system', label: 'Auto' }] as const}
              value={(theme ?? 'system') as 'light' | 'dark' | 'system'}
              onChange={setTheme}
            />
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
