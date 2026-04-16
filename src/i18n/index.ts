import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// French (default)
import frCommon from './locales/fr/common.json';
import frLanding from './locales/fr/landing.json';
import frAuth from './locales/fr/auth.json';
import frFormatters from './locales/fr/formatters.json';
import frAgent from './locales/fr/agent.json';

// English
import enCommon from './locales/en/common.json';
import enLanding from './locales/en/landing.json';
import enAuth from './locales/en/auth.json';
import enFormatters from './locales/en/formatters.json';
import enAgent from './locales/en/agent.json';

// Chinese
import zhCommon from './locales/zh/common.json';
import zhLanding from './locales/zh/landing.json';
import zhAuth from './locales/zh/auth.json';
import zhFormatters from './locales/zh/formatters.json';
import zhAgent from './locales/zh/agent.json';

export const supportedLanguages = ['fr', 'en', 'zh'] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

export const languageNames: Record<SupportedLanguage, string> = {
  fr: 'Fran\u00e7ais',
  en: 'English',
  zh: '\u4e2d\u6587',
};

/** BCP 47 locale used by Intl APIs (dates, numbers, currencies) */
export const localeMap: Record<SupportedLanguage, string> = {
  fr: 'fr-FR',
  en: 'en-US',
  zh: 'zh-CN',
};

export function getCurrentLocale(): string {
  return localeMap[(i18n.language as SupportedLanguage) ?? 'fr'] ?? 'fr-FR';
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: { common: frCommon, landing: frLanding, auth: frAuth, formatters: frFormatters, agent: frAgent },
      en: { common: enCommon, landing: enLanding, auth: enAuth, formatters: enFormatters, agent: enAgent },
      zh: { common: zhCommon, landing: zhLanding, auth: zhAuth, formatters: zhFormatters, agent: zhAgent },
    },
    fallbackLng: 'fr',
    defaultNS: 'common',
    ns: ['common', 'landing', 'auth', 'formatters', 'agent'],
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'bonzini-language',
      caches: ['localStorage'],
    },
  });

export default i18n;
