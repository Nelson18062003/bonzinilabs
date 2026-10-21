/**
 * Équipe › Ventes › un commercial — refonte v2 (maquettes 10/21 et 10/22).
 * La direction seulement (`canManageSales`).
 *
 * Les paiements de ses clients du mois (« Octobre ⌄ ») et la barre de
 * l'objectif avec son rythme ; Objectifs (noir) · Appeler · Son accès ; ses
 * prospects par statut (En cours, À vérifier, Clients, Perdus) — toucher une
 * ligne : Appeler, WhatsApp, Créer son compte client, Décider (à vérifier),
 * Confier à… ; ses clients du mois. Objectifs : les 6 cibles du mois avec le
 * réalisé de chacune (set_commercial_objective).
 */
import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronDown, ChevronLeft, ChevronRight, KeyRound, MessageCircle, Phone, ShieldQuestion, Target, UserPlus, UserRoundCog } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCommercialClients, useCommercialDashboard, useProspects, useSetObjective, type Prospect } from '@/hooks/useSales';
import { OBJECTIVES, OPEN_STATUSES, clientPhoneE164, currentMonth, monthLabel, shiftMonth, whatsappLink, type CommercialCard, type ObjectiveMetric } from '@/lib/sales';
import { monthClock, objectivePace } from '@/components/sales/HomeData';
import { newClientPathForPhone } from '@/components/clients/prospectPrefill';
import { PROSPECT_CLAIMS_PATH } from '@/hooks/useAdminNotifications';
import {
  ActionCircles, ActionSheet, BigButton, Chip, Dock, EmptyLine, Initials, ItemList, ItemRow, MoreButton, ScreenLoader, ScreenTop, SectionHead, Tag, TEXT, SURFACE, FOCUS_RING,
  useSheet, type CircleAction, type SheetAction,
} from '@/mobile/designKit';
import { ChipRow, ProgressBar, shortXaf } from '@/mobile/screens/clients/parts';
import { MonthSheet, TEAM_BASE, monthName } from './teamParts';
import { PACE_TAG, followUp, prospectLine, prospectName, prospectTag } from './prospectBits';
import { ReassignSheet } from './ClaimsV2';

type PFilter = 'open' | 'to_verify' | 'won' | 'lost';

export function SalesCommercialV2() {
  const { hasPermission } = useAdminAuth();
  const { sourceId = '' } = useParams();
  if (!hasPermission('canManageSales')) return <Navigate to="/m" replace />;
  return <Page key={sourceId} sourceId={sourceId} />;
}

function Page({ sourceId }: { sourceId: string }) {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const [month, setMonth] = useState(currentMonth());
  const [view, setView] = useState<'main' | 'objectives'>('main');
  const [pickMonth, setPickMonth] = useState(false);
  const [filter, setFilter] = useState<PFilter>('open');
  const [open, setOpen] = useState<Prospect | null>(null);
  const [reassign, setReassign] = useState<Prospect | null>(null);
  const more = useSheet();
  const dash = useCommercialDashboard(month, sourceId);
  const prospects = useProspects(sourceId);
  const clients = useCommercialClients(month, sourceId);
  const card = dash.data;

  const list = useMemo(() => prospects.data ?? [], [prospects.data]);
  const counts = useMemo(() => ({
    open: list.filter((p) => OPEN_STATUSES.includes(p.status)).length,
    to_verify: list.filter((p) => p.status === 'to_verify').length,
    won: list.filter((p) => p.status === 'won').length,
    lost: list.filter((p) => p.status === 'lost').length,
  }), [list]);
  const shown = list.filter((p) => (filter === 'open' ? OPEN_STATUSES.includes(p.status) : p.status === filter));

  if (dash.isLoading && !card) return <ScreenLoader className="min-h-[100dvh]" />;
  if (!card) {
    return (
      <div className="min-h-[100dvh] bg-white dark:bg-[#1E1E1E]">
        <ScreenTop title="Commercial" backTo={`${TEAM_BASE}/ventes`} />
        <EmptyLine action={{ label: 'Réessayer', onClick: () => void dash.refetch() }}>Ses chiffres n’ont pas pu être chargés.</EmptyLine>
      </div>
    );
  }
  if (view === 'objectives') return <ObjectivesView card={card} sourceId={sourceId} month={month} onMonth={setMonth} onBack={() => setView('main')} />;

  const title = card.staff?.name || card.source.label;
  const archived = !card.source.is_active;
  const payObj = card.objectives.find((o) => o.metric === 'payments_xaf');
  const pace = payObj && payObj.target > 0 ? objectivePace(payObj, monthClock(month)) : null;
  const phone = card.source.phone ? clientPhoneE164(card.source.phone) ?? card.source.phone : null;
  const canCreateClient = hasPermission('canRegisterClients') || hasPermission('canEditClients');

  const circles: CircleAction[] = [
    { label: 'Objectifs', icon: Target, primary: true, onClick: () => setView('objectives') },
    { label: 'Appeler', icon: Phone, disabled: !phone, onClick: () => { if (phone) window.location.href = `tel:${phone.replace(/[^\d+]/g, '')}`; } },
    { label: 'Son accès', icon: KeyRound, disabled: !card.staff, onClick: () => card.staff && navigate(`${TEAM_BASE}/${card.staff.user_id}`) },
  ];

  const prospectActions = (p: Prospect): SheetAction[] => {
    const e164 = p.phone_e164 || null;
    return [
      { label: 'Appeler', icon: Phone, hidden: !e164, onClick: () => { window.location.href = `tel:${e164}`; } },
      { label: 'WhatsApp', icon: MessageCircle, hidden: !e164, onClick: () => { if (e164) window.open(whatsappLink(e164), '_blank', 'noopener'); } },
      { label: 'Décider', hint: 'à vérifier', icon: ShieldQuestion, hidden: p.status !== 'to_verify', onClick: () => navigate(`${PROSPECT_CLAIMS_PATH}?commercial=${sourceId}&fiche=${p.id}`) },
      { label: 'Créer son compte client', icon: UserPlus, hidden: !canCreateClient || !OPEN_STATUSES.includes(p.status) || !e164, onClick: () => navigate(newClientPathForPhone(e164!)) },
      { label: 'Confier à…', icon: UserRoundCog, hidden: p.status === 'won' || p.status === 'lost', onClick: () => setReassign(p) },
    ];
  };

  return (
    <div className="min-h-[100dvh] bg-white pb-8 dark:bg-[#1E1E1E]">
      <ScreenTop title={title} backTo={`${TEAM_BASE}/ventes`} right={<MoreButton onClick={more.show} />} />
      <div className="px-5 pt-5">
        <div className={cn('rounded-lg border px-[18px] pb-4 pt-[18px]', SURFACE.divider)}>
          <div className="flex items-start justify-between gap-3">
            <span className={cn('text-[16px] font-medium', TEXT.muted)}>Paiements de ses clients</span>
            <button type="button" onClick={() => setPickMonth(true)} className={cn('-mr-1 inline-flex h-8 items-center gap-1 rounded px-1 text-[16px] font-semibold', TEXT.strong, FOCUS_RING)}>
              {monthName(month)} <ChevronDown className="h-4 w-4" />
            </button>
          </div>
          <div className={cn('mt-1.5 text-[40px] font-bold leading-[1.1] tracking-[-0.02em] tabular-nums', TEXT.strong)}>
            {shortXaf(card.metrics.payments_xaf)}<span className={cn('ml-1.5 text-[20px] font-semibold', TEXT.muted)}>XAF</span>
          </div>
          {payObj && payObj.target > 0 ? (
            <>
              <ProgressBar ratio={payObj.actual / payObj.target} className="mt-3" />
              <div className="mt-2.5 flex items-center justify-between gap-3">
                <span className={cn('text-[16px]', TEXT.body)}><b className="font-bold">{Math.round((payObj.actual / payObj.target) * 100)} %</b> de {shortXaf(payObj.target)}</span>
                {pace && <Tag tone={PACE_TAG[pace.status].tone}>{PACE_TAG[pace.status].label}</Tag>}
              </div>
            </>
          ) : (
            <p className={cn('mt-2 text-[16px]', TEXT.muted)}>{archived ? 'Fiche archivée' : 'Pas d’objectif ce mois'}</p>
          )}
        </div>
      </div>
      <ActionCircles actions={circles} />

      <SectionHead title="Ses prospects" />
      <ChipRow className="pt-1">
        <Chip label="En cours" count={counts.open} active={filter === 'open'} onClick={() => setFilter('open')} />
        <Chip label="À vérifier" count={counts.to_verify} active={filter === 'to_verify'} onClick={() => setFilter('to_verify')} />
        <Chip label="Clients" count={counts.won} active={filter === 'won'} onClick={() => setFilter('won')} />
        <Chip label="Perdus" count={counts.lost} active={filter === 'lost'} onClick={() => setFilter('lost')} />
      </ChipRow>
      {prospects.isLoading ? (
        <ItemList className="mt-2">{[0, 1].map((i) => <div key={i} className="my-2 h-14 animate-pulse rounded-lg bg-[#F5F5F5] dark:bg-[#383838]" />)}</ItemList>
      ) : shown.length === 0 ? (
        <EmptyLine>Aucun prospect ici.</EmptyLine>
      ) : (
        <ItemList>
          {shown.map((p) => {
            const f = followUp(p);
            return (
              <ItemRow
                key={p.id}
                leading={<Initials name={prospectName(p)} />}
                title={prospectName(p)}
                subtitle={p.status === 'lost' && p.lost_reason ? p.lost_reason : prospectLine(p) || p.phone}
                tag={f && filter === 'open' ? { tone: f.tone, label: f.label } : prospectTag(p)}
                onClick={() => setOpen(p)}
              />
            );
          })}
        </ItemList>
      )}

      <SectionHead title="Ses clients" />
      {clients.isLoading ? null : (clients.data ?? []).length === 0 ? (
        <EmptyLine>Aucun client apporté.</EmptyLine>
      ) : (
        <ItemList>
          {(clients.data ?? []).map((c) => (
            <ItemRow
              key={c.user_id}
              leading={<Initials name={c.name} />}
              title={c.name}
              subtitle={[c.customer_code, `${shortXaf(c.payments_xaf)} ce mois`].filter(Boolean).join(' · ')}
              chevron
              onClick={() => navigate(`/m/clients/${c.user_id}`)}
            />
          ))}
        </ItemList>
      )}

      <MonthSheet open={pickMonth} onClose={() => setPickMonth(false)} value={month} onChange={setMonth} />
      <ActionSheet
        open={more.open}
        onClose={more.hide}
        title={title}
        actions={[
          { label: 'Objectifs', icon: Target, onClick: () => setView('objectives') },
          { label: 'Son accès', icon: KeyRound, hidden: !card.staff, onClick: () => card.staff && navigate(`${TEAM_BASE}/${card.staff.user_id}`) },
          { label: 'Ses fiches à vérifier', icon: ShieldQuestion, hidden: counts.to_verify === 0, onClick: () => navigate(`${PROSPECT_CLAIMS_PATH}?commercial=${sourceId}`) },
        ]}
      />
      <ActionSheet open={!!open} onClose={() => setOpen(null)} title={open ? prospectName(open) : undefined} actions={open ? prospectActions(open) : []} />
      {reassign && <ReassignSheet prospectId={reassign.id} sourceId={sourceId} name={reassign.first_name} onClose={() => setReassign(null)} />}
    </div>
  );
}

/* ── Objectifs du mois (10/22) ───────────────────────────────────────── */

const UNIT: Record<'count' | 'xaf' | 'kg' | 'cbm', string | null> = { count: null, xaf: 'XAF', kg: 'kg', cbm: 'm³' };
const SHORT_LABEL: Record<ObjectiveMetric, string> = {
  payments_xaf: 'Paiements', new_clients: 'Nouveaux clients', air_kg: 'Fret avion', sea_cbm: 'Bateau', prospects_new: 'Prospects ajoutés', prospects_won: 'Prospects convertis',
};
const ORDER: ObjectiveMetric[] = ['payments_xaf', 'new_clients', 'air_kg', 'sea_cbm', 'prospects_new', 'prospects_won'];

function actualOf(card: CommercialCard, metric: ObjectiveMetric): number {
  const m = card.metrics;
  return metric === 'payments_xaf' ? m.payments_xaf : metric === 'new_clients' ? m.new_clients : metric === 'air_kg' ? m.air_kg : metric === 'sea_cbm' ? m.sea_cbm : metric === 'prospects_new' ? m.prospects_new : m.prospects_won;
}
const fmt = (unit: 'count' | 'xaf' | 'kg' | 'cbm', n: number) => (unit === 'xaf' ? shortXaf(n) : n.toLocaleString('fr-FR', { maximumFractionDigits: unit === 'cbm' ? 1 : 0 }));
function parseTarget(v: string): number | null {
  const n = Number(v.replace(/\s/g, '').replace(',', '.'));
  return v.trim() === '' ? null : Number.isFinite(n) && n >= 0 ? n : NaN;
}

function ObjectivesView({ card, sourceId, month, onMonth, onBack }: { card: CommercialCard; sourceId: string; month: string; onMonth: (m: string) => void; onBack: () => void }) {
  const save = useSetObjective();
  const thisMonth = currentMonth();
  const initial = useMemo(
    () => Object.fromEntries(ORDER.map((k) => {
      const t = card.objectives.find((o) => o.metric === k)?.target;
      return [k, t != null && t > 0 ? t.toLocaleString('fr-FR', { maximumFractionDigits: 3 }) : ''];
    })) as Record<ObjectiveMetric, string>,
    [card.objectives],
  );
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [lastMonth, setLastMonth] = useState(month);
  if (lastMonth !== month) { setLastMonth(month); setValues(initial); }
  const invalid = ORDER.some((k) => Number.isNaN(parseTarget(values[k])));
  const first = (card.staff?.name || card.source.label).split(' ')[0];

  const submit = async () => {
    if (invalid || busy) return;
    setBusy(true);
    try {
      for (const k of ORDER) {
        const n = parseTarget(values[k]);
        if (n === parseTarget(initial[k])) continue;
        await save.mutateAsync({ sourceId, month, metric: k, target: n && n > 0 ? n : null });
      }
      toast.success('Objectifs enregistrés');
      onBack();
    } catch {
      /* le hook affiche l'erreur */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-[#1E1E1E]">
      <ScreenTop title={`Objectifs · ${first}`} onBack={onBack} />
      <div className="flex items-center justify-between px-3 pt-3">
        <button type="button" aria-label="Mois précédent" onClick={() => onMonth(shiftMonth(month, -1))} className={cn('flex h-11 w-11 items-center justify-center rounded-full', TEXT.strong, FOCUS_RING)}><ChevronLeft className="h-6 w-6" /></button>
        <span className={cn('text-[18px] font-semibold first-letter:uppercase', TEXT.strong)}>{monthLabel(month)}</span>
        <button type="button" aria-label="Mois suivant" disabled={month >= shiftMonth(thisMonth, 2)} onClick={() => onMonth(shiftMonth(month, 1))} className={cn('flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-30', TEXT.strong, FOCUS_RING)}><ChevronRight className="h-6 w-6" /></button>
      </div>
      <ItemList>
        {ORDER.map((k) => {
          const def = OBJECTIVES.find((o) => o.metric === k)!;
          const unit = UNIT[def.unit];
          const bad = Number.isNaN(parseTarget(values[k]));
          return (
            <div key={k} className={cn('flex items-center gap-3 border-b py-3.5 last:border-b-0', SURFACE.divider)}>
              <span className="min-w-0 flex-1">
                <span className={cn('block text-[17px] font-semibold', TEXT.strong)}>{SHORT_LABEL[k]}</span>
                <span className={cn('block text-[15px]', TEXT.muted)}>Réalisé {fmt(def.unit, actualOf(card, k))}{unit && def.unit !== 'xaf' ? ` ${unit}` : ''}</span>
              </span>
              <label className={cn('flex h-12 w-[150px] shrink-0 items-center gap-1.5 rounded-lg border bg-white px-3 dark:bg-[#2C2C2C]', bad ? 'border-[#C00F0C]' : 'border-[#949494] dark:border-[#6E6E6E]')}>
                <TargetInput value={values[k]} onChange={(v) => setValues((s) => ({ ...s, [k]: v }))} label={SHORT_LABEL[k]} />
                {unit && <span className={cn('shrink-0 text-[15px]', TEXT.muted)}>{unit}</span>}
              </label>
            </div>
          );
        })}
      </ItemList>
      <Dock>
        <BigButton onClick={() => void submit()} disabled={invalid} loading={busy}>Enregistrer</BigButton>
      </Dock>
    </div>
  );
}

function TargetInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    // eslint-disable-next-line no-restricted-syntax -- champ compact 17 px (pas de zoom iOS), dans la boîte à unité de la maquette 10/22
    <input
      inputMode="decimal"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn('h-full min-w-0 flex-1 bg-transparent text-right text-[17px] font-bold tabular-nums outline-none', TEXT.strong)}
    />
  );
}
