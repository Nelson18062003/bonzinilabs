// ============================================================
// LA FICHE « COORDONNÉES BANCAIRES » — émise par NORTON GAUSS BONZINI SARL,
// en français ET en anglais, en portrait ou en paysage. Même famille que la
// fiche Mobile Money (même kit, mêmes couleurs, mêmes tailles de lecture).
//
// Le livret complet (A4, 2 pages + une par banque) :
//   · Couverture : le titulaire unique, les deux façons de payer
//     (1 VIREMENT, violet · 2 DÉPÔT AU GUICHET, orange), puis le sommaire
//     des banques, cliquable, avec leurs logos officiels.
//   · Une page par banque : le titulaire en très gros, le bloc violet du
//     virement (IBAN sur une ligne, SWIFT), le bloc orange du dépôt au
//     guichet (les 4 cases du RIB), la mention obligatoire.
//   · LA PREUVE : ce que l'avis de virement ou le bordereau doit montrer.
// Seules les banques dont l'IBAN et la clé RIB se vérifient sont imprimées
// (bankGuideData) : un document officiel ne porte jamais un IBAN refusé.
// Le RIB seul (1 page) : la page d'une banque, sans folio, avec en bas le
// rappel de la preuve — ce qu'on envoie quand on nous demande « votre RIB ».
// Portrait : bandeau sombre en haut. Paysage : colonne sombre à gauche
// (logo, banque, mention), données à droite.
// Aucun texte utile sous 11 pt ; IBAN, RIB et SWIFT à la plus grande taille
// qui tient sur une ligne (chasses mesurées). Aucun site, aucun téléphone.
// ============================================================
import { Document, Page, View, Image, Link, Svg, Circle, Ellipse, Path, StyleSheet } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import {
  Text, ArrowIcon, CheckIcon, BrandRow, Hero, Sidebar, RuleText, Footer, CoverBrand, OrDisc, PagePill, NeedsPill,
  Ticket, ClearLine, Thanks, type FooterItem,
} from '../components/guideKit';
import { gk, ls } from '../guideStyles';
import {
  INK, WHITE, R, MUTED, ON_INK_SOFT, OR_RING, VIOLET_DEEP, ORANGE_DEEP, SIDE_W, SIDE_PAD, AREA_PAD,
  biLabel, blackEm, fitBlack, type Tone,
} from '../guideTokens';
import { colors } from '../styles';
import '../fonts';
import { BANK_GUIDE_COPY as COPY, type BankGuideAccount, type BankGuideData, type Bi } from '@/lib/bankDetailsGuide';
import type { GuideOrientation } from '@/lib/mobileMoneyGuide';
import type { BankOption } from '@/types/deposit';
import { LEGAL_NAME } from '@/lib/companyIdentity';
import ecobankLogo from '@/assets/bank-logos/ecobank.png';
import ccaLogo from '@/assets/bank-logos/cca.png';
import ubaLogo from '@/assets/bank-logos/uba.png';
import afrilandLogo from '@/assets/bank-logos/afriland.png';

/* ─────────────── Mises en page ─────────────── */

interface Layout { o: GuideOrientation; W: number; H: number; M: number; CW: number }
const PORTRAIT: Layout = { o: 'portrait', W: 595.28, H: 841.89, M: 40, CW: 595.28 - 80 };
const LANDSCAPE: Layout = { o: 'landscape', W: 841.89, H: 595.28, M: 36, CW: 841.89 - 72 };
const AREA_W = LANDSCAPE.W - SIDE_W - 2 * AREA_PAD;

/** Les trois parties, aux couleurs de la fiche Mobile Money. */
const VIREMENT: Tone = { n: '1', color: colors.violet, fr: WHITE, en: WHITE };
const GUICHET: Tone = { n: '2', color: colors.orange, fr: WHITE, en: INK };
const PREUVE: Tone = { n: '3', color: colors.gold, fr: INK, en: INK };

/** Les cases de chiffres : lilas dans le bloc violet, pêche dans le bloc orange. */
const VIOLET_KEYS = { bg: '#f5f2f9', line: '#e2d9ee' };
const ORANGE_KEYS = { bg: '#fff4ee', line: '#f7d6c5' };
const KEY_SPACING = 1.2;
const KEY_PAD = 9;
const KEY_GAP = 6;
const CELL_LABEL = 11;
/** Corps de carte : 18 pt de marge de chaque côté. */
const CARD_PAD = 18;

/* ─────────────── Logos officiels ─────────────── */

/**
 * Chaque logo sur sa plaque : blanche pour Ecobank, UBA et Afriland ; violette
 * pour CCA-Bank, dont le logo est dessiné sur son fond violet d'origine.
 * `ratio` = largeur / hauteur du fichier (recadré au ras du dessin).
 */
const LOGOS: Record<Exclude<BankOption, 'OTHER'>, { src: string; ratio: number; plate: string; bleed?: boolean }> = {
  ECOBANK: { src: ecobankLogo, ratio: 455 / 224, plate: WHITE },
  CCA: { src: ccaLogo, ratio: 548 / 324, plate: '#663088', bleed: true },
  UBA: { src: ubaLogo, ratio: 499 / 234, plate: WHITE },
  AFRILAND: { src: afrilandLogo, ratio: 400 / 462, plate: WHITE },
};

/** La plaque du logo, toujours de la même taille, le logo centré et contenu. */
function BankLogo({ bank, w, h, pad, border }: { bank: BankOption; w: number; h: number; pad: number; border?: string }) {
  const logo = bank === 'OTHER' ? null : LOGOS[bank];
  if (!logo) return <View style={{ width: w, height: h }} />;
  // CCA-Bank : le fond du fichier EST la plaque, on le laisse remplir.
  const boxW = logo.bleed ? w : w - 2 * pad;
  const boxH = logo.bleed ? h : h - 2 * pad;
  const imgW = Math.min(boxW, boxH * logo.ratio);
  const imgH = imgW / logo.ratio;
  return (
    <View style={[{ width: w, height: h, backgroundColor: logo.plate, borderRadius: R.inner, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, border ? { borderWidth: 1, borderColor: border } : {}]}>
      <Image src={logo.src} style={{ width: imgW, height: imgH }} />
    </View>
  );
}

/* ─────────────── Styles propres à la fiche ─────────────── */

const bs = StyleSheet.create({
  // Bandeau de banque (portrait)
  bankHero: { backgroundColor: INK, paddingTop: 16 },
  heroRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18, marginBottom: 20 },
  eyebrow: { fontSize: 11, fontWeight: 800, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.gold, marginBottom: 6 },
  bankName: { fontWeight: 900, color: WHITE, lineHeight: 1.08, letterSpacing: -0.2 },
  zoneFr: { fontSize: 13, fontWeight: 700, color: WHITE, marginTop: 7 },
  zoneEn: { fontSize: 12, fontWeight: 500, color: ON_INK_SOFT, marginTop: 1 },
  stripe: { flexDirection: 'row', height: 4 },

  // Titulaire
  holderBox: { borderWidth: 2, borderColor: INK, backgroundColor: '#f5f2f9', borderRadius: R.inner, paddingTop: 5, paddingBottom: 4, paddingHorizontal: 14 },
  holderText: { fontWeight: 900, color: INK, lineHeight: 1.15 },

  // Blocs « façon de payer »
  card: { backgroundColor: WHITE, borderWidth: 1, borderColor: colors.border, borderRadius: R.box, overflow: 'hidden' },
  cardHead: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: CARD_PAD },
  cardDisc: { width: 32, height: 32, borderRadius: 16, backgroundColor: WHITE, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  cardDiscText: { fontSize: 16, fontWeight: 900, lineHeight: 1 },
  cardWord: { fontSize: 20, fontWeight: 900, letterSpacing: 1.5, textTransform: 'uppercase', lineHeight: 1 },
  cardEnWord: { fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', marginTop: 4, lineHeight: 1 },
  cardSentFr: { fontSize: 12.5, fontWeight: 700, textAlign: 'right' },
  cardSentEn: { fontSize: 11.5, fontWeight: 500, textAlign: 'right', marginTop: 1 },
  cardBody: { paddingTop: 12, paddingBottom: 14, paddingHorizontal: CARD_PAD },

  // Cases de chiffres
  keys: { flexDirection: 'row' },
  key: { alignItems: 'center', borderWidth: 1, borderRadius: R.inner, paddingTop: 3, paddingBottom: 1 },
  keyText: { fontWeight: 900, color: INK, letterSpacing: KEY_SPACING, lineHeight: 1.15 },
  cell: { alignItems: 'center', borderWidth: 1, borderRadius: R.inner, paddingTop: 7, paddingBottom: 1 },
  cellFr: { fontSize: CELL_LABEL, fontWeight: 800, color: INK, textAlign: 'center' },
  cellEn: { fontSize: CELL_LABEL, fontWeight: 500, color: MUTED, textAlign: 'center', marginTop: 1, marginBottom: 2 },

  // SWIFT
  swiftRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 12 },
  hint: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 16, marginBottom: 7 },
  hintFr: { fontSize: 13, fontWeight: 700, color: INK },
  hintEn: { fontSize: 12, fontWeight: 500, color: MUTED, marginTop: 1 },

  // « ou » entre les deux blocs
  orRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 5 },
  orLine: { flex: 1, height: 1, backgroundColor: colors.border },
  orDisc: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: '#d6cfe0', backgroundColor: WHITE, alignItems: 'center', justifyContent: 'center', marginHorizontal: 12 },
  orFr: { fontSize: 13, fontWeight: 800, color: INK, lineHeight: 1 },
  orEn: { fontSize: 11, fontWeight: 600, color: MUTED, lineHeight: 1, marginTop: 1 },

  // Mention obligatoire
  mention: { flexDirection: 'row', alignItems: 'center', borderRadius: R.inner, backgroundColor: '#f5f2f9', paddingVertical: 10, paddingHorizontal: 16 },
  mentionDisc: { width: 30, height: 30, borderRadius: 15, backgroundColor: INK, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  mentionMark: { fontSize: 17, fontWeight: 900, color: WHITE, lineHeight: 1 },
  mentionFr: { fontSize: 17, fontWeight: 800, color: INK },
  mentionEn: { fontSize: 14, fontWeight: 500, color: MUTED, marginTop: 1 },

  // Rappel de la preuve (RIB seul)
  proofStrip: { flexDirection: 'row', alignItems: 'center', borderRadius: R.inner, borderWidth: 1.5, borderColor: colors.gold, paddingVertical: 10, paddingHorizontal: 16 },
  proofFr: { fontSize: 15, fontWeight: 800, color: INK },
  proofEn: { fontSize: 13, fontWeight: 500, color: MUTED, marginTop: 1 },

  // Couverture
  holderCard: { borderWidth: 1.5, borderColor: OR_RING, borderRadius: R.box, paddingVertical: 12, paddingHorizontal: 18 },
  holderCardLabel: { fontSize: 11, fontWeight: 800, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.gold, marginBottom: 4 },
  holderCardText: { fontWeight: 900, color: WHITE, lineHeight: 1.15 },
  door: { borderRadius: R.box, paddingVertical: 16, paddingHorizontal: 18, flexGrow: 1 },
  doorTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  doorWord: { fontWeight: 900, letterSpacing: 1.5, textTransform: 'uppercase', lineHeight: 1 },
  doorEnWord: { fontSize: 14, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', lineHeight: 1, marginTop: 6 },
  tile: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: '#fcfbfd', padding: 8 },
  tileName: { fontSize: 14, fontWeight: 800, color: INK, lineHeight: 1.15 },
  tilePage: { fontSize: 11, fontWeight: 800, color: VIOLET_DEEP, letterSpacing: 1.2, textTransform: 'uppercase', marginRight: 5 },
});

/* ─────────────── Pictogramme ─────────────── */

/** Le globe du SWIFT : il ne sert que pour un virement venu de l'étranger. */
function GlobeIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="9.5" stroke={color} strokeWidth={2} fill="none" />
      <Ellipse cx="12" cy="12" rx="4.2" ry="9.5" stroke={color} strokeWidth={2} fill="none" />
      <Path d="M2.5 12h19M4.5 7h15M4.5 17h15" stroke={color} strokeWidth={1.6} fill="none" />
    </Svg>
  );
}

/* ─────────────── Les cases de chiffres ─────────────── */

interface Cell { value: string; label?: Bi }

/** Largeur naturelle d'une case : son nombre (ou son étiquette, si plus large) et ses marges. */
function cellWidth(c: Cell, size: number): number {
  const value = blackEm(c.value) * size + KEY_SPACING * c.value.length;
  const label = c.label ? Math.max(blackEm(c.label.fr), blackEm(c.label.en)) * CELL_LABEL : 0;
  return Math.max(value, label) + 2 * KEY_PAD + 2;
}

/** La plus grande taille qui fait tenir toute la rangée sur une ligne (4 % de marge de sécurité). */
function rowSize(cells: Cell[], room: number, max: number): number {
  for (let s = max; s > 12; s -= 0.5) {
    const total = cells.reduce((w, c) => w + cellWidth(c, s), 0) + KEY_GAP * (cells.length - 1);
    if (total <= room * 0.96) return s;
  }
  return 12;
}

/** Une rangée de cases : l'IBAN groupé comme sur le RIB, ou les 4 cases du RIB avec leur nom. */
function KeyRow({ cells, size, tint }: { cells: Cell[]; size: number; tint: { bg: string; line: string } }) {
  return (
    <View style={bs.keys}>
      {cells.map((c, i) => (
        <View key={i} style={[c.label ? bs.cell : bs.key, { flexGrow: 1, flexBasis: cellWidth(c, size), marginLeft: i ? KEY_GAP : 0, backgroundColor: tint.bg, borderColor: tint.line }]}>
          {c.label ? (
            <>
              <Text style={bs.cellFr}>{c.label.fr}</Text>
              <Text style={bs.cellEn}>{c.label.en}</Text>
            </>
          ) : null}
          <Text style={[bs.keyText, { fontSize: size, position: 'relative', top: -size * 0.078 }]}>{c.value}</Text>
        </View>
      ))}
    </View>
  );
}

function ibanCells(a: BankGuideAccount): Cell[] {
  return a.iban.split(' ').map((value) => ({ value }));
}

function ribCells(a: BankGuideAccount): Cell[] {
  const g = COPY.guichet;
  return [
    { value: a.bankCode, label: g.bankCode },
    { value: a.branchCode, label: g.branchCode },
    { value: a.accountNumber, label: g.accountNumber },
    { value: a.ribKey, label: g.ribKey },
  ];
}

/**
 * Une seule taille pour l'IBAN et le RIB — ce sont les mêmes chiffres,
 * découpés autrement — et pour toutes les banques, pour que les pages se
 * superposent trait pour trait.
 */
function digitsSize(accounts: BankGuideAccount[], cardW: number): number {
  const room = cardW - 2 * CARD_PAD;
  return Math.min(...accounts.flatMap((a) => [rowSize(ibanCells(a), room, 30), rowSize(ribCells(a), room, 30)]));
}

/* ─────────────── Les blocs d'une page de banque ─────────────── */

function HolderBlock({ holder, room }: { holder: string; room: number }) {
  const size = fitBlack(holder, 30, room - 2 * 14 - 4 - 6);
  return (
    <View>
      <Text style={gk.label}>{biLabel(COPY.bank.holder)}</Text>
      <View style={bs.holderBox}><Text style={[bs.holderText, { fontSize: size }]}>{holder}</Text></View>
    </View>
  );
}

function WayCard({ tone, word, sentence, enStrong, children }: { tone: Tone; word: Bi; sentence: Bi; enStrong?: boolean; children: ReactNode }) {
  return (
    <View style={bs.card} wrap={false}>
      <View style={[bs.cardHead, { backgroundColor: tone.color }]}>
        <View style={bs.cardDisc}><Text style={[bs.cardDiscText, { color: tone.color }]}>{tone.n}</Text></View>
        <View>
          <Text style={[bs.cardWord, { color: tone.fr }]}>{word.fr}</Text>
          <Text style={[bs.cardEnWord, { color: tone.en }]}>{word.en}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={[bs.cardSentFr, { color: tone.fr }]}>{sentence.fr}</Text>
          <Text style={[bs.cardSentEn, { color: tone.en }, enStrong ? { fontWeight: 700 } : {}]}>{sentence.en}</Text>
        </View>
      </View>
      <View style={bs.cardBody}>{children}</View>
    </View>
  );
}

const SWIFT_SIZE = 30;

/** La case du SWIFT a la même largeur sur toutes les pages : celle du SWIFT le plus large. */
function swiftWidth(accounts: BankGuideAccount[]): number {
  return Math.max(...accounts.map((a) => cellWidth({ value: a.swift }, SWIFT_SIZE))) + 8;
}

function VirementCard({ a, size, room, swiftW }: { a: BankGuideAccount; size: number; room: number; swiftW: number }) {
  const v = COPY.virement;
  const swiftSize = SWIFT_SIZE;
  // Place du conseil à droite du SWIFT : carte − marges − case − écart − globe.
  const hintRoom = room - 2 * CARD_PAD - swiftW - 16 - 24 - 10;
  return (
    <WayCard tone={VIREMENT} word={v.word} sentence={v.sentence} enStrong>
      <Text style={gk.label}>{v.iban.fr}</Text>
      <KeyRow cells={ibanCells(a)} size={size} tint={VIOLET_KEYS} />
      <View style={bs.swiftRow}>
        <View>
          <Text style={gk.label}>{v.swift.fr}</Text>
          <View style={[bs.key, { alignSelf: 'flex-start', width: swiftW, backgroundColor: VIOLET_KEYS.bg, borderColor: VIOLET_KEYS.line }]}>
            <Text style={[bs.keyText, { fontSize: swiftSize, position: 'relative', top: -swiftSize * 0.078 }]}>{a.swift}</Text>
          </View>
        </View>
        <View style={bs.hint}>
          <GlobeIcon color={VIOLET_DEEP} size={24} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={bs.hintFr}>{nameLines(v.abroad.fr, 13 * 0.97, hintRoom)}</Text>
            <Text style={bs.hintEn}>{nameLines(v.abroad.en, 12 * 0.9, hintRoom)}</Text>
          </View>
        </View>
      </View>
    </WayCard>
  );
}

function GuichetCard({ a, size }: { a: BankGuideAccount; size: number }) {
  const g = COPY.guichet;
  return (
    <WayCard tone={GUICHET} word={g.word} sentence={g.sentence}>
      <KeyRow cells={ribCells(a)} size={size} tint={ORANGE_KEYS} />
    </WayCard>
  );
}

/** « ou / or » entre les deux blocs : on choisit l'une des deux façons. */
function OrRow({ tight }: { tight?: boolean }) {
  return (
    <View style={[bs.orRow, tight ? { marginVertical: 3 } : {}]}>
      <View style={bs.orLine} />
      <View style={[bs.orDisc, tight ? { width: 34, height: 34, borderRadius: 17 } : {}]}>
        <Text style={bs.orFr}>{COPY.cover.or.fr}</Text>
        <Text style={bs.orEn}>{COPY.cover.or.en}</Text>
      </View>
      <View style={bs.orLine} />
    </View>
  );
}

function MentionStrip() {
  return (
    <View style={bs.mention} wrap={false}>
      <View style={bs.mentionDisc}><Text style={bs.mentionMark}>!</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={[gk.label, { marginBottom: 3 }]}>{biLabel(COPY.mention.label)}</Text>
        <Text style={bs.mentionFr}>{COPY.mention.value.fr}</Text>
        <Text style={bs.mentionEn}>{COPY.mention.value.en}</Text>
      </View>
    </View>
  );
}

/** RIB seul : le rappel de la preuve, puisqu'il n'y a pas de page 6. */
function ProofStrip() {
  return (
    <View style={bs.proofStrip} wrap={false}>
      <View style={gk.goldCheck}><CheckIcon color={INK} size={14} /></View>
      <View style={{ flex: 1 }}>
        <Text style={[gk.label, { marginBottom: 3 }]}>{biLabel(COPY.preuve.after)}</Text>
        <Text style={bs.proofFr}>{COPY.preuve.sentence.fr}</Text>
        <Text style={bs.proofEn}>{COPY.preuve.sentence.en}</Text>
      </View>
    </View>
  );
}

/** Le code couleur de la page, d'un trait : virement · guichet · preuve. */
function Stripe() {
  return (
    <View style={bs.stripe}>
      {[VIREMENT, GUICHET, PREUVE].map((t) => <View key={t.n} style={{ flex: 1, backgroundColor: t.color }} />)}
    </View>
  );
}

/** Coupe un nom trop long pour sa colonne à l'espace le plus central. */
function nameLines(name: string, size: number, room: number): string {
  if (blackEm(name) * size <= room) return name;
  const spaces = [...name.matchAll(/ /g)].map((m) => m.index ?? 0);
  if (!spaces.length) return name;
  const at = spaces.reduce((b, i) => (Math.abs(i - name.length / 2) < Math.abs(b - name.length / 2) ? i : b));
  return `${name.slice(0, at)}\n${name.slice(at + 1)}`;
}

/* ─────────────── Pages ─────────────── */

interface BankPageProps { a: BankGuideAccount; index: number; count: number; folio?: string; footer: FooterItem[]; single: boolean; accounts: BankGuideAccount[] }

function eyebrowOf(p: BankPageProps): Bi {
  if (p.single) return COPY.docTitle;
  const b = COPY.bank;
  return { fr: `${b.eyebrow.fr} ${p.index + 1} ${b.of.fr} ${p.count}`, en: `${b.eyebrow.en} ${p.index + 1} ${b.of.en} ${p.count}` };
}

function BankPagePortrait(p: BankPageProps) {
  const L = PORTRAIT;
  const { a } = p;
  // Le RIB seul porte en plus le rappel de la preuve : on resserre les blancs pour tenir sur une page.
  const tight = p.single;
  const gap = tight ? 10 : 14;
  const logoW = 150;
  const logoH = tight ? 72 : 84;
  const nameRoom = L.CW - logoW - 20;
  const eyebrow = eyebrowOf(p);
  const size = digitsSize(p.accounts, L.CW);
  return (
    <Page size="A4" orientation="portrait" style={[gk.page, { backgroundColor: WHITE }]}>
      <View id={`bank-${a.key}`} style={bs.bankHero}>
        <View style={{ paddingHorizontal: L.M }}>
          <View style={gk.heroTop}>
            <BrandRow color={WHITE} />
            {p.folio ? <Text style={[gk.folio, { color: ON_INK_SOFT }]}>{p.folio}</Text> : null}
          </View>
          <View style={[bs.heroRow, tight ? { marginTop: 12, marginBottom: 14 } : {}]}>
            <BankLogo bank={a.key} w={logoW} h={logoH} pad={12} />
            <View style={{ flex: 1, marginLeft: 20 }}>
              <Text style={bs.eyebrow}>{biLabel(eyebrow)}</Text>
              <Text style={[bs.bankName, { fontSize: 30 }]}>{nameLines(a.name, 30, nameRoom)}</Text>
              <Text style={bs.zoneFr}>{COPY.bank.zone.fr}</Text>
              <Text style={bs.zoneEn}>{COPY.bank.zone.en}</Text>
            </View>
          </View>
        </View>
        <Stripe />
      </View>
      <View style={{ paddingHorizontal: L.M, paddingTop: tight ? 10 : 16 }}>
        <HolderBlock holder={a.holder} room={L.CW} />
        <View style={{ marginTop: gap }}><VirementCard a={a} size={size} room={L.CW} swiftW={swiftWidth(p.accounts)} /></View>
        <OrRow tight={tight} />
        <GuichetCard a={a} size={size} />
        <View style={{ marginTop: gap }}><MentionStrip /></View>
        {tight ? <View style={{ marginTop: 8 }}><ProofStrip /></View> : null}
      </View>
      {/* Le RIB seul n'a pas de pied de page : la raison sociale est déjà en tête, et la place va à la preuve. */}
      {tight ? null : <Footer inset={L.M} items={p.footer} showName={false} />}
    </Page>
  );
}

/** Paysage : la colonne sombre — le logo, la banque, et en bas la mention (et la preuve, pour un RIB seul). */
function BankSide(p: BankPageProps) {
  const { a } = p;
  const room = SIDE_W - 2 * SIDE_PAD;
  const eyebrow = eyebrowOf(p);
  const mention = COPY.mention;
  return (
    <View id={`bank-${a.key}`} style={[ls.side, { backgroundColor: INK }]}>
      <BrandRow color={WHITE} disc={26} logo={18} gap={8} textStyle={ls.sideBrand} />
      {/* RIB seul : la colonne porte aussi la preuve, le logo et le nom s'y font un peu plus petits. */}
      <View style={{ marginTop: p.single ? 22 : 28 }}>
        <Text style={[ls.sideEyebrow, { color: colors.gold }]}>{eyebrow.fr}</Text>
        <Text style={[ls.sideEyebrowEn, { color: ON_INK_SOFT }]}>{eyebrow.en}</Text>
        <BankLogo bank={a.key} w={room} h={p.single ? 80 : 100} pad={p.single ? 13 : 16} />
        <Text style={[bs.bankName, { fontSize: p.single ? 24 : 28, marginTop: p.single ? 12 : 16 }]}>{nameLines(a.name, p.single ? 24 : 28, room)}</Text>
        <Text style={bs.zoneFr}>{COPY.bank.zone.fr}</Text>
        <Text style={bs.zoneEn}>{COPY.bank.zone.en}</Text>
      </View>
      <View style={{ marginTop: 'auto' }}>
        <View style={ls.rule}>
          <View style={[ls.ruleRow, { marginBottom: 6 }]}>
            <View style={[bs.mentionDisc, { width: 24, height: 24, borderRadius: 12, marginRight: 9 }]}><Text style={[bs.mentionMark, { fontSize: 14 }]}>!</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={[gk.label, { marginBottom: 0 }]}>{mention.label.fr}</Text>
              <Text style={[gk.label, { marginBottom: 0, fontWeight: 700 }]}>{mention.label.en}</Text>
            </View>
          </View>
          <Text style={ls.ruleFr}>{nameLines(mention.value.fr, 14 * 0.97, room - 28)}</Text>
          <Text style={ls.ruleEn}>{nameLines(mention.value.en, 12.5 * 0.9, room - 28)}</Text>
        </View>
        {p.single ? (
          <View style={[ls.rule, { marginTop: 10 }]}>
            <View style={[ls.ruleRow, { marginBottom: 6 }]}>
              <View style={[gk.goldCheck, { width: 24, height: 24, borderRadius: 12, marginRight: 9 }]}><CheckIcon color={INK} size={12} /></View>
              <View style={{ flex: 1 }}>
                <Text style={[gk.label, { marginBottom: 0 }]}>{COPY.preuve.after.fr}</Text>
                <Text style={[gk.label, { marginBottom: 0, fontWeight: 700 }]}>{COPY.preuve.after.en}</Text>
              </View>
            </View>
            <Text style={ls.ruleFr}>{nameLines(COPY.preuve.sentence.fr, 14 * 0.97, room - 28)}</Text>
            <Text style={ls.ruleEn}>{nameLines(COPY.preuve.sentence.en, 12.5 * 0.9, room - 28)}</Text>
          </View>
        ) : null}
        {p.folio ? <Text style={[ls.sideFolio, { color: ON_INK_SOFT }]}>{p.folio}</Text> : null}
      </View>
    </View>
  );
}

function BankPageLandscape(p: BankPageProps) {
  const { a } = p;
  const size = digitsSize(p.accounts, AREA_W);
  return (
    <Page size="A4" orientation="landscape" style={[gk.page, { flexDirection: 'row', backgroundColor: WHITE }]}>
      <BankSide {...p} />
      <View style={ls.area}>
        <HolderBlock holder={a.holder} room={AREA_W} />
        <View style={{ marginTop: 14 }}><VirementCard a={a} size={size} room={AREA_W} swiftW={swiftWidth(p.accounts)} /></View>
        <OrRow />
        <GuichetCard a={a} size={size} />
        {/* Livret : la navigation prend toute la largeur (le nom est en tête de colonne). */}
        <Footer inset={AREA_PAD} items={p.footer} showName={p.single} />
      </View>
    </Page>
  );
}

/* ─────────────── Couverture ─────────────── */

/** Une façon de payer : son numéro, son nom dans les deux langues, et ce qu'il faut. */
function Door({ tone, word, needs, needsFg, wordSize, padV }: { tone: Tone; word: Bi; needs: Bi; needsFg: string; wordSize: number; padV: number }) {
  return (
    <View style={[bs.door, { backgroundColor: tone.color, paddingVertical: padV }]}>
      <View style={bs.doorTop}>
        <View style={[gk.doorDisc, { width: 40, height: 40, borderRadius: 20, marginRight: 0 }]}><Text style={[gk.doorDiscText, { color: tone.color, fontSize: 19 }]}>{tone.n}</Text></View>
        <NeedsPill needs={needs} fg={needsFg} />
      </View>
      <Text style={[bs.doorWord, { color: tone.fr, fontSize: wordSize }]}>{word.fr}</Text>
      <Text style={[bs.doorEnWord, { color: tone.en }]}>{word.en}</Text>
    </View>
  );
}

function CoverDoors({ doorW, padV = 16 }: { doorW: number; padV?: number }) {
  // Une seule taille pour les deux noms : celle qui fait tenir « DÉPÔT AU GUICHET ».
  const room = doorW - 2 * 18;
  const wordSize = Math.min(fitBlack(COPY.virement.word.fr, 24, room, 1.5, true), fitBlack(COPY.guichet.word.fr, 24, room, 1.5, true));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
      <View style={{ width: doorW, flexDirection: 'column' }}>
        <Door tone={VIREMENT} word={COPY.virement.word} needs={COPY.virement.needs} needsFg={VIOLET_DEEP} wordSize={wordSize} padV={padV} />
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <OrDisc or={COPY.cover.or} style={{ marginHorizontal: 0 }} />
      </View>
      <View style={{ width: doorW, flexDirection: 'column' }}>
        <Door tone={GUICHET} word={COPY.guichet.word} needs={COPY.guichet.needs} needsFg={ORANGE_DEEP} wordSize={wordSize} padV={padV} />
      </View>
    </View>
  );
}

function ProofDoor({ page }: { page: number }) {
  return (
    <Link src="#preuve" style={gk.link}>
      <View style={[gk.proofDoor, { paddingVertical: 10 }]}>
        <View style={[gk.proofDisc, { width: 36, height: 36, borderRadius: 18 }]}><Text style={gk.proofDiscText}>{PREUVE.n}</Text></View>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' }}>
          <Text style={[gk.proofFr, { marginRight: 12 }]}>{COPY.cover.preuve.fr}</Text>
          <Text style={[gk.proofEn, { marginTop: 0 }]}>{COPY.cover.preuve.en}</Text>
        </View>
        <PagePill page={page} word={COPY.page.fr} color={INK} background={colors.gold} />
      </View>
    </Link>
  );
}

function CoverHolder({ size }: { size: number }) {
  return (
    <View style={bs.holderCard}>
      <Text style={bs.holderCardLabel}>{biLabel(COPY.cover.holder)}</Text>
      <Text style={[bs.holderCardText, { fontSize: size }]}>{LEGAL_NAME}</Text>
    </View>
  );
}

/** Le sommaire des banques : chaque carte mène à la page de sa banque. */
function BankTile({ a, page, vertical, w }: { a: BankGuideAccount; page: number; vertical: boolean; w: number }) {
  const logoW = vertical ? w - 16 : 100;
  const logoH = vertical ? 60 : 56;
  const pageRow = (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
      <Text style={bs.tilePage}>{COPY.page.fr} {page}</Text>
      <ArrowIcon color={VIOLET_DEEP} size={10} />
    </View>
  );
  return (
    <Link src={`#bank-${a.key}`} style={gk.link}>
      <View style={[bs.tile, { width: w }, vertical ? {} : { flexDirection: 'row', alignItems: 'center' }]}>
        <BankLogo bank={a.key} w={logoW} h={logoH} pad={9} border={colors.border} />
        <View style={vertical ? { marginTop: 8, paddingHorizontal: 2 } : { flex: 1, marginLeft: 12 }}>
          <Text style={bs.tileName}>{vertical ? a.name : nameLines(a.name, 14, w - 16 - logoW - 12)}</Text>
          {pageRow}
        </View>
      </View>
    </Link>
  );
}

function BanksPlate({ L, accounts, height }: { L: Layout; accounts: BankGuideAccount[]; height: number }) {
  const vertical = L.o === 'landscape';
  const gap = 10;
  const perRow = vertical ? accounts.length : 2;
  const w = (L.CW - gap * (perRow - 1)) / perRow;
  return (
    <View style={[gk.plate, { height, paddingHorizontal: L.M, paddingTop: 18 }]}>
      <Text style={[gk.label, { marginBottom: 8 }]}>{biLabel(COPY.cover.banks)}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {accounts.map((a, i) => (
          <View key={a.key} style={{ marginLeft: i % perRow ? gap : 0, marginTop: i >= perRow ? gap : 0 }}>
            <BankTile a={a} page={i + 2} vertical={vertical} w={w} />
          </View>
        ))}
      </View>
    </View>
  );
}

function Cover({ L, accounts, total }: { L: Layout; accounts: BankGuideAccount[]; total: number }) {
  const stripe = [VIREMENT.color, GUICHET.color, PREUVE.color];
  const title = COPY.cover.title;
  if (L.o === 'portrait') {
    const doorW = (L.CW - 58) / 2;
    return (
      <Page size="A4" orientation="portrait" style={[gk.page, { backgroundColor: INK }]}>
        <View style={{ paddingHorizontal: L.M, paddingTop: 32 }}>
          <CoverBrand folio={`1 / ${total}`} stripe={stripe} stripeTop={16} />
          <View style={{ marginTop: 26 }}>
            <Text style={gk.coverKicker}>{biLabel(COPY.cover.kicker)}</Text>
            <Text style={[gk.coverTitleBottom, { fontSize: fitBlack(title.fr, 44, L.CW, -0.8) }]}>{title.fr}</Text>
            <Text style={[gk.coverTitleTop, { marginTop: 4 }]}>{title.en}</Text>
          </View>
          <View style={{ marginTop: 20 }}><CoverHolder size={fitBlack(LEGAL_NAME, 26, L.CW - 36)} /></View>
          <View style={{ marginTop: 22, marginBottom: 12 }}>
            <Text style={gk.leadFr}>{COPY.cover.lead.fr}</Text>
            <Text style={gk.leadEn}>{COPY.cover.lead.en}</Text>
          </View>
          <CoverDoors doorW={doorW} />
          <View style={{ marginTop: 14 }}><ProofDoor page={total} /></View>
        </View>
        <BanksPlate L={L} accounts={accounts} height={226} />
      </Page>
    );
  }
  const doorW = (L.CW - 62) / 2;
  return (
    <Page size="A4" orientation="landscape" style={[gk.page, { backgroundColor: INK }]}>
      <View style={{ paddingHorizontal: L.M, paddingTop: 24 }}>
        <CoverBrand folio={`1 / ${total}`} stripe={stripe} stripeTop={12} />
        {/* Le titre à gauche, le titulaire unique à droite, sur la même ligne de pied. */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 14 }}>
          <View>
            <Text style={[gk.coverKicker, { marginBottom: 8 }]}>{biLabel(COPY.cover.kicker)}</Text>
            <Text style={[gk.coverTitleBottom, { fontSize: 34 }]}>{title.fr}</Text>
            <Text style={[gk.coverTitleTop, { fontSize: 20, marginTop: 2 }]}>{title.en}</Text>
          </View>
          <CoverHolder size={20} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 14, marginBottom: 9 }}>
          <Text style={[gk.leadFr, { fontSize: 17, marginRight: 10 }]}>{COPY.cover.lead.fr}</Text>
          <Text style={[gk.leadEn, { fontSize: 14, marginTop: 0 }]}>{COPY.cover.lead.en}</Text>
        </View>
        <CoverDoors doorW={doorW} padV={13} />
        <View style={{ marginTop: 10 }}><ProofDoor page={total} /></View>
      </View>
      <BanksPlate L={L} accounts={accounts} height={180} />
    </Page>
  );
}

/* ─────────────── Preuve ─────────────── */

const PROOF_TEXT = { eyebrow: COPY.preuve.eyebrow, word: COPY.preuve.word, sentence: COPY.preuve.sentence, needs: COPY.preuve.needs, needsFg: colors.gold, needsBg: INK };

function ProofPortrait({ folio, footer }: { folio: string; footer: FooterItem[] }) {
  const L = PORTRAIT;
  return (
    <Page size="A4" orientation="portrait" style={[gk.page, { backgroundColor: WHITE }]}>
      <Hero id="preuve" tone={PREUVE} inset={L.M} folio={folio} text={PROOF_TEXT} sizes={{ ghost: 300, word: 54, enWord: 28 }} ghostRight={-40} ghostOpacity={0.22} />
      <View style={{ paddingHorizontal: L.M, paddingTop: 12 }}>
        <Ticket width={L.CW} rowH={60} items={COPY.preuve.items} shot={COPY.preuve.shot} />
        <View style={{ marginTop: 12 }}><ClearLine text={COPY.preuve.clear} /></View>
      </View>
      <View style={{ position: 'absolute', left: L.M, right: L.M, bottom: 70 }}><Thanks text={COPY.preuve.thanks} /></View>
      <Footer inset={L.M} items={footer} showName={false} />
    </Page>
  );
}

function ProofLandscape({ folio, footer }: { folio: string; footer: FooterItem[] }) {
  return (
    <Page size="A4" orientation="landscape" style={[gk.page, { flexDirection: 'row', backgroundColor: WHITE }]}>
      <Sidebar
        id="preuve" tone={PREUVE} folio={folio} text={PROOF_TEXT} ghostOpacity={0.18}
        rule={<RuleText text={COPY.preuve.clear} lead={<View style={[gk.goldCheck, { width: 26, height: 26, borderRadius: 13, marginRight: 10 }]}><CheckIcon color={INK} size={13} /></View>} />}
      />
      <View style={ls.area}>
        <Ticket width={AREA_W} rowH={56} items={COPY.preuve.items} shot={COPY.preuve.shot} />
        <View style={{ marginTop: 14 }}><Thanks text={COPY.preuve.thanks} /></View>
        <Footer inset={AREA_PAD} items={footer} showName={false} />
      </View>
    </Page>
  );
}

/* ─────────────── Le document ─────────────── */

/**
 * Le livret complet (toutes les banques), ou le RIB d'une seule banque quand
 * `bank` est donné : une page, sans folio, avec le rappel de la preuve.
 */
export function BankDetailsPDF({ data, orientation = 'portrait', bank }: { data: BankGuideData; orientation?: GuideOrientation; bank?: BankOption }) {
  const L = orientation === 'landscape' ? LANDSCAPE : PORTRAIT;
  const BankPage = orientation === 'landscape' ? BankPageLandscape : BankPagePortrait;
  const single = bank ? data.accounts.find((a) => a.key === bank) : undefined;
  // Une banque absente des données, ou dont l'IBAN ne se vérifie pas, n'a pas de RIB imprimable.
  if (bank && !single) throw new Error(`RIB non disponible pour ${bank}`);

  if (single) {
    // Paysage seulement (le portrait n'a pas de pied de page).
    const footer: FooterItem[] = [{ key: 'rib', label: biLabel(COPY.docTitle), color: INK, active: true }];
    return (
      <Document title={`RIB ${single.name} — ${LEGAL_NAME}`} subject={COPY.docTitle.en} author={LEGAL_NAME} creator={LEGAL_NAME} producer={LEGAL_NAME}>
        <BankPage a={single} index={0} count={1} footer={footer} single accounts={data.accounts} />
      </Document>
    );
  }

  const { accounts } = data;
  const total = accounts.length + 2;
  /** Le pied de page du livret : les banques, puis la preuve — chacune cliquable. */
  const footerFor = (active: string): FooterItem[] => [
    ...accounts.map((a) => ({ key: a.key, label: a.short, color: INK, active: active === a.key, href: `#bank-${a.key}` })),
    { key: 'preuve', label: biLabel(COPY.way.preuve), color: colors.gold, active: active === 'preuve', href: '#preuve' },
  ];
  return (
    <Document title={`${COPY.docTitle.fr} · ${COPY.docTitle.en} — ${LEGAL_NAME}`} subject={COPY.docTitle.en} author={LEGAL_NAME} creator={LEGAL_NAME} producer={LEGAL_NAME}>
      <Cover L={L} accounts={accounts} total={total} />
      {accounts.map((a, i) => (
        <BankPage key={a.key} a={a} index={i} count={accounts.length} folio={`${i + 2} / ${total}`} footer={footerFor(a.key)} single={false} accounts={accounts} />
      ))}
      {orientation === 'landscape'
        ? <ProofLandscape folio={`${total} / ${total}`} footer={footerFor('preuve')} />
        : <ProofPortrait folio={`${total} / ${total}`} footer={footerFor('preuve')} />}
    </Document>
  );
}
