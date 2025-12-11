import { useMemo } from 'react';

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

/**
 * Gets the time-based greeting prefix
 * - 05:00-11:59 → "Bonjour"
 * - 12:00-17:59 → "Bon après-midi"
 * - 18:00-04:59 → "Bonsoir"
 */
function getTimeBasedGreeting(): { prefix: string; timeOfDay: 'morning' | 'afternoon' | 'evening' } {
  const hour = new Date().getHours();
  
  if (hour >= 5 && hour < 12) {
    return { prefix: 'Bonjour', timeOfDay: 'morning' };
  } else if (hour >= 12 && hour < 18) {
    return { prefix: 'Bon après-midi', timeOfDay: 'afternoon' };
  } else {
    return { prefix: 'Bonsoir', timeOfDay: 'evening' };
  }
}

/**
 * Hook that generates a personalized greeting based on time of day and user name
 * 
 * Acceptance criteria handled:
 * - US1: Time-based greeting (Bonjour/Bon après-midi/Bonsoir)
 * - US2: Display firstName if available
 * - US3: Fallback cases for missing/invalid names
 * - US4: Computed synchronously for immediate display
 */
export function useGreeting({ firstName, lastName }: GreetingInput): GreetingResult {
  return useMemo(() => {
    const { prefix, timeOfDay } = getTimeBasedGreeting();
    const formattedFirstName = formatName(firstName);
    const formattedLastName = formatName(lastName);
    
    let greeting: string;
    
    if (formattedFirstName) {
      // US2: Has valid firstName → "Bonjour, Vincent !"
      greeting = `${prefix}, ${formattedFirstName} !`;
    } else if (formattedLastName) {
      // US3 fallback: No firstName but has lastName → "Bienvenue, Innova Store 👋"
      greeting = `Bienvenue, ${formattedLastName} 👋`;
    } else {
      // US3 fallback: No name at all → "Bonjour 👋 Bienvenue chez Bonzini"
      greeting = `${prefix} 👋 Bienvenue chez Bonzini`;
    }
    
    return { greeting, timeOfDay };
  }, [firstName, lastName]);
}
