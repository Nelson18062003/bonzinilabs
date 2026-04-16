/**
 * LanguageContext — backward-compatible bridge to react-i18next.
 *
 * The agent-cash sub-app uses `useLanguage()` with `t(key)` throughout.
 * This module now delegates to react-i18next's `agent` namespace so all
 * translations live in the central i18n system while the calling code
 * remains unchanged.
 */
import { createContext, useContext, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

type Language = 'en' | 'zh' | 'fr';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation('agent');

  const language = (i18n.language?.slice(0, 2) ?? 'fr') as Language;

  const setLanguage = (lang: Language) => {
    i18n.changeLanguage(lang);
  };

  const translate = (key: string): string => {
    const result = t(key);
    // i18next returns the key itself if not found — match old behavior
    if (result === key) {
      console.warn(`Missing translation for key: ${key}`);
    }
    return result;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: translate }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
