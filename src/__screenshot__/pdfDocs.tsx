// ============================================================
// Harnais — les documents cargo en PDF (devis, reçu, facture, bon de
// retrait), fabriqués par le vrai moteur sur les fixtures ; le fichier est
// posé sur window.__pdf, le script de capture le lit et le rastérise.
// ============================================================
import { useEffect, useState } from 'react';
import { useCargoQuote } from '@/hooks/useCargoQuote';
import { useRelease } from '@/hooks/useWarehouse';
import { useAdminShippingSettings } from '@/hooks/useShippingSettings';
import { DEFAULT_SHIPPING_SETTINGS } from '@/lib/customerCode';
import { activePayments } from '@/lib/cargoQuote';
import { buildInvoicePdf, buildQuotePdf, buildReceiptPdf } from '@/lib/cargoQuotePdf';
import { buildReleaseNotePdf } from '@/lib/releaseNotePdf';
import { buildMobileMoneyGuidePdf } from '@/lib/mobileMoneyGuidePdf';
import { buildBankDetailsPdf } from '@/lib/bankDetailsPdf';
import type { BankOption } from '@/types/deposit';

type Kind = 'devis' | 'recu' | 'facture' | 'bon' | 'mobile-money' | 'mobile-money-paysage' | 'banques' | 'banques-paysage' | `rib-${string}`;

export function PdfDoc({ kind }: { kind: Kind }) {
  const { data: q2 } = useCargoQuote('dep2');
  const { data: q3 } = useCargoQuote('dep3');
  const { data: release } = useRelease('rel1');
  const { data: settings } = useAdminShippingSettings();
  const [name, setName] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const s = settings ?? DEFAULT_SHIPPING_SETTINGS;
    const go = async () => {
      let file: File | null = null;
      if (kind === 'devis' && q2) file = await buildQuotePdf(q2, s);
      if (kind === 'recu' && q2) { const p = activePayments(q2)[0]; if (p) file = await buildReceiptPdf(q2, p, s); }
      if (kind === 'facture' && q3) file = await buildInvoicePdf(q3, s);
      if (kind === 'bon' && release) file = await buildReleaseNotePdf(release, null);
      if (kind === 'mobile-money') file = await buildMobileMoneyGuidePdf('portrait');
      if (kind === 'mobile-money-paysage') file = await buildMobileMoneyGuidePdf('landscape');
      if (kind === 'banques') file = await buildBankDetailsPdf({ orientation: 'portrait' });
      if (kind === 'banques-paysage') file = await buildBankDetailsPdf({ orientation: 'landscape' });
      // « rib-uba », « rib-cca-paysage »… : le RIB d'une banque, en portrait ou en paysage.
      const rib = /^rib-([a-z]+)(-paysage)?$/.exec(kind);
      if (rib) file = await buildBankDetailsPdf({ bank: rib[1].toUpperCase() as BankOption, orientation: rib[2] ? 'landscape' : 'portrait' });
      if (!file) return;
      (window as unknown as { __pdf?: File }).__pdf = file;
      setName(file.name);
    };
    go().catch((e) => setErr(String(e)));
  }, [kind, q2, q3, release, settings]);
  return <div style={{ padding: 24, fontFamily: 'sans-serif' }}>{err ? `Erreur : ${err}` : name ? `PDF prêt : ${name}` : 'Fabrication du PDF…'}</div>;
}

/** Les images d'un document, fabriquées dans le navigateur par pdf.js, affichées l'une sous l'autre. */
export function PngDoc({ doc, orientation }: { doc: import('@/lib/paymentDocuments').PaymentDoc; orientation: 'portrait' | 'landscape' }) {
  const [urls, setUrls] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    import('@/lib/paymentDocuments')
      .then((m) => m.paymentDocImages(doc, orientation))
      .then((files) => {
        (window as unknown as { __pngNames?: string[] }).__pngNames = files.map((f) => `${f.name} ${f.size}`);
        setUrls(files.map((f) => URL.createObjectURL(f)));
      })
      .catch((e) => setErr(String(e)));
  }, [doc, orientation]);
  if (err) return <div style={{ padding: 24 }}>Erreur : {err}</div>;
  return <div id="png-ready" data-count={urls.length} style={{ background: '#ddd', padding: 8 }}>{urls.map((u) => <img key={u} src={u} style={{ width: '100%', display: 'block', marginBottom: 8 }} />)}</div>;
}
