/**
 * Les trois matrices de croissance, branchées sur les données.
 *
 * Clients, dépôts, paiements — la même forme trois fois, parce que c'est la
 * même question posée à trois grandeurs : est-ce que ça monte, semaine après
 * semaine ou mois après mois ?
 *
 * Chaque bloc porte SON pas. On peut donc lire les clients par mois pendant
 * qu'on regarde les paiements par semaine — c'est le cas d'usage réel, les
 * trois grandeurs n'ayant pas le même rythme : une inscription est rare, un
 * paiement est quotidien.
 *
 * La fenêtre (douze périodes) est calculée par `buildGrowthRange` et ne suit
 * PAS le sélecteur du haut de l'écran : voir `growthWindow` pour le pourquoi.
 */
import { useMemo, useState } from 'react';
import { formatCurrencyFull, formatInteger } from '@/components/analytics';
import { useClientGrowth, useDepositVolumeReport, usePaymentVolumeReport } from '@/hooks/analytics/useAnalytics';
import { buildGrowthRange, type GrowthMode } from '@/lib/analytics/growthWindow';
import { GrowthMatrixBlock, buildGrowthBuckets, type GrowthInput } from './GrowthMatrixBlock';

const fmtXAF = (v: number) => formatCurrencyFull(v, 'XAF');
const fmtCount = (v: number) => formatInteger(v);

/** Le pas d'un bloc + la plage qui en découle. */
function useGrowthMode(initial: GrowthMode = 'week') {
  const [mode, setMode] = useState<GrowthMode>(initial);
  // La plage ne dépend que du pas et du JOUR : mémorisée, elle garde une clé
  // de requête stable d'un rendu à l'autre (sinon chaque rendu refait la
  // requête, `new Date()` changeant à chaque milliseconde).
  const range = useMemo(() => buildGrowthRange(mode), [mode]);
  return { mode, setMode, range };
}

/** Croissance des CLIENTS : combien de nouveaux inscrits par période. */
function ClientGrowthMatrix() {
  const { mode, setMode, range } = useGrowthMode('month');
  const query = useClientGrowth(range);
  const buckets = useMemo(() => {
    const points: GrowthInput[] = (query.data ?? []).map((p) => ({ bucket: p.bucket, value: p.newClients }));
    return buildGrowthBuckets(points, range);
  }, [query.data, range]);

  return (
    <GrowthMatrixBlock
      title="Croissance des clients"
      description="Nouveaux clients inscrits"
      mode={mode}
      onModeChange={setMode}
      buckets={buckets}
      loading={query.isLoading}
      color="#059669"
      format={fmtCount}
      unit="Nouveaux clients"
    />
  );
}

/** Croissance des DÉPÔTS : le volume validé par période. */
function DepositGrowthMatrix() {
  const { mode, setMode, range } = useGrowthMode('week');
  const query = useDepositVolumeReport(range);
  const buckets = useMemo(() => {
    const points: GrowthInput[] = (query.data?.series ?? []).map((p) => ({ bucket: p.bucket, value: p.amountXAF }));
    return buildGrowthBuckets(points, range);
  }, [query.data, range]);

  return (
    <GrowthMatrixBlock
      title="Croissance des dépôts"
      description="Volume validé"
      mode={mode}
      onModeChange={setMode}
      buckets={buckets}
      loading={query.isLoading}
      color="#4F46E5"
      format={fmtXAF}
      unit="Dépôts validés"
    />
  );
}

/** Croissance des PAIEMENTS : le volume exécuté par période. */
function PaymentGrowthMatrix() {
  const { mode, setMode, range } = useGrowthMode('week');
  const query = usePaymentVolumeReport(range);
  const buckets = useMemo(() => {
    const points: GrowthInput[] = (query.data?.series ?? []).map((p) => ({ bucket: p.bucket, value: p.amountXAF }));
    return buildGrowthBuckets(points, range);
  }, [query.data, range]);

  return (
    <GrowthMatrixBlock
      title="Croissance des paiements"
      description="Volume exécuté"
      mode={mode}
      onModeChange={setMode}
      buckets={buckets}
      loading={query.isLoading}
      color="#D97706"
      format={fmtXAF}
      unit="Paiements exécutés"
    />
  );
}

export function GrowthMatrixSection() {
  return (
    <section className="space-y-4">
      <header className="pt-2">
        <h3 className="text-[15px] font-bold tracking-[-0.01em] text-foreground">Croissance</h3>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
          Le rythme, sur douze périodes — indépendant de la période choisie en haut de l'écran
        </p>
      </header>
      <ClientGrowthMatrix />
      <DepositGrowthMatrix />
      <PaymentGrowthMatrix />
    </section>
  );
}
