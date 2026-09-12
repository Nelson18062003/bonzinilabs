// ============================================================
// Recherche d'une référence — le délai au-delà duquel on arrête d'attendre.
//
// Régression du 12/09/2026 : sur le B/L 271875389, l'écran a tourné sans fin.
// La référence était bonne et l'API armateur répondait ; c'est l'edge function
// `cargo-lookup` qui manquait côté serveur. Comme `net.http_post` est un tir
// sans retour, la ligne restait « pending » à jamais et rien ne le signalait.
//
// Ces tests figent la seule protection possible côté app : une recherche qui
// n'aboutit pas devient une RÉPONSE, et le sondage s'arrête.
// ============================================================
import { describe, it, expect } from 'vitest';
import {
  LOOKUP_GIVE_UP_MS, LOOKUP_STALLED_MS, lookupAgeMs, lookupState, shouldPollLookup, STALLED_CAUSES,
} from '@/lib/cargo/lookup';
import type { CargoLookup } from '@/lib/cargo/model';

const T0 = new Date('2026-09-12T11:00:00Z').getTime();
const look = (status: string, ageMs = 0) =>
  ({ status, created_at: new Date(T0 - ageMs).toISOString() } as unknown as CargoLookup);

describe('RECHERCHE — l’âge d’une demande', () => {
  it('se mesure depuis sa création', () => {
    expect(lookupAgeMs(look('pending', 12_000), T0)).toBe(12_000);
  });
});

describe('RECHERCHE — l’état affiché', () => {
  it('reste « en cours » juste après le lancement', () => {
    expect(lookupState(look('pending', 3_000), T0)).toBe('pending');
  });

  it('bascule en « sans réponse » passé le délai', () => {
    expect(lookupState(look('pending', LOOKUP_STALLED_MS + 1_000), T0)).toBe('stalled');
  });

  it('ne touche jamais à un état déjà tranché par le serveur', () => {
    for (const s of ['done', 'error', 'unsupported']) {
      expect(lookupState(look(s, 10 * 60_000), T0)).toBe(s);
    }
  });

  it('ne dit rien quand il n’y a pas de recherche', () => {
    expect(lookupState(null, T0)).toBeNull();
    expect(lookupState(undefined, T0)).toBeNull();
  });
});

describe('RECHERCHE — le sondage', () => {
  it('sonde tant que la demande est jeune et en cours', () => {
    expect(shouldPollLookup(look('pending', 5_000), T0)).toBe(true);
  });

  it('continue de sonder un moment APRÈS avoir affiché « sans réponse »', () => {
    // Le serveur peut encore répondre tard : on cesse d'attendre à l'écran
    // avant de cesser d'écouter.
    const tard = LOOKUP_STALLED_MS + 5_000;
    expect(lookupState(look('pending', tard), T0)).toBe('stalled');
    expect(shouldPollLookup(look('pending', tard), T0)).toBe(true);
  });

  it('finit par abandonner — sinon l’onglet sonde jusqu’à sa fermeture', () => {
    expect(shouldPollLookup(look('pending', LOOKUP_GIVE_UP_MS + 1), T0)).toBe(false);
  });

  it('ne sonde jamais une demande déjà terminée', () => {
    expect(shouldPollLookup(look('done'), T0)).toBe(false);
    expect(shouldPollLookup(look('error'), T0)).toBe(false);
    expect(shouldPollLookup(null, T0)).toBe(false);
  });

  it('le seuil d’affichage vient bien avant l’abandon', () => {
    expect(LOOKUP_STALLED_MS).toBeLessThan(LOOKUP_GIVE_UP_MS);
  });
});

describe('RECHERCHE — ce qu’on dit à la personne', () => {
  it('nomme des causes réparables, pas « une erreur est survenue »', () => {
    expect(STALLED_CAUSES.length).toBeGreaterThanOrEqual(3);
    expect(STALLED_CAUSES.join(' ')).toMatch(/cargo-lookup/);
    expect(STALLED_CAUSES.join(' ')).toMatch(/MAERSK_CONSUMER_KEY/);
  });
});
