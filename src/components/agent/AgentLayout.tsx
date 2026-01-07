import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Banknote, ScanLine, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAgentAuth } from '@/contexts/AgentAuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface AgentLayoutProps {
  children: ReactNode;
  title?: string;
}

export function AgentLayout({ children, title }: AgentLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAgentAuth();
  const { language, setLanguage, t } = useLanguage();

  const handleSignOut = async () => {
    await signOut();
    navigate('/agent/login');
  };

  const navItems = [
    { path: '/agent/payments', icon: Banknote, label: t('cash_payments') },
    { path: '/agent/scan', icon: ScanLine, label: t('scanner') },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Banknote className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">Bonzini Cash</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <div className="flex rounded-lg border overflow-hidden">
              <button
                onClick={() => setLanguage('en')}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium transition-colors',
                  language === 'en'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-muted'
                )}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('zh')}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium transition-colors',
                  language === 'zh'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-muted'
                )}
              >
                中文
              </button>
            </div>

            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4">
        {title && (
          <h1 className="text-2xl font-bold mb-4">{title}</h1>
        )}
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="sticky bottom-0 border-t bg-background">
        <div className="flex">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex-1 flex flex-col items-center gap-1 py-3 transition-colors',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <item.icon className="w-6 h-6" />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
