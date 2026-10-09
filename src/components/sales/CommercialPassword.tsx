// ============================================================
// ESPACE COMMERCIAL — « Mon mot de passe » (« /v/password »).
//
// Le mot de passe est SA façon d'entrer (sur le site comme dans l'app
// BONZINI HQ) : il choisit le sien à la place du provisoire. Pas d'ancien mot
// de passe demandé : il vient d'ouvrir une session, c'est cette preuve-là qui
// autorise le changement (même règle que MobileChangePasswordScreen, dont
// c'est la version « /v » : une page blanche d'un seul tenant, des champs
// remplis, une action à l'encre).
// ============================================================
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronLeft, Eye, EyeOff, KeyRound } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { Field, Shimmer } from './SalesUi';
import { FIELD, btn, descId } from './uiClasses';

/** Un compte du personnel mérite mieux que les 6 caractères d'un client. */
const MIN_LENGTH = 10;

function SecretInput({ id, value, onChange, invalid, autoFocus }: { id: string; value: string; onChange: (v: string) => void; invalid: boolean; autoFocus?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      {/* eslint-disable-next-line no-restricted-syntax -- champ de « /v » à 17 px */}
      <input
        id={id}
        type={show ? 'text' : 'password'}
        autoComplete="new-password"
        autoFocus={autoFocus}
        className={`${FIELD} pr-14`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid}
        aria-describedby={descId(id)}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? 'Masquer' : 'Afficher'}
        aria-pressed={show}
        className={btn('ghost', 'icon-sm', 'absolute right-2 top-1/2 -translate-y-1/2')}
      >
        {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
      </button>
    </div>
  );
}

export function CommercialPassword() {
  const navigate = useNavigate();
  const { changeOwnPassword } = useAdminAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const mismatch = confirmation.length > 0 && confirmation !== password;
  const canSubmit = password.length >= MIN_LENGTH && confirmation === password && !busy;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    const r = await changeOwnPassword(password);
    setBusy(false);
    if (!r.success) {
      setError(r.error || 'Le mot de passe n’a pas pu être enregistré. Réessayez.');
      return;
    }
    toast.success('Mot de passe enregistré');
    navigate('/v', { replace: true });
  };

  return (
    <div className="s-surface min-h-[100dvh]">
      <div className="mx-auto w-full max-w-lg px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))] sm:px-6">
        <div className="flex h-11 items-center">
          <button type="button" onClick={() => navigate('/v')} className={btn('ghost', 'sm', '-ml-2 gap-1 pl-1.5')}>
            <ChevronLeft className="h-4 w-4" /> Mon mois
          </button>
        </div>
        <h1 className="s-enter mt-3 text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] s-ink">Mon mot de passe</h1>
        <p className="s-enter mt-2 text-[16px] leading-snug s-ink-2">
          Choisissez-en un dont vous vous souviendrez : c’est lui qui ouvre votre espace, sur le site comme dans l’app BONZINI HQ.
        </p>

        <form noValidate onSubmit={(e) => void submit(e)} className="mt-8 space-y-6">
          <Field label="Nouveau mot de passe" htmlFor="v-new-password" error={tooShort ? `Au moins ${MIN_LENGTH} caractères.` : undefined} hint={`Au moins ${MIN_LENGTH} caractères.`}>
            <SecretInput
              id="v-new-password"
              autoFocus
              value={password}
              onChange={(v) => {
                setPassword(v);
                setError('');
              }}
              invalid={tooShort}
            />
          </Field>
          <Field label="Le même, une seconde fois" htmlFor="v-confirm-password" error={mismatch ? 'Les deux mots de passe ne sont pas identiques.' : undefined}>
            <SecretInput
              id="v-confirm-password"
              value={confirmation}
              onChange={(v) => {
                setConfirmation(v);
                setError('');
              }}
              invalid={mismatch}
            />
          </Field>
          {error && (
            <p role="alert" data-tone="warn" className="s-note s-pop rounded-[14px] px-4 py-3 text-[15px] font-medium s-ink">
              {error}
            </p>
          )}
          <button type="submit" disabled={!canSubmit} className={btn('ink', 'xl', 'w-full')}>
            {busy ? (
              <Shimmer>Enregistrement…</Shimmer>
            ) : (
              <>
                <KeyRound className="h-[18px] w-[18px]" aria-hidden /> Enregistrer
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
