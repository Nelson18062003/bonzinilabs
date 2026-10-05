// ============================================================
// Mes équipes › Nouvel accès — en deux temps : le rôle (rangé par équipe,
// avec ce qu'il fait et où il arrive), puis la personne. Pour un commercial,
// sa fiche : une nouvelle à son nom, ou celle sous laquelle il apportait
// déjà des clients (il les garde). Le mot de passe provisoire s'affiche une
// seule fois à la fin. Écriture : team_create_member (super admin seul).
//
// Numéros et site (06/10) : l'éditeur de numéros des clients (pays, drapeau,
// validation, plusieurs numéros), principal FACULTATIF ; le site, proposé
// d'après le rôle (réceptionnaire → Guangzhou · bureau, agent d'entrepôt →
// Douala). Ils partent juste après la création (team_set_member_profile) ;
// s'ils échouent, l'accès existe quand même et l'écran de fin le dit.
// ============================================================
import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Check, MapPin, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ADMIN_ROLE_LABELS, useAdminAuth, type AppRole } from '@/contexts/AdminAuthContext';
import { useCreateTeamMember, useTeamSites, type CreatedMember, type StaffSite } from '@/hooks/useTeam';
import { useClientSources } from '@/hooks/useClientSources';
import { ClientPhonesEditor } from '@/components/clients/ClientPhonesEditor';
import { useClientPhonesEditor } from '@/components/clients/useClientPhonesEditor';
import { ROLE_DESCRIPTION, TEAMS, defaultSiteFor, profileFailedMessage, roleSpace } from '@/lib/team';
import { BTN_PRIMARY, BTN_SOFT, CARD, Field, PasswordReveal, RolePill, SiteTag } from './TeamBits';
import { TeamSitePicker } from './TeamSitePicker';
import { TEAM_BASE } from './TeamScreen';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function isRole(v: string | null): v is AppRole {
  return !!v && v in ADMIN_ROLE_LABELS;
}

/**
 * L'accès créé ; pour un commercial, la fiche à laquelle il est relié
 * (`sourceId` de la RPC). `site` et `sent` : ce qui a été demandé en plus,
 * pour dire précisément quoi refaire si `profileFailed`.
 */
type Created = CreatedMember & {
  name: string;
  role: AppRole;
  fiche: { label: string; reused: boolean } | null;
  site: Pick<StaffSite, 'label' | 'country_iso'> | null;
  sent: { phones: boolean; site: boolean };
};

export function TeamNewMember() {
  const { hasPermission } = useAdminAuth();
  if (!hasPermission('canManageUsers')) return <Navigate to="/m" replace />;
  return <NewMemberFlow />;
}

function NewMemberFlow() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const preset = params.get('role');
  const [role, setRole] = useState<AppRole | null>(isRole(preset) ? preset : null);
  const [created, setCreated] = useState<Created | null>(null);

  if (created) {
    return (
      <Shell onBack={() => navigate(TEAM_BASE)} backLabel="Mes équipes">
        <div className={cn(CARD, 'space-y-5 p-5 sm:p-6')}>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              <Check className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-[20px] font-bold tracking-tight">Accès créé pour {created.name}</h1>
              <p className="text-[13.5px] text-muted-foreground">
                <RolePill role={created.role} className="mr-1.5 align-middle" /> arrive sur : {roleSpace(created.role)}
                {created.site && !created.profileFailed && (
                  <>
                    {' · '}
                    <SiteTag site={created.site} className="align-middle" />
                  </>
                )}
              </p>
            </div>
          </div>
          {created.profileFailed && (
            <div role="alert" className="flex gap-3 rounded-xl bg-amber-50 px-4 py-3 text-[13.5px] leading-relaxed text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="font-medium">{profileFailedMessage(created.sent)}</p>
            </div>
          )}
          {created.fiche && (
            <p className="rounded-xl bg-muted/50 px-4 py-3 text-[13.5px] leading-relaxed">
              {created.fiche.reused ? 'Relié à la fiche commercial existante ' : 'Relié à une nouvelle fiche commercial '}
              <span className="font-semibold">« {created.fiche.label} »</span>
              {created.fiche.reused ? ' (fiche reprise) : il garde les clients déjà apportés sous ce nom.' : ', créée à son nom.'}
            </p>
          )}
          <PasswordReveal email={created.email} password={created.tempPassword} name={created.name} role={created.role} />
          <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
            <button type="button" onClick={() => navigate(`${TEAM_BASE}/${created.userId}`)} className={BTN_SOFT}>
              Voir sa fiche
            </button>
            <button
              type="button"
              onClick={() => {
                setCreated(null);
                setRole(null);
              }}
              className={BTN_SOFT}
            >
              <UserPlus className="h-4 w-4" /> Créer un autre accès
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  if (!role) {
    return (
      <Shell onBack={() => navigate(TEAM_BASE)} backLabel="Mes équipes">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">Nouvel accès</h1>
          <p className="mt-0.5 text-[14px] text-muted-foreground">Quel est son rôle ? Chacun ne voit que ce dont il a besoin.</p>
        </div>
        <div className="space-y-5">
          {TEAMS.map((t) => (
            <section key={t.key}>
              <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">{t.label}</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {t.roles.map((r) => (
                  <button key={r} type="button" onClick={() => setRole(r)} className={cn(CARD, 'p-4 text-left transition hover:ring-primary/40 active:scale-[0.99]')}>
                    <div className="text-[15px] font-semibold">{ADMIN_ROLE_LABELS[r]}</div>
                    <div className="mt-1 text-[13px] leading-snug text-muted-foreground">{ROLE_DESCRIPTION[r]}</div>
                    <div className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" /> {roleSpace(r)}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </Shell>
    );
  }

  return <MemberForm role={role} onChangeRole={() => setRole(null)} onCreated={setCreated} />;
}

function MemberForm({ role, onChangeRole, onCreated }: { role: AppRole; onChangeRole: () => void; onCreated: (c: Created) => void }) {
  const create = useCreateTeamMember();
  const sources = useClientSources(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const phones = useClientPhonesEditor({ primaryOptional: true });
  const sites = useTeamSites();
  // `undefined` : pas encore touché — le site proposé d'après le rôle s'applique.
  const [siteChoice, setSiteChoice] = useState<string | null | undefined>(undefined);
  const [sourceMode, setSourceMode] = useState<'new' | 'existing'>('new');
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  const freeFiches = useMemo(() => (sources.data ?? []).filter((s) => s.kind === 'commercial' && !s.staff_user_id), [sources.data]);
  const isCommercial = role === 'commercial';
  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
  const sameName = isCommercial && sourceMode === 'new' ? freeFiches.find((s) => s.label.trim().toLowerCase() === fullName.toLowerCase()) : undefined;
  const siteId = siteChoice !== undefined ? siteChoice : (defaultSiteFor(role, sites.data)?.id ?? null);

  const errors = {
    firstName: !firstName.trim() ? 'Le prénom est requis' : null,
    lastName: !lastName.trim() ? 'Le nom est requis' : null,
    email: !EMAIL.test(email.trim()) ? 'Adresse email invalide' : null,
    source: isCommercial && sourceMode === 'existing' && !sourceId ? 'Choisissez sa fiche' : null,
    phones: phones.primaryMissing
      ? 'Le numéro principal est vide : remplissez-le, ou mettez un autre numéro en principal.'
      : phones.primaryInvalid || phones.extrasInvalid ? 'Un numéro est incomplet : complétez-le ou effacez-le.' : null,
  };
  const valid = !Object.values(errors).some(Boolean);

  const submit = () => {
    setTried(true);
    if (!valid || create.isPending) return;
    const list = phones.toInputs();
    const site = (sites.data ?? []).find((s) => s.id === siteId) ?? null;
    create.mutate(
      { email, firstName, lastName, role, phones: list, siteId, sourceId: isCommercial && sourceMode === 'existing' ? sourceId : null },
      {
        onSuccess: (r) => {
          // La RPC renvoie `sourceId` : la fiche reprise (choisie dans la liste) ou la nouvelle, à son nom (même libellé que côté serveur).
          const reused = sourceMode === 'existing';
          const label = reused ? freeFiches.find((f) => f.id === r.sourceId)?.label : fullName.slice(0, 80);
          const fiche = isCommercial && r.sourceId && label ? { label, reused } : null;
          onCreated({ ...r, name: fullName, role, fiche, site, sent: { phones: list.length > 0, site: !!siteId } });
        },
      },
    );
  };

  return (
    <Shell onBack={onChangeRole} backLabel="Changer de rôle">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight">Nouvel accès</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-[14px] text-muted-foreground">
          <RolePill role={role} /> {ROLE_DESCRIPTION[role]}
        </p>
      </div>

      <div className={cn(CARD, 'space-y-4 p-5 sm:p-6')}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Prénom" value={firstName} onChange={setFirstName} autoFocus maxLength={80} error={tried ? errors.firstName : null} autoComplete="off" />
          <Field label="Nom" value={lastName} onChange={setLastName} maxLength={80} error={tried ? errors.lastName : null} autoComplete="off" />
        </div>
        <Field
          label="Email (sert à se connecter)"
          type="email"
          inputMode="email"
          value={email}
          onChange={setEmail}
          error={tried ? errors.email : null}
          hint="Sa propre adresse : un email ne sert qu’à un seul compte (client ou équipe)."
          autoComplete="off"
        />

        <div className="space-y-2 border-t border-border/60 pt-4">
          <ClientPhonesEditor editor={phones} variant="staff" idPrefix="team-phone" />
          {tried && errors.phones && <p className="text-[12.5px] font-medium text-red-600 dark:text-red-400">{errors.phones}</p>}
        </div>

        <div className="border-t border-border/60 pt-4">
          <TeamSitePicker
            value={siteId}
            onChange={setSiteChoice}
            hint="Où il travaille. Son site s’affiche avec son nom sur la fiche des clients qu’il enregistre."
          />
        </div>

        {isCommercial && (
          <div className="space-y-3 rounded-2xl bg-muted/50 p-4">
            <div>
              <div className="text-[14px] font-semibold">Sa fiche commercial</div>
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                C’est le nom que la réception choisit comme origine d’un nouveau client. S’il apportait déjà des clients sous son nom, reprenez sa fiche : il les garde.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ModeChip active={sourceMode === 'new'} onClick={() => setSourceMode('new')}>
                Nouvelle fiche à son nom
              </ModeChip>
              <ModeChip active={sourceMode === 'existing'} onClick={() => setSourceMode('existing')} disabled={freeFiches.length === 0}>
                Reprendre une fiche existante{freeFiches.length ? ` (${freeFiches.length})` : ''}
              </ModeChip>
            </div>
            {sourceMode === 'existing' && (
              <div className="space-y-1.5">
                {freeFiches.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSourceId(s.id)}
                    className={cn('flex w-full items-center justify-between rounded-xl bg-card px-3.5 py-2.5 text-left ring-1', sourceId === s.id ? 'ring-2 ring-primary' : 'ring-black/10 dark:ring-white/15')}
                  >
                    <span>
                      <span className="block text-[14px] font-semibold">{s.label}</span>
                      {s.phone && <span className="block text-[12.5px] text-muted-foreground">{s.phone}</span>}
                    </span>
                    {sourceId === s.id && <Check className="h-4 w-4 text-primary" />}
                  </button>
                ))}
                {tried && errors.source && <p className="text-[12.5px] text-red-600 dark:text-red-400">{errors.source}</p>}
              </div>
            )}
            {sameName && (
              <p className="text-[12.5px] font-medium text-amber-700 dark:text-amber-400">
                Une fiche « {sameName.label} » existe déjà : reprenez-la pour qu’il garde ses clients.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t border-border/60 pt-4">
          <button type="button" onClick={onChangeRole} className={BTN_SOFT}>
            Changer de rôle
          </button>
          <button type="button" onClick={submit} disabled={create.isPending} className={BTN_PRIMARY}>
            {create.isPending ? 'Création…' : 'Créer l’accès'}
          </button>
        </div>
      </div>
    </Shell>
  );
}

function ModeChip({ active, onClick, disabled, children }: { active: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn('h-9 rounded-full px-3.5 text-[13.5px] font-medium disabled:opacity-40', active ? 'bg-primary text-primary-foreground' : 'bg-card ring-1 ring-black/10 hover:bg-accent dark:ring-white/15')}
    >
      {children}
    </button>
  );
}

function Shell({ onBack, backLabel, children }: { onBack: () => void; backLabel: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-0">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> {backLabel}
      </button>
      {children}
    </div>
  );
}
