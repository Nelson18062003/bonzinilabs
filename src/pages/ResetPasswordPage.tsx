import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, Loader2, AlertCircle, ArrowLeft } from "lucide-react";

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
      setError(t('resetPassword.linkExpired', { defaultValue: 'Lien de réinitialisation invalide ou expiré.' }));
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
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <CardTitle>{t('resetPassword.title')}</CardTitle>
            <CardDescription>
              {hasSession
                ? t('resetPassword.subtitle')
                : t('resetPassword.linkExpired', { defaultValue: 'Votre lien de réinitialisation n\'est plus valide.' })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!hasSession ? (
              <div className="space-y-4">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {t('resetPassword.linkExpired', { defaultValue: 'Lien invalide ou expiré. Veuillez refaire « Mot de passe oublié ».' })}
                  </AlertDescription>
                </Alert>
                <Button className="w-full" onClick={() => navigate("/auth", { replace: true })}>
                  {t('forgotPassword.signIn')}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="password">{t('resetPassword.newPassword')}</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      disabled={isSubmitting}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword((v) => !v)}
                      disabled={isSubmitting}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{t('resetPassword.confirmPassword')}</Label>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    disabled={isSubmitting}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('resetPassword.reset')}...
                    </span>
                  ) : (
                    t('resetPassword.reset')
                  )}
                </Button>

                <button
                  type="button"
                  onClick={() => navigate("/auth", { replace: true })}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full justify-center"
                  disabled={isSubmitting}
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t('common:back')}
                </button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
