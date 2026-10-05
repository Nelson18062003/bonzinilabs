import { describe, it, expect } from 'vitest';
import { ROLE_PERMISSIONS, type AppRole } from '@/contexts/AdminAuthContext';
import { ROLE_DESCRIPTION, TEAMS, lastSeen, memberName, roleSpace, teamOf } from '@/lib/team';
import { OBJECTIVES, currentMonth, monthLabel, progress, shiftMonth, toE164 } from '@/lib/sales';

const ROLES = Object.keys(ROLE_PERMISSIONS) as AppRole[];

describe('Mes équipes — chaque rôle a sa place', () => {
  it('chaque rôle appartient à exactement une équipe', () => {
    for (const r of ROLES) expect(TEAMS.filter((t) => t.roles.includes(r)).map((t) => t.key), r).toHaveLength(1);
    expect(TEAMS.flatMap((t) => t.roles).sort()).toEqual([...ROLES].sort());
  });

  it('chaque rôle est décrit et a un espace nommé', () => {
    for (const r of ROLES) {
      expect(ROLE_DESCRIPTION[r]?.length, r).toBeGreaterThan(10);
      expect(roleSpace(r)).not.toMatch(/^\//);
    }
    expect(roleSpace('commercial')).toBe('Espace commercial');
    expect(teamOf('commercial').key).toBe('ventes');
  });

  it('nomme un membre, ou retombe sur son email', () => {
    expect(memberName({ first_name: 'Jean', last_name: 'Mbarga' })).toBe('Jean Mbarga');
    expect(memberName({ first_name: null, last_name: null, email: 'j@x.cm' })).toBe('j@x.cm');
  });

  it('dit quand il s’est connecté', () => {
    const now = Date.parse('2026-10-05T12:00:00Z');
    expect(lastSeen(null)).toBe('jamais connecté');
    expect(lastSeen('2026-10-05T11:30:00Z', now)).toBe('il y a 30 min');
    expect(lastSeen('2026-10-05T09:00:00Z', now)).toBe('il y a 3 h');
    expect(lastSeen('2026-10-04T10:00:00Z', now)).toBe('hier');
  });
});

describe('Ventes — numéros, mois, objectifs', () => {
  it('met un numéro au format international, Cameroun par défaut', () => {
    expect(toE164('+237 699 12 34 56')).toBe('+237699123456');
    expect(toE164('00237699123456')).toBe('+237699123456');
    expect(toE164('699 12 34 56')).toBe('+237699123456');
    expect(toE164('+86 138-0000-0000')).toBe('+8613800000000');
    expect(toE164('12345')).toBeNull();
  });

  it('compte les mois de Douala', () => {
    expect(currentMonth(new Date('2026-10-31T23:30:00Z'))).toBe('2026-11-01'); // déjà novembre à Douala (UTC+1)
    expect(currentMonth(new Date('2026-10-15T10:00:00Z'))).toBe('2026-10-01');
    expect(shiftMonth('2026-01-01', -1)).toBe('2025-12-01');
    expect(shiftMonth('2026-12-01', 1)).toBe('2027-01-01');
    expect(monthLabel('2026-10-01')).toBe('octobre 2026');
  });

  it('borne l’avancement d’un objectif', () => {
    expect(progress({ target: 100, actual: 50 })).toBe(0.5);
    expect(progress({ target: 100, actual: 250 })).toBe(1);
    expect(progress({ target: 0, actual: 5 })).toBe(0);
  });

  it('connaît les mêmes objectifs que le serveur', () => {
    // Liste de la contrainte commercial_objectives.metric (migration 20261005160000).
    expect(OBJECTIVES.map((o) => o.metric).sort()).toEqual(['air_kg', 'new_clients', 'payments_xaf', 'prospects_new', 'prospects_won', 'sea_cbm']);
  });
});
