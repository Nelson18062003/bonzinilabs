/**
 * LanguageContext — Agent Cash interface (EN / ZH)
 *
 * This context is dedicated to the Agent Cash surface (/a/* routes), which
 * supports English and Chinese (Simplified). It delegates to react-i18next
 * for the "agent" namespace so that strings live in:
 *   public/locales/en/agent.json
 *   public/locales/zh/agent.json
 *
 * The rest of the app uses react-i18next directly via useTranslation().
 */
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export type AgentLanguage = 'en' | 'zh';

interface LanguageContextType {
  language: AgentLanguage;
  setLanguage: (lang: AgentLanguage) => void;
  /** Translate an agent-namespace key using dot-notation (e.g. "actions.confirm_payment") */
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const AGENT_LANGUAGE_KEY = 'agent-language';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AgentLanguage>(() => {
    const saved = localStorage.getItem(AGENT_LANGUAGE_KEY);
    return (saved as AgentLanguage) || 'en';
  });

  const { t: i18nT, i18n } = useTranslation('agent');

  // Keep react-i18next language in sync with the agent language choice
  useEffect(() => {
    i18n.changeLanguage(language);
    localStorage.setItem(AGENT_LANGUAGE_KEY, language);
  }, [language, i18n]);

  const setLanguage = (lang: AgentLanguage) => {
    setLanguageState(lang);
  };

  /** Translate an agent key — dots map to JSON nesting, e.g. "actions.confirm_payment" */
  const t = (key: string): string => {
    const result = i18nT(key);
    // If i18next returns the key itself (missing translation), warn in dev
    if (import.meta.env.DEV && result === key) {
      console.warn(`[LanguageContext] Missing agent translation for key: "${key}" (lang: ${language})`);
    }
    return result;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
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
