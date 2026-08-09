// `next` gouverne une redirection après authentification : mal filtré, il
// transforme /m/auth/callback en redirection ouverte. Ces cas sont la
// spécification de ce filtre.
import { describe, it, expect } from 'vitest';
import { safeNextPath } from '@/lib/safeRedirect';

describe('safeNextPath', () => {
  it('laisse passer un chemin interne de l’app admin', () => {
    expect(safeNextPath('/m/more/password')).toBe('/m/more/password');
    expect(safeNextPath('/m/deposits')).toBe('/m/deposits');
  });

  it('retombe sur le repli quand rien n’est fourni', () => {
    expect(safeNextPath(null)).toBe('/m');
    expect(safeNextPath('')).toBe('/m');
  });

  it('refuse toute destination externe', () => {
    expect(safeNextPath('https://evil.tld')).toBe('/m');
    expect(safeNextPath('http://evil.tld/m/')).toBe('/m');
    // Protocol-relative : le navigateur y voit une URL absolue.
    expect(safeNextPath('//evil.tld')).toBe('/m');
    expect(safeNextPath('//evil.tld/m/more')).toBe('/m');
    expect(safeNextPath('/\\evil.tld')).toBe('/m');
  });

  it('refuse les pseudo-protocoles', () => {
    expect(safeNextPath('javascript:alert(1)')).toBe('/m');
    expect(safeNextPath('data:text/html,x')).toBe('/m');
  });

  it('refuse les chemins hors app admin', () => {
    expect(safeNextPath('/auth/callback')).toBe('/m');   // app client
    expect(safeNextPath('/a/login')).toBe('/m');         // app agent-cash
    expect(safeNextPath('/m')).toBe('/m');               // pas un sous-chemin
    expect(safeNextPath('/malicious')).toBe('/m');       // préfixe trompeur
  });

  it('accepte un repli explicite', () => {
    expect(safeNextPath(null, '/m/more/settings')).toBe('/m/more/settings');
  });
});
