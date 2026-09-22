// ============================================================
// LES DOCUMENTS CARGO — devis, reçu, facture acquittée — avec l'en-tête et
// le pied officiels (même système que les reçus de dépôt et le relevé :
// @react-pdf/renderer, DM Sans, logo). L'émetteur est la société, NORTON
// GAUSS BONZINI SARL, avec ses contacts et, sur le devis, ses comptes.
// ============================================================
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { PDFHeader, type PDFHeaderType } from '../components/PDFHeader';
import { PDFFooter } from '../components/PDFFooter';
import { baseStyles, colors } from '../styles';
import { formatDate } from '../helpers';
import '../fonts';
import type { Quote, QuoteLine, QuotePayment } from '@/lib/cargoQuote';
import { BASIS_UNIT, METHOD_LABEL, PLACE_LABEL, activePayments, quoteBalance, quotePaid, xaf } from '@/lib/cargoQuote';
import { clientFullName } from '@/lib/reception';
import type { ShippingSettings } from '@/lib/customerCode';
import { LEGAL_NAME, WEBSITE, companyBankAccounts } from '@/lib/companyIdentity';

const CJK = /[一-鿿㐀-䶿豈-﫿]/;
const fam = (s: string | null | undefined) => (s && CJK.test(s) ? 'Noto Sans SC' : 'DM Sans');
const clean = (s: string) => s.replace(/[\u00A0\u202F]/g, ' ');

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

const lineLabel = (l: QuoteLine) => (l.kind === 'parcel' ? (l.description || l.label || l.kind_of_parcel || 'Colis') : l.label);
const lineBasis = (l: QuoteLine) => (l.kind !== 'parcel' ? (l.kind === 'discount' ? 'remise' : 'frais') : l.basis === 'fixed' ? 'fixe' : `au ${BASIS_UNIT[l.basis]}`);
const lineQty = (l: QuoteLine) => (l.basis === 'fixed' || l.quantity == null ? '' : `${Number(l.quantity).toLocaleString('fr-FR', { maximumFractionDigits: 3 })} ${BASIS_UNIT[l.basis]}`);
const lineUnit = (l: QuoteLine) => (l.basis === 'fixed' || l.unit_price_xaf == null ? '' : clean(xaf(l.unit_price_xaf)));

/** L'émetteur (la société) et le client, côte à côte. */
function Parties({ q, settings }: { q: Quote; settings: ShippingSettings }) {
  const loc = settings[q.location];
  const c = settings.company;
  const name = q.client ? clientFullName(q.client) : 'Client à attribuer';
  return (
    <View style={st.parties}>
      <View style={st.party}>
        <Text style={st.partyLabel}>Émetteur</Text>
        <Text style={st.partyName}>{LEGAL_NAME}</Text>
        <Text style={st.partyLine}>{q.location === 'office' ? 'Bureau Air cargo' : 'Entrepôt Sea cargo'} · Guangzhou, Chine</Text>
        {loc.addressEn ? <Text style={st.partyLine}>{loc.addressEn}</Text> : null}
        <Text style={st.partyLine}>{[c.email, c.whatsapp ? `WhatsApp ${c.whatsapp}` : null, loc.wechat ? `WeChat ${loc.wechat}` : null].filter(Boolean).join(' · ')}</Text>
        <Text style={st.partyLine}>{WEBSITE}</Text>
      </View>
      <View style={st.party}>
        <Text style={st.partyLabel}>Client</Text>
        <Text style={[st.partyName, { fontFamily: fam(name) }]}>{name}</Text>
        {q.client?.company_name ? <Text style={st.partyLine}>{q.client.company_name}</Text> : null}
        <Text style={st.partyLine}>{[q.client?.customer_code, q.client?.phone].filter(Boolean).join(' · ')}</Text>
        {q.client?.email ? <Text style={st.partyLine}>{q.client.email}</Text> : null}
        <Text style={st.partyLine}>{[q.client?.city, q.client?.country].filter(Boolean).join(', ')}</Text>
        {q.client?.account_name ? <Text style={st.partyLine}>Compte {q.client.account_name}</Text> : null}
      </View>
    </View>
  );
}

function Meta({ q, right }: { q: Quote; right: string }) {
  const mode = q.location === 'office' ? 'Air cargo' : 'Sea cargo';
  const n = q.lines.filter((l) => l.kind === 'parcel').length;
  return (
    <View style={st.metaRow}>
      <Text style={st.metaLeft}>Dépôt {q.deposit_no} · {mode} · {n} colis</Text>
      <Text style={st.metaRight}>{right}</Text>
    </View>
  );
}

function LinesTable({ q }: { q: Quote }) {
  return (
    <View>
      <View style={st.th}>
        <Text style={[st.thc, st.cNo]}>N°</Text><Text style={[st.thc, st.cLabel]}>Désignation</Text><Text style={[st.thc, st.cBasis]}>Base</Text>
        <Text style={[st.thc, st.cQty]}>Qté</Text><Text style={[st.thc, st.cUnit]}>P.U.</Text><Text style={[st.thc, st.cAmt]}>Montant</Text>
      </View>
      {q.lines.map((l, i) => (
        <View key={l.id} style={[st.tr, ...(i % 2 ? [st.trAlt] : [])]} wrap={false}>
          <Text style={[st.td, st.cNo]}>{l.kind === 'parcel' ? String(l.parcel_seq ?? l.seq).padStart(2, '0') : ''}</Text>
          <View style={st.cLabel}>
            <Text style={[st.td, { fontFamily: fam(lineLabel(l)) }]}>{lineLabel(l)}</Text>
            {l.kind === 'parcel' && (l.weight_kg != null || l.cbm != null) ? <Text style={st.tdMuted}>{[l.parcel_no, l.weight_kg != null ? `${Number(l.weight_kg).toLocaleString('fr-FR')} kg` : null, l.cbm != null ? `${Number(l.cbm).toLocaleString('fr-FR', { maximumFractionDigits: 3 })} m³` : null].filter(Boolean).join(' · ')}</Text> : null}
          </View>
          <Text style={[st.td, st.cBasis]}>{lineBasis(l)}</Text>
          <Text style={[st.td, st.cQty]}>{lineQty(l)}</Text>
          <Text style={[st.td, st.cUnit]}>{lineUnit(l)}</Text>
          <Text style={[st.td, st.cAmt, { fontWeight: 700 }]}>{clean(xaf(l.amount_xaf))}</Text>
        </View>
      ))}
      <View style={st.totalRow}>
        <View style={st.totalBox}><Text style={st.totalLabel}>TOTAL</Text><Text style={st.totalValue}>{clean(xaf(q.total_xaf))}</Text></View>
      </View>
    </View>
  );
}

function PaymentsList({ payments, title }: { payments: QuotePayment[]; title: string }) {
  if (payments.length === 0) return null;
  return (
    <View>
      <Text style={st.sectionTitle}>{title}</Text>
      {payments.map((p) => (
        <View key={p.id} style={st.kv}>
          <Text style={st.k}>{p.receipt_no} · {formatDate(p.paid_at)} · {METHOD_LABEL[p.method]}{p.reference ? ` (${p.reference})` : ''} · {PLACE_LABEL[p.place]}</Text>
          <Text style={st.v}>{clean(xaf(p.amount_xaf))}</Text>
        </View>
      ))}
    </View>
  );
}

function BankAccounts() {
  const accounts = companyBankAccounts();
  if (accounts.length === 0) return null;
  return (
    <View>
      <Text style={st.sectionTitle}>Régler par virement · au nom de {LEGAL_NAME}</Text>
      {accounts.map((a) => (
        <View key={a.iban} style={st.bankRow}><Text style={st.bankName}>{a.bank}</Text><Text style={st.bankIban}>{a.iban}</Text><Text style={st.bankSwift}>{a.swift}</Text></View>
      ))}
      <Text style={st.note}>Mobile Money, espèces en agence ou depuis votre solde Bonzini : voir l'app, Cargo › Mes colis.</Text>
    </View>
  );
}

function Shell({ type, reference, children }: { type: PDFHeaderType; reference: string; children: React.ReactNode }) {
  return (
    <Document>
      <Page size="A4" style={baseStyles.page}>
        <PDFHeader type={type} reference={reference} />
        {children}
        <PDFFooter />
      </Page>
    </Document>
  );
}

// ── Le devis ──
export function CargoQuotePDF({ q, settings }: { q: Quote; settings: ShippingSettings }) {
  return (
    <Shell type="devis" reference={q.quote_no}>
      <Meta q={q} right={`${q.sent_at ? 'Envoyé le' : 'Établi le'} ${formatDate(q.sent_at ?? q.updated_at)} · valable 30 jours`} />
      <Parties q={q} settings={settings} />
      <LinesTable q={q} />
      <BankAccounts />
      <Text style={st.sectionTitle}>Conditions</Text>
      <Text style={st.note}>Règlement possible avant le départ de Chine ou au retrait à Douala. Les colis sont remis sur présentation du code client, une fois le devis réglé.</Text>
      {q.notes ? <Text style={[st.note, { fontFamily: fam(q.notes) }]}>{q.notes}</Text> : null}
    </Shell>
  );
}

// ── Le reçu d'un encaissement ──
export function CargoReceiptPDF({ q, p, settings }: { q: Quote; p: QuotePayment; settings: ShippingSettings }) {
  const paid = quotePaid(q); const balance = quoteBalance(q);
  return (
    <Shell type="recu-cargo" reference={p.receipt_no}>
      <Meta q={q} right={`Devis ${q.quote_no} · reçu émis le ${formatDate(p.paid_at)}`} />
      <Parties q={q} settings={settings} />
      <View style={st.amountBox}>
        <View>
          <Text style={st.amountLabel}>Montant reçu</Text>
          <Text style={st.amount}>{clean(xaf(p.amount_xaf))}</Text>
        </View>
        <Text style={st.amountSide}>{`${METHOD_LABEL[p.method]}${p.reference ? ` · réf. ${p.reference}` : ''}\n${PLACE_LABEL[p.place]}\nLe ${formatDate(p.paid_at)}${p.received_by_name ? ` · reçu par ${p.received_by_name}` : ''}`}</Text>
      </View>
      <Text style={st.sectionTitle}>Le devis {q.quote_no} après ce paiement</Text>
      <View style={st.kv}><Text style={st.k}>Total du devis</Text><Text style={st.v}>{clean(xaf(q.total_xaf))}</Text></View>
      <View style={st.kv}><Text style={st.k}>Encaissé à ce jour</Text><Text style={st.v}>{clean(xaf(paid))}</Text></View>
      <View style={st.kv}><Text style={st.k}>Reste à payer</Text><Text style={st.vb}>{clean(xaf(balance))}</Text></View>
      <PaymentsList payments={activePayments(q)} title="Tous les encaissements sur ce devis" />
      {p.note ? <Text style={[st.note, { marginTop: 10, fontFamily: fam(p.note) }]}>{p.note}</Text> : null}
      <Text style={[st.note, { marginTop: 10 }]}>{balance > 0 ? 'Les colis sont remis une fois le devis entièrement réglé.' : 'Devis entièrement réglé : les colis sont remis sur présentation du code client.'}</Text>
    </Shell>
  );
}

// ── La facture acquittée ──
export function CargoInvoicePDF({ q, settings }: { q: Quote; settings: ShippingSettings }) {
  return (
    <Shell type="facture" reference={q.invoice_no ?? q.quote_no}>
      <Meta q={q} right={`Devis ${q.quote_no} · facture du ${formatDate(q.invoiced_at ?? q.paid_at ?? q.updated_at)}`} />
      <Parties q={q} settings={settings} />
      <LinesTable q={q} />
      <View style={st.stamp}>
        <Text style={st.stampText}>ACQUITTÉE</Text>
        <Text style={st.stampSub}>le {formatDate(q.paid_at ?? q.invoiced_at ?? q.updated_at)} · {clean(xaf(quotePaid(q)))}</Text>
      </View>
      <PaymentsList payments={activePayments(q)} title="Réglée par" />
      <Text style={[st.note, { marginTop: 10 }]}>Facture acquittée : aucun montant ne reste dû sur ce dépôt. Les colis sont remis sur présentation du code client.</Text>
      {q.notes ? <Text style={[st.note, { fontFamily: fam(q.notes) }]}>{q.notes}</Text> : null}
    </Shell>
  );
}
