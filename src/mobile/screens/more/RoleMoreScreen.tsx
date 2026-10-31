/**
 * « Plus » des espaces de terrain (réception, entrepôt, agent cash,
 * commercial) — refonte v2. Chaque rôle y retrouve Moi en tête (écran natif
 * dans l'app), ce qui est rare dans son métier, la langue et la déconnexion.
 */
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { KeyRound, type LucideIcon } from 'lucide-react';
import { supportedLanguages, languageNames, type SupportedLanguage } from '@/i18n';
import { persistPreferredLocale } from '@/lib/persistLocale';
import { isNativeApp } from '@/lib/nativeApp';
import { BoxSegmented, IconCircle, ItemList, ItemRow, SectionHead, TabTop } from '@/mobile/designKit';
import { LogoutRow } from './LogoutRow';
import { ProfileCard } from './ProfileCard';

export interface RoleMoreLink {
  label: string;
  icon: LucideIcon;
  to: string;
  hint?: string;
  badge?: number;
}

export function RoleMoreScreen({
  links = [], loginPath, profilePath, showLanguage = true, passwordPath,
}: {
  links?: RoleMoreLink[];
  /** Où revenir après la déconnexion (/r/login…). */
  loginPath: string;
  /** La page de profil sur le site (hors app). */
  profilePath?: string;
  showLanguage?: boolean;
  /** Changer son mot de passe (sur le site ; dans l'app, c'est dans Moi). */
  passwordPath?: string;
}) {
  const { t, i18n } = useTranslation('common');
  const navigate = useNavigate();
  const lang = (i18n.language?.slice(0, 2) ?? 'fr') as SupportedLanguage;

  return (
    <div className="flex min-h-full flex-col pb-6">
      <TabTop title={t('more', { defaultValue: 'Plus' })} />
      <div className="px-5 pt-2">
        <ProfileCard webPath={profilePath} />
      </div>

      {links.length > 0 && (
        <ItemList className="mt-4">
          {links.map((l) => (
            <ItemRow
              key={l.to}
              leading={<IconCircle icon={l.icon} />}
              title={l.label}
              subtitle={l.hint}
              tag={l.badge ? { tone: 'pending', label: String(l.badge) } : undefined}
              onClick={() => navigate(l.to)}
              chevron
            />
          ))}
        </ItemList>
      )}

      {showLanguage && (
        <>
          <SectionHead title={t('language', { defaultValue: 'Langue' })} />
          <div className="px-5 pt-1">
            <BoxSegmented<SupportedLanguage>
              ariaLabel={t('language', { defaultValue: 'Langue' })}
              options={supportedLanguages.map((l) => ({ value: l, label: languageNames[l] }))}
              value={lang}
              onChange={(l) => { void i18n.changeLanguage(l); void persistPreferredLocale(l); }}
            />
          </div>
        </>
      )}

      <ItemList className="mt-6">
        {passwordPath && !isNativeApp() && (
          <ItemRow leading={<IconCircle icon={KeyRound} />} title={t('changePassword', { defaultValue: 'Mot de passe' })} onClick={() => navigate(passwordPath)} chevron />
        )}
        <LogoutRow loginPath={loginPath} />
      </ItemList>
    </div>
  );
}
