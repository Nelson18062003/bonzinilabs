// ============================================================
// LES DOCUMENTS CARGO — devis, reçu, facture acquittée — sur le modèle de la
// « Packing List client » que le fondateur a validée le 01/10/2026 (session
// « Date de chargement modification », PL de Dolice, conteneur MIEU3611115) :
//
//   · en-tête sur chaque page : le logo bien visible, NORTON GAUSS BONZINI
//     SARL, « Bonzini Trading Cargo · Central d'achat · Air Cargo · Sea
//     Cargo » en violet, capital / RCCM / NIU / siège / téléphones ; à
//     droite le titre, la référence, la date ; dessous, la barre tricolore
//     du logo (violet, ambre, orange) ;
//   · fond blanc, texte noir, sections encadrées « 1.  CLIENT » sur fond
//     gris souligné de violet ; aéré (« il ne faut pas squeeze ») ;
//   · une seule signification par couleur : violet = identité et structure
//     (identifiant Bonzini, lignes de total) ; ambre = dates estimées
//     (arrivée) ; orange = ce que le client doit faire (le montant à
//     régler) et ce qui manque (« À créer », « À renseigner ») ;
//   · « Vos marchandises » (la section que le fondateur a jugée parfaite) :
//     une ligne par colis avec ses mesures, la ligne de total, et juste
//     dessous le montant à régler, en chiffres ET en lettres, avec la
//     référence à rappeler sur tout paiement — pas de « décompte » à part ;
//   · « Validation » : pour la société, le lieu, la date et un CACHET
//     dessiné — pas de ligne de signature client ;
//   · au verso : conditions générales, modes de règlement, nos adresses.
//
// Chaque document sort EN UNE SEULE LANGUE (français ou anglais) : titres,
// colonnes, conditions, dates, montants (« 1 234 567 » / « 1,234,567 »),
// montant en lettres. Seul ce que l'équipe a tapé (désignations, frais,
// notes) reste tel qu'écrit.
// ============================================================
import type { ComponentProps, ReactNode } from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';
import { format } from 'date-fns';
import { enUS, fr } from 'date-fns/locale';
import { PdfLogo } from '../components/PDFHeader';
import '../fonts';
import type { PaymentMethod, PaymentPlace, Quote, QuoteLine, QuotePayment } from '@/lib/cargoQuote';
import { activePayments, quoteBalance, quotePaid } from '@/lib/cargoQuote';
import { clientFullName } from '@/lib/reception';
import type { ShippingSettings } from '@/lib/customerCode';
import { CARGO_COMPANY, companyBankAccounts } from '@/lib/companyIdentity';
import { xafInWords } from '@/lib/amountInWords';

export type CargoDocLang = 'fr' | 'en';

// ── La palette de la packing list (build5.py) ──
const C = {
  violet: '#7A33FF', violetTint: '#F1EAFF',
  amber: '#F3A745', amberTint: '#FFF3E0',
  orange: '#FE560D', orangeTint: '#FFE9DE',
  black: '#111111', grey: '#4B5563', rule: '#D1D5DB', headBg: '#F3F4F6', white: '#FFFFFF',
};
const MM = 2.8346;
const MARGIN = 15 * MM;
const PAD = 8;
const GAP = 14;

// Pas de césure : la coupure par défaut (anglaise) écrivait « Nko-lo », « mar-chandise ». Un mot passe entier à la ligne.
const keepWords = (word: string) => [word];
function T(props: ComponentProps<typeof Text>) {
  return <Text hyphenationCallback={keepWords} {...props} />;
}

const CJK = /[一-鿿㐀-䶿豈-﫿]/;
const fam = (s: string | null | undefined) => (s && CJK.test(s) ? 'Noto Sans SC' : 'DM Sans');

/**
 * Le chinois n'a pas d'espaces : sans aide, une adresse ou un nom en chinois ne
 * revient jamais à la ligne et sort de sa colonne. On coupe donc nous-mêmes,
 * en estimant la largeur (un idéogramme = 1 em, une lettre ≈ 0,55 em), sans
 * jamais couper un mot latin.
 */
const CJK_CHAR = /[一-鿿㐀-䶿豈-﫿\u3000-\u303f\uff00-\uffef]/;
function wrapCjk(text: string | null | undefined, width: number, size: number): string {
  if (!text || !CJK.test(text)) return text ?? '';
  return text.split('\n').map((para) => {
    const tokens = para.match(/[一-鿿㐀-䶿豈-﫿\u3000-\u303f\uff00-\uffef]|\s+|[^\s一-鿿㐀-䶿豈-﫿\u3000-\u303f\uff00-\uffef]+/g) ?? [];
    const lines: string[] = [];
    let line = '';
    let w = 0;
    for (const tok of tokens) {
      const space = /^\s+$/.test(tok);
      const tw = CJK_CHAR.test(tok) ? size : space ? size * 0.28 : tok.length * size * 0.56;
      if (w + tw > width && line.trim() && !space) {
        lines.push(line.trimEnd());
        line = tok;
        w = tw;
      } else if (!(space && !line)) {
        line += tok;
        w += tw;
      }
    }
    if (line.trim()) lines.push(line.trimEnd());
    return lines.join('\n');
  }).join('\n');
}

const st = StyleSheet.create({
  page: { fontFamily: 'DM Sans', fontSize: 10, color: C.black, backgroundColor: C.white, paddingTop: 48 * MM, paddingBottom: 20 * MM, paddingHorizontal: MARGIN },
  // en-tête (chaque page)
  header: { position: 'absolute', top: 10 * MM, left: MARGIN, right: MARGIN },
  headRow: { flexDirection: 'row', alignItems: 'flex-start' },
  company: { marginLeft: 5 * MM, flexGrow: 1 },
  coName: { fontSize: 16, fontWeight: 700 },
  coTrade: { fontSize: 9.5, fontWeight: 700, color: C.violet, marginTop: 3 },
  coLine: { fontSize: 8.5, marginTop: 2.5 },
  headRight: { position: 'absolute', top: 0, right: 0, width: 62 * MM, alignItems: 'flex-end' },
  docTitle: { fontSize: 13, fontWeight: 700, letterSpacing: 0.4, textAlign: 'right' },
  docMeta: { fontSize: 9, marginTop: 3, textAlign: 'right' },
  bar: { flexDirection: 'row', height: 1.6 * MM, marginTop: 2.5 * MM },
  // pied (chaque page)
  footer: { position: 'absolute', bottom: 7 * MM, left: MARGIN, right: MARGIN, borderTopWidth: 0.5, borderTopColor: C.rule, paddingTop: 2.5 * MM, flexDirection: 'row', justifyContent: 'space-between' },
  footText: { fontSize: 8 },
  footPage: { fontSize: 8.5, fontWeight: 500 },
  // titre du document
  title: { fontSize: 20, fontWeight: 700 },
  subtitle: { fontSize: 11, color: C.grey, marginTop: 2 },
  // sections encadrées
  section: { borderWidth: 0.8, borderColor: C.rule },
  secHead: { backgroundColor: C.headBg, paddingHorizontal: PAD, paddingVertical: 6, borderBottomWidth: 1.2, borderBottomColor: C.violet },
  secTitle: { fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3 },
  secBody: { padding: PAD },
  // liste clé / valeur
  kvRow: { flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 0.4, borderBottomColor: C.rule },
  kvLabel: { width: '40%', fontSize: 9, fontWeight: 500, color: C.grey, paddingRight: 4, paddingTop: 1.5 },
  kvValue: { width: '60%', fontSize: 10.5, fontWeight: 700 },
  // tableau
  th: { flexDirection: 'row', backgroundColor: C.headBg, borderBottomWidth: 0.8, borderBottomColor: C.black },
  thc: { fontSize: 8.5, fontWeight: 700, paddingVertical: 6, paddingHorizontal: 5 },
  thUnit: { fontSize: 7.5, fontWeight: 500, color: C.grey, marginTop: 1 },
  tr: { flexDirection: 'row', borderBottomWidth: 0.4, borderBottomColor: C.rule, alignItems: 'center' },
  td: { fontSize: 9.5, paddingVertical: 6, paddingHorizontal: 5 },
  tdSub: { fontSize: 8.5, color: C.grey, marginTop: 1.5 },
  total: { flexDirection: 'row', backgroundColor: C.violetTint, borderTopWidth: 0.8, borderTopColor: C.black, alignItems: 'center' },
  // bandeau montant
  band: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderLeftWidth: 3, paddingVertical: 7, paddingLeft: 9, paddingRight: 8 },
  bandLabel: { fontSize: 10.5, fontWeight: 700 },
  bandSub: { fontSize: 9, color: C.grey, marginTop: 2 },
  bandAmount: { fontSize: 18, fontWeight: 700, textAlign: 'right' },
  bandWords: { fontSize: 9, color: C.grey, textAlign: 'right', marginTop: 1.5, maxWidth: 300 },
  body: { fontSize: 10 },
  grey: { fontSize: 9.5, color: C.grey, lineHeight: 1.4 },
  note: { fontSize: 9, fontWeight: 500, marginTop: 4 },
  // validation + cachet
  valRow: { flexDirection: 'row', alignItems: 'center' },
  stampOuter: { width: 62 * MM, height: 30 * MM, borderWidth: 1.6, borderColor: C.violet, borderRadius: 3 * MM, padding: 1.4 * MM, transform: 'rotate(-3deg)' },
  stampInner: { flexGrow: 1, borderWidth: 0.6, borderColor: C.violet, borderRadius: 2 * MM, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  stampName: { fontSize: 9.6, fontWeight: 700, color: C.violet, letterSpacing: 0.2 },
  stampTrade: { fontSize: 7, fontWeight: 500, color: C.violet, marginTop: 1.5 },
  stampRule: { width: '82%', borderBottomWidth: 0.5, borderBottomColor: C.violet, marginVertical: 3 },
  stampLine: { fontSize: 6.6, color: C.violet, marginTop: 0.5 },
  stampDate: { fontSize: 8.6, fontWeight: 700, color: C.violet, marginTop: 3 },
  // verso
  condRow: { flexDirection: 'row', paddingVertical: 3.5, borderBottomWidth: 0.4, borderBottomColor: C.rule },
  condNo: { width: 7 * MM, fontSize: 9, fontWeight: 700 },
  condText: { flex: 1, fontSize: 9, lineHeight: 1.35 },
  addrCol: { flex: 1, paddingHorizontal: 9 },
  addrTitle: { fontSize: 9.5, fontWeight: 700, marginBottom: 3 },
  addrLine: { fontSize: 9, lineHeight: 1.35 },
  addrZh: { fontSize: 8.5, color: C.grey, lineHeight: 1.4, fontFamily: 'Noto Sans SC', marginTop: 2 },
});

// ── Tout ce que les documents écrivent, dans les deux langues ──
const TXT = {
  fr: {
    hTitleQuote: 'DEVIS DE FRET', hTitleReceipt: 'REÇU DE PAIEMENT', hTitleInvoice: 'FACTURE ACQUITTÉE',
    ref: 'Réf.', issued: 'Émis le',
    titleQuote: { warehouse: 'Devis de fret maritime', office: 'Devis de fret aérien' },
    titleReceipt: 'Reçu de paiement', titleInvoice: 'Facture acquittée',
    capital: 'SARL au capital de', tel: 'Tél.',
    secClient: 'Client', secShipment: 'Expédition', secGoods: 'Vos marchandises', secValidation: 'Validation',
    secPayment: 'Paiement reçu', secSituation: 'Situation du devis', secSettlements: 'Règlements',
    secConditions: 'Conditions générales de service', secHowToPay: 'Modes de règlement', secAddresses: 'Nos adresses',
    name: 'Nom', company: 'Société', bonziniId: 'Identifiant Bonzini', phone: 'Téléphone', city: 'Ville', account: 'Compte',
    toAssign: 'À attribuer', toCreate: 'À créer', toFill: 'À renseigner',
    deposit: 'Dépôt', mode: 'Mode', reception: 'Réception', supplier: 'Fournisseur', buyingAgent: "Agent d'achat",
    container: 'Conteneur', vessel: 'Navire', flight: 'Vol', eta: 'Arrivée estimée', etaPending: 'communiquée au chargement',
    modeSea: 'Sea Cargo — Groupage', modeAir: 'Air Cargo',
    atWarehouse: 'Entrepôt de Guangzhou', atOffice: 'Bureau de Guangzhou', receivedBy: 'Reçu par',
    parcelsN: (n: number) => `${n} colis`, valid30: 'valable 30 jours',
    colNo: 'N°', colLabel: 'Désignation', colDims: 'Dimensions', colWeight: 'Poids', colVolume: 'Volume', colRate: 'Tarif', colAmount: 'Montant', colAmountXaf: 'Montant (XAF)',
    perUnit: (u: string) => `par ${u}`,
    flat: 'Forfait', fee: 'Frais', discount: 'Remise', total: 'Total',
    kind: { carton: ['carton', 'cartons'], bag: ['sac', 'sacs'], bale: ['ballot', 'ballots'], roll: ['rouleau', 'rouleaux'], pallet: ['palette', 'palettes'], other: ['colis', 'colis'] } as Record<string, [string, string]>,
    kindLabel: { carton: 'Carton', bag: 'Sac', bale: 'Ballot', roll: 'Rouleau', pallet: 'Palette', other: 'Colis' } as Record<string, string>,
    parcel: 'Colis', waybill: 'suivi',
    toPay: 'Montant à régler', balanceToPay: 'Reste à régler', settled: 'Devis réglé', amountPaid: 'Montant réglé', amountReceived: 'Montant reçu',
    totalAndPaid: (total: string, paid: string) => `Total du devis ${total} · déjà réglé ${paid}`,
    payRef: (ref: string) => [`Référence à rappeler sur tout paiement : `, ref, `. Le règlement intégral conditionne la remise de la marchandise.`],
    validity: (d: string) => `Devis valable 30 jours, jusqu'au ${d}.`,
    forCompany: 'Pour Norton Gauss Bonzini SARL', placeDate: (place: string | null, d: string) => (place ? `${place}, le ${d}` : `Le ${d}`),
    quoteFootnote: (where: string) => `Devis établi par Bonzini Trading Cargo à partir des colis reçus, pesés et mesurés à notre ${where}. Il tient lieu de décompte de fret pour le retrait des marchandises à Douala.`,
    whereWarehouse: 'entrepôt de Guangzhou', whereOffice: 'bureau de Guangzhou',
    receiptFootnote: 'Reçu établi par Bonzini Trading Cargo. Conservez-le : il prouve votre paiement jusqu’au retrait de la marchandise.',
    invoiceFootnote: 'Facture acquittée : aucun montant ne reste dû sur ce dépôt. Les colis sont remis sur présentation du code client.',
    invoiceValidation: (dep: string) => `Facture établie par Bonzini Trading Cargo pour le dépôt ${dep}, réglé en totalité. Elle remplace le devis et les reçus de ce dépôt.`,
    quoteWord: 'Devis',
    stampTrade: 'Bonzini Trading Cargo · Air Cargo · Sea Cargo', stampPaid: 'ACQUITTÉE',
    method: { cash: 'Espèces', mobile_money: 'Mobile Money', bank_transfer: 'Virement bancaire', wallet: 'Solde Bonzini', other: 'Autre' } as Record<PaymentMethod, string>,
    place: { guangzhou: 'Guangzhou, avant le départ', douala: 'Douala, au retrait', other: 'Ailleurs' } as Record<PaymentPlace, string>,
    placeCity: { guangzhou: 'Guangzhou', douala: 'Douala', other: null } as Record<PaymentPlace, string | null>,
    payMode: 'Mode de paiement', payRefLabel: 'Référence', payPlace: 'Lieu', payDate: 'Date', payBy: 'Reçu par',
    colReceipt: 'Reçu', colDate: 'Date', colMethod: 'Mode', colPlace: 'Lieu', thisReceipt: 'ce reçu',
    quoteTotal: 'Total du devis', paidToDate: 'Total réglé', fullyPaid: 'Devis entièrement réglé : les colis sont remis sur présentation du code client.',
    releaseWhenPaid: 'Le règlement intégral conditionne la remise de la marchandise.',
    bankHolder: 'Titulaire', bankName: 'Banque', iban: 'IBAN', swift: 'SWIFT',
    otherWays: (ref: string) => `Également : Mobile Money, espèces à nos bureaux de Guangzhou ou de Douala, ou depuis votre solde Bonzini (app Bonzini › Cargo). Rappelez la référence ${ref} sur tout paiement.`,
    addrDouala: 'Douala — siège et retrait', addrOffice: 'Guangzhou — bureau (Air Cargo)', addrWarehouse: 'Guangzhou, Baiyun — entrepôt (Sea Cargo)',
    pickupOffice: 'Bureau de Douala', wechat: 'WeChat',
    conditions: [
      "Le client dispose de 3 jours ouvrés après l'arrivée de la marchandise à Douala pour en prendre possession. Passé ce délai, des frais de magasinage sont appliqués au moment du retrait.",
      "N.G.B SARL n'est en aucun cas responsable des marchandises contrefaites : le propriétaire en porte l'entière responsabilité.",
      "Les marchandises abandonnées dans nos entrepôts au-delà de 2 mois sont vendues aux enchères afin de couvrir les frais engagés par l'entreprise.",
      'Nous ne transportons ni matériel militaire ni produits assimilés. Toute violation de la présente clause fait l’objet d’une dénonciation aux autorités.',
      "Les colis fragiles non protégés voyagent aux risques du client : aucune responsabilité n'est assumée en cas de dommage.",
      'Les montants s’entendent pour une livraison à Douala. Pour les autres villes (Yaoundé, Buea, Bamenda, Bafoussam…), le transport intérieur se négocie au Cameroun.',
      'Les poids et volumes sont ceux mesurés à notre entrepôt de Guangzhou. Le règlement intégral conditionne la remise de la marchandise.',
    ],
    footer: (dep: string) => `Dépôt ${dep}`,
    page: (n: number, total: number) => `Page ${n} / ${total}`,
    dateFmt: 'dd/MM/yyyy', locale: fr,
  },
  en: {
    hTitleQuote: 'FREIGHT QUOTE', hTitleReceipt: 'PAYMENT RECEIPT', hTitleInvoice: 'PAID INVOICE',
    ref: 'Ref.', issued: 'Issued',
    titleQuote: { warehouse: 'Sea freight quote', office: 'Air freight quote' },
    titleReceipt: 'Payment receipt', titleInvoice: 'Paid invoice',
    capital: 'SARL with a share capital of', tel: 'Tel.',
    secClient: 'Customer', secShipment: 'Shipment', secGoods: 'Your goods', secValidation: 'Validation',
    secPayment: 'Payment received', secSituation: 'Quote status', secSettlements: 'Payments',
    secConditions: 'General terms of service', secHowToPay: 'How to pay', secAddresses: 'Our addresses',
    name: 'Name', company: 'Company', bonziniId: 'Bonzini ID', phone: 'Phone', city: 'City', account: 'Account',
    toAssign: 'To be assigned', toCreate: 'To be created', toFill: 'To be provided',
    deposit: 'Deposit', mode: 'Mode', reception: 'Received', supplier: 'Supplier', buyingAgent: 'Buying agent',
    container: 'Container', vessel: 'Vessel', flight: 'Flight', eta: 'Estimated arrival', etaPending: 'given at loading',
    modeSea: 'Sea Cargo — Consolidated (LCL)', modeAir: 'Air Cargo',
    atWarehouse: 'Guangzhou warehouse', atOffice: 'Guangzhou office', receivedBy: 'Received by',
    parcelsN: (n: number) => `${n} parcel${n > 1 ? 's' : ''}`, valid30: 'valid for 30 days',
    colNo: 'No.', colLabel: 'Description', colDims: 'Dimensions', colWeight: 'Weight', colVolume: 'Volume', colRate: 'Rate', colAmount: 'Amount', colAmountXaf: 'Amount (XAF)',
    perUnit: (u: string) => `per ${u}`,
    flat: 'Flat', fee: 'Fee', discount: 'Discount', total: 'Total',
    kind: { carton: ['carton', 'cartons'], bag: ['bag', 'bags'], bale: ['bale', 'bales'], roll: ['roll', 'rolls'], pallet: ['pallet', 'pallets'], other: ['parcel', 'parcels'] } as Record<string, [string, string]>,
    kindLabel: { carton: 'Carton', bag: 'Bag', bale: 'Bale', roll: 'Roll', pallet: 'Pallet', other: 'Parcel' } as Record<string, string>,
    parcel: 'Parcel', waybill: 'tracking',
    toPay: 'Amount due', balanceToPay: 'Balance due', settled: 'Quote paid', amountPaid: 'Amount paid', amountReceived: 'Amount received',
    totalAndPaid: (total: string, paid: string) => `Quote total ${total} · already paid ${paid}`,
    payRef: (ref: string) => ['Quote this reference on every payment: ', ref, '. Goods are released once paid in full.'],
    validity: (d: string) => `Quote valid for 30 days, until ${d}.`,
    forCompany: 'For Norton Gauss Bonzini SARL', placeDate: (place: string | null, d: string) => (place ? `${place}, ${d}` : d),
    quoteFootnote: (where: string) => `Quote issued by Bonzini Trading Cargo from the parcels received, weighed and measured at our ${where}. It serves as the freight statement for collecting the goods in Douala.`,
    whereWarehouse: 'Guangzhou warehouse', whereOffice: 'Guangzhou office',
    receiptFootnote: 'Receipt issued by Bonzini Trading Cargo. Keep it: it proves your payment until the goods are collected.',
    invoiceFootnote: 'Paid invoice: nothing remains due on this deposit. Parcels are released on presentation of the customer code.',
    invoiceValidation: (dep: string) => `Invoice issued by Bonzini Trading Cargo for deposit ${dep}, paid in full. It replaces the quote and the receipts of this deposit.`,
    quoteWord: 'Quote',
    stampTrade: 'Bonzini Trading Cargo · Air Cargo · Sea Cargo', stampPaid: 'PAID',
    method: { cash: 'Cash', mobile_money: 'Mobile Money', bank_transfer: 'Bank transfer', wallet: 'Bonzini balance', other: 'Other' } as Record<PaymentMethod, string>,
    place: { guangzhou: 'Guangzhou, before departure', douala: 'Douala, on collection', other: 'Elsewhere' } as Record<PaymentPlace, string>,
    placeCity: { guangzhou: 'Guangzhou', douala: 'Douala', other: null } as Record<PaymentPlace, string | null>,
    payMode: 'Payment method', payRefLabel: 'Reference', payPlace: 'Place', payDate: 'Date', payBy: 'Received by',
    colReceipt: 'Receipt', colDate: 'Date', colMethod: 'Method', colPlace: 'Place', thisReceipt: 'this receipt',
    quoteTotal: 'Quote total', paidToDate: 'Total paid', fullyPaid: 'Quote paid in full: parcels are released on presentation of the customer code.',
    releaseWhenPaid: 'Goods are released once the quote is paid in full.',
    bankHolder: 'Account holder', bankName: 'Bank', iban: 'IBAN', swift: 'SWIFT',
    otherWays: (ref: string) => `Also: Mobile Money, cash at our Guangzhou or Douala offices, or from your Bonzini balance (Bonzini app › Cargo). Quote reference ${ref} on every payment.`,
    addrDouala: 'Douala — head office and collection', addrOffice: 'Guangzhou — office (Air Cargo)', addrWarehouse: 'Guangzhou, Baiyun — warehouse (Sea Cargo)',
    pickupOffice: 'Douala office', wechat: 'WeChat',
    conditions: [
      'The customer has 3 working days after the goods arrive in Douala to collect them. After that, storage fees are charged on collection.',
      'N.G.B SARL is in no way liable for counterfeit goods: their owner bears full responsibility.',
      'Goods left in our warehouses for more than 2 months are auctioned to cover the costs incurred by the company.',
      'We do not carry military equipment or similar goods. Any breach of this clause is reported to the authorities.',
      'Unprotected fragile parcels travel at the customer’s risk: no liability is accepted for damage.',
      'Amounts are for delivery in Douala. For other cities (Yaoundé, Buea, Bamenda, Bafoussam…), inland transport is negotiated in Cameroon.',
      'Weights and volumes are those measured at our Guangzhou warehouse. Goods are released once paid in full.',
    ],
    footer: (dep: string) => `Deposit ${dep}`,
    page: (n: number, total: number) => `Page ${n} / ${total}`,
    dateFmt: 'd MMM yyyy', locale: enUS,
  },
};
type Txt = (typeof TXT)['fr'];

// ── Nombres : nos propres séparateurs (les polices embarquées n'ont pas toujours l'espace fine de toLocaleString) ──
const NBSP = ' ';
function num(v: number | null | undefined, lang: CargoDocLang, maxDec = 0, minDec = 0): string {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  let s = Math.abs(n).toFixed(maxDec);
  if (maxDec > minDec) s = s.replace(new RegExp(`(\\.\\d{${minDec}}\\d*?)0+$`), '$1').replace(/\.$/, '');
  const [int, frac] = s.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'en' ? ',' : NBSP);
  return `${n < 0 ? '-' : ''}${grouped}${frac ? (lang === 'en' ? '.' : ',') + frac : ''}`;
}
const money = (v: number | null | undefined, lang: CargoDocLang) => num(Math.round(Number(v ?? 0)), lang);
const xaf = (v: number | null | undefined, lang: CargoDocLang) => `${money(v, lang)} XAF`;
const kg = (v: number | null | undefined, lang: CargoDocLang) => num(v, lang, 1);
const m3 = (v: number | null | undefined, lang: CargoDocLang) => (v == null ? '—' : num(v, lang, Number(v) < 0.1 ? 3 : 2, 2));
const day = (d: string | Date | null | undefined, t: Txt) => (d ? format(typeof d === 'string' ? new Date(d) : d, t.dateFmt, { locale: t.locale }) : '');
const longDate = (d: string, lang: CargoDocLang) =>
  lang === 'en' ? format(new Date(d), "MMMM d, yyyy 'at' HH:mm", { locale: enUS }) : format(new Date(d), "d MMMM yyyy 'à' HH:mm", { locale: fr });

const dims = (l: QuoteLine, lang: CargoDocLang) =>
  l.length_cm && l.width_cm && l.height_cm ? [l.length_cm, l.width_cm, l.height_cm].map((x) => num(x, lang, 1)).join(' × ') : '—';

/** Un colis sans description prend son TYPE, traduit — jamais la valeur brute de la base (« bag »). */
const lineLabel = (l: QuoteLine, t: Txt) =>
  l.kind === 'parcel' ? (l.description || l.label || (l.kind_of_parcel ? t.kindLabel[l.kind_of_parcel] ?? t.parcel : t.parcel)) : l.label;

/** « 10 cartons » si tous les colis sont du même type, sinon « 10 colis ». */
function countLabel(parcels: QuoteLine[], t: Txt): string {
  const n = parcels.length;
  const kinds = new Set(parcels.map((p) => p.kind_of_parcel ?? 'other'));
  const [one, many] = t.kind[kinds.size === 1 ? [...kinds][0] : 'other'] ?? t.kind.other;
  return `${n} ${n > 1 ? many : one}`;
}

const COUNTRY_EN: Record<string, string> = {
  cameroun: 'Cameroon', tchad: 'Chad', gabon: 'Gabon', congo: 'Congo', 'république du congo': 'Republic of the Congo',
  'république démocratique du congo': 'DR Congo', rdc: 'DR Congo', 'guinée équatoriale': 'Equatorial Guinea', guinée: 'Guinea',
  centrafrique: 'Central African Republic', 'république centrafricaine': 'Central African Republic', "côte d'ivoire": "Côte d'Ivoire",
  sénégal: 'Senegal', bénin: 'Benin', togo: 'Togo', niger: 'Niger', mali: 'Mali', 'burkina faso': 'Burkina Faso', nigéria: 'Nigeria',
  nigeria: 'Nigeria', ghana: 'Ghana', chine: 'China', france: 'France', belgique: 'Belgium', maroc: 'Morocco',
};
const countryIn = (c: string | null | undefined, lang: CargoDocLang) => (c && lang === 'en' ? COUNTRY_EN[c.trim().toLowerCase()] ?? c : c);

// ============================================================
// Le cadre de chaque page : en-tête, barre tricolore, pied
// ============================================================
function Header({ title, reference, issuedOn, lang }: { title: string; reference: string; issuedOn: string; lang: CargoDocLang }) {
  const t = TXT[lang];
  const co = CARGO_COMPANY;
  return (
    <View style={st.header} fixed>
      <View style={st.headRow}>
        <PdfLogo size={24 * MM} tight />
        <View style={st.company}>
          <T style={st.coName}>{co.legalName}</T>
          <T style={st.coTrade}>{co.tradeName}{'   ·   '}{co.activities[lang]}</T>
          <T style={[st.coLine, { marginTop: 4 }]}>{t.capital} {co.capital}{'   ·   '}RCCM {co.rccm}</T>
          <T style={st.coLine}>NIU {co.niu}{'   ·   '}{co.seat[lang]}</T>
          <T style={st.coLine}>{t.tel} {co.phonesCameroon.join(' · ')}{'   ·   '}{co.email}</T>
        </View>
        <View style={st.headRight}>
          <T style={st.docTitle}>{title}</T>
          <T style={[st.docMeta, { marginTop: 5 }]}>{t.ref} {reference}</T>
          <T style={st.docMeta}>{t.issued} {issuedOn}</T>
        </View>
      </View>
      <View style={st.bar}>
        <View style={{ flex: 1, backgroundColor: C.violet }} />
        <View style={{ flex: 1, backgroundColor: C.amber }} />
        <View style={{ flex: 1, backgroundColor: C.orange }} />
      </View>
    </View>
  );
}

function Footer({ q, lang }: { q: Quote; lang: CargoDocLang }) {
  const t = TXT[lang];
  return (
    <View style={st.footer} fixed>
      <T style={st.footText}>{CARGO_COMPANY.tradeName}  —  {CARGO_COMPANY.legalName}  ·  {CARGO_COMPANY.email}  ·  {t.footer(q.deposit_no)}</T>
      <T style={st.footPage} render={({ pageNumber, totalPages }) => t.page(pageNumber, totalPages)} />
    </View>
  );
}

function Shell({ q, lang, headTitle, reference, issuedOn, children }: { q: Quote; lang: CargoDocLang; headTitle: string; reference: string; issuedOn: string; children: ReactNode }) {
  return (
    <Document language={lang} title={`${headTitle} ${reference}`} author={CARGO_COMPANY.legalName} subject={TXT[lang].footer(q.deposit_no)}>
      <Page size="A4" style={st.page}>
        <Header title={headTitle} reference={reference} issuedOn={issuedOn} lang={lang} />
        {children}
        <Footer q={q} lang={lang} />
      </Page>
    </Document>
  );
}

// ============================================================
// Les briques
// ============================================================
function DocHead({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={{ marginBottom: GAP }}>
      <T style={st.title}>{title}</T>
      <T style={st.subtitle}>{subtitle}</T>
    </View>
  );
}

function Section({ n, title, children, flush = false, style, wrap }: { n: number; title: string; children: ReactNode; flush?: boolean; style?: Style; wrap?: boolean }) {
  return (
    // `wrap` seulement s'il est donné : react-pdf lit `'wrap' in props`, et wrap={undefined} rendait la section insécable
    // (le tableau partait en entier à la page suivante, puis se tassait au-delà d'une page).
    <View style={[st.section, ...(style ? [style] : [])]} {...(wrap === undefined ? {} : { wrap })}>
      <View style={st.secHead} wrap={false} minPresenceAhead={70}><T style={st.secTitle}>{n}.  {title.toUpperCase()}</T></View>
      <View style={flush ? undefined : st.secBody}>{children}</View>
    </View>
  );
}

type Kv = [label: string, value: string, tone?: 'violet' | 'orange' | 'amber' | 'normal'];
function KvList({ rows }: { rows: Kv[] }) {
  return (
    <View>
      {rows.map(([label, value, tone], i) => (
        <View key={label} style={[st.kvRow, ...(i === rows.length - 1 ? [{ borderBottomWidth: 0 }] : [])]} wrap={false}>
          <T style={st.kvLabel}>{label}</T>
          <T style={[st.kvValue, { fontFamily: fam(value) }, tone === 'violet' ? { color: C.violet } : tone === 'orange' ? { color: C.orange } : tone === 'amber' ? { color: '#B26A00' } : tone === 'normal' ? { fontWeight: 400 } : {}]}>{wrapCjk(value, 134, 10.5)}</T>
        </View>
      ))}
    </View>
  );
}

function ClientBlock({ q, lang }: { q: Quote; lang: CargoDocLang }) {
  const t = TXT[lang];
  const c = q.client;
  if (!c) {
    return <KvList rows={[[t.name, t.toAssign, 'orange'], [t.company, '—'], [t.bonziniId, t.toCreate, 'orange'], [t.phone, t.toFill, 'orange']]} />;
  }
  const rows: Kv[] = [
    [t.name, clientFullName(c) || '—'],
    [t.company, c.company_name || '—'],
    [t.bonziniId, c.customer_code || t.toCreate, c.customer_code ? 'violet' : 'orange'],
    [t.phone, c.phone || t.toFill, c.phone ? undefined : 'orange'],
  ];
  const city = [c.city, countryIn(c.country, lang)].filter(Boolean).join(', ');
  if (city) rows.push([t.city, city]);
  if (c.account_name) rows.push([t.account, c.account_name]);
  return <KvList rows={rows} />;
}

function ShipmentBlock({ q, lang }: { q: Quote; lang: CargoDocLang }) {
  const t = TXT[lang];
  const sea = q.location !== 'office';
  const parcels = q.lines.filter((l) => l.kind === 'parcel');
  const received = [sea ? t.atWarehouse : t.atOffice, day(q.opened_at, t)].filter(Boolean).join(' · ');
  const rows: Kv[] = [
    [t.deposit, `${q.deposit_no} · ${t.parcelsN(parcels.length)}`],
    [t.mode, sea ? t.modeSea : t.modeAir],
    [t.reception, received, 'normal'],
  ];
  if (q.received_by_name) rows.push([t.receivedBy, q.received_by_name, 'normal']);
  if (q.supplier_name) rows.push([q.supplier_kind === 'buying_agent' ? t.buyingAgent : t.supplier, q.supplier_name, 'normal']);
  const containers = q.containers ?? [];
  const flights = q.flights ?? [];
  if (containers.length) {
    rows.push([t.container, containers.map((c) => [c.container_number, c.bl_number ? `B/L ${c.bl_number}` : null].filter(Boolean).join(' · ')).join('\n')]);
    const vessel = containers.map((c) => [c.vessel_name, c.voyage].filter(Boolean).join(' · ')).filter(Boolean);
    if (vessel.length) rows.push([t.vessel, vessel.join('\n'), 'normal']);
  }
  if (flights.length) {
    rows.push([t.flight, flights.map((f) => [`LTA ${f.awb_number}`, [f.airline, f.flight_no].filter(Boolean).join(' ')].filter(Boolean).join(' · ')).join('\n')]);
  }
  const etas = [...containers.map((c) => c.eta), ...flights.map((f) => f.eta)].filter((d): d is string => !!d);
  if (containers.length || flights.length) rows.push([t.eta, etas.length ? etas.map((d) => day(d, t)).join(' · ') : t.etaPending, etas.length ? 'amber' : 'normal']);
  return <KvList rows={rows} />;
}

function PartiesRow({ q, lang }: { q: Quote; lang: CargoDocLang }) {
  const t = TXT[lang];
  return (
    <View style={{ flexDirection: 'row', marginBottom: GAP }} wrap={false}>
      <Section n={1} title={t.secClient} style={{ flex: 1, marginRight: 6 * MM }}><ClientBlock q={q} lang={lang} /></Section>
      <Section n={2} title={t.secShipment} style={{ flex: 1 }}><ShipmentBlock q={q} lang={lang} /></Section>
    </View>
  );
}

// Colonnes du tableau des marchandises (largeur de la section : 180 mm)
const COL = { no: 26, dims: 72, weight: 46, vol: 50, rate: 60, amount: 66 };

function rateUnit(q: Quote): 'kg' | 'm³' | null {
  const bases = new Set(q.lines.filter((l) => l.kind === 'parcel' && l.basis !== 'fixed').map((l) => l.basis));
  if (bases.size !== 1) return null;
  return [...bases][0] === 'per_kg' ? 'kg' : 'm³';
}

function GoodsTable({ q, lang }: { q: Quote; lang: CargoDocLang }) {
  const t = TXT[lang];
  const unit = rateUnit(q);
  const parcels = q.lines.filter((l) => l.kind === 'parcel');
  const others = q.lines.filter((l) => l.kind !== 'parcel');
  const sum = (f: (l: QuoteLine) => number | null | undefined) => parcels.reduce((s, l) => s + Number(f(l) ?? 0), 0);
  const hasWeight = parcels.some((l) => l.weight_kg != null);
  const hasVol = parcels.some((l) => l.cbm != null);
  const rates = new Set(parcels.filter((l) => l.basis !== 'fixed').map((l) => `${l.basis}:${l.unit_price_xaf}`));
  const allFlat = parcels.length > 0 && parcels.every((l) => l.basis === 'fixed');
  const commonRate = rates.size === 1 && parcels.every((l) => l.basis !== 'fixed') ? money(parcels[0].unit_price_xaf, lang) : allFlat ? t.flat : '';
  const right = { textAlign: 'right' as const };
  const th = (label: string, u?: string, width?: number, align: 'left' | 'center' | 'right' = 'left') => (
    <View key={label} style={[st.thc, width ? { width } : { flex: 1 }]}>
      <T style={{ textAlign: align }}>{label}</T>
      <T style={[st.thUnit, { textAlign: align }]}>{u ?? ' '}</T>
    </View>
  );
  // Le tarif : le nombre ; l'unité dans l'en-tête si tous les colis ont la même base, sinon sous le nombre.
  const rateCell = (l: QuoteLine) => (
    <View style={[st.td, { width: COL.rate }]}>
      <T style={right}>{l.basis === 'fixed' || l.unit_price_xaf == null ? t.flat : money(l.unit_price_xaf, lang)}</T>
      {!unit && l.basis !== 'fixed' && l.unit_price_xaf != null ? <T style={[st.tdSub, right]}>{t.perUnit(l.basis === 'per_kg' ? 'kg' : 'm³')}</T> : null}
    </View>
  );
  return (
    <View>
      {/* `fixed` : l'en-tête des colonnes se répète sur chaque page que le tableau occupe. */}
      <View style={st.th} wrap={false} fixed>
        {th(t.colNo, undefined, COL.no)}
        {th(t.colLabel)}
        {th(t.colDims, 'cm', COL.dims, 'center')}
        {th(t.colWeight, 'kg', COL.weight, 'right')}
        {th(t.colVolume, 'm³', COL.vol, 'right')}
        {th(t.colRate, unit ? `XAF / ${unit}` : 'XAF', COL.rate, 'right')}
        {th(t.colAmount, 'XAF', COL.amount, 'right')}
      </View>
      {parcels.map((l) => {
        const label = lineLabel(l, t);
        const sub = [l.parcel_no, l.description && l.kind_of_parcel ? t.kindLabel[l.kind_of_parcel] : null, l.courier_waybill ? `${t.waybill} ${l.courier_waybill}` : null].filter(Boolean).join(' · ');
        return (
          <View key={l.id} style={st.tr} wrap={false}>
            <T style={[st.td, { width: COL.no }]}>{String(l.parcel_seq ?? l.seq).padStart(2, '0')}</T>
            <View style={[st.td, { flex: 1 }]}>
              <T style={{ fontFamily: fam(label) }}>{wrapCjk(label, 176, 9.5)}</T>
              {sub ? <T style={[st.tdSub, { fontFamily: fam(sub) }]}>{sub}</T> : null}
            </View>
            <T style={[st.td, { width: COL.dims, textAlign: 'center' }]}>{dims(l, lang)}</T>
            <T style={[st.td, { width: COL.weight }, right]}>{kg(l.weight_kg, lang)}</T>
            <T style={[st.td, { width: COL.vol }, right]}>{m3(l.cbm, lang)}</T>
            {rateCell(l)}
            <T style={[st.td, { width: COL.amount, fontWeight: 700 }, right]}>{money(l.amount_xaf, lang)}</T>
          </View>
        );
      })}
      {others.map((l) => (
        <View key={l.id} style={st.tr} wrap={false}>
          <T style={[st.td, { width: COL.no }]} />
          <View style={[st.td, { flex: 1 }]}>
            <T style={{ fontFamily: fam(l.label) }}>{wrapCjk(l.label, 176, 9.5)}</T>
            <T style={st.tdSub}>{l.kind === 'discount' ? t.discount : t.fee}</T>
          </View>
          <T style={[st.td, { width: COL.dims + COL.weight + COL.vol + COL.rate }]} />
          <T style={[st.td, { width: COL.amount, fontWeight: 700 }, right]}>{money(l.kind === 'discount' ? -Math.abs(Number(l.amount_xaf)) : l.amount_xaf, lang)}</T>
        </View>
      ))}
      <View style={st.total} wrap={false}>
        <T style={[st.td, { width: COL.no, fontWeight: 700 }]} />
        <T style={[st.td, { flex: 1, fontWeight: 700 }]}>{t.total}  ·  {countLabel(parcels, t)}</T>
        <T style={[st.td, { width: COL.dims }]} />
        <T style={[st.td, { width: COL.weight, fontWeight: 700 }, right]}>{hasWeight ? kg(sum((l) => l.weight_kg), lang) : '—'}</T>
        <T style={[st.td, { width: COL.vol, fontWeight: 700 }, right]}>{hasVol ? m3(sum((l) => l.cbm), lang) : '—'}</T>
        <T style={[st.td, { width: COL.rate, fontWeight: 700 }, right]}>{commonRate}</T>
        <T style={[st.td, { width: COL.amount, fontWeight: 700 }, right]}>{money(q.total_xaf, lang)}</T>
      </View>
    </View>
  );
}

/** Le bandeau du montant : orange quand le client doit payer, violet quand c'est réglé ou reçu. */
function AmountBand({ label, sub, amount, tone, lang }: { label: string; sub?: string | null; amount: number; tone: 'due' | 'paid'; lang: CargoDocLang }) {
  const due = tone === 'due';
  return (
    <View style={[st.band, { backgroundColor: due ? C.orangeTint : C.violetTint, borderLeftColor: due ? C.orange : C.violet }]} wrap={false}>
      <View style={{ flexShrink: 1, paddingRight: 10 }}>
        <T style={st.bandLabel}>{label}</T>
        {sub ? <T style={st.bandSub}>{sub}</T> : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <T style={st.bandAmount}>{xaf(amount, lang)}</T>
        <T style={st.bandWords}>{xafInWords(amount, lang)}</T>
      </View>
    </View>
  );
}

function Stamp({ dateLine, paid, lang }: { dateLine: string; paid?: boolean; lang: CargoDocLang }) {
  const t = TXT[lang];
  const co = CARGO_COMPANY;
  return (
    <View style={st.stampOuter}>
      <View style={st.stampInner}>
        <T style={st.stampName}>{co.legalName}</T>
        <T style={st.stampTrade}>{t.stampTrade}</T>
        <View style={st.stampRule} />
        <T style={st.stampLine}>RCCM {co.rccm}  ·  NIU {co.niu}</T>
        <T style={st.stampLine}>{co.seat[lang]}  ·  {co.phonesCameroon[0]}</T>
        <T style={st.stampDate}>{paid ? `${t.stampPaid} · ` : ''}{dateLine}</T>
      </View>
    </View>
  );
}

function Validation({ n, place, date, note, paid, lang }: { n: number; place: string | null; date: string; note: string; paid?: boolean; lang: CargoDocLang }) {
  const t = TXT[lang];
  const dateLine = t.placeDate(place, date);
  return (
    <Section n={n} title={t.secValidation} wrap={false} style={{ marginTop: GAP }}>
      <View style={st.valRow}>
        <View style={{ flex: 1, paddingRight: 14 }}>
          <T style={{ fontSize: 10, fontWeight: 700 }}>{t.forCompany}</T>
          <T style={[st.body, { marginTop: 4 }]}>{dateLine}</T>
          <T style={[st.grey, { marginTop: 5 }]}>{note}</T>
        </View>
        <View style={{ paddingRight: 6, paddingVertical: 4 }}><Stamp dateLine={dateLine} paid={paid} lang={lang} /></View>
      </View>
    </Section>
  );
}

function PaymentsTable({ payments, highlight, lang }: { payments: QuotePayment[]; highlight?: string; lang: CargoDocLang }) {
  const t = TXT[lang];
  const right = { textAlign: 'right' as const };
  return (
    <View>
      <View style={st.th} wrap={false}>
        <T style={[st.thc, { width: 74 }]}>{t.colReceipt}</T>
        <T style={[st.thc, { width: 66 }]}>{t.colDate}</T>
        <T style={[st.thc, { flex: 1 }]}>{t.colMethod}</T>
        <T style={[st.thc, { width: 130 }]}>{t.colPlace}</T>
        <T style={[st.thc, { width: 76 }, right]}>{t.colAmountXaf}</T>
      </View>
      {payments.map((p) => {
        const mine = p.id === highlight;
        const b = mine ? { fontWeight: 700 } : {};
        return (
          <View key={p.id} style={[st.tr, ...(mine ? [{ backgroundColor: C.violetTint }] : [])]} wrap={false}>
            <T style={[st.td, { width: 74 }, b]}>{p.receipt_no}</T>
            <T style={[st.td, { width: 66 }]}>{day(p.paid_at, t)}</T>
            <View style={[st.td, { flex: 1 }]}>
              <T style={b}>{t.method[p.method]}{mine ? ` · ${t.thisReceipt}` : ''}</T>
              {p.reference ? <T style={st.tdSub}>{p.reference}</T> : null}
            </View>
            <T style={[st.td, { width: 130 }]}>{t.place[p.place]}</T>
            <T style={[st.td, { width: 76, fontWeight: 700 }, right]}>{money(p.amount_xaf, lang)}</T>
          </View>
        );
      })}
    </View>
  );
}

function Conditions({ n, lang }: { n: number; lang: CargoDocLang }) {
  const t = TXT[lang];
  return (
    <Section n={n} title={t.secConditions} style={{ marginBottom: 10 }}>
      {t.conditions.map((c, i) => (
        <View key={i} style={[st.condRow, ...(i === t.conditions.length - 1 ? [{ borderBottomWidth: 0 }] : [])]} wrap={false}>
          <T style={st.condNo}>{i + 1}.</T>
          <T style={st.condText}>{c}</T>
        </View>
      ))}
    </Section>
  );
}

function HowToPay({ n, payRef, lang }: { n: number; payRef: string; lang: CargoDocLang }) {
  const t = TXT[lang];
  const accounts = companyBankAccounts();
  return (
    <Section n={n} title={t.secHowToPay} style={{ marginBottom: 10 }} wrap={false}>
      {accounts.length ? (
        <View style={{ marginBottom: 6, marginHorizontal: -PAD, marginTop: -PAD }}>
          <View style={st.th}>
            <T style={[st.thc, { width: 160, paddingLeft: PAD }]}>{t.bankName}</T>
            <T style={[st.thc, { flex: 1 }]}>{t.iban}</T>
            <T style={[st.thc, { width: 82, paddingRight: PAD }]}>{t.swift}</T>
          </View>
          {accounts.map((a) => (
            <View key={a.iban} style={st.tr} wrap={false}>
              <T style={[st.td, { width: 160, paddingLeft: PAD, paddingVertical: 4.5, fontSize: 9, fontWeight: 700 }]}>{a.bank}</T>
              <T style={[st.td, { flex: 1, paddingVertical: 4.5, fontSize: 9 }]}>{a.iban}</T>
              <T style={[st.td, { width: 82, paddingRight: PAD, paddingVertical: 4.5, fontSize: 9 }]}>{a.swift}</T>
            </View>
          ))}
        </View>
      ) : null}
      <T style={st.grey}>{accounts.length ? `${t.bankHolder} : ${CARGO_COMPANY.legalName}. ` : ''}{t.otherWays(payRef)}</T>
    </Section>
  );
}

function Addresses({ n, settings, lang }: { n: number; settings: ShippingSettings; lang: CargoDocLang }) {
  const t = TXT[lang];
  const co = CARGO_COMPANY;
  const { office, warehouse } = settings;
  const contact = (l: typeof office) => [l.recipient, l.phone, l.wechat ? `${t.wechat} ${l.wechat}` : null].filter(Boolean).join(' · ');
  return (
    <Section n={n} title={t.secAddresses} wrap={false}>
      <View style={{ flexDirection: 'row', marginHorizontal: -9 }}>
        <View style={[st.addrCol, { flex: 0.8 }]}>
          <T style={st.addrTitle}>{t.addrDouala}</T>
          <T style={st.addrLine}>{co.seat[lang]}</T>
          <T style={[st.addrLine, { color: C.grey }]}>{t.pickupOffice}</T>
          <T style={[st.addrLine, { marginTop: 4 }]}>{co.phonesCameroon.join('\n')}</T>
          <T style={st.addrLine}>{co.email}</T>
        </View>
        <View style={[st.addrCol, { borderLeftWidth: 0.5, borderLeftColor: C.rule }]}>
          <T style={st.addrTitle}>{t.addrOffice}</T>
          {office.addressEn ? <T style={st.addrLine}>{office.addressEn}</T> : null}
          {office.addressZh ? <T style={st.addrZh}>{wrapCjk(office.addressZh, 148, 8.5)}</T> : null}
          <T style={[st.addrLine, { marginTop: 4 }]}>{contact(office)}</T>
        </View>
        <View style={[st.addrCol, { flex: 1.3, borderLeftWidth: 0.5, borderLeftColor: C.rule }]}>
          <T style={st.addrTitle}>{t.addrWarehouse}</T>
          {warehouse.addressEn ? <T style={st.addrLine}>{warehouse.addressEn}</T> : null}
          {warehouse.addressZh ? <T style={st.addrZh}>{wrapCjk(warehouse.addressZh, 196, 8.5)}</T> : null}
          <T style={[st.addrLine, { marginTop: 4 }]}>{contact(warehouse)}</T>
        </View>
      </View>
    </Section>
  );
}

const payRefOf = (q: Quote) => q.client?.customer_code || q.quote_no;
const docSubtitle = (q: Quote, lang: CargoDocLang, lead: string) => {
  const t = TXT[lang];
  const parcels = q.lines.filter((l) => l.kind === 'parcel');
  const w = parcels.reduce((s, l) => s + Number(l.weight_kg ?? 0), 0);
  const v = parcels.reduce((s, l) => s + Number(l.cbm ?? 0), 0);
  return [lead, `${t.deposit} ${q.deposit_no}`, t.parcelsN(parcels.length), w ? `${kg(w, lang)} kg` : null, v ? `${m3(v, lang)} m³` : null].filter(Boolean).join('  ·  ');
};

// ============================================================
// Le devis
// ============================================================
export function CargoQuotePDF({ q, settings, lang = 'fr' }: { q: Quote; settings: ShippingSettings; lang?: CargoDocLang }) {
  const t = TXT[lang];
  const sea = q.location !== 'office';
  const issued = q.sent_at ?? q.updated_at;
  const validUntil = new Date(new Date(issued).getTime() + 30 * 86_400_000);
  const paid = quotePaid(q);
  const balance = quoteBalance(q);
  const ref = payRefOf(q);
  const [refBefore, refValue, refAfter] = t.payRef(ref);
  return (
    <Shell q={q} lang={lang} headTitle={t.hTitleQuote} reference={q.quote_no} issuedOn={day(issued, t)}>
      <DocHead title={t.titleQuote[sea ? 'warehouse' : 'office']} subtitle={docSubtitle(q, lang, t.valid30)} />
      <PartiesRow q={q} lang={lang} />
      <Section n={3} title={t.secGoods} flush>
        <GoodsTable q={q} lang={lang} />
        <View style={{ padding: PAD }}>
          {paid > 0 && balance === 0
            ? <AmountBand label={t.settled} amount={q.total_xaf} tone="paid" lang={lang} />
            : <AmountBand label={paid > 0 ? t.balanceToPay : t.toPay} sub={paid > 0 ? t.totalAndPaid(xaf(q.total_xaf, lang), xaf(paid, lang)) : null} amount={balance} tone="due" lang={lang} />}
          <T style={[st.body, { marginTop: 7 }]}>{refBefore}<T style={{ fontWeight: 700 }}>{refValue}</T>{refAfter}</T>
          <T style={[st.grey, { marginTop: 3 }]}>{t.validity(day(validUntil, t))}</T>
          {q.notes ? <T style={[st.note, { fontFamily: fam(q.notes) }]}>{wrapCjk(q.notes, 470, 9)}</T> : null}
        </View>
      </Section>
      <Validation n={4} place="Guangzhou" date={day(issued, t)} note={t.quoteFootnote(sea ? t.whereWarehouse : t.whereOffice)} lang={lang} />
      <View break>
        <Conditions n={5} lang={lang} />
        {balance > 0 ? <HowToPay n={6} payRef={ref} lang={lang} /> : null}
        <Addresses n={balance > 0 ? 7 : 6} settings={settings} lang={lang} />
      </View>
    </Shell>
  );
}

// ============================================================
// Le reçu d'un encaissement
// ============================================================
// `settings` reste dans la signature (les appelants le passent) ; le reçu n'imprime pas les adresses.
export function CargoReceiptPDF({ q, p, lang = 'fr' }: { q: Quote; p: QuotePayment; settings: ShippingSettings; lang?: CargoDocLang }) {
  const t = TXT[lang];
  const paid = quotePaid(q);
  const balance = quoteBalance(q);
  const payments = activePayments(q);
  const rows: Kv[] = [
    [t.payMode, t.method[p.method]],
    ...(p.reference ? [[t.payRefLabel, p.reference] as Kv] : []),
    [t.payPlace, t.place[p.place], 'normal'],
    [t.payDate, longDate(p.paid_at, lang), 'normal'],
    ...(p.received_by_name ? [[t.payBy, p.received_by_name, 'normal'] as Kv] : []),
  ];
  return (
    <Shell q={q} lang={lang} headTitle={t.hTitleReceipt} reference={p.receipt_no} issuedOn={day(p.paid_at, t)}>
      <DocHead title={t.titleReceipt} subtitle={docSubtitle(q, lang, `${t.quoteWord} ${q.quote_no}`)} />
      <PartiesRow q={q} lang={lang} />
      <Section n={3} title={t.secPayment} style={{ marginBottom: GAP }} wrap={false}>
        <AmountBand label={t.amountReceived} sub={p.receipt_no} amount={p.amount_xaf} tone="paid" lang={lang} />
        <View style={{ marginTop: 6 }}><KvList rows={rows} /></View>
        {p.note ? <T style={[st.note, { fontFamily: fam(p.note) }]}>{wrapCjk(p.note, 470, 9)}</T> : null}
      </Section>
      <Section n={4} title={t.secSituation} flush>
        <PaymentsTable payments={payments} highlight={p.id} lang={lang} />
        <View style={{ padding: PAD }}>
          <View style={[st.kvRow, { paddingTop: 0 }]}><T style={st.kvLabel}>{t.quoteTotal} ({q.quote_no})</T><T style={[st.kvValue, { textAlign: 'right' }]}>{xaf(q.total_xaf, lang)}</T></View>
          <View style={[st.kvRow, { borderBottomWidth: 0, marginBottom: 6 }]}><T style={st.kvLabel}>{t.paidToDate}</T><T style={[st.kvValue, { textAlign: 'right' }]}>{xaf(paid, lang)}</T></View>
          {balance > 0
            ? <AmountBand label={t.balanceToPay} amount={balance} tone="due" lang={lang} />
            : <AmountBand label={t.settled} amount={q.total_xaf} tone="paid" lang={lang} />}
          <T style={[st.grey, { marginTop: 6 }]}>{balance > 0 ? t.releaseWhenPaid : t.fullyPaid}</T>
        </View>
      </Section>
      <Validation n={5} place={t.placeCity[p.place]} date={day(p.paid_at, t)} note={t.receiptFootnote} lang={lang} />
    </Shell>
  );
}

// ============================================================
// La facture acquittée
// ============================================================
export function CargoInvoicePDF({ q, settings, lang = 'fr' }: { q: Quote; settings: ShippingSettings; lang?: CargoDocLang }) {
  const t = TXT[lang];
  const sea = q.location !== 'office';
  const issued = q.invoiced_at ?? q.paid_at ?? q.updated_at;
  const payments = activePayments(q);
  return (
    <Shell q={q} lang={lang} headTitle={t.hTitleInvoice} reference={q.invoice_no ?? q.quote_no} issuedOn={day(issued, t)}>
      <DocHead title={t.titleInvoice} subtitle={docSubtitle(q, lang, `${t.quoteWord} ${q.quote_no}  ·  ${sea ? t.modeSea : t.modeAir}`)} />
      <PartiesRow q={q} lang={lang} />
      <Section n={3} title={t.secGoods} flush style={{ marginBottom: GAP }}>
        <GoodsTable q={q} lang={lang} />
        <View style={{ padding: PAD }}>
          <AmountBand label={t.amountPaid} sub={q.paid_at ? day(q.paid_at, t) : null} amount={quotePaid(q)} tone="paid" lang={lang} />
          <T style={[st.grey, { marginTop: 6 }]}>{t.invoiceFootnote}</T>
          {q.notes ? <T style={[st.note, { fontFamily: fam(q.notes) }]}>{wrapCjk(q.notes, 470, 9)}</T> : null}
        </View>
      </Section>
      {payments.length ? (
        <Section n={4} title={t.secSettlements} flush wrap={false}>
          <PaymentsTable payments={payments} lang={lang} />
        </Section>
      ) : null}
      <Validation n={payments.length ? 5 : 4} place="Guangzhou" date={day(issued, t)} note={t.invoiceValidation(q.deposit_no)} paid lang={lang} />
      <View break>
        <Conditions n={payments.length ? 6 : 5} lang={lang} />
        <Addresses n={payments.length ? 7 : 6} settings={settings} lang={lang} />
      </View>
    </Shell>
  );
}
