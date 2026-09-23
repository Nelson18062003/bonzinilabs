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

type Kind = 'devis' | 'recu' | 'facture' | 'bon' | 'mobile-money' | 'mobile-money-paysage';

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
      if (!file) return;
      (window as unknown as { __pdf?: File }).__pdf = file;
      setName(file.name);
    };
    go().catch((e) => setErr(String(e)));
  }, [kind, q2, q3, release, settings]);
  return <div style={{ padding: 24, fontFamily: 'sans-serif' }}>{err ? `Erreur : ${err}` : name ? `PDF prêt : ${name}` : 'Fabrication du PDF…'}</div>;
}
