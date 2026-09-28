// ============================================================
// LE RELEVÉ DE COMPTE — refait de zéro (28/09/2026).
//
// Ce que le fondateur ne voyait pas dans l'ancien : pour chaque paiement, le
// TAUX appliqué et le montant reçu en ¥ par le fournisseur. Le relevé ne lisait
// que le grand livre (XAF). Ici, chaque écriture est reliée à son paiement
// (taux en ¥ pour 1 000 000 XAF, montant ¥, mode, bénéficiaire) ou à son dépôt
// (mode, banque), et le document se lit comme un relevé bancaire :
//
//   solde d'ouverture → entrées / sorties, une ligne par mouvement → solde de
//   clôture, avec le total payé en ¥ sur la période et le taux moyen.
//
// En français OU en anglais (le choix se fait au moment de le fabriquer).
// Ce module est PUR (aucun appel réseau) : il est testé tel quel.
// La lecture des écritures et des détails : lib/accountStatementData.ts.
// ============================================================

export type StatementLang = 'fr' | 'en';

/** Une écriture du grand livre, telle que les écrans la lisent (admin ou client). */
export interface StatementEntry {
  id: string;
  entryType: string;
  amountXAF: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceType?: string | null;
  referenceId?: string | null;
  description?: string | null;
  createdAt: string | Date;
  isTest?: boolean;
}

/** Ce qu'on sait d'un paiement (table payments). */
export interface StatementPaymentInfo {
  reference: string;
  /** Montant reçu par le fournisseur, en ¥. */
  amountRmb: number | null;
  /** Taux en ¥ pour 1 000 000 XAF (ex. 10 850). */
  rate: number | null;
  method: string | null;
  beneficiary: string | null;
  status: string | null;
}

/** Ce qu'on sait d'un dépôt (table deposits). */
export interface StatementDepositInfo {
  reference: string;
  method: string | null;
  bank: string | null;
}

export interface StatementDetails {
  payments: Record<string, StatementPaymentInfo>;
  deposits: Record<string, StatementDepositInfo>;
}

export type StatementKind = 'deposit' | 'payment' | 'refund' | 'credit' | 'debit' | 'cargo';

/** Une ligne du relevé, prête à imprimer. */
export interface StatementRow {
  date: string;
  kind: StatementKind;
  reference: string;
  /** « Paiement · Alipay » / « Payment · Alipay ». */
  label: string;
  /** Bénéficiaire, banque, motif… (peut être vide). */
  detail: string;
  /** Paiement pas encore exécuté (« en cours »). */
  pending: boolean;
  /** Paiement rejeté, annulé, ou remboursé dans la période. */
  cancelled: boolean;
  credit: number;
  debit: number;
  /** ¥ pour 1 000 000 XAF — paiements seulement. */
  rate: number | null;
  /** Montant en ¥ — paiements (et remboursements, pour information). */
  amountRmb: number | null;
  balanceBefore: number;
  balance: number;
}

export interface StatementClient {
  name: string;
  code?: string | null;
  phone?: string | null;
  email?: string | null;
  country?: string | null;
}

export interface StatementTotals {
  credit: number;
  debit: number;
  /** Total payé aux fournisseurs en ¥ (paiements de la période, remboursés exclus). */
  rmb: number;
  /** XAF correspondant à ces ¥ (pour le taux moyen). */
  xafForRmb: number;
  /** Taux moyen pondéré, en ¥ pour 1 000 000 XAF (null sans paiement). */
  averageRate: number | null;
  payments: number;
  deposits: number;
}

export interface StatementDocument {
  lang: StatementLang;
  client: StatementClient;
  /** « 1 septembre 2026 » … « 28 septembre 2026 ». */
  periodFrom: string;
  periodTo: string;
  generatedAt: string;
  openingBalance: number;
  closingBalance: number;
  rows: StatementRow[];
  totals: StatementTotals;
}

// ─── Les mots ────────────────────────────────────────────────────────────────

export const STATEMENT_TEXT = {
  fr: {
    title: 'Relevé de compte',
    client: 'Client',
    clientId: 'Identifiant client',
    period: 'Période',
    from: 'Du',
    to: 'au',
    issued: 'Émis le',
    opening: 'Solde d’ouverture',
    credits: 'Entrées',
    debits: 'Sorties',
    closing: 'Solde de clôture',
    paidRmb: 'Payé à vos fournisseurs',
    avgRate: 'Taux moyen',
    movements: 'Mouvements',
    noMovement: 'Aucun mouvement sur cette période.',
    colDate: 'Date',
    colOperation: 'Opération',
    colReference: 'Référence',
    colCredit: 'Entrée (XAF)',
    colDebit: 'Sortie (XAF)',
    colRate: 'Taux',
    colRmb: 'Montant ¥',
    colBalance: 'Solde (XAF)',
    openingRow: 'Solde d’ouverture',
    closingRow: 'Solde de clôture',
    totalRow: 'Totaux de la période',
    pending: 'en cours',
    cancelled: 'annulé',
    colon: ' :',
    rateNote: 'Taux : ¥ reçus par le fournisseur pour 1 000 000 XAF.',
    page: 'Page',
    of: 'sur',
    kinds: {
      deposit: 'Dépôt', payment: 'Paiement', refund: 'Remboursement', credit: 'Crédit', debit: 'Débit', cargo: 'Frais cargo',
    },
    payMethods: { alipay: 'Alipay', wechat: 'WeChat Pay', bank_transfer: 'Virement', cash: 'Cash' } as Record<string, string>,
    depMethods: {
      bank_transfer: 'Virement bancaire', bank_cash: 'Espèces en banque', agency_cash: 'Espèces en agence',
      om_transfer: 'Orange Money', om_withdrawal: 'Orange Money (retrait)', mtn_transfer: 'MTN MoMo', mtn_withdrawal: 'MTN MoMo (retrait)', wave: 'Wave',
    } as Record<string, string>,
    refundOf: 'Paiement annulé',
    adjustment: 'Ajustement',
    months: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  },
  en: {
    title: 'Account statement',
    client: 'Client',
    clientId: 'Client ID',
    period: 'Period',
    from: 'From',
    to: 'to',
    issued: 'Issued on',
    opening: 'Opening balance',
    credits: 'Money in',
    debits: 'Money out',
    closing: 'Closing balance',
    paidRmb: 'Paid to your suppliers',
    avgRate: 'Average rate',
    movements: 'Transactions',
    noMovement: 'No transaction in this period.',
    colDate: 'Date',
    colOperation: 'Transaction',
    colReference: 'Reference',
    colCredit: 'In (XAF)',
    colDebit: 'Out (XAF)',
    colRate: 'Rate',
    colRmb: 'Amount ¥',
    colBalance: 'Balance (XAF)',
    openingRow: 'Opening balance',
    closingRow: 'Closing balance',
    totalRow: 'Period totals',
    pending: 'in progress',
    cancelled: 'cancelled',
    colon: ':',
    rateNote: 'Rate: ¥ received by the supplier for 1,000,000 XAF.',
    page: 'Page',
    of: 'of',
    kinds: {
      deposit: 'Deposit', payment: 'Payment', refund: 'Refund', credit: 'Credit', debit: 'Debit', cargo: 'Cargo fees',
    },
    payMethods: { alipay: 'Alipay', wechat: 'WeChat Pay', bank_transfer: 'Bank transfer', cash: 'Cash' } as Record<string, string>,
    depMethods: {
      bank_transfer: 'Bank transfer', bank_cash: 'Cash at the bank', agency_cash: 'Cash at our office',
      om_transfer: 'Orange Money', om_withdrawal: 'Orange Money (withdrawal)', mtn_transfer: 'MTN MoMo', mtn_withdrawal: 'MTN MoMo (withdrawal)', wave: 'Wave',
    } as Record<string, string>,
    refundOf: 'Cancelled payment',
    adjustment: 'Adjustment',
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  },
} as const;

// ─── Nombres et dates ────────────────────────────────────────────────────────

/** « 1 250 000 » (fr) / « 1,250,000 » (en) ; signe moins en tête. */
export function statementNumber(n: number, lang: StatementLang, decimals = 0): string {
  const neg = n < 0;
  const [int, dec] = Math.abs(n).toFixed(decimals).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'en' ? ',' : ' ');
  const body = dec ? `${grouped}${lang === 'en' ? '.' : ','}${dec}` : grouped;
  return neg ? `-${body}` : body;
}

/** Le montant en ¥ : entier s'il l'est, sinon au centime (comme l'app). */
export function statementRmb(n: number, lang: StatementLang): string {
  const cents = Math.round(n * 100) / 100;
  return statementNumber(cents, lang, Number.isInteger(cents) ? 0 : 2);
}

const TZ = 'Africa/Douala';

function dayParts(value: string | Date): { y: number; m: number; d: number; hh: string; mm: string } | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '0';
  return { y: Number(g('year')), m: Number(g('month')), d: Number(g('day')), hh: g('hour'), mm: g('minute') };
}

/** « 28/09/2026 » (fr) / « 28 Sep 2026 »… on garde le format court commun : « 28/09/2026 ». */
export function statementShortDate(value: string | Date): string {
  const p = dayParts(value);
  return p ? `${String(p.d).padStart(2, '0')}/${String(p.m).padStart(2, '0')}/${p.y}` : String(value);
}

/** « 14:05 », heure de Douala. */
export function statementTime(value: string | Date): string {
  const p = dayParts(value);
  return p ? `${p.hh}:${p.mm}` : '';
}

/** « 28 septembre 2026 » / « 28 September 2026 », jour de Douala. */
export function statementLongDate(value: string | Date, lang: StatementLang): string {
  const p = dayParts(value);
  return p ? `${p.d} ${STATEMENT_TEXT[lang].months[p.m - 1]} ${p.y}` : String(value);
}

// ─── Les lignes ──────────────────────────────────────────────────────────────

/** Écritures sans effet sur le solde ou hors relevé. */
export function isStatementEntry(e: StatementEntry): boolean {
  const t = e.entryType.toUpperCase();
  if (t === 'DEPOSIT_REFUSED' || t === 'PAYMENT_EXECUTED') return false;
  return !e.isTest;
}

function kindOf(e: StatementEntry): StatementKind {
  const t = e.entryType.toUpperCase();
  if (t === 'DEPOSIT_VALIDATED' || t === 'DEPOSIT') return 'deposit';
  if (t === 'PAYMENT_RESERVED' || t === 'PAYMENT') return 'payment';
  if (t === 'PAYMENT_CANCELLED_REFUNDED') return 'refund';
  if (t === 'CARGO_FEES') return 'cargo';
  if (t === 'ADMIN_CREDIT') return 'credit';
  if (t === 'ADMIN_DEBIT') return 'debit';
  return e.balanceAfter >= e.balanceBefore ? 'credit' : 'debit';
}

const BZ_REF = /BZ-[A-Z]+-\d{4}-\d+/;

const DONE_STATUSES = new Set(['completed']);
const CLOSED_STATUSES = new Set(['completed', 'rejected', 'cancelled_by_admin']);

/** Une écriture → une ligne, enrichie de son paiement ou de son dépôt. */
export function buildStatementRow(e: StatementEntry, details: StatementDetails, lang: StatementLang): StatementRow {
  const t = STATEMENT_TEXT[lang];
  const kind = kindOf(e);
  const pay = e.referenceType === 'payment' && e.referenceId ? details.payments[e.referenceId] : undefined;
  const dep = e.referenceType === 'deposit' && e.referenceId ? details.deposits[e.referenceId] : undefined;
  const credit = e.balanceAfter > e.balanceBefore || (e.balanceAfter === e.balanceBefore && ['deposit', 'refund', 'credit'].includes(kind));
  const amount = Math.abs(e.amountXAF);
  // Un ajustement de l'équipe n'a pas de référence métier : un tiret, pas un identifiant technique.
  const reference = pay?.reference ?? dep?.reference ?? e.description?.match(BZ_REF)?.[0] ?? '—';

  let label: string = t.kinds[kind];
  let detail = '';
  let rate: number | null = null;
  let amountRmb: number | null = null;
  let pending = false;
  let cancelled = false;

  if (kind === 'payment') {
    const m = pay?.method ? t.payMethods[pay.method] ?? pay.method : null;
    label = m ? `${t.kinds.payment} · ${m}` : t.kinds.payment;
    detail = pay?.beneficiary ?? '';
    rate = pay?.rate ?? null;
    amountRmb = pay?.amountRmb ?? null;
    pending = !!pay?.status && !CLOSED_STATUSES.has(pay.status) && !DONE_STATUSES.has(pay.status);
    cancelled = !!pay?.status && CLOSED_STATUSES.has(pay.status) && !DONE_STATUSES.has(pay.status);
  } else if (kind === 'refund') {
    // La colonne ¥ reste celle des ¥ PAYÉS : le remboursement dit seulement quel paiement il annule.
    detail = pay ? `${t.refundOf} ${pay.reference}` : '';
  } else if (kind === 'deposit') {
    const m = dep?.method ? t.depMethods[dep.method] ?? dep.method : null;
    label = m ? `${t.kinds.deposit} · ${m}` : t.kinds.deposit;
    detail = dep?.bank ?? '';
  } else {
    // Ajustement ou frais : le motif saisi par l'équipe, sans la référence déjà en colonne.
    detail = (e.description ?? '').replace(BZ_REF, '').replace(/\s{2,}/g, ' ').replace(/^[\s·:—-]+|[\s·:—-]+$/g, '').trim();
    if (kind === 'credit' || kind === 'debit') label = `${t.adjustment} · ${t.kinds[kind]}`;
  }

  return {
    date: (e.createdAt instanceof Date ? e.createdAt : new Date(e.createdAt)).toISOString(),
    kind,
    reference,
    label,
    detail,
    pending,
    cancelled,
    credit: credit ? amount : 0,
    debit: credit ? 0 : amount,
    rate,
    amountRmb,
    balanceBefore: e.balanceBefore,
    balance: e.balanceAfter,
  };
}

/**
 * Les totaux de la période. Les ¥ payés et le taux moyen (pondéré par les XAF)
 * ne comptent QUE les paiements maintenus : un paiement annulé puis remboursé
 * (même référence) en est retiré tout entier.
 */
export function statementTotals(rows: StatementRow[]): StatementTotals {
  const refunded = new Set(rows.filter((r) => r.kind === 'refund').map((r) => r.detail.match(BZ_REF)?.[0]).filter(Boolean));
  let credit = 0, debit = 0, rmb = 0, xafForRmb = 0, payments = 0, deposits = 0;
  for (const r of rows) {
    credit += r.credit;
    debit += r.debit;
    if (r.kind === 'payment') {
      payments += 1;
      if (r.amountRmb != null && r.rate && !refunded.has(r.reference)) { rmb += r.amountRmb; xafForRmb += r.debit; }
    }
    if (r.kind === 'deposit') deposits += 1;
  }
  const averageRate = rmb > 0 && xafForRmb > 0 ? Math.round((rmb / xafForRmb) * 1_000_000) : null;
  return { credit, debit, rmb: Math.round(rmb * 100) / 100, xafForRmb, averageRate, payments, deposits };
}

export interface BuildStatementInput {
  lang: StatementLang;
  client: StatementClient;
  entries: StatementEntry[];
  details: StatementDetails;
  /** Période (bornes incluses) ; null = tout l'historique. */
  range: { from: Date; to: Date } | null;
  /** Solde après la dernière écriture AVANT la période (période vide ou non). */
  balanceBeforeRange?: number | null;
  now?: Date;
}

/** Tout le relevé : lignes triées, soldes, totaux, dates dans la langue choisie. */
export function buildStatementDocument({ lang, client, entries, details, range, balanceBeforeRange, now = new Date() }: BuildStatementInput): StatementDocument {
  const inRange = entries
    .filter(isStatementEntry)
    .filter((e) => {
      if (!range) return true;
      const t = (e.createdAt instanceof Date ? e.createdAt : new Date(e.createdAt)).getTime();
      return t >= range.from.getTime() && t <= range.to.getTime();
    })
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const rows = inRange.map((e) => buildStatementRow(e, details, lang));
  // Un paiement remboursé dans la période est marqué « annulé », même si son statut n'a pas suivi.
  const refunded = new Set(rows.filter((r) => r.kind === 'refund').map((r) => r.detail.match(BZ_REF)?.[0]).filter(Boolean));
  for (const r of rows) if (r.kind === 'payment' && refunded.has(r.reference)) { r.cancelled = true; r.pending = false; }
  const openingBalance = rows.length ? rows[0].balanceBefore : balanceBeforeRange ?? 0;
  const closingBalance = rows.length ? rows[rows.length - 1].balance : openingBalance;
  const firstDay = range ? range.from : rows[0] ? new Date(rows[0].date) : now;
  const lastDay = range ? range.to : now;
  return {
    lang,
    client,
    periodFrom: statementLongDate(firstDay, lang),
    periodTo: statementLongDate(lastDay, lang),
    generatedAt: `${statementLongDate(now, lang)} · ${statementTime(now)}`,
    openingBalance,
    closingBalance,
    rows,
    totals: statementTotals(rows),
  };
}

/** « releve_Jean-Kamdem_2026-09-01_2026-09-28.pdf » / « statement_… ». */
export function statementFileName(doc: StatementDocument, range: { from: Date; to: Date } | null, now = new Date()): string {
  const iso = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
  const who = doc.client.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'client';
  const span = range ? `${iso(range.from)}_${iso(range.to)}` : iso(now);
  return `${doc.lang === 'en' ? 'statement' : 'releve'}_${who}_${span}.pdf`;
}

// ─── Pages du PDF ────────────────────────────────────────────────────────────

/** Lignes par page : la page 1 porte l'en-tête complet et les chiffres. */
export const ROWS_FIRST_PAGE = 9;
export const ROWS_NEXT_PAGES = 16;

/** Les lignes réparties par page ; la dernière garde la place du solde de clôture et des totaux. */
export function statementPages<T>(rows: T[], first = ROWS_FIRST_PAGE, next = ROWS_NEXT_PAGES): T[][] {
  const pages: T[][] = [rows.slice(0, first)];
  for (let i = first; i < rows.length; i += next) pages.push(rows.slice(i, i + next));
  const last = pages[pages.length - 1];
  const room = (pages.length === 1 ? first : next) - last.length;
  // Solde de clôture + totaux ≈ 2 lignes : sans la place, ils passent sur une page à eux.
  if (room < 2 && last.length > 0) pages.push([]);
  return pages;
}
