// ============================================================
// Normalisation E.164 — tests.
//
// CE QUE CES TESTS PROTÈGENT : un numéro mal normalisé ne provoque pas
// d'erreur visible. Telnyx accepte l'appel, facture le message, et il
// n'arrive nulle part — ou pire, il arrive chez quelqu'un d'autre. Comme
// nos SMS contiennent des soldes et des références de paiement, le cas
// « on a deviné le pays » doit rester impossible, pas seulement improbable.
// ============================================================

import { describe, expect, it } from 'vitest';

import {
  countryNameToIso,
  formatPhoneForDisplay,
  isValidE164,
  normalizePhone,
} from '@/lib/phone';

describe('isValidE164', () => {
  it('accepte un E.164 bien formé', () => {
    expect(isValidE164('+237677889900')).toBe(true);
    expect(isValidE164('+8613800138000')).toBe(true);
    expect(isValidE164('+33612345678')).toBe(true);
  });

  it('refuse tout ce qui n’est pas du E.164 strict', () => {
    expect(isValidE164('677889900')).toBe(false); // pas d'indicatif
    expect(isValidE164('+0237677889900')).toBe(false); // indicatif commençant par 0
    expect(isValidE164('+237 677 889 900')).toBe(false); // espaces
    expect(isValidE164('+2376778')).toBe(false); // moins de 8 chiffres
    expect(isValidE164('')).toBe(false);
    expect(isValidE164(null)).toBe(false);
    expect(isValidE164(42)).toBe(false);
  });

  it('ne contrôle que la forme, pas le plan de numérotation', () => {
    // « +23767788 » a la bonne forme E.164 mais n'est pas un numéro
    // camerounais valide. Séparer les deux niveaux est délibéré : c'est
    // normalizePhone, via libphonenumber, qui tranche sur l'existence réelle.
    expect(isValidE164('+23767788')).toBe(true);
    expect(normalizePhone('+23767788')).toBeNull();
  });
});

describe('countryNameToIso', () => {
  it('résout les libellés français stockés par l’application', () => {
    expect(countryNameToIso('Cameroun')).toBe('CM');
    expect(countryNameToIso('Chine')).toBe('CN');
    expect(countryNameToIso('France')).toBe('FR');
    expect(countryNameToIso("Côte d'Ivoire")).toBe('CI');
    expect(countryNameToIso('Sénégal')).toBe('SN');
  });

  it('tolère accents, casse et espaces surnuméraires', () => {
    expect(countryNameToIso('  CAMEROUN  ')).toBe('CM');
    expect(countryNameToIso('Guinée Équatoriale')).toBe('GQ');
    expect(countryNameToIso('guinee equatoriale')).toBe('GQ');
  });

  it('accepte un code ISO déjà propre', () => {
    expect(countryNameToIso('CM')).toBe('CM');
    expect(countryNameToIso('cn')).toBe('CN');
  });

  it('gère les libellés composés des jeux de données existants', () => {
    // countryCodes.ts contient « États-Unis / Canada » sur le +1.
    expect(countryNameToIso('États-Unis / Canada')).toBe('US');
    expect(countryNameToIso('RCA')).toBe('CF'); // synonyme de Centrafrique
  });

  it('renvoie undefined plutôt que de deviner', () => {
    expect(countryNameToIso('Pays imaginaire')).toBeUndefined();
    expect(countryNameToIso('')).toBeUndefined();
    expect(countryNameToIso(null)).toBeUndefined();
  });
});

describe('normalizePhone — numéros déjà internationaux', () => {
  it('normalise un numéro camerounais', () => {
    const r = normalizePhone('+237677889900');
    expect(r?.e164).toBe('+237677889900');
    expect(r?.country).toBe('CM');
  });

  it('nettoie espaces, tirets et parenthèses', () => {
    expect(normalizePhone('+237 6 77 88 99 00')?.e164).toBe('+237677889900');
    expect(normalizePhone('+237-677-889-900')?.e164).toBe('+237677889900');
  });

  it('convertit le préfixe 00 en +', () => {
    expect(normalizePhone('00237677889900')?.e164).toBe('+237677889900');
  });

  it('couvre les marchés retenus : Afrique, Chine, Europe, Amérique du Nord', () => {
    expect(normalizePhone('+8613800138000')?.country).toBe('CN');
    expect(normalizePhone('+33612345678')?.country).toBe('FR');
    expect(normalizePhone('+14155552671')?.country).toBe('US');
    expect(normalizePhone('+2348012345678')?.country).toBe('NG');
  });

  it('ignore l’indice de pays quand le numéro est déjà international', () => {
    // Le « + » fait autorité : un indice contradictoire ne doit rien casser.
    const r = normalizePhone('+8613800138000', 'Cameroun');
    expect(r?.e164).toBe('+8613800138000');
    expect(r?.country).toBe('CN');
  });
});

describe('normalizePhone — numéros au format local', () => {
  it('normalise avec un indice de pays', () => {
    expect(normalizePhone('677889900', 'Cameroun')?.e164).toBe('+237677889900');
    expect(normalizePhone('06 12 34 56 78', 'France')?.e164).toBe('+33612345678');
  });

  it('REFUSE un numéro local sans indice de pays', () => {
    // Le cœur du module : « 677889900 » est valide au Cameroun mais la même
    // suite existe ailleurs. Deviner enverrait un solde au mauvais numéro.
    expect(normalizePhone('677889900')).toBeNull();
    expect(normalizePhone('0612345678')).toBeNull();
  });

  it('refuse un pays inconnu plutôt que de retomber sur un défaut', () => {
    expect(normalizePhone('677889900', 'Pays imaginaire')).toBeNull();
  });
});

describe('normalizePhone — rejets', () => {
  it('refuse les numéros invalides pour leur plan de numérotation', () => {
    // Trop court pour le Cameroun : une regex maison laisserait passer.
    expect(normalizePhone('+23712')).toBeNull();
    expect(normalizePhone('12345', 'Cameroun')).toBeNull();
  });

  it('refuse les entrées vides ou non textuelles', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('   ')).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone(237677889900)).toBeNull();
  });

  it('refuse le texte libre', () => {
    expect(normalizePhone('appelez-moi')).toBeNull();
    expect(normalizePhone('+237 pas un numero')).toBeNull();
  });

  it('produit toujours un e164 conforme quand il réussit', () => {
    const inputs: Array<[string, string | undefined]> = [
      ['+237677889900', undefined],
      ['677889900', 'Cameroun'],
      ['00237677889900', undefined],
      ['+8613800138000', undefined],
      ['06 12 34 56 78', 'France'],
    ];
    for (const [input, hint] of inputs) {
      const r = normalizePhone(input, hint);
      expect(r, `${input} aurait dû être normalisé`).not.toBeNull();
      expect(isValidE164(r!.e164), `${input} → ${r!.e164}`).toBe(true);
    }
  });
});

describe('formatPhoneForDisplay', () => {
  it('met en forme un E.164 valide', () => {
    expect(formatPhoneForDisplay('+237677889900')).toBe('+237 6 77 88 99 00');
  });

  it('retombe sur la valeur brute plutôt que de masquer un numéro cassé', () => {
    expect(formatPhoneForDisplay('pas un numero')).toBe('pas un numero');
    expect(formatPhoneForDisplay(null)).toBe('');
  });
});
