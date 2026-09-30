// ============================================================
// Le scénario tient dans l'URL : ce qu'un client partage, un autre le rouvre
// à l'identique.
// ============================================================
import { describe, it, expect } from 'vitest';
import { DEFAULT_STATE, parseSimState, serializeSimState, toSimulationInput, vehicleKindOf, bandsBetween, num, type SimState } from '@/lib/customs/simulatorState';

describe('simulatorState', () => {
  it('aller-retour : l’URL rend exactement l’état', () => {
    const s: SimState = {
      ...DEFAULT_STATE, code: '870323', amount: '7437000', currency: 'XAF', xaf: '1', incoterm: 'CIF',
      regime: 'hors_fichier', used: true, year: '2021', cc: '2487', compare: '870322', duty: 30,
    };
    expect(parseSimState(new URLSearchParams(serializeSimState(s)))).toEqual(s);
  });

  it('un lien vide donne l’état par défaut ; le défaut ne pollue pas l’URL', () => {
    expect(parseSimState(new URLSearchParams(''))).toEqual(DEFAULT_STATE);
    expect(serializeSimState(DEFAULT_STATE)).toBe('');
  });

  it('un lien bricolé ne casse rien : code ramené à 6 chiffres, valeurs inconnues ignorées', () => {
    const s = parseSimState(new URLSearchParams('c=8517.13.00&cur=BTC&inc=DDP&reg=vip&a=12<script>'));
    expect(s.code).toBe('851713');
    expect(s.currency).toBe('CNY');
    expect(s.incoterm).toBe('FOB');
    expect(s.regime).toBe('reel');
    expect(s.amount).toBe('12');
  });

  it('num : espaces, virgule décimale ; rien de négatif ni de nul', () => {
    expect(num('1 250 000,5')).toBe(1250000.5);
    expect(num('0')).toBeNull();
    expect(num('')).toBeNull();
    expect(num('abc')).toBeNull();
  });

  it('le formulaire véhicule suit le code', () => {
    expect(vehicleKindOf('870323')).toBe('car');
    expect(vehicleKindOf('870421')).toBe('utility');
    expect(vehicleKindOf('870193')).toBe('tractor');
    expect(vehicleKindOf('871120')).toBe('motorcycle');
    expect(vehicleKindOf('851713')).toBeNull();
  });

  it('toSimulationInput : rien tant que le montant manque ; un véhicule neuf a zéro an', () => {
    expect(toSimulationInput(DEFAULT_STATE, '851713', 10, 2026)).toBeNull();
    const input = toSimulationInput({ ...DEFAULT_STATE, amount: '10000', cc: '1600' }, '870323', 30, 2026)!;
    expect(input.vehicle).toMatchObject({ kind: 'car', engineCc: 1600, firstRegistrationYear: 2026, used: false });
  });

  it('un tracteur déclaré agricole est exonéré de TVA et d’accises', () => {
    const input = toSimulationInput({ ...DEFAULT_STATE, amount: '6057', agricultural: true }, '870193', 10, 2026)!;
    expect(input.vehicle!.agricultural).toBe(true);
    expect(input.agriculturalUse).toBe(true);
  });

  it('les bandes entre deux bornes', () => {
    expect(bandsBetween(5, 20)).toEqual([5, 10, 20]);
    expect(bandsBetween(30, 30)).toEqual([30]);
    expect(bandsBetween(null, 30)).toEqual([]);
  });
});
