// ============================================================
// Écran de connexion ADMIN.
//
// PARCOURS — l'email D'ABORD, les moyens ensuite :
//   1. « Votre adresse email »   → on sait qui se présente, et on peut la changer
//   2. « Comment vous connecter » → code email · cet appareil · Google
//   3. « Entrez le code »        → 6 chiffres
//
// La version précédente affichait les moyens en premier et se contentait de
// saluer l'adresse mémorisée : impossible d'en changer sans vider le
// navigateur. C'était le principal reproche en test.
//
// PLUS DE MOT DE PASSE ICI — retiré à la demande. Le repli d'urgence existe
// toujours ailleurs : /a/login (agent-cash) accepte email + mot de passe et
// ouvre la même session admin.
//
// LISIBILITÉ AVANT TOUT : une décision par écran, des options en grandes
// lignes tapables avec un titre et une phrase d'explication. L'utilisateur
// principal n'est pas un familier des interfaces.
// ============================================================
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { BonziniLogo } from '@/components/BonziniLogo';
import { LoginBackground } from '@/components/auth/LoginBackground';
import { PremiumInput } from '@/components/auth/PremiumInput';
import { StepTransition } from '@/components/auth/StepTransition';
import { OtpField } from '@/components/form';
import { isPasskeySupported, hasPasskeyOnThisDevice } from '@/lib/passkey';
import { TEXT } from '@/mobile/designKit';
import { Loader2, Mail, ArrowLeft, Fingerprint, ChevronRight, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { cn } from '@/lib/utils';

const emailSchema = z.string().email();

/** Pill sombre — l'unique action principale d'un écran (designKit). */
const CTA =
  'w-full h-13 min-h-[52px] rounded-full bg-[#1C1B22] text-white dark:bg-[#F2F1F7] dark:text-[#1B1A24] text-[15.5px] font-bold flex items-center justify-center gap-2 transition active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed';

/** Secondes avant de pouvoir redemander un code. */
const RESEND_DELAY = 30;

/**
 * Nombre de chiffres du code reçu par email.
 *
 * DOIT correspondre au réglage Supabase « Email OTP Length »
 * (Authentication → Providers → Email). Les deux vont ensemble : afficher
 * 6 cases alors que Supabase émet 8 chiffres rend la connexion impossible.
 */
const EMAIL_OTP_LENGTH = 6;

type Step = 'email' | 'methods' | 'code';

/** Grande ligne tapable : icône, titre, explication. Lisible sans effort. */
function MethodRow({
  icon,
  title,
  hint,
  onClick,
  loading,
  disabled,
  primary,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'w-full flex items-center gap-3.5 rounded-2xl px-4 py-4 text-left transition active:scale-[0.99] disabled:opacity-50',
        primary
          ? 'bg-[#1C1B22] text-white dark:bg-[#F2F1F7] dark:text-[#1B1A24]'
          : 'bg-white text-[#1B1A24] ring-1 ring-black/[0.08] dark:bg-[#211F2B] dark:text-[#F2F1F7]',
      )}
    >
      <span
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
          primary
            ? 'bg-white/15 text-white dark:bg-black/10 dark:text-[#1B1A24]'
            : 'bg-[#EDEAFA] text-[#5B4CC4] dark:bg-[#2F2C3D] dark:text-[#B5AAF0]',
        )}
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : icon}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[15.5px] font-bold leading-tight">{title}</span>
        <span
          className={cn(
            'mt-0.5 block text-[12.5px] leading-snug',
            primary ? 'text-white/65 dark:text-[#1B1A24]/60' : 'text-[#8E8BA0]',
          )}
        >
          {hint}
        </span>
      </span>

      <ChevronRight className={cn('h-[18px] w-[18px] shrink-0', primary ? 'opacity-50' : 'text-[#B9B5CC]')} />
    </button>
  );
}

/** Logo « G » officiel Google (mêmes couleurs que le bouton du parcours client). */
function GoogleG({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

export function MobileLoginScreen() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const {
    requestEmailCode,
    verifyEmailCode,
    loginWithPasskey,
    loginWithGoogle,
    lastEmail,
    isLoading: authLoading,
  } = useAdminAuth();

  const [step, setStep] = useState<Step>('email');
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  // Pré-remplie si on connaît déjà l'adresse, mais TOUJOURS modifiable.
  const [email, setEmail] = useState(lastEmail ?? '');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Proposée dès que l'appareil sait gérer une clé d'accès — y compris une clé
  // synchronisée depuis un autre téléphone, que le marqueur local ignore.
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyEnrolledHere] = useState(() => hasPasskeyOnThisDevice());

  useEffect(() => {
    void isPasskeySupported().then(setPasskeySupported);
  }, []);

  const isEmailValid = emailSchema.safeParse(email).success;

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

  // ── Étape 1 : l'adresse ───────────────────────────────────────────────────
  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    if (!isEmailValid) {
      setEmailError(t('invalidEmail', { defaultValue: 'Veuillez entrer un email valide' }));
      return;
    }
    go('methods');
  };

  // ── Étape 2 : les moyens ──────────────────────────────────────────────────
  const sendCode = async () => {
    setIsLoading(true);
    const result = await requestEmailCode(email);
    setIsLoading(false);

    if (!result.success) {
      setError(result.error || t('errorOccurred', { defaultValue: 'Une erreur est survenue' }));
      return;
    }
    startCooldown();
    go('code');
  };

  const handlePasskey = async () => {
    setError('');
    setPasskeyLoading(true);
    const result = await loginWithPasskey();
    setPasskeyLoading(false);

    if (result.success) enterApp();
    // Pas de message = feuille système fermée volontairement : on n'affiche rien.
    else if (result.error) setError(result.error);
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const result = await loginWithGoogle();
    // En cas de succès le navigateur part déjà vers Google.
    if (!result.success) {
      setGoogleLoading(false);
      setError(result.error || t('errorOccurred', { defaultValue: 'Une erreur est survenue' }));
    }
  };

  // ── Étape 3 : le code ─────────────────────────────────────────────────────
  const submitCode = async (value: string) => {
    setError('');
    setIsLoading(true);
    const result = await verifyEmailCode(email, value);
    setIsLoading(false);

    if (result.success) enterApp();
    else setError(result.error || t('invalidCode', { defaultValue: 'Code incorrect ou expiré' }));
  };

  const resend = async () => {
    setError('');
    setIsLoading(true);
    const result = await requestEmailCode(email);
    setIsLoading(false);
    if (result.success) startCooldown();
    else setError(result.error || t('errorOccurred', { defaultValue: 'Une erreur est survenue' }));
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const back = () => go(step === 'code' ? 'methods' : 'email', 'back');

  return (
    <LoginBackground className={cn(isFadingOut && 'animate-fade-out')}>
      <div className="flex-1 flex flex-col justify-center px-6 py-12">
        {step !== 'email' && (
          <button
            onClick={back}
            aria-label={t('back', { defaultValue: 'Retour' })}
            className="absolute top-6 left-4 z-20 w-11 h-11 rounded-full bg-card/80 backdrop-blur-sm border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors animate-fade-in"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}

        <div
          className="flex justify-center mb-7 animate-logo-entrance"
          style={{ animationDelay: '0ms', animationFillMode: 'both' }}
        >
          <BonziniLogo size="xl" showText={false} />
        </div>

        <StepTransition stepKey={step} direction={direction}>
          {/* ─── 1. L'adresse ────────────────────────────────────────────── */}
          {step === 'email' && (
            <form onSubmit={handleEmailSubmit} className="max-w-sm mx-auto w-full">
              <div
                className="text-center mb-8 animate-slide-up"
                style={{ animationDelay: '80ms', animationFillMode: 'both' }}
              >
                <h1 className="text-[26px] font-extrabold tracking-tight mb-1.5">Administration</h1>
                <p className="text-muted-foreground text-[14.5px] leading-snug">
                  {t('enterEmailToContinue', { defaultValue: 'Entrez votre adresse email pour continuer' })}
                </p>
              </div>

              <div
                className="mb-7 animate-slide-up"
                style={{ animationDelay: '160ms', animationFillMode: 'both' }}
              >
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

              <button
                type="submit"
                disabled={!email}
                className={cn(CTA, 'animate-slide-up')}
                style={{ animationDelay: '240ms', animationFillMode: 'both' }}
              >
                {t('continue', { defaultValue: 'Continuer' })}
              </button>
            </form>
          )}

          {/* ─── 2. Les moyens de connexion ──────────────────────────────── */}
          {step === 'methods' && (
            <div className="max-w-sm mx-auto w-full">
              <div className="text-center mb-7">
                {/* 23px et non 26 : « Comment vous connecter » tient alors sur
                    une ligne jusque sur les petits téléphones. */}
                <h1 className="text-[23px] font-extrabold tracking-tight mb-1.5">
                  {t('howToSignIn', { defaultValue: 'Comment vous connecter' })}
                </h1>
                {/* L'adresse reste visible ET modifiable — c'est ce qui manquait. */}
                <button
                  type="button"
                  onClick={() => go('email', 'back')}
                  className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  {email}
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="space-y-3">
                <MethodRow
                  primary
                  icon={<Mail className="h-5 w-5" />}
                  title={t('signInWithCode', { defaultValue: 'Recevoir un code par email' })}
                  hint={t('signInWithCodeHint', {
                    defaultValue: 'Un code à {{count}} chiffres, tout de suite',
                    count: EMAIL_OTP_LENGTH,
                  })}
                  onClick={sendCode}
                  loading={isLoading}
                />

                {passkeySupported && (
                  <MethodRow
                    icon={<Fingerprint className="h-5 w-5" />}
                    title={t('signInWithPasskey', { defaultValue: 'Utiliser cet appareil' })}
                    hint={
                      passkeyEnrolledHere
                        ? t('signInWithPasskeyHintReady', { defaultValue: 'Face ID ou empreinte — rien à taper' })
                        : t('signInWithPasskeyHintNew', { defaultValue: 'Si vous avez déjà activé cet appareil' })
                    }
                    onClick={handlePasskey}
                    loading={passkeyLoading}
                  />
                )}

                <MethodRow
                  icon={<GoogleG className="h-5 w-5" />}
                  title={t('continueWithGoogle', { defaultValue: 'Continuer avec Google' })}
                  hint={t('continueWithGoogleHint', { defaultValue: 'Avec votre compte Google habituel' })}
                  onClick={handleGoogle}
                  loading={googleLoading}
                />
              </div>

              {error && (
                <p className="mt-5 text-center text-[13.5px] leading-snug text-[#C0504D] dark:text-[#E79A9A]">
                  {error}
                </p>
              )}
            </div>
          )}

          {/* ─── 3. Le code ──────────────────────────────────────────────── */}
          {step === 'code' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submitCode(code);
              }}
              className="max-w-sm mx-auto w-full"
            >
              <div className="text-center mb-7">
                <h1 className="text-[26px] font-extrabold tracking-tight mb-1.5">
                  {t('enterCode', { defaultValue: 'Entrez le code' })}
                </h1>
                <p className="text-muted-foreground text-[14.5px] leading-snug">
                  {t('codeSentTo', { defaultValue: 'Code envoyé à' })}{' '}
                  <span className="font-semibold text-foreground">{email}</span>
                </p>
              </div>

              {/* Avance automatique, collage et autofill iOS gérés ; la dernière
                  case valide sans qu'il ait à viser le bouton. */}
              <OtpField
                id="admin-otp"
                length={EMAIL_OTP_LENGTH}
                label={t('otpCodeLabel', { defaultValue: 'Code à {{count}} chiffres', count: EMAIL_OTP_LENGTH })}
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

              <button
                type="submit"
                disabled={isLoading || code.length < EMAIL_OTP_LENGTH}
                className={cn(CTA, 'mt-5')}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  t('signIn', { defaultValue: 'Se connecter' })
                )}
              </button>

              <p className={cn('mt-6 text-center text-[13.5px]', TEXT.muted)}>
                {t('noCodeReceived', { defaultValue: "Vous n'avez pas reçu le code ?" })}{' '}
                <button
                  type="button"
                  onClick={resend}
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
        </StepTransition>
      </div>

      <div className="p-6 text-center text-sm text-muted-foreground">
        <p>Bonzini Labs &copy; {new Date().getFullYear()}</p>
      </div>
    </LoginBackground>
  );
}
