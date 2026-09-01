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
  previousRange,
  granularityIsCompatible,
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

describe('Chaque événement de la plage trouve son seau', () => {
  // INVARIANT : pour toute plage et toute granularité, la clé de seau d'un
  // instant DANS la plage doit appartenir aux seaux tracés. Sinon l'événement
  // est ignoré par le graphique (`if (!bucket) continue`) tout en comptant
  // dans les totaux — une perte de données SILENCIEUSE.
  //
  // RÉGRESSION RÉELLE (latente) : l'ancre mensuelle en fuseau Douala est le
  // dernier jour du mois précédent à 23:00Z ; `addMonths` bornait le jour à
  // min(jour, dernier jour du mois) et le curseur dérivait : 31 janv → 28 févr
  // → 28 mars → 28 avr… Tout événement d'avril à décembre était perdu, et
  // « Mar 26 » apparaissait deux fois. Masqué tant que le desktop restait
  // « par jour » ; exposé dès que la granularité suit la plage.
  const NOW = new Date('2026-09-01T12:00:00.000Z');

  for (const [preset, granularity] of [
    ['this_year', 'month'],
    ['all_time', 'quarter'],
    ['all_time', 'year'],
    ['last_90_days', 'week'],
    ['last_30_days', 'day'],
    ['today', 'hour'],
  ] as const) {
    it(`${preset} par ${granularity} : aucun seau orphelin, aucune étiquette en double`, () => {
      const range = buildRangeFromPreset(preset, { now: NOW, granularity });
      const starts = new Set(bucketStarts(range).map((b) => b.toISOString()));

      // Un instant toutes les 6 heures sur toute la plage : chacun doit
      // tomber dans un seau existant.
      const orphans: string[] = [];
      for (let t = range.from.getTime(); t < range.to.getTime(); t += 6 * 3600_000) {
        const key = bucketKeyFor(new Date(t), granularity);
        if (!starts.has(key)) orphans.push(new Date(t).toISOString().slice(0, 13));
      }
      expect(orphans, `instants sans seau : ${orphans.slice(0, 5).join(', ')}…`).toEqual([]);

      const labels = bucketStarts(range).map((b) => bucketLabel(b, granularity));
      expect(new Set(labels).size, `étiquettes en double : ${labels.join(' ')}`).toBe(labels.length);
    });
  }

  it("les seaux mensuels commencent bien le 1er de chaque mois à Douala", () => {
    const range = buildRangeFromPreset('this_year', { now: NOW, granularity: 'month' });
    for (const b of bucketStarts(range)) {
      // +1 h : les composants UTC deviennent les composants de Douala.
      const biz = new Date(b.getTime() + 3600_000);
      expect(biz.getUTCDate(), b.toISOString()).toBe(1);
      expect(biz.getUTCHours()).toBe(0);
    }
    expect(bucketStarts(range)).toHaveLength(12);
  });
});

describe("Plage personnalisée — par la vraie entrée du sélecteur", () => {
  it("une chaîne 'YYYY-MM-DD' donne le même jour de Douala dans tous les fuseaux", () => {
    // Le calendrier livre 'YYYY-MM-DD'. Le sélecteur faisait `new Date(str)`
    // (= minuit UTC) puis lisait des composants LOCAUX : à l'ouest de UTC,
    // toute la plage reculait d'un jour. Le test précédent passait parce
    // qu'il construisait la Date en composants locaux, ce que le sélecteur
    // ne faisait pas — il testait l'API, pas l'intégration.
    const bornes = inEachZone(() => {
      const r = buildCustomRange('2026-09-01', '2026-09-03');
      return { from: r.from.toISOString(), to: r.to.toISOString() };
    });
    const b = expectSameEverywhere(bornes);
    expect(b.from).toBe('2026-08-31T23:00:00.000Z');
    expect(b.to).toBe('2026-09-03T22:59:59.999Z');
  });
});

describe('Seaux horaires', () => {
  it("la clé horaire est la même dans tous les fuseaux — c'était le seul cas encore en heure locale", () => {
    // 12:30 UTC = 13:30 à Douala → seau de 13 h Douala = 12:00 UTC.
    const keys = inEachZone(() => bucketKeyFor(new Date('2026-09-01T12:30:00.000Z'), 'hour'));
    expect(expectSameEverywhere(keys)).toBe('2026-09-01T12:00:00.000Z');
    expect(bucketLabel(new Date(expectSameEverywhere(keys)), 'hour')).toBe('13h');
  });

  it("« Aujourd'hui » ne juge pas « par jour » compatible (ce serait un seul seau)", () => {
    const today = buildRangeFromPreset('today', { now: NOW });
    expect(granularityIsCompatible('day', today)).toBe(false);
    expect(granularityIsCompatible('hour', today)).toBe(true);
  });
});

describe('Période précédente', () => {
  it("d'une plage personnalisée est contiguë et de même longueur, à la milliseconde", () => {
    const r = buildCustomRange('2026-09-01', '2026-09-03');
    const p = previousRange(r);
    expect(p.to.getTime()).toBe(r.from.getTime() - 1);
    expect(p.to.getTime() - p.from.getTime()).toBe(r.to.getTime() - r.from.getTime());
    expect(p.from.toISOString()).toBe('2026-08-28T23:00:00.000Z'); // 29 août 00:00 Douala
  });
});
