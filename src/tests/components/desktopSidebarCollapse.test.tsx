/**
 * Le menu latéral de l'ordinateur se replie (12/10/2026).
 *
 * L'opérateur voulait pouvoir cacher le menu pour rendre la largeur aux
 * tableaux, puis le rouvrir. Ce qui doit tenir :
 *
 *  · un bouton en tête du menu le réduit en rail d'icônes, et le contenu
 *    suit (la marge passe de 256 à 72 px) ;
 *  · réduit, chaque entrée garde son NOM (lecteur d'écran, infobulle), le
 *    compteur « à traiter » reste visible sur l'icône, et l'écran ouvert
 *    reste surligné ;
 *  · le choix est gardé : chaque écran remonte sa coque, le menu ne se
 *    rouvre pas à chaque page ;
 *  · Ctrl/⌘ + B bascule, sauf dans un texte riche (où B met en gras) ;
 *  · stockage bloqué (navigation privée) : déplié, sans planter.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/contexts/AdminAuthContext', async (orig) => ({
  ...(await orig<typeof import('@/contexts/AdminAuthContext')>()),
  useAdminAuth: () => ({
    currentUser: { id: 'u1', role: 'super_admin', firstName: 'Nelson', lastName: 'Bonzini' },
    hasPermission: () => true,
    logout: vi.fn(),
  }),
}));
vi.mock('@/hooks/useAdminNotifications', () => ({
  useAdminActionableCounts: () => ({ data: { deposits: 0, payments: 3 } }),
}));
vi.mock('@/desktop/components/layout/DesktopTopbar', () => ({ DesktopTopbar: () => null }));
vi.mock('@/components/MolaMascot', () => ({ MolaMascot: () => null }));

import { DesktopAppShell } from '@/desktop/components/layout/DesktopAppShell';
import { SIDEBAR_STORAGE_KEY, isSidebarShortcut } from '@/desktop/components/layout/sidebarState';

const shell = () =>
  render(
    <MemoryRouter initialEntries={['/m/payments']}>
      <DesktopAppShell>
        <p>Le tableau des paiements</p>
      </DesktopAppShell>
    </MemoryRouter>,
  );

const aside = () => screen.getByRole('complementary', { name: 'Menu principal' });
const content = () => screen.getByText('Le tableau des paiements').closest('main')!.parentElement!;

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('Réduire et déplier le menu', () => {
  it('déplié par défaut : libellés et titres de groupe visibles', () => {
    shell();
    expect(aside().className).toContain('w-64');
    expect(content().className).toContain('pl-64');
    expect(screen.getByText('Principal')).toBeTruthy();
    const toggle = screen.getByRole('button', { name: 'Réduire le menu' });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('le bouton le réduit en rail ; le contenu récupère la largeur', () => {
    shell();
    fireEvent.click(screen.getByRole('button', { name: 'Réduire le menu' }));
    expect(aside().className).toContain('w-[72px]');
    expect(content().className).toContain('pl-[72px]');
    expect(screen.queryByText('Principal')).toBeNull();
    const toggle = screen.getByRole('button', { name: 'Déplier le menu' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(toggle);
    expect(aside().className).toContain('w-64');
  });

  it('réduit, chaque entrée garde son nom et le compteur reste sur l’icône', () => {
    shell();
    fireEvent.click(screen.getByRole('button', { name: 'Réduire le menu' }));
    const payments = screen.getByRole('link', { name: /Paiements/ });
    expect(payments.getAttribute('href')).toBe('/m/payments');
    expect(payments.textContent).toContain('3');
    expect(screen.getByRole('link', { name: /Clients/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Se déconnecter' })).toBeTruthy();
  });

  it('réduit, l’écran ouvert reste surligné (régression : Radix aplatissait la classe)', () => {
    shell();
    const active = () => screen.getByRole('link', { name: /Paiements/ });
    expect(active().className).toContain('bg-primary');
    fireEvent.click(screen.getByRole('button', { name: 'Réduire le menu' }));
    expect(active().className).toContain('bg-primary');
    expect(active().className).not.toContain('=>');
    expect(screen.getByRole('link', { name: /Clients/ }).className).not.toContain('bg-primary');
  });

  it('le choix est gardé d’un écran à l’autre', () => {
    const { unmount } = shell();
    fireEvent.click(screen.getByRole('button', { name: 'Réduire le menu' }));
    expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('collapsed');
    unmount();
    shell();
    expect(aside().className).toContain('w-[72px]');
  });
});

describe('Ctrl/⌘ + B', () => {
  it('bascule le menu', () => {
    shell();
    fireEvent.keyDown(window, { key: 'b', ctrlKey: true });
    expect(aside().className).toContain('w-[72px]');
    fireEvent.keyDown(window, { key: 'B', metaKey: true });
    expect(aside().className).toContain('w-64');
  });

  it('B seul, ou avec Maj, ne fait rien', () => {
    shell();
    fireEvent.keyDown(window, { key: 'b' });
    fireEvent.keyDown(window, { key: 'b', ctrlKey: true, shiftKey: true });
    expect(aside().className).toContain('w-64');
  });

  it('dans un texte riche, B met en gras : le menu ne bouge pas', () => {
    const editor = document.createElement('div');
    editor.setAttribute('contenteditable', 'true');
    const inner = document.createElement('span');
    editor.appendChild(inner);
    document.body.appendChild(editor);
    const e = new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, bubbles: true });
    Object.defineProperty(e, 'target', { value: inner });
    expect(isSidebarShortcut(e)).toBe(false);
    editor.remove();
  });
});

describe('Stockage bloqué', () => {
  it('déplié, sans planter', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    shell();
    expect(aside().className).toContain('w-64');
    fireEvent.click(screen.getByRole('button', { name: 'Réduire le menu' }));
    expect(aside().className).toContain('w-[72px]');
  });
});
