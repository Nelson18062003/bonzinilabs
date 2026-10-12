/**
 * Le menu latéral de l'ordinateur, déplié (256 px, icônes + libellés) ou
 * réduit (72 px, icônes seules) — un choix de l'opérateur, gardé dans CE
 * navigateur : chaque écran monte sa propre coque (AdminRouteWrapper), et
 * le menu ne doit pas se rouvrir à chaque page.
 *
 * Raccourci : Ctrl + B (⌘ + B sur Mac), la convention des consoles
 * (VS Code, shadcn/ui).
 */
import { useCallback, useEffect, useState } from 'react';

export const SIDEBAR_STORAGE_KEY = 'bz.desktop.sidebar';
export const SIDEBAR_WIDTH_EXPANDED = 256;
export const SIDEBAR_WIDTH_COLLAPSED = 72;

export function readSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'collapsed';
  } catch {
    return false; // navigation privée, stockage bloqué : déplié
  }
}

function writeSidebarCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? 'collapsed' : 'expanded');
  } catch {
    /* préférence perdue : sans gravité */
  }
}

/** « ⌘ B » sur Mac, « Ctrl B » ailleurs — pour l'infobulle du bouton. */
export function sidebarShortcutLabel(): string {
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
  return mac ? '⌘ B' : 'Ctrl B';
}

/** Ctrl/⌘ + B, sauf dans un texte riche (où B met en gras). */
export function isSidebarShortcut(e: KeyboardEvent): boolean {
  if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return false;
  if (e.key.toLowerCase() !== 'b') return false;
  const target = e.target as HTMLElement | null;
  return !(target?.isContentEditable || target?.closest?.('[contenteditable=""], [contenteditable="true"]'));
}

export function useSidebarCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(readSidebarCollapsed);

  const toggle = useCallback(() => setCollapsed((c) => !c), []);

  useEffect(() => writeSidebarCollapsed(collapsed), [collapsed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isSidebarShortcut(e)) return;
      e.preventDefault(); // Firefox ouvrirait ses marque-pages
      toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  return [collapsed, toggle];
}
