// ============================================================
// ADMIN — Tarifs cargo : deux nombres que le fondateur change quand il veut,
// sans déploiement. XAF au kilo pour l'Air cargo (l'unité de facturation),
// XAF au mètre cube pour le Sea cargo. Ce sont les valeurs qui pré-remplissent
// chaque ligne de devis ; chaque ligne reste modifiable ensuite.
// Écriture : canManageRates (super_admin, ops). Les autres lisent.
// ============================================================
import { useEffect, useState } from 'react';
import { Plane, Ship } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCargoPricing, useSetCargoPricing } from '@/hooks/useCargoQuote';
import { xaf } from '@/lib/cargoQuote';
import { formatDateTime } from '@/mobile/components/reception/bits';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, Card, FormField, PrimaryPill, ScreenLoader, TextInput } from '@/mobile/designKit';

const num = (s: string) => { const v = parseFloat(s.replace(/\s/g, '').replace(',', '.')); return Number.isFinite(v) && v >= 0 ? v : null; };

export function MobileCargoPricing({ desktop = false }: { desktop?: boolean } = {}) {
  const { hasPermission } = useAdminAuth();
  const canEdit = hasPermission('canManageRates');
  const { data, isLoading } = useCargoPricing();
  const save = useSetCargoPricing();
  const [air, setAir] = useState('');
  const [sea, setSea] = useState('');
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!data || loaded) return;
    setAir(String(data.air_per_kg_xaf ?? 0)); setSea(String(data.sea_per_cbm_xaf ?? 0)); setLoaded(true);
  }, [data, loaded]);

  const a = num(air), s = num(sea);
  const dirty = data != null && (a !== Number(data.air_per_kg_xaf) || s !== Number(data.sea_per_cbm_xaf));
  const valid = a != null && s != null;

  const body = (
    <div className="space-y-5">
      <p className={cn(TYPE.body, TEXT.muted)}>
        Ce sont les prix qui pré-remplissent chaque colis dans un devis. Vous pouvez encore les changer colis par colis, et poser un montant fixe quand vous voulez.
      </p>
      <Card className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg text-white" style={{ background: '#C8102E' }}><Plane className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1">
            <span className={cn('block', TYPE.bodyStrong, TEXT.strong)}>Air cargo · au kilo</span>
            <span className={cn('block', TYPE.small, TEXT.muted)}>Les colis reçus au bureau.</span>
          </span>
        </div>
        <FormField label="Prix du kilo" htmlFor="pr-air" hint={a != null ? `Un colis de 8,4 kg = ${xaf(Math.round(8.4 * a))}` : 'Un nombre, en XAF'}>
          <div className="relative">
            <TextInput id="pr-air" value={air} onChange={(e) => setAir(e.target.value)} inputMode="decimal" disabled={!canEdit} className="h-14 pr-24 text-[22px] font-semibold tabular-nums" />
            <span className={cn('pointer-events-none absolute right-4 top-1/2 -translate-y-1/2', TYPE.bodyStrong, TEXT.muted)}>XAF / kg</span>
          </div>
        </FormField>
      </Card>
      <Card className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg text-white" style={{ background: '#0B5FA5' }}><Ship className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1">
            <span className={cn('block', TYPE.bodyStrong, TEXT.strong)}>Sea cargo · au mètre cube</span>
            <span className={cn('block', TYPE.small, TEXT.muted)}>Les colis reçus à l'entrepôt.</span>
          </span>
        </div>
        <FormField label="Prix du mètre cube" htmlFor="pr-sea" hint={s != null ? `Un carton de 60 × 40 × 40 cm (0,096 m³) = ${xaf(Math.round(0.096 * s))}` : 'Un nombre, en XAF'}>
          <div className="relative">
            <TextInput id="pr-sea" value={sea} onChange={(e) => setSea(e.target.value)} inputMode="decimal" disabled={!canEdit} className="h-14 pr-24 text-[22px] font-semibold tabular-nums" />
            <span className={cn('pointer-events-none absolute right-4 top-1/2 -translate-y-1/2', TYPE.bodyStrong, TEXT.muted)}>XAF / m³</span>
          </div>
        </FormField>
      </Card>
      {data?.updated_at && <p className={cn(TYPE.small, TEXT.muted)}>Dernière modification : {formatDateTime(data.updated_at)}</p>}
      {canEdit && (
        <PrimaryPill onClick={() => valid && save.mutate({ airPerKg: a!, seaPerCbm: s! })} disabled={!dirty || !valid} loading={save.isPending} className="h-14 w-full text-[17px]">
          Enregistrer les tarifs
        </PrimaryPill>
      )}
    </div>
  );

  if (desktop) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className={cn('mb-1 text-[20px] font-bold', TEXT.strong)}>Tarifs cargo</h1>
        <p className={cn('mb-5 text-[13px]', TEXT.muted)}>XAF au kilo (Air cargo), XAF au mètre cube (Sea cargo).</p>
        {isLoading || !data ? <ScreenLoader /> : body}
      </div>
    );
  }
  return (
    <div className={cn('flex min-h-full flex-col', SURFACE.canvas)}>
      <MobileHeader title="Tarifs cargo" subtitle="XAF au kilo · XAF au m³" showBack backTo="/m/more/settings" />
      <div className="flex-1 px-4 py-5 pb-28">{isLoading || !data ? <ScreenLoader /> : body}</div>
    </div>
  );
}
