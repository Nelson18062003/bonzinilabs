/**
 * Ajustements pays & tranches — les pourcentages appliqués au taux de base.
 *
 * Rebuilt off `@/mobile/screens/rates/tabs/RateConfigTab` (still owned by the
 * phone). Presentation only: the rows are `DS.well` strips with a 32px `Input`
 * instead of 44px mobile fields, the REF marker is the console's `Badge`, and
 * the save action is a `Button` rather than a 47px pill.
 *
 * **`handleSave` is moved verbatim** — same "only non-reference rows whose
 * string value differs" predicate, same `parseFloat` + `isNaN` skip, same
 * sequential `mutateAsync` through `useUpdateRateAdjustment` (the
 * `update_rate_adjustment` SECURITY DEFINER RPC on `supabaseAdmin`), same
 * `toast.info('Aucune modification')` when nothing changed, same swallow of
 * the error the mutation already reports.
 */
import { useState, useEffect } from 'react';
import { AlertTriangle, Save } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useRateAdjustments, useUpdateRateAdjustment } from '@/hooks/useDailyRates';
import { COUNTRIES, TIERS } from '@/types/rates';
import type { RateAdjustment } from '@/types/rates';
import { DS, DT, DFG } from '@/desktop/ui/tokens';
import { Badge, Button, EmptyState, Input, Panel, PanelHead, Spinner } from '@/desktop/ui/primitives';

export function RateAdjustmentsPanel() {
  const { data: adjustments, isLoading, isError } = useRateAdjustments();
  const updateAdjustment = useUpdateRateAdjustment();

  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Initialize local values from fetched adjustments
  useEffect(() => {
    if (adjustments) {
      const vals: Record<string, string> = {};
      adjustments.forEach((a) => {
        vals[a.id] = a.percentage.toString();
      });
      setLocalValues(vals);
    }
  }, [adjustments]);

  if (isLoading) return <Spinner />;

  if (isError || !adjustments) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Erreur de chargement"
        hint="Impossible de charger la configuration. Vérifiez que la migration SQL a été exécutée."
      />
    );
  }

  const countryAdjs = adjustments.filter((a) => a.type === 'country');
  const tierAdjs = adjustments.filter((a) => a.type === 'tier');

  // Find matching flag/label from constants
  const getCountryMeta = (key: string) =>
    COUNTRIES.find((c) => c.key === key) || { flag: '', label: key };
  const getTierMeta = (key: string) =>
    TIERS.find((t) => t.key === key) || { shortLabel: key, label: key };

  const handleSave = async () => {
    setSaving(true);
    try {
      const modified = adjustments.filter(
        (a) => !a.is_reference && localValues[a.id] !== a.percentage.toString(),
      );

      for (const adj of modified) {
        const pct = parseFloat(localValues[adj.id]);
        if (isNaN(pct)) continue;
        await updateAdjustment.mutateAsync({
          adjustmentId: adj.id,
          percentage: pct,
        });
      }

      if (modified.length === 0) {
        toast.info('Aucune modification');
      }
    } catch {
      // Error handled by the mutation's onError
    } finally {
      setSaving(false);
    }
  };

  const renderAdjustmentRow = (adj: RateAdjustment, meta: { label: string; shortLabel?: string }) => (
    <div
      key={adj.id}
      className={cn('flex items-center justify-between gap-3 rounded-lg px-3 py-2', DS.well)}
    >
      <span className="min-w-0">
        <span className={cn('block truncate font-semibold', DT.body, DFG.strong)}>
          {meta.shortLabel || meta.label}
        </span>
        {meta.shortLabel ? (
          <span className={cn('block truncate', DT.label, DFG.faint)}>{meta.label}</span>
        ) : null}
      </span>
      {adj.is_reference ? (
        <Badge tone="success">REF · 0 %</Badge>
      ) : (
        <span className="flex shrink-0 items-center gap-2">
          <Input
            inputMode="decimal"
            value={localValues[adj.id] ?? adj.percentage.toString()}
            onChange={(e) => setLocalValues({ ...localValues, [adj.id]: e.target.value })}
            className="w-20 text-right font-bold tabular-nums"
            aria-label={`Ajustement ${meta.label}`}
          />
          <span className={cn(DT.label, DFG.muted)}>%</span>
        </span>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHead title="Ajustements par pays" hint="Cameroun = référence (0 %)" />
        <div className="space-y-2 p-3">
          {countryAdjs.map((adj) => renderAdjustmentRow(adj, { label: getCountryMeta(adj.key).label }))}
        </div>
      </Panel>

      <Panel>
        <PanelHead title="Ajustements par tranche" hint="Pourcentage selon le montant" />
        <div className="space-y-2 p-3">
          {tierAdjs.map((adj) => {
            const tierMeta = getTierMeta(adj.key);
            return renderAdjustmentRow(adj, {
              label: tierMeta.label,
              shortLabel: tierMeta.shortLabel,
            });
          })}
        </div>
      </Panel>

      <Button variant="primary" icon={Save} loading={saving} onClick={handleSave} className="w-full">
        Sauvegarder la configuration
      </Button>
    </div>
  );
}
