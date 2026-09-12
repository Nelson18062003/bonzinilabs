/**
 * Onglet Chargement — ce qu'il y a dans la boîte, et la place qu'il reste.
 *
 * Le dossier savait où était le conteneur et ce qu'il coûtait ; il ne savait
 * pas ce qu'il transporte. Cet onglet répond aux quatre questions que l'ops
 * pose vraiment : est-ce que ça rentre, combien de place reste-t-il, qu'est-ce
 * qu'il y a en dessous, et est-ce qu'on paie du vide.
 *
 * La 3D n'est pas un ornement : elle rend visible en un regard ce qu'un tableau
 * de dimensions ne dit pas — la place perdue en hauteur, un lot qui déborde,
 * un conteneur à moitié rempli qu'on aurait pu grouper.
 */
import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import { NumberField, TextField } from '@/components/form';
import { useAddCargoPackage, useCargoPackages, useDeleteCargoPackage } from '@/hooks/useCargo';
import { Empty, Fact, Facts, Section } from '@/components/cargo/dossier/kit';
import { Container3D } from '@/components/cargo/Container3D';
import { buildLoadPlan, containerDims, lotColor, MAX_DISTINCT_LOTS } from '@/lib/cargo/loadplan';
import type { CargoShipment } from '@/lib/cargo/model';
import { cn } from '@/lib/utils';
import { TEXT, SOFT_PILL, PRIMARY_PILL, CenterDialog, SecLabel, Th, Td } from '@/desktop/designKit';

const KINDS: { key: string; label: string }[] = [
  { key: 'CARTON', label: 'Carton' },
  { key: 'PALLET', label: 'Palette' },
  { key: 'CRATE', label: 'Caisse' },
  { key: 'BAG', label: 'Sac' },
  { key: 'DRUM', label: 'Fût' },
  { key: 'BUNDLE', label: 'Fagot' },
  { key: 'OTHER', label: 'Autre' },
];
const KIND_LABEL = Object.fromEntries(KINDS.map((k) => [k.key, k.label]));

const pct = (v: number) => `${Math.round(v * 100)} %`;
const num = (v: number, d = 1) => v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });

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
        <span
          className="cargo-gauge__fill"
          style={{
            width: `${Math.min(100, Math.round(value * 100))}%`,
            background: over || danger ? '#d03b3b' : 'hsl(var(--foreground))',
          }}
        />
      </div>
      <div className={cn('text-[12px]', TEXT.muted)}>{hint}</div>
    </div>
  );
}

export function TabChargement({ shipment: s, canManage }: { shipment: CargoShipment; canManage: boolean }) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const { data: packages } = useCargoPackages(s.id);
  const add = useAddCargoPackage();
  const remove = useDeleteCargoPackage();
  const [hovered, setHovered] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const [label, setLabel] = useState('');
  const [kind, setKind] = useState('CARTON');
  const [qty, setQty] = useState<number | null>(1);
  const [L, setL] = useState<number | null>(null);
  const [W, setW] = useState<number | null>(null);
  const [H, setH] = useState<number | null>(null);
  const [kg, setKg] = useState<number | null>(null);

  const list = useMemo(() => packages ?? [], [packages]);
  const plan = useMemo(() => buildLoadPlan(s.container_iso, list), [s.container_iso, list]);
  const spec = containerDims(s.container_iso);

  const declared = s.packages_count;
  const counted = list.reduce((n, p) => n + p.qty, 0);
  const mismatch = declared != null && counted > 0 && declared !== counted;

  const canSubmit = label.trim().length > 0 && (qty ?? 0) > 0 && (L ?? 0) > 0 && (W ?? 0) > 0 && (H ?? 0) > 0;

  function submit() {
    if (!canSubmit) return;
    add.mutate(
      {
        shipmentId: s.id,
        pkg: {
          label: label.trim(), kind, qty: qty ?? 1,
          length_cm: L as number, width_cm: W as number, height_cm: H as number,
          weight_kg: kg, position: list.length,
        },
      },
      {
        onSuccess: () => {
          setOpen(false);
          setLabel(''); setQty(1); setL(null); setW(null); setH(null); setKg(null);
        },
      },
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-4">
        <Section
          title="Dans la boîte"
          meta={`${spec.label} · ${num(spec.length / 100, 2)} × ${num(spec.width / 100, 2)} × ${num(spec.height / 100, 2)} m utiles`}
          action={
            canManage ? (
              <button type="button" onClick={() => setOpen(true)} className={cn('inline-flex h-7 items-center gap-1 whitespace-nowrap px-2.5 text-[11.5px] font-semibold', SOFT_PILL)}>
                <Plus className="h-3 w-3" /> Ajouter
              </button>
            ) : undefined
          }
          bodyClassName="p-4"
        >
          {list.length === 0 ? (
            <Empty title="Aucun colis saisi">
              Reprends la packing list du fournisseur : une ligne par lot de colis identiques, avec
              ses dimensions en centimètres. Le conteneur se dessine tout seul, et on voit
              immédiatement la place perdue — c'est ce qui permet de dire si on aurait pu grouper.
            </Empty>
          ) : (
            <Container3D
              iso={s.container_iso}
              packages={list}
              dark={dark}
              hoveredPackageId={hovered}
              onHoverPackage={setHovered}
            />
          )}
        </Section>

        {list.length > 0 && (
          <Section title="Les lots" meta={`${list.length} lot${list.length > 1 ? 's' : ''} · ${counted} colis`} bodyClassName="p-0">
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Lot</Th>
                  <Th>Type</Th>
                  <Th className="text-right">Qté</Th>
                  <Th className="text-right">L × l × h (cm)</Th>
                  <Th className="text-right">Poids unité</Th>
                  {canManage && <Th />}
                </tr>
              </thead>
              <tbody>
                {list.map((p, i) => (
                  <tr
                    key={p.id}
                    onMouseEnter={() => setHovered(p.id)}
                    onMouseLeave={() => setHovered(null)}
                    className={cn(hovered === p.id ? 'bg-muted/60' : undefined)}
                  >
                    <Td>
                      <span className="inline-flex items-center gap-2">
                        <i
                          aria-hidden
                          className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]"
                          style={{ background: lotColor(i, dark) }}
                        />
                        <span className="font-semibold">{p.label}</span>
                      </span>
                      {i >= MAX_DISTINCT_LOTS && (
                        <span className={cn('ml-2 text-[11px]', TEXT.muted)}>teinte partagée</span>
                      )}
                    </Td>
                    <Td className={TEXT.muted}>{KIND_LABEL[p.kind] ?? p.kind}</Td>
                    <Td className="text-right tabular-nums">{p.qty}</Td>
                    <Td className="text-right tabular-nums">
                      {num(Number(p.length_cm), 0)} × {num(Number(p.width_cm), 0)} × {num(Number(p.height_cm), 0)}
                    </Td>
                    <Td className="text-right tabular-nums">{p.weight_kg == null ? '—' : `${num(Number(p.weight_kg), 1)} kg`}</Td>
                    {canManage && (
                      <Td className="text-right">
                        <button
                          type="button"
                          className={cn('inline-flex h-7 w-7 items-center justify-center', SOFT_PILL)}
                          onClick={() => remove.mutate({ id: p.id, shipmentId: s.id })}
                          aria-label={`Retirer ${p.label}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </Td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <Section title="Le remplissage" bodyClassName="flex flex-col gap-4 p-5">
          {list.length === 0 ? (
            <div className={cn('text-[13px]', TEXT.muted)}>Rien à mesurer tant qu'aucun colis n'est saisi.</div>
          ) : (
            <>
              <Gauge
                label="Volume"
                value={plan.fill}
                hint={`${num(plan.usedVolumeM3, 2)} m³ occupés sur ${num(plan.containerVolumeM3, 2)} m³`}
              />
              <Gauge
                label="Charge utile"
                value={plan.weightFill}
                danger={plan.weightFill > 1}
                hint={
                  plan.totalWeightKg === 0
                    ? 'Aucun poids saisi — la charge ne peut pas être vérifiée'
                    : `${num(plan.totalWeightKg, 0)} kg sur ${num(plan.maxPayloadKg, 0)} kg admissibles`
                }
              />
              <Facts cols={2}>
                <Fact label="Étages" value={String(plan.layers)} hint="empilements successifs" />
                <Fact
                  label="Hauteur atteinte"
                  value={`${num(plan.stackHeight / 100, 2)} m`}
                  hint={`sur ${num(plan.dims.height / 100, 2)} m utiles`}
                />
              </Facts>
            </>
          )}
        </Section>

        {(plan.leftOut.length > 0 || mismatch) && (
          <Section title="Ce qui ne colle pas" bodyClassName="flex flex-col gap-3 p-5">
            {plan.leftOut.map((o, i) => (
              <div key={i} className="text-[13px]">
                <b className="text-[#d03b3b]">{o.qty} × {o.label}</b>{' '}
                <span className={TEXT.muted}>ne tiennent pas : {o.why}.</span>
              </div>
            ))}
            {mismatch && (
              <div className="text-[13px]">
                <b className="text-[#d03b3b]">{counted} colis saisis</b>{' '}
                <span className={TEXT.muted}>
                  contre {declared} annoncés sur le dossier. L'un des deux est faux — et c'est le
                  genre d'écart que la douane relève.
                </span>
              </div>
            )}
          </Section>
        )}

        <Section title="À quoi ça sert" bodyClassName="p-5">
          <p className={cn('text-[13px] leading-relaxed', TEXT.body)}>
            Le plan range les lots dans l'ordre de saisie, rangée par rangée puis étage par étage —
            comme un entrepôt empote à la main. Les colis non gerbables finissent toujours au-dessus.
          </p>
          <p className={cn('mt-3 text-[13px] leading-relaxed', TEXT.muted)}>
            Ce n'est pas un plan d'arrimage : le centre de gravité, la répartition des masses et le
            calage restent l'affaire de l'entrepôt. C'est une représentation du remplissage, faite
            pour repérer une erreur de cubage et la place perdue.
          </p>
        </Section>
      </div>

      <CenterDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={submit}
        title="Ajouter un lot de colis"
        width={540}
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} className={cn('h-9 px-4 text-[13px] font-semibold', SOFT_PILL)}>Annuler</button>
            <button type="button" onClick={submit} disabled={!canSubmit || add.isPending} className={cn('h-9 px-4 text-[13px] font-bold disabled:opacity-60', PRIMARY_PILL)}>
              {add.isPending ? 'Ajout…' : 'Ajouter'}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div>
            <SecLabel>Désignation</SecLabel>
            <TextField id="pkg-label" size="sm" className="mt-2" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Téléphones — cartons maîtres" />
          </div>
          <div>
            <SecLabel>Type de colis</SecLabel>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {KINDS.map((k) => (
                <button
                  key={k.key}
                  type="button"
                  className={cn('inline-flex h-7 items-center px-2.5 text-[11.5px] font-semibold', k.key === kind ? PRIMARY_PILL : SOFT_PILL)}
                  onClick={() => setKind(k.key)}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div><SecLabel>Quantité</SecLabel><NumberField id="pkg-qty" size="sm" className="mt-2" value={qty} onValueChange={setQty} min={1} /></div>
            <div><SecLabel>Long. cm</SecLabel><NumberField id="pkg-l" size="sm" className="mt-2" value={L} onValueChange={setL} allowDecimal min={1} /></div>
            <div><SecLabel>Larg. cm</SecLabel><NumberField id="pkg-w" size="sm" className="mt-2" value={W} onValueChange={setW} allowDecimal min={1} /></div>
            <div><SecLabel>Haut. cm</SecLabel><NumberField id="pkg-h" size="sm" className="mt-2" value={H} onValueChange={setH} allowDecimal min={1} /></div>
          </div>
          <div><SecLabel>Poids d’un colis (kg)</SecLabel><NumberField id="pkg-kg" size="sm" className="mt-2" value={kg} onValueChange={setKg} allowDecimal min={0} /></div>
          <p className={cn('text-[12px]', TEXT.muted)}>
            Centimètres et kilogrammes, comme sur la packing list chinoise — aucune conversion à
            faire, donc aucune erreur de conversion.
          </p>
        </div>
      </CenterDialog>
    </div>
  );
}
