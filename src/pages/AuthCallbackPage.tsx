import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { isProviderEmailVerified, isProfileComplete } from '@/lib/authGate';
import { BonziniLogo } from '@/components/BonziniLogo';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Route de retour OAuth (/auth/callback). Le client `supabase` (PKCE,
 * detectSessionInUrl) échange automatiquement le ?code= en session. On
 * observe l'établissement de la session, on traite les cas d'erreur, puis
 * on route :
 *   - email non vérifié (cas D)        → blocage + signOut
 *   - collision email (cas B)          → message « connectez-vous par mot de passe »
 *   - profil incomplet (phone/country) → /onboarding
 *   - profil complet                   → /wallet
 *
 * ⚠️ Cette page ne monte QUE le client `supabase`, jamais `supabaseAdmin`
 * (évite la course sur le ?code= — cf. design-social-login.md §2).
 */
export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  useEffect(() => {
    // Erreur renvoyée directement par Supabase/Google dans l'URL.
    const urlError = searchParams.get('error_description') || searchParams.get('error');

    // Email vérifié = lecture autoritaire depuis identities[] (cf. @/lib/authGate,
    // finding H2). Fail-closed.
    const routeAfterSession = async (userId: string, verified: boolean) => {
      // Cas D — email non vérifié : on bloque (fintech : pas de KYC sur email non sûr).
      if (!verified) {
        await supabase.auth.signOut();
        setError('email_unverified');
        return;
      }

      // Profil : le téléphone est le champ métier bloquant (cf. @/lib/authGate).
      const { data: client } = await supabase
        .from('clients')
        .select('phone')
        .eq('user_id', userId)
        .maybeSingle();

      navigate(isProfileComplete(client) ? '/wallet' : '/onboarding', { replace: true });
    };

    const run = async () => {
      if (handled.current) return;
      handled.current = true;

      if (urlError) {
        // Cas B fréquent : email déjà rattaché à un autre compte.
        setError(/already|exists|registered/i.test(urlError) ? 'email_taken' : 'generic');
        return;
      }

      // La session peut déjà être là (échange instantané) ou arriver via l'event.
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const u = session.user;
        await routeAfterSession(u.id, isProviderEmailVerified(u));
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user && !handled.current) {
        handled.current = true;
        const u = session.user;
        void routeAfterSession(u.id, isProviderEmailVerified(u));
      }
    });

    void run();

    // Garde-fou : si rien n'aboutit en 8 s, on renvoie sur /auth.
    const timeout = setTimeout(() => {
      if (!handled.current || (!error)) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!session) setError('timeout');
        });
      }
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    const messages: Record<string, { title: string; body: string }> = {
      email_unverified: {
        title: 'Email non vérifié',
        body: "Votre compte Google n'a pas d'email vérifié. Utilisez un email vérifié ou créez un compte par mot de passe.",
      },
      email_taken: {
        title: 'Compte déjà existant',
        body: 'Un compte existe déjà avec cet email. Connectez-vous par mot de passe, puis liez Google depuis votre profil.',
      },
      timeout: {
        title: 'Connexion impossible',
        body: 'La connexion a expiré. Veuillez réessayer.',
      },
      generic: {
        title: 'Connexion impossible',
        body: 'Une erreur est survenue pendant la connexion. Veuillez réessayer.',
      },
    };
    const m = messages[error] ?? messages.generic;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
        <BonziniLogo className="h-9 mb-8" />
        <AlertCircle className="h-10 w-10 text-destructive mb-4" />
        <h1 className="text-lg font-semibold mb-2">{m.title}</h1>
        <p className="text-sm text-muted-foreground max-w-sm mb-6">{m.body}</p>
        <Button onClick={() => navigate('/auth', { replace: true })}>Retour à la connexion</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <BonziniLogo className="h-9 mb-8" />
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground mt-4">Connexion en cours…</p>
    </div>
  );
}
