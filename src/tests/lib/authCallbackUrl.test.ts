// Ces cas sont exactement le bug vu en production : passer l'URL entière à
// exchangeCodeForSession faisait répondre GoTrue « invalid flow state, no
// valid flow state found », car il cherchait une flow state nommée d'après
// l'URL au lieu du code.
import { describe, it, expect } from 'vitest';
import { authCodeFromUrl, authErrorFromUrl } from '@/lib/authCallbackUrl';

const CALLBACK = 'https://www.bonzinilabs.com/m/auth/callback';

describe('authCodeFromUrl', () => {
  it('extrait le code du retour OAuth', () => {
    expect(authCodeFromUrl(`${CALLBACK}?code=abc123`)).toBe('abc123');
  });

  it('fonctionne avec les autres paramètres présents', () => {
    expect(authCodeFromUrl(`${CALLBACK}?next=%2Fm%2Fmore%2Fpassword&code=xyz789`)).toBe('xyz789');
  });

  it('renvoie null quand il n’y a pas de code', () => {
    expect(authCodeFromUrl(CALLBACK)).toBeNull();
    expect(authCodeFromUrl(`${CALLBACK}?error=access_denied`)).toBeNull();
  });

  it('ne renvoie jamais l’URL elle-même', () => {
    // La régression d'origine : l'URL entière partait comme « code ».
    const url = `${CALLBACK}?code=abc123`;
    expect(authCodeFromUrl(url)).not.toBe(url);
  });

  it('encaisse une URL invalide', () => {
    expect(authCodeFromUrl('pas-une-url')).toBeNull();
  });
});

describe('authErrorFromUrl', () => {
  it('préfère la description, plus lisible que le code', () => {
    expect(authErrorFromUrl(`${CALLBACK}?error=access_denied&error_description=Utilisateur+a+refuse`))
      .toBe('Utilisateur a refuse');
  });

  it('retombe sur le code d’erreur seul', () => {
    expect(authErrorFromUrl(`${CALLBACK}?error=server_error`)).toBe('server_error');
  });

  it('renvoie null quand tout va bien', () => {
    expect(authErrorFromUrl(`${CALLBACK}?code=abc123`)).toBeNull();
  });
});
