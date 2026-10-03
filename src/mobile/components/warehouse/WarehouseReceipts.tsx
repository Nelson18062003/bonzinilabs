// ============================================================
// ENTREPÔT — Ce que le client a déjà payé : pour chaque devis, les
// encaissements passés (où, comment, combien, par qui) et leur reçu en PDF,
// la facture acquittée quand tout est soldé. L'agent de Douala répond ainsi
// à « j'ai déjà payé à Guangzhou » sans appeler personne.
//
// Les PDF : « Télécharger » TÉLÉCHARGE, toujours — sur le portable du bureau
// comme sur le téléphone, jamais de feuille de partage à la place. Le bouton
// « Partager » (WhatsApp, WeChat) vient en second, et seulement sur téléphone
// ou tablette. La langue est celle retenue sur l'appareil (FR | EN), lue au clic.
// ============================================================
import { useState } from 'react';
import { Download, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCargoQuote } from '@/hooks/useCargoQuote';
import { useAdminShippingSettings } from '@/hooks/useShippingSettings';
import { DEFAULT_SHIPPING_SETTINGS } from '@/lib/customerCode';
import { METHOD_LABEL, PLACE_SHORT, activePayments, xaf } from '@/lib/cargoQuote';
import { downloadInvoicePdf, downloadReceiptPdf, readCargoDocLang, shareInvoicePdf, shareReceiptPdf } from '@/lib/cargoQuotePdf';
import { canShareFiles, prefersDownload, type Outcome } from '@/components/customer-code/exportShippingLabel';
import type { ClientQuoteSummary } from '@/lib/warehouse';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, Button, Card } from '@/mobile/designKit';
import { formatDateTime } from '@/mobile/components/reception/bits';

/** « Télécharger » en grand, « Partager » en rond à côté — ce dernier seulement sur téléphone. */
function PdfActions({ label, busy, onDownload, onShare, shareLabel, className }: {
  label: string;
  busy: 'download' | 'share' | null;
  onDownload: () => void;
  onShare?: () => void;
  shareLabel: string;
  className?: string;
}) {
  return (
    <div className={cn('flex gap-2', className)}>
      <Button variant="neutral" onClick={onDownload} loading={busy === 'download'} disabled={!!busy} className="h-11 flex-1 text-[15px]"><Download /> {label}</Button>
      {onShare && <Button variant="neutral" onClick={onShare} loading={busy === 'share'} disabled={!!busy} ariaLabel={shareLabel} className="h-11 w-11 shrink-0 px-0"><Share2 /></Button>}
    </div>
  );
}

function QuoteReceipts({ summary }: { summary: ClientQuoteSummary }) {
  const { data: quote } = useCargoQuote(summary.deposit_id);
  const { data: settings } = useAdminShippingSettings();
  // Le PDF en cours de fabrication : « download:<id> » / « share:<id> » (reçu), ou « …:invoice ».
  const [busy, setBusy] = useState<string | null>(null);
  const s = settings ?? DEFAULT_SHIPPING_SETTINGS;
  const payments = quote ? activePayments(quote) : [];
  // « Partager » : seulement là où une feuille de partage a du sens (téléphone, tablette).
  const canShare = canShareFiles() && !prefersDownload();
  const state = (id: string) => (busy === `download:${id}` ? 'download' : busy === `share:${id}` ? 'share' : null);

  /** Un PDF à la fois, avec sablier ; « PDF téléchargé » sauf si la feuille de partage s'est ouverte. */
  const makePdf = async (key: string, job: () => Promise<Outcome | void>) => {
    if (busy) return;
    setBusy(key);
    try { if ((await job()) !== 'shared') toast.success('PDF téléchargé'); } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };

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
            <div key={p.id} className="space-y-2 py-3">
              <span className="block min-w-0">
                <span className={cn('block tabular-nums', TYPE.body, TEXT.strong)}>{xaf(p.amount_xaf)} · {METHOD_LABEL[p.method]} · {PLACE_SHORT[p.place]}</span>
                <span className={cn('block tabular-nums', TYPE.small, TEXT.muted)}>{p.receipt_no} · {formatDateTime(p.paid_at)}{p.received_by_name ? ` · ${p.received_by_name}` : ''}</span>
              </span>
              {quote && (
                <PdfActions
                  label="Télécharger le reçu"
                  busy={state(p.id)}
                  onDownload={() => void makePdf(`download:${p.id}`, () => downloadReceiptPdf(quote, p, s, readCargoDocLang()))}
                  onShare={canShare ? () => void makePdf(`share:${p.id}`, () => shareReceiptPdf(quote, p, s, readCargoDocLang())) : undefined}
                  shareLabel={`Partager le reçu ${p.receipt_no}`}
                />
              )}
            </div>
          ))}
        </div>
      )}
      {quote && !quote.invoice_no && payments.length === 0 && <p className={cn(TYPE.small, TEXT.muted)}>Aucun encaissement pour l'instant.</p>}
      {quote?.invoice_no && (
        <PdfActions
          label={`Télécharger la facture ${quote.invoice_no}`}
          busy={state('invoice')}
          onDownload={() => void makePdf('download:invoice', () => downloadInvoicePdf(quote, s, readCargoDocLang()))}
          onShare={canShare ? () => void makePdf('share:invoice', () => shareInvoicePdf(quote, s, readCargoDocLang())) : undefined}
          shareLabel={`Partager la facture acquittée ${quote.invoice_no}`}
        />
      )}
    </Card>
  );
}

/** Les devis d'un client vus de Douala, chacun avec ses reçus. */
export function WarehouseReceipts({ quotes }: { quotes: readonly ClientQuoteSummary[] }) {
  if (quotes.length === 0) return null;
  return <div className="space-y-3">{quotes.map((q) => <QuoteReceipts key={q.id} summary={q} />)}</div>;
}
