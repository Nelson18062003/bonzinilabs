/**
 * Desktop admin — new client form.
 *
 * Same logic as the mobile 3-step wizard (useCreateClient, identical fields,
 * validation and success/temp-password screen) but laid out for desktop: a
 * single carded page with a two-column field grid and a real heading instead of
 * the mobile step-bar + sticky footer. No money is involved, so this safely
 * reuses the exact creation mutation.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Check, Copy, UserPlus } from 'lucide-react';
import { useCreateClient } from '@/hooks/useClientManagement';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, Card, Holder, FormField, TextInput, PrimaryPill, SoftPill } from '@/mobile/designKit';

const COUNTRY_CODES: { country: string; code: string; flag: string }[] = [
  { code: '+237', country: 'Cameroun', flag: '🇨🇲' },
  { code: '+241', country: 'Gabon', flag: '🇬🇦' },
  { code: '+235', country: 'Tchad', flag: '🇹🇩' },
  { code: '+236', country: 'RCA', flag: '🇨🇫' },
  { code: '+242', country: 'Congo', flag: '🇨🇬' },
  { code: '+240', country: 'Guinée équatoriale', flag: '🇬🇶' },
  { code: '+225', country: "Côte d'Ivoire", flag: '🇨🇮' },
  { code: '+221', country: 'Sénégal', flag: '🇸🇳' },
  { code: '+223', country: 'Mali', flag: '🇲🇱' },
  { code: '+226', country: 'Burkina Faso', flag: '🇧🇫' },
  { code: '+228', country: 'Togo', flag: '🇹🇬' },
  { code: '+229', country: 'Bénin', flag: '🇧🇯' },
  { code: '+227', country: 'Niger', flag: '🇳🇪' },
  { code: '+224', country: 'Guinée', flag: '🇬🇳' },
  { code: '+234', country: 'Nigeria', flag: '🇳🇬' },
  { code: '+233', country: 'Ghana', flag: '🇬🇭' },
  { code: '+243', country: 'RD Congo', flag: '🇨🇩' },
  { code: '+250', country: 'Rwanda', flag: '🇷🇼' },
  { code: '+257', country: 'Burundi', flag: '🇧🇮' },
  { code: '+244', country: 'Angola', flag: '🇦🇴' },
  { code: '+212', country: 'Maroc', flag: '🇲🇦' },
  { code: '+216', country: 'Tunisie', flag: '🇹🇳' },
  { code: '+213', country: 'Algérie', flag: '🇩🇿' },
  { code: '+254', country: 'Kenya', flag: '🇰🇪' },
  { code: '+255', country: 'Tanzanie', flag: '🇹🇿' },
  { code: '+256', country: 'Ouganda', flag: '🇺🇬' },
  { code: '+251', country: 'Éthiopie', flag: '🇪🇹' },
  { code: '+27', country: 'Afrique du Sud', flag: '🇿🇦' },
  { code: '+33', country: 'France', flag: '🇫🇷' },
  { code: '+32', country: 'Belgique', flag: '🇧🇪' },
  { code: '+41', country: 'Suisse', flag: '🇨🇭' },
  { code: '+44', country: 'Royaume-Uni', flag: '🇬🇧' },
  { code: '+49', country: 'Allemagne', flag: '🇩🇪' },
  { code: '+34', country: 'Espagne', flag: '🇪🇸' },
  { code: '+39', country: 'Italie', flag: '🇮🇹' },
  { code: '+352', country: 'Luxembourg', flag: '🇱🇺' },
  { code: '+1', country: 'États-Unis / Canada', flag: '🇺🇸' },
  { code: '+86', country: 'Chine', flag: '🇨🇳' },
  { code: '+971', country: 'Émirats arabes unis', flag: '🇦🇪' },
  { code: '+966', country: 'Arabie saoudite', flag: '🇸🇦' },
  { code: '+90', country: 'Turquie', flag: '🇹🇷' },
  { code: '+91', country: 'Inde', flag: '🇮🇳' },
];

const COUNTRY_GROUPS: { label: string; countries: string[] }[] = [
  { label: 'Zone CEMAC', countries: ['Cameroun', 'Gabon', 'Tchad', 'République centrafricaine', 'Congo-Brazzaville', 'Guinée équatoriale'] },
  { label: "Afrique de l'Ouest", countries: ["Côte d'Ivoire", 'Sénégal', 'Mali', 'Burkina Faso', 'Togo', 'Bénin', 'Niger', 'Guinée', 'Nigeria', 'Ghana'] },
  { label: 'Afrique Centrale & Est', countries: ['RD Congo', 'Rwanda', 'Burundi', 'Angola', 'Kenya', 'Tanzanie', 'Ouganda', 'Éthiopie'] },
  { label: 'Afrique du Nord', countries: ['Maroc', 'Tunisie', 'Algérie'] },
  { label: 'Afrique Australe', countries: ['Afrique du Sud'] },
  { label: 'Europe', countries: ['France', 'Belgique', 'Suisse', 'Royaume-Uni', 'Allemagne', 'Espagne', 'Italie', 'Luxembourg'] },
  { label: 'Amérique', countries: ['États-Unis', 'Canada'] },
  { label: 'Asie / Moyen-Orient', countries: ['Chine', 'Émirats arabes unis', 'Arabie saoudite', 'Turquie', 'Inde'] },
];

interface FormData {
  prenom: string;
  nom: string;
  entreprise: string;
  phone: string;
  email: string;
  pays: string;
  ville: string;
}

const selectClass = cn(
  'h-12 w-full rounded-2xl px-4 text-[14px] outline-none transition',
  SURFACE.card,
  SURFACE.shadow,
  TEXT.strong,
  'focus:ring-2 focus:ring-[#C9C2F0] dark:focus:ring-[#4A4660]',
);

export function DesktopCreateClient() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const createClientMutation = useCreateClient();

  const [form, setForm] = useState<FormData>({
    prenom: '',
    nom: '',
    entreprise: '',
    phone: '',
    email: '',
    pays: 'Cameroun',
    ville: '',
  });
  const [countryCode, setCountryCode] = useState('+237');

  const [tempPassword, setTempPassword] = useState('');
  const [createdClientId, setCreatedClientId] = useState('');
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const set = (k: keyof FormData, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const canSubmit =
    form.prenom.trim().length > 0 && form.nom.trim().length > 0 && form.phone.trim().length >= 9;

  const handleCreateClient = async () => {
    if (!canSubmit) return;
    try {
      const cleanPhone = `${countryCode}${form.phone.trim()}`.replace(/[\s\-.()]/g, '');
      const result = await createClientMutation.mutateAsync({
        firstName: form.prenom.trim(),
        lastName: form.nom.trim(),
        company: form.entreprise.trim() || undefined,
        whatsappNumber: cleanPhone,
        email: form.email.trim() || undefined,
        country: form.pays,
        city: form.ville.trim() || undefined,
      });
      if (result.tempPassword) {
        setTempPassword(result.tempPassword);
        setCreatedClientId(result.clientId || '');
        setIsSuccess(true);
      }
    } catch {
      // handled by the mutation (toast)
    }
  };

  const handleCopyPassword = async () => {
    await navigator.clipboard.writeText(tempPassword);
    setPasswordCopied(true);
    setTimeout(() => setPasswordCopied(false), 2000);
  };

  const optional = <span className={cn('ml-1 text-[12px] font-medium', TEXT.muted)}>optionnel</span>;
  const required = <span className="text-[#FE560D]">*</span>;

  // ── Success ──────────────────────────────────────────────
  if (isSuccess) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <header className="text-center">
          <div className="mx-auto mb-3 flex justify-center">
            <Holder icon={Check} tone="success" size="lg" />
          </div>
          <h2 className={cn('text-[22px] font-extrabold tracking-tight', TEXT.strong)}>
            {t('clientCreatedSuccess', { defaultValue: 'Client créé avec succès' })}
          </h2>
          <p className={cn('mt-1 text-[14px]', TEXT.muted)}>
            {form.prenom} {form.nom} peut maintenant se connecter
          </p>
        </header>

        <Card className="p-5">
          <div className={cn('mb-2 text-[13px]', TEXT.muted)}>
            {t('temporaryPassword', { defaultValue: 'Mot de passe temporaire' })}
          </div>
          <div className={cn('flex items-center justify-between gap-3 rounded-2xl p-3.5', SURFACE.canvas)}>
            <code className={cn('text-[18px] font-bold tracking-wide', TEXT.strong)}>{tempPassword}</code>
            <Holder icon={passwordCopied ? Check : Copy} tone={passwordCopied ? 'success' : 'neutral'} size="sm" onClick={handleCopyPassword} />
          </div>
          <div className="mt-3 rounded-2xl bg-[#F8EFD8] px-3 py-2.5 text-[12px] leading-relaxed text-[#9A6B12] dark:bg-[#372D14] dark:text-[#E7C083]">
            Ce mot de passe ne sera plus affiché. Transmettez-le au client via WhatsApp.
          </div>
        </Card>

        <div className="flex gap-2.5">
          <SoftPill onClick={() => navigate('/m/clients')} className="flex-1">
            {t('backToList', { defaultValue: 'Retour à la liste' })}
          </SoftPill>
          <PrimaryPill onClick={() => navigate(`/m/clients/${createdClientId}`)} className="flex-[1.5]">
            {t('viewClientProfile', { defaultValue: 'Voir la fiche client' })}
          </PrimaryPill>
        </div>
      </div>
    );
  }

  // ── Form ─────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-center gap-3">
        <Holder icon={UserPlus} tone="info" />
        <div>
          <h2 className={cn('text-[24px] font-extrabold tracking-tight', TEXT.strong)}>
            {t('newClient', { defaultValue: 'Nouveau client' })}
          </h2>
          <p className={cn('mt-0.5 text-[14px]', TEXT.muted)}>Identité, contact et localisation</p>
        </div>
      </header>

      <Card className="p-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField label={<>Prénom {required}</>} htmlFor="cc-prenom">
            <TextInput id="cc-prenom" placeholder="Ex: Fabrice" value={form.prenom} onChange={(e) => set('prenom', e.target.value)} autoComplete="given-name" />
          </FormField>
          <FormField label={<>Nom {required}</>} htmlFor="cc-nom">
            <TextInput id="cc-nom" placeholder="Ex: Bienvenue" value={form.nom} onChange={(e) => set('nom', e.target.value)} autoComplete="family-name" />
          </FormField>

          <div className="sm:col-span-2">
            <FormField label={<>Entreprise {optional}</>} htmlFor="cc-entreprise">
              <TextInput id="cc-entreprise" placeholder="Ex: Jako Cargo SARL" value={form.entreprise} onChange={(e) => set('entreprise', e.target.value)} autoComplete="organization" />
            </FormField>
          </div>

          <div className="sm:col-span-2">
            <FormField label={<>WhatsApp {required}</>} htmlFor="cc-phone" hint="Le client recevra son mot de passe par WhatsApp">
              <div className="flex gap-2">
                <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className={cn(selectClass, 'w-auto min-w-[112px] shrink-0 cursor-pointer px-3')} aria-label="Indicatif pays">
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.code}
                    </option>
                  ))}
                </select>
                <TextInput id="cc-phone" className="flex-1" placeholder="6XX XXX XXX" value={form.phone} onChange={(e) => set('phone', e.target.value)} type="tel" inputMode="numeric" />
              </div>
            </FormField>
          </div>

          <div className="sm:col-span-2">
            <FormField label={<>Email {optional}</>} htmlFor="cc-email">
              <TextInput id="cc-email" placeholder="fabrice@jakocargo.com" value={form.email} onChange={(e) => set('email', e.target.value)} type="email" autoComplete="email" />
            </FormField>
          </div>

          <FormField label={<>Pays {required}</>} htmlFor="cc-pays">
            <select
              id="cc-pays"
              className={cn(selectClass, 'cursor-pointer appearance-none pr-9')}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 5l3 3 3-3' fill='none' stroke='%237a7290' stroke-width='1.5'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 14px center',
              }}
              value={form.pays}
              onChange={(e) => set('pays', e.target.value)}
            >
              {COUNTRY_GROUPS.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.countries.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </FormField>

          <FormField label={<>Ville {optional}</>} htmlFor="cc-ville">
            <TextInput id="cc-ville" placeholder="Ex: Douala" value={form.ville} onChange={(e) => set('ville', e.target.value)} />
          </FormField>
        </div>

        <div className="mt-4 rounded-2xl bg-[#F8EFD8] px-3.5 py-3 text-[12px] leading-relaxed text-[#9A6B12] dark:bg-[#372D14] dark:text-[#E7C083]">
          Un mot de passe temporaire sera envoyé au client par WhatsApp. Il devra le changer lors de sa première connexion.
        </div>

        <div className="mt-5 flex items-center justify-end gap-2.5">
          <SoftPill onClick={() => navigate('/m/clients')}>{t('cancel', { defaultValue: 'Annuler' })}</SoftPill>
          <PrimaryPill onClick={handleCreateClient} disabled={!canSubmit} loading={createClientMutation.isPending}>
            {t('createTheClient', { defaultValue: 'Créer le client' })}
          </PrimaryPill>
        </div>
      </Card>
    </div>
  );
}
