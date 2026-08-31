/**
 * Taux — carte E « Ajustements » (docs/admin-redesign/06).
 *
 * Pays et tranches côte à côte, toujours visibles (plus d'accordéon
 * « usage avancé » : ces pourcentages changent les prix, ils méritent
 * d'être sous les yeux). Le bouton de sauvegarde vit dans l'en-tête et
 * affiche le nombre de lignes modifiées ; il est inerte tant que rien
 * n'a changé. Mutations identiques au mobile (update_rate_adjustment).
 */
import { useEffect, useMemo, useState } from 'react';
import { Globe, Layers, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TextField } from '@/components/form';
import { useRateAdjustments, useUpdateRateAdjustment } from '@/hooks/useDailyRates';
import { COUNTRIES, TIERS } from '@/types/rates';
import type { RateAdjustment } from '@/types/rates';
import { SURFACE, TEXT, Card, CardHeader, StatusPill, ScreenLoader, ScreenError } from '@/desktop/designKit';

export function RateAdjustmentsCard() {
  const { data: adjustments, isLoading, isError } = useRateAdjustments();
  const updateAdjustment = useUpdateRateAdjustment();

  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (adjustments) {
      const vals: Record<string, string> = {};
      adjustments.forEach((a) => {
        vals[a.id] = a.percentage.toString();
      });
      setLocalValues(vals);
    }
  }, [adjustments]);

  const modified = useMemo(
    () =>
      (adjustments ?? []).filter(
        (a) => !a.is_reference && localValues[a.id] !== undefined && localValues[a.id] !== a.percentage.toString(),
      ),
    [adjustments, localValues],
  );

  const handleSave = async () => {
    if (saving || modified.length === 0) return;
    setSaving(true);
    try {
      for (const adj of modified) {
        const pct = parseFloat(localValues[adj.id]);
        if (isNaN(pct)) continue;
        await updateAdjustment.mutateAsync({ adjustmentId: adj.id, percentage: pct });
      }
    } catch {
      // Error handled by the mutation's onError
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="p-0">
        <CardHeader title="Ajustements pays & tranches" />
        <ScreenLoader />
      </Card>
    );
  }
  if (isError || !adjustments) {
    return (
      <Card className="p-0">
        <CardHeader title="Ajustements pays & tranches" />
        <ScreenError title="Erreur de chargement" description="Impossible de charger la configuration." />
      </Card>
    );
  }

  const countryAdjs = adjustments.filter((a) => a.type === 'country');
  const tierAdjs = adjustments.filter((a) => a.type === 'tier');
  const countryMeta = (key: string) => COUNTRIES.find((c) => c.key === key)?.label ?? key;
  const tierMeta = (key: string) => TIERS.find((t) => t.key === key) ?? { shortLabel: key, label: key };

  const row = (adj: RateAdjustment, label: string, sub?: string) => {
    const dirty = !adj.is_reference && localValues[adj.id] !== undefined && localValues[adj.id] !== adj.percentage.toString();
    return (
      <div
        key={adj.id}
        className={cn(
          'flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5',
          adj.is_reference ? 'bg-[#DEEFE5] dark:bg-[#1E3A2C]' : SURFACE.canvas,
          dirty && 'ring-1 ring-[#E8932A]',
        )}
      >
        <div className="min-w-0 leading-[15px]">
          <span className={cn('flex items-center gap-1.5 text-[12.5px] font-semibold', TEXT.strong)}>
            {label}
            {adj.is_reference && <StatusPill tone="success" label="REF" />}
          </span>
          {sub && <span className={cn('block text-[10.5px]', TEXT.muted)}>{sub}</span>}
        </div>
        {adj.is_reference ? (
          <span className="shrink-0 text-[12.5px] font-bold text-[#2E7D52] dark:text-[#7FCBA0]">0 %</span>
        ) : (
          <div className="flex shrink-0 items-center gap-1">
            <TextField
              variant="decimal"
              size="sm"
              value={localValues[adj.id] ?? adj.percentage.toString()}
              onChange={(e) => setLocalValues((prev) => ({ ...prev, [adj.id]: e.target.value }))}
              wrapperClassName="w-[64px]"
              controlClassName="h-8 text-right text-[12.5px] font-bold text-[#C0504D] dark:text-[#E79A9A]"
              aria-label={`Ajustement ${label}`}
            />
            <span className={cn('text-[12px] font-semibold', TEXT.muted)}>%</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="p-0">
      <CardHeader
        title="Ajustements pays & tranches"
        meta={
          <button
            type="button"
            onClick={handleSave}
            disabled={modified.length === 0 || saving}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-bold transition',
              modified.length > 0 ? 'bg-[#E8932A] text-white' : cn(SURFACE.holder, TEXT.muted, 'cursor-default'),
            )}
          >
            {saving && <Loader2 className="h-3 w-3 animate-spin" />}
            {modified.length > 0 ? `Sauvegarder (${modified.length})` : 'À jour'}
          </button>
        }
      />
      <div className="space-y-4 p-4">
        <div>
          <div className={cn('mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider', TEXT.muted)}>
            <Globe className="h-3 w-3" /> Pays — Cameroun = référence
          </div>
          <div className="space-y-1.5">{countryAdjs.map((adj) => row(adj, countryMeta(adj.key)))}</div>
        </div>
        <div>
          <div className={cn('mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider', TEXT.muted)}>
            <Layers className="h-3 w-3" /> Tranches de montant
          </div>
          <div className="space-y-1.5">
            {tierAdjs.map((adj) => {
              const m = tierMeta(adj.key);
              return row(adj, m.shortLabel, m.label);
            })}
          </div>
        </div>
        {modified.length > 0 && (
          <p className={cn('text-[11px]', TEXT.muted)}>
            {modified.length} modification{modified.length > 1 ? 's' : ''} non sauvegardée{modified.length > 1 ? 's' : ''} —
            les nouveaux pourcentages s'appliqueront immédiatement à tous les calculs.
          </p>
        )}
      </div>
    </Card>
  );
}
