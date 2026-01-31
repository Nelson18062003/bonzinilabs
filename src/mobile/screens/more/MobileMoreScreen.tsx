import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  FileText,
  History,
  Bell,
  UserCog,
  LogOut,
  ChevronRight,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MenuItemProps {
  icon: React.ElementType;
  label: string;
  description?: string;
  onClick: () => void;
  destructive?: boolean;
  badge?: string;
}

function MenuItem({ icon: Icon, label, description, onClick, destructive, badge }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 p-4 active:bg-muted/50 transition-colors",
        destructive && "text-destructive"
      )}
    >
      <div className={cn(
        "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
        destructive ? "bg-destructive/10" : "bg-muted"
      )}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 text-left">
        <p className="font-medium">{label}</p>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {badge && (
        <span className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-medium">
          {badge}
        </span>
      )}
      <ChevronRight className="w-5 h-5 text-muted-foreground" />
    </button>
  );
}

export function MobileMoreScreen() {
  const { profile, logout, canManageUsers } = useAdminAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  return (
    <div className="flex flex-col min-h-full">
      <MobileHeader title="Plus" />

      <div className="flex-1">
        {/* Profile Section */}
        <div className="px-4 py-6 border-b border-border">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-xl font-semibold text-primary">
              {profile?.first_name?.[0] || '?'}
              {profile?.last_name?.[0] || ''}
            </div>
            <div>
              <p className="text-lg font-semibold">
                {profile?.first_name} {profile?.last_name}
              </p>
              <p className="text-sm text-muted-foreground">Admin</p>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="divide-y divide-border">
          <MenuItem
            icon={TrendingUp}
            label="Taux de change"
            description="Gérer les taux XAF/RMB"
            onClick={() => navigate('/m/more/rates')}
          />
          <MenuItem
            icon={FileText}
            label="Justificatifs"
            description="Voir les preuves de dépôts"
            onClick={() => navigate('/m/more/proofs')}
          />
          <MenuItem
            icon={History}
            label="Historique"
            description="Journal d'activité"
            onClick={() => navigate('/m/more/history')}
          />
          <MenuItem
            icon={Bell}
            label="Notifications"
            description="Centre de notifications"
            onClick={() => navigate('/m/more/notifications')}
          />
          {canManageUsers && (
            <MenuItem
              icon={UserCog}
              label="Utilisateurs"
              description="Gérer les accès admin"
              onClick={() => navigate('/m/more/users')}
            />
          )}
        </div>

        {/* Logout */}
        <div className="mt-4 border-t border-border">
          <MenuItem
            icon={LogOut}
            label="Déconnexion"
            onClick={handleLogout}
            destructive
          />
        </div>
      </div>
    </div>
  );
}
