/**
 * Dossier conteneur · onglet Coûts, refonte v2 (maquette 10/35).
 *
 * Le prix de revient par devise (jamais converti : un taux du jour serait
 * faux demain), puis un coût par ligne (À payer · Payé). Toucher un coût :
 * payé / non payé, modifier, joindre un justificatif, voir ses justificatifs,
 * supprimer. Le fret annoncé par le transitaire reste à part (modifier,
 * saisir la facture). « Estimer le coût à quai » sous la liste ; « Ajouter un
 * coût » en bas. Mêmes hooks que l'onglet de l'ordinateur (TabCouts).
 */
import { useMemo, useRef, useState, type ElementType } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Anchor, BadgeCheck, Calculator, CheckCircle2, Circle, ExternalLink, FileText, Landmark, Paperclip, Pencil, Receipt, Ship, Stamp, Trash2, Truck,
} from 'lucide-react';
import {
  openCargoDocument, useAddCargoCost, useCargoCosts, useCargoDocuments, useDeleteCargoCost, useUpdateCargoCost, useUpdateCargoShipment,
  useUploadCargoDocuments,
} from '@/hooks/useCargo';
import { docTitle } from '@/lib/cargo/documents';
import { COST_KINDS, COST_KIND_LABEL, fmtDay, fmtMoney, fmtUsd } from '@/lib/cargo/model';
import type { CargoCost, CargoShipment } from '@/lib/cargo/model';
import { cn } from '@/lib/utils';
import {
  ActionSheet, BigButton, BottomSheet, ConfirmSheet, Dock, EmptyLine, FormField, IconCircle, ItemList, ItemRow, KVBox, TextArea, TextInput, TEXT,
  FOCUS_RING,
} from '@/mobile/designKit';
import { CapsLabel, ChipRow, OptionCard } from '@/mobile/components/cargo/v2';

const CURRENCIES = ['XAF', 'USD', 'EUR', 'CNY'] as const;
type Currency = (typeof CURRENCIES)[number];
const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp';
const KIND_ICON: Record<string, ElementType> = {
  FREIGHT: Ship, SURCHARGE: Ship, INSURANCE: BadgeCheck, BESC: Stamp, INSPECTION: BadgeCheck, TRANSIT: FileText,
  CUSTOMS_DUTY: Landmark, CUSTOMS_FEE: Landmark, THC: Anchor, STORAGE: Anchor, DEMURRAGE: Anchor, TRUCKING: Truck, OTHER: Receipt,
};
const costTitle = (c: Pick<CargoCost, 'label' | 'kind'>) => c.label?.trim() || COST_KIND_LABEL[c.kind] || c.kind;
const day = (d: string | null) => (d ? fmtDay(new Date(`${d}T12:00:00`)) : null);

interface Draft { kind: string; label: string; amount: string; currency: Currency; incurred_on: string; payee: string; invoice_ref: string; paid: boolean; paid_on: string; note: string }
const toDraft = (c: Partial<CargoCost> | null): Draft => ({
  kind: c?.kind ?? 'OTHER', label: c?.label ?? '', amount: c?.amount != null ? String(c.amount) : '', currency: (CURRENCIES as readonly string[]).includes(c?.currency ?? '') ? (c!.currency as Currency) : 'XAF',
  incurred_on: c?.incurred_on ?? '', payee: c?.payee ?? '', invoice_ref: c?.invoice_ref ?? '', paid: c?.paid ?? false, paid_on: c?.paid_on ?? '', note: c?.note ?? '',
});

function CostForm({ open, title, initial, onClose, onSave, saving }: { open: boolean; title: string; initial: Draft; onClose: () => void; onSave: (d: Draft, amount: number) => void; saving: boolean }) {
  const [d, setD] = useState<Draft>(initial);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const amount = Number(d.amount.replace(/\s/g, '').replace(',', '.'));
  const valid = Number.isFinite(amount) && amount > 0 && (d.currency !== 'XAF' || Number.isSafeInteger(amount));
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div>
          <CapsLabel className="mb-2">Catégorie</CapsLabel>
          <ChipRow className="-mx-6 px-6" options={COST_KINDS.map((k) => ({ value: k, label: COST_KIND_LABEL[k] }))} value={d.kind as (typeof COST_KINDS)[number]} onChange={(v) => set('kind', v)} />
        </div>
        <FormField label="Titre" htmlFor="cost-label"><TextInput id="cost-label" value={d.label} onChange={(e) => set('label', e.target.value)} placeholder={COST_KIND_LABEL[d.kind]} /></FormField>
        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
          <FormField label="Montant" htmlFor="cost-amount"><TextInput id="cost-amount" inputMode="decimal" value={d.amount} onChange={(e) => set('amount', e.target.value.replace(/[^\d.,\s]/g, ''))} /></FormField>
          <div className="flex gap-1.5">
            {CURRENCIES.map((c) => (
              <button key={c} type="button" onClick={() => set('currency', c)} aria-pressed={d.currency === c} className={cn('h-11 rounded-lg px-2.5 text-[16px] font-semibold', FOCUS_RING, d.currency === c ? 'bg-[#2C2C2C] text-[#F5F5F5] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]' : 'bg-[#F5F5F5] text-[#1E1E1E] dark:bg-[#383838] dark:text-[#F5F5F5]')}>{c}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Date" htmlFor="cost-date"><TextInput id="cost-date" type="date" value={d.incurred_on} onChange={(e) => set('incurred_on', e.target.value)} /></FormField>
          <FormField label="Facture n°" htmlFor="cost-ref"><TextInput id="cost-ref" value={d.invoice_ref} onChange={(e) => set('invoice_ref', e.target.value)} placeholder="Facultatif" /></FormField>
        </div>
        <FormField label="Payé à" htmlFor="cost-payee"><TextInput id="cost-payee" value={d.payee} onChange={(e) => set('payee', e.target.value)} placeholder="Transitaire, déclarante…" /></FormField>
        <div className="space-y-2.5">
          <OptionCard selected={!d.paid} onClick={() => set('paid', false)} title="À payer" />
          <OptionCard selected={d.paid} onClick={() => set('paid', true)} title="Payé">
            <TextInput type="date" value={d.paid_on} onChange={(e) => set('paid_on', e.target.value)} aria-label="Payé le" />
          </OptionCard>
        </div>
        <FormField label="Note" htmlFor="cost-note"><TextArea id="cost-note" rows={2} value={d.note} onChange={(e) => set('note', e.target.value)} placeholder="Facultatif" /></FormField>
        <BigButton disabled={!valid} loading={saving} onClick={() => onSave(d, amount)}>Enregistrer</BigButton>
      </div>
    </BottomSheet>
  );
}

export function DossierCosts({ s, canManage }: { s: CargoShipment; canManage: boolean }) {
  const navigate = useNavigate();
  const { data: costs } = useCargoCosts(s.id);
  const { data: docs } = useCargoDocuments(s.id);
  const add = useAddCargoCost();
  const update = useUpdateCargoCost();
  const remove = useDeleteCargoCost();
  const upload = useUploadCargoDocuments();
  const updateShipment = useUpdateCargoShipment();
  const list = useMemo(() => costs ?? [], [costs]);
  const filesOf = (id: string) => (docs ?? []).filter((d) => d.cost_id === id);
  const totals = useMemo(() => {
    const out: Record<string, { total: number; paid: number }> = {};
    for (const c of list) {
      out[c.currency] ??= { total: 0, paid: 0 };
      out[c.currency].total += Number(c.amount);
      if (c.paid) out[c.currency].paid += Number(c.amount);
    }
    return out;
  }, [list]);
  const hasFreightCost = list.some((c) => c.kind === 'FREIGHT');

  const [menu, setMenu] = useState<CargoCost | null>(null);
  const [form, setForm] = useState<{ cost: CargoCost | null; preset?: Partial<CargoCost> } | null>(null);
  const [togglePaid, setTogglePaid] = useState<CargoCost | null>(null);
  const [del, setDel] = useState<CargoCost | null>(null);
  const [proofs, setProofs] = useState<CargoCost | null>(null);
  const [freight, setFreight] = useState<{ usd: string; note: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const target = useRef<string | null>(null);
  const attach = (id: string) => { target.current = id; input.current?.click(); };

  const save = (d: Draft, amount: number) => {
    const payload = {
      label: d.label.trim() || null, kind: d.kind, amount, currency: d.currency, incurred_on: d.incurred_on || null, payee: d.payee.trim() || null,
      invoice_ref: d.invoice_ref.trim() || null, paid: d.paid, paid_on: d.paid ? d.paid_on || null : null, note: d.note.trim() || null,
    };
    if (form?.cost) update.mutate({ id: form.cost.id, shipmentId: s.id, patch: payload }, { onSuccess: () => setForm(null) });
    else add.mutate({ shipmentId: s.id, cost: payload }, { onSuccess: () => setForm(null) });
  };

  return (
    <>
      <input ref={input} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => {
        const l = Array.from(e.target.files ?? []); e.target.value = '';
        if (l.length && target.current) upload.mutate({ shipmentId: s.id, kind: 'COST', costId: target.current, files: l });
      }} />
      <div className="px-5 pt-4">
        <KVBox
          rows={Object.keys(totals).length === 0 ? [{ label: 'Prix de revient', value: '—' }] : Object.entries(totals).map(([cur, t]) => ({
            label: `Prix de revient · ${cur}`,
            value: <>{fmtMoney(t.total, cur)}<span className={cn('block text-[15px] font-medium', t.paid >= t.total ? 'text-[#009951]' : 'text-[#C00F0C]')}>{t.paid >= t.total ? 'tout payé' : `reste ${fmtMoney(t.total - t.paid, cur)}`}</span></>,
          }))}
        />
      </div>

      {list.length === 0 ? <EmptyLine>Aucun coût saisi.</EmptyLine> : (
        <ItemList className="pt-2">
          {list.map((c) => {
            const files = filesOf(c.id).length;
            return (
              <ItemRow
                key={c.id}
                leading={<IconCircle icon={KIND_ICON[c.kind] ?? Receipt} />}
                title={costTitle(c)}
                subtitle={[c.payee, c.paid ? (c.paid_on ? `payé le ${day(c.paid_on)}` : 'payé') : day(c.incurred_on), files ? `${files} justificatif${files > 1 ? 's' : ''}` : 'sans justificatif'].filter(Boolean).join(' · ')}
                amount={fmtMoney(Number(c.amount), c.currency)}
                tag={c.paid ? { tone: 'success', label: 'Payé' } : { tone: 'pending', label: 'À payer' }}
                onClick={() => setMenu(c)}
              />
            );
          })}
        </ItemList>
      )}

      {(s.freight_usd != null || s.freight_note) && (
        <ItemList className="pt-2">
          <ItemRow
            leading={<IconCircle icon={Ship} />}
            title="Fret annoncé"
            subtitle={s.freight_note ?? (hasFreightCost ? 'facture saisie' : 'pas encore de facture')}
            amount={fmtUsd(s.freight_usd)}
            tag={s.freight_paid ? { tone: 'success', label: 'Réglé' } : { tone: 'pending', label: 'À régler' }}
            onClick={canManage ? () => setFreight({ usd: s.freight_usd != null ? String(s.freight_usd) : '', note: s.freight_note ?? '' }) : undefined}
          />
        </ItemList>
      )}

      <div className="px-5 pt-5">
        <button type="button" onClick={() => navigate(`/m/cargo/cout?shipment=${s.id}`)} className={cn('inline-flex min-h-11 items-center gap-2.5 rounded text-[17px] font-semibold underline underline-offset-[3px]', FOCUS_RING, TEXT.strong)}>
          <Calculator className="h-5 w-5" /> Estimer le coût à quai
        </button>
      </div>

      {canManage && <Dock><BigButton onClick={() => setForm({ cost: null })}>Ajouter un coût</BigButton></Dock>}

      <ActionSheet
        open={menu != null}
        onClose={() => setMenu(null)}
        title={menu ? costTitle(menu) : undefined}
        actions={menu ? [
          { label: menu.paid ? 'Marquer à payer' : 'Marquer payé', icon: menu.paid ? Circle : CheckCircle2, onClick: () => setTogglePaid(menu), hidden: !canManage },
          { label: 'Modifier', icon: Pencil, onClick: () => setForm({ cost: menu }), hidden: !canManage },
          { label: 'Joindre un justificatif', icon: Paperclip, onClick: () => attach(menu.id), hidden: !canManage },
          { label: 'Voir les justificatifs', hint: `${filesOf(menu.id).length}`, icon: FileText, onClick: () => setProofs(menu), hidden: filesOf(menu.id).length === 0 },
          { label: 'Supprimer le coût', icon: Trash2, danger: true, onClick: () => setDel(menu), hidden: !canManage },
        ] : []}
      />
      <ActionSheet
        open={proofs != null}
        onClose={() => setProofs(null)}
        title="Justificatifs"
        actions={proofs ? filesOf(proofs.id).map((d) => ({ label: docTitle(d), icon: ExternalLink, onClick: () => void openCargoDocument(d) })) : []}
      />
      {form && (
        <CostForm
          key={form.cost?.id ?? 'new'}
          open
          title={form.cost ? 'Modifier le coût' : 'Ajouter un coût'}
          initial={toDraft(form.cost ?? form.preset ?? null)}
          onClose={() => setForm(null)}
          saving={add.isPending || update.isPending}
          onSave={save}
        />
      )}
      <ConfirmSheet
        open={togglePaid != null}
        onClose={() => setTogglePaid(null)}
        title={togglePaid?.paid ? 'Ce coût n’est pas payé ?' : 'Ce coût est payé ?'}
        subtitle={togglePaid ? costTitle(togglePaid) : undefined}
        rows={togglePaid ? [{ label: 'Montant', value: fmtMoney(Number(togglePaid.amount), togglePaid.currency) }, { label: 'État', before: togglePaid.paid ? 'Payé' : 'À payer', value: togglePaid.paid ? 'À payer' : 'Payé' }] : undefined}
        confirmLabel={togglePaid?.paid ? 'Marquer à payer' : 'Marquer payé'}
        loading={update.isPending}
        onConfirm={() => { if (togglePaid) update.mutate({ id: togglePaid.id, shipmentId: s.id, patch: { paid: !togglePaid.paid, paid_on: togglePaid.paid ? null : new Date().toISOString().slice(0, 10) } }, { onSuccess: () => setTogglePaid(null) }); }}
      />
      <ConfirmSheet
        open={del != null}
        danger
        onClose={() => setDel(null)}
        title="Supprimer ce coût ?"
        subtitle={del ? `${costTitle(del)} · ${fmtMoney(Number(del.amount), del.currency)}` : undefined}
        rows={del ? [{ label: 'Justificatifs', value: `${filesOf(del.id).length} · supprimés` }] : undefined}
        confirmLabel="Supprimer"
        loading={remove.isPending}
        onConfirm={() => { if (del) remove.mutate({ id: del.id, shipmentId: s.id, files: filesOf(del.id) }, { onSuccess: () => setDel(null) }); }}
      />
      <BottomSheet open={freight != null} onClose={() => setFreight(null)} title="Fret annoncé">
        {freight && (
          <div className="space-y-4">
            <FormField label="Montant (USD)" htmlFor="fr-usd"><TextInput id="fr-usd" inputMode="decimal" value={freight.usd} onChange={(e) => setFreight({ ...freight, usd: e.target.value.replace(/[^\d.,]/g, '') })} /></FormField>
            <FormField label="Source" htmlFor="fr-note"><TextArea id="fr-note" rows={2} value={freight.note} onChange={(e) => setFreight({ ...freight, note: e.target.value })} placeholder="Tableau du transitaire, BESC…" /></FormField>
            <BigButton loading={updateShipment.isPending} onClick={() => {
              const n = freight.usd.trim() ? Number(freight.usd.replace(',', '.')) : null;
              if (n != null && !(Number.isFinite(n) && n >= 0)) return;
              updateShipment.mutate({ id: s.id, patch: { freight_usd: n, freight_note: freight.note.trim() || null } }, { onSuccess: () => setFreight(null) });
            }}>Enregistrer</BigButton>
            {!hasFreightCost && s.freight_usd != null && (
              <BigButton variant="soft" onClick={() => { setFreight(null); setForm({ cost: null, preset: { kind: 'FREIGHT', label: `Fret ${s.pol_name ?? ''} → ${s.pod_name}`.replace('  ', ' '), amount: Number(s.freight_usd), currency: 'USD' } }); }}>Saisir la facture</BigButton>
            )}
          </div>
        )}
      </BottomSheet>
    </>
  );
}
