// ============================================================
// LA FICHE « COORDONNÉES MOBILE MONEY » — un livret de quatre pages A4,
// émis par NORTON GAUSS BONZINI SARL, une idée par page :
//   1 · Couverture : deux façons de payer, séparées par un « ou ».
//   2 · FLOTTE (Float) — page claire, violet : le numéro et le titulaire.
//   3 · RETRAIT (Withdrawal) — page sombre, orange : le code à composer.
//   4 · LA PREUVE — page claire, or : ce que la capture doit montrer.
// Flotte et Retrait portent un numéro (façon 1, façon 2) ; la preuve porte une
// coche : ce n'est pas une troisième façon, c'est ce qui suit l'une ou l'autre.
// Chaque façon a sa couleur ET son fond : on ne peut pas confondre la page
// Flotte et la page Retrait, même en miniature sur un téléphone. Les logos sont
// les logos officiels des opérateurs.
//
// Système : rayons 20 (conteneurs) · 12 (éléments intérieurs) · 6 (cases) ;
// petites capitales sur trois niveaux (micro 8 pt, surtitre 11 pt, marque 10 pt).
// ============================================================
import { Document, Page, View, Text, Image, Link, Svg, Path, StyleSheet } from '@react-pdf/renderer';
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
/** Le logo Orange Money, recadré au ras du dessin (1000 × 269 px). */
const ORANGE_RATIO = 1000 / 269;

const PAGE_W = 595.28;
const M = 44; // marge latérale
const CONTENT_W = PAGE_W - 2 * M;
const INK = colors.violetDark;
const WHITE = colors.white;
const CALL_GREEN = '#1faa59';
const TOTAL = 4;
const R = { box: 20, inner: 12, cell: 6 };
// Sur fond sombre : couleurs pleines pré-mélangées (react-pdf rend mal le rgba des bordures).
const PANEL = '#251a37';
const LINE_ON_INK = '#362d42';
const LINE_ON_PANEL = '#3a2f4b';
const OR_RING = '#5f586a';
const ON_INK_SOFT = '#cfc8da';

type SectionKey = 'flotte' | 'retrait' | 'preuve';
/** Une couleur par partie ; le texte principal et le texte secondaire posés dessus (contraste vérifié). */
const SECTION: Record<SectionKey, { n?: string; color: string; ink: string; soft: string; page: number }> = {
  flotte: { n: '1', color: colors.violet, ink: WHITE, soft: WHITE, page: 2 },
  retrait: { n: '2', color: colors.orange, ink: WHITE, soft: INK, page: 3 },
  preuve: { color: colors.gold, ink: INK, soft: INK, page: 4 },
};
const ORDER: SectionKey[] = ['flotte', 'retrait', 'preuve'];

const MICRO = { fontSize: 8, fontWeight: 700, letterSpacing: 1.6, textTransform: 'uppercase' } as const;
const OVERLINE = { fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase' } as const;
const BRANDLINE = { fontSize: 10, fontWeight: 800, letterSpacing: 2 } as const;

const st = StyleSheet.create({
  page: { padding: 0, fontFamily: 'DM Sans', color: colors.text },
  body: { paddingHorizontal: M, paddingTop: 18 },
  label: { ...MICRO, color: colors.muted, marginBottom: 7 },

  // ── Bandeau de partie (pages 2 à 4) ──
  hero: { position: 'relative', overflow: 'hidden', paddingTop: 26, paddingHorizontal: M, paddingBottom: 24 },
  heroGhost: { position: 'absolute', right: -40, top: -86, fontSize: 340, fontWeight: 900, lineHeight: 1 },
  heroGhostCheck: { position: 'absolute', right: -30, top: -30 },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 26 },
  markDisc: { width: 28, height: 28, borderRadius: 14, backgroundColor: WHITE, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  brandName: { ...BRANDLINE },
  eyebrow: { ...OVERLINE, marginBottom: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end' },
  heroWord: { fontSize: 60, fontWeight: 900, letterSpacing: 3, textTransform: 'uppercase', lineHeight: 1 },
  heroEn: { fontSize: 17, fontWeight: 700, marginLeft: 12, marginBottom: 1 },
  heroBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  heroSentence: { fontSize: 15, fontWeight: 700 },
  needs: { borderRadius: 14, paddingVertical: 6, paddingHorizontal: 13 },
  needsText: { fontSize: 10, fontWeight: 800, letterSpacing: 0.6 },

  // ── Pied de page : où l'on est dans le livret ──
  footer: { position: 'absolute', left: M, right: M, bottom: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, paddingTop: 9 },
  way: { flexDirection: 'row', alignItems: 'center' },
  wayItem: { flexDirection: 'row', alignItems: 'center', marginRight: 14 },
  wayDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  wayText: { fontSize: 7.5, letterSpacing: 0.4 },
  folio: { fontSize: 7.5, fontWeight: 700, letterSpacing: 1 },

  // ── Cartes opérateur (pages 2 et 3) ──
  card: { backgroundColor: WHITE, borderWidth: 1, borderColor: colors.border, borderRadius: R.box, marginBottom: 10, overflow: 'hidden' },
  cardDark: { backgroundColor: PANEL, borderWidth: 1, borderColor: LINE_ON_PANEL, borderRadius: R.box, marginBottom: 10, overflow: 'hidden' },
  cardHead: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, borderBottomWidth: 1 },
  cardBody: { paddingTop: 14, paddingBottom: 18, paddingHorizontal: 20 },
  logoPlate: { backgroundColor: WHITE, borderRadius: R.cell, paddingVertical: 3, paddingHorizontal: 7 },

  // ── Page Flotte ──
  keys: { flexDirection: 'row' },
  key: { flexBasis: 0, alignItems: 'center', backgroundColor: '#f5f2f9', borderWidth: 1, borderColor: '#e6def0', borderRadius: R.inner, paddingTop: 3, paddingBottom: 1 },
  keyText: { fontSize: 38, fontWeight: 900, color: INK, letterSpacing: 1.6, lineHeight: 1.15 },
  holder: { alignSelf: 'flex-start', borderWidth: 1.5, borderColor: colors.violet, backgroundColor: colors.violetLight, borderRadius: R.inner, paddingVertical: 7, paddingHorizontal: 14 },
  holderText: { fontSize: 17, fontWeight: 900, color: INK, letterSpacing: 0.5 },
  alert: { flexDirection: 'row', alignItems: 'center', borderRadius: R.inner, paddingVertical: 11, paddingHorizontal: 16, backgroundColor: colors.violetLight },
  alertDisc: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  alertMark: { fontSize: 15, fontWeight: 900, color: WHITE, lineHeight: 1 },
  alertText: { fontSize: 15, fontWeight: 700, color: INK },

  // ── Page Retrait (fond sombre) ──
  dial: { backgroundColor: WHITE, borderRadius: R.inner, paddingVertical: 14, paddingLeft: 16, paddingRight: 12 },
  codeRow: { flexDirection: 'row', alignItems: 'center' },
  digits: { fontWeight: 800, color: INK, letterSpacing: 0.4 },
  amountBox: { backgroundColor: colors.orange, borderRadius: R.cell, paddingTop: 2, paddingBottom: 1, paddingHorizontal: 6, marginRight: 3 },
  amountText: { fontWeight: 900, color: WHITE, letterSpacing: 0.6 },
  call: { width: 38, height: 38, borderRadius: 19, backgroundColor: CALL_GREEN, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },
  legend: { flexDirection: 'row', alignItems: 'center', borderRadius: R.inner, paddingVertical: 11, paddingHorizontal: 16, backgroundColor: PANEL, borderWidth: 1, borderColor: LINE_ON_PANEL },
  exampleBox: { backgroundColor: WHITE, borderRadius: R.cell, paddingTop: 2, paddingBottom: 1, paddingHorizontal: 6, marginLeft: 10 },
  exampleText: { fontSize: 13, fontWeight: 900, color: INK, letterSpacing: 0.6 },
  legendText: { fontSize: 15, fontWeight: 700, color: WHITE, marginLeft: 14 },

  // ── Page Preuve ──
  ticketHead: { flexDirection: 'row', alignItems: 'center', height: 66, paddingHorizontal: 22 },
  ticketOk: { width: 30, height: 30, borderRadius: 15, backgroundColor: CALL_GREEN, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  barA: { width: 150, height: 10, borderRadius: 5, backgroundColor: '#ddd5ea', marginBottom: 6 },
  barB: { width: 92, height: 8, borderRadius: 4, backgroundColor: '#ddd5ea' },
  ticketTag: { ...MICRO, marginLeft: 'auto', color: colors.muted },
  ticketRow: { flexDirection: 'row', alignItems: 'center', height: 58, marginHorizontal: 22, borderTopWidth: 1, borderTopColor: '#ddd5ea', borderStyle: 'dashed' },
  goldCheck: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  ticketLabel: { flex: 1, fontSize: 16, fontWeight: 800, color: INK },
  ticketBar: { height: 10, borderRadius: 5, backgroundColor: '#ddd5ea' },
  clear: { fontSize: 11, fontWeight: 600, color: colors.muted, textAlign: 'center' },
  thanks: { position: 'absolute', left: M, right: M, bottom: 64, flexDirection: 'row', alignItems: 'center', backgroundColor: INK, borderRadius: R.box, paddingVertical: 20, paddingHorizontal: 24 },
  thanksText: { fontSize: 17, fontWeight: 800, color: WHITE },
  thanksSign: { ...MICRO, color: colors.gold, marginTop: 5 },

  // ── Couverture (fond sombre) ──
  coverTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 36, paddingHorizontal: M },
  coverBrand: { ...BRANDLINE, color: WHITE, marginLeft: 10 },
  coverFolio: { ...MICRO, color: ON_INK_SOFT },
  stripe: { flexDirection: 'row', marginHorizontal: M, marginTop: 18 },
  stripeSeg: { flex: 1, height: 3, borderRadius: 2 },
  coverTitles: { paddingHorizontal: M, marginTop: 44 },
  coverKicker: { ...OVERLINE, color: colors.gold, marginBottom: 14 },
  coverTitleTop: { fontSize: 26, fontWeight: 400, color: ON_INK_SOFT, lineHeight: 1.1 },
  coverTitleBottom: { fontSize: 56, fontWeight: 900, color: WHITE, letterSpacing: -0.8, lineHeight: 1.05 },
  coverBody: { paddingHorizontal: M, marginTop: 30 },
  coverLead: { fontSize: 16, fontWeight: 700, color: WHITE, marginBottom: 4 },
  choose: { fontSize: 11, fontWeight: 700, color: ON_INK_SOFT, marginBottom: 16 },
  door: { flexDirection: 'row', alignItems: 'center', borderRadius: R.box, paddingVertical: 22, paddingHorizontal: 22 },
  doorLead: { width: 50, alignItems: 'center', marginRight: 16 },
  doorDisc: { width: 50, height: 50, borderRadius: 25, backgroundColor: WHITE, alignItems: 'center', justifyContent: 'center' },
  doorDiscText: { fontSize: 24, fontWeight: 900, lineHeight: 1 },
  doorWordRow: { flexDirection: 'row', alignItems: 'flex-end' },
  doorWord: { fontSize: 28, fontWeight: 900, color: WHITE, letterSpacing: 2.4, textTransform: 'uppercase', lineHeight: 1 },
  doorEn: { fontSize: 14, fontWeight: 700, marginLeft: 9, marginBottom: 1 },
  doorSentence: { fontSize: 14, fontWeight: 700, color: WHITE, marginTop: 6 },
  doorPage: { flexDirection: 'row', alignItems: 'center', backgroundColor: WHITE, borderRadius: 13, paddingVertical: 6, paddingHorizontal: 11 },
  doorPageText: { ...MICRO, color: INK, marginRight: 5 },
  orRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 10 },
  orLine: { flex: 1, height: 1, backgroundColor: LINE_ON_INK },
  orDisc: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: OR_RING, alignItems: 'center', justifyContent: 'center', marginHorizontal: 12 },
  orText: { fontSize: 12, fontWeight: 800, color: WHITE, lineHeight: 1 },
  proofDoor: { flexDirection: 'row', alignItems: 'center', borderRadius: R.box, borderWidth: 1.5, borderColor: colors.gold, paddingVertical: 13, paddingHorizontal: 20.5, marginTop: 28 },
  proofDisc: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  proofWord: { flex: 1, fontSize: 15, fontWeight: 900, color: WHITE, textTransform: 'uppercase', letterSpacing: 1.8 },
  plate: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 128, backgroundColor: WHITE, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 26, paddingHorizontal: M },
  plateLogos: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  plateCell: { width: CONTENT_W / 2 },
  link: { textDecoration: 'none' },
});

/* ─────────────── Pictogrammes (dessinés, pas de police d'icônes) ─────────────── */

function ArrowIcon({ color, size = 10 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 12h15M13 6l6 6-6 6" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

function CheckIcon({ color, size = 12, weight = 3.2 }: { color: string; size?: number; weight?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 12.5l4.5 4.5L19 7" stroke={color} strokeWidth={weight} strokeLinecap="round" strokeLinejoin="round" fill="none" />
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

/* ─────────────── Logos officiels ─────────────── */

function MtnLogo({ height }: { height: number }) {
  const w = height * 1.7;
  return (
    <View style={{ width: w, height, backgroundColor: MTN_YELLOW, borderRadius: R.cell, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={w * 0.78} height={w * 0.39} viewBox="0 0 1280 640">
        <Path d={MTN_LOGO_PATH} fill="#000000" />
      </Svg>
    </View>
  );
}

/** Le logo seul, sans nom tapé à côté. Sur fond sombre, le logo Orange (texte noir) est posé sur une plaque blanche de même hauteur que la tuile MTN. */
function OperatorLogo({ op, height, onDark }: { op: MobileMoneyOperator; height: number; onDark?: boolean }) {
  if (op.key === 'mtn') return <MtnLogo height={height} />;
  if (onDark) {
    const h = height - 6;
    return <View style={st.logoPlate}><Image src={orangeMoneyLogo} style={{ width: h * ORANGE_RATIO, height: h }} /></View>;
  }
  return <Image src={orangeMoneyLogo} style={{ width: height * ORANGE_RATIO, height }} />;
}

/* ─────────────── Éléments communs ─────────────── */

function Footer({ active, dark }: { active: SectionKey; dark?: boolean }) {
  const muted = dark ? ON_INK_SOFT : colors.muted;
  return (
    <View style={[st.footer, { borderTopColor: dark ? LINE_ON_INK : colors.border }]} fixed>
      <View style={st.way}>
        {ORDER.map((k) => {
          const on = active === k;
          return (
            <View key={k} style={st.wayItem}>
              <View style={[st.wayDot, { backgroundColor: on ? SECTION[k].color : dark ? LINE_ON_PANEL : '#dcd6e4' }]} />
              <Text style={[st.wayText, { color: on ? (dark ? WHITE : colors.text) : muted, fontWeight: on ? 800 : 500 }]}>{COPY.way[k]}</Text>
            </View>
          );
        })}
      </View>
      <Text style={[st.folio, { color: muted }]}>{SECTION[active].page} / {TOTAL}</Text>
    </View>
  );
}

function Hero({ section, eyebrow, word, en, sentence, needs }: { section: SectionKey; eyebrow: string; word: string; en?: string; sentence: string; needs: string }) {
  const s = SECTION[section];
  const onGold = section === 'preuve';
  return (
    <View id={section} style={[st.hero, { backgroundColor: s.color }]}>
      {s.n
        ? <Text style={[st.heroGhost, { color: WHITE, opacity: 0.13, right: section === 'flotte' ? 4 : -40 }]}>{s.n}</Text>
        : (
          <View style={st.heroGhostCheck}>
            <Svg width={260} height={260} viewBox="0 0 24 24">
              <Path d="M5 12.5l4.5 4.5L19 7" stroke={WHITE} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.22} />
            </Svg>
          </View>
        )}
      <View style={st.brandRow}>
        <View style={st.markDisc}><PdfLogo size={19} /></View>
        <Text style={[st.brandName, { color: s.ink }]}>{LEGAL_NAME}</Text>
      </View>
      <Text style={[st.eyebrow, { color: s.soft }]}>{eyebrow}</Text>
      <View style={st.titleRow}>
        <Text style={[st.heroWord, { color: s.ink }]}>{word}</Text>
        {en ? <Text style={[st.heroEn, { color: s.soft }]}>{en}</Text> : null}
      </View>
      <View style={st.heroBottom}>
        <Text style={[st.heroSentence, { color: s.ink }]}>{sentence}</Text>
        <View style={[st.needs, { backgroundColor: onGold ? INK : WHITE }]}>
          <Text style={[st.needsText, { color: onGold ? colors.gold : section === 'retrait' ? '#d8430a' : s.color }]}>{needs}</Text>
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

/* ─────────────── Page 1 · Couverture ─────────────── */

function PagePill({ page, color = INK, background = WHITE }: { page: number; color?: string; background?: string }) {
  return (
    <View style={[st.doorPage, { backgroundColor: background }]}>
      <Text style={[st.doorPageText, { color }]}>{COPY.cover.page} {page}</Text>
      <ArrowIcon color={color} size={9} />
    </View>
  );
}

function Door({ section, word, en, sentence }: { section: 'flotte' | 'retrait'; word: string; en: string; sentence: string }) {
  const s = SECTION[section];
  return (
    <Link src={`#${section}`} style={st.link}>
      <View style={[st.door, { backgroundColor: s.color }]}>
        <View style={st.doorLead}>
          <View style={st.doorDisc}><Text style={[st.doorDiscText, { color: s.color }]}>{s.n}</Text></View>
        </View>
        <View style={{ flex: 1 }}>
          <View style={st.doorWordRow}>
            <Text style={st.doorWord}>{word}</Text>
            <Text style={[st.doorEn, { color: s.soft }]}>{en}</Text>
          </View>
          <Text style={st.doorSentence}>{sentence}</Text>
        </View>
        <PagePill page={s.page} />
      </View>
    </Link>
  );
}

function Cover({ operators }: { operators: MobileMoneyOperator[] }) {
  return (
    <Page size="A4" style={[st.page, { backgroundColor: INK }]}>
      <View style={st.coverTop}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <PdfLogo size={30} />
          <Text style={st.coverBrand}>{LEGAL_NAME}</Text>
        </View>
        <Text style={st.coverFolio}>1 / {TOTAL}</Text>
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
        <Text style={st.choose}>{COPY.cover.choose}</Text>
        <Door section="flotte" word={COPY.flotte.word} en={COPY.flotte.en} sentence={COPY.flotte.sentence} />
        <View style={st.orRow}>
          <View style={st.orLine} />
          <View style={st.orDisc}><Text style={st.orText}>{COPY.cover.or}</Text></View>
          <View style={st.orLine} />
        </View>
        <Door section="retrait" word={COPY.retrait.word} en={COPY.retrait.en} sentence={COPY.retrait.sentence} />
        <Link src="#preuve" style={st.link}>
          <View style={st.proofDoor}>
            <View style={[st.doorLead, { width: 50 }]}>
              <View style={st.proofDisc}><CheckIcon color={INK} size={16} /></View>
            </View>
            <Text style={st.proofWord}>{COPY.cover.preuve}</Text>
            <PagePill page={SECTION.preuve.page} color={INK} background={colors.gold} />
          </View>
        </Link>
      </View>

      {/* La plaque blanche : les logos officiels sur leur fond d'origine, à la même hauteur. */}
      <View style={st.plate}>
        <Text style={st.label}>{COPY.cover.operators}</Text>
        <View style={st.plateLogos}>
          {operators.map((op) => <View key={op.key} style={st.plateCell}><OperatorLogo op={op} height={35.4} /></View>)}
        </View>
      </View>
    </Page>
  );
}

/* ─────────────── Page 2 · Flotte ─────────────── */

function FlotteCard({ op }: { op: MobileMoneyOperator }) {
  const groups = op.number.split(' ');
  return (
    <View style={st.card} wrap={false}>
      <View style={[st.cardHead, { borderBottomColor: colors.border, backgroundColor: '#fcfbfd' }]}>
        <OperatorLogo op={op} height={30} />
      </View>
      <View style={st.cardBody}>
        <Text style={st.label}>{COPY.flotte.number}</Text>
        {/* Le numéro en touches, larges comme leurs chiffres : on le recopie groupe par groupe. */}
        <View style={st.keys}>
          {groups.map((g, i) => (
            <View key={i} style={[st.key, { flexGrow: g.length, marginRight: i < groups.length - 1 ? 8 : 0 }]}>
              <Text style={st.keyText}>{g}</Text>
            </View>
          ))}
        </View>
        <Text style={[st.label, { marginTop: 14 }]}>{COPY.flotte.holder}</Text>
        <View style={st.holder}><Text style={st.holderText}>{op.holder}</Text></View>
      </View>
    </View>
  );
}

/* ─────────────── Page 3 · Retrait ─────────────── */

const CODE_SIZE = 28;

/** Chiffres, puis « * » et « # » agrandis et recentrés : ce sont les signes qu'on saute le plus facilement. */
function CodeText({ text }: { text: string }) {
  const parts = text.split(/([*#])/).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => (p === '*'
        ? <Text key={i} style={[st.digits, { fontSize: CODE_SIZE * 1.3, position: 'relative', top: CODE_SIZE * 0.2 }]}>*</Text>
        : <Text key={i} style={[st.digits, { fontSize: CODE_SIZE }]}>{p}</Text>))}
    </>
  );
}

function RetraitCard({ op }: { op: MobileMoneyOperator }) {
  const [before, after] = op.merchantCode.split('MONTANT');
  return (
    <View style={st.cardDark} wrap={false}>
      <View style={[st.cardHead, { borderBottomColor: LINE_ON_PANEL }]}>
        <OperatorLogo op={op} height={30} onDark />
      </View>
      <View style={st.cardBody}>
        <Text style={[st.label, { color: ON_INK_SOFT }]}>{COPY.retrait.code}</Text>
        {/* L'écran du téléphone : le code sur deux lignes, coupé juste avant MONTANT, puis « Appeler ». */}
        <View style={st.dial}>
          <View style={st.codeRow}><CodeText text={before} /></View>
          <View style={[st.codeRow, { marginTop: 6 }]}>
            <View style={st.amountBox}><Text style={[st.amountText, { fontSize: CODE_SIZE * 0.86 }]}>MONTANT</Text></View>
            <CodeText text={after} />
            <View style={st.call}><CallIcon size={18} /></View>
          </View>
        </View>
      </View>
    </View>
  );
}

/* ─────────────── Page 4 · Preuve ─────────────── */

/** Le contour d'un ticket : coins arrondis en haut, dents de scie en bas. */
function ticketPath(w: number, h: number, tooth: number): string {
  const r = R.box;
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
const TICKET_ROW = 58;

function Ticket() {
  const tooth = 9;
  const h = 66 + COPY.preuve.items.length * TICKET_ROW + 14 + tooth;
  return (
    <View style={{ width: CONTENT_W, height: h, position: 'relative', marginBottom: 10 }}>
      <Svg width={CONTENT_W} height={h} style={{ position: 'absolute', top: 0, left: 0 }}>
        <Path d={ticketPath(CONTENT_W, h, tooth)} fill="#f4f0f9" stroke="#d9d1e5" strokeWidth={1} />
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
  return (
    <Document title={`${COPY.docTitle} — ${LEGAL_NAME}`} author={LEGAL_NAME} creator={LEGAL_NAME} producer={LEGAL_NAME}>
      <Cover operators={operators} />

      <SectionPage section="flotte">
        <Hero section="flotte" eyebrow={COPY.flotte.eyebrow} word={COPY.flotte.word} en={COPY.flotte.en} sentence={COPY.flotte.sentence} needs={COPY.flotte.needs} />
        <View style={st.body}>
          {operators.map((op) => <FlotteCard key={op.key} op={op} />)}
          <View style={st.alert}>
            <View style={st.alertDisc}><Text style={st.alertMark}>!</Text></View>
            <Text style={st.alertText}>{COPY.flotte.check}</Text>
          </View>
        </View>
      </SectionPage>

      <SectionPage section="retrait" dark>
        <Hero section="retrait" eyebrow={COPY.retrait.eyebrow} word={COPY.retrait.word} en={COPY.retrait.en} sentence={COPY.retrait.sentence} needs={COPY.retrait.needs} />
        <View style={st.body}>
          {operators.map((op) => <RetraitCard key={op.key} op={op} />)}
          {/* Un exemple plutôt qu'une règle : MONTANT devient la somme, en chiffres collés. */}
          <View style={st.legend}>
            <View style={[st.amountBox, { marginRight: 0 }]}><Text style={[st.amountText, { fontSize: 13 }]}>MONTANT</Text></View>
            <View style={{ marginLeft: 10 }}><ArrowIcon color={WHITE} size={13} /></View>
            <View style={st.exampleBox}><Text style={st.exampleText}>{COPY.retrait.example}</Text></View>
            <Text style={st.legendText}>{COPY.retrait.legend}</Text>
          </View>
        </View>
      </SectionPage>

      <SectionPage section="preuve">
        <Hero section="preuve" eyebrow={COPY.preuve.eyebrow} word={COPY.preuve.word} sentence={COPY.preuve.sentence} needs={COPY.preuve.needs} />
        <View style={st.body}>
          <Ticket />
          <Text style={st.clear}>{COPY.preuve.clear}</Text>
        </View>
        <View style={st.thanks}>
          <View style={[st.markDisc, { width: 34, height: 34, borderRadius: 17, marginRight: 14 }]}><PdfLogo size={24} /></View>
          <View>
            <Text style={st.thanksText}>{COPY.preuve.thanks}</Text>
            <Text style={st.thanksSign}>{LEGAL_NAME}</Text>
          </View>
        </View>
      </SectionPage>
    </Document>
  );
}
