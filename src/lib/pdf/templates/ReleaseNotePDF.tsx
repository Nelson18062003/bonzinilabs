// ============================================================
// LE BON DE RETRAIT — qui a emporté quoi, quand, à Douala, avec la
// signature ; en-tête et pied officiels, émetteur NORTON GAUSS BONZINI SARL.
// ============================================================
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { PDFHeader } from '../components/PDFHeader';
import { PDFFooter } from '../components/PDFFooter';
import { baseStyles, colors } from '../styles';
import { formatDate } from '../helpers';
import '../fonts';
import { transportLabel, type Release } from '@/lib/warehouse';
import { clientFullName, formatCbm, formatDims, formatKg } from '@/lib/reception';
import { LEGAL_NAME, WEBSITE } from '@/lib/companyIdentity';

const CJK = /[一-鿿㐀-䶿豈-﫿]/;
const fam = (s: string | null | undefined) => (s && CJK.test(s) ? 'Noto Sans SC' : 'DM Sans');
const clean = (s: string) => s.replace(/[\u00A0\u202F]/g, ' ').replace(/³/g, '3');

const st = StyleSheet.create({
  parties: { flexDirection: 'row', gap: 18, marginBottom: 14 },
  party: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, backgroundColor: colors.light },
  partyLabel: { fontSize: 8, fontWeight: 800, color: colors.gold, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 },
  partyName: { fontSize: 11.5, fontWeight: 800, color: colors.text, marginBottom: 2 },
  partyLine: { fontSize: 9, color: colors.muted, lineHeight: 1.35 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  metaLeft: { fontSize: 10, fontWeight: 700, color: colors.text }, metaRight: { fontSize: 9.5, color: colors.muted },
  th: { flexDirection: 'row', backgroundColor: colors.violetDark, borderRadius: 4, paddingVertical: 5, paddingHorizontal: 6 },
  thc: { fontSize: 8, fontWeight: 700, color: colors.white, textTransform: 'uppercase', letterSpacing: 0.6 },
  tr: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center' },
  trAlt: { backgroundColor: colors.light },
  td: { fontSize: 9.5, color: colors.text }, tdMuted: { fontSize: 8.5, color: colors.muted }, warn: { fontSize: 8.5, color: colors.orange },
  cNo: { width: '18%' }, cDesc: { width: '34%' }, cTr: { width: '18%' }, cW: { width: '10%', textAlign: 'right' }, cDim: { width: '13%', textAlign: 'right' }, cCbm: { width: '7%', textAlign: 'right' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.violetDark, borderRadius: 6, paddingVertical: 7, paddingHorizontal: 12, marginTop: 8 },
  totalText: { fontSize: 10.5, fontWeight: 800, color: colors.white },
  sectionTitle: { fontSize: 9, fontWeight: 800, color: colors.gold, textTransform: 'uppercase', letterSpacing: 2, marginTop: 16, marginBottom: 6 },
  note: { fontSize: 8.5, color: colors.muted, lineHeight: 1.45 },
  signRow: { flexDirection: 'row', gap: 18, marginTop: 10 },
  signBox: { width: 220, height: 90, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 4, backgroundColor: colors.white },
  signImg: { width: 210, height: 80, objectFit: 'contain' },
  signName: { fontSize: 10, fontWeight: 700, color: colors.text, marginTop: 4 },
  dateLabel: { fontSize: 8, fontWeight: 700, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1 },
  dateValue: { fontSize: 10.5, color: colors.text, marginTop: 3 },
});

export function ReleaseNotePDF({ r, signatureDataUrl }: { r: Release; signatureDataUrl?: string | null }) {
  const name = r.client ? clientFullName(r.client) : 'Client';
  const kg = r.parcels.reduce((s, p) => s + Number(p.weight_kg ?? 0), 0);
  const cbm = r.parcels.reduce((s, p) => s + Number(p.cbm ?? 0), 0);
  return (
    <Document>
      <Page size="A4" style={baseStyles.page}>
        <PDFHeader type="bon-retrait" reference={r.release_no} />
        <View style={st.metaRow}>
          <Text style={st.metaLeft}>Entrepôt de Douala · {r.parcels.length} colis remis</Text>
          <Text style={st.metaRight}>Le {formatDate(r.released_at)}{r.released_by_name ? ` · remis par ${r.released_by_name}` : ''}</Text>
        </View>
        <View style={st.parties}>
          <View style={st.party}>
            <Text style={st.partyLabel}>Émetteur</Text>
            <Text style={st.partyName}>{LEGAL_NAME}</Text>
            <Text style={st.partyLine}>Entrepôt de Douala, Cameroun</Text>
            <Text style={st.partyLine}>{WEBSITE}</Text>
          </View>
          <View style={st.party}>
            <Text style={st.partyLabel}>Client</Text>
            <Text style={[st.partyName, { fontFamily: fam(name) }]}>{name}</Text>
            <Text style={st.partyLine}>{[r.client?.customer_code, r.client?.phone].filter(Boolean).join(' · ')}</Text>
          </View>
          <View style={st.party}>
            <Text style={st.partyLabel}>Remis à</Text>
            <Text style={[st.partyName, { fontFamily: fam(r.picked_by_name) }]}>{r.picked_by_name}</Text>
            {r.picked_by_phone ? <Text style={st.partyLine}>{r.picked_by_phone}</Text> : null}
          </View>
        </View>

        <View style={st.th}>
          <Text style={[st.thc, st.cNo]}>N° colis</Text><Text style={[st.thc, st.cDesc]}>Contenu</Text><Text style={[st.thc, st.cTr]}>Arrivé par</Text>
          <Text style={[st.thc, st.cW]}>Poids</Text><Text style={[st.thc, st.cDim]}>Dimensions</Text><Text style={[st.thc, st.cCbm]}>m³</Text>
        </View>
        {r.parcels.map((p, i) => (
          <View key={p.id} style={[st.tr, ...(i % 2 ? [st.trAlt] : [])]} wrap={false}>
            <Text style={[st.td, st.cNo, { fontWeight: 700 }]}>{p.parcel_no}</Text>
            <View style={st.cDesc}>
              <Text style={[st.td, { fontFamily: fam(p.description) }]}>{p.description || p.kind || 'Colis'}</Text>
              {p.condition === 'damaged' ? <Text style={st.warn}>Abîmé à l'arrivée{p.condition_note ? ` : ${p.condition_note}` : ''}</Text> : null}
            </View>
            <Text style={[st.td, st.cTr]}>{transportLabel(p)}</Text>
            <Text style={[st.td, st.cW]}>{clean(formatKg(p.weight_kg))}</Text>
            <Text style={[st.tdMuted, st.cDim]}>{clean(formatDims(p))}</Text>
            <Text style={[st.td, st.cCbm]}>{clean(formatCbm(p.cbm)).replace(' m3', '')}</Text>
          </View>
        ))}
        <View style={st.totalRow}>
          <Text style={st.totalText}>{r.parcels.length} COLIS REMIS</Text>
          <Text style={st.totalText}>{clean(`${formatKg(kg)} · ${formatCbm(cbm)}`)}</Text>
        </View>

        <Text style={st.sectionTitle}>Décharge</Text>
        <Text style={st.note}>Je reconnais avoir reçu les colis ci-dessus, en l'état constaté à la remise. Toute réclamation sur le contenu se fait avant de quitter l'entrepôt.</Text>
        <View style={st.signRow}>
          <View>
            <Text style={st.dateLabel}>Signature</Text>
            <View style={[st.signBox, { marginTop: 3 }]}>{signatureDataUrl ? <Image src={signatureDataUrl} style={st.signImg} /> : null}</View>
            <Text style={[st.signName, { fontFamily: fam(r.picked_by_name) }]}>{r.picked_by_name}</Text>
          </View>
          <View>
            <Text style={st.dateLabel}>Date</Text>
            <Text style={st.dateValue}>{formatDate(r.released_at)}</Text>
            {r.note ? <Text style={[st.note, { marginTop: 8, maxWidth: 240 }]}>{r.note}</Text> : null}
          </View>
        </View>
        <PDFFooter />
      </Page>
    </Document>
  );
}
