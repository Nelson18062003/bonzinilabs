import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, Eye, EyeOff, ArrowLeft, Mail } from 'lucide-react';
import { toast } from 'sonner';

type Mode = 'login' | 'forgot-password';

export function AdminLoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated, isLoading: authLoading } = useAdminAuth();
  
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/admin');
    }
  }, [isAuthenticated, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await login(email, password);
    
    setIsLoading(false);
    
    if (result.success) {
      navigate('/admin');
    } else {
      setError(result.error || 'Une erreur est survenue');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const redirectUrl = `${window.location.origin}/admin/reset-password`;
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    
    setIsLoading(false);
    
    if (error) {
      setError('Erreur lors de l\'envoi de l\'email de réinitialisation');
      return;
    }
    
    toast.success('Un email de réinitialisation a été envoyé à votre adresse');
    setMode('login');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-xl">B</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Bonzini</h1>
            <p className="text-sm text-muted-foreground">Administration</p>
          </div>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle>
              {mode === 'login' ? 'Connexion' : 'Mot de passe oublié'}
            </CardTitle>
            <CardDescription>
              {mode === 'login' 
                ? 'Accédez au tableau de bord administrateur'
                : 'Entrez votre email pour recevoir un lien de réinitialisation'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mode === 'login' ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@bonzini.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => setMode('forgot-password')}
                    className="text-sm text-primary hover:underline"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connexion...
                    </>
                  ) : (
                    'Se connecter'
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="admin@bonzini.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Envoi...
                    </>
                  ) : (
                    'Envoyer le lien'
                  )}
                </Button>

                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full justify-center"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour à la connexion
                </button>
              </form>
            )}

            {/* Info */}
            <div className="mt-6 p-4 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">
                Seuls les utilisateurs avec un rôle admin dans la base de données peuvent se connecter.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
