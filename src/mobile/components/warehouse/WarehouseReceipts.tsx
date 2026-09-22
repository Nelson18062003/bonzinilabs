// ============================================================
// ENTREPÔT — Ce que le client a déjà payé : pour chaque devis, les
// encaissements passés (où, comment, combien, par qui) et leur reçu en PDF,
// la facture acquittée quand tout est soldé. L'agent de Douala répond ainsi
// à « j'ai déjà payé à Guangzhou » sans appeler personne.
// ============================================================
import { FileCheck2, Receipt } from 'lucide-react';
import { useCargoQuote } from '@/hooks/useCargoQuote';
import { useAdminShippingSettings } from '@/hooks/useShippingSettings';
import { DEFAULT_SHIPPING_SETTINGS } from '@/lib/customerCode';
import { METHOD_LABEL, PLACE_SHORT, activePayments, xaf } from '@/lib/cargoQuote';
import { deliverInvoicePdf, deliverReceiptPdf } from '@/lib/cargoQuotePdf';
import type { ClientQuoteSummary } from '@/lib/warehouse';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, Card, SoftPill } from '@/mobile/designKit';
import { formatDateTime } from '@/mobile/components/reception/bits';

function QuoteReceipts({ summary }: { summary: ClientQuoteSummary }) {
  const { data: quote } = useCargoQuote(summary.deposit_id);
  const { data: settings } = useAdminShippingSettings();
  const s = settings ?? DEFAULT_SHIPPING_SETTINGS;
  const payments = quote ? activePayments(quote) : [];
  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className={cn('block tabular-nums', TYPE.bodyStrong, TEXT.strong)}>{summary.deposit_no} · devis {summary.quote_no}</span>
          <span className={cn('block tabular-nums', TYPE.small, TEXT.muted)}>Devis {xaf(summary.total_xaf)} · encaissé {xaf(summary.amount_paid_xaf)}</span>
        </span>
        <span className={cn('shrink-0 text-right tabular-nums', TYPE.bodyStrong, summary.balance_xaf > 0 ? 'text-[#975102] dark:text-[#E8B931]' : 'text-[#02542D] dark:text-[#CFF7D3]')}>
          {summary.balance_xaf > 0 ? `reste ${xaf(summary.balance_xaf)}` : 'Soldé'}
        </span>
      </div>
      {payments.length > 0 && (
        <div className={cn('divide-y border-t', SURFACE.divider, 'divide-[#D9D9D9] dark:divide-[#444444]')}>
          {payments.map((p) => (
            <div key={p.id} className="flex items-center gap-3 py-3">
              <span className="min-w-0 flex-1">
                <span className={cn('block tabular-nums', TYPE.body, TEXT.strong)}>{xaf(p.amount_xaf)} · {METHOD_LABEL[p.method]} · {PLACE_SHORT[p.place]}</span>
                <span className={cn('block tabular-nums', TYPE.small, TEXT.muted)}>{p.receipt_no} · {formatDateTime(p.paid_at)}{p.received_by_name ? ` · ${p.received_by_name}` : ''}</span>
              </span>
              {quote && <SoftPill onClick={() => void deliverReceiptPdf(quote, p, s)} className="h-10 shrink-0 px-3 text-[14px]"><Receipt /> Reçu</SoftPill>}
            </div>
          ))}
        </div>
      )}
      {quote && !quote.invoice_no && payments.length === 0 && <p className={cn(TYPE.small, TEXT.muted)}>Aucun encaissement pour l'instant.</p>}
      {quote?.invoice_no && <SoftPill onClick={() => void deliverInvoicePdf(quote, s)} className="h-11 w-full text-[15px]"><FileCheck2 /> Facture acquittée {quote.invoice_no} (PDF)</SoftPill>}
    </Card>
  );
}

/** Les devis d'un client vus de Douala, chacun avec ses reçus. */
export function WarehouseReceipts({ quotes }: { quotes: readonly ClientQuoteSummary[] }) {
  if (quotes.length === 0) return null;
  return <div className="space-y-3">{quotes.map((q) => <QuoteReceipts key={q.id} summary={q} />)}</div>;
}
