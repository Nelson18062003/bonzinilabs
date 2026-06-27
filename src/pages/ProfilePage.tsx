// ============================================================
// APP CLIENT — ProfilePage · refonte « Direction A ».
// Carte identité premium (sans dégradé) · sections Compte / Préférences
// (langue, thème) · déconnexion. Logique 100% PRÉSERVÉE (signOut, nav,
// LanguageSwitcher, ThemeToggle, menu).
// ============================================================
import { useMyProfile } from '@/hooks/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ChevronRight, Bell, Shield, HelpCircle, LogOut, Smartphone, Globe, FileText, Palette,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { SURFACE, TEXT } from '@/mobile/designKit';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

const DIVIDER = 'border-b border-black/[0.05] dark:border-white/[0.07]';

function MenuRow({
  icon: Icon,
  label,
  desc,
  right,
  onClick,
  last,
}: {
  icon: typeof Bell;
  label: string;
  desc?: string;
  right?: React.ReactNode;
  onClick?: () => void;
  last?: boolean;
}) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick}
      className={cn('flex w-full items-center gap-3 px-4 py-3.5 text-left transition active:bg-black/[0.02] dark:active:bg-white/[0.03]', !last && DIVIDER)}
    >
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', SURFACE.holder)}>
        <Icon className="h-5 w-5" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn('text-[14px] font-bold', TEXT.strong)}>{label}</div>
        {desc && <div className={cn('mt-0.5 text-[12px]', TEXT.muted)}>{desc}</div>}
      </div>
      {right ?? <ChevronRight className={cn('h-4 w-4 shrink-0', TEXT.muted)} />}
    </Wrapper>
  );
}

function initialsOf(first?: string | null, last?: string | null): string {
  const f = (first || '').trim();
  const l = (last || '').trim();
  if (f && l) return (f[0] + l[0]).toUpperCase();
  if (f) return f.slice(0, 2).toUpperCase();
  return '?';
}

const ProfilePage = () => {
  const { user, signOut } = useAuth();
  const { data: profile } = useMyProfile();
  const navigate = useNavigate();
  const { t } = useTranslation('client');

  const handleLogout = async () => {
    await signOut();
    toast.success(t('profile.logoutSuccess'));
    navigate('/auth', { replace: true });
  };

  const comingSoon = () => toast.info(t('profile.comingSoon'));

  return (
    <MobileLayout>
      <div className={cn('min-h-[100dvh] space-y-5 px-4 pb-6 pt-6', SURFACE.canvas)}>
        <h1 className={cn('px-1 text-[26px] font-black leading-tight', TEXT.strong)}>{t('profile.title')}</h1>

        {/* Carte identité — premium, sans dégradé */}
        <div className={cn('flex items-center gap-4 rounded-[24px] p-5', SURFACE.card, SURFACE.shadow)}>
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#1C1B22] text-[22px] font-black text-white dark:bg-[#F2F1F7] dark:text-[#1B1A24]">
            {initialsOf(profile?.first_name, profile?.last_name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className={cn('truncate text-[18px] font-black', TEXT.strong)}>
              {profile ? `${profile.first_name} ${profile.last_name}` : ' '}
            </div>
            {profile?.company_name && <div className={cn('truncate text-[12px] font-semibold', TEXT.muted)}>{profile.company_name}</div>}
            <div className={cn('mt-0.5 truncate text-[13px]', TEXT.muted)}>{user?.email}</div>
            {profile?.phone && <div className={cn('truncate text-[13px]', TEXT.muted)}>{profile.phone}</div>}
          </div>
        </div>

        {/* Compte */}
        <section>
          <h2 className={cn('mb-2 px-1 text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>{t('profile.sectionAccount', { defaultValue: 'Compte' })}</h2>
          <div className={cn('overflow-hidden rounded-[22px]', SURFACE.card, SURFACE.shadow)}>
            <MenuRow icon={Bell} label={t('profile.notifications')} desc={t('profile.notificationsDesc')} onClick={() => navigate('/notifications')} />
            <MenuRow icon={Shield} label={t('profile.security')} desc={t('profile.securityDesc')} onClick={comingSoon} />
            <MenuRow icon={Smartphone} label={t('profile.devices')} desc={t('profile.devicesDesc')} onClick={comingSoon} />
            <MenuRow icon={FileText} label={t('profile.documents')} desc={t('profile.documentsDesc')} onClick={comingSoon} />
            <MenuRow icon={HelpCircle} label={t('profile.helpSupport')} desc={t('profile.helpSupportDesc')} onClick={comingSoon} last />
          </div>
        </section>

        {/* Préférences */}
        <section>
          <h2 className={cn('mb-2 px-1 text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>{t('profile.sectionPreferences', { defaultValue: 'Préférences' })}</h2>
          <div className={cn('overflow-hidden rounded-[22px]', SURFACE.card, SURFACE.shadow)}>
            <MenuRow icon={Globe} label={t('profile.language')} right={<LanguageSwitcher />} />
            <MenuRow icon={Palette} label={t('profile.appearance')} desc={t('profile.appearanceDesc')} right={<ThemeToggle />} last />
          </div>
        </section>

        {/* Déconnexion */}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-[22px] bg-[#FBE7E7] px-4 py-4 text-left transition active:scale-[0.99] dark:bg-[#3A2526]"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/60 dark:bg-black/20">
            <LogOut className="h-5 w-5 text-[#C0504D] dark:text-[#E79A9A]" />
          </div>
          <span className="text-[14px] font-bold text-[#C0504D] dark:text-[#E79A9A]">{t('profile.logout')}</span>
        </button>

        <p className={cn('text-center text-[11px]', TEXT.muted)}>{t('profile.version')}</p>
      </div>
    </MobileLayout>
  );
};

export default ProfilePage;
