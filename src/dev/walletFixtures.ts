// Dev-only fixtures for the wallet (Accueil) design previews.
// Hardcoded FR data so the design directions can be compared fairly,
// with no auth / network / Supabase. Numbers respect the brand rule:
// our activity = PAYMENTS to Chinese suppliers for African importers.

export type OpType = 'CREDIT' | 'DEBIT';

export interface PreviewOp {
  id: string;
  type: OpType;
  title: string;
  sub: string;
  amount: string; // already formatted, sign included
}

export const fx = {
  firstName: 'Aristide',
  greeting: 'Bonjour, Aristide',
  balanceXAF: '12 450 000',
  rmbApprox: '¥ 146 474',
  // Alipay rate line (CNY per 1 000 000 XAF)
  ratePerMillion: '11 765 CNY',
  rateLine: '1 000 000 XAF = 11 765 CNY',
  operations: [
    { id: '1', type: 'CREDIT', title: 'Dépôt reçu', sub: "Aujourd'hui · 09:14", amount: '+ 2 000 000' },
    { id: '2', type: 'DEBIT', title: 'Shenzhen Tech Co.', sub: 'Hier · 16:42 · Alipay', amount: '− 3 250 000' },
    { id: '3', type: 'DEBIT', title: 'Guangzhou Textiles', sub: '12 mai · WeChat Pay', amount: '− 1 800 000' },
    { id: '4', type: 'CREDIT', title: 'Dépôt reçu', sub: '10 mai · Virement', amount: '+ 5 000 000' },
  ] as PreviewOp[],
};

export const fontStack = '"DM Sans", system-ui, -apple-system, sans-serif';
