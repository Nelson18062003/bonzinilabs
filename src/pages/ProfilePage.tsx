import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useMyProfile } from '@/hooks/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import { 
  User, 
  ChevronRight, 
  Bell, 
  Shield, 
  HelpCircle, 
  LogOut,
  Smartphone,
  Globe,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

const ProfilePage = () => {
  const { user, signOut } = useAuth();
  const { data: profile, isLoading } = useMyProfile();

  const handleLogout = async () => {
    await signOut();
    toast.success('Déconnexion réussie');
  };

  const menuItems = [
    { icon: Bell, label: 'Notifications', description: 'Gérer vos alertes' },
    { icon: Shield, label: 'Sécurité', description: 'Mot de passe, 2FA' },
    { icon: Smartphone, label: 'Appareils connectés', description: '2 appareils' },
    { icon: Globe, label: 'Langue', description: 'Français' },
    { icon: FileText, label: 'Documents', description: 'KYC, Pièces justificatives' },
    { icon: HelpCircle, label: 'Aide & Support', description: 'FAQ, Contact' },
  ];

  return (
    <MobileLayout>
      <PageHeader title="Profil" />
      
      <div className="px-4 py-4">
        {/* Profile Card */}
        <div className="card-primary p-6 mb-6 animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary-foreground/20 flex items-center justify-center">
              <User className="w-8 h-8 text-primary-foreground" />
            </div>
            <div className="flex-1">
              {isLoading ? (
                <>
                  <Skeleton className="h-6 w-32 mb-1 bg-primary-foreground/20" />
                  <Skeleton className="h-4 w-48 mb-1 bg-primary-foreground/20" />
                  <Skeleton className="h-4 w-32 bg-primary-foreground/20" />
                </>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-primary-foreground">
                    {profile?.first_name} {profile?.last_name}
                  </h2>
                  <p className="text-primary-foreground/70 text-sm">{user?.email}</p>
                  <p className="text-primary-foreground/70 text-sm">{profile?.phone || '-'}</p>
                </>
              )}
            </div>
            <button className="p-2 rounded-full bg-primary-foreground/10 hover:bg-primary-foreground/20 transition-colors">
              <ChevronRight className="w-5 h-5 text-primary-foreground" />
            </button>
          </div>
        </div>
        
        {/* Menu Items */}
        <div className="space-y-2">
          {menuItems.map((item, index) => (
            <button
              key={item.label}
              className="w-full flex items-center gap-4 p-4 bg-card rounded-2xl border border-border/30 hover:border-primary/30 transition-all animate-slide-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                <item.icon className="w-5 h-5 text-foreground" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          ))}
        </div>
        
        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-4 p-4 mt-6 rounded-2xl border border-destructive/30 hover:bg-destructive/5 transition-colors animate-slide-up"
          style={{ animationDelay: '300ms' }}
        >
          <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
            <LogOut className="w-5 h-5 text-destructive" />
          </div>
          <span className="font-medium text-destructive">Se déconnecter</span>
        </button>
        
        {/* App Version */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          Bonzini v1.0.0 • Fait avec 💜 au Cameroun
        </p>
      </div>
    </MobileLayout>
  );
};

export default ProfilePage;