// ============================================================
// Écran de connexion ADMIN — refonte « plus de mot de passe à retenir ».
//
// L'ancien écran n'offrait qu'un seul chemin (email + mot de passe) et AUCUNE
// récupération : un admin qui oubliait son mot de passe était bloqué jusqu'à
// ce qu'un super_admin lui en génère un nouveau, à transmettre à la main.
//
// Quatre chemins désormais, du plus simple au plus technique :
//   1. code à 6 chiffres reçu par email   (aucun mot de passe)
//   2. Continuer avec Google              (un tap)
//   3. mot de passe                       (repli)
//   4. mot de passe oublié                (autonome — n'existait pas)
//
// L'adresse est mémorisée sur l'appareil : au retour, l'écran salue
// directement la personne et propose le code sans rien saisir.
// ============================================================
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { BonziniLogo } from '@/components/BonziniLogo';
import { LoginBackground } from '@/components/auth/LoginBackground';
import { PremiumInput } from '@/components/auth/PremiumInput';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { StepTransition } from '@/components/auth/StepTransition';
import { OtpField } from '@/components/form';
import { TEXT } from '@/mobile/designKit';
import { Loader2, Mail, Lock, Eye, EyeOff, ArrowLeft, Check, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { cn } from '@/lib/utils';

const emailSchema = z.string().email();

/** Pill sombre — l'UNIQUE action principale de l'écran (designKit). */
const CTA =
  'w-full h-12 rounded-full bg-[#1C1B22] text-white dark:bg-[#F2F1F7] dark:text-[#1B1A24] text-[15px] font-bold flex items-center justify-center gap-2 transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed';

/** Secondes avant de pouvoir redemander un code. */
const RESEND_DELAY = 30;

type Step = 'choice' | 'email' | 'code' | 'password' | 'reset-sent';

export function MobileLoginScreen() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const {
    login,
    requestEmailCode,
    verifyEmailCode,
    requestPasswordReset,
    loginWithGoogle,
    lastEmail,
    isLoading: authLoading,
  } = useAdminAuth();

  const [step, setStep] = useState<Step>('choice');
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [email, setEmail] = useState(lastEmail ?? '');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const isEmailValid = emailSchema.safeParse(email).success;

  const maskEmail = (value: string) => {
    const [local, domain] = value.split('@');
    if (!domain) return value;
    return `${local.slice(0, 3)}***@${domain}`;
  };

  const go = (next: Step, dir: 'forward' | 'back' = 'forward') => {
    setDirection(dir);
    setError('');
    setStep(next);
  };

  const enterApp = () => {
    toast.success(t('loginSuccess', { defaultValue: 'Connexion réussie' }));
    setIsFadingOut(true);
    setTimeout(() => navigate('/m'), 300);
  };

  const startCooldown = () => {
    setCooldown(RESEND_DELAY);
    const timer = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) {
          clearInterval(timer);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  // ── Code par email ────────────────────────────────────────────────────────
  const sendCode = async (target: string) => {
    setIsLoading(true);
    const result = await requestEmailCode(target);
    setIsLoading(false);

    if (!result.success) {
      setError(result.error || t('errorOccurred', { defaultValue: 'Une erreur est survenue' }));
      return false;
    }
    startCooldown();
    return true;
  };

  const handleChoiceCode = async () => {
    // Adresse déjà connue sur cet appareil → on saute l'étape de saisie.
    if (lastEmail && emailSchema.safeParse(lastEmail).success) {
      setEmail(lastEmail);
      if (await sendCode(lastEmail)) go('code');
      return;
    }
    go('email');
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    if (!isEmailValid) {
      setEmailError(t('invalidEmail', { defaultValue: 'Veuillez entrer un email valide' }));
      return;
    }
    if (await sendCode(email)) go('code');
  };

  const submitCode = async (value: string) => {
    setError('');
    setIsLoading(true);
    const result = await verifyEmailCode(email, value);
    setIsLoading(false);

    if (result.success) enterApp();
    else setError(result.error || t('invalidCode', { defaultValue: 'Code incorrect ou expiré' }));
  };

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitCode(code);
  };

  // ── Google ────────────────────────────────────────────────────────────────
  const handleGoogle = async () => {
    setGoogleLoading(true);
    const result = await loginWithGoogle();
    // En cas de succès le navigateur part déjà vers Google.
    if (!result.success) {
      setGoogleLoading(false);
      setError(result.error || t('errorOccurred', { defaultValue: 'Une erreur est survenue' }));
    }
  };

  // ── Mot de passe (repli) ──────────────────────────────────────────────────
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    const result = await login(email, password);
    setIsLoading(false);

    if (result.success) enterApp();
    else setError(result.error || t('invalidCredentials', { defaultValue: 'Identifiants incorrects' }));
  };

  const handleForgotPassword = async () => {
    if (!isEmailValid) {
      setError(t('invalidEmail', { defaultValue: 'Veuillez entrer un email valide' }));
      return;
    }
    setIsLoading(true);
    const result = await requestPasswordReset(email);
    setIsLoading(false);

    if (result.success) go('reset-sent');
    else setError(result.error || t('errorOccurred', { defaultValue: 'Une erreur est survenue' }));
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const showBack = step !== 'choice';

  return (
    <LoginBackground className={cn(isFadingOut && 'animate-fade-out')}>
      <div className="flex-1 flex flex-col justify-center px-6 py-12">
        {showBack && (
          <button
            onClick={() => go(step === 'reset-sent' ? 'choice' : step === 'code' ? 'email' : 'choice', 'back')}
            aria-label={t('back', { defaultValue: 'Retour' })}
            className="absolute top-6 left-4 z-20 w-10 h-10 rounded-full bg-card/80 backdrop-blur-sm border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors animate-fade-in"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}

        <div
          className="flex justify-center mb-6 animate-logo-entrance"
          style={{ animationDelay: '0ms', animationFillMode: 'both' }}
        >
          <BonziniLogo size="xl" showText={false} />
        </div>

        <StepTransition stepKey={step} direction={direction}>
          {/* ─── Choix du mode de connexion ─────────────────────────────── */}
          {step === 'choice' && (
            <div className="max-w-sm mx-auto w-full">
              <div
                className="text-center mb-8 animate-slide-up"
                style={{ animationDelay: '80ms', animationFillMode: 'both' }}
              >
                <h1 className="text-2xl font-bold mb-1">Administration</h1>
                <p className="text-muted-foreground text-sm">
                  {lastEmail
                    ? t('welcomeBackAs', { defaultValue: 'Content de vous revoir, {{email}}', email: maskEmail(lastEmail) })
                    : t('chooseSignInMethod', { defaultValue: 'Choisissez comment vous connecter' })}
                </p>
              </div>

              <div
                className="space-y-3 animate-slide-up"
                style={{ animationDelay: '160ms', animationFillMode: 'both' }}
              >
                <button type="button" onClick={handleChoiceCode} disabled={isLoading} className={CTA}>
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Mail className="w-[18px] h-[18px]" />
                      {t('signInWithCode', { defaultValue: 'Recevoir un code par email' })}
                    </>
                  )}
                </button>

                <GoogleButton
                  onClick={handleGoogle}
                  loading={googleLoading}
                  label={t('continueWithGoogle', { defaultValue: 'Continuer avec Google' })}
                />
              </div>

              <button
                type="button"
                onClick={() => go(email ? 'password' : 'email')}
                className="mt-6 w-full text-center text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                {t('signInWithPassword', { defaultValue: 'Utiliser un mot de passe' })}
              </button>

              {error && (
                <p className="mt-4 text-center text-sm text-[#C0504D] dark:text-[#E79A9A]">{error}</p>
              )}
            </div>
          )}

          {/* ─── Saisie de l'adresse email ──────────────────────────────── */}
          {step === 'email' && (
            <form onSubmit={handleEmailSubmit} className="max-w-sm mx-auto w-full">
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold mb-1">
                  {t('yourEmail', { defaultValue: 'Votre adresse email' })}
                </h1>
                <p className="text-muted-foreground text-sm">
                  {t('weSendYouACode', { defaultValue: 'Nous vous envoyons un code à 6 chiffres' })}
                </p>
              </div>

              <div className="mb-6">
                <PremiumInput
                  id="admin-email"
                  type="email"
                  label={t('emailAddress', { defaultValue: 'Adresse email' })}
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

              <button type="submit" disabled={isLoading || !email} className={CTA}>
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  t('sendCode', { defaultValue: 'Envoyer le code' })
                )}
              </button>

              {error && (
                <p className="mt-4 text-center text-sm text-[#C0504D] dark:text-[#E79A9A]">{error}</p>
              )}
            </form>
          )}

          {/* ─── Saisie du code à 6 chiffres ────────────────────────────── */}
          {step === 'code' && (
            <form onSubmit={handleCodeSubmit} className="max-w-sm mx-auto w-full">
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold mb-1">
                  {t('enterCode', { defaultValue: 'Entrez le code' })}
                </h1>
                <p className="text-muted-foreground text-sm">
                  {t('codeSentTo', { defaultValue: 'Code envoyé à' })}{' '}
                  <span className="font-semibold text-foreground">{maskEmail(email)}</span>
                </p>
              </div>

              {/* OtpField : 6 cases, collage/autofill iOS gérés, avance auto.
                  onComplete valide sans qu'il ait à viser le bouton. */}
              <OtpField
                id="admin-otp"
                label={t('sixDigitCode', { defaultValue: 'Code à 6 chiffres' })}
                labelClassName="sr-only"
                value={code}
                onValueChange={(value) => {
                  setCode(value);
                  setError('');
                }}
                onComplete={(value) => void submitCode(value)}
                error={error}
                disabled={isLoading}
              />

              <button type="submit" disabled={isLoading || code.length < 6} className={cn(CTA, 'mt-4')}>
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  t('signIn', { defaultValue: 'Se connecter' })
                )}
              </button>

              <p className={cn('mt-6 text-center text-[13px]', TEXT.muted)}>
                {t('noCodeReceived', { defaultValue: "Vous n'avez pas reçu le code ?" })}{' '}
                <button
                  type="button"
                  onClick={() => sendCode(email)}
                  disabled={cooldown > 0 || isLoading}
                  className="font-semibold text-[#5B4CC4] hover:underline disabled:opacity-50 disabled:no-underline dark:text-[#B5AAF0]"
                >
                  {cooldown > 0
                    ? t('resendIn', { defaultValue: 'Renvoyer dans {{count}} s', count: cooldown })
                    : t('resend', { defaultValue: 'Renvoyer' })}
                </button>
              </p>
            </form>
          )}

          {/* ─── Mot de passe (repli) ───────────────────────────────────── */}
          {step === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="max-w-sm mx-auto w-full">
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold mb-1">{t('hello', { defaultValue: 'Bonjour,' })}</h1>
                <p className="text-muted-foreground text-sm">{maskEmail(email)}</p>
              </div>

              <div className="mb-4">
                <PremiumInput
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  label={t('password', { defaultValue: 'Mot de passe' })}
                  value={password}
                  onChange={(val) => {
                    setPassword(val);
                    setError('');
                  }}
                  icon={<Lock className="w-5 h-5" />}
                  rightElement={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={t('togglePassword', { defaultValue: 'Afficher le mot de passe' })}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  }
                  error={error}
                  autoComplete="current-password"
                  autoFocus
                />
              </div>

              {/* Récupération autonome — absente de l'ancien écran. */}
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={isLoading}
                className="mb-6 w-full text-right text-[13px] font-semibold text-[#5B4CC4] hover:underline disabled:opacity-50 dark:text-[#B5AAF0]"
              >
                {t('forgotPassword', { defaultValue: 'Mot de passe oublié ?' })}
              </button>

              <button type="submit" disabled={isLoading || !password} className={CTA}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t('connecting', { defaultValue: 'Connexion...' })}
                  </>
                ) : (
                  t('signIn', { defaultValue: 'Se connecter' })
                )}
              </button>

              <button
                type="button"
                onClick={() => go('choice', 'back')}
                className="mt-6 w-full text-center text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                <KeyRound className="mr-1.5 inline h-[14px] w-[14px] align-[-2px]" />
                {t('signInWithCodeInstead', { defaultValue: 'Recevoir plutôt un code par email' })}
              </button>
            </form>
          )}

          {/* ─── Lien de réinitialisation envoyé ────────────────────────── */}
          {step === 'reset-sent' && (
            <div className="max-w-sm mx-auto w-full text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#DEEFE5] text-[#2E7D52] dark:bg-[#1E3A2C] dark:text-[#7FCBA0]">
                <Check className="h-7 w-7" strokeWidth={2.5} />
              </div>
              <h1 className="text-2xl font-bold mb-2">
                {t('resetLinkSent', { defaultValue: 'Lien envoyé' })}
              </h1>
              <p className={cn('text-sm', TEXT.muted)}>
                {t('resetLinkSentBody', {
                  defaultValue: 'Ouvrez le message envoyé à {{email}} pour choisir un nouveau mot de passe.',
                  email: maskEmail(email),
                })}
              </p>
              <button type="button" onClick={() => go('choice', 'back')} className={cn(CTA, 'mt-8')}>
                {t('backToSignIn', { defaultValue: 'Revenir à la connexion' })}
              </button>
            </div>
          )}
        </StepTransition>
      </div>

      <div className="p-6 text-center text-sm text-muted-foreground">
        <p>Bonzini Labs &copy; {new Date().getFullYear()}</p>
      </div>
    </LoginBackground>
  );
}
