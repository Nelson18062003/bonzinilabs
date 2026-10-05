// ============================================================
// Mes équipes › un commercial — son mois (chiffres et objectifs), ses
// objectifs à fixer, ses prospects (à confier à un autre au besoin) et les
// clients qu'il a apportés. Le responsable seulement (canManageSales) ;
// le commercial voit les mêmes chiffres dans son espace « /v ».
// ============================================================
import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Phone, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCommercialClients, useCommercialDashboard, useProspects, useReassignProspect, useSalesOverview, useSetObjective, type Prospect } from '@/hooks/useSales';
import {
  OBJECTIVES,
  PROSPECT_STATUS,
  currentMonth,
  fmtCbm,
  fmtCount,
  fmtKg,
  fmtObjective,
  fmtXaf,
  monthLabel,
  type CommercialCard,
  type ObjectiveMetric,
  type ProspectStatus,
} from '@/lib/sales';
import { MonthSwitcher, ObjectiveBar } from '@/components/sales/SalesBits';
import { StatusPill } from '@/mobile/designKit';
import { TextField } from '@/components/form';
import { BTN_PRIMARY, BTN_SOFT, CARD, Modal, Skeleton } from './TeamBits';
import { TEAM_BASE } from './TeamScreen';

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
              Fiche « {card.source.label} »{card.source.phone && ` · ${card.source.phone}`}
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
          <h2 className="text-[16px] font-semibold">Objectifs de {monthLabel(month)}</h2>
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
  const initial = useMemo(() => Object.fromEntries(OBJECTIVES.map((o) => [o.metric, String(card.objectives.find((x) => x.metric === o.metric)?.target ?? '')])), [card.objectives]) as Record<ObjectiveMetric, string>;
  const [values, setValues] = useState<Record<ObjectiveMetric, string>>(initial);
  const [saving, setSaving] = useState(false);

  const parse = (v: string) => {
    const n = Number(v.replace(/\s/g, '').replace(',', '.'));
    return v.trim() === '' ? null : Number.isFinite(n) && n >= 0 ? n : NaN;
  };
  const invalid = OBJECTIVES.some((o) => Number.isNaN(parse(values[o.metric])));

  const submit = async () => {
    if (invalid || saving) return;
    setSaving(true);
    try {
      for (const o of OBJECTIVES) {
        if (values[o.metric] === initial[o.metric]) continue;
        const n = parse(values[o.metric]);
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
      title={`Objectifs de ${monthLabel(month)}`}
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
          const bad = Number.isNaN(parse(values[o.metric]));
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
  const prospects = useProspects(sourceId);
  const [filter, setFilter] = useState<ProspectFilter>('open');
  const [moving, setMoving] = useState<Prospect | null>(null);
  const list = (prospects.data ?? []).filter((p) => (filter === 'open' ? ['new', 'contacted', 'interested'].includes(p.status) : p.status === filter));
  const counts = (s: ProspectFilter) => (prospects.data ?? []).filter((p) => (s === 'open' ? ['new', 'contacted', 'interested'].includes(p.status) : p.status === s)).length;

  return (
    <section className={cn(CARD, 'overflow-hidden')}>
      <div className="space-y-3 px-5 pb-2 pt-5">
        <h2 className="text-[16px] font-semibold">Ses prospects</h2>
        <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5">
          {(['open', 'won', 'lost'] as ProspectFilter[]).map((f) => (
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
            <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-3">
              <span className="min-w-[180px] flex-1">
                <span className="block text-[14.5px] font-semibold">{[p.first_name, p.last_name].filter(Boolean).join(' ')}</span>
                <span className="block text-[12.5px] text-muted-foreground">
                  {[p.company, p.city, p.phone].filter(Boolean).join(' · ')}
                  {p.status === 'lost' && p.lost_reason && ` · ${p.lost_reason}`}
                </span>
              </span>
              {p.next_action_at && p.status !== 'won' && p.status !== 'lost' && (
                <span className={cn('text-[12.5px]', new Date(p.next_action_at) <= new Date() ? 'font-semibold text-amber-700 dark:text-amber-400' : 'text-muted-foreground')}>
                  relance le {new Date(p.next_action_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                </span>
              )}
              <StatusPill tone={PROSPECT_STATUS[p.status].tone} label={PROSPECT_STATUS[p.status].label} />
              {p.status !== 'won' && (
                <button type="button" onClick={() => setMoving(p)} className="text-[13px] font-semibold text-primary hover:underline">
                  Confier à…
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {moving && <ReassignDialog prospect={moving} month={month} onClose={() => setMoving(null)} />}
    </section>
  );
}

function ReassignDialog({ prospect, month, onClose }: { prospect: Prospect; month: string; onClose: () => void }) {
  const overview = useSalesOverview(month);
  const reassign = useReassignProspect();
  const others = (overview.data ?? []).filter((c) => c.source.id !== prospect.source_id && c.source.is_active);
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <Modal
      title={`Confier ${prospect.first_name} à un autre commercial`}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_SOFT}>
            Annuler
          </button>
          <button type="button" disabled={!picked || reassign.isPending} onClick={() => picked && reassign.mutate({ id: prospect.id, sourceId: picked }, { onSuccess: onClose })} className={BTN_PRIMARY}>
            {reassign.isPending ? '…' : 'Confier'}
          </button>
        </>
      }
    >
      {overview.isLoading ? (
        <div className="h-20 animate-pulse rounded-xl bg-muted" />
      ) : others.length === 0 ? (
        <p className="text-[13.5px] text-muted-foreground">Aucun autre commercial actif.</p>
      ) : (
        <div className="space-y-1.5">
          {others.map((c) => (
            <button
              key={c.source.id}
              type="button"
              onClick={() => setPicked(c.source.id)}
              className={cn('flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left ring-1', picked === c.source.id ? 'ring-2 ring-primary' : 'ring-black/10 hover:bg-accent dark:ring-white/15')}
            >
              <span className="text-[14px] font-semibold">{c.staff?.name || c.source.label}</span>
              <span className="text-[12.5px] text-muted-foreground">{c.metrics.prospects_open} prospects en cours</span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

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
              <button type="button" onClick={() => navigate(`/m/clients/${c.user_id}`)} className="flex w-full flex-wrap items-center gap-x-5 gap-y-1 rounded-xl px-3 py-3 text-left hover:bg-muted/40">
                <span className="min-w-[180px] flex-1">
                  <span className="block truncate text-[14.5px] font-semibold">{c.name || '—'}</span>
                  <span className="block text-[12.5px] text-muted-foreground">
                    {[c.customer_code, c.company].filter(Boolean).join(' · ') || 'Client'} · depuis le {new Date(c.created_at).toLocaleDateString('fr-FR')}
                  </span>
                </span>
                <Metric label="Paiements" value={c.payments_xaf ? fmtXaf(c.payments_xaf) : '—'} />
                <Metric label="Avion" value={c.air_parcels ? fmtKg(c.air_kg) : '—'} />
                <Metric label="Bateau" value={c.sea_parcels ? fmtCbm(c.sea_cbm) : '—'} />
                {c.phone && (
                  <a href={`tel:${c.phone}`} onClick={(e) => e.stopPropagation()} className="rounded-full p-2 text-muted-foreground hover:bg-accent" aria-label="Appeler">
                    <Phone className="h-4 w-4" />
                  </a>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className="w-[120px] text-right tabular-nums">
      <span className="block text-[11.5px] text-muted-foreground">{label}</span>
      <span className="block text-[13.5px] font-medium">{value}</span>
    </span>
  );
}
