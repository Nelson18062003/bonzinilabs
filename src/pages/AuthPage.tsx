import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth, SignUpData } from '@/contexts/AuthContext';
import { track } from '@vercel/analytics';
import { getStoredUtm, clearStoredUtm } from '@/hooks/useUtmTracking';
import { LoginBackground } from '@/components/auth/LoginBackground';
import { PremiumInput } from '@/components/auth/PremiumInput';
import { ProgressDots } from '@/components/auth/ProgressDots';
import { StepTransition } from '@/components/auth/StepTransition';
import { PhoneCountryInput, COUNTRIES } from '@/components/auth/PhoneCountryInput';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { BonziniLogo } from '@/components/BonziniLogo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
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
  ArrowRight,
  CheckCircle,
  Globe,
} from 'lucide-react';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { SURFACE, TEXT, PRIMARY_PILL } from '@/mobile/designKit';

// ── Refonte « Direction A » — chrome partagé des écrans d'auth ──────────────
// Canvas calme (via LoginBackground), pill charbon unique, dots lilas, bascule
// connexion/inscription remontée tout en haut (barre du haut).
const CTA_PILL = cn(
  'flex h-12 w-full items-center justify-center gap-2 text-[15px] font-bold transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
  PRIMARY_PILL,
);
const BACK_BTN_CLS = cn(
  'flex h-10 w-10 items-center justify-center rounded-full transition active:scale-95',
  SURFACE.card,
  SURFACE.shadow,
  TEXT.strong,
);

/** Barre du haut : créneau gauche (langue ou retour) + bascule à droite. */
function AuthTopBar({ left, right }: { left?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 pt-5">
      <div className="flex min-h-[40px] items-center">{left}</div>
      <div className="flex min-h-[40px] items-center">{right}</div>
    </div>
  );
}

/** Pastille de bascule connexion/inscription (en haut à droite). */
function SwitchPill({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 rounded-full px-3.5 py-2 text-[13px] font-bold transition active:scale-95',
        SURFACE.card,
        SURFACE.shadow,
        TEXT.strong,
      )}
    >
      {label} <ArrowRight className="h-3.5 w-3.5" />
    </button>
  );
}

/** Bouton retour rond (créneau gauche de la barre du haut). */
function BackButton({ onClick, label }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className={BACK_BTN_CLS}>
      <ArrowLeft className="h-5 w-5" />
    </button>
  );
}

// Schemas use basic validation — translated messages are applied at usage sites
const emailSchema = z.string().email();
const passwordSchema = z.string().min(6);
const nameSchema = z.string().min(1);
const phoneSchema = z.string().min(8);

type AuthMode = 'login' | 'signup' | 'verify-otp' | 'forgot-password' | 'reset-password';

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation('auth');
  const { signIn, signUp, verifyEmailOtp, resendSignupOtp, signInWithGoogle, resetPassword, updatePassword, isLoading: authLoading, user } = useAuth();

  const [googleLoading, setGoogleLoading] = useState(false);
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

  // OTP de vérification email (inscription)
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpResending, setOtpResending] = useState(false);
  const [pendingSignup, setPendingSignup] = useState<SignUpData | null>(null);
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
    if (user && mode !== 'reset-password' && mode !== 'signup' && mode !== 'verify-otp') {
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
      setEmailError(t('validation.enterValidEmail'));
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
      setPasswordError(t('validation.passwordMin'));
      return;
    }

    setIsSubmitting(true);
    const { error } = await signIn(email, password);
    setIsSubmitting(false);

    if (error) {
      // Email pas encore vérifié → on bascule sur l'écran du code (+ renvoi d'un code)
      // au lieu d'une erreur de connexion.
      if (/not confirmed|email.*confirm/i.test(error.message)) {
        void resendSignupOtp(email);
        setOtpCode('');
        setOtpError('');
        setDirection('forward');
        setMode('verify-otp');
        toast.success(t('verifyEmail.codeSent', { defaultValue: 'Vérifiez votre email — un code vous a été envoyé.' }));
        return;
      }
      if (error.message.includes('Invalid login credentials')) {
        setPasswordError(t('validation.incorrectCredentials'));
      } else {
        setPasswordError(error.message || t('validation.loginError'));
      }
      return;
    }

    toast.success(t('toast.welcome'));
    setIsFadingOut(true);
    setTimeout(() => navigate('/wallet'), 300);
  };

  // Social login Google : redirige vers Google ; le retour est géré par
  // /auth/callback (session + routage onboarding/app).
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    track('client_google_signin_click');
    const { error } = await signInWithGoogle();
    if (error) {
      setGoogleLoading(false);
      toast.error(t('validation.loginError', { defaultValue: 'Connexion impossible. Réessayez.' }));
    }
    // En cas de succès, le navigateur redirige : on laisse le spinner actif.
  };

  // Forgot password
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');

    const result = emailSchema.safeParse(email);
    if (!result.success) {
      setEmailError(t('validation.invalidEmail'));
      return;
    }

    setIsSubmitting(true);
    const { error } = await resetPassword(email);
    setIsSubmitting(false);

    if (error) {
      toast.error(t('toast.resetEmailError'));
      return;
    }

    toast.success(t('toast.resetEmailSent'));
    switchMode('login');
  };

  // Reset password (from email link)
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    const pwdResult = passwordSchema.safeParse(password);
    if (!pwdResult.success) {
      setPasswordError(t('validation.passwordMin'));
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError(t('validation.passwordMismatch'));
      return;
    }

    setIsSubmitting(true);
    const { error } = await updatePassword(password);
    setIsSubmitting(false);

    if (error) {
      setPasswordError(error.message || t('validation.loginError'));
      return;
    }

    toast.success(t('toast.passwordUpdated'));
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
      if (!fnResult.success) { setFirstNameError(t('validation.firstNameRequired')); return; }
      const lnResult = nameSchema.safeParse(lastName);
      if (!lnResult.success) { setLastNameError(t('validation.lastNameRequired')); return; }
    } else if (signupStep === 1) {
      setCountryError('');
      setPhoneError('');
      if (!country) { setCountryError(t('validation.countryRequired')); return; }
      const phoneResult = phoneSchema.safeParse(phone);
      if (!phoneResult.success) { setPhoneError(t('validation.invalidPhone')); return; }
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
      setEmailError(t('validation.invalidEmail'));
      return;
    }

    const pwdResult = passwordSchema.safeParse(password);
    if (!pwdResult.success) {
      setPasswordError(t('validation.passwordMin'));
      return;
    }

    const fnResult = nameSchema.safeParse(firstName);
    if (!fnResult.success) {
      toast.error(t('validation.firstNameRequired'));
      return;
    }

    const lnResult = nameSchema.safeParse(lastName);
    if (!lnResult.success) {
      toast.error(t('validation.lastNameRequired'));
      return;
    }

    const phoneResult = phoneSchema.safeParse(phone);
    if (!phoneResult.success) {
      toast.error(t('validation.invalidPhone'));
      return;
    }

    if (!country) {
      toast.error(t('validation.countryRequired'));
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError(t('validation.passwordMismatch'));
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

    const { error, needsVerification } = await signUp(signUpData);
    setIsSubmitting(false);

    if (error) {
      if (error.message.includes('already registered')) {
        toast.error(t('validation.emailAlreadyUsed'));
      } else {
        toast.error(error.message || t('validation.signupError'));
      }
      return;
    }

    track('signup_completed', {
      utm_source:   utm?.utm_source   ?? 'direct',
      utm_medium:   utm?.utm_medium   ?? 'none',
      utm_campaign: utm?.utm_campaign ?? 'none',
    });
    clearStoredUtm();
    setPendingSignup(signUpData);

    // Confirmation email activée → écran de saisie du code (OTP).
    // Sinon (confirmation désactivée) → écran de succès historique.
    if (needsVerification) {
      setOtpCode('');
      setOtpError('');
      setDirection('forward');
      setMode('verify-otp');
      return;
    }

    setSignupSuccess(true);
  };

  // Vérification du code OTP reçu par email à l'inscription.
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError('');
    const code = otpCode.trim();
    if (code.length < 6) {
      setOtpError(t('verifyEmail.invalidCode', { defaultValue: 'Entrez le code reçu par email.' }));
      return;
    }
    setIsSubmitting(true);
    const { error } = await verifyEmailOtp(email, code, pendingSignup ?? undefined);
    setIsSubmitting(false);
    if (error) {
      setOtpError(t('verifyEmail.wrongCode', { defaultValue: 'Code invalide ou expiré. Réessayez ou demandez un nouveau code.' }));
      return;
    }
    toast.success(t('verifyEmail.success', { defaultValue: 'Compte vérifié ! Bienvenue 🎉' }));
    setIsFadingOut(true);
    setTimeout(() => navigate('/wallet'), 300);
  };

  const handleResendOtp = async () => {
    setOtpResending(true);
    const { error } = await resendSignupOtp(email);
    setOtpResending(false);
    if (error) {
      toast.error(t('verifyEmail.resendError', { defaultValue: 'Impossible de renvoyer le code. Réessayez.' }));
      return;
    }
    toast.success(t('verifyEmail.resent', { defaultValue: 'Nouveau code envoyé !' }));
  };

  if (authLoading) {
    return (
      <div className={cn('flex min-h-screen items-center justify-center', SURFACE.canvas)}>
        <Loader2 className="h-8 w-8 animate-spin text-[#8B5CF6]" />
      </div>
    );
  }

  // ─── LOGIN MODE (multi-step) ──────────────────────────
  if (mode === 'login') {
    return (
      <LoginBackground className={cn(isFadingOut && 'animate-fade-out')}>
        <AuthTopBar
          left={
            loginStep === 1 ? (
              <BackButton
                label={t('login.title')}
                onClick={() => {
                  setDirection('back');
                  setLoginStep(0);
                  setPasswordError('');
                }}
              />
            ) : (
              <LanguageSwitcher />
            )
          }
          right={<SwitchPill label={t('login.switchToSignup')} onClick={() => switchMode('signup')} />}
        />
        <div className="flex flex-1 flex-col justify-center px-6 pb-12">
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
                  <h1 className={cn('mb-1 text-[24px] font-black', TEXT.strong)}>{t('login.title')}</h1>
                  <p className={cn('text-[13px]', TEXT.muted)}>
                    {t('login.subtitle')}
                  </p>
                </div>

                <div
                  className="mb-6 animate-slide-up"
                  style={{ animationDelay: '160ms', animationFillMode: 'both' }}
                >
                  <PremiumInput
                    id="client-email"
                    type="email"
                    label={t('login.emailLabel')}
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
                    className={CTA_PILL}
                  >
                    {t('login.continue')}
                  </button>
                </div>

                {/* Social login Google */}
                <div
                  className="animate-slide-up"
                  style={{ animationDelay: '320ms', animationFillMode: 'both' }}
                >
                  <div className="flex items-center gap-3 my-5">
                    <Separator className="flex-1" />
                    <span className={cn('text-[12px]', TEXT.muted)}>{t('login.or', { defaultValue: 'ou' })}</span>
                    <Separator className="flex-1" />
                  </div>
                  <GoogleButton
                    onClick={handleGoogleSignIn}
                    loading={googleLoading}
                    label={t('login.continueWithGoogle', { defaultValue: 'Continuer avec Google' })}
                  />
                  <p className={cn('mt-5 text-center text-[11px]', TEXT.muted)}>{t('login.socialProof')}</p>
                </div>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="max-w-sm mx-auto w-full">
                <div className="text-center mb-8">
                  <h1 className={cn('mb-1 text-[24px] font-black', TEXT.strong)}>{t('login.greeting')}</h1>
                  <p className={cn('text-[13px]', TEXT.muted)}>{maskEmail(email)}</p>
                </div>

                <div className="mb-4">
                  <PremiumInput
                    id="client-password"
                    type={showPassword ? 'text' : 'password'}
                    label={t('login.passwordLabel')}
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
                    className="text-[13px] font-semibold text-[#5B4CC4] hover:underline dark:text-[#B5AAF0]"
                  >
                    {t('login.forgotPassword')}
                  </button>
                </div>

                <ProgressDots totalSteps={2} currentStep={1} className="mb-6" />

                <button
                  type="submit"
                  disabled={isSubmitting || !password}
                  className={CTA_PILL}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {t('login.signingIn')}
                    </>
                  ) : (
                    t('login.signIn')
                  )}
                </button>
              </form>
            )}
          </StepTransition>
        </div>
      </LoginBackground>
    );
  }

  // ─── VERIFY OTP MODE (code email à l'inscription) ──────────────────────────
  if (mode === 'verify-otp') {
    return (
      <LoginBackground>
        <AuthTopBar left={<BackButton label={t('login.title')} onClick={() => switchMode('signup')} />} />
        <div className="flex flex-1 flex-col justify-center px-6 pb-12">
          <div className="flex justify-center mb-6 animate-logo-entrance" style={{ animationFillMode: 'both' }}>
            <BonziniLogo size="lg" showText={false} />
          </div>

          <form onSubmit={handleVerifyOtp} className="max-w-sm mx-auto w-full animate-slide-up" style={{ animationFillMode: 'both' }}>
            <div className="text-center mb-8">
              <h1 className={cn('mb-1 text-[24px] font-black', TEXT.strong)}>{t('verifyEmail.title', { defaultValue: 'Vérifiez votre email' })}</h1>
              <p className={cn('text-[13px]', TEXT.muted)}>
                {t('verifyEmail.subtitle', { defaultValue: 'Saisissez le code reçu par email à' })}{' '}
                <span className={cn('font-semibold', TEXT.strong)}>{maskEmail(email)}</span>
              </p>
            </div>

            <div className="mb-2">
              <input
                id="otp-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                value={otpCode}
                onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 8)); setOtpError(''); }}
                autoFocus
                placeholder="••••••"
                className={cn('h-16 w-full rounded-2xl text-center text-3xl font-bold tracking-[0.4em] placeholder:text-[#C7C4D6] focus:outline-none focus:ring-2 focus:ring-[#C9C2F0] dark:placeholder:text-white/20 dark:focus:ring-[#4A4660]', SURFACE.card, SURFACE.shadow, TEXT.strong)}
              />
              {otpError && <p className="mt-2 text-center text-sm text-[#C0504D] dark:text-[#E79A9A]">{otpError}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || otpCode.length < 6}
              className={cn(CTA_PILL, 'mt-4')}
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                t('verifyEmail.verify', { defaultValue: 'Vérifier mon compte' })
              )}
            </button>

            <p className={cn('mt-6 text-center text-[13px]', TEXT.muted)}>
              {t('verifyEmail.noCode', { defaultValue: "Vous n'avez pas reçu le code ?" })}{' '}
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={otpResending}
                className="font-semibold text-[#5B4CC4] hover:underline disabled:opacity-50 dark:text-[#B5AAF0]"
              >
                {otpResending
                  ? t('verifyEmail.resending', { defaultValue: 'Envoi…' })
                  : t('verifyEmail.resend', { defaultValue: 'Renvoyer le code' })}
              </button>
            </p>
          </form>
        </div>
      </LoginBackground>
    );
  }

  if (mode === 'forgot-password') {
    return (
      <LoginBackground>
        <AuthTopBar left={<BackButton label={t('login.title')} onClick={() => switchMode('login')} />} />
        <div className="flex flex-1 flex-col justify-center px-6 pb-12">
          <div
            className="flex justify-center mb-6 animate-logo-entrance"
            style={{ animationFillMode: 'both' }}
          >
            <BonziniLogo size="lg" showText={false} />
          </div>

          <form onSubmit={handleForgotPassword} className="max-w-sm mx-auto w-full animate-slide-up" style={{ animationFillMode: 'both' }}>
            <div className="text-center mb-8">
              <h1 className={cn('mb-1 text-[24px] font-black', TEXT.strong)}>{t('forgotPassword.title')}</h1>
              <p className={cn('text-[13px]', TEXT.muted)}>
                {t('forgotPassword.subtitle')}
              </p>
            </div>

            <div className="mb-6">
              <PremiumInput
                id="forgot-email"
                type="email"
                label={t('login.emailLabel')}
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
              className={CTA_PILL}
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                t('forgotPassword.sendLink')
              )}
            </button>

            <p className={cn('mt-6 text-center text-[13px]', TEXT.muted)}>
              {t('forgotPassword.remember')}{' '}
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="font-semibold text-[#5B4CC4] hover:underline dark:text-[#B5AAF0]"
              >
                {t('forgotPassword.signIn')}
              </button>
            </p>
          </form>
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
              <h1 className={cn('mb-1 text-[24px] font-black', TEXT.strong)}>{t('resetPassword.title')}</h1>
              <p className={cn('text-[13px]', TEXT.muted)}>
                {t('resetPassword.subtitle')}
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <PremiumInput
                id="reset-password"
                type={showPassword ? 'text' : 'password'}
                label={t('resetPassword.newPassword')}
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
                label={t('resetPassword.confirmPassword')}
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
              className={CTA_PILL}
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                t('resetPassword.reset')
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
              <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-[#DEEFE5] dark:bg-[#1E3A2C]">
                <CheckCircle className="h-12 w-12 text-[#2E7D52] dark:text-[#7FCBA0]" />
              </div>
              <h1 className={cn('mb-3 text-[24px] font-black', TEXT.strong)}>{t('signup.success.title')}</h1>
              <p className={cn('mx-auto mb-8 max-w-xs text-[13px]', TEXT.muted)}>
                {t('signup.success.subtitle')}
              </p>
              <button
                onClick={() => switchMode('login')}
                className={cn('mx-auto flex h-12 items-center justify-center gap-2 px-8 text-[15px] font-bold transition active:scale-[0.99]', PRIMARY_PILL)}
              >
                {t('signup.success.signIn')}
              </button>
            </div>
          </div>
        </LoginBackground>
      );
    }

    // ── Step configuration ──
    const stepConfig = [
      { title: t('signup.identity.title'), subtitle: t('signup.identity.subtitle'), emoji: '\ud83d\udc4b' },
      { title: t('signup.contact.title'), subtitle: t('signup.contact.subtitle'), emoji: '\ud83d\udcf1' },
      { title: t('signup.business.title'), subtitle: t('signup.business.subtitle'), emoji: '\ud83c\udfe2' },
      { title: t('signup.address.title'), subtitle: t('signup.address.subtitle'), emoji: '\ud83d\udccd' },
      { title: t('signup.credentials.title'), subtitle: t('signup.credentials.subtitle'), emoji: '\ud83d\udd10' },
    ];
    const currentStepConfig = stepConfig[signupStep];

    return (
      <LoginBackground>
        <AuthTopBar
          left={
            signupStep === 0 ? (
              <LanguageSwitcher />
            ) : (
              <BackButton
                label={t('login.title')}
                onClick={() => {
                  setDirection('back');
                  setSignupStep(s => (s - 1) as 0 | 1 | 2 | 3 | 4);
                }}
              />
            )
          }
          right={<SwitchPill label={t('signup.switchToLogin')} onClick={() => switchMode('login')} />}
        />
        <div className="flex flex-1 flex-col px-4 pb-6 sm:px-6">
          {/* Logo */}
          <div className="flex justify-center mb-5 mt-2 animate-logo-entrance" style={{ animationFillMode: 'both' }}>
            <BonziniLogo size="md" showText={false} />
          </div>

          {/* Progress indicator */}
          <ProgressDots totalSteps={5} currentStep={signupStep} className="mb-6" />

          {/* Step header */}
          <div className="text-center mb-6 animate-slide-up" style={{ animationFillMode: 'both' }}>
            <p className="text-4xl mb-2">{currentStepConfig.emoji}</p>
            <h1 className={cn('mb-1 text-[20px] font-black', TEXT.strong)}>{currentStepConfig.title}</h1>
            <p className={cn('text-[13px]', TEXT.muted)}>{currentStepConfig.subtitle}</p>
          </div>

          {/* Step content */}
          <StepTransition stepKey={signupStep} direction={direction}>
            <div className="max-w-sm mx-auto w-full">

              {/* Step 0 — Identity (required) */}
              {signupStep === 0 && (
                <form onSubmit={handleSignupStepNext} className="space-y-4">
                  <PremiumInput
                    id="signup-firstName"
                    label={t('signup.firstName')}
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
                    label={t('signup.lastName')}
                    value={lastName}
                    onChange={(val) => { setLastName(val); setLastNameError(''); }}
                    icon={<User className="w-4 h-4" />}
                    error={lastNameError}
                    autoComplete="family-name"
                    disabled={isSubmitting}
                  />
                  <button
                    type="submit"
                    className={cn(CTA_PILL, 'mt-2')}
                  >
                    {t('common:continue')}
                  </button>

                  {/* Social login Google — raccourci d'inscription */}
                  <div className="flex items-center gap-3 my-1">
                    <Separator className="flex-1" />
                    <span className={cn('text-[12px]', TEXT.muted)}>{t('login.or', { defaultValue: 'ou' })}</span>
                    <Separator className="flex-1" />
                  </div>
                  <GoogleButton
                    onClick={handleGoogleSignIn}
                    loading={googleLoading}
                    disabled={isSubmitting}
                    label={t('signup.continueWithGoogle', { defaultValue: 'S\'inscrire avec Google' })}
                  />
                </form>
              )}

              {/* Step 1 — Contact (country required, phone required) */}
              {signupStep === 1 && (
                <form onSubmit={handleSignupStepNext} className="space-y-4">
                  {/* Country selector */}
                  <div>
                    <label className="mb-1.5 flex items-center gap-2 text-[13px] font-semibold text-[#1B1A24] dark:text-[#F2F1F7]">
                      <Globe className="w-4 h-4" />
                      {t('signup.country')}
                    </label>
                    <select
                      value={country}
                      onChange={e => { setCountry(e.target.value); setCountryError(''); }}
                      disabled={isSubmitting}
                      autoFocus
                      className={cn(
                        'w-full appearance-none rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9C2F0] dark:focus:ring-[#4A4660]',
                        SURFACE.card, SURFACE.shadow, TEXT.strong,
                        countryError && 'ring-2 ring-[#C0504D]/40',
                      )}
                    >
                      <option value="">{t('signup.selectCountry')}</option>
                      {COUNTRIES.map(c => (
                        <option key={`${c.dialCode}-${c.name}`} value={c.name}>
                          {c.flag} {c.name}
                        </option>
                      ))}
                    </select>
                    {countryError && (
                      <p className="mt-1 text-xs text-[#C0504D] dark:text-[#E79A9A]">{countryError}</p>
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
                    <label className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-[#1B1A24] dark:text-[#F2F1F7]">
                      <Calendar className="w-4 h-4" />
                      {t('signup.dateOfBirth')}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={dobDay}
                        onChange={e => setDobDay(e.target.value)}
                        disabled={isSubmitting}
                        className="w-full appearance-none rounded-2xl bg-white px-3 py-3 text-sm text-[#1B1A24] shadow-[0_8px_30px_-12px_rgba(46,32,92,0.18)] focus:outline-none focus:ring-2 focus:ring-[#C9C2F0] dark:bg-[#211F2B] dark:text-[#F2F1F7] dark:shadow-none dark:ring-1 dark:ring-white/[0.06] dark:focus:ring-[#4A4660]"
                      >
                        <option value="">{t('signup.day')}</option>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                          <option key={d} value={String(d)}>{d}</option>
                        ))}
                      </select>
                      <select
                        value={dobMonth}
                        onChange={e => setDobMonth(e.target.value)}
                        disabled={isSubmitting}
                        className="w-full appearance-none rounded-2xl bg-white px-3 py-3 text-sm text-[#1B1A24] shadow-[0_8px_30px_-12px_rgba(46,32,92,0.18)] focus:outline-none focus:ring-2 focus:ring-[#C9C2F0] dark:bg-[#211F2B] dark:text-[#F2F1F7] dark:shadow-none dark:ring-1 dark:ring-white/[0.06] dark:focus:ring-[#4A4660]"
                      >
                        <option value="">{t('signup.month')}</option>
                        {(t('signup.months', { returnObjects: true }) as string[]).map((m, i) => (
                          <option key={i} value={String(i + 1)}>{m}</option>
                        ))}
                      </select>
                      <select
                        value={dobYear}
                        onChange={e => setDobYear(e.target.value)}
                        disabled={isSubmitting}
                        className="w-full appearance-none rounded-2xl bg-white px-3 py-3 text-sm text-[#1B1A24] shadow-[0_8px_30px_-12px_rgba(46,32,92,0.18)] focus:outline-none focus:ring-2 focus:ring-[#C9C2F0] dark:bg-[#211F2B] dark:text-[#F2F1F7] dark:shadow-none dark:ring-1 dark:ring-white/[0.06] dark:focus:ring-[#4A4660]"
                      >
                        <option value="">{t('signup.year')}</option>
                        {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - 16 - i).map(y => (
                          <option key={y} value={String(y)}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className={cn(CTA_PILL, 'mt-2')}
                  >
                    {t('common:continue')}
                  </button>
                </form>
              )}

              {/* Step 2 — Business (optional) */}
              {signupStep === 2 && (
                <form onSubmit={handleSignupStepNext} className="space-y-4">
                  <PremiumInput
                    id="signup-company"
                    label={t('signup.companyName')}
                    value={companyName}
                    onChange={setCompanyName}
                    icon={<Building className="w-4 h-4" />}
                    autoFocus
                    disabled={isSubmitting}
                  />
                  <PremiumInput
                    id="signup-sector"
                    label={t('signup.activitySector')}
                    value={activitySector}
                    onChange={setActivitySector}
                    icon={<Briefcase className="w-4 h-4" />}
                    disabled={isSubmitting}
                  />
                  <button
                    type="submit"
                    className={cn(CTA_PILL, 'mt-2')}
                  >
                    {t('common:continue')}
                  </button>
                  <button
                    type="button"
                    onClick={advanceSignupStep}
                    className={cn('w-full py-2 text-[13px] font-semibold transition-colors', TEXT.muted, 'hover:text-[#5B4CC4] dark:hover:text-[#B5AAF0]')}
                  >
                    {t('signup.skipStep')}
                  </button>
                </form>
              )}

              {/* Step 3 — Address (optional) */}
              {signupStep === 3 && (
                <form onSubmit={handleSignupStepNext} className="space-y-4">
                  <PremiumInput
                    id="signup-neighborhood"
                    label={t('signup.neighborhood')}
                    value={neighborhood}
                    onChange={setNeighborhood}
                    icon={<MapPin className="w-4 h-4" />}
                    autoFocus
                    disabled={isSubmitting}
                  />
                  <PremiumInput
                    id="signup-city"
                    label={t('signup.city')}
                    value={city}
                    onChange={setCity}
                    icon={<MapPin className="w-4 h-4" />}
                    disabled={isSubmitting}
                  />
                  <button
                    type="submit"
                    className={cn(CTA_PILL, 'mt-2')}
                  >
                    {t('common:continue')}
                  </button>
                  <button
                    type="button"
                    onClick={advanceSignupStep}
                    className={cn('w-full py-2 text-[13px] font-semibold transition-colors', TEXT.muted, 'hover:text-[#5B4CC4] dark:hover:text-[#B5AAF0]')}
                  >
                    {t('signup.skipStep')}
                  </button>
                </form>
              )}

              {/* Step 4 — Credentials (submit) */}
              {signupStep === 4 && (
                <form onSubmit={handleSignup} className="space-y-4">
                  <PremiumInput
                    id="signup-email"
                    type="email"
                    label={t('signup.emailLabel')}
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
                    label={t('signup.passwordLabel')}
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
                    label={t('signup.confirmPasswordLabel')}
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
                    className={cn(CTA_PILL, 'mt-2')}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {t('signup.creating')}
                      </>
                    ) : (
                      t('signup.createAccount')
                    )}
                  </button>
                </form>
              )}

            </div>
          </StepTransition>
        </div>
      </LoginBackground>
    );
  }

  return null;
}
