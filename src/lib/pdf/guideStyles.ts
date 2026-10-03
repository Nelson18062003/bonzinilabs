// ============================================================
// LES STYLES DES FICHES CLIENT (Mobile Money, coordonnées bancaires) : ceux
// que partagent les deux gabarits — bandeau, colonne de couleur (paysage),
// pied de page, preuve, couverture. Chaque gabarit ajoute les siens.
// ============================================================
import { StyleSheet } from '@react-pdf/renderer';
import { colors } from './styles';
import {
  INK, WHITE, CALL_GREEN, R, MUTED, LINE_ON_INK, OR_RING, ON_INK_SOFT, SIDE_W, SIDE_PAD, AREA_PAD,
} from './guideTokens';

const LABEL = { fontSize: 11, fontWeight: 800, letterSpacing: 1.4, textTransform: 'uppercase' } as const;

/** Les styles communs aux deux fiches (le reste vit dans chaque gabarit). */
export const gk = StyleSheet.create({
  page: { padding: 0, fontFamily: 'DM Sans', color: colors.text },
  label: { ...LABEL, color: MUTED, marginBottom: 5 },

  // ── Bandeau de partie (portrait) ──
  hero: { position: 'relative', overflow: 'hidden' },
  heroGhost: { position: 'absolute', fontWeight: 900, lineHeight: 1, color: WHITE, opacity: 0.16 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  markDisc: { width: 28, height: 28, borderRadius: 14, backgroundColor: WHITE, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  brandName: { fontSize: 10.5, fontWeight: 800, letterSpacing: 2 },
  folio: { fontSize: 10.5, fontWeight: 800, letterSpacing: 1.4 },
  eyebrow: { ...LABEL, marginBottom: 6 },
  heroWord: { fontWeight: 900, letterSpacing: 2.5, textTransform: 'uppercase', lineHeight: 1 },
  heroEnWord: { fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', lineHeight: 1 },
  sentenceFr: { fontSize: 16, fontWeight: 700 },
  sentenceEn: { fontSize: 14, fontWeight: 500, marginTop: 2 },
  sentenceEnOnViolet: { fontWeight: 700 },
  needs: { borderRadius: R.inner, paddingVertical: 7, paddingHorizontal: 14 },
  needsFr: { fontSize: 12, fontWeight: 800 },
  needsEn: { fontSize: 11, fontWeight: 600, marginTop: 1 },

  // ── Pied de page ──
  footer: { position: 'absolute', bottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, paddingTop: 8 },
  footerText: { fontSize: 11, fontWeight: 600, letterSpacing: 0.3 },
  way: { flexDirection: 'row', alignItems: 'center' },
  wayItem: { flexDirection: 'row', alignItems: 'center', marginLeft: 10 },
  wayDot: { width: 7, height: 7, borderRadius: 3.5, marginRight: 5 },
  wayText: { fontSize: 11, letterSpacing: 0.2 },

  // ── Preuve ──
  ticketHead: { flexDirection: 'row', alignItems: 'center', height: 60, paddingHorizontal: 20 },
  ticketOk: { width: 30, height: 30, borderRadius: 15, backgroundColor: CALL_GREEN, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  barA: { width: 130, height: 10, borderRadius: 5, backgroundColor: '#ddd5ea', marginBottom: 6 },
  barB: { width: 80, height: 8, borderRadius: 4, backgroundColor: '#ddd5ea' },
  ticketTag: { marginLeft: 'auto', alignItems: 'flex-end' },
  ticketRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, borderTopWidth: 1, borderTopColor: '#ddd5ea', borderStyle: 'dashed' },
  goldCheck: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  itemFr: { fontSize: 18, fontWeight: 800, color: INK },
  itemEn: { fontSize: 14, fontWeight: 500, color: MUTED, marginTop: 1 },
  ticketBar: { height: 10, borderRadius: 5, backgroundColor: '#ddd5ea', marginLeft: 'auto' },
  clearRow: { flexDirection: 'row', alignItems: 'center' },
  clearFr: { fontSize: 15, fontWeight: 800, color: INK },
  clearEn: { fontSize: 13, fontWeight: 500, color: MUTED, marginTop: 1 },
  thanks: { flexDirection: 'row', alignItems: 'center', backgroundColor: INK, borderRadius: R.box, paddingVertical: 18, paddingHorizontal: 22 },
  thanksFr: { fontSize: 19, fontWeight: 800, color: WHITE },
  thanksEn: { fontSize: 14, fontWeight: 500, color: ON_INK_SOFT, marginTop: 2 },
  thanksSign: { fontSize: 11, fontWeight: 800, color: colors.gold, letterSpacing: 1.8, marginTop: 6 },

  // ── Couverture ──
  coverBrand: { fontSize: 11, fontWeight: 800, color: WHITE, letterSpacing: 2, marginLeft: 10 },
  coverFolio: { fontSize: 10.5, fontWeight: 800, color: ON_INK_SOFT, letterSpacing: 1.4 },
  stripe: { flexDirection: 'row' },
  stripeSeg: { flex: 1, height: 3, borderRadius: 2 },
  coverKicker: { ...LABEL, color: colors.gold, letterSpacing: 2, marginBottom: 12 },
  coverTitleTop: { fontSize: 24, fontWeight: 400, color: ON_INK_SOFT, lineHeight: 1.1 },
  coverTitleBottom: { fontWeight: 900, color: WHITE, letterSpacing: -0.8, lineHeight: 1.05 },
  leadFr: { fontSize: 19, fontWeight: 800, color: WHITE },
  leadEn: { fontSize: 15, fontWeight: 500, color: ON_INK_SOFT, marginTop: 2 },
  door: { flexDirection: 'row', alignItems: 'center', borderRadius: R.box, paddingVertical: 16, paddingHorizontal: 18 },
  doorDisc: { width: 50, height: 50, borderRadius: 25, backgroundColor: WHITE, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  doorDiscText: { fontSize: 22, fontWeight: 900, lineHeight: 1 },
  doorWordRow: { flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap' },
  doorWord: { fontSize: 26, fontWeight: 900, color: WHITE, letterSpacing: 2, textTransform: 'uppercase', lineHeight: 1 },
  doorEnWord: { fontSize: 16, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', marginLeft: 8, marginBottom: 0, lineHeight: 1 },
  doorFr: { fontSize: 14, fontWeight: 700, color: WHITE, marginTop: 6 },
  doorEn: { fontSize: 13, fontWeight: 500, marginTop: 1 },
  doorPage: { flexDirection: 'row', alignItems: 'center', backgroundColor: WHITE, borderRadius: 14, paddingVertical: 6, paddingHorizontal: 11, marginLeft: 10 },
  doorPageText: { fontSize: 12, fontWeight: 800, color: INK, letterSpacing: 1.2, textTransform: 'uppercase', marginRight: 5 },
  orRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  orLine: { flex: 1, height: 1, backgroundColor: LINE_ON_INK },
  orDisc: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: OR_RING, alignItems: 'center', justifyContent: 'center', marginHorizontal: 12 },
  orFr: { fontSize: 16, fontWeight: 800, color: WHITE, lineHeight: 1 },
  orEn: { fontSize: 12, fontWeight: 600, color: ON_INK_SOFT, lineHeight: 1, marginTop: 2 },
  chooseFr: { fontSize: 16, fontWeight: 800, color: colors.gold, textAlign: 'center' },
  chooseEn: { fontSize: 14, fontWeight: 600, color: '#e7c48e', textAlign: 'center', marginTop: 1 },
  proofDoor: { flexDirection: 'row', alignItems: 'center', borderRadius: R.box, borderWidth: 1.5, borderColor: colors.gold, paddingVertical: 12, paddingHorizontal: 16.5 },
  proofDisc: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  proofDiscText: { fontSize: 19, fontWeight: 900, color: INK, lineHeight: 1 },
  proofFr: { fontSize: 16, fontWeight: 900, color: WHITE, textTransform: 'uppercase', letterSpacing: 1.8 },
  proofEn: { fontSize: 12, fontWeight: 700, color: ON_INK_SOFT, textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 2 },
  plate: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: WHITE, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  link: { textDecoration: 'none' },
});

/** Paysage : la colonne de couleur à gauche, la zone de données à droite. */
export const ls = StyleSheet.create({
  side: { width: SIDE_W, paddingTop: 26, paddingBottom: 22, paddingHorizontal: SIDE_PAD, position: 'relative', overflow: 'hidden' },
  sideGhost: { position: 'absolute', right: -24, top: 64, fontSize: 300, fontWeight: 900, lineHeight: 1, color: WHITE },
  sideBrand: { fontSize: 11, fontWeight: 800, letterSpacing: 1 },
  sideEyebrow: { fontSize: 11, fontWeight: 800, letterSpacing: 1.6, textTransform: 'uppercase' },
  sideEyebrowEn: { fontSize: 11, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase', marginTop: 2, marginBottom: 14 },
  sideWord: { fontWeight: 900, letterSpacing: 1.5, textTransform: 'uppercase', lineHeight: 1 },
  sideEnWord: { fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', lineHeight: 1.05, marginTop: 6 },
  sideSentenceFr: { fontSize: 15, fontWeight: 700, marginTop: 18, lineHeight: 1.25 },
  sideSentenceEn: { fontSize: 13, fontWeight: 500, marginTop: 3, lineHeight: 1.25 },
  sideFolio: { fontSize: 11, fontWeight: 800, letterSpacing: 1.4, marginTop: 12 },
  rule: { backgroundColor: WHITE, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 },
  ruleRow: { flexDirection: 'row', alignItems: 'center' },
  ruleFr: { fontSize: 14, fontWeight: 800, color: INK, lineHeight: 1.25 },
  ruleEn: { fontSize: 12.5, fontWeight: 500, color: MUTED, marginTop: 2, lineHeight: 1.25 },
  area: { flex: 1, paddingHorizontal: AREA_PAD, paddingTop: 26, paddingBottom: 56, justifyContent: 'center', position: 'relative' },
  doorTall: { borderRadius: R.box, paddingVertical: 16, paddingHorizontal: 18 },
  doorTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
});
