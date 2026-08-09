// Helpers purs de l'Edge Function `passkey` + contrat de la bibliothèque
// WebAuthn. Le second bloc n'est pas décoratif : @simplewebauthn a changé la
// forme de ses retours entre versions majeures (credentialID/credentialPublicKey
// → credential.{id,publicKey}). Si la version bouge sans que le code suive, ces
// tests tombent ici plutôt qu'au moment où quelqu'un présente son visage.
import { describe, it, expect } from 'vitest';
import {
  b64uEncode,
  b64uDecode,
  rpIdFor,
  deviceLabelFrom,
  isCounterAcceptable,
  isAllowedOrigin,
} from '../../../supabase/functions/passkey/helpers';

describe('base64url', () => {
  it('fait l’aller-retour sans perte', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 255, 128, 64]);
    expect(Array.from(b64uDecode(b64uEncode(bytes)))).toEqual(Array.from(bytes));
  });

  it('n’émet aucun caractère hostile aux URL', () => {
    // 0xFB 0xFF produirait « +/ » en base64 classique.
    const encoded = b64uEncode(new Uint8Array([251, 255, 254, 253]));
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it('accepte les longueurs qui exigeraient un padding', () => {
    for (const length of [1, 2, 3, 4, 5]) {
      const bytes = new Uint8Array(length).fill(200);
      expect(b64uDecode(b64uEncode(bytes)).length).toBe(length);
    }
  });
});

describe('rpIdFor', () => {
  it('renvoie le domaine de production pour le vrai site', () => {
    expect(rpIdFor('https://www.bonzinilabs.com', 'bonzinilabs.com')).toBe('bonzinilabs.com');
  });

  it('bascule sur localhost en développement', () => {
    // Une clé enrôlée en local ne doit pas prétendre appartenir au domaine
    // de production — le navigateur refuserait.
    expect(rpIdFor('http://localhost:8080', 'bonzinilabs.com')).toBe('localhost');
    expect(rpIdFor('http://127.0.0.1:8080', 'bonzinilabs.com')).toBe('localhost');
  });

  it('retombe sur la production si l’origine est illisible', () => {
    expect(rpIdFor('pas-une-url', 'bonzinilabs.com')).toBe('bonzinilabs.com');
  });
});

describe('isAllowedOrigin', () => {
  const allowed = ['https://www.bonzinilabs.com', 'http://localhost:8080'];

  it('accepte une origine listée', () => {
    expect(isAllowedOrigin('https://www.bonzinilabs.com', allowed)).toBe(true);
  });

  it('refuse une origine absente, un préfixe et une absence d’origine', () => {
    expect(isAllowedOrigin('https://bonzinilabs.com.evil.tld', allowed)).toBe(false);
    expect(isAllowedOrigin('https://www.bonzinilabs.com.evil.tld', allowed)).toBe(false);
    expect(isAllowedOrigin(null, allowed)).toBe(false);
  });
});

describe('isCounterAcceptable', () => {
  it('accepte tout quand l’authenticator ne compte pas (iOS/Android renvoient 0)', () => {
    expect(isCounterAcceptable(0, 0)).toBe(true);
    expect(isCounterAcceptable(0, 5)).toBe(true);
  });

  it('exige une progression stricte dès qu’un compteur existe', () => {
    expect(isCounterAcceptable(7, 8)).toBe(true);
    expect(isCounterAcceptable(7, 7)).toBe(false); // rejeu
    expect(isCounterAcceptable(7, 3)).toBe(false); // clone probable
  });
});

describe('deviceLabelFrom', () => {
  it('nomme les appareils courants', () => {
    expect(deviceLabelFrom('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('iPhone');
    expect(deviceLabelFrom('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe('Téléphone Android');
    expect(deviceLabelFrom('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('Mac');
    expect(deviceLabelFrom('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('PC Windows');
  });

  it('reste lisible quand le User-Agent manque', () => {
    expect(deviceLabelFrom(null)).toBe('Appareil');
  });

  it('classe l’iPad avant le Mac (son UA contient « Mac OS X »)', () => {
    expect(deviceLabelFrom('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')).toBe('iPad');
  });
});

// ── Contrat de @simplewebauthn/server ──────────────────────────────────────
// L'Edge Function importe la même version depuis esm.sh. Ces tests vérifient
// que la forme sur laquelle le code s'appuie est bien celle de la version
// installée.
describe('contrat @simplewebauthn/server', () => {
  it('génère des options d’enrôlement exploitables', async () => {
    const { generateRegistrationOptions } = await import('@simplewebauthn/server');

    const options = await generateRegistrationOptions({
      rpName: 'Bonzini Admin',
      rpID: 'bonzinilabs.com',
      userID: new TextEncoder().encode('11111111-2222-3333-4444-555555555555'),
      userName: 'papa@gmail.com',
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'required',
        requireResidentKey: true,
        userVerification: 'required',
      },
    });

    expect(typeof options.challenge).toBe('string');
    expect(options.rp.id).toBe('bonzinilabs.com');
    // « required » des deux côtés : c'est ce qui rend la clé découvrable (pas
    // d'email à saisir) et impose la biométrie plutôt qu'un simple contact.
    expect(options.authenticatorSelection?.residentKey).toBe('required');
    expect(options.authenticatorSelection?.userVerification).toBe('required');
  });

  it('génère des options de connexion sans allowCredentials', async () => {
    const { generateAuthenticationOptions } = await import('@simplewebauthn/server');

    const options = await generateAuthenticationOptions({
      rpID: 'bonzinilabs.com',
      userVerification: 'required',
      allowCredentials: [],
    });

    expect(typeof options.challenge).toBe('string');
    expect(options.rpId).toBe('bonzinilabs.com');
    // Une liste vide est ce qui empêche l'écran de connexion de révéler
    // quelles clés existent — donc quels comptes existent.
    expect(options.allowCredentials ?? []).toHaveLength(0);
  });

  it('produit un défi différent à chaque appel', async () => {
    const { generateAuthenticationOptions } = await import('@simplewebauthn/server');
    const first = await generateAuthenticationOptions({ rpID: 'bonzinilabs.com' });
    const second = await generateAuthenticationOptions({ rpID: 'bonzinilabs.com' });
    expect(first.challenge).not.toBe(second.challenge);
  });

  it('expose les fonctions de vérification attendues', async () => {
    const mod = await import('@simplewebauthn/server');
    expect(typeof mod.verifyRegistrationResponse).toBe('function');
    expect(typeof mod.verifyAuthenticationResponse).toBe('function');
  });

  it('rejette une réponse d’enrôlement forgée', async () => {
    const { verifyRegistrationResponse } = await import('@simplewebauthn/server');

    // Une réponse bidon ne doit JAMAIS ressortir « verified ». Selon l'endroit
    // où le parsing casse, la bibliothèque lève ou renvoie verified:false —
    // les deux sont des refus. Le seul résultat inacceptable est verified:true.
    let verified: boolean;
    try {
      const result = await verifyRegistrationResponse({
        response: {
          id: 'forge',
          rawId: 'forge',
          type: 'public-key',
          clientExtensionResults: {},
          response: { clientDataJSON: 'forge', attestationObject: 'forge' },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        expectedChallenge: 'attendu',
        expectedOrigin: 'https://www.bonzinilabs.com',
        expectedRPID: 'bonzinilabs.com',
        requireUserVerification: true,
      });
      verified = result.verified;
    } catch {
      verified = false; // rejet par exception : c'est un refus valable
    }

    expect(verified).toBe(false);
  });
});
