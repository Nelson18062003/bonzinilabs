import { describe, it, expect } from 'vitest';

/** La règle de pagination du grand livre (F-030) : une page pleine appelle la
 *  suivante, une page courte est la dernière. Recopie de getNextPageParam. */
const LEDGER_PAGE = 100;
const next = (last: unknown[], pages: unknown[][]) => (last.length < LEDGER_PAGE ? undefined : pages.length * LEDGER_PAGE);

describe('grand livre client — pagination', () => {
  it('page pleine → la suivante commence à N × 100', () => {
    const full = Array.from({ length: LEDGER_PAGE });
    expect(next(full, [full])).toBe(100);
    expect(next(full, [full, full])).toBe(200);
  });
  it('page courte (ou vide) → fin', () => {
    expect(next(Array.from({ length: 7 }), [[]])).toBeUndefined();
    expect(next([], [[]])).toBeUndefined();
  });
});
