// ============================================================
// LA FICHE « COORDONNÉES MOBILE MONEY » — une page A4, en-tête et pied
// officiels. Ce que le client doit trouver en cinq secondes : quel numéro,
// quel nom, quel code. Deux opérateurs × deux façons (Flotte / Retrait), les
// étapes en trois puces, la preuve à envoyer dite une fois. Le numéro est
// l'élément le plus gros de chaque carte ; le nom affiché, juste dessous,
// est ce que le client compare à son écran avant de valider.
// ============================================================
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { PDFHeader } from '../components/PDFHeader';
import { PDFFooter } from '../components/PDFFooter';
import { baseStyles, colors } from '../styles';
import { formatXAF } from '../helpers';
import '../fonts';
import type { MobileMoneyGuideData, MobileMoneyOperator } from '@/lib/mobileMoneyGuide';
import { LEGAL_NAME, WEBSITE } from '@/lib/companyIdentity';

const ORANGE = '#FF7900';
const MTN_YELLOW = '#FFCC00';
const MTN_BLUE = '#004F9F';
const BRAND: Record<MobileMoneyOperator['key'], string> = { orange: ORANGE, mtn: MTN_YELLOW };

const st = StyleSheet.create({
  identity: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  identityText: { flex: 1, fontSize: 8.5, color: colors.muted, marginRight: 10 },
  introHint: { fontSize: 8.8, fontWeight: 400, color: colors.muted },
  limitPill: { fontSize: 8.5, fontWeight: 700, color: '#7a4a00', backgroundColor: colors.goldLight, borderWidth: 1, borderColor: '#f3d9a8', borderRadius: 10, paddingVertical: 2.5, paddingHorizontal: 8 },
  intro: { fontSize: 11, fontWeight: 600, color: colors.text, lineHeight: 1.35, marginBottom: 6 },
  ways: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  way: { flex: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8, backgroundColor: colors.light, borderWidth: 1, borderColor: colors.border },
  wayHead: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 2 },
  wayTitle: { fontSize: 9.5, fontWeight: 800, color: colors.text, textTransform: 'uppercase', letterSpacing: 1 },
  wayEn: { fontSize: 8, color: colors.muted },
  wayText: { fontSize: 8.8, color: colors.text, lineHeight: 1.35 },
  op: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, marginBottom: 7, overflow: 'hidden', borderTopWidth: 4 },
  opHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5, paddingHorizontal: 10, backgroundColor: colors.light, borderBottomWidth: 1, borderBottomColor: colors.border },
  tile: { width: 30, height: 30, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  tileText: { fontSize: 8.5, fontWeight: 900, letterSpacing: -0.3 },
  opName: { fontSize: 12, fontWeight: 800, color: colors.text },
  opNameSub: { fontSize: 8, color: colors.muted, marginTop: 1 },
  opIdent: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 14 },
  identLabel: { fontSize: 7.5, fontWeight: 700, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  identNumber: { fontSize: 22, fontWeight: 900, color: colors.text, letterSpacing: 0.6, lineHeight: 1.1 },
  holderPill: { alignSelf: 'flex-start', marginTop: 2, borderWidth: 1.2, borderColor: colors.gold, backgroundColor: colors.white, borderRadius: 6, paddingVertical: 2.5, paddingHorizontal: 7 },
  holderText: { fontSize: 10, fontWeight: 800, color: colors.text, letterSpacing: 0.2 },
  cols: { flexDirection: 'row' },
  col: { flex: 1, paddingVertical: 7, paddingHorizontal: 9 },
  colSep: { borderLeftWidth: 1, borderLeftColor: colors.border },
  colHead: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 4 },
  colTitle: { fontSize: 9.5, fontWeight: 800, color: colors.text, textTransform: 'uppercase', letterSpacing: 1 },
  colTag: { fontSize: 7.5, color: colors.muted },
  codeBox: { flexDirection: 'row', flexWrap: 'nowrap', backgroundColor: colors.violetDark, borderRadius: 6, paddingVertical: 5, paddingHorizontal: 7, marginBottom: 5 },
  codeText: { fontSize: 11.5, fontWeight: 800, color: colors.white, letterSpacing: 0.2 },
  codeAmount: { fontSize: 11.5, fontWeight: 800, color: colors.gold, letterSpacing: 0.2 },
  codeExample: { fontSize: 7.8, color: colors.muted, marginBottom: 4, marginTop: -2 },
  holderHint: { fontSize: 7.5, color: colors.muted, marginTop: 2 },
  step: { flexDirection: 'row', gap: 5, marginBottom: 2 },
  stepN: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.violet, color: colors.white, fontSize: 7, fontWeight: 800, textAlign: 'center', lineHeight: 1.55 },
  stepText: { flex: 1, fontSize: 8.8, color: colors.text, lineHeight: 1.35 },
  proof: { flexDirection: 'row', gap: 12, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: colors.violetDark, marginBottom: 6 },
  proofLeft: { flex: 1.2 },
  proofRight: { flex: 1, borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.18)', paddingLeft: 12 },
  proofTitle: { fontSize: 9.5, fontWeight: 800, color: colors.white, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 },
  proofLead: { fontSize: 8.8, color: 'rgba(255,255,255,0.85)', lineHeight: 1.35, marginBottom: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  chip: { fontSize: 8, fontWeight: 700, color: colors.white, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 8, paddingVertical: 2, paddingHorizontal: 6 },
  proofGold: { fontSize: 8.8, fontWeight: 700, color: colors.gold, lineHeight: 1.35 },
  warn: { fontSize: 8.6, color: colors.muted, lineHeight: 1.35, textAlign: 'center' },
});

function Tile({ op }: { op: MobileMoneyOperator }) {
  if (op.key === 'orange') return <View style={[st.tile, { backgroundColor: ORANGE }]}><Text style={[st.tileText, { color: colors.white, fontSize: 7.5 }]}>orange</Text></View>;
  return <View style={[st.tile, { backgroundColor: MTN_YELLOW }]}><Text style={[st.tileText, { color: MTN_BLUE }]}>MTN</Text></View>;
}

function Steps({ items }: { items: string[] }) {
  return <View>{items.map((t, i) => <View key={i} style={st.step}><Text style={st.stepN}>{i + 1}</Text><Text style={st.stepText}>{t}</Text></View>)}</View>;
}

/** Le code marchand, MONTANT en or : c'est la seule partie que le client remplace. */
function Code({ code }: { code: string }) {
  const parts = code.split('MONTANT');
  const small = code.length > 26;
  const size = small ? { fontSize: 10.2, letterSpacing: 0 } : {};
  return (
    <View style={st.codeBox}>
      {parts.map((p, i) => (
        <Text key={i} style={[st.codeText, size]}>{p}{i < parts.length - 1 ? <Text style={[st.codeAmount, size]}>MONTANT</Text> : null}</Text>
      ))}
    </View>
  );
}

function Operator({ op }: { op: MobileMoneyOperator }) {
  return (
    <View style={[st.op, { borderTopColor: BRAND[op.key] }]} wrap={false}>
      <View style={st.opHead}>
        <Tile op={op} />
        <View>
          <Text style={st.opName}>{op.name}</Text>
          <Text style={st.opNameSub}>Cameroun</Text>
        </View>
        <View style={st.opIdent}>
          <View>
            <Text style={st.identLabel}>Numéro</Text>
            <Text style={st.identNumber}>{op.number}</Text>
          </View>
          <View>
            <Text style={st.identLabel}>Nom qui s'affiche</Text>
            <View style={st.holderPill}><Text style={st.holderText}>{op.holder}</Text></View>
            <Text style={st.holderHint}>{op.holderNote ? `${op.holderNote} ` : ''}Un autre nom ? Annulez.</Text>
          </View>
        </View>
      </View>
      <View style={st.cols}>
        <View style={st.col}>
          <View style={st.colHead}><Text style={st.colTitle}>Flotte</Text><Text style={st.colTag}>Float · transfert vers notre numéro</Text></View>
          <Steps items={[
            op.key === 'orange' ? `Composez ${op.transferUssd} (ou application Orange Money › Transfert)` : `Composez ${op.transferUssd} › Transfert d'argent (ou application MTN MoMo › Transfert)`,
            `Entrez le numéro ${op.number}, puis le montant`,
            `${op.holder} s'affiche ? Validez avec votre ${op.pinName}`,
          ]} />
        </View>
        <View style={[st.col, st.colSep]}>
          <View style={st.colHead}><Text style={st.colTitle}>Retrait</Text><Text style={st.colTag}>Withdrawal · paiement par code marchand</Text></View>
          <Code code={op.merchantCode} />
          <Text style={st.codeExample}>Exemple pour 150 000 XAF : {op.merchantCode.replace('MONTANT', '150000')}</Text>
          <Steps items={[
            'Remplacez MONTANT par la somme, sans espace',
            'Composez le code complet et appelez',
            `${op.holder} et le bon montant s'affichent ? Validez avec votre ${op.pinName}`,
          ]} />
        </View>
      </View>
    </View>
  );
}

export function MobileMoneyGuidePDF({ data }: { data: MobileMoneyGuideData }) {
  const limit = `${formatXAF(data.limitXaf)} XAF`;
  return (
    <Document>
      <Page size="A4" style={baseStyles.page}>
        <PDFHeader type="mobile-money" reference="COMMENT NOUS PAYER" />
        <View style={st.identity}>
          <Text style={st.identityText}>Document officiel émis par {LEGAL_NAME} · {WEBSITE}</Text>
          <Text style={st.limitPill}>Max {limit} par opération</Text>
        </View>
        <Text style={st.intro}>Deux opérateurs, et pour chacun deux façons de payer. Choisissez celle que vous utilisez déjà, suivez les trois étapes, puis envoyez-nous la preuve. <Text style={st.introHint}>En cas de doute : la Flotte, un simple transfert vers notre numéro.</Text></Text>
        <View style={st.ways}>
          <View style={st.way}>
            <View style={st.wayHead}><Text style={st.wayTitle}>Flotte</Text><Text style={st.wayEn}>Float · transfert</Text></View>
            <Text style={st.wayText}>Vous transférez la somme vers notre numéro, depuis votre compte Mobile Money ou votre compte Float / UV. Le nom du bénéficiaire s'affiche avant de valider.</Text>
          </View>
          <View style={st.way}>
            <View style={st.wayHead}><Text style={st.wayTitle}>Retrait</Text><Text style={st.wayEn}>Withdrawal · code marchand</Text></View>
            <Text style={st.wayText}>Vous composez notre code marchand avec le montant : la somme part de votre compte vers le nôtre. C'est vous qui payez, même si le mot dit « retrait ».</Text>
          </View>
        </View>

        {data.operators.map((op) => <Operator key={op.key} op={op} />)}

        <View style={st.proof} wrap={false}>
          <View style={st.proofLeft}>
            <Text style={st.proofTitle}>Après le paiement : la preuve</Text>
            <Text style={st.proofLead}>Faites une capture d'écran du SMS ou de l'écran de confirmation. On doit y lire :</Text>
            <View style={st.chips}>
              <Text style={st.chip}>date et heure</Text>
              <Text style={st.chip}>identifiant de transaction</Text>
              <Text style={st.chip}>nom du bénéficiaire</Text>
              <Text style={st.chip}>montant</Text>
            </View>
          </View>
          <View style={st.proofRight}>
            <Text style={st.proofTitle}>Puis déclarez le dépôt</Text>
            <Text style={st.proofLead}>Dans l'app Bonzini : Dépôts › Nouveau dépôt, joignez la capture — ou envoyez-la au support WhatsApp depuis l'app. Votre compte est crédité dès vérification.</Text>
            <Text style={st.proofGold}>Sans preuve lisible, le dépôt ne peut pas être validé.</Text>
          </View>
        </View>

        <Text style={st.warn}>Ces coordonnées sont les seules valables. Toute demande de paiement vers un autre numéro ou un autre nom ne vient pas de Bonzini. Au-delà de {limit}, faites plusieurs opérations.</Text>
        <PDFFooter text={`${LEGAL_NAME} · Coordonnées Mobile Money · Fiche 09/2026`} />
      </Page>
    </Document>
  );
}
