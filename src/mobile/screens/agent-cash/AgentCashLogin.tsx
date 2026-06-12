// ============================================================
// AGENT-CASH — AgentCashLogin (2 étapes : email → mot de passe)
// Présentation migrée sur le design kit (Ofspace/Mola) :
//   inputs en FormField + TextInput (icône leading) · boutons PrimaryPill.
//   Le fond LoginBackground + BonziniLogo + ProgressDots + StepTransition
//   sont conservés (la consigne autorise à garder le fond).
// Logique 100% préservée : 2 étapes, EN/ZH (LanguageContext), validation
// email (zod), login (useAdminAuth), fade-out + navigate('/a').
// ============================================================
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { BonziniLogo } from '@/components/BonziniLogo';
import { LoginBackground } from '@/components/auth/LoginBackground';
import { ProgressDots } from '@/components/auth/ProgressDots';
import { StepTransition } from '@/components/auth/StepTransition';
import { Loader2, Mail, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { FormField, TextInput, PrimaryPill, TEXT } from '@/mobile/designKit';

const emailSchema = z.string().email();

export function AgentCashLogin() {
  const navigate = useNavigate();
  const { login, isLoading: authLoading } = useAdminAuth();
  const { t, language, setLanguage } = useLanguage();

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

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'zh' : 'en');
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    if (!isEmailValid) {
      setEmailError(language === 'en' ? 'Please enter a valid email' : '请输入有效的邮箱地址');
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
        toast.success(language === 'en' ? 'Login successful' : '登录成功');
        setIsFadingOut(true);
        setTimeout(() => navigate('/a'), 300);
      } else {
        setError(result.error || t('invalid_credentials'));
      }
    } catch {
      setError(t('error'));
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
      {/* Language toggle - top right */}
      <button
        onClick={toggleLanguage}
        className="absolute top-6 right-4 z-20 px-3 py-1.5 rounded-full bg-card/80 backdrop-blur-sm border border-border/50 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors animate-fade-in"
      >
        {language === 'en' ? '中文' : 'EN'}
      </button>

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
              <div
                className="text-center mb-8 animate-slide-up"
                style={{ animationDelay: '80ms', animationFillMode: 'both' }}
              >
                <h1 className={cn('text-2xl font-bold mb-1', TEXT.strong)}>{t('agent_login')}</h1>
                <p className={cn('text-sm', TEXT.muted)}>{t('email_address')}</p>
              </div>

              <div
                className="mb-6 animate-slide-up"
                style={{ animationDelay: '160ms', animationFillMode: 'both' }}
              >
                <FormField label={t('email_address')} htmlFor="agent-email" error={emailError}>
                  <div className="relative">
                    <Mail className={cn('pointer-events-none absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2', TEXT.muted)} />
                    <TextInput
                      id="agent-email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setEmailError('');
                      }}
                      placeholder={t('email_address')}
                      className="pl-12"
                      autoComplete="email"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleEmailSubmit(e);
                      }}
                    />
                  </div>
                </FormField>
              </div>

              <ProgressDots totalSteps={2} currentStep={0} className="mb-6" />

              <div
                className="animate-slide-up"
                style={{ animationDelay: '240ms', animationFillMode: 'both' }}
              >
                <PrimaryPill type="submit" disabled={!email} className="w-full">
                  {language === 'en' ? 'Continue' : '继续'}
                </PrimaryPill>
              </div>
            </form>
          ) : (
            <form onSubmit={handlePasswordSubmit} className="max-w-sm mx-auto w-full">
              <div className="text-center mb-8">
                <h1 className={cn('text-2xl font-bold mb-1', TEXT.strong)}>
                  {language === 'en' ? 'Hello,' : '你好，'}
                </h1>
                <p className={cn('text-sm', TEXT.muted)}>{maskEmail(email)}</p>
              </div>

              <div className="mb-4">
                <FormField label={t('password')} htmlFor="agent-password" error={error}>
                  <div className="relative">
                    <Lock className={cn('pointer-events-none absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2', TEXT.muted)} />
                    <TextInput
                      id="agent-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError('');
                      }}
                      placeholder={t('password')}
                      className="pl-12 pr-12"
                      autoComplete="current-password"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handlePasswordSubmit(e);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={cn('absolute right-4 top-1/2 z-10 -translate-y-1/2 transition-colors hover:text-foreground', TEXT.muted)}
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </FormField>
              </div>

              <ProgressDots totalSteps={2} currentStep={1} className="mb-6" />

              <PrimaryPill type="submit" disabled={!password} loading={isLoading} className="w-full">
                {t('sign_in')}
              </PrimaryPill>
            </form>
          )}
        </StepTransition>
      </div>

      {/* Footer */}
      <div className={cn('p-6 text-center text-sm', TEXT.muted)}>
        <p>Bonzini Labs &copy; {new Date().getFullYear()}</p>
      </div>
    </LoginBackground>
  );
}
