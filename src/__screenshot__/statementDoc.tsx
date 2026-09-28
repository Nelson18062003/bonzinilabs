// ============================================================
// Harnais — le relevé de compte (lib/accountStatement + AccountStatementPDF)
// sur des mouvements réalistes, rendu en UNE image (toutes les pages).
// ?lang=en · ?rows=30 (nombre de mouvements) · ?empty=1
// ============================================================
import { useEffect, useState } from 'react';
import { createElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import { buildStatementDocument, type StatementDetails, type StatementEntry } from '@/lib/accountStatement';
import { AccountStatementPDF } from '@/lib/pdf/templates/AccountStatementPDF';

const BENEF = ['Guangzhou Hongda Trading Co.', 'Yiwu Jinli Import & Export', 'Shenzhen Meiya Electronics', 'Foshan Lanyu Furniture', 'Zhang Wei'];
const METHODS = ['alipay', 'wechat', 'bank_transfer', 'alipay', 'cash'];

export function sampleStatement(count: number) {
  const entries: StatementEntry[] = [];
  const details: StatementDetails = { payments: {}, deposits: {} };
  let bal = 1_250_000;
  let t = Date.UTC(2026, 8, 1, 8, 30);
  for (let i = 0; i < count; i++) {
    t += 17 * 3600_000;
    const id = `e${i}`;
    if (i % 4 === 0) {
      const amt = [8_000_000, 6_500_000, 12_000_000][i % 3];
      details.deposits[`d${i}`] = { reference: `BZ-DP-2026-${800 + i}`, method: i % 8 === 0 ? 'bank_transfer' : 'om_transfer', bank: i % 8 === 0 ? 'Ecobank Cameroun' : null };
      entries.push({ id, entryType: 'DEPOSIT_VALIDATED', amountXAF: amt, balanceBefore: bal, balanceAfter: bal + amt, referenceType: 'deposit', referenceId: `d${i}`, description: `Dépôt BZ-DP-2026-${800 + i}`, createdAt: new Date(t) });
      bal += amt;
    } else if (i === 7) {
      const amt = 150_000;
      entries.push({ id, entryType: 'ADMIN_DEBIT', amountXAF: amt, balanceBefore: bal, balanceAfter: bal - amt, referenceType: 'adjustment', referenceId: null, description: 'Frais de dédouanement avancés', createdAt: new Date(t) });
      bal -= amt;
    } else if (i === 10) {
      const p = details.payments.p9;
      // Le remboursement rend exactement ce que le paiement annulé avait débité.
      const amt = entries.find((x) => x.referenceId === 'p9')?.amountXAF ?? 0;
      entries.push({ id, entryType: 'PAYMENT_CANCELLED_REFUNDED', amountXAF: amt, balanceBefore: bal, balanceAfter: bal + amt, referenceType: 'payment', referenceId: 'p9', description: `Remboursement ${p?.reference ?? ''}`, createdAt: new Date(t) });
      bal += amt;
    } else {
      const rate = [10850, 10800, 10692, 10900][i % 4];
      const rmb = [10000, 25000, 2782, 850, 18500, 31250][i % 6];
      const amt = Math.round((rmb / rate) * 1_000_000);
      const m = METHODS[i % METHODS.length];
      details.payments[`p${i}`] = { reference: `BZ-PY-2026-${1090 + i}`, amountRmb: rmb, rate, method: m, beneficiary: BENEF[i % BENEF.length], status: i === count - 1 ? 'processing' : 'completed' };
      entries.push({ id, entryType: 'PAYMENT_RESERVED', amountXAF: amt, balanceBefore: bal, balanceAfter: bal - amt, referenceType: 'payment', referenceId: `p${i}`, description: `Paiement BZ-PY-2026-${1090 + i}`, createdAt: new Date(t) });
      bal -= amt;
    }
  }
  return { entries, details };
}

export function StatementDoc() {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const lang = q.get('lang') === 'en' ? 'en' : 'fr';
    const { entries, details } = sampleStatement(q.get('empty') === '1' ? 0 : Number(q.get('rows') ?? 30));
    const doc = buildStatementDocument({
      lang,
      client: { name: 'Jean-Paul Kamdem', code: 'BZ-4K7Q', phone: '+237 699 12 34 56', email: 'jp.kamdem@gmail.com', country: 'Cameroun' },
      entries, details,
      range: { from: new Date('2026-08-31T23:00:00Z'), to: new Date('2026-09-28T22:59:59Z') },
      balanceBeforeRange: 1_250_000,
      now: new Date('2026-09-28T09:05:00Z'),
    });
    (async () => {
      const blob = await pdf(createElement(AccountStatementPDF, { doc }) as unknown as Parameters<typeof pdf>[0]).toBlob();
      const file = new File([blob], 'releve.pdf', { type: 'application/pdf' });
      const { pdfToSheetImage } = await import('@/lib/pdfToImages');
      const img = await pdfToSheetImage(file);
      setUrl(URL.createObjectURL(img));
    })().catch((e) => setErr(String(e)));
  }, []);
  if (err) return <div style={{ padding: 24 }}>Erreur : {err}</div>;
  return <div id="png-ready" data-count={url ? 1 : 0} style={{ background: '#ddd', padding: 8 }}>{url && <img src={url} style={{ width: '100%', display: 'block' }} />}</div>;
}
