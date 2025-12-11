import { useGreeting } from '@/hooks/useGreeting';

interface WelcomeGreetingProps {
  firstName?: string | null;
  lastName?: string | null;
}

/**
 * Personalized welcome greeting component
 * 
 * Features:
 * - Time-based greeting (Bonjour/Bon après-midi/Bonsoir)
 * - Personalized with user's name
 * - Graceful fallbacks for missing/invalid names
 * - Responsive and accessible
 */
export const WelcomeGreeting = ({ firstName, lastName }: WelcomeGreetingProps) => {
  const { greeting } = useGreeting({ firstName, lastName });

  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-semibold text-foreground leading-tight">
        {greeting}
      </h1>
      <p className="text-sm text-muted-foreground mt-1">
        Votre argent est en sécurité chez Bonzini.
      </p>
    </div>
  );
};
