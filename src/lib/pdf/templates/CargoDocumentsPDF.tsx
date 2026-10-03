// ============================================================
// LES DOCUMENTS CARGO — devis, reçu, facture acquittée — avec l'en-tête et
// le pied officiels (même système que les reçus de dépôt et le relevé :
// @react-pdf/renderer, DM Sans, logo). L'émetteur est la société, NORTON
// GAUSS BONZINI SARL, avec ses contacts et, sur le devis, ses comptes.
//
// Chaque document sort EN UNE SEULE LANGUE, française ou anglaise, au choix
// de celui qui le télécharge : titres, colonnes, conditions, dates, moyens
// de paiement, montants (« 1 234 567 XAF » / « 1,234,567 XAF »). Seul ce
// que l'équipe a tapé (désignations, frais, notes) reste tel qu'écrit.
// ============================================================
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { PDFHeader, type PDFHeaderType } from '../components/PDFHeader';
import { PDFFooter } from '../components/PDFFooter';
import { baseStyles, colors } from '../styles';
import { formatDateIn, formatXafIn } from '../helpers';
import '../fonts';
import type { PaymentMethod, PaymentPlace, Quote, QuoteLine, QuotePayment } from '@/lib/cargoQuote';
import { BASIS_UNIT, activePayments, quoteBalance, quotePaid } from '@/lib/cargoQuote';
import { clientFullName } from '@/lib/reception';
import type { ShippingSettings } from '@/lib/customerCode';
import { LEGAL_NAME, WEBSITE, companyBankAccounts } from '@/lib/companyIdentity';

const CJK = /[一-鿿㐀-䶿豈-﫿]/;
const fam = (s: string | null | undefined) => (s && CJK.test(s) ? 'Noto Sans SC' : 'DM Sans');

const st = StyleSheet.create({
  parties: { flexDirection: 'row', gap: 18, marginBottom: 14 },
  party: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, backgroundColor: colors.light },
  partyLabel: { fontSize: 8, fontWeight: 800, color: colors.gold, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 },
  partyName: { fontSize: 11.5, fontWeight: 800, color: colors.text, marginBottom: 2 },
  partyLine: { fontSize: 9, color: colors.muted, lineHeight: 1.35 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  metaLeft: { fontSize: 10, fontWeight: 700, color: colors.text },
  metaRight: { fontSize: 9.5, color: colors.muted },
  sectionTitle: { fontSize: 9, fontWeight: 800, color: colors.gold, textTransform: 'uppercase', letterSpacing: 2, marginTop: 14, marginBottom: 6 },
  th: { flexDirection: 'row', backgroundColor: colors.violetDark, borderRadius: 4, paddingVertical: 5, paddingHorizontal: 6 },
  thc: { fontSize: 8, fontWeight: 700, color: colors.white, textTransform: 'uppercase', letterSpacing: 0.6 },
  tr: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center' },
  trAlt: { backgroundColor: colors.light },
  td: { fontSize: 9.5, color: colors.text },
  tdMuted: { fontSize: 8.5, color: colors.muted },
  cNo: { width: '7%' }, cLabel: { width: '41%' }, cBasis: { width: '12%' }, cQty: { width: '13%', textAlign: 'right' }, cUnit: { width: '13%', textAlign: 'right' }, cAmt: { width: '14%', textAlign: 'right' },
  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  totalBox: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: colors.violetDark, borderRadius: 6, paddingVertical: 7, paddingHorizontal: 12 },
  totalLabel: { fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: 1.2 },
  totalValue: { fontSize: 13, fontWeight: 900, color: colors.white },
  amountBox: { backgroundColor: colors.light, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amountLabel: { fontSize: 8.5, fontWeight: 700, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1 },
  amount: { fontSize: 26, fontWeight: 900, color: colors.text, letterSpacing: -0.8 },
  amountSide: { fontSize: 9.5, color: colors.muted, textAlign: 'right', lineHeight: 1.4 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: colors.border },
  k: { fontSize: 10, color: colors.muted }, v: { fontSize: 10.5, fontWeight: 600, color: colors.text }, vb: { fontSize: 11, fontWeight: 800, color: colors.text },
  stamp: { alignSelf: 'flex-start', borderWidth: 2, borderColor: colors.green, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 12, marginTop: 10, transform: 'rotate(-3deg)' },
  stampText: { fontSize: 14, fontWeight: 900, color: colors.green, letterSpacing: 2 },
  stampSub: { fontSize: 8.5, color: colors.green, marginTop: 2 },
  note: { fontSize: 8.5, color: colors.muted, lineHeight: 1.45, marginTop: 3 },
  bankRow: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: colors.border },
  bankName: { width: '30%', fontSize: 8.5, fontWeight: 700, color: colors.text },
  bankIban: { width: '50%', fontSize: 8.5, color: colors.text },
  bankSwift: { width: '20%', fontSize: 8.5, color: colors.muted, textAlign: 'right' },
});

export type CargoDocLang = 'fr' | 'en';

/** Tout ce que les trois documents écrivent, dans les deux langues. */
const TXT = {
  fr: {
    titleQuote: 'DEVIS DE TRANSPORT', titleReceipt: 'REÇU · FRAIS DE TRANSPORT', titleInvoice: 'FACTURE ACQUITTÉE',
    footer: 'Document généré automatiquement par Bonzini',
    issuer: 'Émetteur', client: 'Client', unassigned: 'Client à attribuer', account: 'Compte',
    office: 'Bureau Air cargo', warehouse: 'Entrepôt Sea cargo', city: 'Guangzhou, Chine',
    deposit: 'Dépôt', parcels: (n: number) => `${n} colis`,
    sentOn: 'Envoyé le', issuedOn: 'Établi le', valid: 'valable 30 jours',
    colNo: 'N°', colLabel: 'Désignation', colBasis: 'Base', colQty: 'Qté', colUnit: 'P.U.', colAmount: 'Montant', total: 'TOTAL',
    parcel: 'Colis', fee: 'frais', discount: 'remise', fixed: 'fixe', per: (unit: string) => `au ${unit}`,
    bankTitle: (name: string) => `Régler par virement · au nom de ${name}`,
    bankNote: "Mobile Money, espèces en agence ou depuis votre solde Bonzini : voir l'app, Cargo › Mes colis.",
    terms: 'Conditions',
    termsText: 'Règlement possible avant le départ de Chine ou au retrait à Douala. Les colis sont remis sur présentation du code client, une fois le devis réglé.',
    quoteRef: (no: string) => `Devis ${no}`, receiptIssued: 'reçu émis le', invoiceOf: 'facture du',
    amountReceived: 'Montant reçu', ref: 'réf.', on: 'Le', receivedBy: 'reçu par',
    afterPayment: (no: string) => `Le devis ${no} après ce paiement`,
    quoteTotal: 'Total du devis', paidToDate: 'Encaissé à ce jour', balance: 'Reste à payer',
    allPayments: 'Tous les encaissements sur ce devis',
    releaseWhenPaid: 'Les colis sont remis une fois le devis entièrement réglé.',
    releaseNow: 'Devis entièrement réglé : les colis sont remis sur présentation du code client.',
    paidStamp: 'ACQUITTÉE', paidOn: 'le', paidBy: 'Réglée par',
    invoiceNote: 'Facture acquittée : aucun montant ne reste dû sur ce dépôt. Les colis sont remis sur présentation du code client.',
    method: { cash: 'Espèces', mobile_money: 'Mobile Money', bank_transfer: 'Virement', wallet: 'Solde Bonzini', other: 'Autre' } as Record<PaymentMethod, string>,
    place: { guangzhou: 'Guangzhou, avant le départ', douala: 'Douala, au retrait', other: 'Ailleurs' } as Record<PaymentPlace, string>,
    kind: { carton: 'Carton', bag: 'Sac', bale: 'Ballot', roll: 'Rouleau', pallet: 'Palette', other: 'Colis' } as Record<string, string>,
    num: 'fr-FR',
  },
  en: {
    titleQuote: 'SHIPPING QUOTE', titleReceipt: 'RECEIPT · SHIPPING FEES', titleInvoice: 'PAID INVOICE',
    footer: 'Document generated automatically by Bonzini',
    issuer: 'Issued by', client: 'Customer', unassigned: 'Customer to be assigned', account: 'Account',
    office: 'Air cargo office', warehouse: 'Sea cargo warehouse', city: 'Guangzhou, China',
    deposit: 'Deposit', parcels: (n: number) => `${n} parcel${n > 1 ? 's' : ''}`,
    sentOn: 'Sent on', issuedOn: 'Issued on', valid: 'valid for 30 days',
    colNo: 'No.', colLabel: 'Description', colBasis: 'Basis', colQty: 'Qty', colUnit: 'Unit price', colAmount: 'Amount', total: 'TOTAL',
    parcel: 'Parcel', fee: 'fee', discount: 'discount', fixed: 'flat', per: (unit: string) => `per ${unit}`,
    bankTitle: (name: string) => `Pay by bank transfer · account holder ${name}`,
    bankNote: 'Mobile Money, cash at our agency or from your Bonzini balance: see the app, Cargo › My parcels.',
    terms: 'Terms',
    termsText: 'Payment can be made before departure from China or on collection in Douala. Parcels are released on presentation of the customer code, once the quote is paid.',
    quoteRef: (no: string) => `Quote ${no}`, receiptIssued: 'receipt issued on', invoiceOf: 'invoice dated',
    amountReceived: 'Amount received', ref: 'ref.', on: 'On', receivedBy: 'received by',
    afterPayment: (no: string) => `Quote ${no} after this payment`,
    quoteTotal: 'Quote total', paidToDate: 'Paid to date', balance: 'Balance due',
    allPayments: 'All payments on this quote',
    releaseWhenPaid: 'Parcels are released once the quote is paid in full.',
    releaseNow: 'Quote paid in full: parcels are released on presentation of the customer code.',
    paidStamp: 'PAID', paidOn: 'on', paidBy: 'Paid by',
    invoiceNote: 'Paid invoice: nothing remains due on this deposit. Parcels are released on presentation of the customer code.',
    method: { cash: 'Cash', mobile_money: 'Mobile Money', bank_transfer: 'Bank transfer', wallet: 'Bonzini balance', other: 'Other' } as Record<PaymentMethod, string>,
    place: { guangzhou: 'Guangzhou, before departure', douala: 'Douala, on collection', other: 'Elsewhere' } as Record<PaymentPlace, string>,
    kind: { carton: 'Carton', bag: 'Bag', bale: 'Bale', roll: 'Roll', pallet: 'Pallet', other: 'Parcel' } as Record<string, string>,
    num: 'en-US',
  },
};
type Txt = (typeof TXT)['fr'];

// Un colis sans description prend son TYPE, traduit — jamais la valeur brute de la base (« bag », « pallet »).
const lineLabel = (l: QuoteLine, t: Txt) => (l.kind === 'parcel' ? (l.description || l.label || (l.kind_of_parcel ? t.kind[l.kind_of_parcel] ?? t.parcel : t.parcel)) : l.label);

/** Le pays du client, tel qu'il est enregistré (en français) ; en anglais pour un document anglais. */
const COUNTRY_EN: Record<string, string> = {
  cameroun: 'Cameroon', tchad: 'Chad', gabon: 'Gabon', congo: 'Congo', 'république du congo': 'Republic of the Congo',
  'république démocratique du congo': 'DR Congo', rdc: 'DR Congo', 'guinée équatoriale': 'Equatorial Guinea', guinée: 'Guinea',
  centrafrique: 'Central African Republic', 'république centrafricaine': 'Central African Republic', "côte d'ivoire": "Côte d'Ivoire",
  sénégal: 'Senegal', bénin: 'Benin', togo: 'Togo', niger: 'Niger', mali: 'Mali', 'burkina faso': 'Burkina Faso', nigéria: 'Nigeria',
  nigeria: 'Nigeria', ghana: 'Ghana', chine: 'China', france: 'France', belgique: 'Belgium', maroc: 'Morocco',
};
const countryIn = (c: string | null | undefined, lang: CargoDocLang) => (c && lang === 'en' ? COUNTRY_EN[c.trim().toLowerCase()] ?? c : c);
const lineBasis = (l: QuoteLine, t: Txt) => (l.kind !== 'parcel' ? (l.kind === 'discount' ? t.discount : t.fee) : l.basis === 'fixed' ? t.fixed : t.per(BASIS_UNIT[l.basis]));
const lineQty = (l: QuoteLine, t: Txt) => (l.basis === 'fixed' || l.quantity == null ? '' : `${Number(l.quantity).toLocaleString(t.num, { maximumFractionDigits: 3 })} ${BASIS_UNIT[l.basis]}`);

/** L'émetteur (la société) et le client, côte à côte. */
function Parties({ q, settings, lang }: { q: Quote; settings: ShippingSettings; lang: CargoDocLang }) {
  const t = TXT[lang];
  const loc = settings[q.location];
  const c = settings.company;
  const name = q.client ? clientFullName(q.client) : t.unassigned;
  return (
    <View style={st.parties}>
      <View style={st.party}>
        <Text style={st.partyLabel}>{t.issuer}</Text>
        <Text style={st.partyName}>{LEGAL_NAME}</Text>
        <Text style={st.partyLine}>{q.location === 'office' ? t.office : t.warehouse} · {t.city}</Text>
        {/* L'adresse officielle telle qu'elle est enregistrée (anglais / pinyin) : c'est une adresse, pas une phrase à traduire. */}
        {loc.addressEn ? <Text style={st.partyLine}>{loc.addressEn}</Text> : null}
        <Text style={st.partyLine}>{[c.email, c.whatsapp ? `WhatsApp ${c.whatsapp}` : null, loc.wechat ? `WeChat ${loc.wechat}` : null].filter(Boolean).join(' · ')}</Text>
        <Text style={st.partyLine}>{WEBSITE}</Text>
      </View>
      <View style={st.party}>
        <Text style={st.partyLabel}>{t.client}</Text>
        <Text style={[st.partyName, { fontFamily: fam(name) }]}>{name}</Text>
        {q.client?.company_name ? <Text style={st.partyLine}>{q.client.company_name}</Text> : null}
        <Text style={st.partyLine}>{[q.client?.customer_code, q.client?.phone].filter(Boolean).join(' · ')}</Text>
        {q.client?.email ? <Text style={st.partyLine}>{q.client.email}</Text> : null}
        <Text style={st.partyLine}>{[q.client?.city, countryIn(q.client?.country, lang)].filter(Boolean).join(', ')}</Text>
        {q.client?.account_name ? <Text style={st.partyLine}>{t.account} {q.client.account_name}</Text> : null}
      </View>
    </View>
  );
}

function Meta({ q, right, lang }: { q: Quote; right: string; lang: CargoDocLang }) {
  const t = TXT[lang];
  const mode = q.location === 'office' ? 'Air cargo' : 'Sea cargo';
  const n = q.lines.filter((l) => l.kind === 'parcel').length;
  return (
    <View style={st.metaRow}>
      <Text style={st.metaLeft}>{t.deposit} {q.deposit_no} · {mode} · {t.parcels(n)}</Text>
      <Text style={st.metaRight}>{right}</Text>
    </View>
  );
}

function LinesTable({ q, lang }: { q: Quote; lang: CargoDocLang }) {
  const t = TXT[lang];
  const money = (v: number | null | undefined) => formatXafIn(v, lang);
  return (
    <View>
      <View style={st.th}>
        <Text style={[st.thc, st.cNo]}>{t.colNo}</Text><Text style={[st.thc, st.cLabel]}>{t.colLabel}</Text><Text style={[st.thc, st.cBasis]}>{t.colBasis}</Text>
        <Text style={[st.thc, st.cQty]}>{t.colQty}</Text><Text style={[st.thc, st.cUnit]}>{t.colUnit}</Text><Text style={[st.thc, st.cAmt]}>{t.colAmount}</Text>
      </View>
      {q.lines.map((l, i) => (
        <View key={l.id} style={[st.tr, ...(i % 2 ? [st.trAlt] : [])]} wrap={false}>
          <Text style={[st.td, st.cNo]}>{l.kind === 'parcel' ? String(l.parcel_seq ?? l.seq).padStart(2, '0') : ''}</Text>
          <View style={st.cLabel}>
            <Text style={[st.td, { fontFamily: fam(lineLabel(l, t)) }]}>{lineLabel(l, t)}</Text>
            {l.kind === 'parcel' && (l.weight_kg != null || l.cbm != null) ? <Text style={st.tdMuted}>{[l.parcel_no, l.weight_kg != null ? `${Number(l.weight_kg).toLocaleString(t.num)} kg` : null, l.cbm != null ? `${Number(l.cbm).toLocaleString(t.num, { maximumFractionDigits: 3 })} m³` : null].filter(Boolean).join(' · ')}</Text> : null}
          </View>
          <Text style={[st.td, st.cBasis]}>{lineBasis(l, t)}</Text>
          <Text style={[st.td, st.cQty]}>{lineQty(l, t)}</Text>
          <Text style={[st.td, st.cUnit]}>{l.basis === 'fixed' || l.unit_price_xaf == null ? '' : money(l.unit_price_xaf)}</Text>
          <Text style={[st.td, st.cAmt, { fontWeight: 700 }]}>{money(l.amount_xaf)}</Text>
        </View>
      ))}
      <View style={st.totalRow}>
        <View style={st.totalBox}><Text style={st.totalLabel}>{t.total}</Text><Text style={st.totalValue}>{money(q.total_xaf)}</Text></View>
      </View>
    </View>
  );
}

function PaymentsList({ payments, title, lang }: { payments: QuotePayment[]; title: string; lang: CargoDocLang }) {
  const t = TXT[lang];
  if (payments.length === 0) return null;
  return (
    <View>
      <Text style={st.sectionTitle}>{title}</Text>
      {payments.map((p) => (
        <View key={p.id} style={st.kv}>
          <Text style={[st.k, { flex: 1, paddingRight: 12 }]}>{p.receipt_no} · {formatDateIn(p.paid_at, lang)} · {t.method[p.method]}{p.reference ? ` (${p.reference})` : ''} · {t.place[p.place]}</Text>
          <Text style={[st.v, { flexShrink: 0, textAlign: 'right' }]}>{formatXafIn(p.amount_xaf, lang)}</Text>
        </View>
      ))}
    </View>
  );
}

function BankAccounts({ lang }: { lang: CargoDocLang }) {
  const t = TXT[lang];
  const accounts = companyBankAccounts();
  if (accounts.length === 0) return null;
  return (
    <View>
      <Text style={st.sectionTitle}>{t.bankTitle(LEGAL_NAME)}</Text>
      {accounts.map((a) => (
        <View key={a.iban} style={st.bankRow}><Text style={st.bankName}>{a.bank}</Text><Text style={st.bankIban}>{a.iban}</Text><Text style={st.bankSwift}>{a.swift}</Text></View>
      ))}
      <Text style={st.note}>{t.bankNote}</Text>
    </View>
  );
}

function Shell({ type, label, reference, lang, children }: { type: PDFHeaderType; label: string; reference: string; lang: CargoDocLang; children: React.ReactNode }) {
  return (
    <Document language={lang}>
      <Page size="A4" style={baseStyles.page}>
        <PDFHeader type={type} label={label} reference={reference} />
        {children}
        <PDFFooter text={TXT[lang].footer} />
      </Page>
    </Document>
  );
}

// ── Le devis ──
export function CargoQuotePDF({ q, settings, lang = 'fr' }: { q: Quote; settings: ShippingSettings; lang?: CargoDocLang }) {
  const t = TXT[lang];
  return (
    <Shell type="devis" label={t.titleQuote} reference={q.quote_no} lang={lang}>
      <Meta q={q} lang={lang} right={`${q.sent_at ? t.sentOn : t.issuedOn} ${formatDateIn(q.sent_at ?? q.updated_at, lang)} · ${t.valid}`} />
      <Parties q={q} settings={settings} lang={lang} />
      <LinesTable q={q} lang={lang} />
      <BankAccounts lang={lang} />
      <Text style={st.sectionTitle}>{t.terms}</Text>
      <Text style={st.note}>{t.termsText}</Text>
      {q.notes ? <Text style={[st.note, { fontFamily: fam(q.notes) }]}>{q.notes}</Text> : null}
    </Shell>
  );
}

// ── Le reçu d'un encaissement ──
export function CargoReceiptPDF({ q, p, settings, lang = 'fr' }: { q: Quote; p: QuotePayment; settings: ShippingSettings; lang?: CargoDocLang }) {
  const t = TXT[lang];
  const paid = quotePaid(q); const balance = quoteBalance(q);
  return (
    <Shell type="recu-cargo" label={t.titleReceipt} reference={p.receipt_no} lang={lang}>
      <Meta q={q} lang={lang} right={`${t.quoteRef(q.quote_no)} · ${t.receiptIssued} ${formatDateIn(p.paid_at, lang)}`} />
      <Parties q={q} settings={settings} lang={lang} />
      <View style={st.amountBox}>
        <View>
          <Text style={st.amountLabel}>{t.amountReceived}</Text>
          <Text style={st.amount}>{formatXafIn(p.amount_xaf, lang)}</Text>
        </View>
        <Text style={st.amountSide}>{`${t.method[p.method]}${p.reference ? ` · ${t.ref} ${p.reference}` : ''}\n${t.place[p.place]}\n${t.on} ${formatDateIn(p.paid_at, lang)}${p.received_by_name ? ` · ${t.receivedBy} ${p.received_by_name}` : ''}`}</Text>
      </View>
      <Text style={st.sectionTitle}>{t.afterPayment(q.quote_no)}</Text>
      <View style={st.kv}><Text style={st.k}>{t.quoteTotal}</Text><Text style={st.v}>{formatXafIn(q.total_xaf, lang)}</Text></View>
      <View style={st.kv}><Text style={st.k}>{t.paidToDate}</Text><Text style={st.v}>{formatXafIn(paid, lang)}</Text></View>
      <View style={st.kv}><Text style={st.k}>{t.balance}</Text><Text style={st.vb}>{formatXafIn(balance, lang)}</Text></View>
      <PaymentsList payments={activePayments(q)} title={t.allPayments} lang={lang} />
      {p.note ? <Text style={[st.note, { marginTop: 10, fontFamily: fam(p.note) }]}>{p.note}</Text> : null}
      <Text style={[st.note, { marginTop: 10 }]}>{balance > 0 ? t.releaseWhenPaid : t.releaseNow}</Text>
    </Shell>
  );
}

// ── La facture acquittée ──
export function CargoInvoicePDF({ q, settings, lang = 'fr' }: { q: Quote; settings: ShippingSettings; lang?: CargoDocLang }) {
  const t = TXT[lang];
  return (
    <Shell type="facture" label={t.titleInvoice} reference={q.invoice_no ?? q.quote_no} lang={lang}>
      <Meta q={q} lang={lang} right={`${t.quoteRef(q.quote_no)} · ${t.invoiceOf} ${formatDateIn(q.invoiced_at ?? q.paid_at ?? q.updated_at, lang)}`} />
      <Parties q={q} settings={settings} lang={lang} />
      <LinesTable q={q} lang={lang} />
      <View style={st.stamp}>
        <Text style={st.stampText}>{t.paidStamp}</Text>
        <Text style={st.stampSub}>{t.paidOn} {formatDateIn(q.paid_at ?? q.invoiced_at ?? q.updated_at, lang)} · {formatXafIn(quotePaid(q), lang)}</Text>
      </View>
      <PaymentsList payments={activePayments(q)} title={t.paidBy} lang={lang} />
      <Text style={[st.note, { marginTop: 10 }]}>{t.invoiceNote}</Text>
      {q.notes ? <Text style={[st.note, { fontFamily: fam(q.notes) }]}>{q.notes}</Text> : null}
    </Shell>
  );
}
