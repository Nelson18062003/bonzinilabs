import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { BonziniLogo } from '@/components/BonziniLogo';
import { LoginBackground } from '@/components/auth/LoginBackground';
import { PremiumInput } from '@/components/auth/PremiumInput';
import { ProgressDots } from '@/components/auth/ProgressDots';
import { StepTransition } from '@/components/auth/StepTransition';
import { Loader2, Mail, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { cn } from '@/lib/utils';

const emailSchema = z.string().email();

export function MobileLoginScreen() {
  const navigate = useNavigate();
  const { login, isLoading: authLoading } = useAdminAuth();

  const [step, setStep] = useState<0 | 1>(0);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isFadingOut, setIsFadingOut] = useState(false);

  const isEmailValid = emailSchema.safeParse(email).success;

  const maskEmail = (email: string) => {
    const [local, domain] = email.split('@');
    if (!domain) return email;
    const visible = local.slice(0, 3);
    return `${visible}***@${domain}`;
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    if (!isEmailValid) {
      setEmailError('Veuillez entrer un email valide');
      return;
    }
    setDirection('forward');
    setStep(1);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await login(email, password);
      if (result.success) {
        toast.success('Connexion réussie');
        setIsFadingOut(true);
        setTimeout(() => navigate('/m'), 300);
      } else {
        setError(result.error || 'Identifiants incorrects');
      }
    } catch {
      setError('Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  const goBack = () => {
    setDirection('back');
    setStep(0);
    setError('');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <LoginBackground className={cn(isFadingOut && 'animate-fade-out')}>
      <div className="flex-1 flex flex-col justify-center px-6 py-12">
        {/* Back button (only on password step) */}
        {step === 1 && (
          <button
            onClick={goBack}
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
          <BonziniLogo size="xl" showText={false} />
        </div>

        {/* Step content */}
        <StepTransition stepKey={step} direction={direction}>
          {step === 0 ? (
            <form onSubmit={handleEmailSubmit} className="max-w-sm mx-auto w-full">
              {/* Title */}
              <div
                className="text-center mb-8 animate-slide-up"
                style={{ animationDelay: '80ms', animationFillMode: 'both' }}
              >
                <h1 className="text-2xl font-bold mb-1">Administration</h1>
                <p className="text-muted-foreground text-sm">
                  Entrez votre adresse email pour continuer
                </p>
              </div>

              {/* Email input */}
              <div
                className="mb-6 animate-slide-up"
                style={{ animationDelay: '160ms', animationFillMode: 'both' }}
              >
                <PremiumInput
                  id="admin-email"
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
                    if (e.key === 'Enter') handleEmailSubmit(e);
                  }}
                />
              </div>

              {/* Progress dots */}
              <ProgressDots totalSteps={2} currentStep={0} className="mb-6" />

              {/* Continue button */}
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
            <form onSubmit={handlePasswordSubmit} className="max-w-sm mx-auto w-full">
              {/* Greeting */}
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold mb-1">Bonjour,</h1>
                <p className="text-muted-foreground text-sm">
                  {maskEmail(email)}
                </p>
              </div>

              {/* Password input */}
              <div className="mb-4">
                <PremiumInput
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  label="Mot de passe"
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
                  error={error}
                  autoComplete="current-password"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handlePasswordSubmit(e);
                  }}
                />
              </div>

              {/* Progress dots */}
              <ProgressDots totalSteps={2} currentStep={1} className="mb-6" />

              {/* Submit button */}
              <button
                type="submit"
                disabled={isLoading || !password}
                className="w-full btn-primary-gradient h-12 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
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
      <div className="p-6 text-center text-sm text-muted-foreground">
        <p>Bonzini Labs &copy; {new Date().getFullYear()}</p>
      </div>
    </LoginBackground>
  );
}
