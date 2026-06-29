import { BonziniLogo } from '@/components/BonziniLogo';
import { Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useUnreadNotificationCount } from '@/hooks/useNotifications';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { SURFACE, TEXT } from '@/mobile/designKit';

interface ClientHeaderProps {
  className?: string;
}

// En-tête sobre (refonte « Direction A ») : fond canvas (plus de bordure ni de
// flou), logo, sélecteur de langue, cloche dans un holder carte + compteur.
export const ClientHeader = ({ className }: ClientHeaderProps) => {
  const navigate = useNavigate();
  const { data: unreadCount } = useUnreadNotificationCount();

  return (
    <header className={cn('sticky top-0 z-40 w-full', SURFACE.canvas, className)}>
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <BonziniLogo
          size="sm"
          showText={true}
          textPosition="right"
          className="cursor-pointer transition-opacity hover:opacity-80"
          onClick={() => navigate('/wallet')}
        />

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <LanguageSwitcher />
          <button
            onClick={() => navigate('/notifications')}
            aria-label="Notifications"
            className={cn(
              'relative flex h-10 w-10 items-center justify-center rounded-full transition active:scale-95',
              SURFACE.card,
              SURFACE.shadow,
            )}
          >
            <Bell className={cn('h-5 w-5', TEXT.strong)} />
            {/* Compteur de notifications non lues */}
            {unreadCount && unreadCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#C0504D] px-1 text-[10px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            ) : null}
          </button>
        </div>
      </div>
    </header>
  );
};
