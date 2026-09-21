// ============================================================
// Desktop admin — le devis d'un dépôt, en section du dialogue de dépôt :
// la table des lignes (colis, base, quantité, prix unitaire, montant),
// éditable sur place pour canPriceParcels, les frais et remises, le total,
// et « Envoyer le devis » (PDF → feuille de partage ou téléchargement).
// ============================================================
import { useState } from 'react';
import { FileText, Minus, Plus, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAddQuoteLine, useCargoQuote, useEnsureQuote, useRemoveQuoteLine, useSendQuote, useSetQuoteLine } from '@/hooks/useCargoQuote';
import { useAdminShippingSettings } from '@/hooks/useShippingSettings';
import { DEFAULT_SHIPPING_SETTINGS } from '@/lib/customerCode';
import { BASIS_LABEL, BASIS_UNIT, lineNeedsMeasure, quoteStatusMeta, xaf, type QuoteBasis, type QuoteLine } from '@/lib/cargoQuote';
import { deliverQuotePdf } from '@/lib/cargoQuotePdf';
import { formatCbm, formatKg, type Deposit } from '@/lib/reception';
import { Band } from '@/components/cargo/dossier/kit';
import { formatDateTime } from '@/mobile/components/reception/bits';
import { cn } from '@/lib/utils';
import { TEXT, SOFT_PILL, PRIMARY_PILL, StatusPill, Th, Td } from '@/desktop/designKit';

const num = (s: string) => { const v = parseFloat(s.replace(/\s/g, '').replace(',', '.')); return Number.isFinite(v) ? v : null; };
const INPUT = 'h-8 w-[112px] rounded-md border border-input bg-background px-2 text-right text-[13px] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring';

function LineRow({ line, canEdit, onSave, onRemove }: { line: QuoteLine; canEdit: boolean; onSave: (p: { basis?: QuoteBasis; unitPrice?: number | null; amount?: number | null }) => void; onRemove?: () => void }) {
  const [value, setValue] = useState(() => line.basis === 'fixed' ? String(line.amount_xaf ?? '') : String(line.unit_price_xaf ?? ''));
  const isParcel = line.kind === 'parcel';
  const needs = lineNeedsMeasure(line);
  const commit = () => {
    const v = num(value); if (v == null || v < 0) return;
    if (line.basis === 'fixed') { if (v !== Number(line.amount_xaf)) onSave({ amount: v }); }
    else if (v !== Number(line.unit_price_xaf)) onSave({ unitPrice: v });
  };
  return (
    <tr>
      <Td first><span className={cn('font-mono text-[12px] font-bold', TEXT.strong)}>{isParcel ? String(line.parcel_seq ?? line.seq).padStart(2, '0') : line.kind === 'discount' ? '−' : '+'}</span></Td>
      <Td>
        <div className={cn('text-[13px] font-semibold', TEXT.strong)}>{isParcel ? (line.description || line.label || line.kind_of_parcel || 'Colis') : line.label}</div>
        {isParcel && <div className={cn('text-[11.5px] tabular-nums', needs ? 'font-semibold text-amber-700 dark:text-amber-400' : TEXT.muted)}>{needs ? 'Ni pesé ni mesuré' : `${formatKg(line.weight_kg)} · ${formatCbm(line.cbm)}`}</div>}
      </Td>
      <Td>
        {isParcel && canEdit ? (
          <select value={line.basis} onChange={(e) => { const b = e.target.value as QuoteBasis; setValue(b === 'fixed' ? String(line.amount_xaf ?? '') : String(line.unit_price_xaf ?? '')); onSave({ basis: b, unitPrice: b === 'fixed' ? null : Number(line.unit_price_xaf ?? 0), amount: b === 'fixed' ? Number(line.amount_xaf ?? 0) : null }); }} className="h-8 rounded-md border border-input bg-background px-2 text-[12.5px]">
            <option value="per_kg">au kilo</option><option value="per_cbm">au m³</option><option value="fixed">fixe</option>
          </select>
        ) : <span className={cn('text-[12.5px]', TEXT.muted)}>{isParcel ? BASIS_LABEL[line.basis] : line.kind === 'discount' ? 'remise' : 'frais'}</span>}
      </Td>
      <Td align="right"><span className={cn('text-[12.5px] tabular-nums', TEXT.muted)}>{line.basis !== 'fixed' && line.quantity != null ? `${Number(line.quantity).toLocaleString('fr-FR', { maximumFractionDigits: 3 })} ${BASIS_UNIT[line.basis]}` : ''}</span></Td>
      <Td align="right">
        {canEdit && line.kind !== 'discount' ? (
          <span className="inline-flex items-center gap-1.5">
            <input value={value} onChange={(e) => setValue(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} inputMode="decimal" className={INPUT} aria-label={line.basis === 'fixed' ? 'Montant' : 'Prix unitaire'} />
            <span className={cn('w-14 text-left text-[11px]', TEXT.muted)}>{line.basis === 'fixed' ? 'XAF' : `XAF/${BASIS_UNIT[line.basis]}`}</span>
          </span>
        ) : <span className={cn('text-[12.5px] tabular-nums', TEXT.muted)}>{line.basis !== 'fixed' && line.unit_price_xaf != null ? xaf(line.unit_price_xaf) : ''}</span>}
      </Td>
      <Td align="right"><span className={cn('text-[13px] font-bold tabular-nums', line.amount_xaf < 0 ? 'text-emerald-700 dark:text-emerald-400' : TEXT.strong)}>{xaf(line.amount_xaf)}</span></Td>
      <Td last>{onRemove && canEdit && <button type="button" onClick={onRemove} aria-label="Retirer" className={cn('inline-flex h-7 w-7 items-center justify-center', SOFT_PILL)}><Trash2 className="h-3.5 w-3.5" /></button>}</Td>
    </tr>
  );
}

export function QuoteSection({ deposit }: { deposit: Deposit }) {
  const { hasPermission } = useAdminAuth();
  const canEdit = hasPermission('canPriceParcels');
  const { data: quote, isLoading } = useCargoQuote(deposit.id);
  const { data: settings } = useAdminShippingSettings();
  const ensure = useEnsureQuote();
  const setLine = useSetQuoteLine();
  const addLine = useAddQuoteLine();
  const removeLine = useRemoveQuoteLine();
  const send = useSendQuote();
  const [extra, setExtra] = useState<'fee' | 'discount' | null>(null);
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [sending, setSending] = useState(false);

  const st = quoteStatusMeta(quote?.status);
  const locked = quote?.status === 'paid' || quote?.status === 'invoiced';
  const editable = canEdit && !locked;
  const missing = quote ? deposit.parcels.filter((p) => !quote.lines.some((l) => l.parcel_id === p.id)).length : 0;

  const sendQuote = async () => {
    if (!quote) return;
    setSending(true);
    try {
      const fresh = await send.mutateAsync(quote.id);
      if ((await deliverQuotePdf(fresh, settings ?? DEFAULT_SHIPPING_SETTINGS)) === 'downloaded') toast.success('PDF téléchargé');
    } catch (e) { toast.error((e as Error).message); } finally { setSending(false); }
  };

  return (
    <Band
      title={<span className="inline-flex items-center gap-2">Prix et devis <StatusPill tone={st.tone} label={st.label} /></span>}
      meta={quote ? <span className="inline-flex items-center gap-3">{quote.quote_no}{quote.sent_at ? ` · envoyé le ${formatDateTime(quote.sent_at)}` : ''}<b className={cn('text-[14px]', TEXT.strong)}>{xaf(quote.total_xaf)}</b></span> : undefined}
    >
      {isLoading ? null : !quote ? (
        <div className="flex items-center justify-between gap-4">
          <p className={cn('text-[13px]', TEXT.muted)}>Aucun prix posé. Une ligne par colis sera pré-remplie au tarif du jour ({deposit.location === 'office' ? 'au kilo, Air cargo' : 'au m³, Sea cargo'}).</p>
          {canEdit && <button type="button" onClick={() => ensure.mutate(deposit.id)} disabled={ensure.isPending} className={cn('inline-flex h-9 shrink-0 items-center gap-2 px-4 text-[13px] font-bold', PRIMARY_PILL)}><FileText className="h-4 w-4" /> Poser les prix</button>}
        </div>
      ) : (
        <>
          {missing > 0 && editable && (
            <button type="button" onClick={() => ensure.mutate(deposit.id)} className="mb-3 w-full rounded-md bg-amber-500/10 px-3 py-2 text-left text-[12.5px] font-semibold text-amber-800 dark:text-amber-300">
              {missing} colis ajouté{missing > 1 ? 's' : ''} depuis le devis — cliquez pour les ajouter au tarif du jour.
            </button>
          )}
          <div className="-mx-5 max-h-[320px] overflow-auto">
            <table className="w-full text-left">
              <thead><tr><Th first>N°</Th><Th>Désignation</Th><Th>Base</Th><Th align="right">Qté</Th><Th align="right">P.U.</Th><Th align="right">Montant</Th><Th last className="w-[36px]" /></tr></thead>
              <tbody>
                {quote.lines.map((l) => (
                  <LineRow key={`${l.id}-${l.basis}-${l.unit_price_xaf}-${l.amount_xaf}`} line={l} canEdit={editable} onSave={(p) => setLine.mutate({ lineId: l.id, ...p })} onRemove={l.kind !== 'parcel' ? () => removeLine.mutate(l.id) : undefined} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {editable && extra === null && (
              <>
                <button type="button" onClick={() => { setExtra('fee'); setLabel(''); setAmount(''); }} className={cn('inline-flex h-8 items-center gap-1.5 px-3 text-[12px] font-semibold', SOFT_PILL)}><Plus className="h-3.5 w-3.5" /> Frais</button>
                <button type="button" onClick={() => { setExtra('discount'); setLabel('Remise'); setAmount(''); }} className={cn('inline-flex h-8 items-center gap-1.5 px-3 text-[12px] font-semibold', SOFT_PILL)}><Minus className="h-3.5 w-3.5" /> Remise</button>
              </>
            )}
            {extra !== null && (
              <span className="flex flex-wrap items-center gap-2">
                <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Libellé" autoFocus className="h-8 w-[200px] rounded-md border border-input bg-background px-2 text-[13px]" />
                <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Montant XAF" inputMode="decimal" className={INPUT} />
                <button type="button" onClick={() => { const v = num(amount); if (v == null || !label.trim()) return; addLine.mutate({ quoteId: quote.id, kind: extra, label: label.trim(), amount: Math.abs(v) }); setExtra(null); }} disabled={!label.trim() || num(amount) == null} className={cn('inline-flex h-8 items-center px-3 text-[12px] font-bold disabled:opacity-50', PRIMARY_PILL)}>Ajouter</button>
                <button type="button" onClick={() => setExtra(null)} className={cn('inline-flex h-8 items-center px-3 text-[12px] font-semibold', SOFT_PILL)}>Annuler</button>
              </span>
            )}
            <span className="ml-auto flex items-center gap-2">
              <button type="button" onClick={() => void deliverQuotePdf(quote, settings ?? DEFAULT_SHIPPING_SETTINGS)} className={cn('inline-flex h-9 items-center gap-2 px-3.5 text-[13px] font-semibold', SOFT_PILL)}><FileText className="h-4 w-4" /> PDF</button>
              {editable && (
                <button type="button" onClick={() => void sendQuote()} disabled={sending || quote.lines.length === 0} className={cn('inline-flex h-9 items-center gap-2 px-4 text-[13px] font-bold disabled:opacity-50', PRIMARY_PILL)}>
                  <Send className="h-4 w-4" /> {quote.status === 'sent' ? 'Renvoyer le devis' : 'Envoyer le devis'}
                </button>
              )}
            </span>
          </div>
        </>
      )}
    </Band>
  );
}
