/**
 * Onglet Chargement — ce qu'il y a dans la boîte, à qui c'est, et la place qu'il reste.
 *
 * Refait le 03/10/2026 sur MIEU3611115, qui a montré trois manques :
 *   · les VÉHICULES étaient rangés comme des cartons : trois voitures bout à
 *     bout font 13 m pour 12 m de boîte, la Haval « ne tenait pas » et
 *     disparaissait de la 3D. Elles sont maintenant dessinées en silhouette,
 *     la troisième inclinée sur le capot de la voisine ;
 *   · les EFFETS PERSONNELS n'avaient pas leur place : la packing list ne
 *     donne que leur VOLUME par ligne. Un lot peut maintenant être saisi au
 *     volume déclaré, et il remplit la place restante ;
 *   · on ne savait pas À QUI était chaque lot (groupage) ni son code SH.
 *
 * La 3D n'est pas un plan d'arrimage : c'est une représentation du
 * remplissage, pour voir si ça rentre et ce qui reste.
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, Boxes, Car, Gauge as GaugeIcon, Info, PackageOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import { NumberField, TextArea, TextField } from '@/components/form';
import { useAddCargoPackage, useCargoPackages, useDeleteCargoPackage, useUpdateCargoPackage, type CargoPackageInput } from '@/hooks/useCargo';
import { Empty, Fact, Facts, FieldLabel, IconButton, Section, Tag, ToolButton } from '@/components/cargo/dossier/kit';
import { Container3D } from '@/components/cargo/Container3D';
import { LoadedParcelsSection } from '@/components/cargo/reception/LoadedParcelsSection';
import { buildLoadPlan, containerDims, isVehicle, lotColorMap, lotVolumeM3, LOT_OTHER_DARK, LOT_OTHER_LIGHT } from '@/lib/cargo/loadplan';
import type { CargoPackage, CargoShipment } from '@/lib/cargo/model';
import { cn } from '@/lib/utils';
import { TEXT, SOFT_PILL, PRIMARY_PILL, CenterDialog, Th, Td } from '@/desktop/designKit';

const KINDS: { key: string; label: string }[] = [
  { key: 'VEHICLE', label: 'Véhicule' },
  { key: 'CARTON', label: 'Carton' },
  { key: 'PALLET', label: 'Palette' },
  { key: 'CRATE', label: 'Caisse' },
  { key: 'BAG', label: 'Sac / balle' },
  { key: 'DRUM', label: 'Fût' },
  { key: 'BUNDLE', label: 'Fagot / paquet' },
  { key: 'OTHER', label: 'Autre' },
];
const KIND_LABEL = Object.fromEntries(KINDS.map((k) => [k.key, k.label]));

const pct = (v: number) => `${Math.round(v * 100)} %`;
const num = (v: number, d = 1) => v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const hasDims = (p: CargoPackage) => p.length_cm != null && p.width_cm != null && p.height_cm != null;
const dimsText = (p: CargoPackage) => (hasDims(p) ? `${num(Number(p.length_cm), 0)} × ${num(Number(p.width_cm), 0)} × ${num(Number(p.height_cm), 0)} cm` : null);

/** Jauge de remplissage. Au-delà de 100 % elle devient une alerte, pas une barre pleine. */
function Gauge({ label, value, hint, danger }: { label: string; value: number; hint: string; danger?: boolean }) {
  const over = value > 1;
  return (
    <div className="cargo-gauge">
      <div className="cargo-gauge__head">
        <span>{label}</span>
        <b className={cn(over || danger ? 'text-[#d03b3b]' : undefined)}>{pct(value)}</b>
      </div>
      <div className="cargo-gauge__track">
        <span className="cargo-gauge__fill" style={{ width: `${Math.min(100, Math.round(value * 100))}%`, background: over || danger ? '#d03b3b' : 'hsl(var(--foreground))' }} />
      </div>
      <div className={cn('text-[12px] max-lg:text-[14px]', TEXT.muted)}>{hint}</div>
    </div>
  );
}

/* ── Dialogue d'un lot ──────────────────────────────────────────────────── */

type Draft = {
  label: string; kind: string; qty: number | null; L: number | null; W: number | null; H: number | null; cbm: number | null;
  kg: number | null; owner: string; hs: string; stackable: boolean; note: string;
};
const draftOf = (p: CargoPackage | null): Draft => p ? {
  label: p.label, kind: p.kind, qty: p.qty, L: p.length_cm != null ? Number(p.length_cm) : null, W: p.width_cm != null ? Number(p.width_cm) : null,
  H: p.height_cm != null ? Number(p.height_cm) : null, cbm: p.cbm != null ? Number(p.cbm) : null, kg: p.weight_kg != null ? Number(p.weight_kg) : null,
  owner: p.owner_label ?? '', hs: p.hs_code ?? '', stackable: p.stackable, note: p.note ?? '',
} : { label: '', kind: 'CARTON', qty: 1, L: null, W: null, H: null, cbm: null, kg: null, owner: '', hs: '', stackable: true, note: '' };

function LotDialog({ initial, onClose, onSave, saving }: { initial: CargoPackage | null; onClose: () => void; saving: boolean; onSave: (d: Draft) => void }) {
  const [d, setD] = useState<Draft>(draftOf(initial));
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const dimsFull = (d.L ?? 0) > 0 && (d.W ?? 0) > 0 && (d.H ?? 0) > 0;
  const dimsEmpty = d.L == null && d.W == null && d.H == null;
  const hsOk = !d.hs.trim() || /^[0-9.]{4,20}$/.test(d.hs.trim());
  // Des cotes complètes, ou un volume. Un véhicule a toujours besoin de ses cotes (on dessine sa silhouette).
  const valid = d.label.trim().length > 0 && (d.qty ?? 0) > 0 && hsOk
    && (dimsFull || (dimsEmpty && (d.cbm ?? 0) > 0 && d.kind !== 'VEHICLE'));
  const submit = () => { if (valid) onSave(d); };
  return (
    <CenterDialog
      open
      onClose={onClose}
      onConfirm={submit}
      width={620}
      title={initial ? 'Modifier le lot' : 'Ajouter un lot'}
      footer={
        <>
          <button type="button" onClick={onClose} className={cn('h-9 px-4 text-[13px] max-lg:text-[15px] font-semibold', SOFT_PILL)}>Annuler</button>
          <button type="button" onClick={submit} disabled={!valid || saving} className={cn('h-9 px-4 text-[13px] max-lg:text-[15px] font-bold disabled:opacity-60', PRIMARY_PILL)}>
            {saving ? 'Enregistrement…' : initial ? 'Enregistrer' : 'Ajouter le lot'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <FieldLabel htmlFor="lot-label">Désignation</FieldLabel>
          <TextField id="lot-label" size="sm" value={d.label} onChange={(e) => set('label', e.target.value)} placeholder="Toyota RAV4 2014, Vêtements (衣服), Tôles…" autoFocus />
        </div>
        <div>
          <FieldLabel>Type</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {KINDS.map((k) => (
              <button key={k.key} type="button" onClick={() => setD((x) => ({ ...x, kind: k.key, stackable: k.key === 'VEHICLE' ? false : x.stackable }))} className={cn('inline-flex h-8 max-lg:h-10 items-center gap-1.5 px-2.5 text-[12px] max-lg:text-[14px] font-semibold', k.key === d.kind ? PRIMARY_PILL : SOFT_PILL)}>
                {k.key === 'VEHICLE' && <Car className="h-3.5 w-3.5" />}{k.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 max-sm:grid-cols-2">
          <div><FieldLabel htmlFor="lot-qty">Quantité</FieldLabel><NumberField id="lot-qty" size="sm" value={d.qty} onValueChange={(v) => set('qty', v)} min={1} /></div>
          <div><FieldLabel htmlFor="lot-l">Long. cm</FieldLabel><NumberField id="lot-l" size="sm" value={d.L} onValueChange={(v) => set('L', v)} allowDecimal min={1} /></div>
          <div><FieldLabel htmlFor="lot-w">Larg. cm</FieldLabel><NumberField id="lot-w" size="sm" value={d.W} onValueChange={(v) => set('W', v)} allowDecimal min={1} /></div>
          <div><FieldLabel htmlFor="lot-h">Haut. cm</FieldLabel><NumberField id="lot-h" size="sm" value={d.H} onValueChange={(v) => set('H', v)} allowDecimal min={1} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <div>
            <FieldLabel htmlFor="lot-cbm" hint={d.kind === 'VEHICLE' ? 'celui de la packing list' : 'si les cotes manquent'}>Volume du lot (m³)</FieldLabel>
            <NumberField id="lot-cbm" size="sm" value={d.cbm} onValueChange={(v) => set('cbm', v)} allowDecimal min={0} placeholder="5,98" />
          </div>
          <div>
            <FieldLabel htmlFor="lot-kg" hint="facultatif">Poids d'un colis (kg)</FieldLabel>
            <NumberField id="lot-kg" size="sm" value={d.kg} onValueChange={(v) => set('kg', v)} allowDecimal min={0} />
          </div>
          <div>
            <FieldLabel htmlFor="lot-owner" hint="groupage">À qui est ce lot</FieldLabel>
            <TextField id="lot-owner" size="sm" value={d.owner} onChange={(e) => set('owner', e.target.value)} placeholder="Nom porté sur les colis" />
          </div>
          <div>
            <FieldLabel htmlFor="lot-hs" hint={hsOk ? 'à valider par le déclarant' : 'chiffres et points seulement'}>Code SH</FieldLabel>
            <TextField id="lot-hs" size="sm" value={d.hs} onChange={(e) => set('hs', e.target.value)} placeholder="8703.23.90.9100" />
          </div>
        </div>
        <div>
          <FieldLabel htmlFor="lot-note" hint="facultatif">Note</FieldLabel>
          <TextArea id="lot-note" rows={2} value={d.note} onChange={(e) => set('note', e.target.value)} placeholder="Châssis, matière, neuf ou usagé, ce qu'il faut vérifier…" />
        </div>
        {d.kind !== 'VEHICLE' && (
          <label className={cn('flex items-center gap-2 text-[13px] max-lg:text-[15px]', TEXT.body)}>
            <input type="checkbox" checked={!d.stackable} onChange={(e) => set('stackable', !e.target.checked)} className="h-4 w-4" />
            Fragile : rien par-dessus
          </label>
        )}
        <p className={cn('text-[12px] max-lg:text-[14px]', TEXT.muted)}>
          Cotes en centimètres, comme sur la packing list chinoise. Quand elle ne donne que le volume d'une ligne (« 5,98 CBM »),
          laisse les cotes vides et saisis le volume : le lot est dessiné comme un bloc de ce volume.
        </p>
      </div>
    </CenterDialog>
  );
}

/* ── L'onglet ─────────────────────────────────────────────────────────── */

export function TabChargement({ shipment: s, canManage }: { shipment: CargoShipment; canManage: boolean }) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const { data: packages } = useCargoPackages(s.id);
  const add = useAddCargoPackage();
  const update = useUpdateCargoPackage();
  const remove = useDeleteCargoPackage();
  const [hovered, setHovered] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ lot: CargoPackage | null } | null>(null);
  const [deleting, setDeleting] = useState<CargoPackage | null>(null);

  const list = useMemo(() => packages ?? [], [packages]);
  const plan = useMemo(() => buildLoadPlan(s.container_iso, list), [s.container_iso, list]);
  const colors = useMemo(() => lotColorMap(list, dark), [list, dark]);
  const grey = dark ? LOT_OTHER_DARK : LOT_OTHER_LIGHT;
  const spec = containerDims(s.container_iso);
  const vehicles = list.filter(isVehicle);
  const goods = list.filter((p) => !isVehicle(p));
  const counted = list.reduce((n, p) => n + p.qty, 0);
  const declared = s.packages_count;
  const mismatch = declared != null && counted > 0 && declared !== counted;
  const tilted = plan.vehicles.filter((v) => v.angle > 0);
  const weightFromLots = plan.totalWeightKg > 0;
  const grossKg = s.gross_weight_kg != null ? Number(s.gross_weight_kg) : null;
  const owners = [...new Set(list.map((p) => p.owner_label?.trim()).filter(Boolean))] as string[];

  const save = (d: Draft) => {
    const dimsFull = (d.L ?? 0) > 0 && (d.W ?? 0) > 0 && (d.H ?? 0) > 0;
    const pkg: CargoPackageInput = {
      label: d.label.trim(), kind: d.kind, qty: d.qty ?? 1,
      length_cm: dimsFull ? d.L : null, width_cm: dimsFull ? d.W : null, height_cm: dimsFull ? d.H : null,
      cbm: d.cbm && d.cbm > 0 ? d.cbm : null, weight_kg: d.kg, owner_label: d.owner.trim() || null, hs_code: d.hs.trim() || null,
      stackable: d.kind === 'VEHICLE' ? false : d.stackable, note: d.note.trim() || null,
    };
    if (dialog?.lot) update.mutate({ id: dialog.lot.id, shipmentId: s.id, patch: pkg }, { onSuccess: () => setDialog(null) });
    else add.mutate({ shipmentId: s.id, pkg: { ...pkg, position: list.reduce((m, p) => Math.max(m, p.position), 0) + 1 } }, { onSuccess: () => setDialog(null) });
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex flex-col gap-5 max-lg:contents">
        <Section
          className="max-lg:order-2"
          icon={PackageOpen}
          tone="amber"
          title="Dans la boîte"
          subtitle={`${spec.label} · ${num(spec.length / 100, 2)} × ${num(spec.width / 100, 2)} × ${num(spec.height / 100, 2)} m utiles`}
          action={canManage ? <ToolButton icon={Plus} onClick={() => setDialog({ lot: null })}>Ajouter un lot</ToolButton> : undefined}
          bodyClassName="p-4"
        >
          {list.length === 0 ? (
            <Empty icon={Boxes} title="Aucun lot saisi">
              Reprends la packing list : une ligne par lot. Les véhicules avec leurs cotes, les autres colis avec leurs cotes ou,
              à défaut, le volume de la ligne. Le conteneur se dessine tout seul.
            </Empty>
          ) : (
            <Container3D iso={s.container_iso} packages={list} dark={dark} hoveredPackageId={hovered} onHoverPackage={setHovered} />
          )}
        </Section>

        {list.length > 0 && (
          <Section
            className="max-lg:order-3"
            icon={Boxes}
            tone="amber"
            title="Les lots"
            subtitle={`${vehicles.length ? `${vehicles.length} véhicule${vehicles.length > 1 ? 's' : ''} · ` : ''}${goods.length} ligne${goods.length > 1 ? 's' : ''} de marchandises · ${counted} colis`}
            meta={`${num(plan.usedVolumeM3, 2)} m³`}
            bodyClassName="p-0"
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px]">
                <thead>
                  <tr>
                    <Th first>Lot</Th>
                    <Th>Type</Th>
                    <Th className="text-right">Qté</Th>
                    <Th>Taille</Th>
                    <Th className="text-right">Volume</Th>
                    {canManage && <Th last />}
                  </tr>
                </thead>
                <tbody>
                  {list.map((p) => (
                    <tr key={p.id} onMouseEnter={() => setHovered(p.id)} onMouseLeave={() => setHovered(null)} className={cn(hovered === p.id ? 'bg-muted/60' : undefined)}>
                      <Td first>
                        <div className="flex items-start gap-2">
                          <i aria-hidden className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: colors[p.id] }} />
                          <div className="min-w-0">
                            <div className={cn('font-semibold', TEXT.strong)}>{p.label}</div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                              {p.owner_label && <Tag tone="info">à {p.owner_label}</Tag>}
                              {p.hs_code && <Tag>SH {p.hs_code}</Tag>}
                              {colors[p.id] === grey && <span className={cn('text-[11px]', TEXT.muted)}>teinte partagée</span>}
                            </div>
                            {p.note && <div className={cn('mt-0.5 max-w-[360px] text-[11.5px] leading-snug', TEXT.muted)}>{p.note}</div>}
                          </div>
                        </div>
                      </Td>
                      <Td className={TEXT.muted}>{KIND_LABEL[p.kind] ?? p.kind}</Td>
                      <Td className="text-right tabular-nums">{p.qty}</Td>
                      <Td className="tabular-nums">
                        {dimsText(p) ?? <span className={TEXT.muted}>au volume</span>}
                      </Td>
                      <Td className="text-right tabular-nums">
                        {num(lotVolumeM3(p), 2)} m³
                        {!hasDims(p) && <div className={cn('text-[11px]', TEXT.muted)}>déclaré</div>}
                      </Td>
                      {canManage && (
                        <Td last className="text-right">
                          <span className="inline-flex">
                            <IconButton icon={Pencil} label={`Modifier ${p.label}`} onClick={() => setDialog({ lot: p })} />
                            <IconButton icon={Trash2} label={`Retirer ${p.label}`} danger onClick={() => setDeleting(p)} />
                          </span>
                        </Td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {/* Ce qui vient de la réception : les colis reçus à l'entrepôt, chargés dans cette boîte. */}
        <LoadedParcelsSection shipment={s} canManage={canManage} className="max-lg:order-6" />
      </div>

      <div className="flex flex-col gap-5 max-lg:contents">
        <Section className="max-lg:order-1" icon={GaugeIcon} tone="emerald" title="Le remplissage" bodyClassName="flex flex-col gap-4 p-5">
          {list.length === 0 ? (
            <div className={cn('text-[13px] max-lg:text-[16px]', TEXT.muted)}>Rien à mesurer tant qu'aucun lot n'est saisi.</div>
          ) : (
            <>
              <Gauge label="Volume" value={plan.fill} hint={`${num(plan.usedVolumeM3, 2)} m³ sur ${num(plan.containerVolumeM3, 2)} m³${plan.mode === 'mixed' ? ' (volumes de la packing list)' : ''}`} />
              {weightFromLots ? (
                <Gauge label="Charge utile" value={plan.weightFill} danger={plan.weightFill > 1} hint={`${num(plan.totalWeightKg, 0)} kg sur ${num(plan.maxPayloadKg, 0)} kg admissibles`} />
              ) : grossKg != null ? (
                <Gauge label="Charge utile" value={grossKg / plan.maxPayloadKg} danger={grossKg > plan.maxPayloadKg} hint={`${num(grossKg, 0)} kg déclarés sur le B/L, sur ${num(plan.maxPayloadKg, 0)} kg admissibles`} />
              ) : (
                <p className={cn('text-[12px] max-lg:text-[14px]', TEXT.muted)}>Aucun poids saisi : la charge ne peut pas être vérifiée.</p>
              )}
              <Facts cols={2}>
                <Fact label="Colis" value={String(counted)} hint={declared != null ? `${declared} sur le B/L` : undefined} />
                <Fact label="Véhicules" value={String(vehicles.length)} hint={tilted.length ? `dont ${tilted.length} incliné${tilted.length > 1 ? 's' : ''}` : undefined} />
              </Facts>
            </>
          )}
        </Section>

        {(plan.leftOut.length > 0 || mismatch) && (
          <Section className="max-lg:order-4" icon={AlertTriangle} tone="rose" title="Ce qui ne colle pas" bodyClassName="flex flex-col gap-3 p-5">
            {plan.leftOut.map((o, i) => (
              <div key={i} className="text-[13px] max-lg:text-[15px]">
                <b className="text-[#d03b3b]">{o.qty} × {o.label}</b> <span className={TEXT.muted}>ne tient pas : {o.why}.</span>
              </div>
            ))}
            {mismatch && (
              <div className="text-[13px] max-lg:text-[15px]">
                <b className="text-[#d03b3b]">{counted} colis saisis</b>{' '}
                <span className={TEXT.muted}>contre {declared} sur le B/L. L'un des deux est faux : c'est l'écart que la douane relève. Faire recompter par notre entrepôt.</span>
              </div>
            )}
          </Section>
        )}

        {owners.length > 0 && (
          <Section className="max-lg:order-5" icon={Info} tone="violet" title="À qui sont les lots" bodyClassName="p-5">
            <ul className="space-y-2">
              {owners.map((o) => {
                const lots = list.filter((p) => p.owner_label?.trim() === o);
                return (
                  <li key={o} className="flex items-baseline justify-between gap-3 text-[13px] max-lg:text-[15px]">
                    <span className={cn('font-semibold', TEXT.strong)}>{o}</span>
                    <span className={cn('tabular-nums', TEXT.muted)}>{lots.reduce((n, p) => n + p.qty, 0)} colis · {num(lots.reduce((v, p) => v + lotVolumeM3(p), 0), 2)} m³</span>
                  </li>
                );
              })}
              {list.some((p) => !p.owner_label) && (
                <li className={cn('text-[12px] max-lg:text-[14px]', TEXT.muted)}>
                  {list.filter((p) => !p.owner_label).length} lot(s) sans propriétaire : à demander à notre entrepôt de Guangzhou.
                </li>
              )}
            </ul>
          </Section>
        )}

        <Section className="max-lg:order-7" icon={Info} title="Comment lire la 3D" bodyClassName="p-5">
          <p className={cn('text-[13px] max-lg:text-[15px] leading-relaxed', TEXT.body)}>
            Les véhicules sont dessinés en silhouette, du fond vers les portes. Quand la longueur manque, le suivant est posé
            incliné, l'avant au-dessus du capot du précédent : c'est ainsi qu'on loge trois voitures dans un 40 pieds.
          </p>
          <p className={cn('mt-3 text-[13px] max-lg:text-[15px] leading-relaxed', TEXT.body)}>
            Les colis connus seulement par leur volume remplissent la place restante, du fond vers les portes et du sol vers le
            plafond. Ce n'est pas un plan d'arrimage : le calage et la répartition des masses restent l'affaire de l'entrepôt.
          </p>
        </Section>
      </div>

      {dialog && <LotDialog initial={dialog.lot} saving={add.isPending || update.isPending} onClose={() => setDialog(null)} onSave={save} />}
      <CenterDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Retirer ce lot ?"
        footer={
          <>
            <button type="button" onClick={() => setDeleting(null)} className={cn('h-9 px-4 text-[13px] font-semibold', SOFT_PILL)}>Garder</button>
            <ToolButton icon={Trash2} danger onClick={() => deleting && remove.mutate({ id: deleting.id, shipmentId: s.id }, { onSuccess: () => setDeleting(null) })}>Retirer</ToolButton>
          </>
        }
      >
        <p className={cn('text-[13px] max-lg:text-[15px]', TEXT.body)}><b>{deleting?.label}</b> ({deleting?.qty} colis) sera retiré du plan de chargement.</p>
      </CenterDialog>
    </div>
  );
}
