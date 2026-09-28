// ============================================================
// LE RELEVÉ DE COMPTE — le document (A4 paysage), refait de zéro le 28/09/2026.
//
// Il se lit de haut en bas, comme un relevé bancaire :
//   1 · l'en-tête : qui émet (Bonzini · NORTON GAUSS BONZINI SARL), le titre,
//       la période ;
//   2 · le client et la période, côte à côte ;
//   3 · quatre chiffres : solde d'ouverture → entrées → sorties → solde de
//       clôture, puis ce qui a été payé aux fournisseurs en ¥ et le taux moyen ;
//   4 · le tableau : une ligne par mouvement, colonnes FIXES alignées sur
//       tout le document (date · opération · référence · entrée · sortie ·
//       taux · montant ¥ · solde). Pour chaque paiement : le taux en ¥ pour
//       1 000 000 XAF et le montant reçu par le fournisseur.
//   Les pages sont découpées ICI (statementPages), pas par react-pdf : un
//   en-tête de tableau « fixed » au milieu d'une page se répète à la même
//   hauteur sur les pages suivantes et recouvre les lignes — c'est ce qui
//   rendait l'ancien relevé illisible. Chaque page suivante a son bandeau
//   court et son en-tête de tableau ; une ligne ne se coupe jamais.
//   5 · pied de page : l'émetteur, la note sur le taux, « page x sur y ».
// En français OU en anglais (doc.lang) ; tout vient de lib/accountStatement.ts.
// ============================================================
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';
import '../fonts';
import { PdfLogo } from '../components/PDFHeader';
import { LEGAL_NAME } from '@/lib/companyIdentity';
import {
  STATEMENT_TEXT, statementNumber, statementPages, statementRmb, statementShortDate, statementTime,
  type StatementDocument, type StatementRow,
} from '@/lib/accountStatement';

const INK = '#1a1028';
const TEXT = '#2d2040';
const MUTED = '#7a7290';
const LINE = '#e7e2ee';
const ZEBRA = '#faf8fc';
const SOFT = '#f4f1f8';
const VIOLET = '#a64af7';
const GOLD = '#f3a745';
const ORANGE = '#fe560d';
const GREEN = '#15803d';
const RED = '#c2410c';

const PAGE_W = 841.89;
const M = 34;
const CONTENT_W = PAGE_W - 2 * M;

/** Largeurs des colonnes (somme = CONTENT_W) : fixes, donc alignées d'une page à l'autre. */
const COLS = {
  date: 64,
  op: 214,
  ref: 104,
  credit: 76,
  debit: 76,
  rate: 56,
  rmb: 70,
  balance: 0, // le reste
};
COLS.balance = CONTENT_W - (COLS.date + COLS.op + COLS.ref + COLS.credit + COLS.debit + COLS.rate + COLS.rmb);

const KIND_DOT: Record<StatementRow['kind'], string> = {
  deposit: GREEN, payment: VIOLET, refund: '#2563eb', credit: GREEN, debit: RED, cargo: GOLD,
};

const s = StyleSheet.create({
  page: { paddingTop: 0, paddingBottom: 46, paddingHorizontal: M, fontFamily: 'DM Sans', fontSize: 8.5, color: TEXT, backgroundColor: '#ffffff' },

  // 1 · En-tête
  head: { backgroundColor: INK, marginHorizontal: -M, paddingHorizontal: M, paddingTop: 20, paddingBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  brand: { fontSize: 17, fontWeight: 900, color: '#ffffff', marginLeft: 8, letterSpacing: 0.4 },
  legal: { fontSize: 7.5, fontWeight: 600, color: 'rgba(255,255,255,0.62)', letterSpacing: 1.2, marginTop: 6 },
  title: { fontSize: 22, fontWeight: 900, color: '#ffffff', textAlign: 'right', letterSpacing: -0.3 },
  titleSub: { fontSize: 9.5, fontWeight: 700, color: GOLD, textAlign: 'right', marginTop: 4 },
  stripe: { flexDirection: 'row', height: 3, marginHorizontal: -M },
  headSmall: { backgroundColor: INK, marginHorizontal: -M, paddingHorizontal: M, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headSmallText: { fontSize: 8.5, fontWeight: 700, color: 'rgba(255,255,255,0.75)' },

  // 2 · Client / période
  infoRow: { flexDirection: 'row', marginTop: 14, gap: 10 },
  infoCard: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
  label: { fontSize: 7, fontWeight: 700, color: MUTED, letterSpacing: 1, textTransform: 'uppercase' },
  clientName: { fontSize: 13, fontWeight: 800, color: INK, marginTop: 3 },
  infoLine: { fontSize: 8.5, color: TEXT, marginTop: 2 },
  infoStrong: { fontSize: 11, fontWeight: 800, color: INK, marginTop: 3 },

  // 3 · Chiffres
  kpiRow: { flexDirection: 'row', marginTop: 10, gap: 8 },
  kpi: { flex: 1, backgroundColor: SOFT, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
  kpiValue: { fontSize: 14, fontWeight: 900, color: INK, marginTop: 3 },
  kpiUnit: { fontSize: 8, fontWeight: 700, color: MUTED },
  kpiDark: { flex: 1, backgroundColor: INK, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
  rmbBand: { marginTop: 8, borderRadius: 8, borderWidth: 1, borderColor: '#eadcfb', backgroundColor: '#f7f0fe', paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center' },
  rmbLabel: { fontSize: 8.5, fontWeight: 700, color: '#6b21a8' },
  rmbValue: { fontSize: 12, fontWeight: 900, color: INK, marginLeft: 8 },
  rmbSep: { width: 1, height: 14, backgroundColor: '#e4d2fa', marginHorizontal: 14 },

  // 4 · Tableau
  tableTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 16, marginBottom: 6 },
  tableTitleText: { fontSize: 11, fontWeight: 900, color: INK },
  tableCount: { fontSize: 8, color: MUTED },
  th: { flexDirection: 'row', backgroundColor: INK, borderTopLeftRadius: 6, borderTopRightRadius: 6, paddingVertical: 6 },
  thText: { fontSize: 7, fontWeight: 800, color: '#ffffff', letterSpacing: 0.5, textTransform: 'uppercase', paddingHorizontal: 6 },
  tr: { flexDirection: 'row', borderBottomWidth: 0.6, borderBottomColor: LINE, paddingVertical: 5, alignItems: 'center' },
  td: { paddingHorizontal: 6 },
  num: { textAlign: 'right' },
  opLabel: { fontSize: 8.5, fontWeight: 700, color: INK },
  opDetail: { fontSize: 7.5, color: MUTED, marginTop: 1.5 },
  dim: { color: '#b8b1c6' },
  pending: { fontSize: 6.5, fontWeight: 800, color: '#9a3412', backgroundColor: '#ffedd5', borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1, marginLeft: 4 },
  cancelled: { fontSize: 6.5, fontWeight: 800, color: '#57534e', backgroundColor: '#e7e5e4', borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1, marginLeft: 4 },
  dot: { width: 5, height: 5, borderRadius: 2.5, marginRight: 5 },
  summaryRow: { flexDirection: 'row', backgroundColor: SOFT, paddingVertical: 6, borderBottomWidth: 0.6, borderBottomColor: LINE, alignItems: 'center' },
  summaryLabel: { fontSize: 8.5, fontWeight: 800, color: INK },
  totalRow: { flexDirection: 'row', backgroundColor: INK, paddingVertical: 7, borderBottomLeftRadius: 6, borderBottomRightRadius: 6, alignItems: 'center' },
  totalText: { fontSize: 8.5, fontWeight: 900, color: '#ffffff' },
  empty: { paddingVertical: 18, textAlign: 'center', color: MUTED, fontSize: 9, borderBottomWidth: 0.6, borderBottomColor: LINE },

  // 5 · Pied
  foot: { position: 'absolute', bottom: 18, left: M, right: M, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.6, borderTopColor: LINE, paddingTop: 6 },
  footText: { fontSize: 7, color: MUTED },
});

function Cell({ w, children, style, num }: { w: number; children: React.ReactNode; style?: Style; num?: boolean }) {
  return <View style={[s.td, { width: w }]}><Text style={[num ? s.num : {}, style ?? {}]}>{children}</Text></View>;
}

function HeaderRow({ doc }: { doc: StatementDocument }) {
  const t = STATEMENT_TEXT[doc.lang];
  const th = (w: number, label: string, num?: boolean) => <View style={{ width: w }}><Text style={[s.thText, num ? s.num : {}]}>{label}</Text></View>;
  return (
    <View style={s.th}>
      {th(COLS.date, t.colDate)}
      {th(COLS.op, t.colOperation)}
      {th(COLS.ref, t.colReference)}
      {th(COLS.credit, t.colCredit, true)}
      {th(COLS.debit, t.colDebit, true)}
      {th(COLS.rate, t.colRate, true)}
      {th(COLS.rmb, t.colRmb, true)}
      {th(COLS.balance, t.colBalance, true)}
    </View>
  );
}

function MovementRow({ r, i, doc }: { r: StatementRow; i: number; doc: StatementDocument }) {
  const t = STATEMENT_TEXT[doc.lang];
  const n = (v: number) => statementNumber(v, doc.lang);
  const dash = <Text style={s.dim}>—</Text>;
  return (
    <View style={[s.tr, i % 2 === 1 ? { backgroundColor: ZEBRA } : {}]} wrap={false}>
      <View style={[s.td, { width: COLS.date }]}>
        <Text>{statementShortDate(r.date)}</Text>
        <Text style={s.opDetail}>{statementTime(r.date)}</Text>
      </View>
      <View style={[s.td, { width: COLS.op }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={[s.dot, { backgroundColor: KIND_DOT[r.kind] }]} />
          <Text style={s.opLabel}>{r.label}</Text>
          {r.pending ? <Text style={s.pending}>{t.pending.toUpperCase()}</Text> : null}
          {r.cancelled ? <Text style={s.cancelled}>{t.cancelled.toUpperCase()}</Text> : null}
        </View>
        {r.detail ? <Text style={[s.opDetail, { marginLeft: 10 }]}>{r.detail}</Text> : null}
      </View>
      <Cell w={COLS.ref} style={{ fontSize: 7.8, fontWeight: 600 }}>{r.reference}</Cell>
      <Cell w={COLS.credit} num style={{ fontWeight: 800, color: GREEN }}>{r.credit ? `+${n(r.credit)}` : dash}</Cell>
      <Cell w={COLS.debit} num style={{ fontWeight: 800, color: RED }}>{r.debit ? `-${n(r.debit)}` : dash}</Cell>
      <Cell w={COLS.rate} num style={{ fontWeight: 700 }}>{r.rate ? n(r.rate) : dash}</Cell>
      <Cell w={COLS.rmb} num style={{ fontWeight: 700 }}>{r.amountRmb != null ? `${statementRmb(r.amountRmb, doc.lang)} ¥` : dash}</Cell>
      <Cell w={COLS.balance} num style={{ fontWeight: 800, color: r.balance < 0 ? RED : INK }}>{n(r.balance)}</Cell>
    </View>
  );
}

function SummaryRow({ label, value, lang }: { label: string; value: number; lang: StatementDocument['lang'] }) {
  const lead = COLS.date + COLS.op + COLS.ref + COLS.credit + COLS.debit + COLS.rate + COLS.rmb;
  return (
    <View style={s.summaryRow} wrap={false}>
      <View style={[s.td, { width: lead }]}><Text style={s.summaryLabel}>{label}</Text></View>
      <Cell w={COLS.balance} num style={{ fontWeight: 900, color: value < 0 ? RED : INK }}>{statementNumber(value, lang)}</Cell>
    </View>
  );
}

export function AccountStatementPDF({ doc }: { doc: StatementDocument }) {
  const t = STATEMENT_TEXT[doc.lang];
  const n = (v: number) => statementNumber(v, doc.lang);
  // « +1 250 000 » / « -78 704 », mais « 0 » tout court (pas de « +0 »).
  const plus = (v: number) => (v ? `+${n(v)}` : '0');
  const minus = (v: number) => (v ? `-${n(v)}` : '0');
  const { client, totals } = doc;
  const contacts = [client.phone, client.email].filter(Boolean).join('  ·  ');
  const pages = statementPages(doc.rows);
  let offset = 0;

  const footer = (
    <View style={s.foot} fixed>
      <Text style={s.footText}>BONZINI · {LEGAL_NAME} · {client.name}</Text>
      <Text style={s.footText} render={({ pageNumber, totalPages }) => `${t.page} ${pageNumber} ${t.of} ${totalPages}`} />
    </View>
  );

  const closing = (
    <>
      <SummaryRow label={t.closingRow} value={doc.closingBalance} lang={doc.lang} />
      <View style={s.totalRow} wrap={false}>
        <View style={[s.td, { width: COLS.date + COLS.op + COLS.ref }]}><Text style={s.totalText}>{t.totalRow}</Text></View>
        <Cell w={COLS.credit} num style={s.totalText}>{plus(totals.credit)}</Cell>
        <Cell w={COLS.debit} num style={s.totalText}>{minus(totals.debit)}</Cell>
        <Cell w={COLS.rate} num style={s.totalText}>{totals.averageRate ? n(totals.averageRate) : ''}</Cell>
        <Cell w={COLS.rmb} num style={s.totalText}>{totals.rmb ? `${statementRmb(totals.rmb, doc.lang)} ¥` : ''}</Cell>
        <Cell w={COLS.balance} num style={s.totalText}>{n(doc.closingBalance)}</Cell>
      </View>
    </>
  );

  return (
    <Document title={`${t.title} — ${client.name}`} author={LEGAL_NAME} creator={LEGAL_NAME} producer={LEGAL_NAME}>
      {pages.map((rows, p) => {
        const start = offset;
        offset += rows.length;
        const last = p === pages.length - 1;
        return (
          <Page key={p} size="A4" orientation="landscape" style={s.page} wrap={false}>
            {p === 0 ? (
              <>
                {/* 1 · En-tête */}
                <View style={s.head}>
                  <View>
                    <View style={s.brandRow}>
                      <PdfLogo size={28} />
                      <Text style={s.brand}>BONZINI</Text>
                    </View>
                    <Text style={s.legal}>{LEGAL_NAME}</Text>
                  </View>
                  <View>
                    <Text style={s.title}>{t.title}</Text>
                    <Text style={s.titleSub}>{t.from} {doc.periodFrom} {t.to} {doc.periodTo}</Text>
                  </View>
                </View>
                <Stripe />

                {/* 2 · Client / période */}
                <View style={s.infoRow}>
                  <View style={[s.infoCard, { flex: 1.6 }]}>
                    <Text style={s.label}>{t.client}</Text>
                    <Text style={s.clientName}>{client.name}</Text>
                    {client.code ? <Text style={s.infoLine}>{t.clientId}{t.colon} {client.code}</Text> : null}
                    {contacts ? <Text style={s.infoLine}>{contacts}</Text> : null}
                  </View>
                  <View style={s.infoCard}>
                    <Text style={s.label}>{t.period}</Text>
                    <Text style={s.infoStrong}>{doc.periodFrom}</Text>
                    <Text style={s.infoLine}>{t.to} {doc.periodTo}</Text>
                  </View>
                  <View style={s.infoCard}>
                    <Text style={s.label}>{t.issued}</Text>
                    <Text style={s.infoStrong}>{doc.generatedAt}</Text>
                    <Text style={s.infoLine}>{t.movements}{t.colon} {doc.rows.length}</Text>
                  </View>
                </View>

                {/* 3 · Les chiffres */}
                <View style={s.kpiRow}>
                  <View style={s.kpi}>
                    <Text style={s.label}>{t.opening}</Text>
                    <Text style={s.kpiValue}>{n(doc.openingBalance)} <Text style={s.kpiUnit}>XAF</Text></Text>
                  </View>
                  <View style={s.kpi}>
                    <Text style={s.label}>{t.credits}</Text>
                    <Text style={[s.kpiValue, { color: GREEN }]}>{plus(totals.credit)} <Text style={s.kpiUnit}>XAF</Text></Text>
                  </View>
                  <View style={s.kpi}>
                    <Text style={s.label}>{t.debits}</Text>
                    <Text style={[s.kpiValue, { color: RED }]}>{minus(totals.debit)} <Text style={s.kpiUnit}>XAF</Text></Text>
                  </View>
                  <View style={s.kpiDark}>
                    <Text style={[s.label, { color: 'rgba(255,255,255,0.65)' }]}>{t.closing}</Text>
                    <Text style={[s.kpiValue, { color: doc.closingBalance < 0 ? '#fdba74' : '#ffffff' }]}>{n(doc.closingBalance)} <Text style={[s.kpiUnit, { color: 'rgba(255,255,255,0.65)' }]}>XAF</Text></Text>
                  </View>
                </View>
                {totals.payments > 0 ? (
                  <View style={s.rmbBand}>
                    <Text style={s.rmbLabel}>{t.paidRmb}</Text>
                    <Text style={s.rmbValue}>{statementRmb(totals.rmb, doc.lang)} ¥</Text>
                    <View style={s.rmbSep} />
                    <Text style={s.rmbLabel}>{t.avgRate}</Text>
                    <Text style={s.rmbValue}>{totals.averageRate ? `${n(totals.averageRate)} ¥` : '—'}</Text>
                    <Text style={[s.rmbLabel, { fontWeight: 600, marginLeft: 4 }]}>/ {n(1_000_000)} XAF</Text>
                  </View>
                ) : null}

                <View style={s.tableTitle}>
                  <Text style={s.tableTitleText}>{t.movements}</Text>
                  <Text style={s.tableCount}>{t.rateNote}</Text>
                </View>
              </>
            ) : (
              <>
                {/* Page suivante : un bandeau court, puis le tableau reprend. */}
                <View style={s.headSmall}>
                  <View style={s.brandRow}>
                    <PdfLogo size={18} />
                    <Text style={[s.brand, { fontSize: 11 }]}>BONZINI</Text>
                  </View>
                  <Text style={s.headSmallText}>{t.title} · {client.name} · {doc.periodFrom} — {doc.periodTo}</Text>
                </View>
                <Stripe />
                <View style={{ height: 12 }} />
              </>
            )}

            {/* 4 · Le tableau (sa part de lignes) */}
            {rows.length > 0 || p === 0 || last ? <HeaderRow doc={doc} /> : null}
            {p === 0 ? <SummaryRow label={t.openingRow} value={doc.openingBalance} lang={doc.lang} /> : null}
            {p === 0 && doc.rows.length === 0 ? <Text style={s.empty}>{t.noMovement}</Text> : null}
            {rows.map((r, i) => <MovementRow key={`${r.reference}-${start + i}`} r={r} i={start + i} doc={doc} />)}
            {last ? closing : null}

            {/* 5 · Pied de page */}
            {footer}
          </Page>
        );
      })}
    </Document>
  );
}

function Stripe() {
  return (
    <View style={s.stripe}>
      <View style={{ flex: 2, backgroundColor: GOLD }} />
      <View style={{ flex: 3, backgroundColor: VIOLET }} />
      <View style={{ flex: 2, backgroundColor: ORANGE }} />
    </View>
  );
}
