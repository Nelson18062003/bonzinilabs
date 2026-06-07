import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useCreateClient } from '@/hooks/useClientManagement';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SURFACE,
  TEXT,
  Card,
  Holder,
  Row,
  FormField,
  TextInput,
  PrimaryPill,
  SoftPill,
} from '@/mobile/designKit';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';

// ============================================================
// BONZINI ADMIN — FORMULAIRE NOUVEAU CLIENT (redesign · design kit)
// 3 étapes : Identité → Contact → Vérification
// Pas de Genre, boutons toujours visibles, bottom nav masquée
// ============================================================

const COUNTRY_CODES: { country: string; code: string; flag: string }[] = [
  // ─── CEMAC (en premier) ───
  { code: '+237', country: 'Cameroun', flag: '🇨🇲' },
  { code: '+241', country: 'Gabon', flag: '🇬🇦' },
  { code: '+235', country: 'Tchad', flag: '🇹🇩' },
  { code: '+236', country: 'RCA', flag: '🇨🇫' },
  { code: '+242', country: 'Congo', flag: '🇨🇬' },
  { code: '+240', country: 'Guinée équatoriale', flag: '🇬🇶' },
  // ─── Afrique de l'Ouest ───
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
  // ─── Afrique Centrale & Est ───
  { code: '+243', country: 'RD Congo', flag: '🇨🇩' },
  { code: '+250', country: 'Rwanda', flag: '🇷🇼' },
  { code: '+257', country: 'Burundi', flag: '🇧🇮' },
  { code: '+244', country: 'Angola', flag: '🇦🇴' },
  // ─── Afrique du Nord ───
  { code: '+212', country: 'Maroc', flag: '🇲🇦' },
  { code: '+216', country: 'Tunisie', flag: '🇹🇳' },
  { code: '+213', country: 'Algérie', flag: '🇩🇿' },
  // ─── Reste de l'Afrique ───
  { code: '+254', country: 'Kenya', flag: '🇰🇪' },
  { code: '+255', country: 'Tanzanie', flag: '🇹🇿' },
  { code: '+256', country: 'Ouganda', flag: '🇺🇬' },
  { code: '+251', country: 'Éthiopie', flag: '🇪🇹' },
  { code: '+27', country: 'Afrique du Sud', flag: '🇿🇦' },
  // ─── Europe ───
  { code: '+33', country: 'France', flag: '🇫🇷' },
  { code: '+32', country: 'Belgique', flag: '🇧🇪' },
  { code: '+41', country: 'Suisse', flag: '🇨🇭' },
  { code: '+44', country: 'Royaume-Uni', flag: '🇬🇧' },
  { code: '+49', country: 'Allemagne', flag: '🇩🇪' },
  { code: '+34', country: 'Espagne', flag: '🇪🇸' },
  { code: '+39', country: 'Italie', flag: '🇮🇹' },
  { code: '+352', country: 'Luxembourg', flag: '🇱🇺' },
  // ─── Amérique ───
  { code: '+1', country: 'États-Unis / Canada', flag: '🇺🇸' },
  // ─── Asie ───
  { code: '+86', country: 'Chine', flag: '🇨🇳' },
  { code: '+971', country: 'Émirats arabes unis', flag: '🇦🇪' },
  { code: '+966', country: 'Arabie saoudite', flag: '🇸🇦' },
  { code: '+90', country: 'Turquie', flag: '🇹🇷' },
  { code: '+91', country: 'Inde', flag: '🇮🇳' },
];

const STEPS = [
  { num: 1, label: 'Identité' },
  { num: 2, label: 'Contact' },
  { num: 3, label: 'Vérification' },
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

// Shared classes for the native <select> controls (no kit Select; matched to TextInput).
const selectClass = cn(
  'h-12 w-full rounded-2xl px-4 text-[16px] outline-none transition',
  SURFACE.card,
  SURFACE.shadow,
  TEXT.strong,
  'focus:ring-2 focus:ring-[#C9C2F0] dark:focus:ring-[#4A4660]',
);

export function MobileCreateClient() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const createClientMutation = useCreateClient();

  const [step, setStep] = useState(1);
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

  // Success state
  const [tempPassword, setTempPassword] = useState('');
  const [createdClientId, setCreatedClientId] = useState('');
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const set = (k: keyof FormData, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  // Validation per step
  const canNext =
    step === 1
      ? form.prenom.trim().length > 0 && form.nom.trim().length > 0
      : step === 2
        ? form.phone.trim().length >= 9
        : true;

  const handleNext = () => {
    if (step < 3 && canNext) setStep(s => s + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(s => s - 1);
  };

  const handleCreateClient = async () => {
    try {
      // Build full phone number with country code, cleaned
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
      // Error is handled by the mutation (toast notification)
    }
  };

  const handleCopyPassword = async () => {
    await navigator.clipboard.writeText(tempPassword);
    setPasswordCopied(true);
    setTimeout(() => setPasswordCopied(false), 2000);
  };

  const optional = (
    <span className={cn('ml-1 text-[12px] font-medium', TEXT.muted)}>optionnel</span>
  );
  const required = <span className="text-[#FE560D]">*</span>;

  // ── ÉCRAN SUCCÈS ──────────────────────────────────────────
  if (isSuccess) {
    return (
      <div className={cn('flex min-h-screen flex-col', SURFACE.canvas)}>
        <MobileHeader title={t('newClient', { defaultValue: 'Nouveau client' })} />

        <div className="flex-1 overflow-y-auto px-4 py-8">
          {/* Icône succès */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center">
              <Holder icon={Check} tone="success" size="lg" />
            </div>
            <div className={cn('text-[20px] font-extrabold', TEXT.strong)}>
              {t('clientCreatedSuccess', { defaultValue: 'Client créé avec succès' })}
            </div>
            <div className={cn('mt-1 text-[14px]', TEXT.muted)}>
              {form.prenom} {form.nom} peut maintenant se connecter
            </div>
          </div>

          {/* Mot de passe temporaire */}
          <Card className="mb-4 p-4">
            <div className={cn('mb-2 text-[13px]', TEXT.muted)}>
              {t('temporaryPassword', { defaultValue: 'Mot de passe temporaire' })}
            </div>
            <div className={cn('flex items-center justify-between gap-3 rounded-2xl p-3.5', SURFACE.canvas)}>
              <code className={cn('text-[18px] font-bold tracking-wide', TEXT.strong)}>
                {tempPassword}
              </code>
              <Holder
                icon={passwordCopied ? Check : Copy}
                tone={passwordCopied ? 'success' : 'neutral'}
                size="sm"
                onClick={handleCopyPassword}
              />
            </div>
            <div className="mt-3 rounded-2xl bg-[#F8EFD8] px-3 py-2.5 text-[12px] leading-relaxed text-[#9A6B12] dark:bg-[#372D14] dark:text-[#E7C083]">
              Ce mot de passe ne sera plus affiché. Transmettez-le au client via WhatsApp.
            </div>
          </Card>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <PrimaryPill onClick={() => navigate(`/m/clients/${createdClientId}`)} className="w-full">
              {t('viewClientProfile', { defaultValue: 'Voir la fiche client' })}
            </PrimaryPill>
            <SoftPill onClick={() => navigate('/m/clients')} className="w-full">
              {t('backToList', { defaultValue: 'Retour à la liste' })}
            </SoftPill>
          </div>
        </div>
      </div>
    );
  }

  // ── FORMULAIRE 3 ÉTAPES ───────────────────────────────────
  return (
    <div className={cn('flex h-[100dvh] flex-col overflow-hidden', SURFACE.canvas)}>
      {/* HEADER — fixe, ne scroll pas */}
      <div className={cn('shrink-0 px-4 pt-[env(safe-area-inset-top)]', SURFACE.card, SURFACE.shadow)}>
        <div className="flex h-14 items-center">
          <button
            onClick={() => navigate('/m/clients')}
            className={cn('-ml-2 mr-2 flex h-10 w-10 items-center justify-center rounded-full text-[26px] font-light active:bg-black/5 dark:active:bg-white/5', TEXT.muted)}
            aria-label={t('back', { defaultValue: 'Retour' })}
          >
            ‹
          </button>
          <span className={cn('text-[15px] font-bold', TEXT.strong)}>
            {t('newClient', { defaultValue: 'Nouveau client' })}
          </span>
        </div>

        {/* Barre de progression 3 segments */}
        <div className="flex gap-1.5 pb-3">
          {STEPS.map(s => (
            <div key={s.num} className="flex-1">
              <div
                className={cn(
                  'h-[3px] rounded-full transition-colors',
                  step >= s.num ? 'bg-[#6B5BD2] dark:bg-[#A99BF0]' : 'bg-black/10 dark:bg-white/10',
                )}
              />
              <div
                className={cn(
                  'mt-1.5 text-center text-[10px]',
                  step === s.num
                    ? 'font-extrabold text-[#6B5BD2] dark:text-[#A99BF0]'
                    : cn('font-medium', TEXT.muted),
                )}
              >
                {s.num}. {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CONTENU — scrollable entre le header et le footer */}
      <div className="flex-1 overflow-y-auto px-4 pt-5" style={{ WebkitOverflowScrolling: 'touch' }}>
        {/* ── ÉTAPE 1 : IDENTITÉ ─────────────────────────── */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <div className={cn('text-[24px] font-extrabold', TEXT.strong)}>
                {t('whoIsYourClient', { defaultValue: 'Qui est votre client ?' })}
              </div>
              <div className={cn('mt-1 text-[14px]', TEXT.muted)}>
                {t('firstNameLastNameCompany', { defaultValue: 'Prénom, nom et entreprise' })}
              </div>
            </div>

            <FormField label={<>Prénom {required}</>} htmlFor="cc-prenom">
              <TextInput
                id="cc-prenom"
                placeholder="Ex: Fabrice"
                value={form.prenom}
                onChange={e => set('prenom', e.target.value)}
                autoComplete="given-name"
              />
            </FormField>

            <FormField label={<>Nom {required}</>} htmlFor="cc-nom">
              <TextInput
                id="cc-nom"
                placeholder="Ex: Bienvenue"
                value={form.nom}
                onChange={e => set('nom', e.target.value)}
                autoComplete="family-name"
              />
            </FormField>

            <FormField label={<>Entreprise {optional}</>} htmlFor="cc-entreprise">
              <TextInput
                id="cc-entreprise"
                placeholder="Ex: Jako Cargo SARL"
                value={form.entreprise}
                onChange={e => set('entreprise', e.target.value)}
                autoComplete="organization"
              />
            </FormField>
          </div>
        )}

        {/* ── ÉTAPE 2 : CONTACT ──────────────────────────── */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <div className={cn('text-[24px] font-extrabold', TEXT.strong)}>
                {t('howToReachClient', { defaultValue: 'Comment le joindre ?' })}
              </div>
              <div className={cn('mt-1 text-[14px]', TEXT.muted)}>
                {t('whatsappEmailLocation', { defaultValue: 'WhatsApp, email et localisation' })}
              </div>
            </div>

            {/* WhatsApp avec sélecteur de code pays */}
            <FormField
              label={<>WhatsApp {required}</>}
              htmlFor="cc-phone"
              hint="Le client recevra son mot de passe par WhatsApp"
            >
              <div className="flex gap-2">
                <select
                  value={countryCode}
                  onChange={e => setCountryCode(e.target.value)}
                  className={cn(selectClass, 'w-auto min-w-[104px] shrink-0 cursor-pointer px-3')}
                  aria-label="Indicatif pays"
                >
                  {COUNTRY_CODES.map(c => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.code}
                    </option>
                  ))}
                </select>
                <TextInput
                  id="cc-phone"
                  className="flex-1"
                  placeholder="6XX XXX XXX"
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                  type="tel"
                  inputMode="numeric"
                />
              </div>
            </FormField>

            {/* Email */}
            <FormField label={<>Email {optional}</>} htmlFor="cc-email">
              <TextInput
                id="cc-email"
                placeholder="fabrice@jakocargo.com"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                type="email"
                autoComplete="email"
              />
            </FormField>

            {/* Pays */}
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
                onChange={e => set('pays', e.target.value)}
              >
                <optgroup label="Zone CEMAC">
                  <option>Cameroun</option>
                  <option>Gabon</option>
                  <option>Tchad</option>
                  <option>République centrafricaine</option>
                  <option>Congo-Brazzaville</option>
                  <option>Guinée équatoriale</option>
                </optgroup>
                <optgroup label="Afrique de l'Ouest">
                  <option>Côte d'Ivoire</option>
                  <option>Sénégal</option>
                  <option>Mali</option>
                  <option>Burkina Faso</option>
                  <option>Togo</option>
                  <option>Bénin</option>
                  <option>Niger</option>
                  <option>Guinée</option>
                  <option>Nigeria</option>
                  <option>Ghana</option>
                </optgroup>
                <optgroup label="Afrique Centrale &amp; Est">
                  <option>RD Congo</option>
                  <option>Rwanda</option>
                  <option>Burundi</option>
                  <option>Angola</option>
                  <option>Kenya</option>
                  <option>Tanzanie</option>
                  <option>Ouganda</option>
                  <option>Éthiopie</option>
                </optgroup>
                <optgroup label="Afrique du Nord">
                  <option>Maroc</option>
                  <option>Tunisie</option>
                  <option>Algérie</option>
                </optgroup>
                <optgroup label="Afrique Australe">
                  <option>Afrique du Sud</option>
                </optgroup>
                <optgroup label="Europe">
                  <option>France</option>
                  <option>Belgique</option>
                  <option>Suisse</option>
                  <option>Royaume-Uni</option>
                  <option>Allemagne</option>
                  <option>Espagne</option>
                  <option>Italie</option>
                  <option>Luxembourg</option>
                </optgroup>
                <optgroup label="Amérique">
                  <option>États-Unis</option>
                  <option>Canada</option>
                </optgroup>
                <optgroup label="Asie / Moyen-Orient">
                  <option>Chine</option>
                  <option>Émirats arabes unis</option>
                  <option>Arabie saoudite</option>
                  <option>Turquie</option>
                  <option>Inde</option>
                </optgroup>
              </select>
            </FormField>

            {/* Ville */}
            <FormField label={<>Ville {optional}</>} htmlFor="cc-ville">
              <TextInput
                id="cc-ville"
                placeholder="Ex: Douala"
                value={form.ville}
                onChange={e => set('ville', e.target.value)}
              />
            </FormField>
          </div>
        )}

        {/* ── ÉTAPE 3 : VÉRIFICATION ─────────────────────── */}
        {step === 3 && (
          <div className="space-y-3">
            <div>
              <div className={cn('text-[24px] font-extrabold', TEXT.strong)}>
                {t('everythingCorrect', { defaultValue: 'Tout est correct ?' })}
              </div>
              <div className={cn('mt-1 text-[14px]', TEXT.muted)}>
                {t('verifyBeforeCreatingAccount', { defaultValue: 'Vérifiez avant de créer le compte' })}
              </div>
            </div>

            <Card className="p-4">
              {/* Initiales + nom complet */}
              <div className="mb-4 flex items-center gap-3">
                <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[15px] font-bold', SURFACE.holder)}>
                  {(form.prenom[0] ?? '').toUpperCase()}{(form.nom[0] ?? '').toUpperCase()}
                </div>
                <div>
                  <div className={cn('text-[17px] font-bold', TEXT.strong)}>
                    {form.prenom} {form.nom}
                  </div>
                  {form.entreprise && (
                    <div className={cn('text-[12px]', TEXT.muted)}>{form.entreprise}</div>
                  )}
                </div>
              </div>

              {/* Tableau récapitulatif */}
              {(
                [
                  { label: 'WhatsApp', value: `${countryCode} ${form.phone}` },
                  form.email ? { label: 'Email', value: form.email } : null,
                  { label: 'Pays', value: form.pays },
                  form.ville ? { label: 'Ville', value: form.ville } : null,
                ] as ({ label: string; value: string } | null)[]
              )
                .filter((r): r is { label: string; value: string } => r !== null)
                .map((row, i) => (
                  <Row key={i} label={row.label} value={row.value} />
                ))}
            </Card>

            {/* Note mot de passe */}
            <div className="rounded-2xl bg-[#F8EFD8] px-3.5 py-3 text-[12px] leading-relaxed text-[#9A6B12] dark:bg-[#372D14] dark:text-[#E7C083]">
              Un mot de passe temporaire sera envoyé au client par WhatsApp. Il devra le changer lors de sa première connexion.
            </div>
          </div>
        )}
      </div>

      {/* FOOTER — boutons TOUJOURS visibles, jamais cachés */}
      <div className={cn('flex shrink-0 gap-2.5 px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3', SURFACE.card, SURFACE.shadow)}>
        {/* Bouton Retour — absent à l'étape 1 */}
        {step > 1 && (
          <SoftPill onClick={handleBack} className="flex-1">
            {t('back', { defaultValue: 'Retour' })}
          </SoftPill>
        )}

        {/* Bouton Continuer / Créer le client */}
        <PrimaryPill
          onClick={step < 3 ? handleNext : handleCreateClient}
          disabled={!canNext}
          loading={createClientMutation.isPending}
          className={step === 1 ? 'flex-1' : 'flex-[1.5]'}
        >
          {step === 3
            ? t('createTheClient', { defaultValue: 'Créer le client' })
            : `${t('continue', { defaultValue: 'Continuer' })} (${step}/3)`}
        </PrimaryPill>
      </div>
    </div>
  );
}
