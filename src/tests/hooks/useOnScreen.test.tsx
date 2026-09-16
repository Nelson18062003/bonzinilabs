import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOnScreen } from '@/hooks/useOnScreen';

type Cb = (entries: { isIntersecting: boolean }[]) => void;
let observers: { cb: Cb; observed: Element[]; disconnected: boolean; init?: IntersectionObserverInit }[] = [];
const RealIO = globalThis.IntersectionObserver;

class FakeIO {
  observed: Element[] = [];
  disconnected = false;
  constructor(public cb: Cb, public init?: IntersectionObserverInit) {
    observers.push(this);
  }
  observe(el: Element) { this.observed.push(el); }
  unobserve() {}
  disconnect() { this.disconnected = true; }
  takeRecords() { return []; }
}

describe('useOnScreen', () => {
  beforeEach(() => { observers = []; globalThis.IntersectionObserver = FakeIO as unknown as typeof IntersectionObserver; });
  afterEach(() => { globalThis.IntersectionObserver = RealIO; });

  it('répond « à l’écran » tant qu’aucun élément n’est posé (jamais de barre au chargement)', () => {
    const { result } = renderHook(() => useOnScreen());
    expect(result.current.onScreen).toBe(true);
    expect(observers).toHaveLength(0);
  });

  it('suit l’observateur : hors écran → false, de retour → true', () => {
    const { result } = renderHook(() => useOnScreen());
    const el = document.createElement('div');
    act(() => result.current.ref(el));
    expect(observers).toHaveLength(1);
    expect(observers[0].observed).toEqual([el]);
    // Le bouton doit être au moins à moitié visible, et pas sous l'en-tête collant.
    expect(observers[0].init?.threshold).toBe(0.5);
    expect(observers[0].init?.rootMargin).toBe('-56px 0px 0px 0px');
    act(() => observers[0].cb([{ isIntersecting: false }]));
    expect(result.current.onScreen).toBe(false);
    act(() => observers[0].cb([{ isIntersecting: true }]));
    expect(result.current.onScreen).toBe(true);
  });

  it('désactivé : plus d’observation et « à l’écran » par défaut (fiche verrouillée)', () => {
    const { result, rerender } = renderHook(({ enabled }) => useOnScreen(enabled), { initialProps: { enabled: true } });
    const el = document.createElement('div');
    act(() => result.current.ref(el));
    act(() => observers[0].cb([{ isIntersecting: false }]));
    expect(result.current.onScreen).toBe(false);
    rerender({ enabled: false });
    expect(observers[0].disconnected).toBe(true);
    expect(result.current.onScreen).toBe(true);
  });

  it('élément retiré (changement de statut) : l’observateur est coupé', () => {
    const { result } = renderHook(() => useOnScreen());
    act(() => result.current.ref(document.createElement('div')));
    act(() => result.current.ref(null));
    expect(observers[0].disconnected).toBe(true);
    expect(result.current.onScreen).toBe(true);
  });
});
