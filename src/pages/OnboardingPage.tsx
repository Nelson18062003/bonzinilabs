import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMyProfile } from '@/hooks/useProfile';
import { useQueryClient } from '@tanstack/react-query';
import { BonziniLogo } from '@/components/BonziniLogo';
import { PremiumInput } from '@/components/auth/PremiumInput';
import { PhoneCountryInput, COUNTRIES, type Country } from '@/components/auth/PhoneCountryInput';
import { Button } from '@/components/ui/button';
import { Loader2, Building, Briefcase, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const { user, isLoading: authLoading } = useAuth();
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

    if (!country) { setCountryError('Veuillez sélectionner votre pays.'); return; }
    if (!phoneSchema.safeParse(phone).success) {
      setPhoneError('Veuillez saisir un numéro valide.');
      return;
    }
    if (!user) return;

    setSubmitting(true);
    // Liste blanche stricte : aucun champ sensible (kyc_verified/status) ici.
    const { error } = await supabase
      .from('clients')
      .update({
        phone,
        country,
        company_name: companyName || null,
        activity_sector: activitySector || null,
      })
      .eq('user_id', user.id);
    setSubmitting(false);

    if (error) {
      toast.error("Échec de l'enregistrement. Veuillez réessayer.");
      return;
    }

    // Email de bienvenue (best-effort, non bloquant ; no-op tant que le
    // template welcome n'est pas activé côté serveur).
    void supabase.rpc('enqueue_welcome_email');

    await queryClient.invalidateQueries({ queryKey: ['my-profile', user.id] });
    toast.success('Profil complété 🎉');
    navigate('/wallet', { replace: true });
  };

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <BonziniLogo size="md" />
        </div>

        <h1 className="text-2xl font-bold text-center mb-1">
          {firstName ? `Bonjour ${firstName} 👋` : 'Bienvenue 👋'}
        </h1>
        <p className="text-sm text-muted-foreground text-center mb-8">
          Plus qu'une étape pour régler vos fournisseurs.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Pays (bloquant) */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium mb-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              Pays <span className="text-destructive">*</span>
            </label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className={cn(
                'w-full h-12 rounded-xl border bg-background px-3 text-sm',
                countryError ? 'border-destructive' : 'border-border',
              )}
            >
              <option value="">Sélectionnez votre pays</option>
              {COUNTRIES.map((c) => (
                <option key={`${c.name}-${c.dialCode}`} value={c.name}>
                  {c.flag} {c.name}
                </option>
              ))}
            </select>
            {countryError && <p className="text-xs text-destructive mt-1">{countryError}</p>}
          </div>

          {/* Téléphone (bloquant) */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Téléphone <span className="text-destructive">*</span>
            </label>
            <PhoneCountryInput
              value={phone}
              onChange={setPhone}
              onCountryChange={(c: Country) => {
                if (!country) setCountry(c.name);
              }}
            />
            {phoneError && <p className="text-xs text-destructive mt-1">{phoneError}</p>}
          </div>

          {/* Optionnels */}
          <PremiumInput
            label="Société (optionnel)"
            value={companyName}
            onChange={setCompanyName}
            icon={<Building className="h-4 w-4" />}
          />
          <PremiumInput
            label="Secteur d'activité (optionnel)"
            value={activitySector}
            onChange={setActivitySector}
            icon={<Briefcase className="h-4 w-4" />}
          />

          <Button type="submit" className="w-full h-12" disabled={submitting}>
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Enregistrement…
              </span>
            ) : (
              'Continuer'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
