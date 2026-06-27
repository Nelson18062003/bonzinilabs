import { cn } from '@/lib/utils';
import { useGreeting } from '@/hooks/useGreeting';
import { useTranslation } from 'react-i18next';
import { TEXT } from '@/mobile/designKit';

interface WelcomeGreetingProps {
  firstName?: string | null;
  lastName?: string | null;
  /** Optional subtitle message for additional context */
  subtitle?: string;
  /** Show the default trust message as subtitle */
  showTrustMessage?: boolean;
}

/**
 * Personalized welcome greeting (refonte « Direction A »).
 * Time-based greeting + name (useGreeting), 👋, optional subtitle.
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
    <div className="animate-fade-in px-1">
      <h1 className={cn('text-[26px] font-black leading-tight', TEXT.strong)}>{greeting} 👋</h1>
      {displaySubtitle && <p className={cn('mt-0.5 text-[13px]', TEXT.muted)}>{displaySubtitle}</p>}
    </div>
  );
};
