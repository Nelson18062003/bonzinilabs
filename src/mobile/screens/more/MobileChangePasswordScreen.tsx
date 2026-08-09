// ============================================================
// Choisir son mot de passe — écran qui n'existait pas.
//
// LE DÉFAUT D'ORIGINE : aucun admin n'a jamais pu choisir son mot de passe.
// `admin_reset_password` produit 12 caractères hexadécimaux (« a3f9c2d10b4e »),
// et le bouton « Changer mon mot de passe » de la fiche admin en générait
// simplement un autre. Personne ne peut retenir ça — d'où les blocages à
// répétition.
//
// PAS D'ANCIEN MOT DE PASSE DEMANDÉ, ET C'EST VOULU : la personne qui arrive
// ici est justement celle qui ne s'en souvient pas. Elle vient d'ouvrir une
// session (code email, Google ou clé d'accès) : c'est cette preuve-là qui
// autorise le changement.
// ============================================================
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { PasswordField } from '@/components/form';
import { SURFACE, TEXT, Card, PrimaryPill } from '@/mobile/designKit';
import { Check, Info } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/** Un compte qui signe des paiements mérite mieux que les 6 caractères du client. */
const MIN_LENGTH = 10;

export function MobileChangePasswordScreen({ desktop = false }: { desktop?: boolean } = {}) {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { changeOwnPassword } = useAdminAuth();

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const mismatch = confirmation.length > 0 && confirmation !== password;
  const canSubmit = password.length >= MIN_LENGTH && confirmation === password && !busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < MIN_LENGTH) {
      setError(t('passwordTooShort', { defaultValue: 'Au moins {{count}} caractères.', count: MIN_LENGTH }));
      return;
    }
    if (password !== confirmation) {
      setError(t('passwordMismatch', { defaultValue: 'Les deux mots de passe ne sont pas identiques.' }));
      return;
    }

    setBusy(true);
    const result = await changeOwnPassword(password);
    setBusy(false);

    if (!result.success) {
      setError(result.error || t('errorOccurred', { defaultValue: 'Une erreur est survenue' }));
      return;
    }

    toast.success(t('passwordUpdated', { defaultValue: 'Mot de passe mis à jour' }));
    navigate('/m/more/settings', { replace: true });
  };

  return (
    <div className={desktop ? 'mx-auto max-w-2xl' : 'flex min-h-full flex-col'}>
      {desktop ? (
        <header className="mb-6">
          <h2 className={cn('text-[24px] font-extrabold tracking-tight', TEXT.strong)}>
            {t('myPassword', { defaultValue: 'Mon mot de passe' })}
          </h2>
        </header>
      ) : (
        <MobileHeader title={t('myPassword', { defaultValue: 'Mon mot de passe' })} showBack />
      )}

      <form onSubmit={submit} className={cn(desktop ? 'space-y-5' : 'flex-1 space-y-5 px-4 py-5', !desktop && SURFACE.canvas)}>
        <Card>
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EDEAFA] text-[#5B4CC4] dark:bg-[#2F2C3D] dark:text-[#B5AAF0]">
              <Info className="h-[18px] w-[18px]" />
            </div>
            <p className={cn('text-[13px] leading-relaxed', TEXT.muted)}>
              {t('choosePasswordHint', {
                defaultValue:
                  'Choisissez un mot de passe dont vous vous souviendrez. Il ne sert qu’en dernier recours : le code par email et la connexion rapide restent plus simples.',
              })}
            </p>
          </div>
        </Card>

        <Card className="space-y-4">
          <PasswordField
            id="new-password"
            label={t('newPassword', { defaultValue: 'Nouveau mot de passe' })}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
            autoComplete="new-password"
            hint={t('atLeastNChars', { defaultValue: 'Au moins {{count}} caractères', count: MIN_LENGTH })}
            error={tooShort ? t('passwordTooShort', { defaultValue: 'Au moins {{count}} caractères.', count: MIN_LENGTH }) : undefined}
          />

          <PasswordField
            id="confirm-password"
            label={t('confirmPassword', { defaultValue: 'Confirmer le mot de passe' })}
            value={confirmation}
            onChange={(e) => {
              setConfirmation(e.target.value);
              setError('');
            }}
            autoComplete="new-password"
            error={mismatch ? t('passwordMismatch', { defaultValue: 'Les deux mots de passe ne sont pas identiques.' }) : undefined}
          />
        </Card>

        {error && <p className="px-1 text-[13px] text-[#C0504D] dark:text-[#E79A9A]">{error}</p>}

        <PrimaryPill type="submit" disabled={!canSubmit} loading={busy} className="w-full">
          <Check className="h-[17px] w-[17px]" />
          {t('save', { defaultValue: 'Enregistrer' })}
        </PrimaryPill>
      </form>
    </div>
  );
}
