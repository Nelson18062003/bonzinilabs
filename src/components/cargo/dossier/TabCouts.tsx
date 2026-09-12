/**
 * Onglet Coûts — le prix de revient réel du conteneur.
 *
 * Une ligne par coût, dans l'ordre où ils tombent. Les totaux restent par
 * DEVISE : convertir au taux du jour donnerait un chiffre faux le lendemain.
 */
import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { DateField, NumberField, TextField } from '@/components/form';
import { useAddCargoCost, useCargoCosts, useDeleteCargoCost, useUpdateCargoCost } from '@/hooks/useCargo';
import { Empty, Fact, Facts, Section } from '@/components/cargo/dossier/kit';
import { COST_KINDS, COST_KIND_LABEL, fmtDay, fmtMoney, fmtUsd } from '@/lib/cargo/model';
import type { CargoShipment } from '@/lib/cargo/model';
import { cn } from '@/lib/utils';
import { TEXT, SOFT_PILL, PRIMARY_PILL, CenterDialog, SecLabel, Th, Td } from '@/desktop/designKit';

const CURRENCIES = ['XAF', 'USD', 'EUR', 'CNY'] as const;

export function TabCouts({ shipment: s, canManage }: { shipment: CargoShipment; canManage: boolean }) {
  const { data: costs } = useCargoCosts(s.id);
  const add = useAddCargoCost();
  const update = useUpdateCargoCost();
  const remove = useDeleteCargoCost();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<string>('FREIGHT');
  const [amount, setAmount] = useState<number | null>(null);
  const [currency, setCurrency] = useState<string>('XAF');
  const [label, setLabel] = useState('');
  const [day, setDay] = useState('');
  const [invoice, setInvoice] = useState('');

  const totals = useMemo(() => {
    const out: Record<string, { total: number; paid: number }> = {};
    for (const c of costs ?? []) {
      const cur = c.currency;
      out[cur] ??= { total: 0, paid: 0 };
      out[cur].total += Number(c.amount);
      if (c.paid) out[cur].paid += Number(c.amount);
    }
    return out;
  }, [costs]);

  const submit = () => {
    if (amount == null || amount <= 0) return;
    add.mutate(
      { shipmentId: s.id, cost: { kind, amount, currency, label: label.trim() || null, incurred_on: day || null, invoice_ref: invoice.trim() || null } },
      { onSuccess: () => { setOpen(false); setAmount(null); setLabel(''); setInvoice(''); setDay(''); } },
    );
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-5 max-lg:grid-cols-1">
      <Section
        title="Coûts du dossier"
        meta={costs?.length ? `${costs.length} ligne${costs.length > 1 ? 's' : ''}` : undefined}
        bodyClassName="p-0"
        action={canManage ? (
          <button type="button" onClick={() => setOpen(true)} className={cn('inline-flex h-7 items-center gap-1 px-2.5 text-[11.5px] font-semibold', SOFT_PILL)}>
            <Plus className="h-3 w-3" /> Ajouter
          </button>
        ) : undefined}
      >
        {!costs?.length ? (
          <div className="px-5 py-4">
            <Empty title="Aucun coût saisi">
              Le fret, la manutention, la douane, les surestaries et le transport final se notent ici : c'est ce qui donne le
              vrai prix de revient du conteneur, à comparer au devis du transitaire.
            </Empty>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr>
                <Th first>Poste</Th>
                <Th>Date</Th>
                <Th align="right">Montant</Th>
                <Th>État</Th>
                {canManage && <Th last className="w-[40px]" />}
              </tr>
            </thead>
            <tbody>
              {costs.map((c) => (
                <tr key={c.id}>
                  <Td first>
                    <div className={cn('text-[13px] font-semibold', TEXT.strong)}>{COST_KIND_LABEL[c.kind] ?? c.kind}</div>
                    {(c.label || c.invoice_ref) && (
                      <div className={cn('text-[11.5px]', TEXT.muted)}>{[c.label, c.invoice_ref && `facture ${c.invoice_ref}`].filter(Boolean).join(' · ')}</div>
                    )}
                  </Td>
                  <Td><span className={cn('text-[12.5px] tabular-nums', TEXT.body)}>{c.incurred_on ? fmtDay(new Date(c.incurred_on + 'T12:00:00')) : '—'}</span></Td>
                  <Td align="right"><span className={cn('text-[13px] font-semibold tabular-nums', TEXT.strong)}>{fmtMoney(Number(c.amount), c.currency)}</span></Td>
                  <Td>
                    <button
                      type="button"
                      disabled={!canManage}
                      onClick={() => update.mutate({ id: c.id, shipmentId: s.id, patch: { paid: !c.paid } })}
                      className={cn('rounded-md px-2 py-0.5 text-[11.5px] font-bold', c.paid ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-destructive/10 text-destructive', canManage && 'hover:opacity-80')}
                    >
                      {c.paid ? 'Payé' : 'À payer'}
                    </button>
                  </Td>
                  {canManage && (
                    <Td last>
                      <button type="button" aria-label="Supprimer" onClick={() => remove.mutate({ id: c.id, shipmentId: s.id })} className={cn('rounded-md p-1 hover:bg-destructive/10', TEXT.muted)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <div className="space-y-5">
        <Section title="Total par devise">
          {Object.keys(totals).length === 0 ? (
            <Empty title="Rien à additionner" />
          ) : (
            <Facts cols={2}>
              {Object.entries(totals).map(([cur, t]) => (
                <Fact
                  key={cur}
                  label={cur}
                  value={fmtMoney(t.total, cur)}
                  hint={t.paid >= t.total ? 'tout est payé' : `reste ${fmtMoney(t.total - t.paid, cur)}`}
                />
              ))}
            </Facts>
          )}
        </Section>

        <Section title="Fret annoncé">
          <Facts cols={2}>
            <Fact label="Devis transitaire" value={fmtUsd(s.freight_usd)} />
            <Fact
              label="Paiement"
              value={<span className={s.freight_paid ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'}>{s.freight_paid ? 'Réglé' : 'À régler'}</span>}
            />
          </Facts>
          <p className={cn('mt-3 border-t border-black/[0.06] pt-3 text-[12px] dark:border-white/[0.06]', TEXT.muted)}>
            Le devis du transitaire ne couvre que le fret. Les surestaries, le stockage et la douane s'y ajoutent après
            l'arrivée : c'est l'écart entre cette ligne et le total ci-dessus.
          </p>
        </Section>
      </div>

      <CenterDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={submit}
        width={560}
        title="Ajouter un coût"
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} className={cn('h-9 px-4 text-[13px] font-semibold', SOFT_PILL)}>Annuler</button>
            <button type="button" onClick={submit} disabled={amount == null || amount <= 0 || add.isPending} className={cn('h-9 px-4 text-[13px] font-bold disabled:opacity-60', PRIMARY_PILL)}>
              {add.isPending ? 'Ajout…' : 'Ajouter'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <SecLabel className="mb-1.5">Poste</SecLabel>
            <div className="flex flex-wrap gap-1">
              {COST_KINDS.map((k) => (
                <button key={k} type="button" onClick={() => setKind(k)} className={cn('h-8 rounded-md px-2.5 text-[12px] font-semibold', k === kind ? PRIMARY_PILL : SOFT_PILL)}>
                  {COST_KIND_LABEL[k]}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <SecLabel className="mb-1.5">Montant</SecLabel>
              <NumberField id="cargo-cost-amount" size="sm" value={amount} onValueChange={setAmount} allowDecimal placeholder="250 000" />
            </div>
            <div>
              <SecLabel className="mb-1.5">Devise</SecLabel>
              <div className="flex gap-1">
                {CURRENCIES.map((c) => (
                  <button key={c} type="button" onClick={() => setCurrency(c)} className={cn('h-8 rounded-md px-2.5 text-[12px] font-semibold', c === currency ? PRIMARY_PILL : SOFT_PILL)}>{c}</button>
                ))}
              </div>
            </div>
            <div>
              <SecLabel className="mb-1.5">Date</SecLabel>
              <DateField id="cargo-cost-day" size="sm" value={day} onChange={(e) => setDay(e.target.value)} />
            </div>
            <div>
              <SecLabel className="mb-1.5">Référence de facture</SecLabel>
              <TextField id="cargo-cost-invoice" size="sm" value={invoice} onChange={(e) => setInvoice(e.target.value)} placeholder="FAC-2026-…" />
            </div>
            <div className="col-span-2">
              <SecLabel className="mb-1.5">Précision (facultatif)</SecLabel>
              <TextField id="cargo-cost-label" size="sm" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="3 jours de surestaries" />
            </div>
          </div>
        </div>
      </CenterDialog>
    </div>
  );
}
