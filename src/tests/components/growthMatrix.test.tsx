/**
 * Les matrices de croissance : « semaine après semaine », « mois après mois ».
 *
 * Ce que ces tests protègent, dans l'ordre d'importance :
 *
 *  1. LA PÉRIODE EN COURS N'EST PAS COMPARABLE. Elle est incomplète par
 *     définition ; lui calculer une variation afficherait « −70 % » un mardi
 *     matin. Elle est donc marquée, exclue des chiffres de tête, et le
 *     graphique ne lui pose pas d'étiquette.
 *  2. UNE DIVISION PAR ZÉRO N'EST PAS UNE VARIATION. Passer de 0 à 5 clients
 *     n'est pas « +∞ % » : c'est `null`, et on n'affiche rien.
 *  3. Les chiffres de tête (dernière période complète, variation, moyenne,
 *     meilleure) se lisent sur les périodes TERMINÉES.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { buildGrowthRange } from '@/lib/analytics/growthWindow';
import {
  GrowthMatrixBlock,
  buildGrowthBuckets,
  growthDeltaPhrase,
  summarizeGrowth,
  type GrowthInput,
} from '@/desktop/screens/analytics/GrowthMatrixBlock';

const now = new Date('2026-09-02T12:00:00.000Z');
const range = buildGrowthRange('week', 4, now);

// jsdom n'a pas de ResizeObserver ; Recharts en veut un pour mesurer son
// conteneur. Le tracé n'a pas lieu ici (aucune mise en page), seul l'en-tête
// chiffré est vérifié.
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

/** Quatre semaines : 10 → 20 → 12 → 4 (la dernière est en cours).
 *  Les quatre chiffres de tête sont volontairement DISTINCTS (12, 14, 20, 4)
 *  pour qu'une assertion ne puisse pas confondre deux cases. */
const points: GrowthInput[] = [
  { bucket: '2026-08-09T23:00:00.000Z', value: 10 },
  { bucket: '2026-08-16T23:00:00.000Z', value: 20 },
  { bucket: '2026-08-23T23:00:00.000Z', value: 12 },
  { bucket: '2026-08-30T23:00:00.000Z', value: 4 },
];

describe('Des points aux barres', () => {
  it('chaque barre porte sa variation par rapport à la précédente', () => {
    const buckets = buildGrowthBuckets(points, range);
    expect(buckets).toHaveLength(4);
    expect(buckets[0].deltaPct).toBeNull(); // rien avant la première
    expect(buckets[1].deltaPct).toBeCloseTo(1); // 10 → 20
    expect(buckets[2].deltaPct).toBeCloseTo(-0.4); // 20 → 12
    expect(buckets.map((b) => b.value)).toEqual([10, 20, 12, 4]);
  });

  it('la DERNIÈRE période est marquée « en cours »', () => {
    const buckets = buildGrowthBuckets(points, range);
    expect(buckets.map((b) => b.isCurrent)).toEqual([false, false, false, true]);
  });

  it('une période précédente à zéro ne donne pas « +∞ » mais rien', () => {
    const fromZero = buildGrowthBuckets(
      [
        { bucket: '2026-08-09T23:00:00.000Z', value: 0 },
        { bucket: '2026-08-16T23:00:00.000Z', value: 5 },
      ],
      range,
    );
    expect(fromZero[1].deltaPct).toBeNull();
  });

  it('chaque barre porte une étiquette complète et une étiquette d’axe', () => {
    const buckets = buildGrowthBuckets(points, range);
    expect(buckets.every((b) => b.label.length > 0)).toBe(true);
    expect(buckets.every((b) => b.axisLabel.length > 0)).toBe(true);
  });
});

describe('Les chiffres de tête ignorent la période en cours', () => {
  it('la dernière période COMPLÈTE, et sa variation', () => {
    const summary = summarizeGrowth(buildGrowthBuckets(points, range));
    // 12, pas 4 : la semaine en cours ne conclut rien.
    expect(summary.lastComplete?.value).toBe(12);
    expect(summary.lastComplete?.deltaPct).toBeCloseTo(-0.4);
    expect(summary.current?.value).toBe(4);
  });

  it('la moyenne et la meilleure période portent sur les périodes terminées', () => {
    const summary = summarizeGrowth(buildGrowthBuckets(points, range));
    expect(summary.average).toBeCloseTo((10 + 20 + 12) / 3);
    expect(summary.best?.value).toBe(20);
  });

  it('sans aucune période terminée, il n’y a rien à conclure', () => {
    const single = buildGrowthBuckets([{ bucket: '2026-08-30T23:00:00.000Z', value: 4 }], range);
    const summary = summarizeGrowth(single);
    expect(summary.lastComplete).toBeNull();
    expect(summary.average).toBeNull();
    expect(summary.best).toBeNull();
    expect(summary.current?.value).toBe(4);
  });

  it('des périodes toutes vides ne désignent pas de « meilleure »', () => {
    const flat = buildGrowthBuckets(
      points.map((p) => ({ ...p, value: 0 })),
      range,
    );
    expect(summarizeGrowth(flat).best).toBeNull();
  });
});

describe("La variation de l'infobulle", () => {
  // Recharts ne rend aucune infobulle en jsdom (pas de mise en page) : la
  // phrase avait donc échappé à la correction d'accord des autres libellés et
  // disait « vs mois précédente ». Elle est désormais une fonction pure,
  // atteignable par un test.
  const buckets = buildGrowthBuckets(points, range);

  it('accorde le genre, comme le reste du bloc', () => {
    expect(growthDeltaPhrase(buckets[2], 'week')).toBe(' · -40,0 % vs semaine précédente');
    expect(growthDeltaPhrase(buckets[2], 'month')).toBe(' · -40,0 % vs mois précédent');
    expect(growthDeltaPhrase(buckets[2], 'month')).not.toMatch(/précédente/);
  });

  it('porte le signe des hausses', () => {
    expect(growthDeltaPhrase(buckets[1], 'week')).toBe(' · +100,0 % vs semaine précédente');
  });

  it("ne dit rien sur la période en cours ni sur la première", () => {
    expect(growthDeltaPhrase(buckets[3], 'week')).toBe(''); // en cours
    expect(growthDeltaPhrase(buckets[0], 'week')).toBe(''); // rien avant elle
  });
});

describe('Le bloc rendu', () => {
  const props = {
    title: 'Croissance des clients',
    description: 'Nouveaux clients inscrits',
    mode: 'week' as const,
    onModeChange: () => undefined,
    loading: false,
    color: '#059669',
    format: (v: number) => String(v),
    unit: 'Nouveaux clients',
  };

  it('offre le choix du pas : Semaine ou Mois', () => {
    render(<GrowthMatrixBlock {...props} buckets={buildGrowthBuckets(points, range)} />);
    expect(screen.getByRole('button', { name: 'Semaine' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mois' })).toBeTruthy();
  });

  it('affiche la dernière période complète, pas celle en cours', () => {
    render(<GrowthMatrixBlock {...props} buckets={buildGrowthBuckets(points, range)} />);
    expect(screen.getByText('Dernière semaine complète')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy(); // et non 4, la semaine en cours
    expect(screen.getByText('14')).toBeTruthy(); // moyenne des trois terminées
    expect(screen.getByText('20')).toBeTruthy(); // meilleure période
    // Et il le DIT, plutôt que de laisser croire à une chute.
    expect(screen.getByText(/est la semaine en cours/i)).toBeTruthy();
  });

  it('accorde le genre : « la semaine », mais « le mois »', () => {
    // Composés à partir du seul nom, les libellés donnaient « dernière mois
    // complète » et « la mois en cours ». Le genre s'écrit, il ne se devine pas.
    const monthly = buildGrowthBuckets(points, buildGrowthRange('month', 4, now));
    render(<GrowthMatrixBlock {...props} mode="month" buckets={monthly} />);
    expect(screen.getByText('Dernier mois complet')).toBeTruthy();
    expect(screen.getByText(/est le mois en cours/i)).toBeTruthy();
    expect(screen.getByText(/vs le mois d'avant/i)).toBeTruthy();
    expect(screen.queryByText(/dernière mois/i)).toBeNull();
  });

  it('une période sans mouvement le dit au lieu de dessiner un graphique vide', () => {
    render(
      <GrowthMatrixBlock
        {...props}
        buckets={buildGrowthBuckets(points.map((p) => ({ ...p, value: 0 })), range)}
      />,
    );
    expect(screen.getByText(/Aucun mouvement/i)).toBeTruthy();
  });
});
