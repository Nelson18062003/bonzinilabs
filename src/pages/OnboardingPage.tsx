import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMyProfile } from '@/hooks/useProfile';
import { useQueryClient } from '@tanstack/react-query';
import { BonziniLogo } from '@/components/BonziniLogo';
import { PremiumInput } from '@/components/auth/PremiumInput';
import { PhoneCountryInput, COUNTRIES, type Country } from '@/components/auth/PhoneCountryInput';
import { Loader2, Building, Briefcase, Globe, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, PRIMARY_PILL } from '@/mobile/designKit';

const phoneSchema = z.string().min(8);

/**
 * Onboarding post-OAuth (A5). Collecte les champs métier que Google ne
 * fournit pas : téléphone + pays (bloquants), société + secteur (optionnels).
 * Prénom/nom/email sont pré-remplis depuis l'identité Google.
 *
 * Mise à jour en LISTE BLANCHE de clients (jamais kyc_verified/status côté client).
 * Accessible uniquement connecté ; renvoie vers /wallet une fois complété.
 */
export default function OnboardingPage() {
  const navigate = useNavigate();
  const { t } = useTranslation('auth');
  const { user, signOut, isLoading: authLoading } = useAuth();
  const { data: profile, isLoading: profileLoading } = useMyProfile();
  const queryClient = useQueryClient();

  const [country, setCountry] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [activitySector, setActivitySector] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [countryError, setCountryError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Non connecté → /auth. Déjà complet → /wallet (évite de revenir ici).
  useEffect(() => {
    if (!authLoading && !user) navigate('/auth', { replace: true });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    // Le téléphone est le champ bloquant (cf. ProtectedRoute) : s'il est déjà
    // présent (client legacy / déjà onboardé), on ne reste pas sur l'onboarding.
    if (profile?.phone) {
      navigate('/wallet', { replace: true });
    }
    // Pré-remplir si des valeurs existent déjà partiellement.
    if (profile?.country) setCountry(profile.country);
    if (profile?.company_name) setCompanyName(profile.company_name);
    if (profile?.activity_sector) setActivitySector(profile.activity_sector);
  }, [profile, navigate]);

  const firstName = profile?.first_name?.trim() || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError('');
    setCountryError('');

    if (!country) { setCountryError(t('onboarding.errorCountry')); return; }
    if (!phoneSchema.safeParse(phone).success) {
      setPhoneError(t('onboarding.errorPhone'));
      return;
    }
    if (!user) return;

    setSubmitting(true);
    // RPC robuste : crée la fiche si absente (compte orphelin) PUIS met à jour
    // les champs métier (liste blanche). Évite la boucle d'onboarding sans fin.
    const { data, error } = await supabase.rpc('complete_client_onboarding', {
      p_phone: phone,
      p_country: country,
      p_company: companyName || null,
      p_sector: activitySector || null,
    });
    setSubmitting(false);

    if (error || (data && (data as { success?: boolean }).success === false)) {
      toast.error(t('onboarding.errorSave'));
      return;
    }

    // Email de bienvenue (best-effort, non bloquant ; no-op tant que le
    // template welcome n'est pas activé côté serveur).
    void supabase.rpc('enqueue_welcome_email');

    await queryClient.invalidateQueries({ queryKey: ['my-profile', user.id] });
    toast.success(t('onboarding.success'));
    navigate('/wallet', { replace: true });
  };

  if (authLoading || profileLoading) {
    return (
      <div className={cn('flex min-h-screen items-center justify-center', SURFACE.canvas)}>
        <Loader2 className="h-8 w-8 animate-spin text-[#8B5CF6]" />
      </div>
    );
  }

  return (
    <div className={cn('flex min-h-screen flex-col items-center justify-center p-6', SURFACE.canvas)}>
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <BonziniLogo size="md" />
        </div>

        <h1 className={cn('mb-1 text-center text-[24px] font-black', TEXT.strong)}>
          {firstName ? t('onboarding.greeting', { name: firstName }) : t('onboarding.welcome')}
        </h1>
        <p className={cn('mb-8 text-center text-[13px]', TEXT.muted)}>
          {t('onboarding.subtitle')}
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Pays (bloquant) */}
          <div>
            <label className={cn('mb-2 flex items-center gap-2 text-[13px] font-semibold', TEXT.strong)}>
              <Globe className="h-4 w-4" />
              {t('onboarding.countryLabel')} <span className="text-[#C0504D]">*</span>
            </label>
            <div className="relative">
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className={cn(
                  'h-12 w-full appearance-none rounded-2xl px-4 pr-10 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#C9C2F0] dark:focus:ring-[#4A4660]',
                  SURFACE.card,
                  SURFACE.shadow,
                  country ? TEXT.strong : 'text-[#9B98AD]',
                  countryError && 'ring-2 ring-[#C0504D]/40',
                )}
              >
                <option value="">{t('onboarding.selectCountry')}</option>
                {COUNTRIES.map((c) => (
                  <option key={`${c.name}-${c.dialCode}`} value={c.name}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown className={cn('pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2', TEXT.muted)} />
            </div>
            {countryError && <p className="mt-1 text-xs text-[#C0504D]">{countryError}</p>}
          </div>

          {/* Téléphone (bloquant) */}
          <div>
            <label className={cn('mb-2 block text-[13px] font-semibold', TEXT.strong)}>
              {t('onboarding.phoneLabel')} <span className="text-[#C0504D]">*</span>
            </label>
            <PhoneCountryInput
              value={phone}
              onChange={setPhone}
              hideLabel
              onCountryChange={(c: Country) => {
                if (!country) setCountry(c.name);
              }}
            />
            {phoneError && <p className="mt-1 text-xs text-[#C0504D]">{phoneError}</p>}
          </div>

          {/* Optionnels */}
          <PremiumInput
            label={t('onboarding.companyLabel')}
            value={companyName}
            onChange={setCompanyName}
            icon={<Building className="h-4 w-4" />}
          />
          <PremiumInput
            label={t('onboarding.sectorLabel')}
            value={activitySector}
            onChange={setActivitySector}
            icon={<Briefcase className="h-4 w-4" />}
          />

          <button
            type="submit"
            disabled={submitting}
            className={cn('flex h-12 w-full items-center justify-center gap-2 text-[15px] font-bold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50', PRIMARY_PILL)}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> {t('onboarding.saving')}
              </>
            ) : (
              t('onboarding.continue')
            )}
          </button>
        </form>

        {/* Sortie : ne jamais rester bloqué sur l'onboarding. */}
        <button
          type="button"
          onClick={async () => { await signOut(); navigate('/auth', { replace: true }); }}
          className={cn('mt-5 w-full text-[13px] font-semibold transition-colors', TEXT.muted, 'hover:text-[#5B4CC4] dark:hover:text-[#B5AAF0]')}
        >
          {t('onboarding.logout')}
        </button>
      </div>
    </div>
  );
}
