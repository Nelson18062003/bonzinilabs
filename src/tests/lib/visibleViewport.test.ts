import { describe, it, expect } from 'vitest';
import { computeViewportVars, KEYBOARD_MIN_PX } from '@/hooks/keyboard/useVisibleViewportSync';

// Géométrie iPhone 14 Pro dans Safari, barres visibles : 660 px visibles,
// clavier ≈ 350 px → 310 px au-dessus, viewport visuel décalé de 208 px.
const CLOSED = 660;
const OPEN = 310;
const PAN = 208;

describe('computeViewportVars — le cadre suit le clavier et s’en remet', () => {
  it('clavier fermé : hauteur visible, pas de décalage, pas de clavier', () => {
    const v = computeViewportVars({ height: CLOSED, offsetTop: 0, editableFocused: false, baseHeight: CLOSED });
    expect(v).toMatchObject({ vvh: CLOSED, vvt: 0, vvk: 0, keyboardOpen: false, baseHeight: CLOSED });
  });

  it('clavier ouvert : le cadre se réduit et descend avec le viewport visuel', () => {
    const v = computeViewportVars({ height: OPEN, offsetTop: PAN, editableFocused: true, baseHeight: CLOSED });
    expect(v).toMatchObject({ vvh: OPEN, vvt: PAN, vvk: CLOSED - OPEN, keyboardOpen: true, baseHeight: CLOSED });
  });

  it('la hauteur de base ne descend jamais à la hauteur « clavier ouvert »', () => {
    // Si le focus arrive avant que Safari ait annoncé la fermeture précédente.
    const v = computeViewportVars({ height: OPEN, offsetTop: PAN, editableFocused: true, baseHeight: OPEN });
    expect(v.baseHeight).toBe(OPEN);
    expect(v.keyboardOpen).toBe(false); // rien de fiable → pas de faux « clavier »
    const next = computeViewportVars({ height: CLOSED, offsetTop: 0, editableFocused: false, baseHeight: v.baseHeight });
    expect(next.baseHeight).toBe(CLOSED); // se répare au premier échantillon sans focus
  });

  it('la fermeture annoncée avec un décalage encore périmé est reprise au ré-échantillonnage', () => {
    // 1. `resize` d'iOS : hauteur revenue, offsetTop pas encore remis à zéro.
    const stale = computeViewportVars({ height: CLOSED, offsetTop: PAN, editableFocused: false, baseHeight: CLOSED });
    expect(stale.keyboardOpen).toBe(false);
    expect(stale.vvk).toBe(0);
    // 2. Relecture différée (settle) : la géométrie réelle est reprise telle quelle.
    const settled = computeViewportVars({ height: CLOSED, offsetTop: 0, editableFocused: false, baseHeight: stale.baseHeight });
    expect(settled).toMatchObject({ vvh: CLOSED, vvt: 0, vvk: 0 });
  });

  it('la danse de la barre d’URL n’est pas un clavier', () => {
    const v = computeViewportVars({ height: CLOSED - KEYBOARD_MIN_PX + 1, offsetTop: 0, editableFocused: true, baseHeight: CLOSED });
    expect(v.keyboardOpen).toBe(false);
    expect(v.vvk).toBe(0);
  });

  it('rotation clavier ouvert : la base grandit avec l’écran', () => {
    const v = computeViewportVars({ height: 900, offsetTop: 0, editableFocused: true, baseHeight: CLOSED });
    expect(v.baseHeight).toBe(900);
    expect(v.keyboardOpen).toBe(false);
  });

  it('arrondit au pixel (iOS renvoie des sous-pixels)', () => {
    const v = computeViewportVars({ height: 309.6, offsetTop: 207.5, editableFocused: true, baseHeight: CLOSED });
    expect(v.vvh).toBe(310);
    expect(v.vvt).toBe(208);
  });
});
