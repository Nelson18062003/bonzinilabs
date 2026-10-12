// ============================================================
// LE RELEVÉ DES COLIS D'UN CLIENT — « quels sont tous mes colis chez vous ? »
// Même charte que le bon de réception et la facture (CargoDocumentsPDF) :
// en-tête officiel, barre tricolore, sections encadrées, DM Sans.
//   1. le client · 2. en résumé (combien, où, ce qui reste à payer)
//   3. à Guangzhou · 4. en route (par conteneur ou par vol, avec l'arrivée)
//   5. à Douala, à retirer · 6. ce qui reste à payer · modes de règlement
// Chaque colis avec sa vignette, son numéro, ce qu'il contient, ses mesures.
// Le calcul vit dans src/lib/clientStatement.ts ; ici, on dessine.
// ============================================================
import type { ReactNode } from 'react';
import { View, Image } from '@react-pdf/renderer';
import { DOC_TZ, NBSP, docDay, kg, m3, money, pdfSafe, xaf } from '../cargoDocFormat';
import {
  C, GAP, MM, PAD, T, TXT, AmountBand, ClientBlock, HowToPay, KvList, Section, Shell, SignOff, DocHead, awbText, dots, fitted, nb, st,
  type CargoDocLang, type Kv, type Txt,
} from './CargoDocumentsPDF';
import type { PdfPhoto } from '@/lib/pdf/pdfPhotos';
import type { ClientStatement, StatementParcel, StatementTransport } from '@/lib/clientStatement';
import { parcelPhotoPaths, type ReceptionCondition } from '@/lib/reception';

const S = {
  fr: {
    hTitle: 'RELEVÉ DES COLIS', title: 'Vos colis chez Bonzini', asOfLabel: 'Au',
    subtitle: (n: number, w: string, v: string) => `${n}${NBSP}colis · ${w}${NBSP}kg · ${v}${NBSP}m³`,
    secSummary: 'En résumé', secGz: 'À Guangzhou — pas encore partis', secTransit: 'En route vers Douala', secDla: 'À Douala — à retirer', secDues: 'Ce qui reste à payer',
    atGz: 'À Guangzhou', inTransit: 'En route', atDla: 'À Douala, à retirer', toPay: 'Reste à payer', delivered: 'Déjà remis',
    parcelsN: (n: number) => `${n}${NBSP}colis`, none: 'Aucun',
    colPhoto: 'Photo', colNo: 'Colis', colLabel: 'Désignation', colDims: 'Dimensions', colWeight: 'Poids', colVol: 'Volume',
    colReceived: 'Reçu le', colArrived: 'Arrivé le', colDeposit: 'Dépôt',
    container: 'Conteneur', flight: 'Vol', vessel: 'Navire', departed: 'Parti le', eta: 'Arrivée estimée', arrivedOn: 'Arrivé le', etaPending: 'arrivée à confirmer',
    loadedWaiting: 'chargé, départ à venir',
    reserve: 'Réserve à la réception : ', missing: 'Manquant au pointage à Douala', damagedDla: 'Abîmé au pointage à Douala',
    colRef: 'Référence', colTotal: 'Total', colPaid: 'Déjà réglé', colBalance: 'Reste',
    invoice: 'Facture', quote: 'Devis', quoteToCome: 'Devis à venir', totalDue: 'Total restant à payer',
    unpricedNote: 'Les dépôts « devis à venir » n’ont pas encore de prix : le montant vous sera communiqué.',
    deliveredNote: (n: number) => `${n}${NBSP}colis déjà remis ne figure${n > 1 ? 'nt' : ''} pas sur ce relevé.`,
    note: 'Relevé établi d’après nos registres à la date indiquée. Il ne remplace ni le bon de réception ni la facture.',
    noPhoto: 'sans photo', footer: (code: string) => `Relevé ${code}`,
    condition: { good: 'bon état apparent', damaged: 'carton abîmé', opened: 'colis ouvert', wet: 'colis mouillé' } as Record<ReceptionCondition, string>,
  },
  en: {
    hTitle: 'PARCEL STATEMENT', title: 'Your parcels with Bonzini', asOfLabel: 'As of',
    subtitle: (n: number, w: string, v: string) => `${n}${NBSP}parcel${n === 1 ? '' : 's'} · ${w}${NBSP}kg · ${v}${NBSP}m³`,
    secSummary: 'Summary', secGz: 'In Guangzhou — not yet shipped', secTransit: 'On the way to Douala', secDla: 'In Douala — ready for collection', secDues: 'Balance due',
    atGz: 'In Guangzhou', inTransit: 'On the way', atDla: 'In Douala, to collect', toPay: 'Balance due', delivered: 'Already collected',
    parcelsN: (n: number) => `${n}${NBSP}parcel${n === 1 ? '' : 's'}`, none: 'None',
    colPhoto: 'Photo', colNo: 'Parcel', colLabel: 'Description', colDims: 'Dimensions', colWeight: 'Weight', colVol: 'Volume',
    colReceived: 'Received', colArrived: 'Arrived', colDeposit: 'Deposit',
    container: 'Container', flight: 'Flight', vessel: 'Vessel', departed: 'Left on', eta: 'Estimated arrival', arrivedOn: 'Arrived on', etaPending: 'arrival to be confirmed',
    loadedWaiting: 'loaded, departure pending',
    reserve: 'Reserve on receipt: ', missing: 'Missing at the Douala check-in', damagedDla: 'Damaged at the Douala check-in',
    colRef: 'Reference', colTotal: 'Total', colPaid: 'Paid', colBalance: 'Balance',
    invoice: 'Invoice', quote: 'Quote', quoteToCome: 'Quote to come', totalDue: 'Total balance due',
    unpricedNote: 'Deposits marked “quote to come” have no price yet: the amount will be sent to you.',
    deliveredNote: (n: number) => `${n}${NBSP}parcel${n === 1 ? '' : 's'} already collected ${n === 1 ? 'is' : 'are'} not listed.`,
    note: 'Statement drawn from our records on the date shown. It replaces neither the goods receipt nor the invoice.',
    noPhoto: 'no photo', footer: (code: string) => `Statement ${code}`,
    condition: { good: 'good apparent condition', damaged: 'damaged carton', opened: 'opened parcel', wet: 'wet parcel' } as Record<ReceptionCondition, string>,
  },
};
type St = (typeof S)['fr'];

const THUMB = 32;
const COL = { photo: 38, no: 84, dims: 78, weight: 44, vol: 50, last: 60 };
const DESIGN_W = 180 * MM - (COL.photo + COL.no + COL.dims + COL.weight + COL.vol + COL.last) - 10;

/** Le tableau des colis d'une section ; `last` : la dernière colonne (reçu le, arrivé le, dépôt). */
function ParcelTable({ items, photos, lang, last, head }: {
  items: StatementParcel[]; photos: ReadonlyMap<string, PdfPhoto>; lang: CargoDocLang;
  last: { label: string; value: (x: StatementParcel) => string }; head?: ReactNode;
}) {
  const t: Txt = TXT[lang];
  const s: St = S[lang];
  const right = { textAlign: 'right' as const };
  return (
    <View>
      {head}
      <View style={st.th} wrap={false} fixed>
        <T style={[st.thc, { width: COL.photo }]}>{s.colPhoto}</T>
        <T style={[st.thc, { width: COL.no }]}>{s.colNo}</T>
        <T style={[st.thc, { flex: 1 }]}>{s.colLabel}</T>
        <View style={[st.thc, { width: COL.dims }]}><T style={{ textAlign: 'center' }}>{s.colDims}</T><T style={[st.thUnit, { textAlign: 'center' }]}>cm</T></View>
        <View style={[st.thc, { width: COL.weight }]}><T style={right}>{s.colWeight}</T><T style={[st.thUnit, right]}>kg</T></View>
        <View style={[st.thc, { width: COL.vol }]}><T style={right}>{s.colVol}</T><T style={[st.thUnit, right]}>m³</T></View>
        <T style={[st.thc, { width: COL.last }, right]}>{last.label}</T>
      </View>
      {items.map((x) => {
        const p = x.parcel;
        const cover = photos.get(parcelPhotoPaths(p)[0] ?? '') ?? null;
        const label = fitted(p.description || t.kindLabel[p.kind] || t.parcel, DESIGN_W, 9.5, 2);
        const reserve = p.reception_condition && p.reception_condition !== 'good'
          ? `${s.reserve}${s.condition[p.reception_condition]}${p.reception_condition_note ? ` · ${pdfSafe(p.reception_condition_note)}` : ''}` : null;
        const dla = p.condition === 'missing' ? s.missing : p.condition === 'damaged' ? s.damagedDla : null;
        const warn = [dla, reserve].filter(Boolean).join('\n');
        const warnFit = warn ? fitted(warn, DESIGN_W, 8, 3) : null;
        return (
          <View key={p.id} style={st.tr} wrap={false}>
            <View style={{ width: COL.photo, paddingVertical: 3, paddingLeft: 4 }}>
              {cover
                ? <Image src={cover.src} style={{ width: THUMB, height: THUMB, objectFit: 'cover', borderRadius: 2 }} />
                : <View style={{ width: THUMB, height: THUMB, borderRadius: 2, backgroundColor: C.headBg, alignItems: 'center', justifyContent: 'center' }}><T style={{ fontSize: 5.5, color: C.grey }}>{s.noPhoto}</T></View>}
            </View>
            <T style={[st.td, { width: COL.no, fontSize: 8.8, fontWeight: 700 }]}>{nb(p.parcel_no)}</T>
            <View style={[st.td, { flex: 1 }]}>
              <T style={{ fontFamily: label.font }}>{label.text}</T>
              {p.description ? <T style={st.tdSub}>{t.kindLabel[p.kind] ?? t.parcel}</T> : null}
              {warnFit ? <T style={{ fontSize: 8, marginTop: 1.5, color: C.orange, fontWeight: 700, fontFamily: warnFit.font }}>{warnFit.text}</T> : null}
            </View>
            <T style={[st.td, { width: COL.dims, textAlign: 'center', fontSize: 9 }]}>{p.length_cm && p.width_cm && p.height_cm ? [p.length_cm, p.width_cm, p.height_cm].map((v) => kg(v, lang)).join(`${NBSP}× `) : '—'}</T>
            <T style={[st.td, { width: COL.weight }, right]}>{p.weight_kg == null ? '—' : kg(p.weight_kg, lang)}</T>
            <T style={[st.td, { width: COL.vol }, right]}>{m3(p.cbm, lang)}</T>
            <T style={[st.td, { width: COL.last, fontSize: 9 }, right]}>{last.value(x)}</T>
          </View>
        );
      })}
    </View>
  );
}

/** La ligne d'en-tête d'un transport : le conteneur ou le vol, le départ, l'arrivée (ambre tant qu'elle est estimée). */
function TransportHead({ g, asOf, lang }: { g: StatementTransport; asOf: string; lang: CargoDocLang }) {
  const t: Txt = TXT[lang];
  const s: St = S[lang];
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: DOC_TZ }).format(new Date(asOf));
  const eta = g.info?.eta ?? null;
  const arrived = !!eta && String(eta).slice(0, 10) <= today;
  const name = g.mode === 'air'
    ? dots([g.ref ? awbText(g.ref, t) : s.flight, nb([g.info?.airline, g.info?.flight_no].filter(Boolean).join(' '))])
    : dots([`${s.container} ${nb(g.ref || '—')}`, g.info?.vessel_name ? `${s.vessel} ${g.info.vessel_name}` : null]);
  const departed = g.info?.etd ? `${s.departed} ${docDay(g.info.etd, lang)}` : s.loadedWaiting;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.violetTint, paddingHorizontal: PAD, paddingVertical: 5, borderBottomWidth: 0.6, borderBottomColor: C.rule }} wrap={false} minPresenceAhead={60}>
      <T style={{ flex: 1, fontSize: 9.5, fontWeight: 700 }}>{name}</T>
      <T style={{ fontSize: 8.8, color: C.grey, marginRight: 10 }}>{departed}</T>
      <T style={{ fontSize: 9, fontWeight: 700, color: eta ? (arrived ? C.black : C.amberText) : C.grey }}>
        {eta ? `${arrived ? s.arrivedOn : s.eta} ${docDay(eta, lang)}` : s.etaPending}
      </T>
    </View>
  );
}

export function ClientStatementPDF({ statement: cs, photos, asOf, lang = 'fr' }: { statement: ClientStatement; photos: ReadonlyMap<string, PdfPhoto>; asOf: string; lang?: CargoDocLang }) {
  const t: Txt = TXT[lang];
  const s: St = S[lang];
    const code = cs.client?.customer_code ?? '—';
  const day = docDay(asOf, lang);
  const inTransit = cs.transit.reduce((n, g) => n + g.parcels.length, 0);
  const summary: Kv[] = [
    [s.atGz, cs.guangzhou.length ? s.parcelsN(cs.guangzhou.length) : s.none, cs.guangzhou.length ? undefined : 'muted'],
    [s.inTransit, inTransit ? s.parcelsN(inTransit) : s.none, inTransit ? undefined : 'muted'],
    [s.atDla, cs.douala.length ? s.parcelsN(cs.douala.length) : s.none, cs.douala.length ? 'violet' : 'muted'],
    [s.toPay, cs.dueTotal > 0 ? xaf(cs.dueTotal, lang) : cs.dues.length ? s.quoteToCome : s.none, cs.dueTotal > 0 ? 'orange' : 'muted'],
  ];
  if (cs.deliveredCount) summary.push([s.delivered, s.parcelsN(cs.deliveredCount), 'muted']);
  let n = 2;
  const next = () => ++n;
  const right = { textAlign: 'right' as const };
  return (
    <Shell footRef={s.footer(code)} lang={lang} headTitle={s.hTitle} reference={code} issuedLabel={s.asOfLabel} issuedOn={day}>
      <DocHead title={s.title} subtitle={s.subtitle(cs.held.parcels, kg(cs.held.kg, lang), m3(cs.held.cbm, lang))} />
      <View style={{ flexDirection: 'row' }}>
        <Section n={1} title={t.secClient} style={{ flex: 1, marginRight: 6 * MM }}><ClientBlock client={cs.client} lang={lang} /></Section>
        <Section n={2} title={s.secSummary} style={{ flex: 1 }}><KvList rows={summary} /></Section>
      </View>

      {cs.guangzhou.length ? (
        <Section n={next()} title={s.secGz} flush style={{ marginTop: GAP }}>
          <ParcelTable items={cs.guangzhou} photos={photos} lang={lang} last={{ label: s.colReceived, value: (x) => docDay(x.deposit.closed_at ?? x.deposit.opened_at, lang) }} />
        </Section>
      ) : null}

      {cs.transit.length ? (
        <Section n={next()} title={s.secTransit} flush style={{ marginTop: GAP }}>
          {cs.transit.map((g, i) => (
            <View key={g.key} style={i ? { marginTop: 6 } : undefined}>
              <ParcelTable items={g.parcels} photos={photos} lang={lang} head={<TransportHead g={g} asOf={asOf} lang={lang} />}
                last={{ label: s.colDeposit, value: (x) => nb(x.deposit.deposit_no) }} />
            </View>
          ))}
        </Section>
      ) : null}

      {cs.douala.length ? (
        <Section n={next()} title={s.secDla} flush style={{ marginTop: GAP }}>
          <ParcelTable items={cs.douala} photos={photos} lang={lang} last={{ label: s.colArrived, value: (x) => (x.parcel.checked_in_at ? docDay(x.parcel.checked_in_at, lang) : '—') }} />
        </Section>
      ) : null}

      {cs.dues.length ? (
        <Section n={next()} title={s.secDues} flush style={{ marginTop: GAP }} wrap={false}>
          <View style={st.th}>
            <T style={[st.thc, { width: 90, paddingLeft: PAD }]}>{s.colDeposit}</T>
            <T style={[st.thc, { flex: 1 }]}>{s.colRef}</T>
            <T style={[st.thc, { width: 82 }, right]}>{s.colTotal}</T>
            <T style={[st.thc, { width: 82 }, right]}>{s.colPaid}</T>
            <T style={[st.thc, { width: 90, paddingRight: PAD }, right]}>{s.colBalance}</T>
          </View>
          {cs.dues.map((d) => (
            <View key={d.deposit_no} style={st.tr} wrap={false}>
              <T style={[st.td, { width: 90, paddingLeft: PAD, fontWeight: 700 }]}>{nb(d.deposit_no)}</T>
              <T style={[st.td, { flex: 1 }]}>{d.unpriced ? s.quoteToCome : d.invoice_no ? `${s.invoice} ${nb(d.invoice_no)}` : `${s.quote} ${nb(d.quote_no ?? '')}`}</T>
              <T style={[st.td, { width: 82 }, right]}>{d.unpriced ? '—' : money(d.total, lang)}</T>
              <T style={[st.td, { width: 82 }, right]}>{d.unpriced ? '—' : money(d.paid, lang)}</T>
              <T style={[st.td, { width: 90, paddingRight: PAD, fontWeight: 700, color: d.unpriced ? C.grey : C.orange }, right]}>{d.unpriced ? '—' : money(d.balance, lang)}</T>
            </View>
          ))}
          <View style={{ padding: PAD }}>
            {cs.dueTotal > 0 ? <AmountBand label={s.totalDue} amount={cs.dueTotal} tone="due" lang={lang} /> : null}
            {cs.dues.some((d) => d.unpriced) ? <T style={[st.grey, { fontSize: 8.8, marginTop: 5 }]}>{s.unpricedNote}</T> : null}
          </View>
        </Section>
      ) : null}

      <View wrap={false} style={{ marginTop: GAP }}>
        <SignOff place="Douala" date={day} note={s.note} lang={lang}>
          {cs.deliveredCount ? <T style={st.grey}>{s.deliveredNote(cs.deliveredCount)}</T> : null}
        </SignOff>
      </View>

      {cs.dueTotal > 0 ? <HowToPay n={next()} payRef={code} lang={lang} /> : null}
    </Shell>
  );
}
