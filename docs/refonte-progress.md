# Refonte mobile — suivi du run autonome (nocturne)

Branche : `claude/stoic-ritchie-Ov4D2` · PR : **#141**
Réfs : `docs/audit-refonte-mobile.md` + langage **Ofspace/Mola** (voir
`src/mobile/screens/assistant/MobileAssistantScreen.tsx` et
`src/__screenshot__/flyer.tsx`).

## Règles autonomes (IMPÉRATIVES)
1. **Préserver TOUTE la logique** des écrans (handlers, hooks, états, data) — ne changer que la présentation.
2. Après CHAQUE étape : `npm run type-check` **et** `npm run build` doivent passer. Si rouge → corriger AVANT de committer.
3. **Commit + push après chaque étape** : `git push -u origin claude/stoic-ritchie-Ov4D2` (retry x4 backoff si réseau).
4. **Ne PAS supprimer les V1 morts** (coordination avec le frère) — juste documenter.
5. **Une seule case par itération** (petits pas, vérifiables).
6. Captures clair/sombre via le harness quand faisable (non bloquant : si le serveur/Playwright échoue, continuer sans).
7. **Reset conteneur ?** → `git fetch origin claude/stoic-ritchie-Ov4D2` puis `git checkout -f -B claude/stoic-ritchie-Ov4D2 origin/claude/stoic-ritchie-Ov4D2` ; recréer `.env` dummy si besoin ; réinstaller chromium si captures (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright install chromium`) ; reprendre à la 1re case non cochée.
8. Cocher la case ici + courte note, dans le même commit que l'étape.
9. **Fin** : quand tout est coché → mettre à jour la description de la PR #141 (récap) → écrire un résumé du matin dans `docs/refonte-progress.md` (section « Résumé matin ») → **arrêter le loop**.

## Décisions (prises en autonomie)
- DS = évolution de `components/treasury/ui.tsx` vers Ofspace (ombre douce, pastilles **neutres**, canvas doux, pilules sombres, gros chiffres, zéro dégradé).
- V1 morts NON supprimés.
- Ordre ci-dessous.

## Checklist

### Phase 0 — Fondations
- [x] **P0.1** Tokens couleurs centraux → `src/mobile/designKit/` (tokens.ts: SURFACE/TEXT/pills/TONE ; status.ts: depositStatusTone/paymentStatusTone/clientStatusTone + roleMeta unique ; methods.ts: PAYMENT_METHOD + LOGO_PATH alipay/wechat/whatsapp ; cash=rouge aligné flyer). type-check OK.
- [x] **P0.2** Kit UI → `src/mobile/designKit/components.tsx` (+ export depuis `index.ts`) : `Card` (ombre douce), `Holder` (pastille neutre + variante par `Tone`), `Avatar` (initiales), `Row` (sans filets), `Amount` (chiffre neutre + unité atténuée, `tabular-nums`), `PrimaryPill`/`SoftPill`, `StatusPill` (tone+label), `StatCard`, `Segmented`, `FormField`/`TextInput` (h-12 rounded), `BottomSheet` (overlay + fermeture backdrop/Échap/X + lock scroll), `ScreenLoader`/`ScreenError`, `SectionTitle`. Présentationnels, typés, dark mode via tokens. type-check + build OK.
- [ ] **P0.3** Preview du kit dans le harness (`screen=kit`) + capture clair/sombre dans `docs/maquettes/`.

### Phase 1 — Couleurs unifiées (faible risque, fort impact)
- [ ] **P1.1** Rôles admin : source unique → MobileAdminsScreen, MobileCreateAdmin, MobileAdminDetail importent la même.
- [ ] **P1.2** Statuts : source unique → clients, deposits, payments (badges) importent la même.

### Phase 2 — Migration module par module
- [ ] **M1** More (hub + settings + profile + notifications + history + proofs)
- [ ] **M2** Clients (liste · détail · create · ledger · beneficiaries)
- [ ] **M3** Deposits (liste V2 · détail V2 · new) — logique intacte
- [ ] **M4** Payments (liste · détail · new)
- [ ] **M5** Rates (onglets unifiés · simulator · porter le flyer v3 dans `generate-flyer` Satori)
- [ ] **M6** Admins (liste · create · detail)
- [ ] **M7** Support (liste · conversation · stats · canned · quick)
- [ ] **M8** Agent-cash (login · payments · scanner · detail · confirm · success)
- [ ] **M9** Alignement final : Treasury + Accueil + Analytics sur tokens définitifs

### Final
- [ ] **F1** `type-check` + `build` + `lint` verts sur l'ensemble
- [ ] **F2** Description PR #141 mise à jour (récap complet)
- [ ] **F3** Section « Résumé matin » écrite ci-dessous + STOP loop

## Journal
- (init) Audit livré, plan validé par l'utilisateur, run autonome lancé.
- P0.1 ✅ designKit (tokens/status/methods) créé — source unique couleurs/statuts/rôles/méthodes. Aucun écran modifié (sûr). Prochaine : P0.2 composants du kit.
- P0.2 ✅ Kit de composants partagés `designKit/components.tsx` (Card, Holder, Avatar, Row, Amount, PrimaryPill/SoftPill, StatusPill, StatCard, Segmented, FormField/TextInput, BottomSheet, ScreenLoader/ScreenError, SectionTitle) — patterns copiés de MobileAssistantScreen + flyer, réutilise tokens + `cn`. Aucun écran métier touché. type-check + build verts. Prochaine : P0.3 preview du kit dans le harness.

## Résumé matin
_(à remplir en fin de run)_
