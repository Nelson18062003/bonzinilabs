// ============================================================
// LA FICHE « COORDONNÉES MOBILE MONEY » — un livret de quatre pages A4,
// émis par NORTON GAUSS BONZINI SARL, une idée par page :
//   1 · Couverture : deux façons de payer, séparées par un « ou ».
//   2 · FLOTTE (Float) — page claire, violet : le numéro et le titulaire.
//   3 · RETRAIT (Withdrawal) — page sombre, orange : le code à composer.
//   4 · LA PREUVE — page claire, or : ce que la capture doit montrer.
// Chaque façon a sa couleur ET son fond : on ne peut pas confondre la page
// Flotte et la page Retrait, même en miniature sur un téléphone. Les logos sont
// les fichiers officiels des opérateurs. Aucun site, aucun plafond.
// ============================================================
import { Document, Page, View, Text, Image, Svg, Path, StyleSheet } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import { PdfLogo } from '../components/PDFHeader';
import { colors } from '../styles';
import '../fonts';
import { MOBILE_MONEY_GUIDE_COPY as COPY } from '@/lib/mobileMoneyGuide';
import type { MobileMoneyGuideData, MobileMoneyOperator } from '@/lib/mobileMoneyGuide';
import { LEGAL_NAME } from '@/lib/companyIdentity';
import orangeMoneyLogo from '@/assets/deposit-logos/orange-money.png';

/**
 * Le logo MTN officiel (identité 2022, en usage chez MTN Cameroon) : l'ovale et
 * les lettres en noir, posés sur le jaune MTN. Tracé vectoriel d'origine
 * (Wikimedia Commons, « MTN 2022 logo.svg »), net à toutes les tailles.
 */
const MTN_YELLOW = '#FFCB05';
const MTN_LOGO_PATH = 'M640,0C286.5,0,0,143.3,0,320s286.5,320,640,320s640-143.3,640-320S993.5,0,640,0z M640,589.5C314.4,589.5,50.5,468.8,50.5,320S314.4,50.5,640,50.5s589.5,120.7,589.5,269.5S965.6,589.5,640,589.5z M559.3,263.9v-50.5h180.5v50.5h-65v162.8h-50.5V263.9H559.3z M957.8,213.3v213.3h-50.5l-91.6-127v127h-50.5V213.3h50.5l91.6,127v-127L957.8,213.3z M320.7,426.7V213.3h50.5l56.1,86.3l56.1-86.3H534v213.3h-50.5V306l-38.3,58.9h-35.6L371.2,306v120.7H320.7z';

const PAGE_W = 595.28;
const M = 44; // marge latérale
const CONTENT_W = PAGE_W - 2 * M;
const INK = colors.violetDark;
const WHITE = colors.white;
const CALL_GREEN = '#1faa59';
// Bordures sur fond sombre : couleurs pleines pré-mélangées (react-pdf rend mal le rgba des bordures).
const LINE_ON_INK = '#362d42';      // blanc 12 % sur #1a1028
const LINE_ON_PANEL = '#3a2f4b';    // blanc 10 % sur #251a37
const OR_RING = '#5f586a';          // blanc 30 % sur #1a1028
const LEGEND_LINE = '#6a291f';      // orange 35 % sur #1a1028
const TOTAL = 4;

type SectionKey = 'flotte' | 'retrait' | 'preuve';
/** Une couleur par partie, et la couleur du texte posé dessus. */
const SECTION: Record<SectionKey, { n: string; color: string; ink: string; soft: string; page: number }> = {
  flotte: { n: '1', color: colors.violet, ink: WHITE, soft: 'rgba(255,255,255,0.78)', page: 2 },
  retrait: { n: '2', color: colors.orange, ink: WHITE, soft: 'rgba(255,255,255,0.8)', page: 3 },
  preuve: { n: '3', color: colors.gold, ink: INK, soft: 'rgba(26,16,40,0.62)', page: 4 },
};
const ORDER: SectionKey[] = ['flotte', 'retrait', 'preuve'];

const st = StyleSheet.create({
  page: { padding: 0, fontFamily: 'DM Sans', color: colors.text },
  body: { paddingHorizontal: M, paddingTop: 22 },
  label: { fontSize: 8, fontWeight: 700, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1.8, marginBottom: 7 },

  // ── Bandeau de partie (pages 2 à 4) ──
  hero: { position: 'relative', overflow: 'hidden', paddingTop: 26, paddingHorizontal: M, paddingBottom: 24 },
  heroGhost: { position: 'absolute', right: -14, top: -86, fontSize: 340, fontWeight: 900, opacity: 0.13, lineHeight: 1 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  markDisc: { width: 28, height: 28, borderRadius: 14, backgroundColor: WHITE, alignItems: 'center', justifyContent: 'center', marginRight: 9 },
  brandName: { fontSize: 9.5, fontWeight: 800, letterSpacing: 1.8 },
  heroPage: { fontSize: 9, fontWeight: 700, letterSpacing: 1.4 },
  eyebrow: { fontSize: 9, fontWeight: 700, letterSpacing: 2.6, textTransform: 'uppercase', marginBottom: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end' },
  heroWord: { fontSize: 60, fontWeight: 900, letterSpacing: 3, textTransform: 'uppercase', lineHeight: 1 },
  heroEn: { fontSize: 17, fontWeight: 500, marginLeft: 12, marginBottom: 9 },
  heroBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  heroSentence: { fontSize: 15, fontWeight: 500 },
  needs: { borderRadius: 20, paddingVertical: 6, paddingHorizontal: 13 },
  needsText: { fontSize: 10, fontWeight: 800, letterSpacing: 0.6 },

  // ── Pied de page : la société, et où l'on est ──
  footer: { position: 'absolute', left: M, right: M, bottom: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, paddingTop: 9 },
  footerText: { fontSize: 7.5, fontWeight: 500, letterSpacing: 0.3 },
  way: { flexDirection: 'row', alignItems: 'center' },
  wayItem: { flexDirection: 'row', alignItems: 'center', marginLeft: 12 },
  wayDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  wayText: { fontSize: 7.5, letterSpacing: 0.4 },

  // ── Logos des opérateurs (fichiers officiels) ──
  opMark: { flexDirection: 'row', alignItems: 'center' },
  logoOrange: { width: 116, height: 31.1 },
  logoMtn: { width: 34, height: 34 },
  logoPlate: { backgroundColor: WHITE, borderRadius: 9, paddingVertical: 6, paddingHorizontal: 9 },
  opName: { fontSize: 13, fontWeight: 800, marginLeft: 10 },

  // ── Page Flotte ──
  card: { backgroundColor: WHITE, borderWidth: 1, borderColor: colors.border, borderRadius: 18, marginBottom: 12, overflow: 'hidden' },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: '#fcfbfd' },
  kind: { fontSize: 8, fontWeight: 800, color: colors.violet, backgroundColor: colors.violetLight, textTransform: 'uppercase', letterSpacing: 1.3, borderRadius: 12, paddingVertical: 4, paddingHorizontal: 10 },
  cardBody: { paddingTop: 13, paddingBottom: 16, paddingHorizontal: 20 },
  keys: { flexDirection: 'row' },
  key: { backgroundColor: '#f5f2f9', borderWidth: 1, borderColor: '#e6def0', borderRadius: 10, paddingTop: 3, paddingBottom: 1, paddingHorizontal: 11, marginRight: 8 },
  keyText: { fontSize: 35, fontWeight: 900, color: INK, letterSpacing: 1.6, lineHeight: 1.15 },
  holder: { alignSelf: 'flex-start', borderWidth: 1.5, borderColor: colors.violet, backgroundColor: colors.violetLight, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 14 },
  holderText: { fontSize: 17, fontWeight: 900, color: INK, letterSpacing: 0.5 },
  alert: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: colors.violetLight, marginTop: 2 },
  alertDisc: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  alertMark: { fontSize: 13, fontWeight: 900, color: WHITE, lineHeight: 1 },
  alertText: { fontSize: 12.5, fontWeight: 700, color: INK },

  // ── Page Retrait (fond sombre) ──
  cardDark: { backgroundColor: '#251a37', borderWidth: 1, borderColor: LINE_ON_PANEL, borderRadius: 18, marginBottom: 14, overflow: 'hidden' },
  cardHeadDark: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: LINE_ON_PANEL },
  cardBodyDark: { paddingTop: 13, paddingBottom: 16, paddingHorizontal: 14 },
  dial: { flexDirection: 'row', alignItems: 'center', backgroundColor: WHITE, borderRadius: 14, paddingVertical: 15, paddingLeft: 14, paddingRight: 12 },
  dialCode: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  dialText: { fontWeight: 800, color: INK, letterSpacing: 0.3 },
  amountBox: { backgroundColor: colors.orange, borderRadius: 6, paddingTop: 2, paddingBottom: 1, paddingHorizontal: 5, marginHorizontal: 2 },
  amountText: { fontWeight: 900, color: WHITE, letterSpacing: 0.6 },
  call: { width: 34, height: 34, borderRadius: 17, backgroundColor: CALL_GREEN, alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  legend: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: 'rgba(254,86,13,0.14)', borderWidth: 1, borderColor: LEGEND_LINE, marginTop: 2 },
  legendText: { fontSize: 12.5, fontWeight: 700, color: WHITE, marginLeft: 10 },

  // ── Page Preuve ──
  ticketHead: { flexDirection: 'row', alignItems: 'center', height: 66, paddingHorizontal: 22 },
  ticketOk: { width: 30, height: 30, borderRadius: 15, backgroundColor: CALL_GREEN, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  barA: { width: 150, height: 10, borderRadius: 5, backgroundColor: '#d9d1e5', marginBottom: 6 },
  barB: { width: 92, height: 8, borderRadius: 4, backgroundColor: '#e6e0ee' },
  ticketTag: { marginLeft: 'auto', fontSize: 8, fontWeight: 700, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1.6 },
  ticketRow: { flexDirection: 'row', alignItems: 'center', height: 50, marginHorizontal: 22, borderTopWidth: 1, borderTopColor: '#e3dcea', borderStyle: 'dashed' },
  goldCheck: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  ticketLabel: { flex: 1, fontSize: 16, fontWeight: 800, color: INK },
  ticketBar: { height: 10, borderRadius: 5, backgroundColor: '#e4def0' },
  clear: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  clearText: { fontSize: 12.5, fontWeight: 700, color: INK, marginLeft: 10 },
  thanks: { flexDirection: 'row', alignItems: 'center', backgroundColor: INK, borderRadius: 18, paddingVertical: 20, paddingHorizontal: 24 },
  thanksText: { fontSize: 17, fontWeight: 800, color: WHITE },
  thanksSign: { fontSize: 8.5, fontWeight: 800, color: colors.gold, letterSpacing: 1.6, marginTop: 4 },

  // ── Couverture (fond sombre) ──
  coverTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 36, paddingHorizontal: M },
  coverBrand: { fontSize: 11, fontWeight: 800, color: WHITE, letterSpacing: 2, marginLeft: 10 },
  coverPage: { fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: 1.4 },
  stripe: { flexDirection: 'row', marginHorizontal: M, marginTop: 18 },
  stripeSeg: { flex: 1, height: 3, borderRadius: 2 },
  coverTitles: { paddingHorizontal: M, marginTop: 44 },
  coverKicker: { fontSize: 9.5, fontWeight: 800, color: colors.gold, textTransform: 'uppercase', letterSpacing: 3, marginBottom: 12 },
  coverTitleTop: { fontSize: 26, fontWeight: 400, color: 'rgba(255,255,255,0.72)', lineHeight: 1.1 },
  coverTitleBottom: { fontSize: 56, fontWeight: 900, color: WHITE, letterSpacing: -0.8, lineHeight: 1.05 },
  coverBody: { paddingHorizontal: M, marginTop: 34 },
  coverLead: { fontSize: 16, fontWeight: 700, color: WHITE, marginBottom: 16 },
  door: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingVertical: 22, paddingHorizontal: 22 },
  doorDisc: { width: 50, height: 50, borderRadius: 25, backgroundColor: WHITE, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  doorDiscText: { fontSize: 24, fontWeight: 900, lineHeight: 1 },
  doorWordRow: { flexDirection: 'row', alignItems: 'flex-end' },
  doorWord: { fontSize: 28, fontWeight: 900, color: WHITE, letterSpacing: 2.4, textTransform: 'uppercase', lineHeight: 1 },
  doorEn: { fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.78)', marginLeft: 9, marginBottom: 3 },
  doorSentence: { fontSize: 13, fontWeight: 500, color: WHITE, marginTop: 6 },
  doorPage: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 16, paddingVertical: 6, paddingHorizontal: 11 },
  doorPageText: { fontSize: 8.5, fontWeight: 800, color: WHITE, letterSpacing: 1.2, textTransform: 'uppercase', marginRight: 5 },
  orRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 10 },
  orLine: { flex: 1, height: 1, backgroundColor: LINE_ON_INK },
  orDisc: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: OR_RING, alignItems: 'center', justifyContent: 'center', marginHorizontal: 12 },
  orText: { fontSize: 12, fontWeight: 800, color: WHITE, lineHeight: 1 },
  choose: { fontSize: 11, fontWeight: 700, color: colors.gold, textAlign: 'center', marginTop: 12, marginBottom: 20, letterSpacing: 0.3 },
  proofDoor: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1.5, borderColor: colors.gold, paddingVertical: 13, paddingHorizontal: 22 },
  proofDisc: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  proofDiscText: { fontSize: 16, fontWeight: 900, color: INK, lineHeight: 1 },
  proofWord: { flex: 1, fontSize: 15, fontWeight: 900, color: WHITE, textTransform: 'uppercase', letterSpacing: 1.8 },
  plate: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: WHITE, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 22, paddingHorizontal: M, height: 138 },
  plateLogos: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  plateFoot: { position: 'absolute', left: M, right: M, bottom: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 9 },
});

/* ─────────────── Pictogrammes (dessinés, pas de police d'icônes) ─────────────── */

function ArrowIcon({ color, size = 10 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 12h15M13 6l6 6-6 6" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

function CheckIcon({ color, size = 12 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 12.5l4.5 4.5L19 7" stroke={color} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

/** Le combiné du bouton « Appeler » : on compose le code, puis on appelle. */
function CallIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={WHITE} d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
    </Svg>
  );
}

/* ─────────────── Éléments communs ─────────────── */

function Footer({ active, dark }: { active: SectionKey | null; dark?: boolean }) {
  const muted = dark ? 'rgba(255,255,255,0.45)' : colors.muted;
  return (
    <View style={[st.footer, { borderTopColor: dark ? LINE_ON_INK : colors.border }]} fixed>
      <Text style={[st.footerText, { color: muted }]}>{LEGAL_NAME} · {COPY.docTitle}</Text>
      <Wayfinder active={active} dark={dark} />
    </View>
  );
}

/** Les trois parties du livret ; celle où l'on est est en couleur. */
function Wayfinder({ active, dark }: { active: SectionKey | null; dark?: boolean }) {
  const muted = dark ? 'rgba(255,255,255,0.45)' : colors.muted;
  return (
    <View style={st.way}>
      {ORDER.map((k) => {
        const on = active === null || active === k;
        return (
          <View key={k} style={st.wayItem}>
            <View style={[st.wayDot, { backgroundColor: on ? SECTION[k].color : dark ? 'rgba(255,255,255,0.22)' : '#dcd6e4' }]} />
            <Text style={[st.wayText, { color: active === k ? (dark ? WHITE : colors.text) : muted, fontWeight: active === k ? 800 : 500 }]}>{COPY.way[k]}</Text>
          </View>
        );
      })}
    </View>
  );
}

function Hero({ section, eyebrow, word, en, sentence, needs }: { section: SectionKey; eyebrow: string; word: string; en?: string; sentence: string; needs: string }) {
  const s = SECTION[section];
  const onGold = section === 'preuve';
  return (
    <View style={[st.hero, { backgroundColor: s.color }]}>
      <Text style={[st.heroGhost, { color: s.ink, opacity: onGold ? 0.08 : 0.13 }]}>{s.n}</Text>
      <View style={st.heroTop}>
        <View style={st.brandRow}>
          <View style={st.markDisc}><PdfLogo size={19} /></View>
          <Text style={[st.brandName, { color: s.ink }]}>{LEGAL_NAME}</Text>
        </View>
        <Text style={[st.heroPage, { color: s.soft }]}>{s.page} / {TOTAL}</Text>
      </View>
      <Text style={[st.eyebrow, { color: s.soft }]}>{eyebrow}</Text>
      <View style={st.titleRow}>
        <Text style={[st.heroWord, { color: s.ink }]}>{word}</Text>
        {en ? <Text style={[st.heroEn, { color: s.soft }]}>{en}</Text> : null}
      </View>
      <View style={st.heroBottom}>
        <Text style={[st.heroSentence, { color: s.ink }]}>{sentence}</Text>
        <View style={[st.needs, { backgroundColor: onGold ? INK : WHITE }]}>
          <Text style={[st.needsText, { color: onGold ? colors.gold : s.color }]}>{needs}</Text>
        </View>
      </View>
    </View>
  );
}

function SectionPage({ section, dark, children }: { section: SectionKey; dark?: boolean; children: ReactNode }) {
  return (
    <Page size="A4" style={[st.page, { backgroundColor: dark ? INK : WHITE }]}>
      {children}
      <Footer active={section} dark={dark} />
    </Page>
  );
}

/** Le logo MTN : le tracé officiel en noir sur son jaune, dans une pastille aux coins doux. */
function MtnLogo({ height }: { height: number }) {
  const w = height * 1.7;
  return (
    <View style={{ width: w, height, backgroundColor: MTN_YELLOW, borderRadius: height * 0.2, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={w * 0.78} height={w * 0.39} viewBox="0 0 1280 640">
        <Path d={MTN_LOGO_PATH} fill="#000000" />
      </Svg>
    </View>
  );
}

/** Le logo officiel ; sur fond sombre, le logo Orange (texte noir) est posé sur une plaque blanche. */
function OperatorMark({ op, onDark, big }: { op: MobileMoneyOperator; onDark?: boolean; big?: boolean }) {
  const k = big ? 1.18 : 1;
  const logo = op.key === 'orange'
    ? <Image src={orangeMoneyLogo} style={{ width: st.logoOrange.width * k, height: st.logoOrange.height * k }} />
    : <MtnLogo height={st.logoMtn.height * k} />;
  return (
    <View style={st.opMark}>
      {onDark && op.key === 'orange' ? <View style={st.logoPlate}>{logo}</View> : logo}
      {op.key === 'mtn' ? <Text style={[st.opName, { color: onDark ? WHITE : colors.text, fontSize: 13 * k }]}>{op.name}</Text> : null}
    </View>
  );
}

/* ─────────────── Page 1 · Couverture ─────────────── */

function Door({ section, word, en, sentence }: { section: 'flotte' | 'retrait'; word: string; en: string; sentence: string }) {
  const s = SECTION[section];
  return (
    <View style={[st.door, { backgroundColor: s.color }]}>
      <View style={st.doorDisc}><Text style={[st.doorDiscText, { color: s.color }]}>{s.n}</Text></View>
      <View style={{ flex: 1 }}>
        <View style={st.doorWordRow}>
          <Text style={st.doorWord}>{word}</Text>
          <Text style={st.doorEn}>{en}</Text>
        </View>
        <Text style={st.doorSentence}>{sentence}</Text>
      </View>
      <View style={st.doorPage}>
        <Text style={st.doorPageText}>{COPY.cover.page} {s.page}</Text>
        <ArrowIcon color={WHITE} size={9} />
      </View>
    </View>
  );
}

function Cover({ operators }: { operators: MobileMoneyOperator[] }) {
  return (
    <Page size="A4" style={[st.page, { backgroundColor: INK }]}>
      <View style={st.coverTop}>
        <View style={st.brandRow}>
          <PdfLogo size={30} />
          <Text style={st.coverBrand}>{LEGAL_NAME}</Text>
        </View>
        <Text style={st.coverPage}>1 / {TOTAL}</Text>
      </View>
      {/* Le code couleur du livret, annoncé d'un trait : Flotte · Retrait · Preuve. */}
      <View style={st.stripe}>
        {ORDER.map((k, i) => <View key={k} style={[st.stripeSeg, { backgroundColor: SECTION[k].color, marginLeft: i ? 5 : 0 }]} />)}
      </View>

      <View style={st.coverTitles}>
        <Text style={st.coverKicker}>{COPY.cover.kicker}</Text>
        <Text style={st.coverTitleTop}>{COPY.titleTop}</Text>
        <Text style={st.coverTitleBottom}>{COPY.titleBottom}</Text>
      </View>

      <View style={st.coverBody}>
        <Text style={st.coverLead}>{COPY.cover.lead}</Text>
        <Door section="flotte" word={COPY.flotte.word} en={COPY.flotte.en} sentence={COPY.cover.flotte} />
        <View style={st.orRow}>
          <View style={st.orLine} />
          <View style={st.orDisc}><Text style={st.orText}>{COPY.cover.or}</Text></View>
          <View style={st.orLine} />
        </View>
        <Door section="retrait" word={COPY.retrait.word} en={COPY.retrait.en} sentence={COPY.cover.retrait} />
        <Text style={st.choose}>{COPY.cover.choose}</Text>
        <View style={st.proofDoor}>
          <View style={st.proofDisc}><Text style={st.proofDiscText}>{SECTION.preuve.n}</Text></View>
          <Text style={st.proofWord}>{COPY.cover.preuve}</Text>
          <View style={[st.doorPage, { backgroundColor: 'rgba(243,167,69,0.16)' }]}>
            <Text style={[st.doorPageText, { color: colors.gold }]}>{COPY.cover.page} {SECTION.preuve.page}</Text>
            <ArrowIcon color={colors.gold} size={9} />
          </View>
        </View>
      </View>

      {/* La plaque blanche : les logos officiels sur leur fond d'origine. */}
      <View style={st.plate}>
        <Text style={st.label}>{COPY.cover.operators}</Text>
        <View style={st.plateLogos}>
          {operators.map((op, i) => <View key={op.key} style={{ marginLeft: i ? 40 : 0 }}><OperatorMark op={op} big /></View>)}
        </View>
        <View style={st.plateFoot}>
          <Text style={[st.footerText, { color: colors.muted }]}>{LEGAL_NAME} · {COPY.docTitle}</Text>
          <Wayfinder active={null} />
        </View>
      </View>
    </Page>
  );
}

/* ─────────────── Page 2 · Flotte ─────────────── */

function FlotteCard({ op }: { op: MobileMoneyOperator }) {
  return (
    <View style={st.card} wrap={false}>
      <View style={st.cardHead}>
        <OperatorMark op={op} />
        <Text style={st.kind}>{op.account}</Text>
      </View>
      <View style={st.cardBody}>
        <Text style={st.label}>{COPY.flotte.number}</Text>
        {/* Le numéro en touches : on le recopie groupe par groupe. */}
        <View style={st.keys}>
          {op.number.split(' ').map((g, i) => <View key={i} style={st.key}><Text style={st.keyText}>{g}</Text></View>)}
        </View>
        <Text style={[st.label, { marginTop: 13 }]}>{COPY.flotte.holder}</Text>
        <View style={st.holder}><Text style={st.holderText}>{op.holder}</Text></View>
      </View>
    </View>
  );
}

/* ─────────────── Page 3 · Retrait ─────────────── */

/**
 * Une seule taille pour les deux codes, calée sur le plus long, pour qu'ils
 * tiennent sur une ligne : chiffres et signes ≈ 0,59 em, la case MONTANT
 * ≈ 4,1 em + ses marges. 6 % de marge de sécurité.
 */
function codeFontSize(codes: string[]): number {
  const longest = Math.max(...codes.map((c) => c.replace('MONTANT', '').length));
  const room = CONTENT_W - 2 * 14 - 14 - 12 - 44 - 14; // carte, écran, bouton d'appel, case MONTANT
  return Math.min(22, Math.floor(((0.94 * room) / (longest * 0.59 + 4.1)) * 10) / 10);
}

function RetraitCard({ op, size }: { op: MobileMoneyOperator; size: number }) {
  const [before, after] = op.merchantCode.split('MONTANT');
  return (
    <View style={st.cardDark} wrap={false}>
      <View style={st.cardHeadDark}><OperatorMark op={op} onDark /></View>
      <View style={st.cardBodyDark}>
        <Text style={[st.label, { color: 'rgba(255,255,255,0.55)' }]}>{COPY.retrait.code}</Text>
        {/* L'écran du téléphone : le code, MONTANT en orange, puis « Appeler ». */}
        <View style={st.dial}>
          <View style={st.dialCode}>
            <Text style={[st.dialText, { fontSize: size }]}>{before}</Text>
            <View style={st.amountBox}><Text style={[st.amountText, { fontSize: size * 0.86 }]}>MONTANT</Text></View>
            <Text style={[st.dialText, { fontSize: size }]}>{after}</Text>
          </View>
          <View style={st.call}><CallIcon size={16} /></View>
        </View>
      </View>
    </View>
  );
}

/* ─────────────── Page 4 · Preuve ─────────────── */

/** Le contour d'un ticket : coins arrondis en haut, dents de scie en bas. */
function ticketPath(w: number, h: number, tooth: number): string {
  const r = 16;
  const n = Math.round(w / 14);
  const tw = w / n;
  let d = `M0 ${r} Q0 0 ${r} 0 H${w - r} Q${w} 0 ${w} ${r} V${h - tooth}`;
  for (let i = 0; i < n; i++) {
    const x = w - i * tw;
    d += ` L${(x - tw / 2).toFixed(2)} ${h} L${(x - tw).toFixed(2)} ${h - tooth}`;
  }
  return `${d} Z`;
}

const PROOF_BAR_W = [96, 150, 120, 84];

function Ticket() {
  const tooth = 9;
  const h = 66 + COPY.preuve.items.length * 50 + 16 + tooth;
  return (
    <View style={{ width: CONTENT_W, height: h, position: 'relative', marginBottom: 18 }}>
      <Svg width={CONTENT_W} height={h} style={{ position: 'absolute', top: 0, left: 0 }}>
        <Path d={ticketPath(CONTENT_W, h, tooth)} fill="#f8f6fa" stroke={colors.border} strokeWidth={1} />
      </Svg>
      <View style={st.ticketHead}>
        <View style={st.ticketOk}><CheckIcon color={WHITE} size={15} /></View>
        <View>
          <View style={st.barA} />
          <View style={st.barB} />
        </View>
        <Text style={st.ticketTag}>{COPY.preuve.shot}</Text>
      </View>
      {COPY.preuve.items.map((item, i) => (
        <View key={item} style={st.ticketRow}>
          <View style={st.goldCheck}><CheckIcon color={INK} size={12} /></View>
          <Text style={st.ticketLabel}>{item}</Text>
          <View style={[st.ticketBar, { width: PROOF_BAR_W[i] }]} />
        </View>
      ))}
    </View>
  );
}

/* ─────────────── Le document ─────────────── */

export function MobileMoneyGuidePDF({ data }: { data: MobileMoneyGuideData }) {
  const { operators } = data;
  const size = codeFontSize(operators.map((o) => o.merchantCode));
  return (
    <Document title={`${COPY.docTitle} — ${LEGAL_NAME}`} author={LEGAL_NAME} creator={LEGAL_NAME} producer={LEGAL_NAME}>
      <Cover operators={operators} />

      <SectionPage section="flotte">
        <Hero section="flotte" eyebrow={COPY.flotte.eyebrow} word={COPY.flotte.word} en={COPY.flotte.en} sentence={COPY.flotte.sentence} needs={COPY.flotte.needs} />
        <View style={st.body}>
          {operators.map((op) => <FlotteCard key={op.key} op={op} />)}
          <View style={st.alert}>
            <View style={[st.alertDisc, { backgroundColor: colors.violet }]}><Text style={st.alertMark}>!</Text></View>
            <Text style={st.alertText}>{COPY.flotte.check}</Text>
          </View>
        </View>
      </SectionPage>

      <SectionPage section="retrait" dark>
        <Hero section="retrait" eyebrow={COPY.retrait.eyebrow} word={COPY.retrait.word} en={COPY.retrait.en} sentence={COPY.retrait.sentence} needs={COPY.retrait.needs} />
        <View style={st.body}>
          {operators.map((op) => <RetraitCard key={op.key} op={op} size={size} />)}
          <View style={st.legend}>
            <View style={st.amountBox}><Text style={[st.amountText, { fontSize: 11 }]}>MONTANT</Text></View>
            <View style={{ marginLeft: 10 }}><ArrowIcon color={WHITE} size={12} /></View>
            <Text style={st.legendText}>{COPY.retrait.legend}</Text>
          </View>
        </View>
      </SectionPage>

      <SectionPage section="preuve">
        <Hero section="preuve" eyebrow={COPY.preuve.eyebrow} word={COPY.preuve.word} sentence={COPY.preuve.sentence} needs={COPY.preuve.needs} />
        <View style={st.body}>
          <Ticket />
          <View style={st.clear}>
            <View style={[st.alertDisc, { backgroundColor: colors.gold, marginRight: 0 }]}><CheckIcon color={INK} size={12} /></View>
            <Text style={st.clearText}>{COPY.preuve.clear}</Text>
          </View>
          <View style={st.thanks}>
            <View style={[st.markDisc, { width: 34, height: 34, borderRadius: 17, marginRight: 14 }]}><PdfLogo size={24} /></View>
            <View>
              <Text style={st.thanksText}>{COPY.preuve.thanks}</Text>
              <Text style={st.thanksSign}>{LEGAL_NAME}</Text>
            </View>
          </View>
        </View>
      </SectionPage>
    </Document>
  );
}
