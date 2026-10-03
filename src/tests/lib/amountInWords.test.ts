import { describe, expect, it } from 'vitest';
import { numberToWordsEn, numberToWordsFr, xafInWords } from '@/lib/amountInWords';

const NBSP = '\u00a0';

describe('numberToWordsFr — le montant en lettres du devis', () => {
  it.each([
    [0, 'zéro'], [1, 'un'], [16, 'seize'], [17, 'dix-sept'], [21, 'vingt et un'], [31, 'trente et un'],
    [70, 'soixante-dix'], [71, 'soixante et onze'], [77, 'soixante-dix-sept'], [80, 'quatre-vingts'],
    [81, 'quatre-vingt-un'], [90, 'quatre-vingt-dix'], [91, 'quatre-vingt-onze'], [99, 'quatre-vingt-dix-neuf'],
    [100, 'cent'], [101, 'cent un'], [200, 'deux cents'], [280, 'deux cent quatre-vingts'], [999, 'neuf cent quatre-vingt-dix-neuf'],
  ])('%i → %s', (n, words) => expect(numberToWordsFr(n)).toBe(words));

  it('« mille », jamais « un mille », et invariable', () => {
    expect(numberToWordsFr(1000)).toBe('mille');
    expect(numberToWordsFr(2000)).toBe('deux mille');
    expect(numberToWordsFr(1200)).toBe('mille deux cents');
  });

  it('« cent » et « vingt » ne prennent pas de s devant « mille »', () => {
    expect(numberToWordsFr(700_000)).toBe('sept cent mille');
    expect(numberToWordsFr(80_000)).toBe('quatre-vingt mille');
    expect(numberToWordsFr(280_000)).toBe('deux cent quatre-vingt mille');
  });

  it('mais en prennent devant « millions », qui est un nom', () => {
    expect(numberToWordsFr(1_000_000)).toBe('un million');
    expect(numberToWordsFr(200_000_000)).toBe('deux cents millions');
    expect(numberToWordsFr(80_000_000)).toBe('quatre-vingts millions');
  });

  it('les montants des packing lists (vérifiés à la main)', () => {
    expect(numberToWordsFr(788_700)).toBe('sept cent quatre-vingt-huit mille sept cents');
    expect(numberToWordsFr(219_840)).toBe('deux cent dix-neuf mille huit cent quarante');
    expect(numberToWordsFr(9_849_900)).toBe('neuf millions huit cent quarante-neuf mille neuf cents');
    expect(numberToWordsFr(133_500_000)).toBe('cent trente-trois millions cinq cent mille');
  });
});

describe('numberToWordsEn', () => {
  it.each([
    [0, 'zero'], [15, 'fifteen'], [21, 'twenty-one'], [100, 'one hundred'], [101, 'one hundred one'],
    [1000, 'one thousand'], [219_840, 'two hundred nineteen thousand eight hundred forty'],
    [9_849_900, 'nine million eight hundred forty-nine thousand nine hundred'], [1_000_000_000, 'one billion'],
  ])('%i → %s', (n, words) => expect(numberToWordsEn(n)).toBe(words));
});

describe('xafInWords', () => {
  it('une majuscule, la devise dans la langue du document', () => {
    expect(xafInWords(219_840, 'fr')).toBe(`Deux cent dix-neuf mille huit cent quarante francs${NBSP}CFA`);
    expect(xafInWords(219_840, 'en')).toBe(`Two hundred nineteen thousand eight hundred forty CFA${NBSP}francs`);
  });
  it('« de » après million / milliard quand rien ne suit', () => {
    expect(xafInWords(1_000_000, 'fr')).toBe(`Un million de francs${NBSP}CFA`);
    expect(xafInWords(3_000_000, 'fr')).toBe(`Trois millions de francs${NBSP}CFA`);
    expect(xafInWords(2_000_000_000, 'fr')).toBe(`Deux milliards de francs${NBSP}CFA`);
    expect(xafInWords(2_500_000, 'fr')).toBe(`Deux millions cinq cent mille francs${NBSP}CFA`);
    expect(xafInWords(3_000_000, 'en')).toBe(`Three million CFA${NBSP}francs`);
  });
  it('le singulier : « un franc », « zéro franc », « one CFA franc »', () => {
    expect(xafInWords(1, 'fr')).toBe(`Un franc${NBSP}CFA`);
    expect(xafInWords(0, 'fr')).toBe(`Zéro franc${NBSP}CFA`);
    expect(xafInWords(1, 'en')).toBe(`One CFA${NBSP}franc`);
    expect(xafInWords(0, 'en')).toBe(`Zero CFA${NBSP}francs`);
  });
  it('rien au-delà de 999 milliards (le chiffre seul fait foi)', () => {
    expect(xafInWords(1e12, 'fr')).toBe('');
    expect(xafInWords(999_999_999_999, 'fr')).toMatch(/^Neuf cent quatre-vingt-dix-neuf milliards/);
  });
  it('arrondit et ignore le signe (une remise s’écrit en chiffres)', () => {
    expect(xafInWords(1000.4, 'fr')).toBe(`Mille francs${NBSP}CFA`);
    expect(xafInWords(-5, 'en')).toBe(`Five CFA${NBSP}francs`);
  });
});
