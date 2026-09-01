/**
 * Formulaire « Nouveau client » — desktop.
 *
 * Reprend la logique du parcours mobile (`useCreateClient`, mêmes champs,
 * même écran de mot de passe temporaire) dans une mise en page desktop.
 *
 * Trois défauts signalés à l'usage, corrigés ici :
 *
 * 1. UN SEUL NUMÉRO. Un importateur a couramment plusieurs lignes — MTN et
 *    Orange, un numéro d'entreprise, une ligne chinoise en déplacement.
 *    L'opérateur devait en choisir un et perdre les autres. Le formulaire
 *    accepte désormais plusieurs numéros ; le PREMIER est le principal,
 *    celui qui reçoit le mot de passe, et les suivants sont enregistrés
 *    dans `client_phones` par `admin_set_client_phones`.
 *
 * 2. LE SÉLECTEUR D'INDICATIF n'avait ni chevron ni style, à côté d'un
 *    champ « Pays » qui en avait un, et son drapeau emoji s'affichait
 *    « CN » faute de police. Les deux passent sur le même `Select`.
 *
 * 3. AUCUN FORMATAGE NI VALIDATION du numéro : la seule garde était
 *    « au moins 9 caractères », espaces compris. Voir `PhoneField`.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Check, Copy, UserPlus, Plus, X } from 'lucide-react';
import { useCreateClient } from '@/hooks/useClientManagement';
import { useSetClientPhones, type ClientPhoneInput } from '@/hooks/useClientPhones';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, Card, Holder, FormField, TextInput, PrimaryPill, SoftPill } from '@/desktop/designKit';
import {
  PhoneNumberInput,
  EMPTY_PHONE,
  toE164,
  isPhoneComplete,
  type PhoneValue,
} from '@/components/form/PhoneNumberInput';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// `COUNTRY_CODES` a disparu : la liste des indicatifs vit dans
// `PhoneField`, qui les DÉRIVE de libphonenumber-js. Une table d'indicatifs
// écrite à la main est une table qui finit par mentir.

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
  email: string;
  pays: string;
  ville: string;
}

/**
 * Une ligne de numéro. L'ORDRE porte le sens : le premier est le principal,
 * celui qui reçoit le mot de passe. Pas de drapeau « principal » à cocher —
 * un drapeau autorise l'état « aucun principal » et l'état « deux
 * principaux », que la base refuserait de toute façon.
 */
interface PhoneRow {
  /** Clé de rendu stable : l'index ne l'est pas quand on supprime au milieu. */
  key: string;
  value: PhoneValue;
  label: string;
}

const newPhoneRow = (): PhoneRow => ({
  key: Math.random().toString(36).slice(2),
  value: EMPTY_PHONE,
  label: '',
});

interface CreateClientProps {
  /**
   * Rendu à l'intérieur d'une fenêtre : la largeur et les marges viennent
   * alors de la fenêtre, pas du formulaire, sinon on empile deux conteneurs
   * centrés et le contenu se retrouve étriqué au milieu.
   */
  embedded?: boolean;
}

export function DesktopCreateClient({ embedded = false }: CreateClientProps = {}) {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const createClientMutation = useCreateClient();

  const setPhonesMutation = useSetClientPhones();

  const [form, setForm] = useState<FormData>({
    prenom: '',
    nom: '',
    entreprise: '',
    email: '',
    pays: 'Cameroun',
    ville: '',
  });
  const [phones, setPhones] = useState<PhoneRow[]>([newPhoneRow()]);

  const [tempPassword, setTempPassword] = useState('');
  const [createdClientId, setCreatedClientId] = useState('');
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [extraPhonesFailed, setExtraPhonesFailed] = useState(false);

  const set = (k: keyof FormData, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const setPhone = (key: string, patch: Partial<PhoneRow>) =>
    setPhones((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const addPhone = () => setPhones((prev) => (prev.length >= 10 ? prev : [...prev, newPhoneRow()]));

  const removePhone = (key: string) =>
    setPhones((prev) => (prev.length <= 1 ? prev : prev.filter((row) => row.key !== key)));

  // Le principal doit être un VRAI numéro du pays choisi — plus « au moins
  // neuf caractères », qui laissait passer un numéro à huit chiffres. Les
  // numéros secondaires laissés vides sont simplement ignorés ; un
  // secondaire commencé mais incomplet, lui, bloque : le laisser passer
  // enregistrerait un numéro tronqué.
  const primary = phones[0];
  const filledExtras = phones.slice(1).filter((row) => row.value.national.trim().length > 0);
  const everyExtraComplete = filledExtras.every((row) => isPhoneComplete(row.value));

  const canSubmit =
    form.prenom.trim().length > 0 &&
    form.nom.trim().length > 0 &&
    isPhoneComplete(primary.value) &&
    everyExtraComplete;

  const handleCreateClient = async () => {
    if (!canSubmit) return;
    // E.164 produit par la bibliothèque, plus une concaténation d'indicatif
    // et de saisie brute. `canSubmit` garantit qu'il n'est pas nul.
    const primaryE164 = toE164(primary.value);
    if (!primaryE164) return;

    try {
      const result = await createClientMutation.mutateAsync({
        firstName: form.prenom.trim(),
        lastName: form.nom.trim(),
        company: form.entreprise.trim() || undefined,
        whatsappNumber: primaryE164,
        email: form.email.trim() || undefined,
        country: form.pays,
        city: form.ville.trim() || undefined,
      });

      // Les numéros secondaires s'enregistrent APRÈS la création : le client
      // doit exister pour être référencé. Si cet appel échoue, le client
      // reste créé avec son numéro principal — l'écran le dit plutôt que de
      // laisser croire que tout est passé.
      const extras: ClientPhoneInput[] = filledExtras.flatMap((row) => {
        const e164 = toE164(row.value);
        // `everyExtraComplete` l'a déjà garanti ; le test reste parce qu'un
        // invariant supposé finit un jour par ne plus l'être.
        return e164
          ? [{ phone_e164: e164, country_iso: row.value.country, label: row.label.trim() || null }]
          : [];
      });

      if (result.clientId && extras.length > 0) {
        try {
          await setPhonesMutation.mutateAsync({
            // `result.clientId` EST le user_id — voir `admin_create_client`.
            userId: result.clientId,
            phones: [
              { phone_e164: primaryE164, country_iso: primary.value.country, label: primary.label.trim() || null },
              ...extras,
            ],
          });
        } catch {
          setExtraPhonesFailed(true); // la mutation a déjà affiché l'erreur
        }
      }

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
  const required = <span className="text-destructive">*</span>;

  // ── Success ──────────────────────────────────────────────
  if (isSuccess) {
    return (
      <div className={cn('space-y-6', embedded ? '' : 'mx-auto max-w-xl')}>
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
            <Holder icon={passwordCopied ? Check : Copy} tone={passwordCopied ? 'success' : 'neutral'} size="sm" onClick={handleCopyPassword} ariaLabel="Copier le mot de passe" />
          </div>
          <div className="mt-3 rounded-2xl bg-amber-50 px-3 py-2.5 text-[12px] leading-relaxed text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
            Ce mot de passe ne sera plus affiché. Transmettez-le au client via WhatsApp.
          </div>

          {/* Le client a bien été créé avec son numéro principal, mais les
              numéros supplémentaires n'ont pas pu être enregistrés. Le taire
              laisserait croire qu'ils sont en base. */}
          {extraPhonesFailed && (
            <div className="mt-2 rounded-2xl bg-destructive/10 px-3 py-2.5 text-[12px] leading-relaxed text-destructive">
              Les numéros supplémentaires n'ont pas pu être enregistrés. Le client existe avec son
              numéro principal — ajoutez les autres depuis sa fiche.
            </div>
          )}
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
    <div className={cn('space-y-6', embedded ? '' : 'mx-auto max-w-3xl')}>
      <header className="flex items-center gap-3">
        <Holder icon={UserPlus} tone="info" />
        <div>
          <h2 className={cn('text-[24px] font-extrabold tracking-tight', TEXT.strong)}>
            {t('newClient', { defaultValue: 'Nouveau client' })}
          </h2>
          <p className={cn('mt-0.5 text-[14px]', TEXT.muted)}>Identité, contact et localisation</p>
        </div>
      </header>

      <Card className={cn('p-6', embedded && 'border-0 bg-transparent p-0 shadow-none')}>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField label={<>{t('firstName')} {required}</>} htmlFor="cc-prenom">
            <TextInput id="cc-prenom" placeholder="Ex: Fabrice" value={form.prenom} onChange={(e) => set('prenom', e.target.value)} autoComplete="given-name" />
          </FormField>
          <FormField label={<>{t('lastName')} {required}</>} htmlFor="cc-nom">
            <TextInput id="cc-nom" placeholder="Ex: Bienvenue" value={form.nom} onChange={(e) => set('nom', e.target.value)} autoComplete="family-name" />
          </FormField>

          <div className="sm:col-span-2">
            <FormField label={<>{t('company')} {optional}</>} htmlFor="cc-entreprise">
              <TextInput id="cc-entreprise" placeholder="Ex: Jako Cargo SARL" value={form.entreprise} onChange={(e) => set('entreprise', e.target.value)} autoComplete="organization" />
            </FormField>
          </div>

          <div className="sm:col-span-2">
            <FormField
              label={<>WhatsApp {required}</>}
              htmlFor="cc-phone"
              hint="Le premier numéro est le principal : c'est lui qui recevra le mot de passe."
            >
              <div className="space-y-2.5">
                {phones.map((row, index) => (
                  <div key={row.key} className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <PhoneNumberInput
                        id={index === 0 ? 'cc-phone' : `cc-phone-${index}`}
                        value={row.value}
                        onChange={(value) => setPhone(row.key, { value })}
                        aria-label={index === 0 ? 'Numéro WhatsApp principal' : `Numéro WhatsApp ${index + 1}`}
                      />
                    </div>

                    {/* Libellé : « MTN », « Bureau », « Chine ». Facultatif,
                        mais c'est lui qui rend une liste de quatre numéros
                        lisible six mois plus tard. */}
                    <TextInput
                      className="w-[150px] shrink-0"
                      placeholder={index === 0 ? 'Principal' : 'Ex: MTN, Bureau'}
                      value={row.label}
                      onChange={(e) => setPhone(row.key, { label: e.target.value })}
                      aria-label={`Libellé du numéro ${index + 1}`}
                    />

                    <button
                      type="button"
                      onClick={() => removePhone(row.key)}
                      disabled={phones.length <= 1}
                      aria-label={`Retirer le numéro ${index + 1}`}
                      className={cn(
                        'mt-0.5 flex h-12 w-10 shrink-0 items-center justify-center rounded-2xl transition',
                        phones.length <= 1
                          ? 'cursor-not-allowed opacity-30'
                          : 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive',
                      )}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}

                {phones.length < 10 && (
                  <button
                    type="button"
                    onClick={addPhone}
                    className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:underline"
                  >
                    <Plus className="size-3.5" />
                    Ajouter un autre numéro
                  </button>
                )}
              </div>
            </FormField>
          </div>

          <div className="sm:col-span-2">
            <FormField label={<>{t('email')} {optional}</>} htmlFor="cc-email">
              <TextInput id="cc-email" placeholder="fabrice@jakocargo.com" value={form.email} onChange={(e) => set('email', e.target.value)} type="email" autoComplete="email" />
            </FormField>
          </div>

          <FormField label={<>{t('country')} {required}</>} htmlFor="cc-pays">
            {/* Même composant que le sélecteur d'indicatif : un seul chevron,
                une seule affordance. Le `<select>` natif à chevron dessiné en
                image de fond n'existe plus. */}
            <Select value={form.pays} onValueChange={(v) => set('pays', v)}>
              <SelectTrigger id="cc-pays" className="h-12 rounded-2xl">
                <SelectValue placeholder="Choisir un pays" />
              </SelectTrigger>
              <SelectContent className="max-h-[320px]">
                {COUNTRY_GROUPS.map((g) => (
                  <SelectGroup key={g.label}>
                    <SelectLabel className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      {g.label}
                    </SelectLabel>
                    {g.countries.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label={<>{t('city')} {optional}</>} htmlFor="cc-ville">
            <TextInput id="cc-ville" placeholder="Ex: Douala" value={form.ville} onChange={(e) => set('ville', e.target.value)} />
          </FormField>
        </div>

        <div className="mt-4 rounded-2xl bg-amber-50 px-3.5 py-3 text-[12px] leading-relaxed text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
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
