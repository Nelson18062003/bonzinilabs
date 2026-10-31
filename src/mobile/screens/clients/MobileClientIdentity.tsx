/**
 * Fiche client › Identité (maquette 10/10) : nom, sexe, naissance, ville,
 * email, entreprise, pays, origine ; « Client depuis » et « Enregistré par »
 * en lecture. Enregistrement comme l'ancienne feuille « Modifier » :
 * UPDATE `clients` (useUpdateClient), `admin_set_client_identity` si le sexe
 * ou la date changent, `set_client_source` pour l'origine. Les numéros ont
 * leur écran (Téléphones).
 *
 * Droits : modifier = `canManageUsers` (comme avant) ; l'origine suit sa
 * propre règle (`canEditClients`, ou `canRegisterClients` si elle est vide).
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useClient, useSetClientIdentity, useUpdateClient } from '@/hooks/useClientManagement';
import { useClientOrigin, useSetClientSource } from '@/hooks/useClientSources';
import { birthTextIssue, formatBirthInput, identityPatch, isoToBirthText } from '@/components/clients/clientIdentity';
import { ClientSourcePicker } from '@/components/clients/ClientSourcePicker';
import { ClientRegistration } from '@/components/clients/ClientRegistration';
import { CountryCombobox } from '@/components/form/CountryCombobox';
import { countryLabelFr, isoFromCountryLabel } from '@/data/countries';
import { isGender, type Gender } from '@/lib/people';
import { BigButton, BoxSegmented, Dock, KVBox, ScreenLoader, ScreenTop } from '@/mobile/designKit';
import { BIG_FIELD, BigInput, FieldLabel } from './parts';

export function MobileClientIdentity() {
  const { clientId = '' } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const { data: client, isLoading } = useClient(clientId);
  const origin = useClientOrigin(clientId || undefined);
  const update = useUpdateClient();
  const setIdentity = useSetClientIdentity();
  const setSource = useSetClientSource();
  const canEdit = hasPermission('canManageUsers');

  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [birth, setBirth] = useState('');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [country, setCountry] = useState('');
  const [sourceDraft, setSourceDraft] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!client || loaded) return;
    setFirst(client.firstName);
    setLast(client.lastName);
    setGender(isGender(client.gender) ? client.gender : null);
    setBirth(isoToBirthText(client.dateOfBirth));
    setCity(client.city);
    setEmail(client.email);
    setCompany(client.companyName);
    setCountry(client.country);
    setLoaded(true);
  }, [client, loaded]);

  if (isLoading || !client) return <ScreenLoader className="min-h-[100dvh]" />;

  const src = origin.data?.source ?? null;
  const canOrigin = hasPermission('canEditClients') || (hasPermission('canRegisterClients') && !src);
  const sourceChanged = !!sourceDraft && sourceDraft !== src?.id;
  const busy = update.isPending || setIdentity.isPending || setSource.isPending;
  const first4 = client.firstName || 'Client';

  const save = async () => {
    if (busy) return;
    try {
      if (canEdit) {
        if (!first.trim() || !last.trim()) { toast.error('Prénom et nom sont requis.'); return; }
        if (birth !== isoToBirthText(client.dateOfBirth) && birthTextIssue(birth) !== null) { toast.error('Date de naissance invalide (JJ/MM/AAAA).'); return; }
        const identity = identityPatch(client, { gender, birthText: birth });
        await update.mutateAsync({
          userId: client.id,
          firstName: first.trim(),
          lastName: last.trim(),
          email: email.trim(),
          companyName: company.trim(),
          country: country.trim(),
          city: city.trim(),
          silent: identity !== null || sourceChanged,
        });
        if (identity) await setIdentity.mutateAsync({ userId: client.id, ...identity });
      }
      if (canOrigin && sourceChanged && sourceDraft) await setSource.mutateAsync({ userId: client.id, sourceId: sourceDraft });
      toast.success('Identité enregistrée');
      navigate(`/m/clients/${client.id}`);
    } catch (e) {
      toast.error((e as Error).message || 'Enregistrement impossible');
    }
  };

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-[#1E1E1E]">
      <ScreenTop title={`Identité · ${first4}`} backTo={`/m/clients/${client.id}`} />
      <div className="px-5 pb-4 pt-5">
        <FieldLabel>Nom</FieldLabel>
        <div className="grid grid-cols-2 gap-2.5">
          <BigInput aria-label="Prénom" value={first} onChange={(e) => setFirst(e.target.value)} disabled={!canEdit} autoCapitalize="words" />
          <BigInput aria-label="Nom" value={last} onChange={(e) => setLast(e.target.value)} disabled={!canEdit} autoCapitalize="words" />
        </div>
        <BoxSegmented<Gender>
          className="mt-2.5"
          ariaLabel="Sexe"
          options={[{ value: 'FEMALE', label: 'Femme' }, { value: 'MALE', label: 'Homme' }]}
          value={(gender ?? '') as Gender}
          onChange={(g) => canEdit && setGender(g)}
        />

        <div className="grid grid-cols-2 gap-2.5">
          <div className="mt-5">
            <FieldLabel htmlFor="id-birth">Naissance</FieldLabel>
            <BigInput id="id-birth" inputMode="numeric" placeholder="JJ/MM/AAAA" maxLength={10} value={birth} onChange={(e) => setBirth(formatBirthInput(e.target.value))} disabled={!canEdit} />
          </div>
          <div className="mt-5">
            <FieldLabel htmlFor="id-city">Ville</FieldLabel>
            <BigInput id="id-city" value={city} onChange={(e) => setCity(e.target.value)} disabled={!canEdit} autoCapitalize="words" />
          </div>
        </div>

        <FieldLabel htmlFor="id-email">Email</FieldLabel>
        <BigInput id="id-email" type="email" inputMode="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!canEdit} />

        <FieldLabel htmlFor="id-company">Entreprise</FieldLabel>
        <BigInput id="id-company" value={company} onChange={(e) => setCompany(e.target.value)} disabled={!canEdit} />

        <FieldLabel htmlFor="id-country">Pays</FieldLabel>
        <CountryCombobox
          id="id-country"
          variant="country"
          disabled={!canEdit}
          value={isoFromCountryLabel(country) ?? null}
          onChange={(iso) => setCountry(countryLabelFr(iso))}
          className={`${BIG_FIELD} w-full`}
        />

        <FieldLabel htmlFor="id-source">Origine</FieldLabel>
        {canOrigin ? (
          <ClientSourcePicker id="id-source" value={sourceDraft ?? src?.id ?? null} onChange={setSourceDraft} controlClassName={BIG_FIELD} />
        ) : (
          <KVBox rows={[{ label: 'Origine', value: src ? src.label : 'Non renseignée' }]} />
        )}

        <KVBox
          className="mt-6"
          rows={[
            { label: 'Client depuis', value: format(new Date(client.createdAt), 'd MMM yyyy', { locale: fr }) },
            { label: 'Enregistré par', value: <ClientRegistration userId={client.id} /> },
          ]}
        />
      </div>
      {(canEdit || canOrigin) && (
        <Dock>
          <BigButton onClick={() => void save()} loading={busy}>Enregistrer</BigButton>
        </Dock>
      )}
    </div>
  );
}
