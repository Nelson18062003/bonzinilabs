import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, SignUpData } from '@/contexts/AuthContext';
import { LoginBackground } from '@/components/auth/LoginBackground';
import { PremiumInput } from '@/components/auth/PremiumInput';
import { ProgressDots } from '@/components/auth/ProgressDots';
import { StepTransition } from '@/components/auth/StepTransition';
import { BonziniLogo } from '@/components/BonziniLogo';
import { toast } from 'sonner';
import {
  Loader2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Phone,
  Building,
  MapPin,
  Calendar,
  Briefcase,
  ArrowLeft,
} from 'lucide-react';
import { z } from 'zod';
import { cn } from '@/lib/utils';

const emailSchema = z.string().email('Email invalide');
const passwordSchema = z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères');
const nameSchema = z.string().min(1, 'Ce champ est obligatoire');
const phoneSchema = z.string().min(8, 'Numéro de téléphone invalide');

type AuthMode = 'login' | 'signup' | 'forgot-password' | 'reset-password';

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signUp, resetPassword, updatePassword, isLoading: authLoading, user } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [loginStep, setLoginStep] = useState<0 | 1>(0);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Validation errors
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Signup fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [activitySector, setActivitySector] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');

  const isEmailValid = emailSchema.safeParse(email).success;

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

  const maskEmail = (email: string) => {
    const [local, domain] = email.split('@');
    if (!domain) return email;
    const visible = local.slice(0, 3);
    return `${visible}***@${domain}`;
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setLoginStep(0);
    setDirection('forward');
    setPasswordError('');
    setEmailError('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
  };

  // Login step 0 → 1
  const handleEmailContinue = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    if (!isEmailValid) {
      setEmailError('Veuillez entrer un email valide');
      return;
    }
    setDirection('forward');
    setLoginStep(1);
  };

  // Login step 1 → submit
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    const pwdResult = passwordSchema.safeParse(password);
    if (!pwdResult.success) {
      setPasswordError(pwdResult.error.errors[0].message);
      return;
    }

    setIsSubmitting(true);
    const { error } = await signIn(email, password);
    setIsSubmitting(false);

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setPasswordError('Email ou mot de passe incorrect');
      } else {
        setPasswordError(error.message || 'Erreur lors de la connexion');
      }
      return;
    }

    toast.success('Bienvenue !');
    setIsFadingOut(true);
    setTimeout(() => navigate('/'), 300);
  };

  // Forgot password
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');

    const result = emailSchema.safeParse(email);
    if (!result.success) {
      setEmailError(result.error.errors[0].message);
      return;
    }

    setIsSubmitting(true);
    const { error } = await resetPassword(email);
    setIsSubmitting(false);

    if (error) {
      toast.error("Erreur lors de l'envoi de l'email de réinitialisation");
      return;
    }

    toast.success('Un email de réinitialisation a été envoyé à votre adresse');
    switchMode('login');
  };

  // Reset password (from email link)
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    const pwdResult = passwordSchema.safeParse(password);
    if (!pwdResult.success) {
      setPasswordError(pwdResult.error.errors[0].message);
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError('Les mots de passe ne correspondent pas');
      return;
    }

    setIsSubmitting(true);
    const { error } = await updatePassword(password);
    setIsSubmitting(false);

    if (error) {
      setPasswordError(error.message || 'Erreur lors de la réinitialisation');
      return;
    }

    toast.success('Mot de passe mis à jour avec succès');
    navigate('/');
  };

  // Signup
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    setPasswordError('');

    // Validate
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      setEmailError(emailResult.error.errors[0].message);
      return;
    }

    const pwdResult = passwordSchema.safeParse(password);
    if (!pwdResult.success) {
      setPasswordError(pwdResult.error.errors[0].message);
      return;
    }

    const fnResult = nameSchema.safeParse(firstName);
    if (!fnResult.success) {
      toast.error('Le prénom est obligatoire');
      return;
    }

    const lnResult = nameSchema.safeParse(lastName);
    if (!lnResult.success) {
      toast.error('Le nom est obligatoire');
      return;
    }

    const phoneResult = phoneSchema.safeParse(phone);
    if (!phoneResult.success) {
      toast.error(phoneResult.error.errors[0].message);
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError('Les mots de passe ne correspondent pas');
      return;
    }

    setIsSubmitting(true);

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
        toast.error(error.message || "Erreur lors de l'inscription");
      }
      return;
    }

    toast.success('Compte créé avec succès !');
    navigate('/');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ─── LOGIN MODE (multi-step) ──────────────────────────
  if (mode === 'login') {
    return (
      <LoginBackground className={cn(isFadingOut && 'animate-fade-out')}>
        <div className="flex-1 flex flex-col justify-center px-6 py-12">
          {/* Back button (step 1 only) */}
          {loginStep === 1 && (
            <button
              onClick={() => {
                setDirection('back');
                setLoginStep(0);
                setPasswordError('');
              }}
              className="absolute top-6 left-4 z-20 w-10 h-10 rounded-full bg-card/80 backdrop-blur-sm border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors animate-fade-in"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          {/* Logo */}
          <div
            className="flex justify-center mb-6 animate-logo-entrance"
            style={{ animationDelay: '0ms', animationFillMode: 'both' }}
          >
            <BonziniLogo size="xl" showText textPosition="bottom" />
          </div>

          <StepTransition stepKey={loginStep} direction={direction}>
            {loginStep === 0 ? (
              <form onSubmit={handleEmailContinue} className="max-w-sm mx-auto w-full">
                <div
                  className="text-center mb-8 animate-slide-up"
                  style={{ animationDelay: '80ms', animationFillMode: 'both' }}
                >
                  <h1 className="text-2xl font-bold mb-1">Connexion</h1>
                  <p className="text-muted-foreground text-sm">
                    Connectez-vous à votre compte
                  </p>
                </div>

                <div
                  className="mb-6 animate-slide-up"
                  style={{ animationDelay: '160ms', animationFillMode: 'both' }}
                >
                  <PremiumInput
                    id="client-email"
                    type="email"
                    label="Adresse email"
                    value={email}
                    onChange={(val) => {
                      setEmail(val);
                      setEmailError('');
                    }}
                    icon={<Mail className="w-5 h-5" />}
                    error={emailError}
                    isValid={isEmailValid && email.length > 0}
                    autoComplete="email"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleEmailContinue(e);
                    }}
                  />
                </div>

                <ProgressDots totalSteps={2} currentStep={0} className="mb-6" />

                <div
                  className="animate-slide-up"
                  style={{ animationDelay: '240ms', animationFillMode: 'both' }}
                >
                  <button
                    type="submit"
                    disabled={!email}
                    className="w-full btn-primary-gradient h-12 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continuer
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="max-w-sm mx-auto w-full">
                <div className="text-center mb-8">
                  <h1 className="text-2xl font-bold mb-1">Bonjour,</h1>
                  <p className="text-muted-foreground text-sm">{maskEmail(email)}</p>
                </div>

                <div className="mb-4">
                  <PremiumInput
                    id="client-password"
                    type={showPassword ? 'text' : 'password'}
                    label="Mot de passe"
                    value={password}
                    onChange={(val) => {
                      setPassword(val);
                      setPasswordError('');
                    }}
                    icon={<Lock className="w-5 h-5" />}
                    rightElement={
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    }
                    error={passwordError}
                    autoComplete="current-password"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleLogin(e);
                    }}
                  />
                </div>

                <div className="text-right mb-4">
                  <button
                    type="button"
                    onClick={() => switchMode('forgot-password')}
                    className="text-sm text-primary hover:underline"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>

                <ProgressDots totalSteps={2} currentStep={1} className="mb-6" />

                <button
                  type="submit"
                  disabled={isSubmitting || !password}
                  className="w-full btn-primary-gradient h-12 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Connexion...
                    </>
                  ) : (
                    'Se connecter'
                  )}
                </button>
              </form>
            )}
          </StepTransition>
        </div>

        {/* Footer */}
        <div className="p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Pas encore de compte ?{' '}
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className="text-primary hover:underline font-medium"
            >
              Créer un compte
            </button>
          </p>
        </div>
      </LoginBackground>
    );
  }

  // ─── FORGOT PASSWORD MODE ──────────────────────────
  if (mode === 'forgot-password') {
    return (
      <LoginBackground>
        <div className="flex-1 flex flex-col justify-center px-6 py-12">
          <button
            onClick={() => switchMode('login')}
            className="absolute top-6 left-4 z-20 w-10 h-10 rounded-full bg-card/80 backdrop-blur-sm border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors animate-fade-in"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div
            className="flex justify-center mb-6 animate-logo-entrance"
            style={{ animationFillMode: 'both' }}
          >
            <BonziniLogo size="lg" showText={false} />
          </div>

          <form onSubmit={handleForgotPassword} className="max-w-sm mx-auto w-full animate-slide-up" style={{ animationFillMode: 'both' }}>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold mb-1">Mot de passe oublié</h1>
              <p className="text-muted-foreground text-sm">
                Entrez votre email pour recevoir un lien de réinitialisation
              </p>
            </div>

            <div className="mb-6">
              <PremiumInput
                id="forgot-email"
                type="email"
                label="Adresse email"
                value={email}
                onChange={(val) => {
                  setEmail(val);
                  setEmailError('');
                }}
                icon={<Mail className="w-5 h-5" />}
                error={emailError}
                isValid={isEmailValid && email.length > 0}
                autoComplete="email"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !email}
              className="w-full btn-primary-gradient h-12 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Envoyer le lien'
              )}
            </button>
          </form>
        </div>

        <div className="p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Vous vous souvenez ?{' '}
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="text-primary hover:underline font-medium"
            >
              Se connecter
            </button>
          </p>
        </div>
      </LoginBackground>
    );
  }

  // ─── RESET PASSWORD MODE (from email link) ──────────────────────────
  if (mode === 'reset-password') {
    return (
      <LoginBackground>
        <div className="flex-1 flex flex-col justify-center px-6 py-12">
          <div
            className="flex justify-center mb-6 animate-logo-entrance"
            style={{ animationFillMode: 'both' }}
          >
            <BonziniLogo size="lg" showText={false} />
          </div>

          <form onSubmit={handleResetPassword} className="max-w-sm mx-auto w-full animate-slide-up" style={{ animationFillMode: 'both' }}>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold mb-1">Nouveau mot de passe</h1>
              <p className="text-muted-foreground text-sm">
                Choisissez un nouveau mot de passe sécurisé
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <PremiumInput
                id="reset-password"
                type={showPassword ? 'text' : 'password'}
                label="Nouveau mot de passe"
                value={password}
                onChange={(val) => {
                  setPassword(val);
                  setPasswordError('');
                }}
                icon={<Lock className="w-5 h-5" />}
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                }
                error={passwordError}
                autoComplete="new-password"
                autoFocus
              />
              <PremiumInput
                id="reset-confirm"
                type={showPassword ? 'text' : 'password'}
                label="Confirmer le mot de passe"
                value={confirmPassword}
                onChange={setConfirmPassword}
                icon={<Lock className="w-5 h-5" />}
                isValid={confirmPassword.length >= 6 && confirmPassword === password}
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !password || !confirmPassword}
              className="w-full btn-primary-gradient h-12 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Réinitialiser'
              )}
            </button>
          </form>
        </div>
      </LoginBackground>
    );
  }

  // ─── SIGNUP MODE ──────────────────────────
  return (
    <LoginBackground>
      <div className="flex-1 flex flex-col px-4 py-8 sm:px-6">
        <button
          onClick={() => switchMode('login')}
          className="absolute top-6 left-4 z-20 w-10 h-10 rounded-full bg-card/80 backdrop-blur-sm border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors animate-fade-in"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div
          className="flex justify-center mb-4 animate-logo-entrance"
          style={{ animationFillMode: 'both' }}
        >
          <BonziniLogo size="lg" showText textPosition="bottom" />
        </div>

        <div className="text-center mb-6 animate-slide-up" style={{ animationDelay: '80ms', animationFillMode: 'both' }}>
          <h1 className="text-2xl font-bold mb-1">Créer un compte</h1>
          <p className="text-muted-foreground text-sm">
            Rejoignez Bonzini pour commencer
          </p>
        </div>

        <form
          onSubmit={handleSignup}
          className="w-full max-w-2xl mx-auto card-glass p-5 sm:p-6 space-y-5 animate-slide-up"
          style={{ animationDelay: '160ms', animationFillMode: 'both' }}
        >
          {/* Personal Info */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Informations personnelles
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PremiumInput
                id="signup-firstName"
                label="Prénom *"
                value={firstName}
                onChange={setFirstName}
                icon={<User className="w-4 h-4" />}
                autoComplete="given-name"
                disabled={isSubmitting}
              />
              <PremiumInput
                id="signup-lastName"
                label="Nom *"
                value={lastName}
                onChange={setLastName}
                icon={<User className="w-4 h-4" />}
                autoComplete="family-name"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PremiumInput
              id="signup-phone"
              type="tel"
              label="Téléphone *"
              value={phone}
              onChange={setPhone}
              icon={<Phone className="w-4 h-4" />}
              autoComplete="tel"
              disabled={isSubmitting}
            />
            <PremiumInput
              id="signup-dob"
              type="date"
              label="Date de naissance"
              value={dateOfBirth}
              onChange={setDateOfBirth}
              icon={<Calendar className="w-4 h-4" />}
              disabled={isSubmitting}
            />
          </div>

          {/* Business Info */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Entreprise (optionnel)
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PremiumInput
                id="signup-company"
                label="Nom de l'entreprise"
                value={companyName}
                onChange={setCompanyName}
                icon={<Building className="w-4 h-4" />}
                disabled={isSubmitting}
              />
              <PremiumInput
                id="signup-sector"
                label="Secteur d'activité"
                value={activitySector}
                onChange={setActivitySector}
                icon={<Briefcase className="w-4 h-4" />}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Adresse (optionnel)
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <PremiumInput
                id="signup-neighborhood"
                label="Quartier"
                value={neighborhood}
                onChange={setNeighborhood}
                icon={<MapPin className="w-4 h-4" />}
                disabled={isSubmitting}
              />
              <PremiumInput
                id="signup-city"
                label="Ville"
                value={city}
                onChange={setCity}
                icon={<MapPin className="w-4 h-4" />}
                disabled={isSubmitting}
              />
              <PremiumInput
                id="signup-country"
                label="Pays"
                value={country}
                onChange={setCountry}
                icon={<MapPin className="w-4 h-4" />}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Login Credentials */}
          <div className="border-t border-border/50 pt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Identifiants de connexion
            </p>
            <div className="space-y-4">
              <PremiumInput
                id="signup-email"
                type="email"
                label="Email *"
                value={email}
                onChange={(val) => {
                  setEmail(val);
                  setEmailError('');
                }}
                icon={<Mail className="w-4 h-4" />}
                error={emailError}
                isValid={isEmailValid && email.length > 0}
                autoComplete="email"
                disabled={isSubmitting}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <PremiumInput
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  label="Mot de passe *"
                  value={password}
                  onChange={(val) => {
                    setPassword(val);
                    setPasswordError('');
                  }}
                  icon={<Lock className="w-4 h-4" />}
                  rightElement={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                  error={passwordError}
                  autoComplete="new-password"
                  disabled={isSubmitting}
                />
                <PremiumInput
                  id="signup-confirm"
                  type={showPassword ? 'text' : 'password'}
                  label="Confirmer *"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  icon={<Lock className="w-4 h-4" />}
                  isValid={confirmPassword.length >= 6 && confirmPassword === password}
                  autoComplete="new-password"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">* Champs obligatoires</p>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full btn-primary-gradient h-12 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Création...
              </>
            ) : (
              'Créer mon compte'
            )}
          </button>
        </form>
      </div>

      <div className="p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Déjà un compte ?{' '}
          <button
            type="button"
            onClick={() => switchMode('login')}
            className="text-primary hover:underline font-medium"
          >
            Se connecter
          </button>
        </p>
      </div>
    </LoginBackground>
  );
}
