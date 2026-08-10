// ============================================================
// Fraîcheur du bundle send-sms destiné au dashboard.
//
// CE QUE CE TEST PROTÈGE : faute d'accès CLI, la fonction send-sms est
// déployée en collant `scripts/generated/send-sms.dashboard.ts` dans
// l'éditeur du dashboard Supabase. Ce fichier est une COPIE générée des
// gabarits.
//
// Si quelqu'un corrige un gabarit dans _shared/sms-templates.ts sans
// régénérer le bundle, les deux versions divergent — et la production
// continue d'envoyer l'ancien texte, sans le moindre signal. Sur des
// messages qui annoncent des soldes et des références de paiement, cette
// divergence est exactement le genre de chose qu'on découvre par un
// client mécontent.
//
// Ce test échoue dès que le bundle n'est plus le reflet exact des sources.
// ============================================================

import { describe, expect, it } from 'vitest';
import ts from 'typescript';

// @ts-expect-error — script Node en .mjs, sans déclarations de types.
import { buildBundle, readBundleOnDisk, OUTPUT } from '../../../scripts/bundle-send-sms.mjs';

const bundle: string = buildBundle();

describe('bundle send-sms pour le dashboard', () => {
  it('est à jour vis-à-vis des sources partagées', () => {
    expect(
      readBundleOnDisk(),
      `${OUTPUT} ne correspond plus aux sources. Lancez : npm run bundle:send-sms`,
    ).toBe(bundle);
  });

  it('ne contient plus aucun import relatif', () => {
    // Le dashboard ne résout pas ../_shared/… : un import relatif restant
    // ferait échouer le déploiement, sans message clair.
    expect(bundle).not.toMatch(/from\s+["']\.\.?\//);
  });

  it('conserve les imports externes nécessaires à Deno', () => {
    expect(bundle).toContain('https://deno.land/std@0.168.0/http/server.ts');
    expect(bundle).toContain('https://esm.sh/@supabase/supabase-js@2');
  });

  it('est syntaxiquement valide', () => {
    const sourceFile = ts.createSourceFile(
      'send-sms.dashboard.ts',
      bundle,
      ts.ScriptTarget.ES2022,
      true,
      ts.ScriptKind.TS,
    );
    // parseDiagnostics n'est pas dans les types publics mais existe bien.
    const diagnostics =
      (sourceFile as unknown as { parseDiagnostics?: ts.Diagnostic[] }).parseDiagnostics ?? [];
    const messages = diagnostics.map((d) =>
      ts.flattenDiagnosticMessageText(d.messageText, ' '),
    );
    expect(messages).toEqual([]);
  });

  it('embarque tout ce que le drainer consomme', () => {
    // Un symbole manquant ne se verrait qu'à l'exécution, en production.
    for (const symbol of [
      'renderSms',
      'resolveLocale',
      'measureSms',
      'foldToGsm7',
      'truncateForSms',
      'SMS_TEMPLATES',
    ]) {
      expect(bundle, `${symbol} absent du bundle`).toMatch(
        new RegExp(`(function|const|type|interface)\\s+${symbol}\\b`),
      );
    }
    expect(bundle).toMatch(/serve\(async \(req\)/);
  });

  it('porte un avertissement « ne pas modifier à la main »', () => {
    expect(bundle).toContain('NE PAS MODIFIER À LA MAIN');
  });
});
