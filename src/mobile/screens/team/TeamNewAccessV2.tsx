/**
 * Équipe › Nouvel accès — refonte v2 (maquettes 10/15, 10/16, 10/17).
 * Le super admin seul : `hasPermission('canManageUsers')` ici, et
 * `team_create_member` le revérifie.
 *
 * 1/2 le rôle (une ligne chacun : son équipe et son périmètre) ;
 * 2/2 la personne : nom, email de connexion, téléphone(s), site (proposé
 * d'après le rôle, « + Nouveau site »), et pour un commercial sa fiche
 * (nouvelle à son nom, ou une fiche libre reprise) ;
 * puis l'accès créé : mot de passe provisoire, « Copier le message »,
 * « Partager le message », « Voir sa fiche ». Même logique que l'écran
 * d'avant (useCreateTeamMember, profileFailedMessage).
 */
import { useMemo, useState, type ReactNode } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ADMIN_ROLE_LABELS, useAdminAuth, type AppRole } from '@/contexts/AdminAuthContext';
import { useCreateTeamMember, useTeamSites, type CreatedMember } from '@/hooks/useTeam';
import { useClientSources } from '@/hooks/useClientSources';
import { useClientPhonesEditor } from '@/components/clients/useClientPhonesEditor';
import { accessMessage, defaultSiteFor, profileFailedMessage, roleLabel, roleSpace } from '@/lib/team';
import { BigButton, BoxSegmented, Dock, IconCircle, Initials, ScreenTop, TEXT, Tag, FOCUS_RING } from '@/mobile/designKit';
import { BigInput, ChoiceRow, FieldLabel, SecretCard, copyText } from '@/mobile/screens/clients/parts';
import { ROLE_ORDER, ROLE_PLACE, ROLE_SCOPE, SiteChips, StaffPhones, TEAM_BASE } from './teamParts';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const isRole = (v: string | null): v is AppRole => !!v && v in ADMIN_ROLE_LABELS;

type Created = CreatedMember & { name: string; role: AppRole; siteLabel: string | null; fiche: string | null; sent: { phones: boolean; site: boolean } };

export function TeamNewAccessV2() {
  const { hasPermission } = useAdminAuth();
  if (!hasPermission('canManageUsers')) return <Navigate to="/m" replace />;
  return <Flow />;
}

function Flow() {
  const [params] = useSearchParams();
  const preset = params.get('role');
  const [role, setRole] = useState<AppRole | null>(isRole(preset) ? preset : null);
  const [step, setStep] = useState<1 | 2>(isRole(preset) ? 2 : 1);
  const [created, setCreated] = useState<Created | null>(null);

  if (created) return <Done c={created} onAnother={() => { setCreated(null); setRole(null); setStep(1); }} />;

  if (step === 1 || !role) {
    return (
      <div className="min-h-[100dvh] bg-white dark:bg-[#1E1E1E]">
        <ScreenTop title="Nouvel accès" step="1/2" backTo={TEAM_BASE} />
        <div role="radiogroup" aria-label="Rôle" className="px-5 pt-1">
          {ROLE_ORDER.map((r) => (
            <ChoiceRow key={r} on={role === r} onClick={() => setRole(r)} title={roleLabel(r)} subtitle={`${ROLE_PLACE[r]} · ${ROLE_SCOPE[r]}`} />
          ))}
        </div>
        <Dock>
          <BigButton disabled={!role} onClick={() => setStep(2)}>Continuer</BigButton>
        </Dock>
      </div>
    );
  }
  return <Person role={role} onChangeRole={() => setStep(1)} onCreated={setCreated} />;
}

function Person({ role, onChangeRole, onCreated }: { role: AppRole; onChangeRole: () => void; onCreated: (c: Created) => void }) {
  const create = useCreateTeamMember();
  const sources = useClientSources(false);
  const sites = useTeamSites();
  const phones = useClientPhonesEditor({ primaryOptional: true });
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [email, setEmail] = useState('');
  const [siteChoice, setSiteChoice] = useState<string | null | undefined>(undefined);
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  const isCommercial = role === 'commercial';
  const free = useMemo(() => (sources.data ?? []).filter((s) => s.kind === 'commercial' && !s.staff_user_id), [sources.data]);
  const fullName = `${first.trim()} ${last.trim()}`.trim();
  const sameName = isCommercial && mode === 'new' ? free.find((s) => s.label.trim().toLowerCase() === fullName.toLowerCase()) : undefined;
  const siteId = siteChoice !== undefined ? siteChoice : (defaultSiteFor(role, sites.data)?.id ?? null);
  const errors = {
    name: !first.trim() || !last.trim(),
    email: !EMAIL.test(email.trim()),
    phones: phones.primaryMissing || phones.primaryInvalid || phones.extrasInvalid,
    source: isCommercial && mode === 'existing' && !sourceId,
  };
  const valid = !Object.values(errors).some(Boolean);

  const submit = () => {
    setTried(true);
    if (!valid || create.isPending) return;
    const list = phones.toInputs();
    const site = (sites.data ?? []).find((s) => s.id === siteId) ?? null;
    create.mutate(
      { email, firstName: first, lastName: last, role, phones: list, siteId, sourceId: isCommercial && mode === 'existing' ? sourceId : null },
      {
        onSuccess: (r) => {
          const fiche = isCommercial && r.sourceId ? (mode === 'existing' ? free.find((f) => f.id === r.sourceId)?.label ?? null : fullName.slice(0, 80)) : null;
          onCreated({ ...r, name: fullName, role, siteLabel: site?.label ?? null, fiche, sent: { phones: list.length > 0, site: !!siteId } });
        },
      },
    );
  };

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-[#1E1E1E]">
      <ScreenTop title="Nouvel accès" step="2/2" onBack={onChangeRole} />
      <div className="px-5 pb-4 pt-5">
        <div className="flex items-center gap-3 rounded-lg border border-[#D9D9D9] px-3.5 py-3 dark:border-[#444444]">
          <IconCircle icon={UserRound} />
          <span className="min-w-0 flex-1">
            <span className={cn('block truncate text-[17px] font-semibold', TEXT.strong)}>{roleLabel(role)}</span>
            <span className={cn('block truncate text-[15px]', TEXT.muted)}>Arrive sur {roleSpace(role)}</span>
          </span>
          <button type="button" onClick={onChangeRole} className={cn('h-11 shrink-0 px-1 text-[16px] font-semibold underline underline-offset-[3px]', TEXT.strong, FOCUS_RING)}>Changer</button>
        </div>

        <FieldLabel>Nom</FieldLabel>
        <div className="grid grid-cols-2 gap-2.5">
          <BigInput aria-label="Prénom" placeholder="Prénom" value={first} onChange={(e) => setFirst(e.target.value)} maxLength={80} autoComplete="off" />
          <BigInput aria-label="Nom" placeholder="Nom" value={last} onChange={(e) => setLast(e.target.value)} maxLength={80} autoComplete="off" />
        </div>
        {tried && errors.name && <Err>Prénom et nom sont requis.</Err>}

        <FieldLabel htmlFor="na-email">Email · pour se connecter</FieldLabel>
        <BigInput id="na-email" type="email" inputMode="email" autoCapitalize="none" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom@bonzinilabs.com" />
        {tried && errors.email && <Err>Adresse email invalide.</Err>}

        <FieldLabel>Téléphone</FieldLabel>
        <StaffPhones editor={phones} idPrefix="na-phone" />
        {tried && errors.phones && <Err>Un numéro est incomplet : complétez-le ou effacez-le.</Err>}

        <FieldLabel>Site</FieldLabel>
        <SiteChips value={siteId} onChange={setSiteChoice} />

        {isCommercial && (
          <>
            <FieldLabel>Sa fiche commercial</FieldLabel>
            <BoxSegmented<'new' | 'existing'>
              ariaLabel="Sa fiche commercial"
              options={[{ value: 'new', label: 'Nouvelle' }, { value: 'existing', label: `Reprendre${free.length ? ` (${free.length})` : ''}` }]}
              value={mode}
              onChange={(v) => (v === 'existing' && free.length === 0 ? undefined : setMode(v))}
            />
            {mode === 'existing' && (
              <div role="radiogroup" className="mt-1">
                {free.map((s) => <ChoiceRow key={s.id} radioRight on={sourceId === s.id} onClick={() => setSourceId(s.id)} leading={<Initials name={s.label} />} title={s.label} subtitle={s.phone ?? undefined} />)}
              </div>
            )}
            {tried && errors.source && <Err>Choisissez sa fiche.</Err>}
            {sameName && <Tag tone="pending" className="mt-3 whitespace-normal leading-snug">Une fiche « {sameName.label} » existe : reprenez-la</Tag>}
          </>
        )}
      </div>
      <Dock>
        <BigButton onClick={submit} loading={create.isPending}>Créer l’accès</BigButton>
      </Dock>
    </div>
  );
}

function Err({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-[15px] font-semibold text-[#C00F0C] dark:text-[#FCB3AD]">{children}</p>;
}

function Done({ c, onAnother }: { c: Created; onAnother: () => void }) {
  const navigate = useNavigate();
  const message = accessMessage({ name: c.name, email: c.email, password: c.tempPassword, role: c.role });
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;
  const share = async () => {
    try { await navigator.share({ text: message }); } catch { /* partage annulé */ }
  };
  return (
    <div className="flex min-h-[100dvh] flex-col bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-[calc(env(safe-area-inset-top)+48px)] dark:bg-[#1E1E1E]">
      <div className="text-center">
        <div className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#CFF7D3] text-[#02542D]">
          <Check className="h-9 w-9" strokeWidth={2.5} />
        </div>
        <h2 className={cn('mt-5 text-[26px] font-semibold leading-tight', TEXT.strong)}>Accès créé</h2>
        <p className={cn('mt-2 text-[16px]', TEXT.muted)}>{[c.name, roleLabel(c.role), c.profileFailed ? null : c.siteLabel].filter(Boolean).join(' · ')}</p>
      </div>
      <SecretCard secret={c.tempPassword} copyLabel="Copier le message" copyValue={message} rows={[{ label: 'Email', value: c.email }, { label: 'Arrive sur', value: roleSpace(c.role) }, ...(c.fiche ? [{ label: 'Fiche commercial', value: c.fiche }] : [])]} />
      {c.profileFailed && <Tag tone="danger" className="mt-3 whitespace-normal leading-snug">{profileFailedMessage(c.sent)}</Tag>}
      <div className="mt-auto flex flex-col gap-2.5 pt-8">
        {canShare ? (
          <BigButton onClick={() => void share()}>Partager le message</BigButton>
        ) : (
          <BigButton onClick={() => void copyText(message, 'Message copié')}>Copier le message</BigButton>
        )}
        <BigButton variant="soft" onClick={() => navigate(`${TEAM_BASE}/${c.userId}`, { replace: true })}>Voir sa fiche</BigButton>
        <button type="button" onClick={onAnother} className={cn('h-11 text-[16px] font-semibold underline underline-offset-[3px]', TEXT.strong, FOCUS_RING)}>Créer un autre accès</button>
      </div>
    </div>
  );
}
