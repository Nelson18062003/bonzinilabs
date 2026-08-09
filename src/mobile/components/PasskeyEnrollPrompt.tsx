// ============================================================
// Proposition d'activer la connexion rapide, juste après une connexion.
//
// POURQUOI CET ÉCRAN EXISTE : l'activation vit dans Paramètres → Sécurité.
// Quelqu'un qui ne fouille pas les réglages ne la trouvera jamais — donc la
// fonctionnalité n'existerait que sur le papier. On propose donc une fois,
// au bon moment (l'admin vient de prouver son identité), puis on se tait.
//
// Ne s'affiche que si TOUT est vrai :
//   - une session admin est ouverte ;
//   - l'appareil sait gérer une clé d'accès ;
//   - aucune clé n'y est déjà enrôlée ;
//   - la proposition n'a pas été refusée récemment.
// ============================================================
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { hasPasskeyOnThisDevice, isPasskeySupported, registerPasskey } from '@/lib/passkey';
import { SURFACE, TEXT } from '@/mobile/designKit';
import { Fingerprint, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const SNOOZE_KEY = 'bonzini-admin-passkey-snooze';
const SNOOZE_DAYS = 14;
/** Laisse l'écran d'arrivée se poser avant de proposer quoi que ce soit. */
const APPEAR_DELAY_MS = 1200;

function isSnoozed(): boolean {
  try {
    const raw = localStorage.getItem(SNOOZE_KEY);
    if (!raw) return false;
    const until = Number(raw);
    return Number.isFinite(until) && Date.now() < until;
  } catch {
    return false;
  }
}

function snooze() {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000));
  } catch {
    /* stockage indisponible — au pire on reproposera */
  }
}

export function PasskeyEnrollPrompt() {
  const { t } = useTranslation('common');
  const { isAuthenticated } = useAdminAuth();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || hasPasskeyOnThisDevice() || isSnoozed()) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      const supported = await isPasskeySupported();
      if (!cancelled && supported) setVisible(true);
    }, APPEAR_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isAuthenticated]);

  if (!visible) return null;

  const dismiss = () => {
    snooze();
    setVisible(false);
  };

  const activate = async () => {
    setBusy(true);
    const result = await registerPasskey();
    setBusy(false);

    if (result.success) {
      toast.success(t('passkeyAdded', { defaultValue: 'Connexion rapide activée sur cet appareil' }));
      setVisible(false);
      return;
    }
    // Pas de message = feuille système fermée volontairement. On ne harcèle
    // pas : le refus vaut report, l'écran Paramètres reste disponible.
    if (result.error) toast.error(result.error);
    dismiss();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label={t('close', { defaultValue: 'Fermer' })}
        onClick={dismiss}
        className="absolute inset-0 bg-black/35 animate-fade-in"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative w-full max-w-lg rounded-t-[26px] px-5 pb-8 pt-6 animate-slide-up',
          SURFACE.card,
          'shadow-[0_-14px_44px_-16px_rgba(30,18,72,0.4)]',
        )}
      >
        <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#EDEAFA] text-[#5B4CC4] dark:bg-[#2F2C3D] dark:text-[#B5AAF0]">
          <Fingerprint className="h-6 w-6" />
        </div>

        <h2 className={cn('mt-4 text-[19px] font-extrabold leading-tight tracking-tight', TEXT.strong)}>
          {t('passkeyPromptTitle', { defaultValue: 'Se connecter plus vite la prochaine fois' })}
        </h2>
        <p className={cn('mt-2 text-[13.5px] leading-relaxed', TEXT.muted)}>
          {t('passkeyPromptBody', {
            defaultValue:
              'Utilisez le déverrouillage de votre appareil pour ouvrir Bonzini Admin. Plus de code à saisir, plus de mot de passe à retenir.',
          })}
        </p>

        <button
          type="button"
          onClick={activate}
          disabled={busy}
          className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1C1B22] text-[15px] font-bold text-white transition active:scale-[0.99] disabled:opacity-50 dark:bg-[#F2F1F7] dark:text-[#1B1A24]"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Fingerprint className="h-[18px] w-[18px]" />}
          {t('passkeyPromptActivate', { defaultValue: 'Activer' })}
        </button>

        <button
          type="button"
          onClick={dismiss}
          className={cn('mt-3 h-11 w-full text-[13.5px] font-semibold', TEXT.muted)}
        >
          {t('later', { defaultValue: 'Plus tard' })}
        </button>
      </div>
    </div>
  );
}
