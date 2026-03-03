import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useRateAdjustments, useUpdateRateAdjustment } from '@/hooks/useDailyRates';
import { COUNTRIES, TIERS } from '@/types/rates';
import type { RateAdjustment } from '@/types/rates';
import { toast } from 'sonner';

export function RateConfigTab() {
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
      </div>
    );
  }

  if (isError || !adjustments) {
    return (
      <div className="bg-red-50 rounded-2xl p-6 text-center border border-red-200">
        <div className="text-red-600 font-semibold text-sm mb-1">Erreur de chargement</div>
        <div className="text-muted-foreground text-xs">
          Impossible de charger la configuration. Verifiez que la migration SQL a ete executee.
        </div>
      </div>
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

  const renderAdjustmentRow = (adj: RateAdjustment, meta: { flag?: string; label: string; shortLabel?: string }) => (
    <div
      key={adj.id}
      className={`flex items-center justify-between px-3 py-2.5 rounded-xl ${
        adj.is_reference ? 'bg-green-50 border border-green-200' : 'bg-muted/50 border border-border/50'
      }`}
    >
      <div className="flex items-center gap-2">
        {meta.flag && <span className="text-xl">{meta.flag}</span>}
        <div>
          <span className="text-sm font-medium text-foreground">
            {meta.shortLabel || meta.label}
          </span>
          {meta.shortLabel && (
            <div className="text-[11px] text-muted-foreground">{meta.label}</div>
          )}
        </div>
        {adj.is_reference && (
          <span className="text-[10px] font-semibold text-green-600 bg-green-100 px-2 py-0.5 rounded-xl">
            REF
          </span>
        )}
      </div>
      {adj.is_reference ? (
        <span className="text-sm font-bold text-green-600">0 %</span>
      ) : (
        <div className="flex items-center gap-1">
          <Input
            type="text"
            value={localValues[adj.id] ?? adj.percentage.toString()}
            onChange={(e) =>
              setLocalValues({ ...localValues, [adj.id]: e.target.value })
            }
            className="w-[60px] text-right text-sm font-bold text-red-600"
          />
          <span className="text-sm font-semibold text-muted-foreground">%</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Country adjustments */}
      <div className="bg-white rounded-[14px] p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">🌍</span>
          <h3 className="text-base font-bold text-foreground">Ajustements par pays</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3.5">
          Cameroun = reference (0%).
        </p>
        <div className="space-y-2">
          {countryAdjs.map((adj) =>
            renderAdjustmentRow(adj, {
              ...getCountryMeta(adj.key),
              flag: getCountryMeta(adj.key).flag,
            }),
          )}
        </div>
      </div>

      {/* Tier adjustments */}
      <div className="bg-white rounded-[14px] p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">📊</span>
          <h3 className="text-base font-bold text-foreground">Ajustements par tranche</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3.5">
          Pourcentage selon le montant.
        </p>
        <div className="space-y-2">
          {tierAdjs.map((adj) => {
            const tierMeta = getTierMeta(adj.key);
            return renderAdjustmentRow(adj, {
              label: tierMeta.label,
              shortLabel: tierMeta.shortLabel,
            });
          })}
        </div>
      </div>

      {/* Save button */}
      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-6 rounded-[14px] text-base font-bold shadow-lg"
        style={{
          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
        }}
      >
        {saving ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          'Sauvegarder la configuration'
        )}
      </Button>
    </div>
  );
}
