/**
 * DEV-ONLY maquette — module CLIENT « Auth / Onboarding » (refonte).
 * Éradique le vieux look (dégradé + halos de LoginBackground) → canvas calme,
 * CTA en pill charbon, dots lilas. Inputs : on garde le style premium
 * (floating label) ; ici représenté simplement.
 * Harness: ?screen=cauth-login | cauth-onboarding
 */
import { SURFACE, TEXT, PRIMARY_PILL } from '@/mobile/designKit/tokens';
import { BonziniLogo } from '@/components/BonziniLogo';
import { Mail, Building, Briefcase, Globe, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

function Field({ label, icon: Icon, value, placeholder }: { label: string; icon?: typeof Mail; value?: string; placeholder?: string }) {
  return (
    <div>
      <label className={cn('mb-1.5 block px-0.5 text-[13px] font-semibold', TEXT.strong)}>{label}</label>
      <div className={cn('flex h-12 items-center gap-2.5 rounded-2xl px-4', SURFACE.card, SURFACE.shadow)}>
        {Icon && <Icon className={cn('h-[18px] w-[18px] shrink-0', TEXT.muted)} />}
        {value ? <span className={cn('text-[16px] font-semibold', TEXT.strong)}>{value}</span> : <span className="text-[16px] text-[#9B98AD]">{placeholder}</span>}
      </div>
    </div>
  );
}

function Dots({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {[0, 1].map((i) => (
        <div key={i} className={cn('h-2 rounded-full transition-all', i === step ? 'w-8 bg-[#8B5CF6]' : 'w-2 bg-black/15 dark:bg-white/20')} />
      ))}
    </div>
  );
}

function GoogleBtn() {
  return (
    <button className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-black/10 bg-white text-[14px] font-semibold text-[#1f1f1f] shadow-sm">
      <svg viewBox="0 0 48 48" className="h-5 w-5"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" /><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" /><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" /><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.17 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" /></svg>
      Continuer avec Google
    </button>
  );
}

/* ===================== LOGIN (email) ===================== */
export function AuthLogin() {
  return (
    <div className={cn('mx-auto flex min-h-screen max-w-[420px] flex-col', SURFACE.canvas)}>
      <div className="flex flex-1 flex-col justify-center px-6 py-12">
        <div className="mb-8 flex justify-center"><BonziniLogo size="xl" showText textPosition="bottom" /></div>
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-7 text-center">
            <h1 className={cn('text-[24px] font-black', TEXT.strong)}>Connexion</h1>
            <p className={cn('mt-1 text-[13px]', TEXT.muted)}>Accédez à votre compte Bonzini</p>
          </div>
          <div className="mb-6"><Field label="Adresse e-mail" icon={Mail} placeholder="vous@exemple.com" /></div>
          <div className="mb-6"><Dots step={0} /></div>
          <button className={cn('flex h-12 w-full items-center justify-center text-[15px] font-bold', PRIMARY_PILL)}>Continuer</button>
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
            <span className={cn('text-[12px]', TEXT.muted)}>ou</span>
            <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
          </div>
          <GoogleBtn />
        </div>
      </div>
      <div className="px-6 pb-8 pt-2">
        <div className="mx-auto max-w-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
            <span className={cn('text-[12px]', TEXT.muted)}>ou</span>
            <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
          </div>
          <button className={cn('flex h-12 w-full items-center justify-center text-[14px] font-bold', SURFACE.card, SURFACE.shadow, TEXT.strong, 'rounded-full')}>Créer un compte</button>
          <p className={cn('mt-3 text-center text-[11px]', TEXT.muted)}>En continuant, vous acceptez nos conditions.</p>
        </div>
      </div>
    </div>
  );
}

/* ===================== ONBOARDING ===================== */
export function AuthOnboarding() {
  return (
    <div className={cn('mx-auto flex min-h-screen max-w-[420px] flex-col items-center justify-center p-6', SURFACE.canvas)}>
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center"><BonziniLogo size="md" /></div>
        <h1 className={cn('text-center text-[24px] font-black', TEXT.strong)}>Bonjour Papa 👋</h1>
        <p className={cn('mb-8 mt-1 text-center text-[13px]', TEXT.muted)}>Plus qu'une étape pour régler vos fournisseurs.</p>

        <div className="space-y-5">
          <div>
            <label className={cn('mb-1.5 flex items-center gap-2 px-0.5 text-[13px] font-semibold', TEXT.strong)}><Globe className="h-4 w-4" /> Pays *</label>
            <div className={cn('flex h-12 items-center justify-between rounded-2xl px-4', SURFACE.card, SURFACE.shadow)}>
              <span className="text-[16px] text-[#9B98AD]">Sélectionnez votre pays</span>
              <ChevronDown className={cn('h-4 w-4', TEXT.muted)} />
            </div>
          </div>
          <div>
            <label className={cn('mb-1.5 block px-0.5 text-[13px] font-semibold', TEXT.strong)}>Téléphone *</label>
            <div className={cn('flex h-12 items-center rounded-2xl', SURFACE.card, SURFACE.shadow)}>
              <span className={cn('flex items-center gap-1 border-r border-black/[0.06] px-3 text-[15px] font-bold dark:border-white/[0.08]', TEXT.strong)}>🇨🇲 +237</span>
              <span className="px-3 text-[16px] text-[#9B98AD]">6 XX XX XX XX</span>
            </div>
          </div>
          <Field label="Société (optionnel)" icon={Building} placeholder="Nom de votre entreprise" />
          <Field label="Secteur d'activité (optionnel)" icon={Briefcase} placeholder="Ex : Import textile" />
          <button className={cn('flex h-12 w-full items-center justify-center text-[15px] font-bold', PRIMARY_PILL)}>Continuer</button>
        </div>
        <button className={cn('mt-5 w-full text-center text-[13px] font-semibold', TEXT.muted)}>Se déconnecter</button>
      </div>
    </div>
  );
}
