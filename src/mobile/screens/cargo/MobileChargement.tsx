/**
 * « Le chargement en 3D » — ce qu'il y a dans la boîte et la place qu'il
 * reste, en phrases.
 *
 * « La boîte est remplie à 52 % : 39,9 m³ sur 76,4 m³. » puis le poids, les
 * étages, ce qui ne colle pas (colis annoncés ≠ colis saisis, lots qui ne
 * rentrent pas), la boîte en 3D, et les lots un par un avec « Retirer ».
 * L'ajout d'un lot se fait dans une feuille basse : quoi, quel type,
 * combien, quelles dimensions, quel poids — en centimètres et kilos, comme
 * sur la packing list chinoise.
 */
import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAddCargoPackage, useCargoPackages, useDeleteCargoPackage } from '@/hooks/useCargo';
import { Container3D } from '@/components/cargo/Container3D';
import { buildLoadPlan, containerDims, lotColor } from '@/lib/cargo/loadplan';
import type { CargoPackage, CargoShipment } from '@/lib/cargo/model';
import { plural } from '@/lib/cargo/plain';
import { cn } from '@/lib/utils';
import { TEXT, SURFACE, BottomSheet, Button, FormField, IconButton, Line, TextInput } from '@/mobile/designKit';
import { Pick } from './Pick';

const KINDS = ['CARTON', 'PALLET', 'CRATE', 'BAG', 'DRUM', 'BUNDLE', 'OTHER'] as const;
const KIND_LABEL: Record<string, string> = { CARTON: 'Carton', PALLET: 'Palette', CRATE: 'Caisse', BAG: 'Sac', DRUM: 'Fût', BUNDLE: 'Fagot', OTHER: 'Autre' };
/** « 220 cartons », « 1 caisse ». */
const KIND_PLURAL: Record<string, [string, string]> = {
  CARTON: ['carton', 'cartons'], PALLET: ['palette', 'palettes'], CRATE: ['caisse', 'caisses'], BAG: ['sac', 'sacs'],
  DRUM: ['fût', 'fûts'], BUNDLE: ['fagot', 'fagots'], OTHER: ['colis', 'colis'],
};

const pct = (v: number) => `${Math.round(v * 100)} %`;
const num = (v: number, d = 1) => v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const toNum = (v: string) => { const n = Number(v.replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) ? n : NaN; };

function lotSentence(p: CargoPackage): string {
  const [one, many] = KIND_PLURAL[p.kind] ?? KIND_PLURAL.OTHER;
  const what = plural(p.qty, one, many);
  const dims = `${num(Number(p.length_cm), 0)} × ${num(Number(p.width_cm), 0)} × ${num(Number(p.height_cm), 0)} cm`;
  const kg = p.weight_kg != null ? `, ${num(Number(p.weight_kg), 1)} kg ${p.qty > 1 ? 'chacun' : ''}`.trimEnd() : '';
  return `${what} de ${dims}${kg}${p.stackable === false ? ', à ne pas empiler' : ''}.`;
}

export function MobileChargement({ shipment: s, canManage }: { shipment: CargoShipment; canManage: boolean }) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const { data: packages } = useCargoPackages(s.id);
  const add = useAddCargoPackage();
  const remove = useDeleteCargoPackage();
  const [open, setOpen] = useState(false);
  const [toRemove, setToRemove] = useState<CargoPackage | null>(null);

  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<(typeof KINDS)[number]>('CARTON');
  const [qty, setQty] = useState('1');
  const [L, setL] = useState('');
  const [W, setW] = useState('');
  const [H, setH] = useState('');
  const [kg, setKg] = useState('');

  const list = useMemo(() => packages ?? [], [packages]);
  const plan = useMemo(() => buildLoadPlan(s.container_iso, list), [s.container_iso, list]);
  const spec = containerDims(s.container_iso);
  const declared = s.packages_count;
  const counted = list.reduce((n, p) => n + p.qty, 0);
  const mismatch = declared != null && counted > 0 && declared !== counted;

  const q = toNum(qty), l = toNum(L), w = toNum(W), h = toNum(H), k = kg.trim() === '' ? null : toNum(kg);
  const canSubmit = label.trim().length > 0 && q > 0 && l > 0 && w > 0 && h > 0 && (k === null || k >= 0) && !add.isPending;
  const submit = () => {
    if (!canSubmit) return;
    add.mutate(
      { shipmentId: s.id, pkg: { label: label.trim(), kind, qty: Math.round(q), length_cm: l, width_cm: w, height_cm: h, weight_kg: k, position: list.length } },
      { onSuccess: () => { setOpen(false); setLabel(''); setQty('1'); setL(''); setW(''); setH(''); setKg(''); } },
    );
  };

  return (
    <div className="space-y-4">
      <Line>La boîte est un <b className={TEXT.strong}>{spec.label}</b> : {num(spec.length / 100, 2)} m de long, {num(spec.width / 100, 2)} m de large, {num(spec.height / 100, 2)} m de haut à l'intérieur.</Line>

      {list.length === 0 ? (
        <>
          <Line>Aucun colis saisi pour l'instant.</Line>
          <Line className={TEXT.muted}>
            Reprenez la packing list du fournisseur : une ligne par lot de colis identiques, avec ses dimensions en centimètres.
            La boîte se dessine toute seule et on voit tout de suite la place perdue.
          </Line>
        </>
      ) : (
        <>
          <Line>
            Remplie à <b className={TEXT.strong}>{pct(plan.fill)}</b> : {num(plan.usedVolumeM3, 1)} m³ occupés sur {num(plan.containerVolumeM3, 1)} m³.
          </Line>
          {plan.totalWeightKg === 0
            ? <Line tone="warn">Aucun poids saisi : on ne peut pas vérifier la charge.</Line>
            : <Line tone={plan.weightFill > 1 ? 'bad' : undefined}>
                Poids : <b className={TEXT.strong}>{num(plan.totalWeightKg, 0)} kg</b> sur {num(plan.maxPayloadKg, 0)} kg admissibles ({pct(plan.weightFill)}).
                {plan.weightFill > 1 && " C'est trop lourd."}
              </Line>}
          <Line>
            {plural(plan.layers, 'étage')} de colis, jusqu'à {num(plan.stackHeight / 100, 2)} m sur {num(plan.dims.height / 100, 2)} m de hauteur utile.
          </Line>
          {mismatch && (
            <Line tone="warn">
              {plural(counted, 'colis', 'colis')} saisis contre {declared} annoncés dans le dossier : l'un des deux est faux, et c'est le genre d'écart que la douane relève.
            </Line>
          )}
          {plan.leftOut.map((o, i) => (
            <Line key={i} tone="bad">{o.qty} × {o.label} ne tiennent pas : {o.why}.</Line>
          ))}
          <Container3D iso={s.container_iso} packages={list} dark={dark} />
        </>
      )}

      {canManage && (
        <Button variant={list.length === 0 ? 'primary' : 'neutral'} className="w-full" onClick={() => setOpen(true)}>
          <Plus />
          Ajouter un lot de colis
        </Button>
      )}

      {list.length > 0 && (
        <div>
          <p className={cn('mb-1 text-[16px] font-semibold', TEXT.strong)}>
            {plural(list.length, 'lot')}, {plural(counted, 'colis', 'colis')} en tout
          </p>
          <ul className={cn('divide-y', SURFACE.divider)}>
            {list.map((p, i) => (
              <li key={p.id} className="flex items-start gap-3 py-3">
                <i aria-hidden className="mt-1.5 inline-block h-4 w-4 shrink-0 rounded-[4px]" style={{ background: lotColor(i, dark) }} />
                <div className="min-w-0 flex-1">
                  <p className={cn('break-words text-[16px] font-semibold leading-snug', TEXT.strong)}>{p.label}</p>
                  <Line className={TEXT.muted}>{lotSentence(p)}</Line>
                </div>
                {canManage && <IconButton icon={Trash2} variant="subtle" ariaLabel={`Retirer ${p.label}`} onClick={() => setToRemove(p)} className="text-[#900B09] dark:text-[#FCB3AD]" />}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Line className={TEXT.muted}>
        Ce n'est pas un plan d'arrimage : c'est une image du remplissage, pour repérer une erreur de cubage ou de la place perdue.
        Le calage et la répartition des masses restent l'affaire de l'entrepôt.
      </Line>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Ajouter un lot de colis">
        <div className="space-y-4">
          <FormField label="C'est quoi ?" htmlFor="pkg-label">
            <TextInput id="pkg-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Téléphones — cartons maîtres" autoComplete="off" />
          </FormField>
          <FormField label="Quel type de colis ?">
            <Pick options={KINDS} value={kind} onChange={setKind} label={(k) => KIND_LABEL[k]} />
          </FormField>
          <FormField label="Combien de colis identiques ?" htmlFor="pkg-qty">
            <TextInput id="pkg-qty" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, ''))} className="tabular-nums" />
          </FormField>
          <FormField label="Les dimensions d'un colis, en centimètres">
            <div className="grid grid-cols-3 gap-2">
              <TextInput id="pkg-l" inputMode="decimal" value={L} onChange={(e) => setL(e.target.value)} placeholder="Long." aria-label="Longueur en cm" className="tabular-nums" />
              <TextInput id="pkg-w" inputMode="decimal" value={W} onChange={(e) => setW(e.target.value)} placeholder="Larg." aria-label="Largeur en cm" className="tabular-nums" />
              <TextInput id="pkg-h" inputMode="decimal" value={H} onChange={(e) => setH(e.target.value)} placeholder="Haut." aria-label="Hauteur en cm" className="tabular-nums" />
            </div>
          </FormField>
          <FormField label="Le poids d'un colis, en kilos (facultatif)" htmlFor="pkg-kg">
            <TextInput id="pkg-kg" inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} placeholder="18" className="tabular-nums" />
          </FormField>
          <Line className={TEXT.muted}>Centimètres et kilos, comme sur la packing list chinoise : rien à convertir.</Line>
          <div className="flex gap-2">
            <Button variant="neutral" className="flex-1" onClick={() => setOpen(false)}>Annuler</Button>
            <Button className="flex-1" onClick={submit} disabled={!canSubmit} loading={add.isPending}>Ajouter</Button>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet open={!!toRemove} onClose={() => setToRemove(null)} title="Retirer ce lot ?">
        {toRemove && (
          <div className="space-y-4">
            <Line><b className={TEXT.strong}>{toRemove.label}</b> : {lotSentence(toRemove)} Le lot disparaît du chargement.</Line>
            <div className="flex gap-2">
              <Button variant="neutral" className="flex-1" onClick={() => setToRemove(null)}>Garder</Button>
              <Button variant="danger" className="flex-1" loading={remove.isPending}
                onClick={() => remove.mutate({ id: toRemove.id, shipmentId: s.id }, { onSuccess: () => setToRemove(null) })}>
                Retirer
              </Button>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
