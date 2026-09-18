/**
 * Saisie téléphonique — formatage, validation, forme canonique.
 *
 * Avant, le formulaire « Nouveau client » concaténait bêtement l'indicatif
 * choisi et ce que l'opérateur avait tapé, en retirant les espaces :
 *
 *     `${countryCode}${form.phone.trim()}`.replace(/[\s\-.()]/g, '')
 *
 * Un « 0 » d'usage devant le numéro national, un indicatif déjà tapé par
 * l'opérateur, un numéro trop court : tout passait, et l'échec arrivait
 * plus tard, à l'envoi WhatsApp, sans rien pour dire pourquoi. La seule
 * garde était `phone.trim().length >= 9`.
 *
 * Ces cas-là sont ceux qui suivent.
 */
import { describe, it, expect } from 'vitest';
import {
  formatNational,
  isPhoneComplete,
  toE164,
  fromE164,
  callingCode,
  formatE164ForDisplay,
} from '@/components/form/PhoneNumberInput';
import { COUNTRY_ISOS, countryName } from '@/data/countries';

describe('Formatage au fil de la frappe', () => {
  it('groupe un numéro camerounais', () => {
    expect(formatNational('699000000', 'CM')).toBe('6 99 00 00 00');
  });

  it('groupe un numéro chinois', () => {
    expect(formatNational('13022045608', 'CN')).toBe('130 2204 5608');
  });

  it('ne perd aucun chiffre en cours de saisie', () => {
    for (const partial of ['6', '69', '699', '6990', '69900', '699000000']) {
      expect(formatNational(partial, 'CM').replace(/\D/g, '')).toBe(partial);
    }
  });

  it('ignore ce que l’opérateur tape comme séparateurs', () => {
    expect(formatNational('6-99.00 00(00)', 'CM')).toBe(formatNational('699000000', 'CM'));
  });

  it('reformate sans perte quand on change de pays', () => {
    const asCM = formatNational('699000000', 'CM');
    const asFR = formatNational(asCM, 'FR');
    expect(asFR.replace(/\D/g, '')).toBe('699000000');
  });
});

describe('Validation', () => {
  it('accepte un vrai numéro camerounais', () => {
    expect(isPhoneComplete({ country: 'CM', national: '6 99 00 00 00' })).toBe(true);
  });

  it('refuse un numéro trop court', () => {
    // L'ancienne règle — neuf caractères, espaces compris — laissait passer
    // « 699 00 00 » (huit chiffres).
    expect(isPhoneComplete({ country: 'CM', national: '699 00 00' })).toBe(false);
  });

  it('refuse un préfixe qui n’existe pas dans le pays', () => {
    // Au Cameroun les mobiles commencent par 6 ; « 1 » n'est attribué à rien.
    expect(isPhoneComplete({ country: 'CM', national: '199000000' })).toBe(false);
  });

  it('refuse le vide', () => {
    expect(isPhoneComplete({ country: 'CM', national: '' })).toBe(false);
  });
});

describe('Forme canonique E.164', () => {
  it('produit +237699000000', () => {
    expect(toE164({ country: 'CM', national: '6 99 00 00 00' })).toBe('+237699000000');
  });

  it('renvoie null tant que le numéro est incomplet — jamais un numéro tronqué', () => {
    expect(toE164({ country: 'CM', national: '699' })).toBeNull();
  });

  it('fait l’aller-retour sans dérive', () => {
    const back = fromE164('+237699000000');
    expect(back.country).toBe('CM');
    expect(toE164(back)).toBe('+237699000000');
  });

  it('supporte un E.164 étranger', () => {
    const back = fromE164('+8613022045608');
    expect(back.country).toBe('CN');
    expect(back.national).toBe('130 2204 5608');
  });

  it('affiche un E.164 lisiblement', () => {
    expect(formatE164ForDisplay('+237699000000')).toBe('+237 6 99 00 00 00');
    expect(formatE164ForDisplay(null)).toBe('—');
  });
});

describe('Liste des pays', () => {
  it('chaque indicatif est dérivé de la bibliothèque, pas écrit à la main', () => {
    // Quelques ancres connues : si la dérivation cassait, elles bougeraient.
    expect(callingCode('CM')).toBe('+237');
    expect(callingCode('CN')).toBe('+86');
    expect(callingCode('CF')).toBe('+236');
  });

  it('tous les pays du monde sont proposés, sans doublon', () => {
    expect(COUNTRY_ISOS.length).toBeGreaterThan(200);
    expect(new Set(COUNTRY_ISOS).size).toBe(COUNTRY_ISOS.length);
    // Le cas qui a déclenché la refonte : un client de Sierra Leone.
    expect(COUNTRY_ISOS).toContain('SL');
    expect(callingCode('SL')).toBe('+232');
  });

  it('tout pays proposé a un indicatif calculable et un nom en trois langues', () => {
    for (const iso of COUNTRY_ISOS) {
      expect(() => callingCode(iso), `indicatif introuvable : ${iso}`).not.toThrow();
      expect(countryName(iso, 'fr')).not.toBe('');
      expect(countryName(iso, 'en')).not.toBe(iso);
      expect(countryName(iso, 'zh')).not.toBe(iso);
    }
  });

  it('le format E.164 produit respecte la contrainte SQL de client_phones', () => {
    // La base refuse tout ce qui ne matche pas ^\+[1-9][0-9]{6,14}$ : le
    // client ne doit jamais pouvoir produire une valeur qu'elle rejettera.
    const sqlShape = /^\+[1-9][0-9]{6,14}$/;
    for (const [country, national] of [
      ['CM', '699000000'],
      ['CN', '13022045608'],
      ['FR', '612345678'],
      ['SN', '771234567'],
    ] as const) {
      const e164 = toE164({ country, national: formatNational(national, country) });
      expect(e164, `${country} ${national}`).toMatch(sqlShape);
    }
  });
});
