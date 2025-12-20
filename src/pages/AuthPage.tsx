import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, SignUpData } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Mail, Lock, Eye, EyeOff, User, Phone, Building, MapPin, Calendar, Briefcase } from 'lucide-react';
import { z } from 'zod';

const emailSchema = z.string().email('Email invalide');
const passwordSchema = z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères');
const nameSchema = z.string().min(1, 'Ce champ est obligatoire');
const phoneSchema = z.string().min(8, 'Numéro de téléphone invalide');

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

  // Signup additional fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [activitySector, setActivitySector] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');

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

    if (mode === 'signup') {
      // Validate required fields
      const firstNameValidation = nameSchema.safeParse(firstName);
      if (!firstNameValidation.success) {
        toast.error('Le prénom est obligatoire');
        return;
      }

      const lastNameValidation = nameSchema.safeParse(lastName);
      if (!lastNameValidation.success) {
        toast.error('Le nom est obligatoire');
        return;
      }

      const phoneValidation = phoneSchema.safeParse(phone);
      if (!phoneValidation.success) {
        toast.error(phoneValidation.error.errors[0].message);
        return;
      }

      if (password !== confirmPassword) {
        toast.error('Les mots de passe ne correspondent pas');
        return;
      }
    }

    setIsSubmitting(true);

    if (mode === 'signup') {
      const signUpData: SignUpData = {
        email,
        password,
        firstName,
        lastName,
        phone,
        dateOfBirth: dateOfBirth || undefined,
        companyName: companyName || undefined,
        activitySector: activitySector || undefined,
        neighborhood: neighborhood || undefined,
        city: city || undefined,
        country: country || undefined,
      };

      const { error } = await signUp(signUpData);
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
      <Card className={`w-full ${mode === 'signup' ? 'max-w-2xl' : 'max-w-md'}`}>
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl font-bold text-primary">B</span>
          </div>
          <CardTitle className="text-2xl font-bold">{getTitle()}</CardTitle>
          <CardDescription>{getDescription()}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                {/* Personal Info Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Prénom *</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="firstName"
                        type="text"
                        placeholder="Jean"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="pl-10"
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lastName">Nom *</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="lastName"
                        type="text"
                        placeholder="Dupont"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="pl-10"
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Téléphone *</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+237 6XX XXX XXX"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="pl-10"
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dateOfBirth">Date de naissance</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="dateOfBirth"
                        type="date"
                        value={dateOfBirth}
                        onChange={(e) => setDateOfBirth(e.target.value)}
                        className="pl-10"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </div>

                {/* Business Info Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Nom de l'entreprise</Label>
                    <div className="relative">
                      <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="companyName"
                        type="text"
                        placeholder="Ma Société SARL"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="pl-10"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="activitySector">Secteur d'activité</Label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="activitySector"
                        type="text"
                        placeholder="Commerce, Import/Export..."
                        value={activitySector}
                        onChange={(e) => setActivitySector(e.target.value)}
                        className="pl-10"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </div>

                {/* Address Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="neighborhood">Quartier</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="neighborhood"
                        type="text"
                        placeholder="Bonanjo"
                        value={neighborhood}
                        onChange={(e) => setNeighborhood(e.target.value)}
                        className="pl-10"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="city">Ville</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="city"
                        type="text"
                        placeholder="Douala"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="pl-10"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="country">Pays</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="country"
                        type="text"
                        placeholder="Cameroun"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="pl-10"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4 mt-4">
                  <p className="text-sm text-muted-foreground mb-4">Informations de connexion</p>
                </div>
              </>
            )}

            {mode !== 'reset-password' && (
              <div className="space-y-2">
                <Label htmlFor="email">Email {mode === 'signup' && '*'}</Label>
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
                    autoFocus={mode !== 'signup'}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            )}
            
            {mode !== 'forgot-password' && (
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe {mode === 'signup' && '*'}</Label>
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
                <Label htmlFor="confirmPassword">Confirmer le mot de passe *</Label>
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

            {mode === 'signup' && (
              <p className="text-xs text-muted-foreground">* Champs obligatoires</p>
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