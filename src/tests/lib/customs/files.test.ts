// ============================================================
// Les fiches de classement : ce que l'écran en lit, et la lettre de
// demande de décision anticipée (art. 75) qu'on en tire.
// ============================================================
import { describe, it, expect } from 'vitest';
import { advanceRulingLetter, candidateRate, isEditable, isSigned, latestProposal, marketHints, pendingQuestion, type Classification, type ClassificationMessage } from '@/lib/customs/files';

const msg = (author: ClassificationMessage['author'], body: string, payload: ClassificationMessage['payload'] = null): ClassificationMessage =>
  ({ id: body, author, body, payload, created_at: '2026-09-29T10:00:00Z' });

const regulator = { code: '850440', title: 'Convertisseurs statiques', heading: 'Transformateurs électriques, convertisseurs…', rate_min: 10, rate_max: 10, confidence: 0.82, reasoning: 'Un stabilisateur est un appareil électrique, pas frigorifique.', rules: ['RGI 1', 'RGI 6'] };
const thermostat = { ...regulator, code: '903289', title: 'Instruments de régulation automatique', confidence: 0.3, reasoning: 'Si c’est un régulateur automatique.' };

const file: Classification = {
  id: 'id', ref: 'CL-000001', client_user_id: 'u', product_name: 'Stabilisateur de tension 5 kVA', description: 'Pour la maison, 30 kg',
  facts: { type: 'servo' }, photo_paths: ['u/1.jpg'], candidates: [regulator, thermostat], proposed_code: '850440',
  status: 'approved', submitted_at: null, final_code: '850440', broker_note: 'Servomoteur : 85.04.', claimed_by: null,
  reviewed_by: 'b', reviewed_at: '2026-09-29T12:00:00Z', broker_company: 'CITRA SARL', broker_license_no: 'CAD-0451',
  created_at: '', updated_at: '', client: { first_name: 'Awa', last_name: 'Ngo', company_name: 'Awa Import', customer_code: 'BZ-AWA1' },
  messages: [],
};

describe('fiches de classement', () => {
  it('statuts : on écrit en brouillon et quand le CAD demande une précision ; signé = approuvé ou changé', () => {
    expect(isEditable('draft')).toBe(true);
    expect(isEditable('needs_info')).toBe(true);
    expect(isEditable('submitted')).toBe(false);
    expect(isSigned('changed')).toBe(true);
    expect(isSigned('in_review')).toBe(false);
  });

  it('la dernière proposition, et la question qui attend une réponse', () => {
    const messages = [
      msg('client', 'régulateur'),
      msg('assistant', 'Proposition', { type: 'proposal', candidates: [thermostat] }),
      msg('client', 'C’est à servomoteur'),
      msg('assistant', 'Nouvelle proposition', { type: 'proposal', candidates: [regulator] }),
      msg('assistant', 'Neuf ou usagé ?', { type: 'question', options: ['Neuf', 'Usagé'] }),
    ];
    expect(latestProposal(messages)!.candidates[0].code).toBe('850440');
    expect(pendingQuestion(messages)!.body).toBe('Neuf ou usagé ?');
    expect(pendingQuestion([...messages, msg('client', 'Neuf')])).toBeNull();
  });

  it('le taux d’un candidat : unique ou en fourchette', () => {
    expect(candidateRate({ rate_min: 10, rate_max: 10 })).toBe('10 %');
    expect(candidateRate({ rate_min: 5, rate_max: 20 })).toBe('5–20 %');
    expect(candidateRate({ rate_min: null, rate_max: null })).toBe('—');
  });
});

describe('les pistes du marché envoyées à l’assistant', () => {
  it('un mot du marché dans une description longue donne ses codes et le piège', () => {
    const hints = marketHints('Stabilisateur de tension 5 kVA pour la maison, à servomoteur');
    expect(hints.map((h) => h.code)).toEqual(expect.arrayContaining(['850440', '903289']));
    expect(hints.find((h) => h.code === '850440')!.tip).toMatch(/réfrigérateur/);
  });
  it('rien d’inventé quand aucun mot ne correspond, et huit pistes au plus', () => {
    expect(marketHints('Xyzzy plugh')).toEqual([]);
    expect(marketHints('téléphone chargeur écouteurs tablette ordinateur portable moto pneus friperie mèches carreaux').length).toBeLessThanOrEqual(8);
  });
});

describe('demande de décision anticipée (art. 75)', () => {
  const letter = advanceRulingLetter(file, new Date('2026-09-30T08:00:00Z'));

  it('vise l’article 75 et la direction générale des douanes', () => {
    expect(letter).toContain('article 75 du Code des douanes CEMAC');
    expect(letter).toContain('Directeur Général des Douanes');
  });
  it('porte le code signé, ses motifs, ses règles et le CAD qui l’a validé', () => {
    expect(letter).toContain('8504.40');
    expect(letter).toContain('RGI 1, RGI 6');
    expect(letter).toContain('CITRA SARL, commissionnaire agréé en douane (agrément CAD-0451)');
  });
  it('expose loyalement les autres classements envisagés', () => {
    expect(letter).toContain('exposés loyalement');
    expect(letter).toContain('9032.89');
  });
  it('n’invente ni NIU ni RCCM', () => {
    expect(letter).toContain('NIU : ………………');
    expect(letter).toContain('Awa Import');
  });
  it('sans signature, aucune mention d’un commissionnaire', () => {
    expect(advanceRulingLetter({ ...file, status: 'draft', broker_company: null })).not.toContain('commissionnaire agréé');
  });
});
