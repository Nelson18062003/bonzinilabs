/**
 * « Les coûts » — ce que le conteneur a vraiment coûté, en phrases.
 *
 * D'abord le total par devise (« En tout : 1 250 000 XAF, dont 850 000 XAF
 * déjà payés. »), puis le devis du transitaire pour le fret, puis une ligne
 * par coût avec deux gestes : « C'est payé » et « Retirer ». L'ajout se fait
 * dans une feuille basse, en cinq questions. Les totaux restent par devise :
 * convertir au taux du jour donnerait un chiffre faux le lendemain.
 */
import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useAddCargoCost, useCargoCosts, useDeleteCargoCost, useUpdateCargoCost } from '@/hooks/useCargo';
import { COST_KINDS, COST_KIND_LABEL, fmtDay, fmtMoney, fmtUsd } from '@/lib/cargo/model';
import type { CargoCost, CargoShipment } from '@/lib/cargo/model';
import { cn } from '@/lib/utils';
import { TEXT, SURFACE, PRIMARY_PILL, SOFT_PILL, BottomSheet, Button, FormField, Line, StatusPill, TextInput } from '@/mobile/designKit';

const CURRENCIES = ['XAF', 'USD', 'EUR', 'CNY'] as const;

function Pick<T extends string>({ options, value, onChange, label }: { options: readonly T[]; value: T; onChange: (v: T) => void; label: (v: T) => string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o} type="button" onClick={() => onChange(o)} aria-pressed={o === value}
          className={cn('h-10 px-3 text-[16px] font-medium', o === value ? PRIMARY_PILL : SOFT_PILL)}>
          {label(o)}
        </button>
      ))}
    </div>
  );
}

export function MobileCouts({ shipment: s, canManage }: { shipment: CargoShipment; canManage: boolean }) {
  const { data: costs } = useCargoCosts(s.id);
  const add = useAddCargoCost();
  const update = useUpdateCargoCost();
  const remove = useDeleteCargoCost();
  const [open, setOpen] = useState(false);
  const [toRemove, setToRemove] = useState<CargoCost | null>(null);
  const [kind, setKind] = useState<string>('FREIGHT');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<string>('XAF');
  const [label, setLabel] = useState('');
  const [day, setDay] = useState('');
  const [invoice, setInvoice] = useState('');

  const totals = useMemo(() => {
    const out: Record<string, { total: number; paid: number }> = {};
    for (const c of costs ?? []) {
      out[c.currency] ??= { total: 0, paid: 0 };
      out[c.currency].total += Number(c.amount);
      if (c.paid) out[c.currency].paid += Number(c.amount);
    }
    return out;
  }, [costs]);

  const amountNum = Number(amount.replace(/\s/g, '').replace(',', '.'));
  const canSubmit = Number.isFinite(amountNum) && amountNum > 0 && !add.isPending;
  const submit = () => {
    if (!canSubmit) return;
    add.mutate(
      { shipmentId: s.id, cost: { kind, amount: amountNum, currency, label: label.trim() || null, incurred_on: day || null, invoice_ref: invoice.trim() || null } },
      { onSuccess: () => { setOpen(false); setAmount(''); setLabel(''); setInvoice(''); setDay(''); } },
    );
  };

  const list = costs ?? [];
  return (
    <div className="space-y-4">
      {list.length === 0 ? (
        <>
          <Line>Aucun coût noté pour l'instant.</Line>
          <Line className={TEXT.muted}>
            Le fret, la manutention au port, la douane, les surestaries et le camion se notent ici. C'est ce qui donne le vrai
            prix de revient du conteneur, à comparer au devis du transitaire.
          </Line>
        </>
      ) : (
        <div className="space-y-2">
          {Object.entries(totals).map(([cur, t]) => (
            <Line key={cur}>
              En tout : <b className={cn('tabular-nums', TEXT.strong)}>{fmtMoney(t.total, cur)}</b>
              {t.paid >= t.total
                ? ', tout est payé.'
                : t.paid > 0
                  ? <>, dont <b className={cn('tabular-nums', TEXT.strong)}>{fmtMoney(t.paid, cur)}</b> déjà payés. Il reste {fmtMoney(t.total - t.paid, cur)} à payer.</>
                  : ', rien n\'est encore payé.'}
            </Line>
          ))}
        </div>
      )}

      {/* Le devis vient de la fiche du dossier (freight_usd / freight_paid, section
          « L'argent ») ; les lignes ci-dessous sont saisies une à une. Les deux
          peuvent différer : on dit d'où vient chaque chiffre. */}
      <Line>
        Le devis du transitaire pour le fret, tel que noté dans « L'argent » : <b className={cn('tabular-nums', TEXT.strong)}>{fmtUsd(s.freight_usd)}</b>
        {s.freight_usd == null ? '.' : s.freight_paid ? ', marqué réglé.' : ', marqué pas encore réglé.'}
        {' '}Il ne couvre que le fret : les surestaries, le stockage et la douane s'ajoutent après l'arrivée.
      </Line>

      {canManage && (
        <Button variant="neutral" className="w-full" onClick={() => setOpen(true)}>
          <Plus />
          Ajouter un coût
        </Button>
      )}

      {list.length > 0 && (
        <ul className={cn('divide-y', SURFACE.divider)}>
          {list.map((c) => (
            <li key={c.id} className="space-y-3 py-4">
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                <p className={cn('min-w-0 text-[16px] font-semibold leading-snug', TEXT.strong)}>
                  {COST_KIND_LABEL[c.kind] ?? c.kind} : <span className="tabular-nums">{fmtMoney(Number(c.amount), c.currency)}</span>
                </p>
                <StatusPill tone={c.paid ? 'success' : 'pending'} label={c.paid ? 'Payé' : 'À payer'} />
              </div>
              {(c.label || c.invoice_ref || c.incurred_on) && (
                <Line className={TEXT.muted}>
                  {[c.label, c.invoice_ref && `facture ${c.invoice_ref}`, c.incurred_on && `le ${fmtDay(new Date(c.incurred_on + 'T12:00:00'))}`].filter(Boolean).join(', ')}.
                </Line>
              )}
              {canManage && (
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="neutral" onClick={() => update.mutate({ id: c.id, shipmentId: s.id, patch: { paid: !c.paid } })} loading={update.isPending}>
                    {c.paid ? 'Pas encore payé' : "C'est payé"}
                  </Button>
                  <Button variant="dangerSubtle" onClick={() => setToRemove(c)}>
                    <Trash2 />
                    Retirer
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Ajouter un coût">
        <div className="space-y-4">
          <FormField label="C'est quoi ?">
            <Pick options={COST_KINDS} value={kind as (typeof COST_KINDS)[number]} onChange={setKind} label={(k) => COST_KIND_LABEL[k]} />
          </FormField>
          <FormField label="Combien ?" htmlFor="cargo-cost-amount">
            <TextInput id="cargo-cost-amount" inputMode="decimal" enterKeyHint="done" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,\s]/g, ''))} placeholder="250 000" className="font-semibold tabular-nums" />
          </FormField>
          <FormField label="Dans quelle monnaie ?">
            <Pick options={CURRENCIES} value={currency as (typeof CURRENCIES)[number]} onChange={setCurrency} label={(c) => c} />
          </FormField>
          <FormField label="Quel jour ? (facultatif)" htmlFor="cargo-cost-day">
            <TextInput id="cargo-cost-day" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
          </FormField>
          <FormField label="Numéro de facture (facultatif)" htmlFor="cargo-cost-invoice">
            <TextInput id="cargo-cost-invoice" value={invoice} onChange={(e) => setInvoice(e.target.value)} placeholder="FAC-2026-…" autoComplete="off" />
          </FormField>
          <FormField label="Une précision ? (facultatif)" htmlFor="cargo-cost-label">
            <TextInput id="cargo-cost-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="3 jours de surestaries" autoComplete="off" />
          </FormField>
          <div className="flex gap-2">
            <Button variant="neutral" className="flex-1" onClick={() => setOpen(false)}>Annuler</Button>
            <Button className="flex-1" onClick={submit} disabled={!canSubmit} loading={add.isPending}>Ajouter</Button>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet open={!!toRemove} onClose={() => setToRemove(null)} title="Retirer ce coût ?">
        {toRemove && (
          <div className="space-y-4">
            <Line>
              {COST_KIND_LABEL[toRemove.kind] ?? toRemove.kind} : <b className={cn('tabular-nums', TEXT.strong)}>{fmtMoney(Number(toRemove.amount), toRemove.currency)}</b>.
              La ligne disparaît du dossier.
            </Line>
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
