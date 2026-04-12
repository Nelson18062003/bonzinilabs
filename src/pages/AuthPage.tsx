import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, SignUpData } from '@/contexts/AuthContext';
import { track } from '@vercel/analytics';
import { getStoredUtm, clearStoredUtm } from '@/hooks/useUtmTracking';
import { LoginBackground } from '@/components/auth/LoginBackground';
import { PremiumInput } from '@/components/auth/PremiumInput';
import { ProgressDots } from '@/components/auth/ProgressDots';
import { StepTransition } from '@/components/auth/StepTransition';
import { PhoneCountryInput, COUNTRIES } from '@/components/auth/PhoneCountryInput';
import { BonziniLogo } from '@/components/BonziniLogo';
import { toast } from 'sonner';
import {
  Loader2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Building,
  MapPin,
  Calendar,
  Briefcase,
  ArrowLeft,
  CheckCircle,
  Globe,
} from 'lucide-react';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

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

  // Multi-step signup state
  const [signupStep, setSignupStep] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [firstNameError, setFirstNameError] = useState('');
  const [lastNameError, setLastNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [countryError, setCountryError] = useState('');

  // Date of birth — 3 separate selectors
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');

  const isEmailValid = emailSchema.safeParse(email).success;

  // Sync the 3 DOB selectors into the dateOfBirth string (YYYY-MM-DD)
  useEffect(() => {
    if (dobDay && dobMonth && dobYear) {
      setDateOfBirth(`${dobYear}-${dobMonth.padStart(2, '0')}-${dobDay.padStart(2, '0')}`);
    } else {
      setDateOfBirth('');
    }
  }, [dobDay, dobMonth, dobYear]);

  // Check for reset password mode or signup mode from URL
  useEffect(() => {
    const type = searchParams.get('type');
    if (type === 'recovery') {
      setMode('reset-password');
    }
    const modeParam = searchParams.get('mode');
    if (modeParam === 'signup') {
      setMode('signup');
    }
  }, [searchParams]);

  // Redirect if already logged in — never redirect during signup flow
  useEffect(() => {
    if (user && mode !== 'reset-password' && mode !== 'signup') {
      navigate('/wallet', { replace: true });
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
    setSignupStep(0);
    setSignupSuccess(false);
    setFirstNameError('');
    setLastNameError('');
    setPhoneError('');
    setCountryError('');
    setDobDay('');
    setDobMonth('');
    setDobYear('');
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
    setTimeout(() => navigate('/wallet'), 300);
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
    navigate('/wallet');
  };

  // Advance signup step without validation (for optional steps)
  const advanceSignupStep = () => {
    setDirection('forward');
    setSignupStep(s => (s + 1) as 0 | 1 | 2 | 3 | 4);
  };

  // Validate required fields per step, then advance
  const handleSignupStepNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (signupStep === 0) {
      setFirstNameError('');
      setLastNameError('');
      const fnResult = nameSchema.safeParse(firstName);
      if (!fnResult.success) { setFirstNameError('Le prénom est obligatoire'); return; }
      const lnResult = nameSchema.safeParse(lastName);
      if (!lnResult.success) { setLastNameError('Le nom est obligatoire'); return; }
    } else if (signupStep === 1) {
      setCountryError('');
      setPhoneError('');
      if (!country) { setCountryError('Le pays est obligatoire'); return; }
      const phoneResult = phoneSchema.safeParse(phone);
      if (!phoneResult.success) { setPhoneError(phoneResult.error.errors[0].message); return; }
    }
    advanceSignupStep();
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

    if (!country) {
      toast.error('Le pays est obligatoire');
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError('Les mots de passe ne correspondent pas');
      return;
    }

    setIsSubmitting(true);

    const utm = getStoredUtm();

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
      country,
      utm: utm ?? undefined,
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

    track('signup_completed', {
      utm_source:   utm?.utm_source   ?? 'direct',
      utm_medium:   utm?.utm_medium   ?? 'none',
      utm_campaign: utm?.utm_campaign ?? 'none',
    });
    clearStoredUtm();

    setSignupSuccess(true);
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

        {/* Footer — shadcn/ui Separator + Button(outline) */}
        <div className="px-6 pt-2 pb-8 flex-shrink-0">
          <div className="max-w-sm mx-auto">
            <div className="relative flex items-center gap-3 mb-4">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">ou</span>
              <Separator className="flex-1" />
            </div>
            <Button
              variant="outline"
              size="lg"
              onClick={() => switchMode('signup')}
              className="w-full h-12 rounded-xl text-sm font-semibold"
            >
              Créer mon compte gratuit
            </Button>
            <p className="text-center text-xs text-muted-foreground mt-3">
              Rejoignez 500+ importateurs qui font confiance à Bonzini
            </p>
          </div>
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
  if (mode === 'signup') {
    // ── Success screen ──
    if (signupSuccess) {
      return (
        <LoginBackground>
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
            <div className="text-center animate-slide-up" style={{ animationFillMode: 'both' }}>
              <div className="w-24 h-24 rounded-full bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-12 h-12 text-emerald-500" />
              </div>
              <h1 className="text-2xl font-bold mb-3">Compte créé avec succès !</h1>
              <p className="text-muted-foreground text-sm mb-8 max-w-xs mx-auto">
                Votre compte a été créé. Vous pouvez maintenant vous connecter et commencer à utiliser Bonzini.
              </p>
              <button
                onClick={() => switchMode('login')}
                className="btn-primary-gradient h-12 px-8 rounded-xl flex items-center justify-center gap-2 mx-auto"
              >
                Se connecter
              </button>
            </div>
          </div>
        </LoginBackground>
      );
    }

    // ── Step configuration ──
    const stepConfig = [
      { title: 'Votre identité', subtitle: 'Comment vous appelle-t-on ?', emoji: '👋' },
      { title: 'Vos coordonnées', subtitle: 'Comment vous joindre ?', emoji: '📱' },
      { title: 'Votre entreprise', subtitle: 'Activité professionnelle (optionnel)', emoji: '🏢' },
      { title: 'Votre adresse', subtitle: 'Où êtes-vous basé ? (optionnel)', emoji: '📍' },
      { title: 'Vos identifiants', subtitle: 'Email et mot de passe de connexion', emoji: '🔐' },
    ];
    const currentStepConfig = stepConfig[signupStep];

    return (
      <LoginBackground>
        <div className="flex-1 flex flex-col px-4 py-6 sm:px-6">
          {/* Back / close button */}
          <button
            onClick={() => {
              if (signupStep === 0) {
                switchMode('login');
              } else {
                setDirection('back');
                setSignupStep(s => (s - 1) as 0 | 1 | 2 | 3 | 4);
              }
            }}
            className="absolute top-6 left-4 z-20 w-10 h-10 rounded-full bg-card/80 backdrop-blur-sm border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors animate-fade-in"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Logo */}
          <div className="flex justify-center mb-5 animate-logo-entrance" style={{ animationFillMode: 'both' }}>
            <BonziniLogo size="md" showText={false} />
          </div>

          {/* Progress indicator */}
          <ProgressDots totalSteps={5} currentStep={signupStep} className="mb-6" />

          {/* Step header */}
          <div className="text-center mb-6 animate-slide-up" style={{ animationFillMode: 'both' }}>
            <p className="text-4xl mb-2">{currentStepConfig.emoji}</p>
            <h1 className="text-xl font-bold mb-1">{currentStepConfig.title}</h1>
            <p className="text-muted-foreground text-sm">{currentStepConfig.subtitle}</p>
          </div>

          {/* Step content */}
          <StepTransition stepKey={signupStep} direction={direction}>
            <div className="max-w-sm mx-auto w-full">

              {/* Step 0 — Identity (required) */}
              {signupStep === 0 && (
                <form onSubmit={handleSignupStepNext} className="space-y-4">
                  <PremiumInput
                    id="signup-firstName"
                    label="Prénom *"
                    value={firstName}
                    onChange={(val) => { setFirstName(val); setFirstNameError(''); }}
                    icon={<User className="w-4 h-4" />}
                    error={firstNameError}
                    autoComplete="given-name"
                    autoFocus
                    disabled={isSubmitting}
                  />
                  <PremiumInput
                    id="signup-lastName"
                    label="Nom *"
                    value={lastName}
                    onChange={(val) => { setLastName(val); setLastNameError(''); }}
                    icon={<User className="w-4 h-4" />}
                    error={lastNameError}
                    autoComplete="family-name"
                    disabled={isSubmitting}
                  />
                  <button
                    type="submit"
                    className="w-full btn-primary-gradient h-12 rounded-xl flex items-center justify-center gap-2 mt-2"
                  >
                    Continuer
                  </button>
                </form>
              )}

              {/* Step 1 — Contact (country required, phone required) */}
              {signupStep === 1 && (
                <form onSubmit={handleSignupStepNext} className="space-y-4">
                  {/* Country selector */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1.5">
                      <Globe className="w-4 h-4" />
                      Pays *
                    </label>
                    <select
                      value={country}
                      onChange={e => { setCountry(e.target.value); setCountryError(''); }}
                      disabled={isSubmitting}
                      autoFocus
                      className={cn(
                        'w-full rounded-xl border bg-card px-3 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary appearance-none',
                        countryError ? 'border-destructive ring-2 ring-destructive/20' : 'border-border',
                      )}
                    >
                      <option value="">Sélectionnez votre pays</option>
                      {COUNTRIES.map(c => (
                        <option key={`${c.dialCode}-${c.name}`} value={c.name}>
                          {c.flag} {c.name}
                        </option>
                      ))}
                    </select>
                    {countryError && (
                      <p className="text-xs text-destructive mt-1">{countryError}</p>
                    )}
                  </div>

                  <PhoneCountryInput
                    value={phone}
                    onChange={(val) => { setPhone(val); setPhoneError(''); }}
                    selectedCountryName={country}
                    onCountryChange={(c) => { setCountry(c.name); setCountryError(''); }}
                    error={phoneError}
                    disabled={isSubmitting}
                  />

                  {/* Date de naissance — 3 sélecteurs */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                      <Calendar className="w-4 h-4" />
                      Date de naissance (optionnel)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={dobDay}
                        onChange={e => setDobDay(e.target.value)}
                        disabled={isSubmitting}
                        className="w-full rounded-xl border border-border bg-card px-3 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary appearance-none"
                      >
                        <option value="">Jour</option>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                          <option key={d} value={String(d)}>{d}</option>
                        ))}
                      </select>
                      <select
                        value={dobMonth}
                        onChange={e => setDobMonth(e.target.value)}
                        disabled={isSubmitting}
                        className="w-full rounded-xl border border-border bg-card px-3 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary appearance-none"
                      >
                        <option value="">Mois</option>
                        {['Janv.','Févr.','Mars','Avr.','Mai','Juin','Juil.','Août','Sept.','Oct.','Nov.','Déc.'].map((m, i) => (
                          <option key={i} value={String(i + 1)}>{m}</option>
                        ))}
                      </select>
                      <select
                        value={dobYear}
                        onChange={e => setDobYear(e.target.value)}
                        disabled={isSubmitting}
                        className="w-full rounded-xl border border-border bg-card px-3 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary appearance-none"
                      >
                        <option value="">Année</option>
                        {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - 16 - i).map(y => (
                          <option key={y} value={String(y)}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full btn-primary-gradient h-12 rounded-xl flex items-center justify-center gap-2 mt-2"
                  >
                    Continuer
                  </button>
                </form>
              )}

              {/* Step 2 — Business (optional) */}
              {signupStep === 2 && (
                <form onSubmit={handleSignupStepNext} className="space-y-4">
                  <PremiumInput
                    id="signup-company"
                    label="Nom de l'entreprise"
                    value={companyName}
                    onChange={setCompanyName}
                    icon={<Building className="w-4 h-4" />}
                    autoFocus
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
                  <button
                    type="submit"
                    className="w-full btn-primary-gradient h-12 rounded-xl flex items-center justify-center gap-2 mt-2"
                  >
                    Continuer
                  </button>
                  <button
                    type="button"
                    onClick={advanceSignupStep}
                    className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                  >
                    Passer cette étape →
                  </button>
                </form>
              )}

              {/* Step 3 — Address (optional) */}
              {signupStep === 3 && (
                <form onSubmit={handleSignupStepNext} className="space-y-4">
                  <PremiumInput
                    id="signup-neighborhood"
                    label="Quartier"
                    value={neighborhood}
                    onChange={setNeighborhood}
                    icon={<MapPin className="w-4 h-4" />}
                    autoFocus
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
                  <button
                    type="submit"
                    className="w-full btn-primary-gradient h-12 rounded-xl flex items-center justify-center gap-2 mt-2"
                  >
                    Continuer
                  </button>
                  <button
                    type="button"
                    onClick={advanceSignupStep}
                    className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                  >
                    Passer cette étape →
                  </button>
                </form>
              )}

              {/* Step 4 — Credentials (submit) */}
              {signupStep === 4 && (
                <form onSubmit={handleSignup} className="space-y-4">
                  <PremiumInput
                    id="signup-email"
                    type="email"
                    label="Email *"
                    value={email}
                    onChange={(val) => { setEmail(val); setEmailError(''); }}
                    icon={<Mail className="w-4 h-4" />}
                    error={emailError}
                    isValid={isEmailValid && email.length > 0}
                    autoComplete="email"
                    autoFocus
                    disabled={isSubmitting}
                  />
                  <PremiumInput
                    id="signup-password"
                    type={showPassword ? 'text' : 'password'}
                    label="Mot de passe *"
                    value={password}
                    onChange={(val) => { setPassword(val); setPasswordError(''); }}
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
                    label="Confirmer le mot de passe *"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    icon={<Lock className="w-4 h-4" />}
                    isValid={confirmPassword.length >= 6 && confirmPassword === password}
                    autoComplete="new-password"
                    disabled={isSubmitting}
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full btn-primary-gradient h-12 rounded-xl flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
              )}

            </div>
          </StepTransition>
        </div>

        {/* Footer signup — "Déjà client ?" avec Button link shadcn/ui */}
        <div className="px-6 pb-6 pt-2 text-center flex-shrink-0">
          <p className="text-sm text-muted-foreground">
            Déjà client ?{' '}
            <Button
              variant="link"
              onClick={() => switchMode('login')}
              className="text-primary font-semibold p-0 h-auto"
            >
              Connectez-vous
            </Button>
          </p>
        </div>
      </LoginBackground>
    );
  }

  return null;
}
