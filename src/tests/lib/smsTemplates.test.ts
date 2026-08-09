// ============================================================
// Test de non-régression des gabarits SMS.
//
// CE QUE CE TEST PROTÈGE : un SMS tient en 160 caractères GSM-7. Un seul
// caractère hors table (ô, ç, ê, apostrophe typographique, espace fine
// insécable…) bascule le message en UCS-2, dont le segment ne fait plus
// que 70 caractères — le message part alors en deux et le coût double,
// silencieusement, à chaque envoi.
//
// Le jour où quelqu'un écrira « dépôt » ou « reçu » dans un gabarit, ou
// remplacera nos formateurs par Intl.NumberFormat, c'est ce test qui le
// rattrapera. Il tourne en quelques millisecondes.
// ============================================================

import { describe, expect, it } from 'vitest';

import {
  foldToGsm7,
  measureSms,
  truncateForSms,
} from '../../../supabase/functions/_shared/gsm7.ts';
import {
  REASON_MAX_LENGTH,
  SMS_LOCALES,
  SMS_TEMPLATE_KEYS,
  SMS_TEMPLATES,
  formatRmb,
  formatXaf,
  renderSms,
  resolveLocale,
} from '../../../supabase/functions/_shared/sms-templates.ts';

/** Valeurs réalistes — ce que le client reçoit au quotidien. */
const TYPICAL = {
  reference: 'BZ-DP-2026-0042',
  amount_xaf: 1_500_000,
  amount_rmb: 12_500,
  new_balance: 2_350_000,
  reason: 'preuve illisible',
  when: '09/08 à 14:32',
  code: '481902',
  rate: 88.5,
};

/**
 * Valeurs maximales plausibles : référence longue, montants au plafond
 * réglementaire (50 M XAF) et au-delà pour le solde, motif de refus à la
 * limite exacte de troncature. C'est le pire cas que la production peut
 * produire — si ça tient ici, ça tient partout.
 */
const MAXIMAL = {
  reference: 'BZ-PY-2026-999999',
  amount_xaf: 999_999_999,
  amount_rmb: 9_999_999.99,
  new_balance: 999_999_999,
  reason: 'x'.repeat(REASON_MAX_LENGTH),
  when: '31/12/2026 à 23:59',
  code: '4819024816',
  rate: 9999.99,
};

describe('gsm7 — table GSM 03.38', () => {
  it('accepte les accents français présents dans la table', () => {
    // é è à ù ì ò ä ö ñ ü sont dans la table de base : ils ne coûtent rien.
    for (const word of ['validé', 'crédité', 'à', 'espèces', 'bénéficiaire', 'exécuté', 'créé']) {
      expect(measureSms(word).encoding, `"${word}" devrait rester en GSM-7`).toBe('GSM-7');
    }
  });

  it('détecte les caractères qui font basculer en UCS-2', () => {
    // Les deux pièges du vocabulaire métier : « dépôt » (ô) et « reçu » (ç).
    // C'est précisément pour ça que les gabarits disent « versement » et « preuve ».
    const traps: Array<[string, string]> = [
      ['dépôt', 'ô'],
      ['reçu', 'ç'],
      ['prêt', 'ê'],
      ['français', 'ç'],
    ];
    for (const [word, offender] of traps) {
      const m = measureSms(word);
      expect(m.encoding, `"${word}" devrait basculer en UCS-2`).toBe('UCS-2');
      expect(m.offending).toContain(offender);
    }
  });

  it('compte les caractères de la table d’extension comme deux septets', () => {
    expect(measureSms('€').length).toBe(2);
    expect(measureSms('[').length).toBe(2);
  });

  it('bascule à 2 segments au-delà de 160 caractères GSM-7', () => {
    expect(measureSms('a'.repeat(160)).segments).toBe(1);
    expect(measureSms('a'.repeat(161)).segments).toBe(2);
  });

  it('bascule à 2 segments au-delà de 70 caractères UCS-2', () => {
    // 'ô' est hors table : tout le message passe en UCS-2 à 70 par segment.
    expect(measureSms('ô'.repeat(70)).segments).toBe(1);
    expect(measureSms('ô'.repeat(71)).segments).toBe(2);
  });
});

describe('gsm7 — repli et troncature', () => {
  it('replie les caractères hors table vers leur équivalent GSM-7', () => {
    // Repli MINIMAL : seul le caractère fautif est remplacé. « dépôt » perd
    // son ô mais garde son é, qui est parfaitement valide en GSM-7 — aplatir
    // tous les accents dégraderait le texte sans faire gagner un octet.
    expect(foldToGsm7('dépôt')).toBe('dépot');
    expect(foldToGsm7('reçu')).toBe('recu');
    expect(measureSms(foldToGsm7('dépôt reçu prêt')).encoding).toBe('GSM-7');
  });

  it('conserve les accents déjà valides plutôt que de les aplatir', () => {
    // Aplatir « validé » en « valide » dégraderait le texte sans rien gagner.
    expect(foldToGsm7('validé crédité à')).toBe('validé crédité à');
  });

  it('replie les espaces insécables, invisibles mais fatals', () => {
    expect(measureSms(foldToGsm7('1 500 000')).encoding).toBe('GSM-7');
  });

  it('tronque avec des points ASCII, jamais le caractère ellipse', () => {
    const out = truncateForSms('a'.repeat(100), 20);
    expect(out.length).toBe(20);
    expect(out.endsWith('...')).toBe(true);
    expect(measureSms(out).encoding).toBe('GSM-7');
  });

  it('laisse intact un texte déjà assez court', () => {
    expect(truncateForSms('court', 20)).toBe('court');
  });
});

describe('formateurs de montants', () => {
  it('groupe les milliers sans espace insécable (piège Intl)', () => {
    // Intl.NumberFormat('fr-FR') utilise U+202F, hors table GSM-7 : tout
    // message contenant un montant basculerait en UCS-2. Nos formateurs
    // doivent produire une espace ASCII.
    const formatted = formatXaf(1_500_000);
    expect(formatted).toBe('1 500 000');
    expect(formatted).not.toMatch(/[\u00a0\u202f]/);
    expect(measureSms(formatted).encoding).toBe('GSM-7');
  });

  it('formate les montants RMB avec deux décimales', () => {
    expect(formatRmb(12_500)).toBe('12 500.00');
    expect(measureSms(formatRmb(9_999_999.99)).encoding).toBe('GSM-7');
  });

  it('ne casse pas sur une valeur absente ou illisible', () => {
    expect(formatXaf(null)).toBe('0');
    expect(formatXaf(undefined)).toBe('0');
    expect(formatXaf('pas un nombre')).toBe('0');
    expect(formatRmb(null)).toBe('0.00');
  });

  it('accepte les montants renvoyés en chaîne par PostgreSQL', () => {
    // numeric revient souvent en string via PostgREST.
    expect(formatXaf('1500000')).toBe('1 500 000');
    expect(formatRmb('12500.5')).toBe('12 500.50');
  });
});

describe('gabarits SMS — contrainte du segment unique', () => {
  it('couvre les 17 événements dans les 2 langues', () => {
    expect(SMS_TEMPLATE_KEYS).toHaveLength(17);
    for (const key of SMS_TEMPLATE_KEYS) {
      for (const locale of SMS_LOCALES) {
        expect(SMS_TEMPLATES[key][locale], `${key}.${locale} manquant`).toBeTypeOf('function');
      }
    }
  });

  // Le cœur du test : 34 combinaisons × 2 jeux de valeurs.
  for (const key of SMS_TEMPLATE_KEYS) {
    for (const locale of SMS_LOCALES) {
      it(`${key} [${locale}] tient en un segment GSM-7`, () => {
        for (const [label, vars] of [['typique', TYPICAL], ['maximal', MAXIMAL]] as const) {
          const rendered = renderSms(key, locale, vars);
          expect(rendered, `${key}.${locale} n'a rien rendu`).not.toBeNull();

          const { text, measure } = rendered!;
          expect(
            measure.encoding,
            `${key}.${locale} (${label}) bascule en UCS-2 à cause de : ${measure.offending.join(' ')} — texte : ${text}`,
          ).toBe('GSM-7');
          expect(
            measure.segments,
            `${key}.${locale} (${label}) fait ${measure.length} caractères : ${text}`,
          ).toBe(1);
        }
      });
    }
  }

  it('tronque un motif de refus démesuré plutôt que de scinder le message', () => {
    const rendered = renderSms('deposit_rejected', 'fr', {
      ...TYPICAL,
      reason: 'le justificatif transmis est totalement illisible et ne permet pas '.repeat(10),
    });
    expect(rendered!.measure.segments).toBe(1);
    expect(rendered!.text).toContain('...');
  });

  it('reste sur un segment même si la référence est absurde', () => {
    const rendered = renderSms('payment_completed', 'fr', {
      ...TYPICAL,
      reference: 'REF-'.repeat(40),
    });
    expect(rendered!.measure.segments).toBe(1);
  });

  it('replie les valeurs dynamiques accentuées venant de la base', () => {
    // Un motif saisi à la main par un admin contient volontiers « dépôt ».
    const rendered = renderSms('deposit_rejected', 'fr', {
      ...TYPICAL,
      reason: 'dépôt non conforme, reçu manquant',
    });
    expect(rendered!.measure.encoding).toBe('GSM-7');
    // ô et ç repliés, é conservé : dégradation minimale, coût préservé.
    expect(rendered!.text).toContain('dépot non conforme, recu manquant');
  });

  it('porte le préfixe Bonzini sur tous les gabarits', () => {
    // Sur les réseaux qui réécrivent l'expéditeur alphanumérique (Chine, US,
    // Canada…), c'est la seule chose qui identifie l'émetteur.
    for (const key of SMS_TEMPLATE_KEYS) {
      for (const locale of SMS_LOCALES) {
        expect(renderSms(key, locale, TYPICAL)!.text.startsWith('Bonzini: ')).toBe(true);
      }
    }
  });

  it('n’insère aucune URL dans un message d’argent', () => {
    // Les liens nus attirent le filtrage opérateur et se lisent comme du
    // phishing sur un message financier.
    for (const key of SMS_TEMPLATE_KEYS) {
      for (const locale of SMS_LOCALES) {
        expect(renderSms(key, locale, TYPICAL)!.text).not.toMatch(/https?:\/\//);
      }
    }
  });
});

describe('rendu — cas limites', () => {
  it('renvoie null pour un gabarit inconnu plutôt que de jeter', () => {
    // L'appelant marque alors la ligne 'skipped' au lieu de faire tomber le lot.
    expect(renderSms('gabarit_inexistant', 'fr', {})).toBeNull();
  });

  it('rend un message lisible même avec un payload vide', () => {
    const rendered = renderSms('deposit_validated', 'fr', {});
    expect(rendered!.measure.segments).toBe(1);
    expect(rendered!.text).toContain('votre operation');
  });

  it('retombe sur le français pour une langue inconnue', () => {
    expect(resolveLocale('zh')).toBe('fr');
    expect(resolveLocale(null)).toBe('fr');
    expect(resolveLocale('')).toBe('fr');
  });

  it('reconnaît les variantes régionales', () => {
    expect(resolveLocale('fr-CM')).toBe('fr');
    expect(resolveLocale('en-GB')).toBe('en');
    expect(resolveLocale('EN')).toBe('en');
  });
});
