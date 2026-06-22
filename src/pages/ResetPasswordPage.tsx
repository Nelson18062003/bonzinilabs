import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

import { LoginBackground } from "@/components/auth/LoginBackground";
import { PremiumInput } from "@/components/auth/PremiumInput";
import { BonziniLogo } from "@/components/BonziniLogo";
import { Loader2, AlertCircle, ArrowLeft, Lock, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { SURFACE, TEXT, PRIMARY_PILL } from "@/mobile/designKit";

const passwordSchema = z.string().min(6);

function setMeta(name: string, content: string) {
  let tag = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("name", name);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function setCanonical(href: string) {
  let link = document.querySelector("link[rel=\"canonical\"]") as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", href);
}

// Bandeau d'erreur designKit (danger #C0504D).
function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-2xl bg-[#FBE7E7] p-3.5 text-[13px] text-[#C0504D] dark:bg-[#3A2526] dark:text-[#E79A9A]">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { t } = useTranslation('auth');
  const { updatePassword } = useAuth();

  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canonicalUrl = useMemo(() => `${window.location.origin}/auth/reset-password`, []);

  useEffect(() => {
    document.title = "Réinitialiser le mot de passe | Bonzini";
    setMeta("description", "Réinitialiser votre mot de passe Bonzini pour accéder à votre compte.");
    setCanonical(canonicalUrl);
  }, [canonicalUrl]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!hasSession) {
      setError(t('resetPassword.linkExpired'));
      return;
    }

    const pw = passwordSchema.safeParse(password);
    if (!pw.success) {
      setError(t('validation.passwordMin'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('validation.passwordMismatch'));
      return;
    }

    setIsSubmitting(true);
    const { error: updateError } = await updatePassword(password);
    setIsSubmitting(false);

    if (updateError) {
      setError(updateError.message || t('validation.loginError'));
      return;
    }

    toast.success(t('toast.passwordUpdated'));
    navigate("/wallet", { replace: true });
  };

  if (hasSession === null) {
    return (
      <div className={cn('flex min-h-screen items-center justify-center', SURFACE.canvas)}>
        <Loader2 className="h-8 w-8 animate-spin text-[#8B5CF6]" />
      </div>
    );
  }

  return (
    <LoginBackground>
      <div className="flex flex-1 flex-col justify-center px-6 pb-12 pt-6">
        <div className="mb-6 flex justify-center">
          <BonziniLogo size="lg" showText={false} />
        </div>
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 text-center">
            <h1 className={cn('mb-1 text-[24px] font-black', TEXT.strong)}>{t('resetPassword.title')}</h1>
            <p className={cn('text-[13px]', TEXT.muted)}>
              {hasSession ? t('resetPassword.subtitle') : t('resetPassword.linkExpired')}
            </p>
          </div>

          {!hasSession ? (
            <div className="space-y-4">
              <ErrorBox message={t('resetPassword.linkExpired')} />
              <button
                onClick={() => navigate("/auth", { replace: true })}
                className={cn('flex h-12 w-full items-center justify-center text-[15px] font-bold transition active:scale-[0.99]', PRIMARY_PILL)}
              >
                {t('forgotPassword.signIn')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <ErrorBox message={error} />}

              <PremiumInput
                id="reset-password"
                type={showPassword ? 'text' : 'password'}
                label={t('resetPassword.newPassword')}
                value={password}
                onChange={(v) => { setPassword(v); setError(null); }}
                icon={<Lock className="w-5 h-5" />}
                rightElement={
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-muted-foreground transition-colors hover:text-foreground" tabIndex={-1}>
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                }
                autoComplete="new-password"
                disabled={isSubmitting}
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
                disabled={isSubmitting}
              />

              <button
                type="submit"
                disabled={isSubmitting}
                className={cn('flex h-12 w-full items-center justify-center gap-2 text-[15px] font-bold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50', PRIMARY_PILL)}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    {t('resetPassword.reset')}…
                  </>
                ) : (
                  t('resetPassword.reset')
                )}
              </button>

              <button
                type="button"
                onClick={() => navigate("/auth", { replace: true })}
                disabled={isSubmitting}
                className={cn('flex w-full items-center justify-center gap-2 text-[13px] font-semibold transition-colors', TEXT.muted, 'hover:text-[#5B4CC4] dark:hover:text-[#B5AAF0]')}
              >
                <ArrowLeft className="h-4 w-4" />
                {t('common:back')}
              </button>
            </form>
          )}
        </div>
      </div>
    </LoginBackground>
  );
}
