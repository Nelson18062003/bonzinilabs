// ============================================================
// LA FICHE « COORDONNÉES MOBILE MONEY » — un livret de quatre pages A4,
// émis par NORTON GAUSS BONZINI SARL, en français ET en anglais, en portrait
// ou en paysage. Une idée par page :
//   1 · Couverture : deux façons de payer, séparées par un « ou ».
//   2 · FLOTTE / FLOAT — page claire, violet : le numéro et le titulaire.
//   3 · RETRAIT / WITHDRAWAL — page sombre, orange : le code à composer.
//   4 · LA PREUVE / PROOF OF PAYMENT — page claire, or : ce que la capture
//       doit montrer.
// Portrait : bandeau de couleur en haut, opérateurs l'un sous l'autre.
// Paysage : une colonne de couleur à gauche (quelle façon, d'où, ce qu'il faut,
// et en bas la règle de la page), la zone de données à droite (Orange puis
// MTN, en blocs identiques) ; couverture avec les deux façons côte à côte.
// Lisible par tous, y compris sur un petit écran et par des yeux fatigués :
// aucun texte utile sous 11 pt, le numéro, le titulaire et le code en très
// gros. Le français d'abord, l'anglais juste dessous.
// Les logos sont les logos officiels des opérateurs. Aucun site, aucun plafond.
// ============================================================
import { Document, Page, View, Text as PdfText, Image, Link, Svg, Path, StyleSheet } from '@react-pdf/renderer';
import type { ComponentProps } from 'react';
import type { ReactNode } from 'react';
import type { Style } from '@react-pdf/types';
import { PdfLogo } from '../components/PDFHeader';
import { colors } from '../styles';
import '../fonts';
import { MOBILE_MONEY_GUIDE_COPY as COPY } from '@/lib/mobileMoneyGuide';
import type { Bi, GuideOrientation, MobileMoneyGuideData, MobileMoneyOperator } from '@/lib/mobileMoneyGuide';
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

const INK = colors.violetDark;
const WHITE = colors.white;
const CALL_GREEN = '#1faa59';
const TOTAL = 4;
const R = { box: 20, inner: 12, cell: 6 };
// Textes secondaires : plus foncés que le gris habituel, pour les yeux fatigués.
const MUTED = '#5f5775';
// Sur fond sombre : couleurs pleines pré-mélangées (react-pdf rend mal le rgba des bordures).
const PANEL = '#251a37';
const LINE_ON_INK = '#362d42';
const LINE_ON_PANEL = '#3a2f4b';
const OR_RING = '#5f586a';
const ON_INK_SOFT = '#d6d0e0';

/**
 * Tout texte de la fiche passe par ici : pas de césure. « BONZINI » ne devient
 * jamais « BONZI-NI » — on ne coupe qu'entre deux mots.
 */
const noHyphen = (word: string) => [word];
function Text(props: ComponentProps<typeof PdfText>) {
  return <PdfText hyphenationCallback={noHyphen} {...props} />;
}

/* ─────────────── Les deux mises en page ─────────────── */

interface Layout {
  o: GuideOrientation;
  W: number;
  H: number;
  /** Marge latérale. */
  M: number;
  /** Largeur utile. */
  CW: number;
  /** Cartes opérateur côte à côte (paysage) ou l'une sous l'autre (portrait). */
  columns: boolean;
  heroWord: number;
  heroEnWord: number;
  ghost: number;
  keys: number;
  holder: number;
  code: number;
  coverTitle: number;
  doorWord: number;
  doorEnWord: number;
}

const PORTRAIT: Layout = { o: 'portrait', W: 595.28, H: 841.89, M: 40, CW: 595.28 - 80, columns: false, heroWord: 54, heroEnWord: 28, ghost: 300, keys: 50, holder: 32, code: 36, coverTitle: 54, doorWord: 26, doorEnWord: 16 };
const LANDSCAPE: Layout = { o: 'landscape', W: 841.89, H: 595.28, M: 36, CW: 841.89 - 72, columns: false, heroWord: 46, heroEnWord: 22, ghost: 300, keys: 50, holder: 28, code: 36, coverTitle: 46, doorWord: 30, doorEnWord: 18 };

type SectionKey = 'flotte' | 'retrait' | 'preuve';
/** Une couleur par partie ; la couleur du français et de l'anglais posés dessus (contraste vérifié). */
const SECTION: Record<SectionKey, { n: string; color: string; fr: string; en: string; page: number }> = {
  flotte: { n: '1', color: colors.violet, fr: WHITE, en: WHITE, page: 2 },
  retrait: { n: '2', color: colors.orange, fr: WHITE, en: INK, page: 3 },
  preuve: { n: '3', color: colors.gold, fr: INK, en: INK, page: 4 },
};
const ORDER: SectionKey[] = ['flotte', 'retrait', 'preuve'];

const LABEL = { fontSize: 11, fontWeight: 800, letterSpacing: 1.4, textTransform: 'uppercase' } as const;

const st = StyleSheet.create({
  page: { padding: 0, fontFamily: 'DM Sans', color: colors.text },
  label: { ...LABEL, color: MUTED, marginBottom: 5 },

  // ── Bandeau de partie ──
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

  // ── Cartes opérateur ──
  card: { backgroundColor: WHITE, borderWidth: 1, borderColor: colors.border, borderRadius: R.box, overflow: 'hidden' },
  cardDark: { backgroundColor: PANEL, borderWidth: 1, borderColor: LINE_ON_PANEL, borderRadius: R.box, overflow: 'hidden' },
  cardHead: { height: 48, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, borderBottomWidth: 1 },
  cardBody: { paddingTop: 11, paddingBottom: 12, paddingHorizontal: 18 },
  opMark: { flexDirection: 'row', alignItems: 'center' },
  opName: { fontSize: 15, fontWeight: 800, marginLeft: 10 },
  logoPlate: { backgroundColor: WHITE, borderRadius: R.cell, paddingVertical: 3, paddingHorizontal: 7 },
  kind: { borderRadius: R.inner, backgroundColor: colors.violetLight, paddingVertical: 5, paddingHorizontal: 12, alignItems: 'flex-end' },
  kindFr: { fontSize: 12.5, fontWeight: 800, color: '#7b2fd0', letterSpacing: 1, textTransform: 'uppercase' },
  kindEn: { fontSize: 11, fontWeight: 600, color: '#7b2fd0', letterSpacing: 0.6, textTransform: 'uppercase' },

  // ── Flotte ──
  keys: { flexDirection: 'row' },
  key: { flexBasis: 0, alignItems: 'center', backgroundColor: '#f5f2f9', borderWidth: 1, borderColor: '#e2d9ee', borderRadius: R.inner, paddingTop: 2, paddingBottom: 0 },
  keyText: { fontWeight: 900, color: INK, letterSpacing: 1.2, lineHeight: 1.15 },
  holder: { alignSelf: 'flex-start', borderWidth: 2, borderColor: colors.violet, backgroundColor: colors.violetLight, borderRadius: R.inner, paddingVertical: 5, paddingHorizontal: 10 },
  holderText: { fontWeight: 900, color: INK, letterSpacing: 0, lineHeight: 1.15 },
  alert: { flexDirection: 'row', alignItems: 'center', borderRadius: R.inner, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: colors.violetLight },
  alertDisc: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  alertMark: { fontSize: 17, fontWeight: 900, color: WHITE, lineHeight: 1 },
  alertFr: { fontSize: 16, fontWeight: 800, color: INK },
  alertEn: { fontSize: 14, fontWeight: 500, color: MUTED, marginTop: 1 },

  // ── Retrait ──
  dial: { backgroundColor: WHITE, borderRadius: R.inner, paddingVertical: 12, paddingLeft: 14, paddingRight: 12 },
  codeRow: { flexDirection: 'row', alignItems: 'center' },
  digits: { fontWeight: 800, color: INK, letterSpacing: 0.4, lineHeight: 1.2 },
  amountBox: { backgroundColor: colors.orange, borderRadius: R.cell, paddingTop: 2, paddingBottom: 1, paddingHorizontal: 6, marginRight: 3 },
  amountText: { fontWeight: 900, color: WHITE, letterSpacing: 0.6 },
  call: { width: 40, height: 40, borderRadius: 20, backgroundColor: CALL_GREEN, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },
  legend: { flexDirection: 'row', alignItems: 'center', borderRadius: R.inner, paddingVertical: 11, paddingHorizontal: 16, backgroundColor: PANEL, borderWidth: 1, borderColor: LINE_ON_PANEL },
  legendFr: { fontSize: 16, fontWeight: 800, color: WHITE },
  legendEn: { fontSize: 14, fontWeight: 500, color: ON_INK_SOFT, marginTop: 1 },

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
  plateLogos: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
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

function CheckIcon({ color, size = 12 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 12.5l4.5 4.5L19 7" stroke={color} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

/** Le combiné du bouton « Appeler » : on compose le code, puis on appelle. */
function CallIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={WHITE} d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
    </Svg>
  );
}

/** L'exemple de montant : MONTANT devient 50000, en chiffres collés. */
function ExampleBox({ size, outlined }: { size: number; outlined?: boolean }) {
  return (
    <View style={[{ backgroundColor: WHITE, borderRadius: R.cell, paddingHorizontal: 7, paddingTop: 2, paddingBottom: 1 }, outlined ? { borderWidth: 1.5, borderColor: INK } : {}]}>
      <Text style={{ fontSize: size, fontWeight: 900, color: INK, letterSpacing: 0.6 }}>{COPY.retrait.example}</Text>
    </View>
  );
}

/** « NUMÉRO · NUMBER » : une étiquette dans les deux langues, sur une ligne. */
function biLabel(b: Bi): string {
  return b.fr.toLowerCase() === b.en.toLowerCase() ? b.fr : `${b.fr} · ${b.en}`;
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

/** Le logo officiel, et le nom quand le logo ne le porte pas (MTN). Sur fond sombre, le logo Orange (texte noir) est posé sur une plaque blanche. */
function OperatorMark({ op, height, onDark }: { op: MobileMoneyOperator; height: number; onDark?: boolean }) {
  let logo: ReactNode;
  if (op.key === 'mtn') logo = <MtnLogo height={height} />;
  else if (onDark) logo = <View style={st.logoPlate}><Image src={orangeMoneyLogo} style={{ width: (height - 6) * ORANGE_RATIO, height: height - 6 }} /></View>;
  else logo = <Image src={orangeMoneyLogo} style={{ width: height * ORANGE_RATIO, height }} />;
  return (
    <View style={st.opMark}>
      {logo}
      {op.key === 'mtn' ? <Text style={[st.opName, { color: onDark ? WHITE : colors.text }]}>{op.name}</Text> : null}
    </View>
  );
}

/* ─────────────── Éléments communs ─────────────── */

function Footer({ inset, active, dark }: { inset: number; active: SectionKey; dark?: boolean }) {
  const muted = dark ? ON_INK_SOFT : MUTED;
  return (
    <View style={[st.footer, { left: inset, right: inset, borderTopColor: dark ? LINE_ON_INK : colors.border }]} fixed>
      <Text style={[st.footerText, { color: muted }]}>{LEGAL_NAME}</Text>
      <View style={st.way}>
        {ORDER.map((k) => {
          const on = active === k;
          return (
            <View key={k} style={st.wayItem}>
              <View style={[st.wayDot, { backgroundColor: on ? SECTION[k].color : dark ? LINE_ON_PANEL : '#d6cfe0' }]} />
              <Text style={[st.wayText, { color: on ? (dark ? WHITE : INK) : muted, fontWeight: on ? 800 : 500 }]}>{biLabel(COPY.way[k])}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function NeedsPill({ section, needs }: { section: SectionKey; needs: Bi }) {
  const onGold = section === 'preuve';
  const bg = onGold ? INK : WHITE;
  const fg = onGold ? colors.gold : section === 'retrait' ? '#c53d06' : '#7b2fd0';
  return (
    <View style={[st.needs, { backgroundColor: bg }]}>
      <Text style={[st.needsFr, { color: fg }]}>{needs.fr}</Text>
      <Text style={[st.needsEn, { color: fg }]}>{needs.en}</Text>
    </View>
  );
}

/** Portrait : le bandeau de couleur en haut de page. */
function Hero({ L, section, eyebrow, word, sentence, needs }: { L: Layout; section: SectionKey; eyebrow: Bi; word: Bi; sentence: Bi; needs: Bi }) {
  const s = SECTION[section];
  return (
    <View id={section} style={[st.hero, { backgroundColor: s.color, paddingHorizontal: L.M, paddingTop: 16, paddingBottom: 14 }]}>
      <Text style={[st.heroGhost, { fontSize: L.ghost, right: section === 'flotte' ? 4 : -40, top: -80, opacity: section === 'preuve' ? 0.22 : 0.16 }]}>{s.n}</Text>
      <View style={[st.heroTop, { marginBottom: 12 }]}>
        <View style={st.brandRow}>
          <View style={st.markDisc}><PdfLogo size={19} /></View>
          <Text style={[st.brandName, { color: s.fr }]}>{LEGAL_NAME}</Text>
        </View>
        <Text style={[st.folio, { color: s.en }]}>{s.page} / {TOTAL}</Text>
      </View>
      <Text style={[st.eyebrow, { color: s.en }]}>{biLabel(eyebrow)}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <Text style={[st.heroWord, { color: s.fr, fontSize: L.heroWord, marginRight: 14 }]}>{word.fr}</Text>
        <Text style={[st.heroEnWord, { color: s.en, fontSize: L.heroEnWord, marginBottom: L.heroWord * 0.06 }]}>{word.en}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 8 }}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={[st.sentenceFr, { color: s.fr }]}>{sentence.fr}</Text>
          <Text style={[st.sentenceEn, { color: s.en }, section === 'flotte' ? st.sentenceEnOnViolet : {}]}>{sentence.en}</Text>
        </View>
        <NeedsPill section={section} needs={needs} />
      </View>
    </View>
  );
}

function SectionPage({ L, section, dark, children }: { L: Layout; section: SectionKey; dark?: boolean; children: ReactNode }) {
  return (
    <Page size="A4" orientation={L.o} style={[st.page, { backgroundColor: dark ? INK : WHITE }]}>
      {children}
      <Footer inset={L.M} active={section} dark={dark} />
    </Page>
  );
}

/** Les deux cartes opérateur, l'une sous l'autre (Orange puis MTN), à l'identique. */
function OperatorStack({ children, gap = 10 }: { children: ReactNode[]; gap?: number }) {
  return <View>{children.map((c, i) => <View key={i} style={{ marginTop: i ? gap : 0 }}>{c}</View>)}</View>;
}

/* ─────────────── Page 1 · Couverture ─────────────── */

function PagePill({ page, color = INK, background = WHITE }: { page: number; color?: string; background?: string }) {
  return (
    <View style={[st.doorPage, { backgroundColor: background }]}>
      <Text style={[st.doorPageText, { color }]}>{COPY.page.fr} {page}</Text>
      <ArrowIcon color={color} size={10} />
    </View>
  );
}

function Door({ L, section, word, sentence }: { L: Layout; section: 'flotte' | 'retrait'; word: Bi; sentence: Bi }) {
  const s = SECTION[section];
  return (
    <Link src={`#${section}`} style={st.link}>
      <View style={[st.door, { backgroundColor: s.color }]}>
        <View style={st.doorDisc}><Text style={[st.doorDiscText, { color: s.color }]}>{s.n}</Text></View>
        <View style={{ flex: 1 }}>
          <View style={st.doorWordRow}>
            <Text style={[st.doorWord, { fontSize: L.doorWord }]}>{word.fr}</Text>
            <Text style={[st.doorEnWord, { color: s.en, fontSize: L.doorEnWord }]}>{word.en}</Text>
          </View>
          <Text style={st.doorFr}>{sentence.fr}</Text>
          <Text style={[st.doorEn, { color: s.en }, section === 'flotte' ? { fontSize: 14, fontWeight: 700 } : {}]}>{sentence.en}</Text>
        </View>
        <PagePill page={s.page} />
      </View>
    </Link>
  );
}

function CoverDoors({ L }: { L: Layout }) {
  return (
    <View>
      <Door L={L} section="flotte" word={COPY.flotte.word} sentence={COPY.cover.flotte} />
      <View style={st.orRow}>
        <View style={st.orLine} />
        <View style={st.orDisc}>
          <Text style={st.orFr}>{COPY.cover.or.fr}</Text>
          <Text style={st.orEn}>{COPY.cover.or.en}</Text>
        </View>
        <View style={st.orLine} />
      </View>
      <Door L={L} section="retrait" word={COPY.retrait.word} sentence={COPY.cover.retrait} />
      <View style={{ marginTop: 10, marginBottom: 12 }}>
        <Text style={st.chooseFr}>{COPY.cover.choose.fr}</Text>
        <Text style={st.chooseEn}>{COPY.cover.choose.en}</Text>
      </View>
      <Link src="#preuve" style={st.link}>
        <View style={st.proofDoor}>
          <View style={[st.proofDisc, { marginLeft: 5, marginRight: 19 }]}><Text style={st.proofDiscText}>{SECTION.preuve.n}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={st.proofFr}>{COPY.cover.preuve.fr}</Text>
            <Text style={st.proofEn}>{COPY.cover.preuve.en}</Text>
          </View>
          <PagePill page={SECTION.preuve.page} color={INK} background={colors.gold} />
        </View>
      </Link>
    </View>
  );
}

function CoverTitles({ L }: { L: Layout }) {
  return (
    <View>
      <Text style={st.coverKicker}>{biLabel(COPY.cover.kicker)}</Text>
      <Text style={st.coverTitleTop}>{COPY.titleTop.fr} <Text style={{ color: '#a79fb6' }}>/ {COPY.titleTop.en}</Text></Text>
      <Text style={[st.coverTitleBottom, { fontSize: L.coverTitle }]}>{COPY.titleBottom}</Text>
      <View style={{ marginTop: L.o === 'portrait' ? 22 : 18 }}>
        <Text style={st.leadFr}>{COPY.cover.lead.fr}</Text>
        <Text style={st.leadEn}>{COPY.cover.lead.en}</Text>
      </View>
    </View>
  );
}

/** La plaque blanche : les logos officiels sur leur fond d'origine. */
function LogosPlate({ L, operators, height }: { L: Layout; operators: MobileMoneyOperator[]; height: number }) {
  return (
    <View style={[st.plate, { height, paddingHorizontal: L.M, paddingTop: 20 }]}>
      <Text style={st.label}>{biLabel(COPY.cover.operators)}</Text>
      <View style={st.plateLogos}>
        {operators.map((op) => <View key={op.key} style={{ width: L.CW / (L.columns ? 3 : 2) }}><OperatorMark op={op} height={36} /></View>)}
      </View>
    </View>
  );
}

function CoverBrand({ L }: { L: Layout }) {
  return (
    <>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <PdfLogo size={30} />
          <Text style={st.coverBrand}>{LEGAL_NAME}</Text>
        </View>
        <Text style={st.coverFolio}>1 / {TOTAL}</Text>
      </View>
      {/* Le code couleur du livret, annoncé d'un trait : Flotte · Retrait · Preuve. */}
      <View style={[st.stripe, { marginTop: L.o === 'portrait' ? 16 : 12 }]}>
        {ORDER.map((k, i) => <View key={k} style={[st.stripeSeg, { backgroundColor: SECTION[k].color, marginLeft: i ? 5 : 0 }]} />)}
      </View>
    </>
  );
}

function Cover({ L, operators }: { L: Layout; operators: MobileMoneyOperator[] }) {
  if (L.o === 'portrait') {
    return (
      <Page size="A4" orientation="portrait" style={[st.page, { backgroundColor: INK }]}>
        <View style={{ paddingHorizontal: L.M, paddingTop: 32 }}>
          <CoverBrand L={L} />
          <View style={{ marginTop: 28 }}><CoverTitles L={L} /></View>
          <View style={{ marginTop: 18 }}><CoverDoors L={L} /></View>
        </View>
        <LogosPlate L={L} operators={operators} height={104} />
      </Page>
    );
  }
  return <CoverLandscape L={L} operators={operators} />;
}

/* ─────────────── Page 2 · Flotte ─────────────── */

function FlotteCard({ L, op }: { L: Layout; op: MobileMoneyOperator }) {
  const groups = op.number.split(' ');
  return (
    <View style={[st.card, { flexGrow: 1 }]} wrap={false}>
      <View style={[st.cardHead, { borderBottomColor: colors.border, backgroundColor: '#fcfbfd' }]}>
        <OperatorMark op={op} height={32} />
        <View style={st.kind}>
          <Text style={st.kindFr}>{op.account.fr}</Text>
          <Text style={st.kindEn}>{op.account.en}</Text>
        </View>
      </View>
      <View style={st.cardBody}>
        <Text style={st.label}>{biLabel(COPY.flotte.number)}</Text>
        {/* Le numéro en touches, larges comme leurs chiffres : on le recopie groupe par groupe. */}
        <View style={st.keys}>
          {groups.map((g, i) => (
            <View key={i} style={[st.key, { flexGrow: g.length, marginRight: i < groups.length - 1 ? 8 : 0 }]}>
              <Text style={[st.keyText, { fontSize: L.keys, position: 'relative', top: -L.keys * 0.078 }]}>{g}</Text>
            </View>
          ))}
        </View>
        <Text style={[st.label, { marginTop: 8 }]}>{biLabel(COPY.flotte.holder)}</Text>
        <View style={st.holder}><Text style={[st.holderText, { fontSize: L.holder }]}>{L.o === 'portrait' ? balanced(op.holder, L.holder, L.CW - 70, 0.66) : op.holder}</Text></View>
      </View>
    </View>
  );
}

/* ─────────────── Page 3 · Retrait ─────────────── */

/**
 * Le code, coupé en lignes après un « * » pour tenir dans l'écran sans
 * rapetisser. Largeurs estimées (DM Sans 800) : chiffre 0,6 em, « # » 0,64 em,
 * « * » agrandi 0,58 em, la case MONTANT ≈ 4,35 em + ses marges ; 7 % de marge
 * de sécurité. MONTANT et le « # » final ne sont jamais séparés.
 */
type CodePiece = { kind: 'text'; text: string } | { kind: 'amount'; after: string };

function textWidth(t: string, size: number): number {
  let em = 0;
  for (const ch of t) em += ch === '*' ? 0.58 : ch === '#' ? 0.64 : 0.6;
  return em * size * 1.07;
}

function pieceWidth(p: CodePiece, size: number): number {
  if (p.kind === 'text') return textWidth(p.text, size);
  return 7 * 0.72 * 0.86 * size * 1.07 + 12 + 3 + textWidth(p.after, size);
}

function codeLines(code: string, size: number, room: number, callRoom: number): CodePiece[][] {
  const [before, after] = code.split('MONTANT');
  const pieces: CodePiece[] = [...(before.match(/[^*]*\*|[^*]+$/g) ?? []).map((t) => ({ kind: 'text' as const, text: t })), { kind: 'amount', after }];
  const lines: CodePiece[][] = [];
  let cur: CodePiece[] = [];
  let w = 0;
  pieces.forEach((p, i) => {
    const pw = pieceWidth(p, size) + (i === pieces.length - 1 ? callRoom : 0);
    if (cur.length && w + pw > room) { lines.push(cur); cur = []; w = 0; }
    cur.push(p);
    w += pieceWidth(p, size);
  });
  if (cur.length) lines.push(cur);
  return lines;
}

/** Chiffres, puis « * » agrandis et recentrés : ce sont les signes qu'on saute le plus facilement. */
function CodeText({ text, size }: { text: string; size: number }) {
  const parts = text.split(/([*])/).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => (p === '*'
        ? <Text key={i} style={[st.digits, { fontSize: size * 1.3, lineHeight: 0.8, position: 'relative', top: -size * 0.03 }]}>*</Text>
        : <Text key={i} style={[st.digits, { fontSize: size }]}>{p}</Text>))}
    </>
  );
}

function RetraitCard({ L, op, room }: { L: Layout; op: MobileMoneyOperator; room: number }) {
  const lines = codeLines(op.merchantCode, L.code, room, 52);
  return (
    <View style={[st.cardDark, { flexGrow: 1 }]} wrap={false}>
      <View style={[st.cardHead, { borderBottomColor: LINE_ON_PANEL }]}>
        <OperatorMark op={op} height={32} onDark />
      </View>
      <View style={st.cardBody}>
        <Text style={[st.label, { color: ON_INK_SOFT }]}>{COPY.retrait.code.fr}</Text>
        {/* L'écran du téléphone : le code, MONTANT en orange, puis « Appeler ». */}
        <View style={st.dial}>
          {lines.map((line, li) => (
            <View key={li} style={[st.codeRow, { marginTop: li ? 6 : 0 }]}>
              {line.map((p, pi) => (p.kind === 'text'
                ? <CodeText key={pi} text={p.text} size={L.code} />
                : (
                  <View key={pi} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={st.amountBox}><Text style={[st.amountText, { fontSize: L.code * 0.86 }]}>MONTANT</Text></View>
                    <CodeText text={p.after} size={L.code} />
                  </View>
                )))}
              {li === lines.length - 1 ? <View style={st.call}><CallIcon size={19} /></View> : null}
            </View>
          ))}
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

const PROOF_BAR_W = [70, 110, 90, 60];

function Ticket({ width, rowH }: { width: number; rowH: number }) {
  const tooth = 9;
  const h = 60 + COPY.preuve.items.length * rowH + 14 + tooth;
  return (
    <View style={{ width, height: h, position: 'relative' }}>
      <Svg width={width} height={h} style={{ position: 'absolute', top: 0, left: 0 }}>
        <Path d={ticketPath(width, h, tooth)} fill="#f4f0f9" stroke="#d9d1e5" strokeWidth={1} />
      </Svg>
      <View style={st.ticketHead}>
        <View style={st.ticketOk}><CheckIcon color={WHITE} size={15} /></View>
        <View>
          <View style={st.barA} />
          <View style={st.barB} />
        </View>
        <View style={st.ticketTag}>
          <Text style={[st.label, { marginBottom: 0 }]}>{COPY.preuve.shot.fr}</Text>
          <Text style={[st.label, { marginBottom: 0, fontSize: 11, fontWeight: 700 }]}>{COPY.preuve.shot.en}</Text>
        </View>
      </View>
      {COPY.preuve.items.map((item, i) => (
        <View key={item.fr} style={[st.ticketRow, { height: rowH }]}>
          <View style={st.goldCheck}><CheckIcon color={INK} size={14} /></View>
          <View>
            <Text style={st.itemFr}>{item.fr}</Text>
            <Text style={st.itemEn}>{item.en}</Text>
          </View>
          <View style={[st.ticketBar, { width: PROOF_BAR_W[i] }]} />
        </View>
      ))}
    </View>
  );
}

function ClearLine() {
  return (
    <View style={[st.clearRow, { paddingHorizontal: 20 }]}>
      <View style={st.goldCheck}><CheckIcon color={INK} size={14} /></View>
      <View style={{ flex: 1 }}>
        <Text style={st.clearFr}>{COPY.preuve.clear.fr}</Text>
        <Text style={st.clearEn}>{COPY.preuve.clear.en}</Text>
      </View>
    </View>
  );
}

function Thanks() {
  return (
    <View style={st.thanks}>
      <View style={[st.markDisc, { width: 38, height: 38, borderRadius: 19, marginRight: 16 }]}><PdfLogo size={26} /></View>
      <View style={{ flex: 1 }}>
        <Text style={st.thanksFr}>{COPY.preuve.thanks.fr}</Text>
        <Text style={st.thanksEn}>{COPY.preuve.thanks.en}</Text>
        <Text style={st.thanksSign}>{LEGAL_NAME}</Text>
      </View>
    </View>
  );
}

/* ─────────────── PAYSAGE : colonne de couleur + zone de données ─────────────── */

const SIDE_W = 280;
const SIDE_PAD = 24;
const AREA_PAD = 30;
const AREA_W = LANDSCAPE.W - SIDE_W - 2 * AREA_PAD;

const ls = StyleSheet.create({
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
  // Couverture
  doorTall: { borderRadius: R.box, paddingVertical: 16, paddingHorizontal: 18 },
  doorTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
});

/**
 * Coupures choisies pour la colonne étroite : une phrase trop longue pour une
 * ligne se coupe en deux lignes équilibrées — après « ? » ou à la virgule la
 * plus centrale s'il y en a, sinon à l'espace le plus central — et « Mobile
 * Money » ne se sépare jamais.
 */
function balanced(text: string, size: number, room: number, em = 0.54): string {
  const keep = text.replace(/Mobile Money/g, 'Mobile\u00A0Money');
  if (keep.length * size * em <= room) return keep;
  const mid = keep.length / 2;
  const pick = (re: RegExp) => {
    let best = -1;
    for (const m of keep.matchAll(re)) {
      const at = (m.index ?? 0) + m[0].length - 1;
      if (best < 0 || Math.abs(at - mid) < Math.abs(best - mid)) best = at;
    }
    return best;
  };
  const at = [pick(/\? /g), pick(/, /g), pick(/ /g)].find((i) => i > 0) ?? -1;
  return at > 0 ? `${keep.slice(0, at)}\n${keep.slice(at + 1)}` : keep;
}

/** Un titre en capitales ajusté à la largeur de la colonne (jamais au-delà de `max`). */
function fitSize(word: string, max: number, room: number, em: number): number {
  return Math.min(max, Math.floor((room / (word.length * em)) * 10) / 10);
}

/** La colonne de couleur : quelle façon, d'où, ce qu'il faut ; en bas, la règle de la page. */
function Sidebar({ section, eyebrow, word, sentence, needs, rule }: { section: SectionKey; eyebrow: Bi; word: Bi; sentence: Bi; needs: Bi; rule: ReactNode }) {
  const s = SECTION[section];
  const room = SIDE_W - 2 * SIDE_PAD;
  return (
    <View id={section} style={[ls.side, { backgroundColor: s.color }]}>
      <Text style={[ls.sideGhost, { opacity: section === 'preuve' ? 0.18 : 0.1 }]}>{s.n}</Text>
      <View style={st.brandRow}>
        <View style={[st.markDisc, { width: 26, height: 26, borderRadius: 13, marginRight: 8 }]}><PdfLogo size={18} /></View>
        <Text style={[ls.sideBrand, { color: s.fr }]}>{LEGAL_NAME}</Text>
      </View>
      <View style={{ marginTop: 34 }}>
        <Text style={[ls.sideEyebrow, { color: s.en }]}>{eyebrow.fr}</Text>
        <Text style={[ls.sideEyebrowEn, { color: s.en }]}>{eyebrow.en}</Text>
        <Text style={[ls.sideWord, { color: s.fr, fontSize: fitSize(word.fr, 46, room, 0.66) }]}>{word.fr}</Text>
        <Text style={[ls.sideEnWord, { color: s.en, fontSize: fitSize(word.en, 22, room, 0.74) }]}>{word.en}</Text>
        <Text style={[ls.sideSentenceFr, { color: s.fr }]}>{balanced(sentence.fr, 15, room)}</Text>
        <Text style={[ls.sideSentenceEn, { color: s.en }, section === 'flotte' ? { fontSize: 14, fontWeight: 700 } : {}]}>{balanced(sentence.en, section === 'flotte' ? 14 : 13, room, 0.5)}</Text>
        <View style={{ marginTop: 14, alignSelf: 'flex-start' }}><NeedsPill section={section} needs={needs} /></View>
      </View>
      <View style={{ marginTop: 'auto' }}>
        <View style={ls.rule}>{rule}</View>
        <Text style={[ls.sideFolio, { color: s.en }]}>{s.page} / {TOTAL}</Text>
      </View>
    </View>
  );
}

function LandscapePage({ section, dark, sidebar, children }: { section: SectionKey; dark?: boolean; sidebar: ReactNode; children: ReactNode }) {
  return (
    <Page size="A4" orientation="landscape" style={[st.page, { flexDirection: 'row', backgroundColor: dark ? INK : WHITE }]}>
      {sidebar}
      <View style={ls.area}>
        {children}
        <Footer inset={AREA_PAD} active={section} dark={dark} />
      </View>
    </Page>
  );
}

/** Une règle de page, en français puis en anglais, avec son repère visuel à gauche. */
function RuleText({ text, lead }: { text: Bi; lead: ReactNode }) {
  return (
    <View style={ls.ruleRow}>
      {lead}
      <View style={{ flex: 1 }}>
        <Text style={ls.ruleFr}>{balanced(text.fr, 14, 0)}</Text>
        <Text style={ls.ruleEn}>{balanced(text.en, 12.5, 0)}</Text>
      </View>
    </View>
  );
}

function DoorTall({ L, section, word, sentence }: { L: Layout; section: 'flotte' | 'retrait'; word: Bi; sentence: Bi }) {
  const s = SECTION[section];
  return (
    <Link src={`#${section}`} style={st.link}>
      <View style={[ls.doorTall, { backgroundColor: s.color }]}>
        <View style={ls.doorTop}>
          <View style={[st.doorDisc, { width: 42, height: 42, borderRadius: 21, marginRight: 0 }]}><Text style={[st.doorDiscText, { color: s.color }]}>{s.n}</Text></View>
          <PagePill page={s.page} />
        </View>
        <View style={st.doorWordRow}>
          <Text style={[st.doorWord, { fontSize: L.doorWord }]}>{word.fr}</Text>
          <Text style={[st.doorEnWord, { color: s.en, fontSize: L.doorEnWord, marginBottom: 0 }]}>{word.en}</Text>
        </View>
        <Text style={[st.doorFr, { fontSize: 15 }]}>{sentence.fr}</Text>
        <Text style={[st.doorEn, { color: s.en, fontSize: section === 'flotte' ? 14 : 13.5, fontWeight: section === 'flotte' ? 700 : 500 }]}>{sentence.en}</Text>
      </View>
    </Link>
  );
}

function CoverLandscape({ L, operators }: { L: Layout; operators: MobileMoneyOperator[] }) {
  return (
    <Page size="A4" orientation="landscape" style={[st.page, { backgroundColor: INK }]}>
      <View style={{ paddingHorizontal: L.M, paddingTop: 24 }}>
        <CoverBrand L={L} />
        {/* Le titre à gauche, la phrase d'entrée à droite, sur la même ligne de pied. */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 16 }}>
          <View>
            <Text style={[st.coverKicker, { marginBottom: 8 }]}>{biLabel(COPY.cover.kicker)}</Text>
            <Text style={st.coverTitleTop}>{COPY.titleTop.fr} <Text style={{ color: '#a79fb6' }}>/ {COPY.titleTop.en}</Text></Text>
            <Text style={[st.coverTitleBottom, { fontSize: L.coverTitle }]}>{COPY.titleBottom}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', marginBottom: -1.75 }}>
            <Text style={[st.leadFr, { textAlign: 'right' }]}>{COPY.cover.lead.fr}</Text>
            <Text style={[st.leadEn, { textAlign: 'right' }]}>{COPY.cover.lead.en}</Text>
          </View>
        </View>
        {/* Les deux façons, côte à côte, séparées par « ou / or ». */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16 }}>
          <View style={{ flex: 1 }}><DoorTall L={L} section="flotte" word={COPY.flotte.word} sentence={COPY.cover.flotte} /></View>
          <View style={{ width: 62, alignItems: 'center' }}>
            <View style={[st.orDisc, { marginHorizontal: 0 }]}>
              <Text style={st.orFr}>{COPY.cover.or.fr}</Text>
              <Text style={st.orEn}>{COPY.cover.or.en}</Text>
            </View>
          </View>
          <View style={{ flex: 1 }}><DoorTall L={L} section="retrait" word={COPY.retrait.word} sentence={COPY.cover.retrait} /></View>
        </View>
        <View style={{ marginTop: 8, marginBottom: 8 }}>
          <Text style={st.chooseFr}>{COPY.cover.choose.fr}</Text>
          <Text style={st.chooseEn}>{COPY.cover.choose.en}</Text>
        </View>
        <Link src="#preuve" style={st.link}>
          <View style={[st.proofDoor, { paddingVertical: 10 }]}>
            <View style={[st.proofDisc, { width: 36, height: 36, borderRadius: 18 }]}><Text style={st.proofDiscText}>{SECTION.preuve.n}</Text></View>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={st.proofFr}>{COPY.cover.preuve.fr}</Text>
              <Text style={[st.proofEn, { marginLeft: 12, marginTop: 0 }]}>{COPY.cover.preuve.en}</Text>
            </View>
            <PagePill page={SECTION.preuve.page} color={INK} background={colors.gold} />
          </View>
        </Link>
      </View>
      <LogosPlate L={L} operators={operators} height={104} />
    </Page>
  );
}

/* ─────────────── Le document ─────────────── */

export function MobileMoneyGuidePDF({ data, orientation = 'portrait' }: { data: MobileMoneyGuideData; orientation?: GuideOrientation }) {
  const { operators } = data;
  return (
    <Document title={`${COPY.docTitle.fr} · ${COPY.docTitle.en} — ${LEGAL_NAME}`} subject={COPY.docTitle.en} author={LEGAL_NAME} creator={LEGAL_NAME} producer={LEGAL_NAME}>
      {orientation === 'landscape' ? <LandscapePages operators={operators} /> : <PortraitPages operators={operators} />}
    </Document>
  );
}

function PortraitPages({ operators }: { operators: MobileMoneyOperator[] }) {
  const L = PORTRAIT;
  const body: Style = { paddingHorizontal: L.M, paddingTop: 12 };
  // Place du code dans l'écran : largeur de la carte, moins ses marges et celles de l'écran.
  const codeRoom = L.CW - 2 * 18 - 14 - 12 - 2;
  return (
    <>
      <Cover L={L} operators={operators} />

      <SectionPage L={L} section="flotte">
        <Hero L={L} section="flotte" eyebrow={COPY.flotte.eyebrow} word={COPY.flotte.word} sentence={COPY.flotte.sentence} needs={COPY.flotte.needs} />
        <View style={body}>
          <OperatorStack>{operators.map((op) => <FlotteCard key={op.key} L={L} op={op} />)}</OperatorStack>
          <View style={[st.alert, { marginTop: 10 }]}>
            <View style={st.alertDisc}><Text style={st.alertMark}>!</Text></View>
            <View>
              <Text style={st.alertFr}>{COPY.flotte.check.fr}</Text>
              <Text style={st.alertEn}>{COPY.flotte.check.en}</Text>
            </View>
          </View>
        </View>
      </SectionPage>

      <SectionPage L={L} section="retrait" dark>
        <Hero L={L} section="retrait" eyebrow={COPY.retrait.eyebrow} word={COPY.retrait.word} sentence={COPY.retrait.sentence} needs={COPY.retrait.needs} />
        <View style={body}>
          <OperatorStack>{operators.map((op) => <RetraitCard key={op.key} L={L} op={op} room={codeRoom} />)}</OperatorStack>
          <View style={[st.legend, { marginTop: 10 }]}>
            <View style={[st.amountBox, { marginRight: 0 }]}><Text style={[st.amountText, { fontSize: 14 }]}>MONTANT</Text></View>
            <View style={{ marginLeft: 10, marginRight: 10 }}><ArrowIcon color={WHITE} size={14} /></View>
            <ExampleBox size={14} />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={[st.legendFr, { fontSize: 15 }]}>{COPY.retrait.legend.fr}</Text>
              <Text style={[st.legendEn, { fontSize: 13 }]}>{COPY.retrait.legend.en}</Text>
            </View>
          </View>
        </View>
      </SectionPage>

      <SectionPage L={L} section="preuve">
        <Hero L={L} section="preuve" eyebrow={COPY.preuve.eyebrow} word={COPY.preuve.word} sentence={COPY.preuve.sentence} needs={COPY.preuve.needs} />
        <View style={body}>
          <Ticket width={L.CW} rowH={60} />
          <View style={{ marginTop: 12 }}><ClearLine /></View>
        </View>
        <View style={{ position: 'absolute', left: L.M, right: L.M, bottom: 70 }}><Thanks /></View>
      </SectionPage>
    </>
  );
}

function LandscapePages({ operators }: { operators: MobileMoneyOperator[] }) {
  const L = LANDSCAPE;
  const codeRoom = AREA_W - 2 * 18 - 14 - 12 - 2;
  return (
    <>
      <Cover L={L} operators={operators} />

      <LandscapePage
        section="flotte"
        sidebar={(
          <Sidebar
            section="flotte" eyebrow={COPY.flotte.eyebrow} word={COPY.flotte.word} sentence={COPY.flotte.sentence} needs={COPY.flotte.needs}
            rule={<RuleText text={COPY.flotte.check} lead={<View style={[st.alertDisc, { width: 26, height: 26, borderRadius: 13, marginRight: 10 }]}><Text style={[st.alertMark, { fontSize: 15 }]}>!</Text></View>} />}
          />
        )}
      >
        <OperatorStack gap={12}>{operators.map((op) => <FlotteCard key={op.key} L={L} op={op} />)}</OperatorStack>
      </LandscapePage>

      <LandscapePage
        section="retrait"
        dark
        sidebar={(
          <Sidebar
            section="retrait" eyebrow={COPY.retrait.eyebrow} word={COPY.retrait.word} sentence={COPY.retrait.sentence} needs={COPY.retrait.needs}
            rule={(
              <View>
                <View style={[ls.ruleRow, { marginBottom: 8 }]}>
                  <View style={[st.amountBox, { marginRight: 0 }]}><Text style={[st.amountText, { fontSize: 13 }]}>MONTANT</Text></View>
                  <View style={{ marginLeft: 8, marginRight: 8 }}><ArrowIcon color={INK} size={13} /></View>
                  <ExampleBox size={13} outlined />
                </View>
                <Text style={ls.ruleFr}>{balanced(COPY.retrait.legend.fr, 14, 0)}</Text>
                <Text style={ls.ruleEn}>{balanced(COPY.retrait.legend.en, 12.5, 0)}</Text>
              </View>
            )}
          />
        )}
      >
        <OperatorStack gap={12}>{operators.map((op) => <RetraitCard key={op.key} L={L} op={op} room={codeRoom} />)}</OperatorStack>
      </LandscapePage>

      <LandscapePage
        section="preuve"
        sidebar={(
          <Sidebar
            section="preuve" eyebrow={COPY.preuve.eyebrow} word={COPY.preuve.word} sentence={COPY.preuve.sentence} needs={COPY.preuve.needs}
            rule={<RuleText text={COPY.preuve.clear} lead={<View style={[st.goldCheck, { width: 26, height: 26, borderRadius: 13, marginRight: 10 }]}><CheckIcon color={INK} size={13} /></View>} />}
          />
        )}
      >
        <Ticket width={AREA_W} rowH={56} />
        <View style={{ marginTop: 14 }}><Thanks /></View>
      </LandscapePage>
    </>
  );
}
