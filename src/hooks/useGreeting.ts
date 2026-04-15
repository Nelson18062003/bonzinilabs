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
 * Formats a name properly: trims, capitalizes first letter, lowercases the rest.
 * Returns null if name is invalid (contains emojis, numbers, or is empty).
 */
function formatName(name: string | null | undefined): string | null {
  if (!name || typeof name !== 'string') return null;

  const trimmed = name.trim();
  if (!trimmed) return null;

  const hasEmoji = /[\u{1F600}-\u{1F6FF}|\u{2600}-\u{26FF}|\u{2700}-\u{27BF}|\u{1F300}-\u{1F5FF}|\u{1F680}-\u{1F6FF}|\u{1F1E0}-\u{1F1FF}]/u.test(trimmed);
  const hasNumbers = /\d/.test(trimmed);

  if (hasEmoji || hasNumbers) return null;

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}

/**
 * Hook that generates a personalized, localized greeting based on time of day and user name.
 * Uses react-i18next for translations — greeting keys live in wallet.json.
 */
export function useGreeting({ firstName, lastName }: GreetingInput): GreetingResult {
  const { t } = useTranslation('wallet');
  const timeOfDay = getTimeOfDay();

  return useMemo(() => {
    const greetingKeyMap = {
      morning: 'greeting_morning',
      afternoon: 'greeting_afternoon',
      evening: 'greeting_evening',
    } as const;

    const prefix = t(greetingKeyMap[timeOfDay]);
    const formattedFirstName = formatName(firstName);
    const formattedLastName = formatName(lastName);

    let greeting: string;

    if (formattedFirstName) {
      // "Good morning, Vincent!" / "Bonjour, Vincent !"
      greeting = `${prefix}, ${formattedFirstName}!`;
    } else if (formattedLastName) {
      // "Welcome, Innova Store 👋"
      greeting = `${t('greeting_welcome')}, ${formattedLastName} 👋`;
    } else {
      // "👋 Welcome to Bonzini" / "👋 Bienvenue chez Bonzini"
      greeting = t('greeting_welcome_bonzini');
    }

    return { greeting, timeOfDay };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstName, lastName, timeOfDay, t]);
}
