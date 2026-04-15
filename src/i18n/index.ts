import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

/** Languages available in the main client/admin app UI switcher */
export const SUPPORTED_LANGUAGES = ['fr', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** All languages with translation files (includes agent-only zh) */
export const ALL_LANGUAGES = ['fr', 'en', 'zh'] as const;

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  fr: 'Français',
  en: 'English',
};

export const LANGUAGE_FLAGS: Record<SupportedLanguage, string> = {
  fr: '🇫🇷',
  en: '🇬🇧',
};

export const DEFAULT_LANGUAGE: SupportedLanguage = 'fr';
export const LANGUAGE_STORAGE_KEY = 'bonzini-language';

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // Supported languages — includes zh for agent cash surface
    supportedLngs: ALL_LANGUAGES,
    fallbackLng: DEFAULT_LANGUAGE,
    defaultNS: 'common',

    // Language detection configuration
    detection: {
      // Order of sources to detect language from
      order: ['localStorage', 'navigator'],
      // Key used in localStorage
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      // Cache the detected language in localStorage
      caches: ['localStorage'],
    },

    // Backend configuration — load JSON files from /public/locales/
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },

    // Namespace configuration
    ns: ['common', 'auth', 'wallet', 'payments', 'deposits', 'history', 'profile', 'notifications', 'beneficiaries', 'rates', 'agent'],
    preload: [DEFAULT_LANGUAGE],

    // Interpolation
    interpolation: {
      // React already escapes values — no need to escape here
      escapeValue: false,
    },

    // In development, log warnings about missing keys
    ...(import.meta.env.DEV && {
      debug: false,
      saveMissing: false,
    }),
  });

export default i18n;
