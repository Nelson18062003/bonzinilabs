// ============================================================
// Harnais — les documents cargo en PDF (devis, reçu, facture, bon de
// retrait), fabriqués par le vrai moteur sur les fixtures ; le fichier est
// posé sur window.__pdf, le script de capture le lit et le rastérise.
// ============================================================
import { useEffect, useState } from 'react';
import { useCargoQuote } from '@/hooks/useCargoQuote';
import { useClientDeposits, useReceptionDeposit, useShipmentParcels } from '@/hooks/useReception';
import { buildSeaNoticePdf } from '@/lib/shippingNoticePdf';
import type { CargoShipment } from '@/lib/cargo/model';
import { buildClientStatementPdf } from '@/lib/clientStatementPdf';
import { useRelease } from '@/hooks/useWarehouse';
import { useAdminShippingSettings } from '@/hooks/useShippingSettings';
import { DEFAULT_SHIPPING_SETTINGS } from '@/lib/customerCode';
import { activePayments } from '@/lib/cargoQuote';
import { buildInvoicePdf, buildReceiptPdf, buildReceptionPdf, type CargoDocLang } from '@/lib/cargoQuotePdf';
import { buildReleaseNotePdf } from '@/lib/releaseNotePdf';
import { buildMobileMoneyGuidePdf } from '@/lib/mobileMoneyGuidePdf';
import { buildBankDetailsPdf } from '@/lib/bankDetailsPdf';
import type { BankOption } from '@/types/deposit';

type Kind = 'devis' | 'reception-sans-prix' | 'releve' | 'avis-conteneur' | 'recu' | 'facture' | 'facture-due' | 'bon' | 'mobile-money' | 'mobile-money-paysage' | 'banques' | 'banques-paysage' | `rib-${string}`;

export function PdfDoc({ kind }: { kind: Kind }) {
  const { data: q2 } = useCargoQuote('dep2');
  const { data: q3 } = useCargoQuote('dep3');
  const { data: d2 } = useReceptionDeposit(kind === 'devis' ? 'dep2' : undefined);
  const { data: d1 } = useReceptionDeposit(kind === 'reception-sans-prix' ? 'dep1' : undefined);
  const { data: clientDeps } = useClientDeposits(kind === 'releve' ? 'u1' : undefined);
  const { data: boxParcels } = useShipmentParcels(kind === 'avis-conteneur' ? 'ct1' : undefined);
  const { data: release } = useRelease('rel1');
  const { data: settings } = useAdminShippingSettings();
  const [name, setName] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const s = settings ?? DEFAULT_SHIPPING_SETTINGS;
    // ?doclang=fr|en : la langue du devis, du reçu et de la facture (français par défaut).
    const lang: CargoDocLang = new URLSearchParams(window.location.search).get('doclang') === 'en' ? 'en' : 'fr';
    const go = async () => {
      let file: File | null = null;
      // Le bon de réception et devis : le dépôt (photos, état) et son devis ; « sans prix » : un dépôt sans devis.
      if (kind === 'devis' && q2 && d2) file = await buildReceptionPdf({ deposit: d2, quote: q2 }, s, lang);
      if (kind === 'reception-sans-prix' && d1) file = await buildReceptionPdf({ deposit: d1, quote: null }, s, lang);
      // Le relevé des colis d'un client, à une date fixe (les captures ne bougent pas d'un jour à l'autre).
      // L'avis d'expédition d'un conteneur : la boîte des fixtures (MSKU 482913-7) et ses colis.
      if (kind === 'avis-conteneur' && boxParcels) {
        const box = { id: 'ct1', container_number: 'MSKU 482913-7', container_iso: '45G1', bl_number: 'MAEU 2261 8834', carrier: 'MAERSK', vessel_name: 'MAERSK KOWLOON', voyage: '442W',
          pol_name: 'Guangzhou (Nansha)', pod_name: 'Douala', pod_unlocode: 'CMDLA', etd_promised: '2026-09-28', etd_actual: null, eta_promised: '2026-11-05', eta_carrier: null, eta_manual: null, notes: null } as unknown as CargoShipment;
        file = await buildSeaNoticePdf(box, boxParcels, lang, '2026-09-29T08:00:00Z');
      }
      if (kind === 'releve' && clientDeps) file = await buildClientStatementPdf(clientDeps, lang, '2026-10-12T10:00:00Z');
      if (kind === 'recu' && q2) { const p = activePayments(q2)[0]; if (p) file = await buildReceiptPdf(q2, p, s, lang); }
      if (kind === 'facture' && q3) file = await buildInvoicePdf(q3, s, lang);
      // La facture établie à l'arrivée, pas encore réglée : le devis 2 (partiellement payé) avec un numéro de facture.
      if (kind === 'facture-due' && q2) file = await buildInvoicePdf({ ...q2, invoice_no: 'FA-000043', invoiced_at: '2026-10-12T09:00:00Z' }, s, lang);
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
  }, [kind, q2, q3, d1, d2, clientDeps, boxParcels, release, settings]);
  return <div style={{ padding: 24, fontFamily: 'sans-serif' }}>{err ? `Erreur : ${err}` : name ? `PDF prêt : ${name}` : 'Fabrication du PDF…'}</div>;
}

/** L'image unique d'un document (toutes les pages en planche), fabriquée dans le navigateur par pdf.js. */
export function PngDoc({ doc, orientation }: { doc: import('@/lib/paymentDocuments').PaymentDoc; orientation: 'portrait' | 'landscape' }) {
  const [urls, setUrls] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    import('@/lib/paymentDocuments')
      // ?doclang=fr|en|bi : la langue du document (bilingue par défaut).
      .then((m) => m.paymentDocImage(doc, orientation, (new URLSearchParams(window.location.search).get('doclang') ?? 'bi') as import('@/lib/pdf/docLang').DocLang))
      .then((file) => {
        (window as unknown as { __pngNames?: string[]; __pngFile?: File }).__pngNames = [`${file.name} ${file.size}`];
        (window as unknown as { __pngFile?: File }).__pngFile = file;
        setUrls([URL.createObjectURL(file)]);
      })
      .catch((e) => setErr(String(e)));
  }, [doc, orientation]);
  if (err) return <div style={{ padding: 24 }}>Erreur : {err}</div>;
  return <div id="png-ready" data-count={urls.length} style={{ background: '#ddd', padding: 8 }}>{urls.map((u) => <img key={u} src={u} style={{ width: '100%', display: 'block', marginBottom: 8 }} />)}</div>;
}
