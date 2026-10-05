// ============================================================
// Mes équipes › Chiffres des commerciaux — tous les commerciaux côte à côte
// pour un mois de Douala : clients apportés, paiements de leurs clients,
// fret avion (kg) et bateau (m³), prospects, et l'avancement de leurs
// objectifs. Lecture : sales_overview (canManageSales, garde serveur).
// ============================================================
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ChevronRight, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useSalesOverview } from '@/hooks/useSales';
import { OBJECTIVES, currentMonth, fmtCbm, fmtCount, fmtKg, fmtXaf, monthLabel, type CommercialCard } from '@/lib/sales';
import { MonthSwitcher, ObjectiveBar } from '@/components/sales/SalesBits';
import { BTN_PRIMARY, CARD, Initials, Skeleton } from './TeamBits';
import { TEAM_BASE } from './TeamScreen';

export function SalesBoard() {
  const { hasPermission } = useAdminAuth();
  if (!hasPermission('canManageSales')) return <Navigate to="/m" replace />;
  return <Board />;
}

function Board() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(currentMonth());
  const overview = useSalesOverview(month);
  const rows = overview.data ?? [];
  const sum = rows.reduce(
    (s, r) => ({
      newClients: s.newClients + r.metrics.new_clients,
      pay: s.pay + r.metrics.payments_xaf,
      air: s.air + r.metrics.air_kg,
      sea: s.sea + r.metrics.sea_cbm,
      won: s.won + r.metrics.prospects_won,
    }),
    { newClients: 0, pay: 0, air: 0, sea: 0, won: 0 },
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-0">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <button type="button" onClick={() => navigate(TEAM_BASE)} className="mb-1 inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Mes équipes
          </button>
          <h1 className="text-[26px] font-bold tracking-tight">Les commerciaux</h1>
          <p className="mt-0.5 text-[14px] text-muted-foreground">Ce que chacun a apporté en {monthLabel(month)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthSwitcher month={month} onChange={setMonth} />
          <button type="button" onClick={() => navigate(`${TEAM_BASE}/nouveau?role=commercial`)} className={BTN_PRIMARY}>
            <Plus className="h-4 w-4" /> Commercial
          </button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3">
        <Figure label="Nouveaux clients" value={overview.isLoading ? '…' : fmtCount(sum.newClients)} />
        <Figure label="Paiements" value={overview.isLoading ? '…' : fmtXaf(sum.pay)} />
        <Figure label="Fret avion" value={overview.isLoading ? '…' : fmtKg(sum.air)} />
        <Figure label="Fret bateau" value={overview.isLoading ? '…' : fmtCbm(sum.sea)} />
        <Figure label="Prospects devenus clients" value={overview.isLoading ? '…' : fmtCount(sum.won)} />
      </section>

      {overview.isLoading ? (
        <div className={CARD}>
          <Skeleton rows={3} />
        </div>
      ) : overview.isError ? (
        <div className={cn(CARD, 'p-8 text-center text-[14px]')}>
          Les chiffres n’ont pas pu être chargés.{' '}
          <button type="button" onClick={() => void overview.refetch()} className="font-semibold underline">
            Réessayer
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className={cn(CARD, 'p-10 text-center text-[14px] text-muted-foreground')}>
          Aucun commercial pour l’instant. Créez l’accès d’un commercial : sa fiche est créée avec, et la réception pourra lui attribuer ses clients.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((r) => (
            <CommercialTile key={r.source.id} card={r} onOpen={() => navigate(`${TEAM_BASE}/ventes/${r.source.id}`)} />
          ))}
        </div>
      )}
      <p className="text-[12.5px] leading-relaxed text-muted-foreground">
        Paiements : terminés dans le mois, pour les clients dont le commercial est l’origine. Colis : enregistrés dans le mois (avion = bureau de Guangzhou, bateau =
        entrepôt), dépôts annulés exclus. Mois de Douala.
      </p>
    </div>
  );
}

function CommercialTile({ card, onOpen }: { card: CommercialCard; onOpen: () => void }) {
  const m = card.metrics;
  const name = card.staff?.name || card.source.label;
  return (
    <button type="button" onClick={onOpen} className={cn(CARD, 'w-full space-y-4 p-5 text-left transition hover:ring-primary/40')}>
      <div className="flex items-center gap-3">
        <Initials name={name} disabled={!card.staff || card.staff.is_disabled} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15.5px] font-semibold">{name}</div>
          <div className="text-[12.5px] text-muted-foreground">
            {card.staff ? (card.staff.is_disabled ? 'accès désactivé' : `fiche « ${card.source.label} »`) : 'fiche sans compte'}
            {!card.source.is_active && ' · archivée'}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px] tabular-nums">
        <Line label="Clients" value={`${fmtCount(m.clients)}${m.new_clients ? ` (+${m.new_clients})` : ''}`} />
        <Line label="Paiements" value={m.payments_xaf ? fmtXaf(m.payments_xaf) : '—'} />
        <Line label="Avion" value={m.air_parcels ? `${fmtKg(m.air_kg)} · ${m.air_parcels} colis` : '—'} />
        <Line label="Bateau" value={m.sea_parcels ? `${fmtCbm(m.sea_cbm)} · ${m.sea_parcels} colis` : '—'} />
        <Line label="Prospects ouverts" value={fmtCount(m.prospects_open)} />
        <Line label="Devenus clients" value={fmtCount(m.prospects_won)} />
      </div>

      {m.prospects_due > 0 && (
        <div className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-amber-700 dark:text-amber-400">
          <AlertCircle className="h-3.5 w-3.5" /> {m.prospects_due} prospect{m.prospects_due > 1 ? 's' : ''} à relancer
        </div>
      )}

      {card.objectives.length > 0 ? (
        <div className="space-y-2.5 border-t border-border/60 pt-3">
          {OBJECTIVES.filter((o) => card.objectives.some((x) => x.metric === o.metric)).map((o) => (
            <ObjectiveBar key={o.metric} objective={card.objectives.find((x) => x.metric === o.metric)!} />
          ))}
        </div>
      ) : (
        <div className="border-t border-border/60 pt-3 text-[12.5px] text-muted-foreground">Pas d’objectif ce mois-ci.</div>
      )}
    </button>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className={cn(CARD, 'p-3.5 sm:p-4')}>
      <div className="text-[12px] font-medium leading-tight text-muted-foreground">{label}</div>
      <div className="mt-1 text-[18px] font-bold tracking-tight tabular-nums sm:text-[20px]">{value}</div>
    </div>
  );
}
