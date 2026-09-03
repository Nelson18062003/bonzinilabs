/**
 * La fenêtre des matrices de croissance — « semaine après semaine », « mois
 * après mois ».
 *
 * Deux pièges, tous deux déjà rencontrés ailleurs dans ce code :
 *
 *  1. LE FUSEAU. Tout calcul de calendrier fait sur des `Date` locales décale
 *     d'un jour sur la moitié des postes. Ces tests s'exécutent donc sous
 *     quatre fuseaux : la fenêtre doit être la même partout, puisqu'elle est
 *     définie en jours civils de DOUALA.
 *  2. L'ALIGNEMENT DES SEAUX. Si la fenêtre commence un mercredi alors que
 *     `bucketKeyFor` ouvre les semaines le lundi, la première barre est une
 *     demi-semaine — qu'on lirait comme un effondrement.
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  buildGrowthRange,
  growthWindowStart,
  startOfBusinessMonth,
  startOfBusinessWeek,
} from '@/lib/analytics/growthWindow';
import { bucketKeyFor, bucketStarts, granularityIsCompatible, toBusinessDayString } from '@/lib/analytics/dateRange';

/** Rejoue un test sous plusieurs fuseaux — le décalage ne doit rien changer. */
function inEachZone(run: () => void) {
  const original = process.env.TZ;
  for (const tz of ['UTC', 'Africa/Douala', 'America/Los_Angeles', 'Asia/Tokyo']) {
    process.env.TZ = tz;
    run();
  }
  process.env.TZ = original;
}

afterEach(() => {
  // Un test qui laisse `TZ` modifié contamine les suivants.
  delete process.env.TZ;
});

describe('Le début des périodes, en jours civils', () => {
  it('la semaine ouvre le LUNDI, comme les seaux', () => {
    // 2026-09-02 est un mercredi.
    expect(startOfBusinessWeek('2026-09-02')).toBe('2026-08-31');
    // Un lundi est son propre début.
    expect(startOfBusinessWeek('2026-08-31')).toBe('2026-08-31');
    // Un dimanche appartient à la semaine qui a commencé le lundi d'avant.
    expect(startOfBusinessWeek('2026-09-06')).toBe('2026-08-31');
  });

  it('le mois ouvre le 1er', () => {
    expect(startOfBusinessMonth('2026-09-02')).toBe('2026-09-01');
    expect(startOfBusinessMonth('2026-01-31')).toBe('2026-01-01');
  });
});

describe('La fenêtre de croissance', () => {
  it('douze semaines : onze semaines en arrière, alignées sur le lundi', () => {
    // Mercredi 2 septembre 2026 → semaine du lundi 31 août ; onze semaines
    // avant = 77 jours plus tôt.
    expect(growthWindowStart('week', 12, '2026-09-02')).toBe('2026-06-15');
  });

  it('douze mois : onze mois en arrière, au 1er', () => {
    expect(growthWindowStart('month', 12, '2026-09-02')).toBe('2025-10-01');
  });

  it('le passage d’année se fait en MOIS, pas en jours', () => {
    // Le piège classique : soustraire 11 × 30 jours donnerait le 12 février.
    expect(growthWindowStart('month', 12, '2026-01-15')).toBe('2025-02-01');
    expect(growthWindowStart('month', 3, '2026-01-15')).toBe('2025-11-01');
  });

  it('une seule période demandée = la période en cours', () => {
    expect(growthWindowStart('week', 1, '2026-09-02')).toBe('2026-08-31');
    expect(growthWindowStart('month', 1, '2026-09-02')).toBe('2026-09-01');
  });
});

describe('La plage livrée aux hooks', () => {
  const now = new Date('2026-09-02T12:00:00.000Z');

  it('porte le pas demandé, et ce pas est compatible', () => {
    inEachZone(() => {
      for (const mode of ['week', 'month'] as const) {
        const range = buildGrowthRange(mode, 12, now);
        expect(range.granularity).toBe(mode);
        expect(granularityIsCompatible(mode, range)).toBe(true);
      }
    });
  });

  it('donne EXACTEMENT douze seaux, la période en cours comprise', () => {
    inEachZone(() => {
      expect(bucketStarts(buildGrowthRange('week', 12, now)).length).toBe(12);
      expect(bucketStarts(buildGrowthRange('month', 12, now)).length).toBe(12);
    });
  });

  it('commence AU DÉBUT d’un seau — pas de demi-période en tête', () => {
    inEachZone(() => {
      for (const mode of ['week', 'month'] as const) {
        const range = buildGrowthRange(mode, 12, now);
        // Le premier seau que `bucketStarts` produit doit être le seau de
        // `from` lui-même : sinon la fenêtre a coupé une période en deux.
        expect(bucketStarts(range)[0].toISOString()).toBe(bucketKeyFor(range.from, mode));
      }
    });
  });

  it('finit sur la période EN COURS — le dernier seau contient aujourd’hui', () => {
    inEachZone(() => {
      for (const mode of ['week', 'month'] as const) {
        const starts = bucketStarts(buildGrowthRange(mode, 12, now));
        expect(starts[starts.length - 1].toISOString()).toBe(bucketKeyFor(now, mode));
      }
    });
  });

  it('ne dépend pas du fuseau du poste : mêmes bornes partout', () => {
    const seen = new Set<string>();
    inEachZone(() => {
      const range = buildGrowthRange('week', 12, now);
      seen.add(`${range.from.toISOString()}|${range.to.toISOString()}`);
    });
    expect(seen.size).toBe(1);
  });

  it('sans instant fourni, la fenêtre est celle d’aujourd’hui', () => {
    const range = buildGrowthRange('month');
    expect(toBusinessDayString(range.to)).toBe(toBusinessDayString(new Date()));
  });
});
