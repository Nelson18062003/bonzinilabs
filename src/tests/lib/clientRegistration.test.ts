// « Enregistré par » sur la fiche client : qui, dans l'équipe, a créé la fiche.
import { describe, it, expect } from 'vitest';
import { clientRegistration, registrationDate, registrationText } from '@/lib/clientRegistration';

const base = { registered_by: null, registered_by_name: null, registered_role: null, registered_site: null, registered_at: null };

describe('clientRegistration', () => {
  it('créé par un collaborateur : son nom, son rôle et son site du jour', () => {
    const r = clientRegistration({ ...base, registered_by: 'u1', registered_by_name: 'Kevin Nkolo', registered_role: 'receptionist', registered_site: 'Guangzhou · bureau', registered_at: '2026-10-06T08:00:00Z' });
    expect(registrationText(r)).toBe('Kevin Nkolo · Réceptionnaire · Guangzhou · bureau');
    expect(registrationDate(r)).toMatch(/^le 6 oct\. 2026$/);
  });

  it('collaborateur sans site (créé avant le 06/10) : on le dit', () => {
    const r = clientRegistration({ ...base, registered_by: 'u2', registered_by_name: 'Grace Ebogo', registered_role: 'ops' });
    expect(registrationText(r)).toBe('Grace Ebogo · Opérations · site non renseigné');
  });

  it('personne et créé depuis le début du suivi : inscrit lui-même', () => {
    expect(registrationText(clientRegistration({ ...base, created_at: '2026-08-01T10:00:00Z' }))).toBe('Inscrit lui-même (application)');
  });

  it('personne et créé avant le suivi : on ne sait pas', () => {
    expect(registrationText(clientRegistration({ ...base, created_at: '2026-01-15T10:00:00Z' }))).toBe('Non renseigné (créé avant le suivi)');
    expect(registrationText(clientRegistration(null))).toBe('Non renseigné (créé avant le suivi)');
  });
});
