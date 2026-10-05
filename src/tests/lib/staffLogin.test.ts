// La connexion du personnel (06/10) : chaque rôle reçoit la page où il peut
// VRAIMENT entrer. Le message d'accès envoyait tout le monde vers /m/login,
// qui sur le site n'accepte que le code email — un commercial à l'adresse
// inventée (« prenom@bonzini.com ») ne pouvait entrer nulle part.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROLE_PERMISSIONS, type AppRole } from '@/contexts/AdminAuthContext';
import { staffHomeFor, staffLoginFor, staffLoginTakesPassword } from '@/lib/staffHome';
import { accessLogin, accessMessage } from '@/lib/team';

const ROLES = Object.keys(ROLE_PERMISSIONS) as AppRole[];
const APP = readFileSync(resolve(__dirname, '../../App.tsx'), 'utf8');

describe('La page de connexion de chaque rôle', () => {
  it('commercial → /v/login ; réception, entrepôt, agent cash → la leur ; les autres → /m/login', () => {
    expect(staffLoginFor('commercial')).toBe('/v/login');
    expect(staffLoginFor('receptionist')).toBe('/r/login');
    expect(staffLoginFor('warehouse_agent')).toBe('/w/login');
    expect(staffLoginFor('cash_agent')).toBe('/a/login');
    for (const r of ['super_admin', 'ops', 'support', 'customer_success', 'treasurer', 'customs_broker'] as AppRole[]) {
      if (ROLES.includes(r)) expect(staffLoginFor(r), r).toBe('/m/login');
    }
    expect(staffLoginFor(null)).toBe('/m/login');
  });

  it('est dans le même espace que celui où le rôle arrive', () => {
    for (const r of ROLES) expect(staffLoginFor(r).split('/')[1], r).toBe(staffHomeFor(r).split('/')[1]);
  });

  it('existe dans le routeur, sans exiger de session', () => {
    for (const r of ROLES) {
      const path = staffLoginFor(r);
      const line = APP.split('\n').find((l) => l.includes(`path="${path}"`));
      expect(line, `${r} → ${path}`).toBeTruthy();
      expect(line, path).toMatch(/requireAuth=\{false\}/);
    }
  });

  it('accepte le mot de passe sur le site partout, sauf /m/login', () => {
    for (const r of ROLES) expect(staffLoginTakesPassword(r), r).toBe(staffLoginFor(r) !== '/m/login');
  });
});

describe('Le message d’accès', () => {
  const base = { name: 'Aristide Landry', email: 'aristidelandry@bonzini.com', password: 'a3f9c2d10b4e' };

  it('commercial : la page /v/login, l’email, le mot de passe, et « change-le »', () => {
    const msg = accessMessage({ ...base, role: 'commercial' });
    expect(msg).toContain('Bonjour Aristide,');
    expect(msg).toContain('Connexion : https://www.bonzinilabs.com/v/login (ou l\'app BONZINI HQ)');
    expect(msg).toContain('Email : aristidelandry@bonzini.com');
    expect(msg).toContain('Mot de passe provisoire : a3f9c2d10b4e');
    expect(msg).toContain('Change-le après ta première connexion.');
    expect(msg).not.toContain('/m/login');
  });

  it('réception et entrepôt : leur page, sans « change-le » (pas d’écran pour ça, comptes souvent partagés)', () => {
    expect(accessMessage({ ...base, role: 'receptionist' })).toContain('https://www.bonzinilabs.com/r/login');
    expect(accessMessage({ ...base, role: 'warehouse_agent' })).toContain('https://www.bonzinilabs.com/w/login');
    for (const r of ['receptionist', 'warehouse_agent', 'cash_agent'] as AppRole[]) {
      expect(accessMessage({ ...base, role: r }), r).not.toContain('Change-le');
      expect(accessLogin(r).canChange, r).toBe(false);
    }
  });

  it('les rôles de /m : l’app HQ pour le mot de passe, le site pour le code email — pas l’inverse', () => {
    const msg = accessMessage({ ...base, role: 'ops' });
    expect(msg).toContain("l'app BONZINI HQ avec cet email et ce mot de passe");
    expect(msg).toContain('https://www.bonzinilabs.com/m/login (code envoyé à ton email)');
    expect(msg).toContain('Change-le après ta première connexion.');
    expect(accessLogin('ops')).toEqual({ url: 'https://www.bonzinilabs.com/m/login', password: false, canChange: true });
  });

  it('la page « changer son mot de passe » promise existe pour chaque rôle à qui on la promet', () => {
    expect(APP).toMatch(/path="\/v\/password"/);
    expect(APP).toMatch(/path="\/m\/more\/password"/);
    for (const r of ROLES) expect(accessLogin(r).canChange, r).toBe(r === 'commercial' || staffLoginFor(r) === '/m/login');
  });
});
