/**
 * Clients — création d'un compte.
 *
 * Rebuilt on the console's dimensional contract. The screen was still wearing
 * the mobile kit: 48px fields (a thumb target) against 47px footer pills — a
 * 1px mismatch that reads as a rendering fault — plus 24/22/18/14px type and a
 * hand-rolled `focus:ring-2 ring-[#C9C2F0]` that fired on mouse focus and in a
 * different colour from every other control in the console.
 *
 * It is now a `Workspace width="narrow"` (the form shape) with a `ScreenHead`,
 * `Field` + `Input`/`Select` for every input and `Button` for the footer, so
 * fields and actions are both the 32px `page` step and the focus ring is the
 * single `DFOCUS` the rest of the console uses.
 *
 * **Behaviour is untouched.** Same `useCreateClient` mutation (which calls the
 * `admin_create_client` SECURITY DEFINER RPC through `supabaseAdmin`), same
 * submit predicate, same phone normalisation, same temp-password reveal. No
 * money is involved, so nothing here is a financial control — but the screen
 * does create real accounts, which is why the logic was moved verbatim.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Check, Copy, UserPlus } from 'lucide-react';
import { useCreateClient } from '@/hooks/useClientManagement';
import { cn } from '@/lib/utils';
import { DT, DFG, DS } from '@/desktop/ui/tokens';
import { Button, Field, Holder, IconButton, Input, Panel, Select } from '@/desktop/ui/primitives';
import { ScreenHead, Workspace } from '@/desktop/ui/layout';

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

/** The one advisory surface of this screen — the "pending" tone of the shared kit. */
const NOTE = 'bg-[#F8EFD8] text-[#9A6B12] dark:bg-[#372D14] dark:text-[#E7C083]';

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

  const optional = 'Optionnel';

  // ── Success ──────────────────────────────────────────────
  if (isSuccess) {
    return (
      <Workspace
        width="narrow"
        head={
          <div className="flex items-start gap-3">
            <Holder icon={Check} tone="success" size="lg" />
            <ScreenHead
              title={t('clientCreatedSuccess', { defaultValue: 'Client créé avec succès' })}
              subtitle={`${form.prenom} ${form.nom} peut maintenant se connecter`}
              className="min-w-0 flex-1"
            />
          </div>
        }
      >
        <Panel className="p-4">
          <p className={cn(DT.label, DFG.muted)}>
            {t('temporaryPassword', { defaultValue: 'Mot de passe temporaire' })}
          </p>
          <div className={cn('mt-2 flex items-center justify-between gap-3 rounded-lg p-3', DS.well)}>
            <code className={cn(DT.body, DFG.strong, 'min-w-0 break-all font-mono font-bold')}>{tempPassword}</code>
            <IconButton
              icon={passwordCopied ? Check : Copy}
              variant="secondary"
              label={passwordCopied ? 'Mot de passe copié' : 'Copier le mot de passe'}
              onClick={handleCopyPassword}
            />
          </div>
          <p className={cn('mt-3 rounded-lg px-3 py-2', DT.label, NOTE)}>
            Ce mot de passe ne sera plus affiché. Transmettez-le au client via WhatsApp.
          </p>
        </Panel>

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button onClick={() => navigate('/m/clients')}>
            {t('backToList', { defaultValue: 'Retour à la liste' })}
          </Button>
          <Button variant="primary" onClick={() => navigate(`/m/clients/${createdClientId}`)}>
            {t('viewClientProfile', { defaultValue: 'Voir la fiche client' })}
          </Button>
        </div>
      </Workspace>
    );
  }

  // ── Form ─────────────────────────────────────────────────
  return (
    <Workspace
      width="narrow"
      head={
        <div className="flex items-start gap-3">
          <Holder icon={UserPlus} tone="info" size="lg" />
          <ScreenHead
            title={t('newClient', { defaultValue: 'Nouveau client' })}
            subtitle="Identité, contact et localisation"
            className="min-w-0 flex-1"
          />
        </div>
      }
    >
      <Panel className="p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('firstName')} required>
            <Input
              id="cc-prenom"
              placeholder="Ex: Fabrice"
              value={form.prenom}
              onChange={(e) => set('prenom', e.target.value)}
              autoComplete="given-name"
            />
          </Field>
          <Field label={t('lastName')} required>
            <Input
              id="cc-nom"
              placeholder="Ex: Bienvenue"
              value={form.nom}
              onChange={(e) => set('nom', e.target.value)}
              autoComplete="family-name"
            />
          </Field>

          <Field label={t('company')} hint={optional} className="sm:col-span-2">
            <Input
              id="cc-entreprise"
              placeholder="Ex: Jako Cargo SARL"
              value={form.entreprise}
              onChange={(e) => set('entreprise', e.target.value)}
              autoComplete="organization"
            />
          </Field>

          <Field
            label="WhatsApp"
            required
            hint="Le client recevra son mot de passe par WhatsApp"
            className="sm:col-span-2"
          >
            <div className="flex gap-2">
              <Select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                aria-label="Indicatif pays"
                className="w-auto min-w-[112px] shrink-0 cursor-pointer"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.code}
                  </option>
                ))}
              </Select>
              <Input
                id="cc-phone"
                className="flex-1"
                placeholder="6XX XXX XXX"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                type="tel"
                inputMode="numeric"
              />
            </div>
          </Field>

          <Field label={t('email')} hint={optional} className="sm:col-span-2">
            <Input
              id="cc-email"
              placeholder="fabrice@jakocargo.com"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              type="email"
              autoComplete="email"
            />
          </Field>

          <Field label={t('country')} required>
            <Select
              id="cc-pays"
              className="cursor-pointer"
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
            </Select>
          </Field>

          <Field label={t('city')} hint={optional}>
            <Input
              id="cc-ville"
              placeholder="Ex: Douala"
              value={form.ville}
              onChange={(e) => set('ville', e.target.value)}
            />
          </Field>
        </div>

        <p className={cn('mt-4 rounded-lg px-3 py-2', DT.label, NOTE)}>
          Un mot de passe temporaire sera transmis au client par WhatsApp. Il devra le changer lors de sa première
          connexion.
        </p>
      </Panel>

      <div className="mt-4 flex items-center justify-end gap-2">
        <Button onClick={() => navigate('/m/clients')}>{t('cancel', { defaultValue: 'Annuler' })}</Button>
        <Button
          variant="primary"
          onClick={handleCreateClient}
          disabled={!canSubmit}
          loading={createClientMutation.isPending}
        >
          {t('createTheClient', { defaultValue: 'Créer le client' })}
        </Button>
      </div>
    </Workspace>
  );
}
