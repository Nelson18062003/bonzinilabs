import { describe, it, expect } from 'vitest';
import { whenSentence } from '@/lib/plainTime';

const NOW = new Date('2026-09-13T12:00:00Z');
describe('QUAND — en français de tous les jours', () => {
  it('compte en minutes, puis en heures', () => {
    expect(whenSentence('2026-09-13T11:59:30Z', NOW)).toBe("à l'instant");
    expect(whenSentence('2026-09-13T11:20:00Z', NOW)).toBe('il y a 40 minutes');
    expect(whenSentence('2026-09-13T01:00:00Z', NOW)).toBe('il y a 11 heures');
    expect(whenSentence('2026-09-13T10:59:00Z', NOW)).toBe('il y a 1 heure');
  });
  it('dit « hier » puis les jours, puis la date en toutes lettres', () => {
    expect(whenSentence('2026-09-12T08:00:00Z', NOW)).toBe('hier');
    expect(whenSentence('2026-09-10T08:00:00Z', NOW)).toBe('il y a 3 jours');
    expect(whenSentence('2026-09-01T08:00:00Z', NOW)).toBe('le 1 septembre');
    expect(whenSentence('2025-12-24T08:00:00Z', NOW)).toBe('le 24 décembre 2025');
  });
});
