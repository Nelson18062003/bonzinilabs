// ============================================================
// Mes équipes › un membre — qui il est, où il arrive, quand il s'est
// connecté ; le modifier (nom, téléphone, rôle), le désactiver ou le
// réactiver, lui redonner un mot de passe provisoire. Pour un commercial :
// sa fiche (celle que la réception choisit comme origine d'un client) et
// ses chiffres du mois. Pour un commissionnaire : son agrément.
// Toutes les écritures sont des RPC super admin, journalisées.
// ============================================================
import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, KeyRound, MapPin, Pencil, Power, Repeat, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ADMIN_ROLE_LABELS, useAdminAuth, type AppRole } from '@/contexts/AdminAuthContext';
import { useLinkCommercial, useTeamMembers, useUpdateTeamMember, type TeamMember } from '@/hooks/useTeam';
import { useResetAdminPassword, useToggleAdminStatus } from '@/hooks/useAdminManagement';
import { useClientSources } from '@/hooks/useClientSources';
import { useCommercialDashboard } from '@/hooks/useSales';
import { ROLE_DESCRIPTION, TEAMS, lastSeen, memberName, roleSpace, teamOf } from '@/lib/team';
import { currentMonth, fmtCbm, fmtCount, fmtKg, fmtXaf, monthLabel } from '@/lib/sales';
import { BrokerLicenseCard } from '@/mobile/screens/admins/BrokerLicenseCard';
import { BTN_DANGER, BTN_PRIMARY, BTN_SOFT, CARD, Field, Initials, Modal, PasswordReveal, RolePill, Skeleton } from './TeamBits';
import { TEAM_BASE } from './TeamScreen';

type Dialog = null | 'edit' | 'role' | 'status' | 'password' | 'fiche';

export function TeamMemberScreen() {
  const { hasPermission } = useAdminAuth();
  if (!hasPermission('canManageUsers')) return <Navigate to="/m" replace />;
  return <MemberPage />;
}

function MemberPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAdminAuth();
  const members = useTeamMembers();
  const m = members.data?.find((x) => x.user_id === userId);
  const [dialog, setDialog] = useState<Dialog>(null);
  const isSelf = !!m && m.user_id === currentUser?.id;

  const back = (
    <button type="button" onClick={() => navigate(TEAM_BASE)} className="inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-3.5 w-3.5" /> Mes équipes
    </button>
  );

  if (members.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-0">
        {back}
        <div className={CARD}>
          <Skeleton rows={3} />
        </div>
      </div>
    );
  }
  if (members.isError || !m) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-0">
        {back}
        <div className={cn(CARD, 'p-8 text-center text-[14px]')}>
          {members.isError ? (
            <>
              La fiche n’a pas pu être chargée.{' '}
              <button type="button" onClick={() => void members.refetch()} className="font-semibold underline">
                Réessayer
              </button>
            </>
          ) : (
            'Ce membre n’existe pas (ou plus).'
          )}
        </div>
      </div>
    );
  }

  const name = memberName(m);
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-0">
      {back}

      <header className="flex items-start gap-4">
        <Initials name={name} disabled={m.is_disabled} className="h-14 w-14 text-[18px]" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[24px] font-bold tracking-tight">{name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[13.5px] text-muted-foreground">
            <RolePill role={m.role} />
            <span>{teamOf(m.role).label}</span>
            {m.is_disabled ? (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[12px] font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-300">Accès désactivé</span>
            ) : (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[12px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">Actif</span>
            )}
            {isSelf && <span className="text-[12.5px]">· c’est vous</span>}
          </div>
        </div>
      </header>

      <section className={cn(CARD, 'divide-y divide-border/60')}>
        <InfoRow label="Email" value={m.email ?? '—'} />
        <InfoRow label="Téléphone" value={m.phone ?? '—'} />
        <InfoRow label="Arrive sur" value={<span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {roleSpace(m.role)}</span>} />
        <InfoRow label="Dernière connexion" value={lastSeen(m.last_sign_in_at)} />
        <InfoRow label="Accès créé le" value={m.created_at ? new Date(m.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'} />
        <div className="px-5 py-3.5 text-[13px] leading-relaxed text-muted-foreground">{ROLE_DESCRIPTION[m.role]}</div>
      </section>

      <section className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setDialog('edit')} className={BTN_SOFT}>
          <Pencil className="h-4 w-4" /> Modifier
        </button>
        {!isSelf && (
          <button type="button" onClick={() => setDialog('role')} className={BTN_SOFT}>
            <Repeat className="h-4 w-4" /> Changer de rôle
          </button>
        )}
        {isSelf ? (
          <button type="button" onClick={() => navigate('/m/more/password')} className={BTN_SOFT}>
            <KeyRound className="h-4 w-4" /> Changer mon mot de passe
          </button>
        ) : (
          <button type="button" onClick={() => setDialog('password')} className={BTN_SOFT}>
            <KeyRound className="h-4 w-4" /> Nouveau mot de passe
          </button>
        )}
        {!isSelf && (
          <button type="button" onClick={() => setDialog('status')} className={cn(BTN_SOFT, !m.is_disabled && 'text-red-700 dark:text-red-400')}>
            <Power className="h-4 w-4" /> {m.is_disabled ? 'Réactiver l’accès' : 'Désactiver l’accès'}
          </button>
        )}
      </section>

      {m.role === 'commercial' && <CommercialSection m={m} onChangeFiche={() => setDialog('fiche')} />}
      {m.role === 'customs_broker' && <BrokerLicenseCard userId={m.user_id} canEdit />}

      {dialog === 'edit' && <EditDialog m={m} onClose={() => setDialog(null)} />}
      {dialog === 'role' && <RoleDialog m={m} onClose={() => setDialog(null)} />}
      {dialog === 'status' && <StatusDialog m={m} onClose={() => setDialog(null)} />}
      {dialog === 'password' && <PasswordDialog m={m} onClose={() => setDialog(null)} />}
      {dialog === 'fiche' && <FicheDialog m={m} onClose={() => setDialog(null)} />}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5 text-[14px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right font-medium">{value}</span>
    </div>
  );
}

/* ── Le commercial : sa fiche et son mois ──────────────────────────────── */

function CommercialSection({ m, onChangeFiche }: { m: TeamMember; onChangeFiche: () => void }) {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const link = useLinkCommercial();
  const month = currentMonth();
  const canSales = hasPermission('canManageSales');
  const dash = useCommercialDashboard(month, m.source?.id ?? null, !!m.source && canSales);

  if (!m.source) {
    return (
      <section className={cn(CARD, 'space-y-3 p-5')}>
        <h2 className="text-[16px] font-semibold">Sa fiche commercial</h2>
        <p className="text-[13.5px] leading-relaxed text-amber-800 dark:text-amber-300">
          Pas encore reliée : tant qu’elle ne l’est pas, il ne voit ni prospects ni clients, et la réception ne peut pas lui attribuer de client.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => link.mutate({ userId: m.user_id })} disabled={link.isPending} className={BTN_PRIMARY}>
            Créer sa fiche à son nom
          </button>
          <button type="button" onClick={onChangeFiche} className={BTN_SOFT}>
            Reprendre une fiche existante
          </button>
        </div>
      </section>
    );
  }

  const d = dash.data?.metrics;
  return (
    <section className={cn(CARD, 'space-y-4 p-5')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-semibold">Sa fiche commercial</h2>
          <p className="text-[13.5px] text-muted-foreground">
            « {m.source.label} »{m.source.phone && ` · ${m.source.phone}`}
            {!m.source.is_active && ' · archivée'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onChangeFiche} className={BTN_SOFT}>
            Changer de fiche
          </button>
          {canSales && (
            <button type="button" onClick={() => navigate(`${TEAM_BASE}/ventes/${m.source!.id}`)} className={BTN_PRIMARY}>
              <TrendingUp className="h-4 w-4" /> Ses chiffres et objectifs
            </button>
          )}
        </div>
      </div>
      {canSales && (
        <div>
          <div className="mb-2 text-[12.5px] font-medium text-muted-foreground">En {monthLabel(month)}</div>
          {dash.isLoading ? (
            <div className="h-16 animate-pulse rounded-xl bg-muted" />
          ) : dash.isError || !d ? (
            <p className="text-[13px] text-muted-foreground">Chiffres indisponibles pour l’instant.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Mini label="Clients" value={fmtCount(d.clients)} hint={d.new_clients ? `+${d.new_clients} ce mois` : undefined} />
              <Mini label="Paiements" value={fmtXaf(d.payments_xaf)} />
              <Mini label="Fret avion" value={fmtKg(d.air_kg)} hint={`${d.air_parcels} colis`} />
              <Mini label="Fret bateau" value={fmtCbm(d.sea_cbm)} hint={`${d.sea_parcels} colis`} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Mini({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-muted/50 p-3">
      <div className="text-[12px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[16px] font-bold tabular-nums">{value}</div>
      {hint && <div className="text-[11.5px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

/* ── Fenêtres ──────────────────────────────────────────────────────────── */

function EditDialog({ m, onClose }: { m: TeamMember; onClose: () => void }) {
  const update = useUpdateTeamMember();
  const [firstName, setFirstName] = useState(m.first_name ?? '');
  const [lastName, setLastName] = useState(m.last_name ?? '');
  const [phone, setPhone] = useState(m.phone ?? '');
  const ok = firstName.trim() && lastName.trim();
  return (
    <Modal
      title="Modifier"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_SOFT}>
            Annuler
          </button>
          <button
            type="button"
            disabled={!ok || update.isPending}
            onClick={() => update.mutate({ userId: m.user_id, firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim() }, { onSuccess: onClose })}
            className={BTN_PRIMARY}
          >
            {update.isPending ? '…' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Prénom" value={firstName} onChange={setFirstName} maxLength={80} autoFocus />
        <Field label="Nom" value={lastName} onChange={setLastName} maxLength={80} />
      </div>
      <Field label="Téléphone" type="tel" inputMode="tel" value={phone} onChange={setPhone} placeholder="+237 6…" maxLength={32} hint="Laissez vide pour l’effacer." />
    </Modal>
  );
}

function RoleDialog({ m, onClose }: { m: TeamMember; onClose: () => void }) {
  const update = useUpdateTeamMember();
  const [role, setRole] = useState<AppRole>(m.role);
  const changed = role !== m.role;
  return (
    <Modal
      title={`Changer le rôle de ${memberName(m)}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_SOFT}>
            Annuler
          </button>
          <button type="button" disabled={!changed || update.isPending} onClick={() => update.mutate({ userId: m.user_id, role }, { onSuccess: onClose })} className={BTN_PRIMARY}>
            {update.isPending ? '…' : 'Changer le rôle'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {TEAMS.map((t) => (
          <div key={t.key}>
            <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">{t.label}</div>
            <div className="space-y-1.5">
              {t.roles.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={cn('flex w-full items-start gap-3 rounded-xl px-3.5 py-2.5 text-left ring-1', role === r ? 'ring-2 ring-primary' : 'ring-black/10 hover:bg-accent dark:ring-white/15')}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold">
                      {ADMIN_ROLE_LABELS[r]}
                      {r === m.role && <span className="ml-1.5 text-[12px] font-medium text-muted-foreground">(actuel)</span>}
                    </span>
                    <span className="block text-[12.5px] leading-snug text-muted-foreground">{ROLE_DESCRIPTION[r]}</span>
                  </span>
                  {role === r && <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {changed && m.role === 'commercial' && (
        <p className="rounded-xl bg-amber-50 p-3 text-[13px] text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          Sa fiche commercial sera détachée de son compte ; elle garde ses clients et ses prospects.
        </p>
      )}
      {changed && role === 'commercial' && (
        <p className="rounded-xl bg-muted/60 p-3 text-[13px] text-muted-foreground">Ensuite, reliez-le à sa fiche commercial depuis cette page.</p>
      )}
    </Modal>
  );
}

function StatusDialog({ m, onClose }: { m: TeamMember; onClose: () => void }) {
  const toggle = useToggleAdminStatus();
  const disabling = !m.is_disabled;
  return (
    <Modal
      title={disabling ? `Désactiver l’accès de ${memberName(m)} ?` : `Réactiver l’accès de ${memberName(m)} ?`}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_SOFT}>
            Annuler
          </button>
          <button
            type="button"
            disabled={toggle.isPending}
            onClick={() => toggle.mutate({ userId: m.user_id, disabled: disabling }, { onSuccess: onClose })}
            className={disabling ? BTN_DANGER : BTN_PRIMARY}
          >
            {toggle.isPending ? '…' : disabling ? 'Désactiver' : 'Réactiver'}
          </button>
        </>
      }
    >
      <p className="text-[14px] leading-relaxed text-muted-foreground">
        {disabling
          ? 'Il ne pourra plus rien faire sur la plateforme, même si sa session est encore ouverte. Son historique reste intact et vous pourrez le réactiver.'
          : 'Il retrouve son accès avec le même rôle et le même mot de passe.'}
      </p>
    </Modal>
  );
}

function PasswordDialog({ m, onClose }: { m: TeamMember; onClose: () => void }) {
  const reset = useResetAdminPassword();
  const [password, setPassword] = useState<string | null>(null);
  return (
    <Modal
      title={password ? 'Nouveau mot de passe provisoire' : `Redonner un mot de passe à ${memberName(m)} ?`}
      onClose={onClose}
      footer={
        password ? (
          <button type="button" onClick={onClose} className={BTN_PRIMARY}>
            Terminé
          </button>
        ) : (
          <>
            <button type="button" onClick={onClose} className={BTN_SOFT}>
              Annuler
            </button>
            <button
              type="button"
              disabled={reset.isPending}
              onClick={() => reset.mutate(m.user_id, { onSuccess: (r) => r.tempPassword && setPassword(r.tempPassword) })}
              className={BTN_PRIMARY}
            >
              {reset.isPending ? '…' : 'Générer'}
            </button>
          </>
        )
      }
    >
      {password ? (
        <PasswordReveal email={m.email ?? ''} password={password} name={memberName(m)} />
      ) : (
        <p className="text-[14px] leading-relaxed text-muted-foreground">Son mot de passe actuel cessera de fonctionner. Un mot de passe provisoire s’affichera une seule fois.</p>
      )}
    </Modal>
  );
}

function FicheDialog({ m, onClose }: { m: TeamMember; onClose: () => void }) {
  const link = useLinkCommercial();
  const sources = useClientSources(false);
  const free = useMemo(() => (sources.data ?? []).filter((s) => s.kind === 'commercial' && (!s.staff_user_id || s.staff_user_id === m.user_id)), [sources.data, m.user_id]);
  const [picked, setPicked] = useState<string | null>(m.source?.id ?? null);
  return (
    <Modal
      title="Sa fiche commercial"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_SOFT}>
            Annuler
          </button>
          <button
            type="button"
            disabled={!picked || picked === m.source?.id || link.isPending}
            onClick={() => link.mutate({ userId: m.user_id, sourceId: picked }, { onSuccess: onClose })}
            className={BTN_PRIMARY}
          >
            {link.isPending ? '…' : 'Relier'}
          </button>
        </>
      }
    >
      <p className="text-[13.5px] leading-relaxed text-muted-foreground">
        Les fiches « commercial » libres. Choisissez celle sous laquelle {m.first_name || 'il'} apportait déjà des clients : il les retrouve dans son espace.
      </p>
      {sources.isLoading ? (
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
      ) : free.length === 0 ? (
        <p className="text-[13.5px]">Aucune fiche libre.</p>
      ) : (
        <div className="space-y-1.5">
          {free.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setPicked(s.id)}
              className={cn('flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left ring-1', picked === s.id ? 'ring-2 ring-primary' : 'ring-black/10 hover:bg-accent dark:ring-white/15')}
            >
              <span>
                <span className="block text-[14px] font-semibold">
                  {s.label}
                  {s.id === m.source?.id && <span className="ml-1.5 text-[12px] font-medium text-muted-foreground">(actuelle)</span>}
                </span>
                {s.phone && <span className="block text-[12.5px] text-muted-foreground">{s.phone}</span>}
              </span>
              {picked === s.id && <Check className="h-4 w-4 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
