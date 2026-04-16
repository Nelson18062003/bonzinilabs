import { useGreeting } from '@/hooks/useGreeting';
import { useTranslation } from 'react-i18next';

interface WelcomeGreetingProps {
  firstName?: string | null;
  lastName?: string | null;
  /** Optional subtitle message for additional context */
  subtitle?: string;
  /** Show the default trust message as subtitle */
  showTrustMessage?: boolean;
}

/**
 * Personalized welcome greeting component
 *
 * Features:
 * - Time-based greeting (Bonjour/Bon après-midi/Bonsoir)
 * - Personalized with user's name
 * - Graceful fallbacks for missing/invalid names
 * - Optional trust/context subtitle
 * - Responsive and accessible
 * - Smooth fade-in animation
 */
export const WelcomeGreeting = ({
  firstName,
  lastName,
  subtitle,
  showTrustMessage = false,
}: WelcomeGreetingProps) => {
  const { greeting } = useGreeting({ firstName, lastName });
  const { t } = useTranslation('client');

  const displaySubtitle = subtitle || (showTrustMessage ? t('welcomeGreeting.trustMessage') : null);

  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-semibold text-foreground leading-tight">
        {greeting}
      </h1>
      {displaySubtitle && (
        <p className="text-sm text-muted-foreground mt-1">
          {displaySubtitle}
        </p>
      )}
    </div>
  );
};
