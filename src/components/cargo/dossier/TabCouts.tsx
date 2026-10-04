/**
 * Onglet Coûts — le prix de revient réel du conteneur, justifié (refait le 03/10/2026).
 *
 * Chaque coût a un TITRE (« BESC MI2661716 »), une catégorie, un montant,
 * une date, À QUI on l'a payé, son état (à payer / payé le…), et ses
 * JUSTIFICATIFS : photos de reçus et factures, autant qu'il faut, visibles
 * d'un clic. Les coûts se rangent dans l'ordre où ils tombent : transport,
 * formalités, douane, port, livraison.
 *
 * Les totaux restent par DEVISE : convertir au taux du jour donnerait un
 * chiffre faux le lendemain.
 *
 * Le fret « annoncé » (cargo_shipments.freight_usd) est montré à part, avec
 * sa source (freight_note) : ce n'est pas un coût tant qu'on n'a pas la
 * facture.
 */
import { useMemo, useRef, useState, type DragEvent, type ElementType } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Anchor, AlertTriangle, BadgeCheck, Calculator, CheckCircle2, Circle, FileText, Landmark, Paperclip, Pencil, Plus, Receipt, Ship, Stamp,
  Trash2, Truck, Upload, Wallet, X,
} from 'lucide-react';
import { DateField, NumberField, TextArea, TextField } from '@/components/form';
import {
  useAddCargoCost, useCargoCosts, useCargoDocumentUrls, useCargoDocuments, useDeleteCargoCost, useDeleteCargoDocument,
  useUpdateCargoCost, useUpdateCargoShipment, useUploadCargoDocuments,
} from '@/hooks/useCargo';
import { Empty, FieldLabel, IconButton, IconTile, Section, Tag, ToolButton, type SectionTone } from '@/components/cargo/dossier/kit';
import { DocPreview } from '@/components/cargo/dossier/DocPreview';
import { docTitle, isImage } from '@/lib/cargo/documents';
import { COST_KINDS, COST_KIND_LABEL, fmtDay, fmtMoney, fmtUsd } from '@/lib/cargo/model';
import type { CargoCost, CargoDocument, CargoShipment } from '@/lib/cargo/model';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, SOFT_PILL, PRIMARY_PILL, CenterDialog } from '@/desktop/designKit';

const CURRENCIES = ['XAF', 'USD', 'EUR', 'CNY'] as const;
const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp';

type Family = 'transport' | 'formalites' | 'douane' | 'port' | 'livraison' | 'autre';
const FAMILIES: { key: Family; label: string; hint: string; icon: ElementType; tone: SectionTone; kinds: string[] }[] = [
  { key: 'transport', label: 'Transport', hint: 'fret maritime, surcharges, assurance', icon: Ship, tone: 'blue', kinds: ['FREIGHT', 'SURCHARGE', 'INSURANCE'] },
  { key: 'formalites', label: 'Formalités', hint: 'BESC, CIVIC, expertise, honoraires du déclarant', icon: Stamp, tone: 'orange', kinds: ['BESC', 'INSPECTION', 'TRANSIT'] },
  { key: 'douane', label: 'Douane', hint: 'droits et taxes, frais de douane', icon: Landmark, tone: 'rose', kinds: ['CUSTOMS_DUTY', 'CUSTOMS_FEE'] },
  { key: 'port', label: 'Port', hint: 'manutention, stockage, surestaries', icon: Anchor, tone: 'emerald', kinds: ['THC', 'STORAGE', 'DEMURRAGE'] },
  { key: 'livraison', label: 'Livraison', hint: 'du port à l’entrepôt de Douala', icon: Truck, tone: 'amber', kinds: ['TRUCKING'] },
  { key: 'autre', label: 'Autres coûts', hint: 'tout le reste', icon: Receipt, tone: 'neutral', kinds: ['OTHER'] },
];
const KIND_ICON: Record<string, ElementType> = {
  FREIGHT: Ship, SURCHARGE: Ship, INSURANCE: BadgeCheck, BESC: Stamp, INSPECTION: BadgeCheck, TRANSIT: FileText,
  CUSTOMS_DUTY: Landmark, CUSTOMS_FEE: Landmark, THC: Anchor, STORAGE: Anchor, DEMURRAGE: Anchor, TRUCKING: Truck, OTHER: Receipt,
};
const familyOf = (kind: string): Family => FAMILIES.find((f) => f.kinds.includes(kind))?.key ?? 'autre';
const day = (d: string | null) => (d ? fmtDay(new Date(d + 'T12:00:00')) : null);
const costTitle = (c: CargoCost) => c.label?.trim() || COST_KIND_LABEL[c.kind] || c.kind;

function totalsOf(costs: CargoCost[]) {
  const out: Record<string, { total: number; paid: number }> = {};
  for (const c of costs) {
    out[c.currency] ??= { total: 0, paid: 0 };
    out[c.currency].total += Number(c.amount);
    if (c.paid) out[c.currency].paid += Number(c.amount);
  }
  return out;
}

/* ── Une ligne de coût ─────────────────────────────────────────────────── */

function CostRow({
  cost, files, urls, canManage, uploading, onTogglePaid, onEdit, onDelete, onUpload, onPreview,
}: {
  cost: CargoCost; files: CargoDocument[]; urls: Record<string, string>; canManage: boolean; uploading: boolean;
  onTogglePaid: () => void; onEdit: () => void; onDelete: () => void; onUpload: (f: File[]) => void; onPreview: (d: CargoDocument) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const Icon = KIND_ICON[cost.kind] ?? Receipt;
  const meta = [COST_KIND_LABEL[cost.kind] ?? cost.kind, day(cost.incurred_on), cost.invoice_ref && `facture ${cost.invoice_ref}`].filter(Boolean).join(' · ');
  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); if (canManage) { const l = Array.from(e.dataTransfer.files ?? []); if (l.length) onUpload(l); } };
  return (
    <li
      onDragOver={(e) => { if (canManage) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={cn('flex gap-3 py-4 first:pt-0 last:pb-0 max-sm:flex-col', over && 'rounded-lg bg-primary/5 ring-2 ring-dashed ring-primary/40')}
    >
      <IconTile icon={Icon} size="md" className="max-sm:hidden" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className={cn('text-[14px] max-lg:text-[16px] font-bold leading-5', TEXT.strong)}>{costTitle(cost)}</div>
            <div className={cn('mt-0.5 text-[12px] max-lg:text-[14px]', TEXT.muted)}>{meta}</div>
            {cost.payee && <div className={cn('mt-0.5 text-[12px] max-lg:text-[14px]', TEXT.body)}>{cost.paid ? 'Payé à' : 'À payer à'} <b className="font-semibold">{cost.payee}</b></div>}
          </div>
          <div className="shrink-0 text-right">
            <div className={cn('text-[16px] max-lg:text-[17px] font-extrabold tabular-nums', TEXT.strong)}>{fmtMoney(Number(cost.amount), cost.currency)}</div>
            <button
              type="button"
              disabled={!canManage}
              onClick={onTogglePaid}
              title={canManage ? 'Changer l’état du paiement' : undefined}
              className={cn(
                'mt-1 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11.5px] max-lg:text-[13px] font-bold',
                cost.paid ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' : 'bg-destructive/10 text-destructive',
                canManage && 'hover:opacity-80',
              )}
            >
              {cost.paid ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
              {cost.paid ? (cost.paid_on ? `Payé le ${day(cost.paid_on)}` : 'Payé') : 'À payer'}
            </button>
          </div>
        </div>
        {cost.note && <p className={cn('mt-2 rounded-lg px-3 py-2 text-[12.5px] max-lg:text-[14px] leading-relaxed', SURFACE.inset, TEXT.body)}>{cost.note}</p>}

        {/* Justificatifs : miniatures, un clic pour voir ; glisser une photo sur la ligne l'ajoute. */}
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {files.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => onPreview(d)}
              title={docTitle(d)}
              className={cn('group relative flex h-12 items-center gap-2 overflow-hidden rounded-lg pr-2.5 ring-1 ring-black/[0.08] hover:ring-primary/40 dark:ring-white/[0.1]', SURFACE.card)}
            >
              {isImage(d) && urls[d.storage_path]
                ? <img src={urls[d.storage_path]} alt="" className="h-12 w-12 object-cover" />
                : <span className={cn('flex h-12 w-12 items-center justify-center', SURFACE.inset)}><FileText className="h-5 w-5 text-rose-600 dark:text-rose-400" /></span>}
              <span className={cn('max-w-[140px] truncate text-[12px] max-lg:text-[13px] font-semibold', TEXT.body)}>{docTitle(d)}</span>
            </button>
          ))}
          {canManage && (
            <>
              <input ref={inputRef} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => { const l = Array.from(e.target.files ?? []); e.target.value = ''; if (l.length) onUpload(l); }} />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className={cn('inline-flex h-12 items-center gap-1.5 rounded-lg border border-dashed border-black/[0.16] px-3 text-[12px] max-lg:text-[13px] font-semibold hover:border-primary/50 disabled:opacity-60 dark:border-white/[0.18]', TEXT.body)}
              >
                {uploading ? <Upload className="h-3.5 w-3.5 animate-pulse" /> : <Paperclip className="h-3.5 w-3.5" />}
                {uploading ? 'Envoi…' : files.length ? 'Ajouter un justificatif' : 'Joindre le reçu ou la facture'}
              </button>
            </>
          )}
          {!canManage && files.length === 0 && <span className={cn('text-[12px] italic', TEXT.muted)}>Aucun justificatif</span>}
        </div>
      </div>
      {canManage && (
        <div className="flex shrink-0 items-start gap-0.5 max-sm:justify-end">
          <IconButton icon={Pencil} label="Modifier" onClick={onEdit} />
          <IconButton icon={Trash2} label="Supprimer" danger onClick={onDelete} />
        </div>
      )}
    </li>
  );
}

/* ── Dialogue d'un coût ─────────────────────────────────────────────────── */

type CostDraft = {
  label: string; kind: string; amount: number | null; currency: string; incurred_on: string; payee: string;
  invoice_ref: string; paid: boolean; paid_on: string; note: string;
};
const draftOf = (c: CargoCost | null, preset?: Partial<CostDraft>): CostDraft => c ? {
  label: c.label ?? '', kind: c.kind, amount: Number(c.amount), currency: c.currency, incurred_on: c.incurred_on ?? '',
  payee: c.payee ?? '', invoice_ref: c.invoice_ref ?? '', paid: c.paid, paid_on: c.paid_on ?? '', note: c.note ?? '',
} : { label: '', kind: 'OTHER', amount: null, currency: 'XAF', incurred_on: '', payee: '', invoice_ref: '', paid: false, paid_on: '', note: '', ...preset };

function CostDialog({
  initial, preset, existingFiles, onClose, onSave, saving,
}: {
  initial: CargoCost | null; preset?: Partial<CostDraft>; existingFiles: CargoDocument[]; onClose: () => void; saving: boolean;
  onSave: (d: CostDraft, newFiles: File[]) => void;
}) {
  const [d, setD] = useState<CostDraft>(draftOf(initial, preset));
  const [files, setFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof CostDraft>(k: K, v: CostDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  // Montant : strictement positif et fini (un négatif inverserait le sens du coût sans le dire).
  const valid = d.label.trim().length > 0 && d.amount != null && Number.isFinite(d.amount) && d.amount > 0;
  const submit = () => { if (valid) onSave(d, files); };
  return (
    <CenterDialog
      open
      onClose={onClose}
      onConfirm={submit}
      width={640}
      title={initial ? 'Modifier le coût' : 'Ajouter un coût'}
      footer={
        <>
          <button type="button" onClick={onClose} className={cn('h-9 px-4 text-[13px] max-lg:text-[15px] font-semibold', SOFT_PILL)}>Annuler</button>
          <button type="button" onClick={submit} disabled={!valid || saving} className={cn('h-9 px-4 text-[13px] max-lg:text-[15px] font-bold disabled:opacity-60', PRIMARY_PILL)}>
            {saving ? 'Enregistrement…' : initial ? 'Enregistrer' : 'Ajouter le coût'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <FieldLabel htmlFor="cost-label">Titre</FieldLabel>
          <TextField id="cost-label" size="sm" value={d.label} onChange={(e) => set('label', e.target.value)} placeholder="BESC MI2661716, Fret Nansha → Kribi, CIVIC Toyota RAV4…" autoFocus />
        </div>
        <div>
          <FieldLabel>Catégorie</FieldLabel>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {COST_KINDS.map((k) => {
              const I = KIND_ICON[k] ?? Receipt;
              return (
                <button key={k} type="button" onClick={() => set('kind', k)} className={cn('flex h-9 max-lg:h-11 items-center gap-2 rounded-md px-2.5 text-left text-[12px] max-lg:text-[14px] font-semibold', k === d.kind ? PRIMARY_PILL : SOFT_PILL)}>
                  <I className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{COST_KIND_LABEL[k]}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-3 max-sm:grid-cols-1">
          <div>
            <FieldLabel htmlFor="cost-amount">Montant</FieldLabel>
            <NumberField id="cost-amount" size="sm" value={d.amount} onValueChange={(v) => set('amount', v)} allowDecimal min={0} placeholder="250 000" />
          </div>
          <div>
            <FieldLabel>Devise</FieldLabel>
            <div className="flex gap-1">
              {CURRENCIES.map((c) => (
                <button key={c} type="button" onClick={() => set('currency', c)} className={cn('h-9 max-lg:h-11 rounded-md px-3 text-[12.5px] max-lg:text-[14px] font-semibold', c === d.currency ? PRIMARY_PILL : SOFT_PILL)}>{c}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <div>
            <FieldLabel htmlFor="cost-day">Date du coût</FieldLabel>
            <DateField id="cost-day" size="sm" value={d.incurred_on} onChange={(e) => set('incurred_on', e.target.value)} />
          </div>
          <div>
            <FieldLabel htmlFor="cost-payee" hint="facultatif">Payé (ou à payer) à</FieldLabel>
            <TextField id="cost-payee" size="sm" value={d.payee} onChange={(e) => set('payee', e.target.value)} placeholder="SOFT CENTRAL LAB, Cynthia AKAH, Kribi Port…" />
          </div>
          <div>
            <FieldLabel htmlFor="cost-invoice" hint="facultatif">Référence de facture</FieldLabel>
            <TextField id="cost-invoice" size="sm" value={d.invoice_ref} onChange={(e) => set('invoice_ref', e.target.value)} placeholder="FAC-2026-…" />
          </div>
          <div>
            <FieldLabel>État</FieldLabel>
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-md bg-muted p-0.5">
                {[false, true].map((v) => (
                  <button key={String(v)} type="button" onClick={() => set('paid', v)} className={cn('h-8 max-lg:h-10 rounded-[5px] px-3 text-[12.5px] max-lg:text-[14px] font-semibold', d.paid === v ? 'bg-background text-foreground ring-1 ring-black/[0.08] dark:ring-white/[0.1]' : 'text-muted-foreground')}>
                    {v ? 'Payé' : 'À payer'}
                  </button>
                ))}
              </div>
              {d.paid && <div className="min-w-0 flex-1"><DateField id="cost-paid-on" size="sm" value={d.paid_on} onChange={(e) => set('paid_on', e.target.value)} /></div>}
            </div>
          </div>
        </div>
        <div>
          <FieldLabel htmlFor="cost-note" hint="facultatif">Note</FieldLabel>
          <TextArea id="cost-note" rows={2} value={d.note} onChange={(e) => set('note', e.target.value)} placeholder="Ce que couvre ce coût, ce qui reste à vérifier…" />
        </div>
        <div>
          <FieldLabel hint="photos ou PDF, plusieurs à la fois">Justificatifs</FieldLabel>
          <input ref={inputRef} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => { const l = Array.from(e.target.files ?? []); e.target.value = ''; setFiles((f) => [...f, ...l]); }} />
          <div className="flex flex-wrap gap-2">
            {existingFiles.map((f) => <Tag key={f.id}><Paperclip className="h-3 w-3" />{docTitle(f)}</Tag>)}
            {files.map((f, i) => (
              <span key={`${f.name}-${i}`} className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-[12px] font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                <Paperclip className="h-3 w-3" />{f.name}
                <button type="button" aria-label={`Retirer ${f.name}`} onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button>
              </span>
            ))}
            <ToolButton icon={Plus} onClick={() => inputRef.current?.click()}>Joindre</ToolButton>
          </div>
        </div>
      </div>
    </CenterDialog>
  );
}

/* ── Le fret annoncé ─────────────────────────────────────────────────────── */

function FreightDialog({ shipment: s, onClose }: { shipment: CargoShipment; onClose: () => void }) {
  const update = useUpdateCargoShipment();
  const [amount, setAmount] = useState<number | null>(s.freight_usd != null ? Number(s.freight_usd) : null);
  const [note, setNote] = useState(s.freight_note ?? '');
  const submit = () => update.mutate(
    { id: s.id, patch: { freight_usd: amount && amount > 0 ? amount : null, freight_note: note.trim() || null } },
    { onSuccess: onClose },
  );
  return (
    <CenterDialog
      open
      onClose={onClose}
      onConfirm={submit}
      title="Fret annoncé"
      footer={
        <>
          <button type="button" onClick={onClose} className={cn('h-9 px-4 text-[13px] font-semibold', SOFT_PILL)}>Annuler</button>
          <button type="button" onClick={submit} disabled={update.isPending} className={cn('h-9 px-4 text-[13px] font-bold disabled:opacity-60', PRIMARY_PILL)}>Enregistrer</button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <FieldLabel htmlFor="freight-usd">Montant annoncé (USD)</FieldLabel>
          <NumberField id="freight-usd" size="sm" value={amount} onValueChange={setAmount} allowDecimal min={0} />
        </div>
        <div>
          <FieldLabel htmlFor="freight-note">D'où vient ce chiffre ?</FieldLabel>
          <TextArea id="freight-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Devis du transitaire du…, facture n°…, à confirmer…" />
        </div>
      </div>
    </CenterDialog>
  );
}

/* ── L'onglet ─────────────────────────────────────────────────────────── */

export function TabCouts({ shipment: s, canManage }: { shipment: CargoShipment; canManage: boolean }) {
  const navigate = useNavigate();
  const { data: costs } = useCargoCosts(s.id);
  const { data: docs } = useCargoDocuments(s.id);
  const costFiles = useMemo(() => (docs ?? []).filter((d) => d.cost_id), [docs]);
  const { data: urls } = useCargoDocumentUrls(costFiles);
  const add = useAddCargoCost();
  const update = useUpdateCargoCost();
  const remove = useDeleteCargoCost();
  const upload = useUploadCargoDocuments();
  const removeDoc = useDeleteCargoDocument();

  const [dialog, setDialog] = useState<{ cost: CargoCost | null; preset?: Partial<CostDraft> } | null>(null);
  const [deleting, setDeleting] = useState<CargoCost | null>(null);
  const [freightOpen, setFreightOpen] = useState(false);
  const [uploadingCost, setUploadingCost] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ docs: CargoDocument[]; index: number } | null>(null);

  const list = useMemo(() => costs ?? [], [costs]);
  const filesOf = (id: string) => costFiles.filter((d) => d.cost_id === id).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const totals = useMemo(() => totalsOf(list), [list]);
  const hasFreightCost = list.some((c) => c.kind === 'FREIGHT');
  const missingProof = list.filter((c) => filesOf(c.id).length === 0).length;

  const uploadTo = (costId: string, files: File[]) => {
    setUploadingCost(costId);
    upload.mutate({ shipmentId: s.id, kind: 'COST', costId, files }, { onSettled: () => setUploadingCost(null) });
  };

  const save = (d: CostDraft, newFiles: File[]) => {
    const payload = {
      label: d.label.trim(), kind: d.kind, amount: d.amount as number, currency: d.currency, incurred_on: d.incurred_on || null,
      payee: d.payee.trim() || null, invoice_ref: d.invoice_ref.trim() || null, paid: d.paid, paid_on: d.paid ? d.paid_on || null : null,
      note: d.note.trim() || null,
    };
    if (dialog?.cost) {
      const id = dialog.cost.id;
      update.mutate({ id, shipmentId: s.id, patch: payload }, { onSuccess: () => { if (newFiles.length) uploadTo(id, newFiles); setDialog(null); } });
    } else {
      add.mutate({ shipmentId: s.id, cost: payload }, { onSuccess: (id) => { if (newFiles.length && id) uploadTo(id, newFiles); setDialog(null); } });
    }
  };

  return (
    <div className="space-y-5">
      {/* Le total, par devise, et l'action principale. */}
      <div className={cn('rounded-[14px] px-5 py-4', SURFACE.card, SURFACE.shadow)}>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-3">
            <IconTile icon={Wallet} tone="violet" size="lg" />
            <div>
              <div className={cn('text-[15px] max-lg:text-[17px] font-bold', TEXT.strong)}>Prix de revient du conteneur</div>
              <div className={cn('text-[12.5px] max-lg:text-[14px]', TEXT.muted)}>
                {list.length} coût{list.length > 1 ? 's' : ''} saisi{list.length > 1 ? 's' : ''}
                {missingProof > 0 && ` · ${missingProof} sans justificatif`}
              </div>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap gap-2 max-sm:ml-0">
            <ToolButton icon={Calculator} onClick={() => navigate(`/m/cargo/cout?shipment=${s.id}`)}>Estimer le coût à quai</ToolButton>
            {canManage && <ToolButton icon={Plus} primary onClick={() => setDialog({ cost: null })}>Ajouter un coût</ToolButton>}
          </div>
        </div>
        {Object.keys(totals).length > 0 && (
          <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3 border-t border-black/[0.06] pt-4 dark:border-white/[0.06]">
            {Object.entries(totals).map(([cur, t]) => (
              <div key={cur} className={cn('rounded-[12px] px-4 py-3', SURFACE.inset)}>
                <div className={cn('text-[11px] max-lg:text-[13px] font-bold uppercase tracking-wider', TEXT.muted)}>Total {cur}</div>
                <div className={cn('mt-0.5 text-[20px] max-lg:text-[22px] font-extrabold tabular-nums', TEXT.strong)}>{fmtMoney(t.total, cur)}</div>
                <div className={cn('text-[12px] max-lg:text-[14px] font-semibold tabular-nums', t.paid >= t.total ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive')}>
                  {t.paid >= t.total ? 'tout est payé' : `reste à payer ${fmtMoney(t.total - t.paid, cur)}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Le fret annoncé, avec sa source : ce n'est pas un coût tant qu'on n'a pas la facture. */}
      {(s.freight_usd != null || s.freight_note) && (
        <Section
          icon={Ship}
          tone="blue"
          title="Fret annoncé par le transitaire"
          subtitle={hasFreightCost ? 'la facture de fret est saisie plus bas' : 'pas encore de facture : ce chiffre n’est pas un coût confirmé'}
          action={canManage ? (
            <span className="flex gap-1.5">
              <ToolButton icon={Pencil} onClick={() => setFreightOpen(true)}>Modifier</ToolButton>
              {!hasFreightCost && s.freight_usd != null && (
                <ToolButton icon={Plus} onClick={() => setDialog({ cost: null, preset: { kind: 'FREIGHT', label: `Fret ${s.pol_name ?? ''} → ${s.pod_name}`.replace('  ', ' '), amount: Number(s.freight_usd), currency: 'USD', payee: '' } })}>
                  Saisir la facture
                </ToolButton>
              )}
            </span>
          ) : undefined}
        >
          <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
            <div>
              <div className={cn('text-[24px] font-extrabold tabular-nums', TEXT.strong)}>{fmtUsd(s.freight_usd)}</div>
              <div className={cn('text-[12px] max-lg:text-[14px] font-semibold', s.freight_paid ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive')}>{s.freight_paid ? 'marqué réglé' : 'non réglé'}</div>
            </div>
            {s.freight_note && (
              <p className="flex min-w-0 flex-1 items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-[12.5px] max-lg:text-[14px] leading-relaxed text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{s.freight_note}
              </p>
            )}
          </div>
        </Section>
      )}

      {list.length === 0 ? (
        <Section icon={Receipt} title="Aucun coût saisi">
          <Empty
            icon={Receipt}
            title="Note chaque dépense, avec son reçu"
            action={canManage ? <ToolButton icon={Plus} primary onClick={() => setDialog({ cost: null })}>Ajouter un coût</ToolButton> : undefined}
          >
            Fret, BESC, CIVIC, honoraires du déclarant, droits de douane, manutention, surestaries, transport final : avec la photo
            du reçu, c'est ce qui donne le vrai prix de revient, à comparer au devis.
          </Empty>
        </Section>
      ) : (
        FAMILIES.map((f) => {
          const items = list.filter((c) => familyOf(c.kind) === f.key);
          if (items.length === 0) return null;
          const t = totalsOf(items);
          return (
            <Section
              key={f.key}
              icon={f.icon}
              tone={f.tone}
              title={f.label}
              subtitle={f.hint}
              meta={Object.entries(t).map(([cur, v]) => fmtMoney(v.total, cur)).join(' · ')}
            >
              <ul className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
                {items.map((c) => (
                  <CostRow
                    key={c.id}
                    cost={c}
                    files={filesOf(c.id)}
                    urls={urls ?? {}}
                    canManage={canManage}
                    uploading={uploadingCost === c.id}
                    onTogglePaid={() => update.mutate({ id: c.id, shipmentId: s.id, patch: { paid: !c.paid, paid_on: !c.paid ? new Date().toISOString().slice(0, 10) : null } })}
                    onEdit={() => setDialog({ cost: c })}
                    onDelete={() => setDeleting(c)}
                    onUpload={(files) => uploadTo(c.id, files)}
                    onPreview={(d) => { const l = filesOf(c.id); setPreview({ docs: l, index: l.indexOf(d) }); }}
                  />
                ))}
              </ul>
            </Section>
          );
        })
      )}

      {dialog && (
        <CostDialog
          initial={dialog.cost}
          preset={dialog.preset}
          existingFiles={dialog.cost ? filesOf(dialog.cost.id) : []}
          saving={add.isPending || update.isPending}
          onClose={() => setDialog(null)}
          onSave={save}
        />
      )}
      {freightOpen && <FreightDialog shipment={s} onClose={() => setFreightOpen(false)} />}

      <CenterDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Supprimer ce coût ?"
        footer={
          <>
            <button type="button" onClick={() => setDeleting(null)} className={cn('h-9 px-4 text-[13px] font-semibold', SOFT_PILL)}>Garder</button>
            <ToolButton icon={Trash2} danger onClick={() => deleting && remove.mutate({ id: deleting.id, shipmentId: s.id, files: filesOf(deleting.id) }, { onSuccess: () => setDeleting(null) })}>Supprimer</ToolButton>
          </>
        }
      >
        <p className={cn('text-[13px] max-lg:text-[15px]', TEXT.body)}>
          <b>{deleting ? costTitle(deleting) : ''}</b> ({deleting ? fmtMoney(Number(deleting.amount), deleting.currency) : ''})
          {deleting && filesOf(deleting.id).length > 0 ? ` sera supprimé avec ses ${filesOf(deleting.id).length} justificatif(s).` : ' sera supprimé.'}
        </p>
      </CenterDialog>

      {preview && (
        <DocPreview
          docs={preview.docs}
          index={preview.index}
          urls={urls ?? {}}
          onIndex={(i) => setPreview({ ...preview, index: i })}
          onClose={() => setPreview(null)}
          onDelete={canManage ? (d) => removeDoc.mutate(d, { onSuccess: () => setPreview(null) }) : undefined}
        />
      )}
    </div>
  );
}
