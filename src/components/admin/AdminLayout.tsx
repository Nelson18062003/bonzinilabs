import { useState, ReactNode, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { NavLink } from '@/components/NavLink';
import {
  LayoutDashboard,
  Users,
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  TrendingUp,
  FileText,
  History,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  UserCog,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAdminAuth, ADMIN_ROLE_LABELS, RolePermission, ROLE_PERMISSIONS } from '@/contexts/AdminAuthContext';

interface AdminLayoutProps {
  children: ReactNode;
}

const navItems = [
  { title: 'Dashboard', url: '/admin', icon: LayoutDashboard },
  { title: 'Clients', url: '/admin/clients', icon: Users },
  { title: 'Wallets', url: '/admin/wallets', icon: Wallet },
  { title: 'Dépôts', url: '/admin/deposits', icon: ArrowDownToLine },
  { title: 'Paiements', url: '/admin/payments', icon: ArrowUpFromLine },
  { title: 'Taux', url: '/admin/rates', icon: TrendingUp },
  { title: 'Justificatifs', url: '/admin/proofs', icon: FileText },
  { title: 'Historique', url: '/admin/history', icon: History },
  { title: 'Notifications', url: '/admin/notifications', icon: Bell },
  { title: 'Utilisateurs', url: '/admin/users', icon: UserCog, requiresPermission: 'canManageUsers' },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout, hasPermission } = useAdminAuth();

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const filteredNavItems = navItems.filter(item => {
    if (item.requiresPermission) {
      return hasPermission(item.requiresPermission as keyof RolePermission);
    }
    return true;
  });

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
  };

  if (!currentUser) return null;

  const NavContent = () => (
    <nav className="flex-1 py-4 overflow-y-auto px-3">
      <div className="space-y-1">
        {filteredNavItems.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            end={item.url === '/admin'}
            className={cn(
              'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200',
              'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
            activeClassName="bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            <span>{item.title}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );

  const UserMenu = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className={cn(
      'border-t border-border',
      isMobile ? 'p-4' : (sidebarCollapsed ? 'p-2' : 'p-3')
    )}>
      {isMobile ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-primary">
                {currentUser.firstName[0]}{currentUser.lastName[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {currentUser.firstName} {currentUser.lastName}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {ADMIN_ROLE_LABELS[currentUser.role]}
              </p>
            </div>
          </div>
          <Button variant="outline" className="w-full" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Déconnexion
          </Button>
        </div>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted transition-colors',
                sidebarCollapsed && 'justify-center p-2'
              )}
            >
              <Avatar className="h-9 w-9 flex-shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                  {currentUser.firstName[0]}{currentUser.lastName[0]}
                </AvatarFallback>
              </Avatar>
              {!sidebarCollapsed && (
                <>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {currentUser.firstName} {currentUser.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {ADMIN_ROLE_LABELS[currentUser.role]}
                    </p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={sidebarCollapsed ? "center" : "end"} side={sidebarCollapsed ? "right" : "top"} className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{currentUser.firstName} {currentUser.lastName}</p>
              <p className="text-xs text-muted-foreground">{currentUser.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              Paramètres
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );

  return (
    <TooltipProvider delayDuration={0}>
      <div className="min-h-screen bg-background flex w-full">
        {/* Desktop Sidebar - Hidden below lg (1024px) */}
        <aside
          className={cn(
            'hidden lg:flex flex-col border-r border-border bg-card transition-all duration-300 relative',
            sidebarCollapsed ? 'w-[72px]' : 'w-64'
          )}
        >
          {/* Logo */}
          <div className={cn(
            'h-16 flex items-center border-b border-border px-4',
            sidebarCollapsed ? 'justify-center' : 'justify-between'
          )}>
            {!sidebarCollapsed && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-purple">
                  <span className="text-primary-foreground font-bold text-base">B</span>
                </div>
                <div>
                  <span className="font-semibold text-foreground text-sm">Bonzini</span>
                  <span className="text-xs text-muted-foreground block">Admin</span>
                </div>
              </div>
            )}
            {sidebarCollapsed && (
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-purple">
                <span className="text-primary-foreground font-bold text-base">B</span>
              </div>
            )}
          </div>

          {/* Collapse Toggle */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="absolute -right-3 top-20 w-6 h-6 bg-card border border-border rounded-full flex items-center justify-center shadow-sm hover:bg-muted transition-colors z-10"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>

          {/* Navigation */}
          <nav className={cn(
            'flex-1 py-4 overflow-y-auto',
            sidebarCollapsed ? 'px-2' : 'px-3'
          )}>
            <div className="space-y-1">
              {filteredNavItems.map((item) => {
                const NavItem = (
                  <NavLink
                    key={item.url}
                    to={item.url}
                    end={item.url === '/admin'}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                      'text-muted-foreground hover:text-foreground hover:bg-muted',
                      sidebarCollapsed && 'justify-center px-2'
                    )}
                    activeClassName="bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    {!sidebarCollapsed && <span>{item.title}</span>}
                  </NavLink>
                );

                if (sidebarCollapsed) {
                  return (
                    <Tooltip key={item.url}>
                      <TooltipTrigger asChild>
                        {NavItem}
                      </TooltipTrigger>
                      <TooltipContent side="right" className="font-medium">
                        {item.title}
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return NavItem;
              })}
            </div>
          </nav>

          {/* User Menu Desktop */}
          <UserMenu />
        </aside>

        {/* Mobile/Tablet Header - Visible below lg */}
        <div className="lg:hidden fixed top-0 left-0 right-0 h-14 sm:h-16 bg-card border-b border-border z-50 flex items-center justify-between px-4 safe-area-top">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-primary flex items-center justify-center shadow-purple">
              <span className="text-primary-foreground font-bold text-sm sm:text-base">B</span>
            </div>
            <span className="font-semibold text-foreground text-sm sm:text-base">Admin</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(true)}
            className="h-10 w-10"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        {/* Mobile Menu Sheet */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="w-[280px] sm:w-[320px] p-0 flex flex-col">
            <SheetHeader className="h-14 sm:h-16 flex flex-row items-center justify-between px-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-primary flex items-center justify-center shadow-purple">
                  <span className="text-primary-foreground font-bold text-sm sm:text-base">B</span>
                </div>
                <SheetTitle className="font-semibold text-foreground text-sm sm:text-base">
                  Bonzini Admin
                </SheetTitle>
              </div>
            </SheetHeader>
            
            <NavContent />
            <UserMenu isMobile />
          </SheetContent>
        </Sheet>

        {/* Main Content */}
        <main className="flex-1 overflow-auto min-w-0">
          {/* Spacer for mobile header */}
          <div className="lg:hidden h-14 sm:h-16 safe-area-top" />
          {/* Responsive padding: smaller on mobile, larger on desktop */}
          <div className="p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
