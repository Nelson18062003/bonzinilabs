import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface GreetingInput {
  firstName?: string | null;
  lastName?: string | null;
}

interface GreetingResult {
  greeting: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening';
}

/**
 * Formats a name properly: trims, capitalizes first letter, lowercases the rest
 * Returns null if name is invalid (contains emojis, numbers, or is empty)
 */
function formatName(name: string | null | undefined): string | null {
  if (!name || typeof name !== 'string') return null;
  
  const trimmed = name.trim();
  if (!trimmed) return null;
  
  // Check for invalid characters (emojis, numbers)
  const hasEmoji = /[\u{1F600}-\u{1F6FF}|\u{2600}-\u{26FF}|\u{2700}-\u{27BF}|\u{1F300}-\u{1F5FF}|\u{1F680}-\u{1F6FF}|\u{1F1E0}-\u{1F1FF}]/u.test(trimmed);
  const hasNumbers = /\d/.test(trimmed);
  
  if (hasEmoji || hasNumbers) return null;
  
  // Capitalize properly: "VINCENT" -> "Vincent", "vincent" -> "Vincent"
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

/** Moment de la journée : 05:00-11:59 matin · 12:00-17:59 après-midi · sinon soir. */
function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}

/**
 * Salutation personnalisée selon l'heure et le nom, dans la langue de
 * l'interface (les textes vivent dans client.json → `greeting.*`).
 * - prénom valide → « Bonjour, Vincent ! »
 * - nom seul → « Bienvenue, Innova Store 👋 »
 * - rien → « Bonjour 👋 Bienvenue chez Bonzini »
 */
export function useGreeting({ firstName, lastName }: GreetingInput): GreetingResult {
  const { t, i18n } = useTranslation('client');
  return useMemo(() => {
    const timeOfDay = getTimeOfDay();
    const prefix = t(`greeting.${timeOfDay}`);
    const formattedFirstName = formatName(firstName);
    const formattedLastName = formatName(lastName);

    let greeting: string;
    if (formattedFirstName) {
      greeting = t('greeting.withName', { prefix, name: formattedFirstName });
    } else if (formattedLastName) {
      greeting = t('greeting.welcomeLast', { name: formattedLastName });
    } else {
      greeting = t('greeting.anonymous', { prefix });
    }
    return { greeting, timeOfDay };
    // i18n.language : recalcul au changement de langue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstName, lastName, t, i18n.language]);
}
