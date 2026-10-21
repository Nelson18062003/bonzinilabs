// ============================================================
// ESPACE COMMERCIAL — « Mon mois » (refonte v2, maquette 03/15).
//
// Façon Wave : les paiements de ses clients du mois choisi (« Octobre ⌄ »),
// la barre de l'objectif et son rythme ; trois ronds — Prospect (noir),
// Relances, Mes clients ; les fiches « À vérifier » s'il y en a ; les
// prospects à relancer. Plus bas, sur le même écran : ses autres objectifs,
// ses clients, ses prospects (l'entonnoir, chaque ligne ouvre la liste
// filtrée) et le fret. Mot de passe et déconnexion : le rond du compte en
// haut à droite (et Plus).
//
// Deux lectures, limitées à SA fiche : commercial_dashboard (sa fiche, ses
// objectifs, ses prospects ouverts et à relancer) et sales_series (le mois
// choisi, pour les vols et les perdus) ; sans sales_series, les chiffres
// viennent de commercial_dashboard (HomeData.ts).
// ============================================================
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, KeyRound, LogOut, Phone, Plus, UserRound, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCommercialDashboard, useProspects, useSalesSeries } from '@/hooks/useSales';
import { OBJECTIVES, currentMonth, fmtObjective, shiftMonth } from '@/lib/sales';
import { isNativeApp } from '@/lib/nativeApp';
import { formatE164ForDisplay } from '@/components/form/PhoneNumberInput';
import {
  ActionCircles, ActionSheet, EmptyLine, Initials, ItemList, ItemRow, KVBox, RoundButton, SectionHead, Tag, TabTop, TEXT, SURFACE, FOCUS_RING,
  useSheet, type CircleAction, type KV,
} from '@/mobile/designKit';
import { ProgressBar, shortXaf } from '@/mobile/screens/clients/parts';
import { MonthSheet, monthName } from '@/mobile/screens/team/teamParts';
import { PACE_TAG, followUp, prospectLine } from '@/mobile/screens/team/prospectBits';
import { UnlinkedNotice } from './SalesBits';
import { figuresFromMetrics, figuresFromSeries, monthClock, objectivePace } from './HomeData';
import { isDue, isUnlinkedError, prospectName } from './salesHelpers';

function greeting(now = new Date()): string {
  const hour = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Africa/Douala' }).formatToParts(now).find((p) => p.type === 'hour')?.value;
  return Number(hour ?? 12) >= 18 ? 'Bonsoir' : 'Bonjour';
}

const n = (v: number | null | undefined, d = 0) => (v == null ? '—' : v.toLocaleString('fr-FR', { maximumFractionDigits: d }).replace(/\u202F/g, '\u00A0'));

export function CommercialHome() {
  const navigate = useNavigate();
  const { currentUser, logout } = useAdminAuth();
  const thisMonth = useMemo(() => currentMonth(), []);
  const [month, setMonth] = useState(thisMonth);
  const [pickMonth, setPickMonth] = useState(false);
  const account = useSheet();
  const dash = useCommercialDashboard(month);
  const unlinked = dash.isError && isUnlinkedError(dash.error);
  const series = useSalesSeries({ from: month, to: shiftMonth(month, 1), grain: 'month' }, !unlinked);
  const prospects = useProspects();

  const card = dash.data;
  const m = card?.metrics;
  const archived = !!card && !card.source.is_active;
  const figures = figuresFromSeries(series.data, month) ?? figuresFromMetrics(m);
  const list = prospects.data ?? [];
  const toVerify = list.filter((p) => p.status === 'to_verify').length;
  const due = list.filter((p) => isDue(p)).sort((a, b) => new Date(a.next_action_at ?? 0).getTime() - new Date(b.next_action_at ?? 0).getTime());
  const payObj = card?.objectives.find((o) => o.metric === 'payments_xaf');
  const pace = payObj && payObj.target > 0 ? objectivePace(payObj, monthClock(month)) : null;
  const name = [currentUser?.firstName, currentUser?.lastName].filter(Boolean).join(' ') || currentUser?.email || '';

  const signOut = async () => {
    try { await logout(); } finally { navigate('/v/login', { replace: true }); }
  };

  const circles: CircleAction[] = [
    { label: 'Prospect', icon: Plus, primary: true, disabled: archived || unlinked, onClick: () => navigate('/v/prospects/new') },
    { label: 'Relances', icon: Phone, badge: m?.prospects_due ?? due.length, onClick: () => navigate('/v/prospects?filtre=relancer') },
    { label: 'Mes clients', icon: Users, onClick: () => navigate('/v/clients') },
  ];

  const objectiveRows: KV[] = (card?.objectives ?? [])
    .filter((o) => o.metric !== 'payments_xaf' && o.target > 0)
    .map((o) => {
      const def = OBJECTIVES.find((x) => x.metric === o.metric)!;
      const p = objectivePace(o, monthClock(month));
      return { label: def.label, value: <>{fmtObjective(def.unit, o.actual)} / {fmtObjective(def.unit, o.target)} <Tag tone={PACE_TAG[p.status].tone} className="ml-1.5 align-middle">{Math.round(p.pct)} %</Tag></> };
    });

  const funnel = (label: string, value: number | null, filtre: string | null): KV => ({ label, value: n(value), onClick: () => navigate(filtre ? `/v/prospects?filtre=${filtre}` : '/v/prospects') });

  return (
    <div className="flex min-h-full flex-col bg-white pb-6 dark:bg-[#1E1E1E]">
      <TabTop
        title={`${greeting()}${currentUser?.firstName ? ` ${currentUser.firstName}` : ''}`}
        right={<RoundButton icon={UserRound} ariaLabel="Mon compte" onClick={account.show} />}
      />

      {unlinked ? (
        <div className="px-5 pt-4">
          <UnlinkedNotice message={(dash.error as Error).message} onRetry={() => void dash.refetch()} />
        </div>
      ) : (
        <>
          <div className="px-5 pt-3.5">
            <div className={cn('rounded-lg border px-[18px] pb-4 pt-[18px]', SURFACE.divider)}>
              <div className="flex items-start justify-between gap-3">
                <span className={cn('text-[16px] font-medium', TEXT.muted)}>Paiements de mes clients</span>
                <button type="button" onClick={() => setPickMonth(true)} className={cn('-mr-1 inline-flex h-8 items-center gap-1 rounded px-1 text-[16px] font-semibold', TEXT.strong, FOCUS_RING)}>
                  {monthName(month)} <ChevronDown className="h-4 w-4" />
                </button>
              </div>
              <div className={cn('mt-1.5 text-[40px] font-bold leading-[1.1] tracking-[-0.02em] tabular-nums', TEXT.strong)}>
                {figures ? shortXaf(figures.payments_xaf ?? 0) : '—'}
                <span className={cn('ml-1.5 text-[20px] font-semibold', TEXT.muted)}>XAF</span>
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
                card && <p className={cn('mt-2 text-[16px]', TEXT.muted)}>{archived ? 'Fiche archivée' : 'Pas d’objectif ce mois'}</p>
              )}
            </div>
          </div>

          <ActionCircles actions={circles} />

          {toVerify > 0 && (
            <ItemList className="pt-3">
              <ItemRow
                className="rounded-lg border !border-b border-[#D9D9D9] px-3.5 dark:border-[#444444]"
                leading={<span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F5F5F5] text-[22px] font-bold dark:bg-[#383838]">!</span>}
                title="À vérifier"
                subtitle="Numéros déjà clients"
                tag={{ tone: 'pending', label: String(toVerify) }}
                chevron
                onClick={() => navigate('/v/prospects?filtre=a-verifier')}
              />
            </ItemList>
          )}

          <SectionHead title="À relancer" link={{ label: 'Tout voir', onClick: () => navigate('/v/prospects?filtre=relancer') }} />
          {prospects.isLoading ? (
            <ItemList>{[0, 1].map((i) => <div key={i} className="my-2 h-14 animate-pulse rounded-lg bg-[#F5F5F5] dark:bg-[#383838]" />)}</ItemList>
          ) : due.length === 0 ? (
            <EmptyLine>Rien à relancer.</EmptyLine>
          ) : (
            <ItemList>
              {due.slice(0, 3).map((p) => {
                const f = followUp(p);
                return (
                  <ItemRow
                    key={p.id}
                    leading={<Initials name={prospectName(p)} />}
                    title={prospectName(p)}
                    subtitle={prospectLine(p) || formatE164ForDisplay(p.phone_e164 || p.phone)}
                    tag={f ? { tone: f.tone, label: f.label } : undefined}
                    onClick={() => navigate(`/v/prospects/${p.id}`)}
                  />
                );
              })}
            </ItemList>
          )}

          {objectiveRows.length > 0 && (
            <>
              <SectionHead title="Mes objectifs" />
              <div className="px-5"><KVBox rows={objectiveRows} /></div>
            </>
          )}

          {figures && (
            <>
              <SectionHead title="Mes clients" />
              <div className="px-5">
                <KVBox
                  rows={[
                    { label: 'Nouveaux', value: n(figures.new_clients) },
                    { label: 'Au total', value: n(figures.clients_total) },
                    { label: 'Actifs', value: n(figures.active_clients) },
                    { label: 'Dépôts', value: `${shortXaf(figures.deposits_xaf ?? 0)} XAF` },
                  ]}
                />
              </div>
              <SectionHead title="Mes prospects" />
              <div className="px-5">
                <KVBox
                  rows={[
                    funnel('Ajoutés', figures.prospects_new, 'tous'),
                    funnel('En cours', m?.prospects_open ?? null, null),
                    funnel('Devenus clients', figures.prospects_won, 'clients'),
                    funnel('Perdus', figures.prospects_lost, 'perdus'),
                  ]}
                />
              </div>
              <SectionHead title="Fret" />
              <div className="px-5">
                <KVBox
                  rows={[
                    { label: 'Avion', value: `${n(figures.air_kg, 1)} kg · ${n(figures.air_parcels)} colis` },
                    { label: 'Vols', value: n(figures.flights) },
                    { label: 'Bateau', value: `${n(figures.sea_cbm, 2)} m³ · ${n(figures.sea_parcels)} colis` },
                  ]}
                />
              </div>
            </>
          )}
        </>
      )}

      <MonthSheet open={pickMonth} onClose={() => setPickMonth(false)} value={month} onChange={setMonth} />
      <ActionSheet
        open={account.open}
        onClose={account.hide}
        title={name}
        actions={[
          { label: 'Mon mot de passe', icon: KeyRound, hidden: isNativeApp(), onClick: () => navigate('/v/password') },
          { label: 'Se déconnecter', icon: LogOut, danger: true, onClick: () => void signOut() },
        ]}
      />
    </div>
  );
}
