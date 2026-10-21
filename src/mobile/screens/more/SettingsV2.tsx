/**
 * Réglages — refonte v2 (maquette 06/16). Le seul endroit de la langue et du
 * thème ; Mon mot de passe ; l'entreprise (Adresses en Chine, Tarifs cargo,
 * écriture réservée à leurs gardes d'avant) ; la version de l'app.
 * Les coordonnées de paiement ont quitté les Réglages : une seule entrée, dans Plus.
 */
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { supportedLanguages, type SupportedLanguage } from '@/i18n';
import { persistPreferredLocale } from '@/lib/persistLocale';
import { isNativeApp } from '@/lib/nativeApp';
import { BoxSegmented, ScreenTop } from '@/mobile/designKit';
import { CapsLabel, ChoiceTiles, SettingRow } from './parts';

const LANG_TILE: Record<SupportedLanguage, { label: string; sub: string }> = {
  fr: { label: 'FR', sub: 'Français' },
  en: { label: 'EN', sub: 'English' },
  zh: { label: '中', sub: '中文' },
};

/** La langue de l'app : i18n tout de suite, la préférence du compte ensuite. */
export function useLanguage() {
  const { i18n } = useTranslation('common');
  const lang = (i18n.language?.slice(0, 2) ?? 'fr') as SupportedLanguage;
  const setLang = (l: SupportedLanguage) => { void i18n.changeLanguage(l); void persistPreferredLocale(l); };
  return { lang, setLang };
}

export function LanguageTiles() {
  const { lang, setLang } = useLanguage();
  return (
    <ChoiceTiles<SupportedLanguage>
      tall
      ariaLabel="Langue"
      value={lang}
      onChange={setLang}
      options={supportedLanguages.map((l) => ({ value: l, label: LANG_TILE[l].label, sub: LANG_TILE[l].sub }))}
    />
  );
}

/** « 3.2.0 » dans l'app BONZINI HQ (son agent utilisateur la porte), sinon le site. */
export function appVersion(): string {
  const m = typeof navigator !== 'undefined' ? navigator.userAgent.match(/BonziniHQ\/([\w.()-]+)/) : null;
  return m ? m[1] : 'Site web';
}

export function SettingsV2() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const current = (theme === 'light' || theme === 'dark' ? theme : 'system') as 'light' | 'dark' | 'system';

  return (
    <div className="flex min-h-full flex-col pb-10">
      <ScreenTop title="Réglages" />
      <div className="px-5 pt-6">
        <CapsLabel className="mb-3">Langue</CapsLabel>
        <LanguageTiles />
        <CapsLabel className="mb-3 mt-7">Thème</CapsLabel>
        <BoxSegmented<'light' | 'dark' | 'system'>
          ariaLabel="Thème"
          value={current}
          onChange={setTheme}
          options={[{ value: 'light', label: 'Clair' }, { value: 'dark', label: 'Sombre' }, { value: 'system', label: 'Auto' }]}
        />
        <CapsLabel className="mt-8">Compte</CapsLabel>
        <SettingRow strong label="Mon mot de passe" onClick={() => navigate('/m/more/password')} />
        {!isNativeApp() && <SettingRow strong label="Clés d'accès" onClick={() => navigate('/m/more/passkeys')} />}
        <CapsLabel className="mt-7">Entreprise</CapsLabel>
        <SettingRow strong label="Adresses en Chine" onClick={() => navigate('/m/more/shipping')} />
        <SettingRow strong label="Tarifs cargo" onClick={() => navigate('/m/more/cargo-pricing')} />
        <SettingRow strong label="Version" value={appVersion()} chevron={false} />
      </div>
    </div>
  );
}
