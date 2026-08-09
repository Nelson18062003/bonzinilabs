// ============================================================
// Retour d'authentification de l'app ADMIN — /m/auth/callback.
//
// Deux usages, même mécanique (échanger un ?code= contre une session) :
//   · retour Google ;
//   · retour du lien « mot de passe oublié » — qui arrive ici avec
//     ?next=/m/more/password, pour enchaîner sur le choix du mot de passe.
//
// Route montée UNIQUEMENT dans l'app admin. Le client `supabase` (app client)
// n'y est jamais monté : aucune course possible sur le ?code= entre les deux
// GoTrueClient (cf. design-social-login.md §2).
//
// `supabaseAdmin` a detectSessionInUrl:false — l'échange est donc explicite.
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { LoginBackground } from '@/components/auth/LoginBackground';
import { BonziniLogo } from '@/components/BonziniLogo';
import { TEXT } from '@/mobile/designKit';
import { safeNextPath } from '@/lib/safeRedirect';
import { Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AdminAuthCallback() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { completeGoogleLogin } = useAdminAuth();
  const [error, setError] = useState('');
  // React 18 monte deux fois en dev : le ?code= n'est utilisable qu'une seule
  // fois, donc on garde l'échange strictement unique.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      const result = await completeGoogleLogin(window.location.href);
      if (result.success) {
        // `next` n'est accepté qu'en chemin interne : une URL absolue ferait de
        // cette route une redirection ouverte (cf. safeNextPath).
        navigate(safeNextPath(searchParams.get('next')), { replace: true });
      } else {
        setError(result.error || t('errorOccurred', { defaultValue: 'Une erreur est survenue' }));
      }
    })();
  }, [completeGoogleLogin, navigate, searchParams, t]);

  return (
    <LoginBackground>
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <BonziniLogo size="lg" showText={false} />

        {error ? (
          <div className="mt-8 max-w-sm text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#FBE7E7] text-[#C0504D] dark:bg-[#3A2526] dark:text-[#E79A9A]">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h1 className={cn('mb-2 text-xl font-bold', TEXT.strong)}>
              {t('signInFailed', { defaultValue: 'Connexion impossible' })}
            </h1>
            <p className={cn('text-sm', TEXT.muted)}>{error}</p>
            <button
              type="button"
              onClick={() => navigate('/m/login', { replace: true })}
              className="mt-8 h-12 w-full rounded-full bg-[#1C1B22] text-[15px] font-bold text-white transition active:scale-[0.99] dark:bg-[#F2F1F7] dark:text-[#1B1A24]"
            >
              {t('backToSignIn', { defaultValue: 'Revenir à la connexion' })}
            </button>
          </div>
        ) : (
          <div className="mt-8 flex flex-col items-center gap-3">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            <p className={cn('text-sm', TEXT.muted)}>
              {t('signingIn', { defaultValue: 'Connexion en cours…' })}
            </p>
          </div>
        )}
      </div>
    </LoginBackground>
  );
}
