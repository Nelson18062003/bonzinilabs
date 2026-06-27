import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { isProviderEmailVerified, isProfileComplete } from '@/lib/authGate';
import { BonziniLogo } from '@/components/BonziniLogo';
import { Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, PRIMARY_PILL } from '@/mobile/designKit';

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
  const { t } = useTranslation('auth');
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
    const key =
      error === 'email_unverified' ? 'emailUnverified'
      : error === 'email_taken' ? 'emailTaken'
      : error === 'timeout' ? 'timeout'
      : 'generic';
    return (
      <div className={cn('flex min-h-screen flex-col items-center justify-center p-6 text-center', SURFACE.canvas)}>
        <BonziniLogo className="mb-8 h-9" />
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#FBE7E7] dark:bg-[#3A2526]">
          <AlertCircle className="h-7 w-7 text-[#C0504D] dark:text-[#E79A9A]" />
        </div>
        <h1 className={cn('mb-2 text-[18px] font-black', TEXT.strong)}>{t(`callback.${key}.title`)}</h1>
        <p className={cn('mb-6 max-w-sm text-[13px]', TEXT.muted)}>{t(`callback.${key}.body`)}</p>
        <button
          onClick={() => navigate('/auth', { replace: true })}
          className={cn('flex h-12 items-center justify-center px-6 text-[15px] font-bold transition active:scale-[0.99]', PRIMARY_PILL)}
        >
          {t('callback.back')}
        </button>
      </div>
    );
  }

  return (
    <div className={cn('flex min-h-screen flex-col items-center justify-center p-6', SURFACE.canvas)}>
      <BonziniLogo className="mb-8 h-9" />
      <Loader2 className="h-8 w-8 animate-spin text-[#8B5CF6]" />
      <p className={cn('mt-4 text-[13px]', TEXT.muted)}>{t('callback.connecting')}</p>
    </div>
  );
}
