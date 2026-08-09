// ============================================================
// GSM 03.38 — encodage et découpage en segments SMS.
//
// POURQUOI CE FICHIER EXISTE : un SMS s'encode en GSM-7 (160 caractères
// par segment). UN SEUL caractère hors de cet alphabet bascule TOUT le
// message en UCS-2, qui ne tient plus que 70 caractères par segment.
// Un message de 95 caractères cesse alors d'être un message et en devient
// deux — à chaque envoi, pour toujours. Le coût double en silence.
//
// PIÈGE FRANÇAIS (vérifié contre la table réelle) : é è à ù ì ò ä ö ñ ü
// passent tous en GSM-7. Ce sont les accents circonflexes (ô ê î û â) et
// la cédille MINUSCULE (ç) qui cassent — noter que Ç majuscule EST dans la
// table alors que ç minuscule n'y est pas. Conséquence directe : « dépôt »
// et « reçu », nos deux mots les plus fréquents, font doubler le coût.
// On écrit donc « versement » et « preuve ».
//
// Aucun import : ce module doit tourner à la fois sous Deno (edge function
// send-sms) et sous vitest (test de non-régression des gabarits).
// ============================================================

/** Table de base GSM 03.38 — 1 septet par caractère. */
const GSM7_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
  "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";

/** Table d'extension — 2 septets par caractère (préfixe ESC). */
const GSM7_EXTENDED = "^{}\\[~]|€";

const BASIC = new Set(Array.from(GSM7_BASIC));
const EXTENDED = new Set(Array.from(GSM7_EXTENDED));

export const GSM7_SINGLE = 160;
export const GSM7_MULTI = 153; // 7 septets consommés par l'en-tête de concaténation
export const UCS2_SINGLE = 70;
export const UCS2_MULTI = 67;

export type SmsEncoding = "GSM-7" | "UCS-2";

export interface SmsMeasure {
  encoding: SmsEncoding;
  /** Septets (GSM-7) ou unités de code UTF-16 (UCS-2). */
  length: number;
  segments: number;
  /** Caractères ayant forcé le passage en UCS-2 — vide si GSM-7. */
  offending: string[];
}

/** true si le caractère appartient à l'alphabet GSM-7 (base ou extension). */
export function isGsm7Char(ch: string): boolean {
  return BASIC.has(ch) || EXTENDED.has(ch);
}

/**
 * Mesure un message : encodage retenu, longueur et nombre de segments.
 * C'est la fonction que le test de non-régression interroge pour garantir
 * qu'aucun gabarit ne dépasse un segment.
 */
export function measureSms(text: string): SmsMeasure {
  const chars = Array.from(text);
  const offending: string[] = [];
  let septets = 0;

  for (const ch of chars) {
    if (BASIC.has(ch)) {
      septets += 1;
    } else if (EXTENDED.has(ch)) {
      septets += 2;
    } else {
      septets += 1;
      if (!offending.includes(ch)) offending.push(ch);
    }
  }

  if (offending.length > 0) {
    // Un seul caractère hors table suffit à basculer tout le message.
    const length = chars.length;
    return {
      encoding: "UCS-2",
      length,
      segments: length <= UCS2_SINGLE ? 1 : Math.ceil(length / UCS2_MULTI),
      offending,
    };
  }

  return {
    encoding: "GSM-7",
    length: septets,
    segments: septets <= GSM7_SINGLE ? 1 : Math.ceil(septets / GSM7_MULTI),
    offending: [],
  };
}

/**
 * Tronque un texte libre (motif de refus, nom de bénéficiaire…) pour qu'il
 * tienne dans le budget restant du gabarit.
 *
 * Indispensable : un motif de refus saisi par un admin est du texte libre,
 * et rien n'empêche qu'il fasse 300 caractères. Sans cette troncature, le
 * message se scinderait silencieusement en deux — le coût double sans que
 * personne ne le voie passer.
 */
export function truncateForSms(value: string, maxLength: number): string {
  const chars = Array.from(value.trim());
  if (chars.length <= maxLength) return chars.join("");
  if (maxLength <= 1) return chars.slice(0, Math.max(0, maxLength)).join("");
  // '...' plutôt que '…' : le caractère ellipse n'est pas dans la table GSM-7.
  return chars.slice(0, maxLength - 3).join("").trimEnd() + "...";
}

// N'y figurent QUE des caracteres reellement absents de la table GSM-7.
// Les accents deja couverts (e-aigu, e-grave, a-grave, u-grave, i-grave,
// o-grave, a-trema, o-trema, n-tilde, u-trema, C-cedille, E-aigu, ae) n'ont
// rien a faire ici : isGsm7Char les laisse passer avant meme de consulter
// cette table.
const FOLD_MAP: Record<string, string> = {
  // Circonflexes — aucun n'est dans la table GSM-7.
  "â": "a", "ê": "e", "î": "i", "ô": "o", "û": "u",
  "Â": "A", "Ê": "E", "Î": "I", "Ô": "O", "Û": "U",
  // Cedille minuscule (la majuscule, elle, est dans la table).
  "ç": "c",
  // Tremas absents de la table.
  "ë": "e", "ï": "i", "ÿ": "y",
  // Majuscules accentuees absentes (leurs minuscules sont dans la table).
  "À": "A", "È": "E", "Ù": "U", "Ì": "I", "Ò": "O",
  // Ligatures.
  "œ": "oe", "Œ": "OE",
  // Ponctuation typographique — substituee en silence par les editeurs.
  "‘": "'", "’": "'", "“": '"', "”": '"',
  "–": "-", "—": "-", "…": "...",
  // Espaces non-ASCII : insecable et fine insecable (frequentes dans les
  // montants formates en francais, et absentes de la table GSM-7).
  " ": " ", " ": " ",
};

/**
 * Remplace les caractères hors GSM-7 par leur équivalent le plus proche.
 * Filet de sécurité de dernier recours appliqué juste avant l'envoi : si une
 * valeur dynamique (nom de bénéficiaire translittéré, motif saisi à la main)
 * contient un « ô » ou un « ç », on préfère un message légèrement dégradé à
 * un message facturé double.
 *
 * N'est PAS appliqué aux caractères non latins (chinois, arabe) : là, l'UCS-2
 * est légitime et la dégradation détruirait le sens.
 */
export function foldToGsm7(text: string): string {
  let out = "";
  for (const ch of Array.from(text)) {
    if (isGsm7Char(ch)) {
      out += ch;
      continue;
    }
    const folded = FOLD_MAP[ch];
    // Pas de correspondance connue (idéogramme, cyrillique…) : on conserve
    // le caractère tel quel et on assume l'UCS-2.
    out += folded !== undefined ? folded : ch;
  }
  return out;
}
