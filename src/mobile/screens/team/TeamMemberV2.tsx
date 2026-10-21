/**
 * Équipe › un membre — refonte v2 (maquettes 03/12, 10/18, 10/19, 10/20).
 * Le super admin seul (`canManageUsers`, gardes serveur sur chaque RPC).
 *
 * Appeler (noir) · WhatsApp · Mot de passe ; rôle, site, fiche commercial,
 * dernière connexion, numéros ; l'interrupteur « Accès actif » (pas sur sa
 * propre fiche), avec confirmation. Dans « … » : Modifier (nom, numéros,
 * site), Changer de rôle (écran 10/19), Changer de fiche commercial, Ses
 * chiffres et objectifs, Agrément CAD (commissionnaire).
 * RPC : team_update_member, team_set_member_profile, toggle_admin_status,
 * admin_reset_password, team_link_commercial, customs_broker_register.
 */
import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeftRight, BarChart3, KeyRound, Link2, MessageCircle, Pencil, Phone, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminAuth, type AppRole } from '@/contexts/AdminAuthContext';
import { useLinkCommercial, useSetMemberProfile, useTeamMembers, useUpdateTeamMember, type TeamMember } from '@/hooks/useTeam';
import { useResetAdminPassword, useToggleAdminStatus } from '@/hooks/useAdminManagement';
import { useClientSources } from '@/hooks/useClientSources';
import { useBrokerProfile, useRegisterBroker } from '@/hooks/useCustomsReview';
import { accessMessage, lastSeen, memberName, memberPhones, roleLabel, roleSpace } from '@/lib/team';
import { whatsappLink } from '@/lib/sales';
import { normalizePhone } from '@/lib/phone';
import { formatE164ForDisplay } from '@/components/form/PhoneNumberInput';
import { useClientPhonesEditor } from '@/components/clients/useClientPhonesEditor';
import {
  ActionCircles, ActionSheet, BigButton, BottomSheet, BoxSegmented, ConfirmSheet, Dock, EmptyLine, Initials, KVBox, MoreButton, ScreenLoader, ScreenTop, TEXT,
  useSheet, type CircleAction, type KV, type SheetAction,
} from '@/mobile/designKit';
import { BigInput, ChoiceRow, FieldLabel, SecretCard, SwitchBox, copyText } from '@/mobile/screens/clients/parts';
import { ROLE_ORDER, SiteChips, StaffPhones, TEAM_BASE, scopeAlone } from './teamParts';

export function TeamMemberV2() {
  const { hasPermission } = useAdminAuth();
  if (!hasPermission('canManageUsers')) return <Navigate to="/m" replace />;
  return <MemberPage />;
}

type Sheet = null | 'edit' | 'password' | 'status' | 'fiche' | 'broker';

function MemberPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { currentUser, hasPermission } = useAdminAuth();
  const members = useTeamMembers();
  const m = members.data?.find((x) => x.user_id === userId);
  const more = useSheet();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [view, setView] = useState<'main' | 'role'>('main');
  const toggle = useToggleAdminStatus();

  if (members.isLoading) return <ScreenLoader className="min-h-[100dvh]" />;
  if (!m) {
    return (
      <div className="min-h-[100dvh] bg-white dark:bg-[#1E1E1E]">
        <ScreenTop title="Membre" backTo={TEAM_BASE} />
        <EmptyLine action={members.isError ? { label: 'Réessayer', onClick: () => void members.refetch() } : undefined}>
          {members.isError ? 'La fiche n’a pas pu être chargée.' : 'Ce membre n’existe pas (ou plus).'}
        </EmptyLine>
      </div>
    );
  }
  if (view === 'role') return <RoleView m={m} onBack={() => setView('main')} />;

  const name = memberName(m);
  const self = m.user_id === currentUser?.id;
  const phones = memberPhones(m);
  const main = phones[0]?.phone_e164 ?? null;
  const e164 = main ? normalizePhone(main)?.e164 ?? null : null;
  const tel = e164 ?? main?.replace(/[^\d+]/g, '') ?? null;

  const circles: CircleAction[] = [
    { label: 'Appeler', icon: Phone, primary: true, disabled: !tel, onClick: () => { if (tel) window.location.href = `tel:${tel}`; } },
    { label: 'WhatsApp', icon: MessageCircle, disabled: !e164, onClick: () => { if (e164) window.open(whatsappLink(e164), '_blank', 'noopener'); } },
    { label: 'Mot de passe', icon: KeyRound, onClick: () => (self ? navigate('/m/more/password') : setSheet('password')) },
  ];

  const rows: KV[] = [
    { label: 'Rôle', value: roleLabel(m.role) },
    { label: 'Site', value: m.site?.label ?? 'Non renseigné' },
  ];
  if (m.role === 'commercial') rows.push({ label: 'Fiche commercial', value: m.source ? `${m.source.label}${m.source.is_active ? '' : ' · archivée'}` : 'Pas reliée', tone: m.source ? undefined : 'danger', onClick: () => setSheet('fiche') });
  rows.push({ label: 'Dernière connexion', value: lastSeen(m.last_sign_in_at) });
  rows.push({ label: 'Arrive sur', value: roleSpace(m.role) });
  phones.slice(1).forEach((p) => rows.push({ label: p.label || 'Autre numéro', value: formatE164ForDisplay(p.phone_e164), onClick: () => { window.location.href = `tel:${p.phone_e164.replace(/[^\d+]/g, '')}`; } }));
  if (m.created_at) rows.push({ label: 'Accès créé le', value: new Date(m.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) });

  const actions: SheetAction[] = [
    { label: 'Modifier', hint: 'nom, numéros, site', icon: Pencil, onClick: () => setSheet('edit') },
    { label: 'Changer de rôle', icon: ArrowLeftRight, hidden: self, onClick: () => setView('role') },
    { label: m.source ? 'Changer de fiche commercial' : 'Relier sa fiche commercial', icon: Link2, hidden: m.role !== 'commercial', onClick: () => setSheet('fiche') },
    { label: 'Ses chiffres et objectifs', icon: BarChart3, hidden: m.role !== 'commercial' || !m.source || !hasPermission('canManageSales'), onClick: () => navigate(`${TEAM_BASE}/ventes/${m.source!.id}`) },
    { label: 'Agrément CAD', hint: 'commissionnaire', icon: Shield, hidden: m.role !== 'customs_broker', onClick: () => setSheet('broker') },
  ];

  return (
    <div className="min-h-[100dvh] bg-white pb-8 dark:bg-[#1E1E1E]">
      <ScreenTop title="Membre" backTo={TEAM_BASE} right={<MoreButton onClick={more.show} />} />
      <div className="flex flex-col items-center px-5 pt-7 text-center">
        <Initials name={name} size={92} />
        <h2 className={cn('mt-3.5 text-[22px] font-semibold leading-tight', TEXT.strong)}>{name}</h2>
        <p className={cn('mt-1 break-all text-[16px]', TEXT.muted)}>{m.email ?? '—'}</p>
      </div>
      <ActionCircles actions={circles} />
      <div className="space-y-4 px-5 pt-5">
        <KVBox rows={rows} />
        {!self && (
          <SwitchBox label="Accès actif" on={!m.is_disabled} onChange={() => setSheet('status')} disabled={toggle.isPending} />
        )}
      </div>

      <ActionSheet open={more.open} onClose={more.hide} title={name} actions={actions} />
      {sheet === 'edit' && <EditSheet m={m} onClose={() => setSheet(null)} />}
      {sheet === 'password' && <PasswordSheet m={m} onClose={() => setSheet(null)} />}
      {sheet === 'fiche' && <FicheSheet m={m} onClose={() => setSheet(null)} />}
      {sheet === 'broker' && <BrokerSheet m={m} onClose={() => setSheet(null)} />}
      <ConfirmSheet
        open={sheet === 'status'}
        onClose={() => setSheet(null)}
        title={m.is_disabled ? `Réactiver ${name} ?` : `Couper l’accès de ${name} ?`}
        subtitle={m.is_disabled ? 'Même rôle, même mot de passe' : 'Bloqué tout de suite, même connecté · réactivable'}
        confirmLabel={m.is_disabled ? 'Réactiver' : 'Couper l’accès'}
        danger={!m.is_disabled}
        loading={toggle.isPending}
        onConfirm={() => toggle.mutate({ userId: m.user_id, disabled: !m.is_disabled }, { onSuccess: () => setSheet(null) })}
      />
    </div>
  );
}

/* ── Changer de rôle (10/19) ─────────────────────────────────────────── */

function RoleView({ m, onBack }: { m: TeamMember; onBack: () => void }) {
  const update = useUpdateTeamMember();
  const [role, setRole] = useState<AppRole>(m.role);
  const [confirm, setConfirm] = useState(false);
  const name = memberName(m);
  const changed = role !== m.role;
  const consequences: KV[] = [];
  if (changed && m.role === 'commercial') {
    consequences.push({ label: 'Sa fiche commercial', value: 'Détachée, gardée' });
    consequences.push({ label: 'Ses prospects', value: 'Restent sur la fiche' });
  }
  if (changed && role === 'commercial') consequences.push({ label: 'Sa fiche commercial', value: 'À relier ensuite' });
  if (changed) consequences.push({ label: 'Arrive sur', value: roleSpace(role) });

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-[#1E1E1E]">
      <ScreenTop title="Changer de rôle" onBack={onBack} />
      <div className="px-5 pt-5">
        <div className={cn('flex items-center gap-3 rounded-lg border px-3.5 py-3', 'border-[#D9D9D9] dark:border-[#444444]')}>
          <Initials name={name} />
          <span className="min-w-0">
            <span className={cn('block truncate text-[17px] font-semibold', TEXT.strong)}>{name}</span>
            <span className={cn('block truncate text-[15px]', TEXT.muted)}>{[roleLabel(m.role), m.site?.label].filter(Boolean).join(' · ')}</span>
          </span>
        </div>
        <div role="radiogroup" aria-label="Rôle" className="mt-2">
          {[m.role, ...ROLE_ORDER.filter((r) => r !== m.role)].map((r) => (
            <ChoiceRow key={r} on={role === r} onClick={() => setRole(r)} title={roleLabel(r)} subtitle={r === m.role ? 'Rôle actuel' : scopeAlone(r)} />
          ))}
        </div>
        {consequences.length > 0 && <KVBox className="mt-4" rows={consequences} />}
      </div>
      <Dock>
        <BigButton disabled={!changed} onClick={() => setConfirm(true)}>{changed ? `Passer ${roleLabel(role).toLowerCase()}` : 'Choisir un rôle'}</BigButton>
      </Dock>
      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`${name} devient ${roleLabel(role).toLowerCase()} ?`}
        rows={[{ label: 'Rôle', before: roleLabel(m.role), value: roleLabel(role) }, ...consequences.filter((c) => c.label !== 'Rôle')]}
        confirmLabel="Changer le rôle"
        loading={update.isPending}
        onConfirm={() => update.mutate({ userId: m.user_id, role }, { onSuccess: () => { setConfirm(false); onBack(); } })}
      />
    </div>
  );
}

/* ── Modifier : nom, numéros, site ───────────────────────────────────── */

function EditSheet({ m, onClose }: { m: TeamMember; onClose: () => void }) {
  const update = useUpdateTeamMember();
  const profile = useSetMemberProfile();
  const phones = useClientPhonesEditor({ primaryOptional: true });
  const [ready, setReady] = useState(false);
  if (!ready) {
    phones.reset((m.phones ?? []).map((p) => ({ phoneE164: p.phone_e164, label: p.label })), m.phone);
    setReady(true);
  }
  const [first, setFirst] = useState(m.first_name ?? '');
  const [last, setLast] = useState(m.last_name ?? '');
  const [siteId, setSiteId] = useState<string | null>(m.site?.id ?? null);
  const busy = update.isPending || profile.isPending;
  const phonesBad = phones.primaryInvalid || phones.extrasInvalid;

  const save = async () => {
    if (!first.trim() || !last.trim()) { toast.error('Prénom et nom sont requis.'); return; }
    if (phonesBad) { toast.error('Un numéro est incomplet : complétez-le ou effacez-le.'); return; }
    const nameChanged = first.trim() !== (m.first_name ?? '').trim() || last.trim() !== (m.last_name ?? '').trim();
    const siteChanged = siteId !== (m.site?.id ?? null);
    try {
      if (phones.changed || siteChanged) {
        await profile.mutateAsync({ userId: m.user_id, phones: phones.changed ? phones.toInputs() : undefined, siteId: siteChanged ? siteId : undefined });
      }
      if (nameChanged) await update.mutateAsync({ userId: m.user_id, firstName: first.trim(), lastName: last.trim() });
      else if (phones.changed || siteChanged) toast.success('Membre mis à jour');
      onClose();
    } catch {
      /* l'erreur est affichée par le hook */
    }
  };

  return (
    <BottomSheet open onClose={busy ? () => undefined : onClose}>
      <h3 className={cn('text-[22px] font-semibold leading-tight', TEXT.strong)}>Modifier</h3>
      <FieldLabel className="mt-4">Nom</FieldLabel>
      <div className="grid grid-cols-2 gap-2.5">
        <BigInput aria-label="Prénom" value={first} onChange={(e) => setFirst(e.target.value)} maxLength={80} />
        <BigInput aria-label="Nom" value={last} onChange={(e) => setLast(e.target.value)} maxLength={80} />
      </div>
      <FieldLabel>Téléphones</FieldLabel>
      <StaffPhones editor={phones} idPrefix="team-edit-phone" />
      <FieldLabel>Site</FieldLabel>
      <SiteChips value={siteId} onChange={setSiteId} />
      <BigButton className="mt-6" onClick={() => void save()} loading={busy}>Enregistrer</BigButton>
    </BottomSheet>
  );
}

/* ── Nouveau mot de passe ────────────────────────────────────────────── */

function PasswordSheet({ m, onClose }: { m: TeamMember; onClose: () => void }) {
  const reset = useResetAdminPassword();
  const [secret, setSecret] = useState<string | null>(null);
  const name = memberName(m);
  const message = secret ? accessMessage({ name, email: m.email ?? '', password: secret, role: m.role }) : '';
  const share = async () => {
    try { await navigator.share({ text: message }); } catch { /* partage annulé */ }
  };
  if (!secret) {
    return (
      <ConfirmSheet
        open
        onClose={onClose}
        title={`Nouveau mot de passe pour ${m.first_name || name} ?`}
        subtitle="L’actuel ne marchera plus · montré une seule fois"
        confirmLabel="Générer"
        loading={reset.isPending}
        onConfirm={() => reset.mutate(m.user_id, { onSuccess: (r) => r.tempPassword && setSecret(r.tempPassword) })}
      />
    );
  }
  return (
    <BottomSheet open onClose={onClose}>
      <h3 className={cn('text-[22px] font-semibold leading-tight', TEXT.strong)}>Mot de passe provisoire</h3>
      <p className={cn('mt-1 text-[16px]', TEXT.muted)}>{name}</p>
      <SecretCard secret={secret} copyLabel="Copier le message" copyValue={message} rows={[{ label: 'Email', value: m.email ?? '—' }]} />
      <div className="mt-5 flex flex-col gap-2.5">
        {'share' in navigator ? (
          <BigButton onClick={() => void share()}>Partager le message</BigButton>
        ) : (
          <BigButton onClick={() => void copyText(message, 'Message copié')}>Copier le message</BigButton>
        )}
        <BigButton variant="soft" onClick={onClose}>Terminé</BigButton>
      </div>
    </BottomSheet>
  );
}

/* ── Sa fiche commercial ─────────────────────────────────────────────── */

function FicheSheet({ m, onClose }: { m: TeamMember; onClose: () => void }) {
  const link = useLinkCommercial();
  const sources = useClientSources(false);
  const free = useMemo(() => (sources.data ?? []).filter((s) => s.kind === 'commercial' && (!s.staff_user_id || s.staff_user_id === m.user_id)), [sources.data, m.user_id]);
  const [picked, setPicked] = useState<string | null>(m.source?.id ?? null);
  return (
    <BottomSheet open onClose={link.isPending ? () => undefined : onClose}>
      <h3 className={cn('text-[22px] font-semibold leading-tight', TEXT.strong)}>Sa fiche commercial</h3>
      <p className={cn('mt-1 text-[16px]', TEXT.muted)}>Celle sous laquelle il apporte ses clients</p>
      {sources.isLoading ? (
        <div className="mt-4 h-24 animate-pulse rounded-lg bg-[#F5F5F5] dark:bg-[#383838]" />
      ) : (
        <div role="radiogroup" className="mt-2">
          {free.map((s) => (
            <ChoiceRow key={s.id} radioRight on={picked === s.id} onClick={() => setPicked(s.id)} leading={<Initials name={s.label} />} title={s.label} subtitle={s.id === m.source?.id ? 'Fiche actuelle' : s.phone ?? undefined} />
          ))}
          {free.length === 0 && <p className={cn('py-3 text-[16px]', TEXT.muted)}>Aucune fiche libre.</p>}
        </div>
      )}
      <div className="mt-5 flex flex-col gap-2.5">
        <BigButton disabled={!picked || picked === m.source?.id} loading={link.isPending} onClick={() => picked && link.mutate({ userId: m.user_id, sourceId: picked }, { onSuccess: onClose })}>Relier</BigButton>
        {!m.source && (
          <BigButton variant="soft" disabled={link.isPending} onClick={() => link.mutate({ userId: m.user_id }, { onSuccess: onClose })}>Créer sa fiche à son nom</BigButton>
        )}
      </div>
    </BottomSheet>
  );
}

/* ── Agrément du commissionnaire (10/20) ─────────────────────────────── */

function BrokerSheet({ m, onClose }: { m: TeamMember; onClose: () => void }) {
  const profile = useBrokerProfile(m.user_id);
  const register = useRegisterBroker();
  const p = profile.data;
  const [loaded, setLoaded] = useState(false);
  const [company, setCompany] = useState('');
  const [license, setLicense] = useState('');
  const [rep, setRep] = useState('');
  const [active, setActive] = useState<'yes' | 'no'>('yes');
  if (!loaded && !profile.isLoading) {
    setCompany(p?.company ?? '');
    setLicense(p?.license_no ?? '');
    setRep(p?.representative_no ?? '');
    setActive(p?.active === false ? 'no' : 'yes');
    setLoaded(true);
  }
  const ok = company.trim().length >= 2 && license.trim().length >= 2;
  const save = () => {
    if (!ok) return;
    register.mutate(
      { userId: m.user_id, company: company.trim(), licenseNo: license.trim(), representativeNo: rep.trim() || null, active: active === 'yes' },
      { onSuccess: () => { toast.success('Agrément enregistré'); onClose(); }, onError: (e) => toast.error((e as Error).message) },
    );
  };
  return (
    <BottomSheet open onClose={register.isPending ? () => undefined : onClose}>
      <h3 className={cn('text-[22px] font-semibold leading-tight', TEXT.strong)}>Agrément CAD</h3>
      <p className={cn('mt-1 text-[16px]', TEXT.muted)}>Exigé pour signer un classement</p>
      <FieldLabel className="mt-4" htmlFor="br-company">Société</FieldLabel>
      <BigInput id="br-company" value={company} onChange={(e) => setCompany(e.target.value)} maxLength={160} />
      <FieldLabel htmlFor="br-license">N° d’agrément</FieldLabel>
      <BigInput id="br-license" value={license} onChange={(e) => setLicense(e.target.value)} maxLength={60} />
      <FieldLabel htmlFor="br-rep">Représentant · facultatif</FieldLabel>
      <BigInput id="br-rep" value={rep} onChange={(e) => setRep(e.target.value)} maxLength={60} />
      <BoxSegmented<'yes' | 'no'> className="mt-4" ariaLabel="Peut signer" options={[{ value: 'yes', label: 'Actif' }, { value: 'no', label: 'Suspendu' }]} value={active} onChange={setActive} />
      <BigButton className="mt-5" disabled={!ok} loading={register.isPending} onClick={save}>Enregistrer</BigButton>
    </BottomSheet>
  );
}
