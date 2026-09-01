/**
 * Fondations temporelles du tableau de bord.
 *
 * RÉGRESSION RÉELLE, VUE EN PRODUCTION ET SIGNALÉE PAR L'UTILISATEUR :
 * le graphique « Flux financier » montrait des barres sous « Dim 30 » et
 * « Lun 31 », et RIEN sous « Mar 1 » — alors qu'on était mardi 1er septembre
 * et que la base contenait bien 32 opérations ce jour-là.
 *
 * Les données étaient justes. Les ÉTIQUETTES étaient décalées d'un jour.
 *
 * Cause : `dateRange.ts` représente une heure murale de Douala par une `Date`
 * décalée de +1 h, puis lisait ses composants avec `date-fns`, qui lit les
 * composants LOCAUX du navigateur. Sur un poste à UTC+1 — le Cameroun — le
 * décalage était appliqué deux fois. Le code n'était juste que dans un
 * navigateur à UTC : les captures et les tests, jamais l'utilisateur.
 *
 * D'où la forme de ce fichier : chaque assertion est rejouée dans QUATRE
 * fuseaux. Un test qui ne tourne qu'en UTC est précisément celui qui a laissé
 * passer le bug.
 */
import { describe, it, expect, afterAll } from 'vitest';
import {
  buildRangeFromPreset,
  buildCustomRange,
  bucketKeyFor,
  bucketLabel,
  bucketStarts,
} from '@/lib/analytics/dateRange';

/** UTC, le fuseau réel de l'entreprise, et deux extrêmes de part et d'autre. */
const ZONES = ['UTC', 'Africa/Douala', 'America/New_York', 'Asia/Shanghai'] as const;

const ORIGINAL_TZ = process.env.TZ;
afterAll(() => {
  process.env.TZ = ORIGINAL_TZ;
});

/** Rejoue `fn` dans chaque fuseau et renvoie les résultats indexés. */
function inEachZone<T>(fn: () => T): Record<string, T> {
  const out: Record<string, T> = {};
  for (const tz of ZONES) {
    process.env.TZ = tz;
    out[tz] = fn();
  }
  process.env.TZ = ORIGINAL_TZ;
  return out;
}

/** Toutes les valeurs sont-elles identiques d'un fuseau à l'autre ? */
function expectSameEverywhere<T>(results: Record<string, T>) {
  const [reference, ...others] = Object.values(results);
  for (const value of others) expect(value).toEqual(reference);
  return reference;
}

// Mardi 1er septembre 2026, 12 h UTC = 13 h à Douala.
const NOW = new Date('2026-09-01T12:00:00.000Z');

describe('Le calcul de période ne dépend pas du fuseau du poste', () => {
  it('« Cette semaine » commence au lundi minuit de Douala, partout pareil', () => {
    const bornes = inEachZone(() => {
      const r = buildRangeFromPreset('this_week', { now: NOW });
      return { from: r.from.toISOString(), to: r.to.toISOString() };
    });
    const b = expectSameEverywhere(bornes);

    // Lundi 31 août 00:00 à Douala (UTC+1) = dimanche 30 août 23:00 UTC.
    expect(b.from).toBe('2026-08-30T23:00:00.000Z');
    // Dimanche 6 septembre 23:59:59.999 à Douala = 22:59:59.999 UTC.
    expect(b.to).toBe('2026-09-06T22:59:59.999Z');
  });

  it("« Aujourd'hui » couvre exactement la journée de Douala", () => {
    const bornes = inEachZone(() => {
      const r = buildRangeFromPreset('today', { now: NOW });
      return { from: r.from.toISOString(), to: r.to.toISOString() };
    });
    const b = expectSameEverywhere(bornes);
    expect(b.from).toBe('2026-08-31T23:00:00.000Z'); // mardi 00:00 à Douala
    expect(b.to).toBe('2026-09-01T22:59:59.999Z');   // mardi 23:59:59.999
  });

  it('les autres périodes nommées sont elles aussi stables', () => {
    for (const preset of [
      'yesterday', 'last_7_days', 'last_30_days', 'last_90_days',
      'last_week', 'this_month', 'last_month', 'this_quarter',
      'this_year', 'last_year', 'all_time',
    ] as const) {
      expectSameEverywhere(
        inEachZone(() => {
          const r = buildRangeFromPreset(preset, { now: NOW });
          return `${r.from.toISOString()}..${r.to.toISOString()}`;
        }),
      );
    }
  });
});

describe("L'étiquette d'un seau nomme le bon jour", () => {
  it('la semaine du 31 août court de « Lun 31 » à « Dim 6 » — sans jour fantôme ni jour perdu', () => {
    const etiquettes = inEachZone(() => {
      const range = buildRangeFromPreset('this_week', { now: NOW, granularity: 'day' });
      return bucketStarts(range).map((b) => bucketLabel(b, 'day'));
    });
    const labels = expectSameEverywhere(etiquettes);

    // C'est L'ASSERTION DU BUG : l'ancien code produisait
    // ['Dim 30','Lun 31','Mar 1','Mer 2','Jeu 3','Ven 4','Sam 5'] —
    // un dimanche de trop en tête, et le dimanche 6 purement disparu.
    expect(labels).toEqual(['Lun 31', 'Mar 1', 'Mer 2', 'Jeu 3', 'Ven 4', 'Sam 5', 'Dim 6']);
    expect(labels).toHaveLength(7);
  });

  it("une opération de mardi tombe dans le seau « Mar 1 », pas dans celui de lundi", () => {
    const resultats = inEachZone(() => {
      // 12 h UTC = 13 h à Douala, mardi.
      const key = bucketKeyFor(new Date('2026-09-01T12:00:00.000Z'), 'day');
      return bucketLabel(new Date(key), 'day');
    });
    expect(expectSameEverywhere(resultats)).toBe('Mar 1');
  });

  it('les bords de minuit à Douala sont du bon côté', () => {
    // 23:30 UTC le 31 août = 00:30 le 1er septembre à Douala → mardi.
    expect(
      expectSameEverywhere(
        inEachZone(() => bucketLabel(new Date(bucketKeyFor(new Date('2026-08-31T23:30:00.000Z'), 'day')), 'day')),
      ),
    ).toBe('Mar 1');

    // 22:30 UTC le 31 août = 23:30 le 31 août à Douala → encore lundi.
    expect(
      expectSameEverywhere(
        inEachZone(() => bucketLabel(new Date(bucketKeyFor(new Date('2026-08-31T22:30:00.000Z'), 'day')), 'day')),
      ),
    ).toBe('Lun 31');
  });

  it('chaque seau de la période porte l\'étiquette de son propre instant', () => {
    // Invariant général : nommer un seau puis le retrouver par sa clé doit
    // être une identité. C'est ce qui était rompu.
    const range = buildRangeFromPreset('last_30_days', { now: NOW, granularity: 'day' });
    for (const bucket of bucketStarts(range)) {
      expect(bucketKeyFor(bucket, 'day')).toBe(bucket.toISOString());
    }
  });
});

describe('Plage personnalisée', () => {
  it('retient le jour cliqué dans le calendrier, quel que soit le fuseau', () => {
    const bornes = inEachZone(() => {
      // Le sélecteur fournit une Date dont les composants LOCAUX portent le
      // jour choisi — ici le 1er septembre 2026.
      const r = buildCustomRange(new Date(2026, 8, 1), new Date(2026, 8, 3));
      return { from: r.from.toISOString(), to: r.to.toISOString() };
    });
    const b = expectSameEverywhere(bornes);
    expect(b.from).toBe('2026-08-31T23:00:00.000Z'); // 1er sept 00:00 à Douala
    expect(b.to).toBe('2026-09-03T22:59:59.999Z');   // 3 sept 23:59:59.999
  });
});

describe("L'arithmétique de calendrier ne déborde pas", () => {
  it('« mois dernier » depuis le 31 mars donne mars, pas un 31 février reporté', () => {
    const r = buildRangeFromPreset('last_month', { now: new Date('2026-03-31T12:00:00.000Z') });
    expect(r.from.toISOString()).toBe('2026-01-31T23:00:00.000Z'); // 1er février 00:00 Douala
    expect(r.to.toISOString()).toBe('2026-02-28T22:59:59.999Z');   // 28 février 23:59:59.999
  });

  it("« année dernière » depuis un 29 février reste dans l'année visée", () => {
    const r = buildRangeFromPreset('last_year', { now: new Date('2024-02-29T12:00:00.000Z') });
    expect(r.from.toISOString()).toBe('2022-12-31T23:00:00.000Z');
    expect(r.to.toISOString()).toBe('2023-12-31T22:59:59.999Z');
  });
});
