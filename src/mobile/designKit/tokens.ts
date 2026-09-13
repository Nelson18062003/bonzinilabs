/**
 * Design kit mobile — la SEULE source des valeurs visuelles de l'app admin
 * mobile. Valeurs relevées sur le Figma « Simple Design System » du projet
 * (docs/admin-redesign/mobile/01-figma-kit.md) — pas inventées, pas
 * arrondies. Décision fondateur du 13/09/2026 : le design system, c'est le
 * Figma ; la police, c'est DM Sans, et rien d'autre.
 *
 * Grammaire du kit :
 *   · canvas blanc, cartes blanches à filet #D9D9D9, rayon 8 partout
 *   · un seul primaire : l'encre #2C2C2C (le violet de marque n'existe pas
 *     dans les contrôles — il reste au logo et à la landing)
 *   · la couleur ne porte QUE le statut : Positive / Warning / Danger
 *   · aucune ombre : la séparation, c'est la bordure 1 px
 *   · rien sous 14 px, aucune cible sous 36 px
 *
 * Les noms exportés sont ceux du kit précédent (SURFACE, TEXT, PRIMARY_PILL…)
 * pour que les 73 écrans basculent sans être réécrits.
 *
 * Mode sombre : le kit public expose ses variables sombres
 * (Background 1E1E1E / 2C2C2C / 444444, Border 444444, Text F5F5F5 / B3B3B3
 * / 757575) ; elles n'ont pas pu être relues par l'API ce jour (429) et
 * viennent de la version publiée du kit.
 */

/** Surfaces. */
export const SURFACE = {
  /** La page. Background/Base/Default. */
  canvas: 'bg-white dark:bg-[#1E1E1E]',
  /** Une carte, une feuille, un menu. */
  card: 'bg-white dark:bg-[#2C2C2C]',
  /** La délimitation d'une carte : bordure 1 px, jamais d'ombre.
   *  (Le nom « shadow » est historique — gardé pour ne rien casser.) */
  shadow: 'border border-[#D9D9D9] dark:border-[#444444]',
  /** Pastille ronde neutre pour une icône ou des initiales — Icon Button Neutral. */
  holder: 'bg-[#F5F5F5] text-[#1E1E1E] dark:bg-[#383838] dark:text-[#F5F5F5]',
  /** Encart posé SUR une carte (récapitulatif, en-tête de table). Background/Base/Secondary. */
  inset: 'bg-[#F5F5F5] dark:bg-[#383838]',
  /** Le filet qui sépare deux lignes d'une même liste. */
  divider: 'border-[#D9D9D9] dark:border-[#444444]',
} as const;

/** Texte. Text/Base : Default · Neutral/Default · Secondary. */
export const TEXT = {
  strong: 'text-[#1E1E1E] dark:text-[#F5F5F5]',
  body: 'text-[#303030] dark:text-[#E3E3E3]',
  /** Text/Neutral/Secondary (#5A5A5A, 7:1 sur blanc) et non Base/Secondary
   *  (#757575) : la cible a 50–60 ans et lit au soleil. Le gris clair ne
   *  sert plus qu'aux filets. */
  muted: 'text-[#5A5A5A] dark:text-[#CDCDCD]',
  /** Le gris vraiment discret — placeholders, mentions légales. */
  faint: 'text-[#757575] dark:text-[#B3B3B3]',
  /** Texte posé sur le primaire. */
  onPrimary: 'text-[#F5F5F5] dark:text-[#1E1E1E]',
} as const;

/**
 * L'échelle typographique du kit — et aucune autre taille.
 * Heading 24/600 · Subheading 20 · Body 16 · Body Strong 16/600 ·
 * Body Small 14 · Body Small Strong 14/600. Les chiffres sont toujours
 * `tabular-nums` (DM Sans les gère ; il n'y a pas de police mono).
 */
export const TYPE = {
  heading: 'text-[24px] font-semibold leading-[1.2] tracking-[-0.02em]',
  /** Le nom qui identifie une carte (client, boîte) : 22/600. */
  title: 'text-[22px] font-semibold leading-[1.2] tracking-[-0.01em]',
  /** Ce qui compte dans une phrase : 18/600. */
  lead: 'text-[18px] font-semibold leading-[1.35]',
  subheading: 'text-[20px] font-normal leading-[1.2]',
  body: 'text-[16px] font-normal leading-[1.4]',
  bodyStrong: 'text-[16px] font-semibold leading-[1.4]',
  small: 'text-[14px] font-normal leading-[1.4]',
  smallStrong: 'text-[14px] font-semibold leading-[1.4]',
  /** Références (B/L, n° de conteneur, IBAN) : même police, chiffres alignés. */
  code: 'text-[16px] font-medium tabular-nums tracking-wide',
} as const;

/* ── Boutons ─────────────────────────────────────────────────────────────
 * Button Medium : h 40, padding 12, rayon 8, étiquette 16. Small : h 32,
 * padding 8. La hauteur et le padding sont posés par le composant ; ces
 * jetons ne portent que la couleur et la forme. */

/** Primary : fond et bord #2C2C2C, texte #F5F5F5 ; enfoncé #1E1E1E. */
export const PRIMARY_PILL =
  'rounded-lg border border-[#2C2C2C] bg-[#2C2C2C] text-[#F5F5F5] outline-none active:bg-[#1E1E1E] focus-visible:ring-2 focus-visible:ring-[#2C2C2C] focus-visible:ring-offset-2 dark:border-[#E3E3E3] dark:bg-[#E3E3E3] dark:text-[#1E1E1E] dark:active:bg-[#F5F5F5] dark:focus-visible:ring-[#E3E3E3] dark:focus-visible:ring-offset-[#1E1E1E]';
/** Neutral : fond #E3E3E3, bord #767676, texte #303030 ; enfoncé #CDCDCD. */
export const SOFT_PILL =
  'rounded-lg border border-[#767676] bg-[#E3E3E3] text-[#303030] outline-none active:bg-[#CDCDCD] focus-visible:ring-2 focus-visible:ring-[#2C2C2C] focus-visible:ring-offset-2 dark:border-[#767676] dark:bg-[#444444] dark:text-[#F5F5F5] dark:active:bg-[#5A5A5A]';
/** Subtle : rien au repos, bord #D9D9D9 quand on appuie. */
export const SUBTLE_PILL =
  'rounded-lg border border-transparent bg-transparent text-[#303030] outline-none active:border-[#D9D9D9] active:bg-[#F5F5F5] focus-visible:ring-2 focus-visible:ring-[#2C2C2C] focus-visible:ring-offset-2 dark:text-[#E3E3E3] dark:active:border-[#444444] dark:active:bg-[#383838]';
/** Danger Primary : #EC221F, bord #C00F0C ; enfoncé #C00F0C. */
export const DANGER_PILL =
  'rounded-lg border border-[#C00F0C] bg-[#EC221F] text-white outline-none active:bg-[#C00F0C] focus-visible:ring-2 focus-visible:ring-[#EC221F] focus-visible:ring-offset-2';
/** Danger Subtle : transparent, texte #900B09 ; enfoncé fond #FDD3D0. */
export const DANGER_SOFT_PILL =
  'rounded-lg border border-transparent bg-transparent text-[#900B09] outline-none active:border-[#900B09] active:bg-[#FDD3D0] dark:text-[#FCB3AD]';
/** Disabled, toutes variantes : fond #D9D9D9, bord et texte #B3B3B3. */
export const DISABLED_PILL =
  'rounded-lg border border-[#B3B3B3] bg-[#D9D9D9] text-[#B3B3B3] dark:border-[#5A5A5A] dark:bg-[#444444] dark:text-[#767676]';

/* ── Tag Toggle (les filtres) ────────────────────────────────────────────
 * h 32, rayon 8, padding 8, étiquette 14/600. On = #2C2C2C, Off = #F5F5F5. */
export const TOGGLE_ON = 'rounded-lg bg-[#2C2C2C] text-[#F5F5F5] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]';
export const TOGGLE_OFF = 'rounded-lg bg-[#F5F5F5] text-[#303030] active:bg-[#E6E6E6] dark:bg-[#383838] dark:text-[#E3E3E3]';

/* ── Statuts ─────────────────────────────────────────────────────────────
 * Tag Secondary : fond Background/<schéma>/Secondary + texte Text/<schéma>/On
 * Secondary. Cinq schémas dans le kit ; « info » prend le schéma Brand,
 * « neutral » le schéma Neutral. */
export type Tone = 'success' | 'pending' | 'danger' | 'info' | 'neutral';

export const TONE_PILL: Record<Tone, string> = {
  success: 'bg-[#CFF7D3] text-[#02542D] dark:bg-[#02542D] dark:text-[#CFF7D3]',
  pending: 'bg-[#FFF1C2] text-[#682D03] dark:bg-[#522504] dark:text-[#FFF1C2]',
  danger: 'bg-[#FDD3D0] text-[#900B09] dark:bg-[#900B09] dark:text-[#FDD3D0]',
  info: 'bg-[#E6E6E6] text-[#1E1E1E] dark:bg-[#444444] dark:text-[#F5F5F5]',
  neutral: 'bg-[#F5F5F5] text-[#303030] dark:bg-[#383838] dark:text-[#E3E3E3]',
};

/** Pastille ronde tonée (icône de résultat, de statut). */
export const TONE_HOLDER: Record<Tone, string> = {
  success: TONE_PILL.success,
  pending: TONE_PILL.pending,
  danger: TONE_PILL.danger,
  info: TONE_PILL.info,
  neutral: SURFACE.holder,
};

/** Tag Primary (plein) — pour le rare cas où le statut doit crier. */
export const TONE_SOLID: Record<Tone, string> = {
  success: 'bg-[#14AE5C] text-[#EBFFEE]',
  pending: 'bg-[#E8B931] text-[#401B01]',
  danger: 'bg-[#EC221F] text-[#FEE9E7]',
  info: 'bg-[#2C2C2C] text-[#F5F5F5]',
  neutral: 'bg-[#D9D9D9] text-[#303030]',
};

/** Texte tonés seuls (une valeur « À régler » en rouge, « Reçu » en vert). */
export const TONE_TEXT: Record<Tone, string> = {
  success: 'text-[#009951] dark:text-[#14AE5C]',
  pending: 'text-[#975102] dark:text-[#E8B931]',
  danger: 'text-[#C00F0C] dark:text-[#EC221F]',
  info: 'text-[#1E1E1E] dark:text-[#F5F5F5]',
  neutral: 'text-[#757575] dark:text-[#B3B3B3]',
};
