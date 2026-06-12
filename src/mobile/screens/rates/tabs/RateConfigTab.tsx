// ============================================================
// MODULE TAUX — RateConfigTab (ajustements pays / tranches)
// Présentation migrée sur le design kit (Ofspace/Mola) : cartes
// blanches à ombre douce · lignes sans filet · badge REF en
// StatusPill success · CTA Sauvegarder en pilule.
// Logique 100% préservée : useRateAdjustments + useUpdateRate-
// Adjustment (RPC), localValues, handleSave (seuls les non-
// référence modifiés), métas pays/tranches, états load/erreur.
// ============================================================
import { useState, useEffect } from 'react';
import { Loader2, Globe, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TextField } from '@/components/form';
import { useRateAdjustments, useUpdateRateAdjustment } from '@/hooks/useDailyRates';
import { COUNTRIES, TIERS } from '@/types/rates';
import type { RateAdjustment } from '@/types/rates';
import { toast } from 'sonner';
import { SURFACE, TEXT, PrimaryPill, StatusPill, ScreenError } from '@/mobile/designKit';

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
        <Loader2 className="h-6 w-6 animate-spin text-[#8B5CF6]" />
      </div>
    );
  }

  if (isError || !adjustments) {
    return (
      <ScreenError
        title="Erreur de chargement"
        description="Impossible de charger la configuration. Vérifiez que la migration SQL a été exécutée."
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
      className={cn(
        'flex items-center justify-between rounded-xl px-3 py-2.5',
        adj.is_reference ? 'bg-[#DEEFE5] dark:bg-[#1E3A2C]' : SURFACE.canvas,
      )}
    >
      <div className="flex items-center gap-2">
        <div>
          <span className={cn('text-[14px] font-semibold', TEXT.strong)}>
            {meta.shortLabel || meta.label}
          </span>
          {meta.shortLabel && (
            <div className={cn('text-[11px]', TEXT.muted)}>{meta.label}</div>
          )}
        </div>
        {adj.is_reference && <StatusPill tone="success" label="REF" />}
      </div>
      {adj.is_reference ? (
        <span className="text-[14px] font-bold text-[#2E7D52] dark:text-[#7FCBA0]">0 %</span>
      ) : (
        <div className="flex items-center gap-1">
          <TextField
            variant="decimal"
            size="sm"
            value={localValues[adj.id] ?? adj.percentage.toString()}
            onChange={(e) =>
              setLocalValues({ ...localValues, [adj.id]: e.target.value })
            }
            wrapperClassName="w-[72px]"
            controlClassName="text-right font-bold text-[#C0504D] dark:text-[#E79A9A]"
            aria-label={`Ajustement ${meta.label}`}
          />
          <span className={cn('text-[14px] font-semibold', TEXT.muted)}>%</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Ajustements par pays */}
      <div className={cn('rounded-[18px] p-4', SURFACE.card, SURFACE.shadow)}>
        <div className="mb-3.5 flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EDEAFA] dark:bg-[#2A2738]">
            <Globe className={cn('h-[18px] w-[18px]', TEXT.strong)} />
          </div>
          <div>
            <h3 className={cn('text-[15px] font-bold leading-tight', TEXT.strong)}>Ajustements par pays</h3>
            <p className={cn('text-[11px]', TEXT.muted)}>Cameroun = référence (0%)</p>
          </div>
        </div>
        <div className="space-y-2">
          {countryAdjs.map((adj) =>
            renderAdjustmentRow(adj, { label: getCountryMeta(adj.key).label }),
          )}
        </div>
      </div>

      {/* Ajustements par tranche */}
      <div className={cn('rounded-[18px] p-4', SURFACE.card, SURFACE.shadow)}>
        <div className="mb-3.5 flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EDEAFA] dark:bg-[#2A2738]">
            <Layers className={cn('h-[18px] w-[18px]', TEXT.strong)} />
          </div>
          <div>
            <h3 className={cn('text-[15px] font-bold leading-tight', TEXT.strong)}>Ajustements par tranche</h3>
            <p className={cn('text-[11px]', TEXT.muted)}>Pourcentage selon le montant</p>
          </div>
        </div>
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

      {/* CTA Sauvegarder — pilule ambre (couleur Config) */}
      <PrimaryPill
        onClick={handleSave}
        loading={saving}
        className="w-full py-[15px] text-[15px] bg-[#E8932A] text-white dark:bg-[#E8932A] dark:text-white"
      >
        Sauvegarder la configuration
      </PrimaryPill>
    </div>
  );
}
