// ============================================================
// Mes équipes › un commercial — son mois (chiffres et objectifs), ses
// objectifs à fixer, ses prospects (à confier à un autre au besoin) et les
// clients qu'il a apportés. Le responsable seulement (canManageSales) ;
// le commercial voit les mêmes chiffres dans son espace « /v ».
// 07/10 : ses fiches « À vérifier » (un numéro déjà client) renvoient à
// l'écran de décision — et se confient encore à un autre commercial (une
// fiche d'un commercial archivé ne s'attribue pas avant) ; un prospect en
// cours peut devenir client d'un geste (« Créer son compte client » : le
// formulaire « Nouveau client », son numéro déjà saisi, sa fiche reprise).
// Sur téléphone, les gestes passent SOUS la ligne (les coordonnées gardent
// toute la largeur).
// ============================================================
import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Phone, UserSearch, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCommercialClients, useCommercialDashboard, useProspects, useSetObjective, type Prospect } from '@/hooks/useSales';
import {
  OBJECTIVES,
  OPEN_STATUSES,
  PROSPECT_STATUS,
  clientPhoneE164,
  currentMonth,
  fmtCbm,
  fmtCount,
  fmtKg,
  fmtObjective,
  fmtXaf,
  monthLabel,
  ofMonth,
  type CommercialCard,
  type ObjectiveMetric,
  type ProspectStatus,
} from '@/lib/sales';
import { MonthSwitcher, ObjectiveBar, PhoneNumber, ProspectStatusPill } from '@/components/sales/SalesBits';
import { formatE164ForDisplay } from '@/components/form/PhoneNumberInput';
import { TextField } from '@/components/form';
import { PROSPECT_CLAIMS_PATH } from '@/hooks/useAdminNotifications';
import { newClientPathForPhone } from '@/components/clients/prospectPrefill';
import { BTN_PRIMARY, BTN_SOFT, CARD, Modal, Skeleton } from './TeamBits';
import { TEAM_BASE } from './TeamScreen';
import { ReassignProspectDialog } from './ReassignProspectDialog';

export function SalesCommercial() {
  const { hasPermission } = useAdminAuth();
  if (!hasPermission('canManageSales')) return <Navigate to="/m" replace />;
  return <Page />;
}

type ProspectFilter = 'open' | ProspectStatus;

function Page() {
  const { sourceId = '' } = useParams();
  const navigate = useNavigate();
  const [month, setMonth] = useState(currentMonth());
  const dash = useCommercialDashboard(month, sourceId);
  const card = dash.data;
  const title = card?.staff?.name || card?.source.label || '…';

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-0">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <button type="button" onClick={() => navigate(`${TEAM_BASE}/ventes`)} className="mb-1 inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Les commerciaux
          </button>
          <h1 className="truncate text-[26px] font-bold tracking-tight">{title}</h1>
          {card && (
            <p className="mt-0.5 text-[14px] text-muted-foreground">
              Fiche « {card.source.label} »{card.source.phone && ` · ${formatE164ForDisplay(card.source.phone)}`}
              {!card.staff && ' · sans compte'}
              {card.staff?.is_disabled && ' · accès désactivé'}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthSwitcher month={month} onChange={setMonth} />
          {card?.staff && (
            <button type="button" onClick={() => navigate(`${TEAM_BASE}/${card.staff!.user_id}`)} className={BTN_SOFT}>
              Son accès
            </button>
          )}
        </div>
      </header>

      {dash.isLoading ? (
        <div className={CARD}>
          <Skeleton rows={3} />
        </div>
      ) : dash.isError || !card ? (
        <div className={cn(CARD, 'p-8 text-center text-[14px]')}>
          {(dash.error as Error | null)?.message || 'Ce commercial est introuvable.'}{' '}
          <button type="button" onClick={() => void dash.refetch()} className="font-semibold underline">
            Réessayer
          </button>
        </div>
      ) : (
        <>
          <Figures card={card} />
          <Objectives card={card} month={month} sourceId={sourceId} />
        </>
      )}

      <Prospects sourceId={sourceId} month={month} />
      <Clients sourceId={sourceId} month={month} />
    </div>
  );
}

function Figures({ card }: { card: CommercialCard }) {
  const m = card.metrics;
  return (
    <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
      <Figure label="Clients apportés" value={fmtCount(m.clients)} hint={m.new_clients ? `+${m.new_clients} ce mois` : 'aucun nouveau ce mois'} />
      <Figure label="Paiements de ses clients" value={fmtXaf(m.payments_xaf)} hint={`${m.payments_count} paiement${m.payments_count > 1 ? 's' : ''}`} />
      <Figure label="Fret avion" value={fmtKg(m.air_kg)} hint={`${m.air_parcels} colis`} />
      <Figure label="Fret bateau" value={fmtCbm(m.sea_cbm)} hint={`${m.sea_parcels} colis`} />
    </section>
  );
}

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className={cn(CARD, 'p-3.5 sm:p-5')}>
      <div className="text-[12px] font-medium leading-tight text-muted-foreground sm:text-[13px]">{label}</div>
      <div className="mt-1.5 text-[18px] font-bold tracking-tight tabular-nums sm:text-[24px]">{value}</div>
      {hint && <div className="mt-0.5 text-[12px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

/* ── Objectifs du mois ─────────────────────────────────────────────────── */

function Objectives({ card, month, sourceId }: { card: CommercialCard; month: string; sourceId: string }) {
  const [editing, setEditing] = useState(false);
  const set = card.objectives;
  return (
    <section className={cn(CARD, 'space-y-4 p-5')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[16px] font-semibold">Objectifs {ofMonth(monthLabel(month))}</h2>
          <p className="text-[12.5px] text-muted-foreground">Il les voit dans son espace, avec son avancement.</p>
        </div>
        <button type="button" onClick={() => setEditing(true)} className={BTN_SOFT}>
          {set.length ? 'Modifier' : 'Fixer ses objectifs'}
        </button>
      </div>
      {set.length === 0 ? (
        <p className="text-[13.5px] text-muted-foreground">Pas d’objectif ce mois-ci.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {OBJECTIVES.filter((o) => set.some((x) => x.metric === o.metric)).map((o) => (
            <ObjectiveBar key={o.metric} objective={set.find((x) => x.metric === o.metric)!} />
          ))}
        </div>
      )}
      {editing && <ObjectivesDialog card={card} month={month} sourceId={sourceId} onClose={() => setEditing(false)} />}
    </section>
  );
}

function ObjectivesDialog({ card, month, sourceId, onClose }: { card: CommercialCard; month: string; sourceId: string; onClose: () => void }) {
  const save = useSetObjective();
  const initial = useMemo(
    () => Object.fromEntries(OBJECTIVES.map((o) => [o.metric, groupTarget(card.objectives.find((x) => x.metric === o.metric)?.target ?? null)])),
    [card.objectives],
  ) as Record<ObjectiveMetric, string>;
  const [values, setValues] = useState<Record<ObjectiveMetric, string>>(initial);
  const [saving, setSaving] = useState(false);

  const invalid = OBJECTIVES.some((o) => Number.isNaN(parseTarget(values[o.metric])));

  const submit = async () => {
    if (invalid || saving) return;
    setSaving(true);
    try {
      for (const o of OBJECTIVES) {
        const n = parseTarget(values[o.metric]);
        if (n === parseTarget(initial[o.metric])) continue;
        await save.mutateAsync({ sourceId, month, metric: o.metric, target: n && n > 0 ? n : null });
      }
      onClose();
    } catch {
      /* le hook a déjà affiché l'erreur ; la fenêtre reste ouverte */
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Objectifs ${ofMonth(monthLabel(month))}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_SOFT}>
            Annuler
          </button>
          <button type="button" onClick={() => void submit()} disabled={invalid || saving} className={BTN_PRIMARY}>
            {saving ? '…' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <p className="text-[13px] text-muted-foreground">Laissez vide (ou 0) pour ne pas fixer d’objectif. Réalisé à ce jour entre parenthèses.</p>
      <div className="space-y-3">
        {OBJECTIVES.map((o) => {
          const actual = card.objectives.find((x) => x.metric === o.metric)?.actual ?? actualOf(card, o.metric);
          const bad = Number.isNaN(parseTarget(values[o.metric]));
          return (
            <label key={o.metric} className="flex items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium">{o.label}</span>
                <span className="block text-[12px] text-muted-foreground">({fmtObjective(o.unit, actual)} à ce jour)</span>
              </span>
              <TextField
                variant="decimal"
                value={values[o.metric]}
                onChange={(e) => setValues((v) => ({ ...v, [o.metric]: e.target.value }))}
                onBlur={() => setValues((v) => ({ ...v, [o.metric]: groupTarget(parseTarget(v[o.metric]), v[o.metric]) }))}
                placeholder="—"
                aria-label={o.label}
                error={bad ? ' ' : undefined}
                wrapperClassName="w-36"
                controlClassName="rounded-xl bg-card text-right tabular-nums"
              />
              <span className="w-10 text-[12.5px] text-muted-foreground">{o.unit === 'xaf' ? 'XAF' : o.unit === 'kg' ? 'kg' : o.unit === 'cbm' ? 'm³' : ''}</span>
            </label>
          );
        })}
      </div>
    </Modal>
  );
}

/** Une cible tapée (« 50 000 000 », « 2,5 ») : null si vide, NaN si invalide. */
function parseTarget(v: string): number | null {
  const n = Number(v.replace(/\s/g, '').replace(',', '.'));
  return v.trim() === '' ? null : Number.isFinite(n) && n >= 0 ? n : NaN;
}

/** La cible lisible, avec séparateur de milliers (« 50 000 000 ») ; `raw` est gardé tel quel s'il est invalide. */
function groupTarget(n: number | null, raw = ''): string {
  if (n === null) return '';
  if (Number.isNaN(n)) return raw;
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 3 });
}

function actualOf(card: CommercialCard, metric: ObjectiveMetric): number {
  const m = card.metrics;
  switch (metric) {
    case 'new_clients':
      return m.new_clients;
    case 'payments_xaf':
      return m.payments_xaf;
    case 'air_kg':
      return m.air_kg;
    case 'sea_cbm':
      return m.sea_cbm;
    case 'prospects_new':
      return m.prospects_new;
    case 'prospects_won':
      return m.prospects_won;
  }
}

/* ── Prospects ─────────────────────────────────────────────────────────── */

function Prospects({ sourceId, month }: { sourceId: string; month: string }) {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  // Comme « Nouveau client » : qui peut créer un client peut créer le compte d'un prospect.
  const canCreateClient = hasPermission('canRegisterClients') || hasPermission('canEditClients');
  const prospects = useProspects(sourceId);
  const [filter, setFilter] = useState<ProspectFilter>('open');
  const [moving, setMoving] = useState<Prospect | null>(null);
  const isIn = (p: Prospect, f: ProspectFilter) => (f === 'open' ? OPEN_STATUSES.includes(p.status) : p.status === f);
  const list = (prospects.data ?? []).filter((p) => isIn(p, filter));
  const counts = (f: ProspectFilter) => (prospects.data ?? []).filter((p) => isIn(p, f)).length;
  const toVerify = counts('to_verify');
  // « À vérifier » n'apparaît que s'il y en a (ou si l'onglet est ouvert : la dernière décision ne le fait pas disparaître sous les yeux).
  const filters: ProspectFilter[] = toVerify > 0 || filter === 'to_verify' ? ['open', 'to_verify', 'won', 'lost'] : ['open', 'won', 'lost'];

  return (
    <section className={cn(CARD, 'overflow-hidden')}>
      <div className="space-y-3 px-5 pb-2 pt-5">
        <h2 className="text-[16px] font-semibold">Ses prospects</h2>
        {toVerify > 0 && (
          <div className="flex flex-col gap-2 rounded-xl bg-amber-50 px-3.5 py-3 text-[13.5px] text-amber-950 sm:flex-row sm:items-center dark:bg-amber-500/10 dark:text-amber-100">
            <UserSearch className="hidden h-4 w-4 shrink-0 text-amber-600 sm:block dark:text-amber-300" />
            <span className="min-w-0 flex-1 leading-snug">
              <strong>
                {toVerify} fiche{toVerify > 1 ? 's' : ''} à vérifier
              </strong>{' '}
              : un numéro saisi est déjà celui d’un client Bonzini.
            </span>
            <button
              type="button"
              onClick={() => navigate(`${PROSPECT_CLAIMS_PATH}?commercial=${encodeURIComponent(sourceId)}`)}
              className="self-start text-[13.5px] font-semibold text-amber-900 underline underline-offset-2 sm:self-auto dark:text-amber-200"
            >
              Décider
            </button>
          </div>
        )}
        <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn('h-8 shrink-0 rounded-full px-3 text-[13px] font-medium', filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-accent')}
            >
              {f === 'open' ? 'En cours' : PROSPECT_STATUS[f].label} <span className="ml-1 opacity-70">{counts(f)}</span>
            </button>
          ))}
        </div>
      </div>
      {prospects.isLoading ? (
        <Skeleton rows={3} />
      ) : prospects.isError ? (
        <div className="p-6 text-center text-[14px]">
          La liste n’a pas pu être chargée.{' '}
          <button type="button" onClick={() => void prospects.refetch()} className="font-semibold underline">
            Réessayer
          </button>
        </div>
      ) : list.length === 0 ? (
        <p className="px-5 pb-5 text-[13.5px] text-muted-foreground">Aucun prospect ici.</p>
      ) : (
        <ul className="divide-y divide-border/60 px-2 pb-2">
          {list.map((p) => (
            // Le statut toujours à droite ; les gestes à côté sur ordinateur, SOUS la ligne sur téléphone ; la relance sous les coordonnées.
            <li key={p.id} className="flex flex-wrap items-start gap-x-3 gap-y-2 px-3 py-3 sm:flex-nowrap sm:items-center sm:gap-x-4">
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-semibold">{[p.first_name, p.last_name].filter(Boolean).join(' ')}</span>
                {(p.company || p.city) && <span className="block text-[12.5px] text-muted-foreground">{[p.company, p.city].filter(Boolean).join(' · ')}</span>}
                {/* Le numéro sur sa propre ligne : jamais un « · » orphelin en fin de ligne. */}
                <span className="block text-[12.5px] text-muted-foreground">
                  <PhoneNumber e164={p.phone_e164} />
                  {(p.phones ?? []).length > 0 && ` +${(p.phones ?? []).length}`}
                  {p.status === 'lost' && p.lost_reason && ` · ${p.lost_reason}`}
                </span>
                {/* Ses plus gros problèmes (06/10) : ce que le responsable veut lire d'abord. */}
                {p.pain_points && (
                  <span className="mt-1 line-clamp-2 block whitespace-pre-line text-[12.5px] text-foreground/80">
                    <span className="font-semibold">Problèmes : </span>
                    {p.pain_points}
                  </span>
                )}
                {p.next_action_at && OPEN_STATUSES.includes(p.status) && (
                  <span className={cn('block text-[12.5px]', new Date(p.next_action_at) <= new Date() ? 'font-semibold text-amber-700 dark:text-amber-400' : 'text-muted-foreground')}>
                    relance le {new Date(p.next_action_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </span>
              <span className="shrink-0 sm:order-last">
                <ProspectStatusPill status={p.status} />
              </span>
              {p.status !== 'won' && (
                <span className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 sm:w-auto sm:shrink-0 sm:justify-end">
                  {p.status === 'to_verify' && (
                    // Le numéro est déjà celui d'un client : la décision se prend sur l'écran « À vérifier ».
                    <button type="button" onClick={() => navigate(`${PROSPECT_CLAIMS_PATH}?fiche=${encodeURIComponent(p.id)}`)} className={LINK}>
                      Décider
                    </button>
                  )}
                  {canCreateClient && OPEN_STATUSES.includes(p.status) && (
                    <button
                      type="button"
                      onClick={() => navigate(newClientPathForPhone(p.phone_e164))}
                      className={LINK}
                      aria-label={`Créer le compte client de ${[p.first_name, p.last_name].filter(Boolean).join(' ')}`}
                    >
                      Créer son compte client
                    </button>
                  )}
                  {/* « À vérifier » compris : une fiche d'un commercial archivé se confie avant d'être attribuée. */}
                  <button type="button" onClick={() => setMoving(p)} className={LINK}>
                    Confier à…
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {moving && <ReassignProspectDialog prospect={moving} month={month} onClose={() => setMoving(null)} />}
    </section>
  );
}

const LINK = 'text-[13px] font-semibold text-primary hover:underline';

/* ── Ses clients ───────────────────────────────────────────────────────── */

function Clients({ sourceId, month }: { sourceId: string; month: string }) {
  const navigate = useNavigate();
  const clients = useCommercialClients(month, sourceId);
  const list = clients.data ?? [];
  return (
    <section className={cn(CARD, 'overflow-hidden')}>
      <div className="flex items-center justify-between px-5 pb-2 pt-5">
        <h2 className="text-[16px] font-semibold">Les clients qu’il a apportés</h2>
        {!clients.isLoading && <span className="text-[13px] text-muted-foreground">{list.length}</span>}
      </div>
      {clients.isLoading ? (
        <Skeleton rows={3} />
      ) : clients.isError ? (
        <div className="p-6 text-center text-[14px]">
          La liste n’a pas pu être chargée.{' '}
          <button type="button" onClick={() => void clients.refetch()} className="font-semibold underline">
            Réessayer
          </button>
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 p-8 text-center text-[13.5px] text-muted-foreground">
          <Users className="h-6 w-6" />
          Aucun client pour l’instant.
        </div>
      ) : (
        <ul className="px-2 pb-2">
          {list.map((c) => (
            <li key={c.user_id}>
              {/* Téléphone : nom, appel et chevron sur la première ligne, les trois chiffres en dessous ; une seule ligne sur ordinateur. */}
              <button type="button" onClick={() => navigate(`/m/clients/${c.user_id}`)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-3 py-3 text-left hover:bg-muted/40 sm:flex-nowrap sm:gap-x-5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold">{c.name || '—'}</span>
                  <span className="block text-[12.5px] text-muted-foreground">
                    {[c.customer_code, c.company].filter(Boolean).join(' · ') || 'Client'} · depuis le {new Date(c.created_at).toLocaleDateString('fr-FR')}
                  </span>
                </span>
                <span className="order-last grid w-full grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 rounded-xl bg-muted/50 px-3 py-2 sm:order-none sm:flex sm:w-auto sm:gap-5 sm:bg-transparent sm:p-0">
                  <Metric label="Paiements" value={c.payments_xaf ? fmtXaf(c.payments_xaf) : '—'} />
                  <Metric label="Avion" value={c.air_parcels ? fmtKg(c.air_kg) : '—'} />
                  <Metric label="Bateau" value={c.sea_parcels ? fmtCbm(c.sea_cbm) : '—'} />
                </span>
                {c.phone && <CallClient phone={c.phone} />}
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Appeler un client : le lien part en E.164 (un ancien numéro local est lu comme camerounais) ; le numéro lisible au survol. */
function CallClient({ phone }: { phone: string }) {
  const e164 = clientPhoneE164(phone);
  const readable = formatE164ForDisplay(e164 ?? phone);
  return (
    <a
      href={`tel:${e164 ?? phone.replace(/[^\d+]/g, '')}`}
      onClick={(e) => e.stopPropagation()}
      className="shrink-0 rounded-full p-2 text-muted-foreground hover:bg-accent"
      aria-label={`Appeler le ${readable}`}
      title={readable}
    >
      <Phone className="h-4 w-4" />
    </a>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className="min-w-0 tabular-nums sm:w-[120px] sm:text-right">
      <span className="block text-[11.5px] text-muted-foreground">{label}</span>
      <span className="block text-[13.5px] font-medium">{value}</span>
    </span>
  );
}
