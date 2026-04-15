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

export const WelcomeGreeting = ({
  firstName,
  lastName,
  subtitle,
  showTrustMessage = false,
}: WelcomeGreetingProps) => {
  const { greeting } = useGreeting({ firstName, lastName });
  const { t } = useTranslation('wallet');

  const displaySubtitle = subtitle || (showTrustMessage ? t('trust_message') : null);

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
