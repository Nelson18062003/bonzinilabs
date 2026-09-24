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
import { Document, Page, View, Image, Link, Svg, Path, StyleSheet } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import type { Style } from '@react-pdf/types';
import {
  Text, ArrowIcon, CheckIcon, PagePill, RuleText,
  Hero as KitHero, Sidebar as KitSidebar, Footer as KitFooter, CoverBrand as KitCoverBrand,
  Ticket as KitTicket, ClearLine as KitClearLine, Thanks as KitThanks,
} from '../components/guideKit';
import {
  INK, WHITE, CALL_GREEN, R, MUTED, PANEL, LINE_ON_PANEL, ON_INK_SOFT, VIOLET_DEEP, ORANGE_DEEP, SIDE_W, AREA_PAD,
  biLabel, balanced,
} from '../guideTokens';
import { gk, ls } from '../guideStyles';
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

const TOTAL = 4;

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

/** Les styles propres à la fiche Mobile Money ; les styles communs viennent du kit. */
const st = {
  ...gk,
  ...StyleSheet.create({
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
    plateLogos: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  }),
};

/* ─────────────── Pictogrammes (dessinés, pas de police d'icônes) ─────────────── */

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

/* ─────────────── Éléments communs (le kit, aux couleurs des trois parties) ─────────────── */

function Footer({ inset, active, dark }: { inset: number; active: SectionKey; dark?: boolean }) {
  return <KitFooter inset={inset} dark={dark} items={ORDER.map((k) => ({ key: k, label: biLabel(COPY.way[k]), color: SECTION[k].color, active: active === k }))} />;
}

/** Sur blanc, le violet ou l'orange foncé ; sur or, l'or sur encre. */
function needsInk(section: SectionKey): { needsFg: string; needsBg?: string } {
  if (section === 'preuve') return { needsFg: colors.gold, needsBg: INK };
  return { needsFg: section === 'retrait' ? ORANGE_DEEP : VIOLET_DEEP };
}

/** Portrait : le bandeau de couleur en haut de page. */
function Hero({ L, section, eyebrow, word, sentence, needs }: { L: Layout; section: SectionKey; eyebrow: Bi; word: Bi; sentence: Bi; needs: Bi }) {
  const s = SECTION[section];
  return (
    <KitHero
      id={section} tone={s} inset={L.M} folio={`${s.page} / ${TOTAL}`}
      text={{ eyebrow, word, sentence, needs, ...needsInk(section) }}
      sizes={{ ghost: L.ghost, word: L.heroWord, enWord: L.heroEnWord }}
      ghostRight={section === 'flotte' ? 4 : -40} ghostOpacity={section === 'preuve' ? 0.22 : 0.16} enStrong={section === 'flotte'}
    />
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
  // Le code couleur du livret, annoncé d'un trait : Flotte · Retrait · Preuve.
  return <KitCoverBrand folio={`1 / ${TOTAL}`} stripe={ORDER.map((k) => SECTION[k].color)} stripeTop={L.o === 'portrait' ? 16 : 12} />;
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

function Ticket({ width, rowH }: { width: number; rowH: number }) {
  return <KitTicket width={width} rowH={rowH} items={COPY.preuve.items} shot={COPY.preuve.shot} />;
}

function ClearLine() {
  return <KitClearLine text={COPY.preuve.clear} />;
}

function Thanks() {
  return <KitThanks text={COPY.preuve.thanks} />;
}

/* ─────────────── PAYSAGE : colonne de couleur + zone de données ─────────────── */

const AREA_W = LANDSCAPE.W - SIDE_W - 2 * AREA_PAD;

/** La colonne de couleur : quelle façon, d'où, ce qu'il faut ; en bas, la règle de la page. */
function Sidebar({ section, eyebrow, word, sentence, needs, rule }: { section: SectionKey; eyebrow: Bi; word: Bi; sentence: Bi; needs: Bi; rule: ReactNode }) {
  const s = SECTION[section];
  return (
    <KitSidebar
      id={section} tone={s} folio={`${s.page} / ${TOTAL}`} rule={rule}
      text={{ eyebrow, word, sentence, needs, ...needsInk(section) }}
      ghostOpacity={section === 'preuve' ? 0.18 : 0.1} enStrong={section === 'flotte'}
    />
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
