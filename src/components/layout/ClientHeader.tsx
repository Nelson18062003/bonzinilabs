import { BonziniLogo } from '@/components/BonziniLogo';
import { Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useUnreadNotificationCount } from '@/hooks/useNotifications';

interface ClientHeaderProps {
  className?: string;
}

export const ClientHeader = ({ className }: ClientHeaderProps) => {
  const navigate = useNavigate();
  const { data: unreadCount } = useUnreadNotificationCount();

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border",
        className
      )}
    >
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        {/* Logo */}
        <BonziniLogo
          size="sm"
          showText={true}
          textPosition="right"
          className="cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => navigate('/')}
        />

        {/* Actions */}
        <button
          onClick={() => navigate('/notifications')}
          className="relative p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
          {/* Notification badge - shown when there are unread notifications */}
          {unreadCount && unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};
