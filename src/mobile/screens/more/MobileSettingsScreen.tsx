import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { Monitor, Palette, Info } from 'lucide-react';

export function MobileSettingsScreen() {
  const { profile } = useAdminAuth();

  return (
    <div className="flex flex-col min-h-full">
      <MobileHeader title="Paramètres" showBack />

      <div className="flex-1 px-4 py-4 space-y-6">
        {/* Theme Section */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Palette className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Apparence
            </h3>
          </div>
          <div className="bg-card rounded-xl border border-border p-4">
            <p className="text-sm font-medium mb-3">Thème de l'application</p>
            <ThemeToggle />
            <p className="text-xs text-muted-foreground mt-3">
              Le mode Système s'adapte automatiquement aux préférences de votre appareil.
            </p>
          </div>
        </section>

        {/* Account Section */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Monitor className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Compte
            </h3>
          </div>
          <div className="bg-card rounded-xl border border-border divide-y divide-border">
            <div className="p-4">
              <p className="text-xs text-muted-foreground">Nom</p>
              <p className="text-sm font-medium mt-0.5">
                {profile?.first_name} {profile?.last_name}
              </p>
            </div>
            <div className="p-4">
              <p className="text-xs text-muted-foreground">Rôle</p>
              <p className="text-sm font-medium mt-0.5 capitalize">
                {profile?.role?.replace('_', ' ') || 'Admin'}
              </p>
            </div>
          </div>
        </section>

        {/* About Section */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              À propos
            </h3>
          </div>
          <div className="bg-card rounded-xl border border-border divide-y divide-border">
            <div className="p-4 flex items-center justify-between">
              <p className="text-sm">Version</p>
              <p className="text-sm text-muted-foreground">1.0.0</p>
            </div>
            <div className="p-4 flex items-center justify-between">
              <p className="text-sm">Plateforme</p>
              <p className="text-sm text-muted-foreground">Bonzini Admin</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
