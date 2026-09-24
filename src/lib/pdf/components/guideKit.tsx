// ============================================================
// LE KIT DES FICHES CLIENT — ce que partagent la fiche Mobile Money et la
// fiche des coordonnées bancaires, pour qu'elles se ressemblent trait pour
// trait : même bandeau de partie (portrait), même colonne de couleur
// (paysage), même pied de page, même ticket de preuve, même remerciement,
// mêmes éléments de couverture. Les textes arrivent par les props (chaque
// fiche a les siens) ; couleurs et fonctions : ../guideTokens.ts ; styles :
// ../guideStyles.ts.
// ============================================================
import { Text as PdfText, View, Link, Svg, Path } from '@react-pdf/renderer';
import type { ComponentProps, ReactNode } from 'react';
import type { Style } from '@react-pdf/types';
import { PdfLogo } from './PDFHeader';
import { colors } from '../styles';
import {
  INK, WHITE, MUTED, LINE_ON_INK, LINE_ON_PANEL, ON_INK_SOFT,
  SIDE_W, SIDE_PAD, biLabel, balanced, fitSize, ticketPath, type BiText, type Tone,
} from '../guideTokens';
import { gk, ls } from '../guideStyles';
import { LEGAL_NAME } from '@/lib/companyIdentity';

/**
 * Tout texte des fiches passe par ici : pas de césure. « BONZINI » ne devient
 * jamais « BONZI-NI » — on ne coupe qu'entre deux mots.
 */
const noHyphen = (word: string) => [word];
export function Text(props: ComponentProps<typeof PdfText>) {
  return <PdfText hyphenationCallback={noHyphen} {...props} />;
}

export function ArrowIcon({ color, size = 10 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 12h15M13 6l6 6-6 6" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

export function CheckIcon({ color, size = 12 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 12.5l4.5 4.5L19 7" stroke={color} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

/* ─────────────── En-têtes ─────────────── */

/** Le disque blanc du logo, puis la raison sociale. */
export function BrandRow({ color, disc = 28, logo = 19, gap = 10, textStyle }: { color: string; disc?: number; logo?: number; gap?: number; textStyle?: Style }) {
  return (
    <View style={gk.brandRow}>
      <View style={[gk.markDisc, { width: disc, height: disc, borderRadius: disc / 2, marginRight: gap }]}><PdfLogo size={logo} /></View>
      <Text style={[textStyle ?? gk.brandName, { color }]}>{LEGAL_NAME}</Text>
    </View>
  );
}

/** Ce qu'il faut pour payer, en pastille : « Numéro + Titulaire », « IBAN + SWIFT »… */
export function NeedsPill({ needs, fg, bg = WHITE }: { needs: BiText; fg: string; bg?: string }) {
  return (
    <View style={[gk.needs, { backgroundColor: bg }]}>
      <Text style={[gk.needsFr, { color: fg }]}>{needs.fr}</Text>
      {needs.en !== needs.fr ? <Text style={[gk.needsEn, { color: fg }]}>{needs.en}</Text> : null}
    </View>
  );
}

interface SectionText { eyebrow: BiText; word: BiText; sentence: BiText; needs: BiText; needsFg: string; needsBg?: string }

/** Portrait : le bandeau de couleur en haut de page — quelle partie, en très gros, et ce qu'il faut. */
export function Hero({ id, tone, inset, folio, text, sizes, ghostRight, ghostOpacity, enStrong }: {
  id: string; tone: Tone; inset: number; folio: string; text: SectionText;
  sizes: { ghost: number; word: number; enWord: number }; ghostRight: number; ghostOpacity: number; enStrong?: boolean;
}) {
  const { eyebrow, word, sentence, needs, needsFg, needsBg } = text;
  return (
    <View id={id} style={[gk.hero, { backgroundColor: tone.color, paddingHorizontal: inset, paddingTop: 16, paddingBottom: 14 }]}>
      <Text style={[gk.heroGhost, { fontSize: sizes.ghost, right: ghostRight, top: -80, opacity: ghostOpacity }]}>{tone.n}</Text>
      <View style={[gk.heroTop, { marginBottom: 12 }]}>
        <BrandRow color={tone.fr} />
        <Text style={[gk.folio, { color: tone.en }]}>{folio}</Text>
      </View>
      <Text style={[gk.eyebrow, { color: tone.en }]}>{biLabel(eyebrow)}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <Text style={[gk.heroWord, { color: tone.fr, fontSize: sizes.word, marginRight: 14 }]}>{word.fr}</Text>
        <Text style={[gk.heroEnWord, { color: tone.en, fontSize: sizes.enWord, marginBottom: sizes.word * 0.06 }]}>{word.en}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 8 }}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={[gk.sentenceFr, { color: tone.fr }]}>{sentence.fr}</Text>
          <Text style={[gk.sentenceEn, { color: tone.en }, enStrong ? gk.sentenceEnOnViolet : {}]}>{sentence.en}</Text>
        </View>
        <NeedsPill needs={needs} fg={needsFg} bg={needsBg} />
      </View>
    </View>
  );
}

/** Paysage : la colonne de couleur — quelle partie, d'où, ce qu'il faut ; en bas, la règle de la page. */
export function Sidebar({ id, tone, folio, text, rule, ghostOpacity, enStrong }: {
  id: string; tone: Tone; folio: string; text: SectionText; rule: ReactNode; ghostOpacity: number; enStrong?: boolean;
}) {
  const { eyebrow, word, sentence, needs, needsFg, needsBg } = text;
  const room = SIDE_W - 2 * SIDE_PAD;
  return (
    <View id={id} style={[ls.side, { backgroundColor: tone.color }]}>
      <Text style={[ls.sideGhost, { opacity: ghostOpacity }]}>{tone.n}</Text>
      <BrandRow color={tone.fr} disc={26} logo={18} gap={8} textStyle={ls.sideBrand} />
      <View style={{ marginTop: 34 }}>
        <Text style={[ls.sideEyebrow, { color: tone.en }]}>{eyebrow.fr}</Text>
        <Text style={[ls.sideEyebrowEn, { color: tone.en }]}>{eyebrow.en}</Text>
        <Text style={[ls.sideWord, { color: tone.fr, fontSize: fitSize(word.fr, 46, room, 0.66) }]}>{word.fr}</Text>
        <Text style={[ls.sideEnWord, { color: tone.en, fontSize: fitSize(word.en, 22, room, 0.74) }]}>{word.en}</Text>
        <Text style={[ls.sideSentenceFr, { color: tone.fr }]}>{balanced(sentence.fr, 15, room)}</Text>
        <Text style={[ls.sideSentenceEn, { color: tone.en }, enStrong ? { fontSize: 14, fontWeight: 700 } : {}]}>{balanced(sentence.en, enStrong ? 14 : 13, room, 0.5)}</Text>
        <View style={{ marginTop: 14, alignSelf: 'flex-start' }}><NeedsPill needs={needs} fg={needsFg} bg={needsBg} /></View>
      </View>
      <SideBottom rule={rule} folio={folio} color={tone.en} />
    </View>
  );
}

/** Le bas de la colonne : la carte blanche de la règle, puis le folio. */
function SideBottom({ rule, folio, color }: { rule: ReactNode; folio: string; color: string }) {
  return (
    <View style={{ marginTop: 'auto' }}>
      <View style={ls.rule}>{rule}</View>
      <Text style={[ls.sideFolio, { color }]}>{folio}</Text>
    </View>
  );
}

/** Une règle de page, en français puis en anglais, avec son repère visuel à gauche. */
export function RuleText({ text, lead }: { text: BiText; lead: ReactNode }) {
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

/* ─────────────── Pied de page ─────────────── */

export interface FooterItem { key: string; label: string; color: string; active: boolean; href?: string }

/**
 * La raison sociale à gauche ; à droite, où l'on est dans le livret (points de
 * couleur). `showName={false}` quand la navigation a besoin de toute la largeur
 * (le nom est déjà en tête de chaque page). Rien ne rétrécit : un pied trop
 * long déborderait franchement au lieu de se chevaucher en silence.
 */
export function Footer({ inset, items, dark, showName = true }: { inset: number; items: FooterItem[]; dark?: boolean; showName?: boolean }) {
  const muted = dark ? ON_INK_SOFT : MUTED;
  return (
    <View style={[gk.footer, { left: inset, right: inset, borderTopColor: dark ? LINE_ON_INK : colors.border }]} fixed>
      {showName ? <Text style={[gk.footerText, { color: muted, flexShrink: 0 }]}>{LEGAL_NAME}</Text> : <View />}
      <View style={[gk.way, { flexShrink: 0 }]}>
        {items.map((it) => {
          const item = (
            <View key={it.key} style={gk.wayItem}>
              <View style={[gk.wayDot, { backgroundColor: it.active ? it.color : dark ? LINE_ON_PANEL : '#d6cfe0' }]} />
              <Text style={[gk.wayText, { color: it.active ? (dark ? WHITE : INK) : muted, fontWeight: it.active ? 800 : 500 }]}>{it.label}</Text>
            </View>
          );
          return it.href ? <Link key={it.key} src={it.href} style={gk.link}>{item}</Link> : item;
        })}
      </View>
    </View>
  );
}

/* ─────────────── Couverture ─────────────── */

/** La marque, le folio, puis le code couleur du livret annoncé d'un trait. */
export function CoverBrand({ folio, stripe, stripeTop }: { folio: string; stripe: string[]; stripeTop: number }) {
  return (
    <>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <PdfLogo size={30} />
          <Text style={gk.coverBrand}>{LEGAL_NAME}</Text>
        </View>
        <Text style={gk.coverFolio}>{folio}</Text>
      </View>
      <View style={[gk.stripe, { marginTop: stripeTop }]}>
        {stripe.map((c, i) => <View key={i} style={[gk.stripeSeg, { backgroundColor: c, marginLeft: i ? 5 : 0 }]} />)}
      </View>
    </>
  );
}

/** « ou / or » dans son anneau, entre deux façons de payer. */
export function OrDisc({ or, style }: { or: BiText; style?: Style }) {
  return (
    <View style={[gk.orDisc, style ?? {}]}>
      <Text style={gk.orFr}>{or.fr}</Text>
      <Text style={gk.orEn}>{or.en}</Text>
    </View>
  );
}

/** « PAGE 4 → » : le renvoi cliquable d'une porte de couverture. */
export function PagePill({ page, word, color = INK, background = WHITE }: { page: number; word: string; color?: string; background?: string }) {
  return (
    <View style={[gk.doorPage, { backgroundColor: background }]}>
      <Text style={[gk.doorPageText, { color }]}>{word} {page}</Text>
      <ArrowIcon color={color} size={10} />
    </View>
  );
}

/* ─────────────── Preuve ─────────────── */

const PROOF_BAR_W = [70, 110, 90, 60];

/** Le justificatif dessiné en ticket : chaque élément à y voir est coché. */
export function Ticket({ width, rowH, items, shot }: { width: number; rowH: number; items: readonly BiText[]; shot: BiText }) {
  const tooth = 9;
  const h = 60 + items.length * rowH + 14 + tooth;
  return (
    <View style={{ width, height: h, position: 'relative' }}>
      <Svg width={width} height={h} style={{ position: 'absolute', top: 0, left: 0 }}>
        <Path d={ticketPath(width, h, tooth)} fill="#f4f0f9" stroke="#d9d1e5" strokeWidth={1} />
      </Svg>
      <View style={gk.ticketHead}>
        <View style={gk.ticketOk}><CheckIcon color={WHITE} size={15} /></View>
        <View>
          <View style={gk.barA} />
          <View style={gk.barB} />
        </View>
        <View style={gk.ticketTag}>
          <Text style={[gk.label, { marginBottom: 0 }]}>{shot.fr}</Text>
          <Text style={[gk.label, { marginBottom: 0, fontSize: 11, fontWeight: 700 }]}>{shot.en}</Text>
        </View>
      </View>
      {items.map((item, i) => (
        <View key={item.fr} style={[gk.ticketRow, { height: rowH }]}>
          <View style={gk.goldCheck}><CheckIcon color={INK} size={14} /></View>
          <View>
            <Text style={gk.itemFr}>{item.fr}</Text>
            <Text style={gk.itemEn}>{item.en}</Text>
          </View>
          <View style={[gk.ticketBar, { width: PROOF_BAR_W[i % PROOF_BAR_W.length] }]} />
        </View>
      ))}
    </View>
  );
}

export function ClearLine({ text }: { text: BiText }) {
  return (
    <View style={[gk.clearRow, { paddingHorizontal: 20 }]}>
      <View style={gk.goldCheck}><CheckIcon color={INK} size={14} /></View>
      <View style={{ flex: 1 }}>
        <Text style={gk.clearFr}>{text.fr}</Text>
        <Text style={gk.clearEn}>{text.en}</Text>
      </View>
    </View>
  );
}

export function Thanks({ text }: { text: BiText }) {
  return (
    <View style={gk.thanks}>
      <View style={[gk.markDisc, { width: 38, height: 38, borderRadius: 19, marginRight: 16 }]}><PdfLogo size={26} /></View>
      <View style={{ flex: 1 }}>
        <Text style={gk.thanksFr}>{text.fr}</Text>
        <Text style={gk.thanksEn}>{text.en}</Text>
        <Text style={gk.thanksSign}>{LEGAL_NAME}</Text>
      </View>
    </View>
  );
}

