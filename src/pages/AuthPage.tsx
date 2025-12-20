import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { z } from 'zod';

const emailSchema = z.string().email('Email invalide');
const passwordSchema = z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères');

type AuthMode = 'login' | 'signup' | 'forgot-password' | 'reset-password';

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signUp, resetPassword, isLoading: authLoading, user } = useAuth();
  
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check for reset password mode from URL
  useEffect(() => {
    const type = searchParams.get('type');
    if (type === 'recovery') {
      setMode('reset-password');
    }
  }, [searchParams]);

  // Redirect if already logged in
  useEffect(() => {
    if (user && mode !== 'reset-password') {
      navigate('/', { replace: true });
    }
  }, [user, mode, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const emailValidation = emailSchema.safeParse(email);
    if (!emailValidation.success) {
      toast.error(emailValidation.error.errors[0].message);
      return;
    }

    if (mode === 'forgot-password') {
      setIsSubmitting(true);
      const { error } = await resetPassword(email);
      setIsSubmitting(false);
      
      if (error) {
        toast.error('Erreur lors de l\'envoi de l\'email de réinitialisation');
        return;
      }
      
      toast.success('Un email de réinitialisation a été envoyé à votre adresse');
      setMode('login');
      return;
    }

    const passwordValidation = passwordSchema.safeParse(password);
    if (!passwordValidation.success) {
      toast.error(passwordValidation.error.errors[0].message);
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    setIsSubmitting(true);

    if (mode === 'signup') {
      const { error } = await signUp(email, password);
      setIsSubmitting(false);
      
      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('Cet email est déjà utilisé');
        } else {
          toast.error(error.message || 'Erreur lors de l\'inscription');
        }
        return;
      }
      
      toast.success('Compte créé avec succès !');
      navigate('/');
    } else if (mode === 'login') {
      const { error } = await signIn(email, password);
      setIsSubmitting(false);
      
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Email ou mot de passe incorrect');
        } else {
          toast.error(error.message || 'Erreur lors de la connexion');
        }
        return;
      }
      
      toast.success('Bienvenue !');
      navigate('/');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const getTitle = () => {
    switch (mode) {
      case 'signup': return 'Créer un compte';
      case 'forgot-password': return 'Mot de passe oublié';
      case 'reset-password': return 'Réinitialiser le mot de passe';
      default: return 'Connexion';
    }
  };

  const getDescription = () => {
    switch (mode) {
      case 'signup': return 'Créez votre compte pour commencer';
      case 'forgot-password': return 'Entrez votre email pour réinitialiser votre mot de passe';
      case 'reset-password': return 'Entrez votre nouveau mot de passe';
      default: return 'Connectez-vous à votre compte';
    }
  };

  const getButtonText = () => {
    if (isSubmitting) return <Loader2 className="h-4 w-4 animate-spin" />;
    switch (mode) {
      case 'signup': return 'Créer mon compte';
      case 'forgot-password': return 'Envoyer le lien';
      case 'reset-password': return 'Réinitialiser';
      default: return 'Se connecter';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl font-bold text-primary">B</span>
          </div>
          <CardTitle className="text-2xl font-bold">{getTitle()}</CardTitle>
          <CardDescription>{getDescription()}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode !== 'reset-password' && (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="votre@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                    autoFocus
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            )}
            
            {mode !== 'forgot-password' && (
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'signup' && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10"
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            )}

            {mode === 'login' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setMode('forgot-password')}
                  className="text-sm text-primary hover:underline"
                >
                  Mot de passe oublié ?
                </button>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {getButtonText()}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          {mode === 'login' && (
            <p className="text-sm text-muted-foreground text-center">
              Pas encore de compte ?{' '}
              <button
                type="button"
                onClick={() => setMode('signup')}
                className="text-primary hover:underline font-medium"
              >
                Créer un compte
              </button>
            </p>
          )}
          {(mode === 'signup' || mode === 'forgot-password') && (
            <p className="text-sm text-muted-foreground text-center">
              Déjà un compte ?{' '}
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-primary hover:underline font-medium"
              >
                Se connecter
              </button>
            </p>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
