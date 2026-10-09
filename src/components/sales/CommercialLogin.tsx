// ============================================================
// ESPACE COMMERCIAL — la connexion (« /v/login ») : email, puis mot de passe.
//
// Son adresse est souvent inventée (« prenom@bonzini.com ») : le code par
// email de /m/login ne lui arriverait pas. C'est le PREMIER écran du
// commercial : il parle la langue de « /v » (beautifului.dev — surface
// blanche, champs remplis, une action à l'encre, une idée par écran), comme
// l'assistant prospect, et non plus celle de l'écran partagé des agents.
// Deux étapes : l'email (« Continuer »), puis le mot de passe
// (« Se connecter ») ; Entrée valide chaque étape. Aucune adresse n'est
// pré-remplie : un téléphone peut passer de main en main.
// ============================================================
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Eye, EyeOff } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { BonziniLogo } from '@/components/BonziniLogo';
import { EMAIL_SHAPE } from '@/lib/people';
import { Field, Shimmer } from './SalesUi';
import { FIELD, btn, descId } from './uiClasses';

/** « rodrigue@bonzini.com » → « rod•••@bonzini.com » (on sait à qui l'on parle, sans tout afficher). */
const maskEmail = (email: string) => {
  const [local, domain] = email.split('@');
  return domain ? `${local.slice(0, 3)}•••@${domain}` : email;
};

/** Les refus de Supabase (en anglais), dits en français. */
function frenchError(message: string | undefined): string {
  const m = (message ?? '').toLowerCase();
  if (m.includes('invalid login credentials')) return 'Email ou mot de passe incorrect.';
  if (m.includes('disabled')) return 'Ce compte a été désactivé. Voyez votre responsable.';
  if (m.includes('no role')) return 'Ce compte n’a pas accès à l’espace commercial.';
  if (m.includes('email not confirmed')) return 'Ce compte n’est pas encore activé. Voyez votre responsable.';
  return message || 'La connexion a échoué. Réessayez.';
}

export function CommercialLogin() {
  const navigate = useNavigate();
  const { login } = useAdminAuth();
  const [step, setStep] = useState<'email' | 'password'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [error, setError] = useState('');

  const toPassword = (e: FormEvent) => {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!EMAIL_SHAPE.test(clean)) {
      setEmailError('Entrez une adresse email valide.');
      return;
    }
    setEmail(clean);
    setStep('password');
  };

  const signIn = async (e: FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError('');
    const r = await login(email, password);
    setBusy(false);
    if (r.success) navigate('/v', { replace: true });
    else setError(frenchError(r.error));
  };

  return (
    <div className="s-surface flex min-h-[100dvh] flex-col">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="flex h-11 items-center">
          {step === 'password' && (
            <button
              type="button"
              onClick={() => {
                setStep('email');
                setError('');
                setPassword('');
              }}
              aria-label="Changer d’adresse"
              className={btn('ghost', 'icon', '-ml-2')}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="flex flex-1 flex-col justify-center pb-10">
          <div className="s-enter mb-8 flex items-center gap-3">
            <BonziniLogo size="md" showText={false} />
            <span className="text-[13px] font-semibold uppercase tracking-[0.06em] s-ink-3">Espace commercial</span>
          </div>

          {step === 'email' ? (
            <form key="email" noValidate onSubmit={toPassword} className="s-step-fwd space-y-6">
              <div>
                <h1 className="text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] s-ink">Connexion</h1>
                <p className="mt-2 text-[16px] leading-snug s-ink-2">Vos prospects, vos clients et votre mois, au même endroit.</p>
              </div>
              <Field label="Votre adresse email" htmlFor="v-email" error={emailError}>
                {/* eslint-disable-next-line no-restricted-syntax -- champ de « /v » à 17 px */}
                <input
                  id="v-email"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="next"
                  autoFocus
                  className={FIELD}
                  placeholder="prenom@bonzini.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value.replace(/\s+/g, ''));
                    setEmailError('');
                  }}
                  aria-invalid={!!emailError}
                  aria-describedby={descId('v-email')}
                />
              </Field>
              <button type="submit" disabled={!email.trim()} className={btn('ink', 'xl', 'w-full')}>
                Continuer
              </button>
            </form>
          ) : (
            <form key="password" noValidate onSubmit={(e) => void signIn(e)} className="s-step-fwd space-y-6">
              <div>
                <h1 className="text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] s-ink">Bonjour</h1>
                <p className="mt-2 break-all text-[16px] leading-snug s-ink-2">{maskEmail(email)}</p>
              </div>
              {/* L'adresse, pour le gestionnaire de mots de passe du téléphone. */}
              {/* eslint-disable-next-line no-restricted-syntax -- champ caché, jamais affiché */}
              <input type="email" autoComplete="username" value={email} readOnly hidden />
              <Field label="Mot de passe" htmlFor="v-password" error={error}>
                <div className="relative">
                  {/* eslint-disable-next-line no-restricted-syntax -- champ de « /v » à 17 px */}
                  <input
                    id="v-password"
                    type={show ? 'text' : 'password'}
                    autoComplete="current-password"
                    enterKeyHint="go"
                    autoFocus
                    className={`${FIELD} pr-14`}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError('');
                    }}
                    aria-invalid={!!error}
                    aria-describedby={descId('v-password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    aria-pressed={show}
                    className={btn('ghost', 'icon-sm', 'absolute right-2 top-1/2 -translate-y-1/2')}
                  >
                    {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                  </button>
                </div>
              </Field>
              <button type="submit" disabled={!password || busy} className={btn('ink', 'xl', 'w-full')}>
                {busy ? <Shimmer>Connexion…</Shimmer> : 'Se connecter'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-[13px] s-ink-3">Bonzini Labs © {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}
