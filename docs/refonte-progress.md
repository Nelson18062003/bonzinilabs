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
- [x] **P0.3** Preview du kit dans le harness → `src/__screenshot__/kit.tsx` (un échantillon de CHAQUE composant sur le canvas Ofspace), enregistré dans `main.tsx` (clé `kit`, route `/`). Captures clair+sombre faites via le harness et copiées dans `docs/maquettes/` (`kit-light.png` / `kit-dark.png`). Rendu validé visuellement (langage Ofspace respecté, dark mode OK).

### Phase 1 — Couleurs unifiées (faible risque, fort impact)
- [x] **P1.1** Rôles admin : source unique → MobileAdminsScreen, MobileCreateAdmin, MobileAdminDetail importent la même.
- [x] **P1.2** Statuts : source unique → clients, deposits, payments (badges) importent la même.

### Phase 2 — Migration module par module
- [x] **M1** More (hub + settings + profile + notifications + history + proofs)
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
- P0.3 ✅ Écran de preview `src/__screenshot__/kit.tsx` (galerie : un échantillon de chaque composant, StatusPill câblés sur les helpers de tons unifiés) + enregistré dans `main.tsx` (clé `kit`). Serveur `SCREENSHOT_MOCK=1` + `ONLY=kit FONT=dm node tools/shoot-dash.mjs` → captures clair+sombre OK, copiées dans `docs/maquettes/kit-light.png` + `kit-dark.png`. type-check + build verts. **Phase 0 terminée.** Prochaine : Phase 1 (P1.1 rôles admin, P1.2 statuts) puis migration module par module.
- P1.1 ✅ Rôles admin sur source unique : les 3 `ROLE_BADGE_COLORS` dupliqués (MobileAdminsScreen, MobileCreateAdmin, MobileAdminDetail) supprimés → remplacés par `roleMeta()` (tone) + `StatusPill`/`Holder` du kit. Libellés conservés via `ADMIN_ROLE_LABELS`. Ajout du rôle `treasurer` (tone `success`) à `ROLE_META` pour compléter la source unique (parité avec `AppRole`). Logique/permissions/filtres intacts. type-check + build verts.
- P1.2 ✅ Statuts sur source unique (badges liste + détail des écrans VIVANTS) : clients (`MobileClientsScreen`, `MobileClientDetail` → `clientStatusTone`), dépôts V2 (`MobileDepositsScreenV2`, `MobileDepositDetailV2` → `depositStatusTone`, dicos `STATUS_COLOR` inline + const `BLUE` orpheline supprimés), paiements (`MobilePaymentsScreen` → `paymentStatusTone`, import `PAYMENT_STATUS_COLORS` retiré ; `MobilePaymentDetailV2` → `paymentStatusTone`, dico `STATUS_COLOR` local supprimé). Tous les badges passent par `StatusPill`. Libellés existants conservés (`*_STATUS_LABELS`, `STATUS_LABEL_KEYS`, `PAYMENT_STATUS_CONFIG`, ternaires i18n). V1 morts (`MobileDepositsScreen`/`MobileDepositDetail`) NON touchés (non routés). Logique/filtres/permissions intacts. type-check + build verts.
- M1 (1/6) ✅ `MobileMoreScreen` (hub) migré sur le kit : contenu sur canvas doux `SURFACE.canvas`, items regroupés en `Card`s par section (`SectionTitle` : Outils / Activité / Support / Administration), nouveau `MenuRow` au langage Ofspace (Holder neutre + libellé/desc + pastille de compteur + chevron, sans filets), profil en `Card` cliquable, toggles thème/langue en `Card`, déconnexion en `Card` (tone danger). Navigation, permissions (`canViewTreasury`/`canAccessSupportChat`/`canManageUsers`), badges (notif + support) et `ThemeToggleCompact`/`LanguageSwitcher` intacts. type-check + build verts.
- M1 (6/6) ✅ **Module More terminé.** 5 écrans restants migrés sur le kit :
  - `more/MobileSettingsScreen` → canvas + `SectionTitle` (Apparence/Compte/À propos) + `Card`/`Row` ; `ThemeToggle` conservé ; rôle affiché en `StatusPill` (`roleMeta`).
  - `MobileAdminProfile` → canvas + holder avatar (overlay caméra conservé) + `FormField`/`TextInput` + `PrimaryPill`. TOUTE la logique upload Storage (`avatars`) + RPC `update_my_admin_profile` + `refreshProfile` + `validateUploadFile` intacte.
  - `MobileNotificationsScreen` → canvas + groupes par date en `SectionTitle` + cartes (`SURFACE.card`) + `Holder` toné par type (`TYPE_CONFIG` → `Tone` au lieu de classes hex) ; groupement/relative-date intacts.
  - `MobileHistoryScreen` → canvas + recherche `TextInput` + chips filtres (`PRIMARY_PILL`/`SOFT_PILL`) + lignes en `Card` avec `Avatar` + badge cible en `StatusPill` toné (`getTargetTone`) ; recherche debouncée + filtre type intacts.
  - `MobileProofsScreen` → canvas + 2× `StatCard` + recherche `TextInput` + grille de vignettes (`SURFACE.card`) avec badge `StatusPill` ; **drawer de prévisualisation → `BottomSheet`** (fermeture backdrop/Échap/X + lock scroll du kit) avec `Row`/`PrimaryPill` ; `ProofThumb` + URLs signées + ouverture fichier intacts.
  - type-check + build verts.
- Captures M1 ✅ Écrans More enregistrés dans le harness (`src/__screenshot__/main.tsx` : clés `more`, `more-settings`, `more-profile`, `more-notifications`, `more-history`, `more-proofs`) + fixtures mock ajoutées dans `tools/shoot-dash.mjs` (audit logs + user_roles + deposit_proofs). Serveur `SCREENSHOT_MOCK=1 vite --host 127.0.0.1 --port 8080` + `ONLY=more,... FONT=dm node tools/shoot-dash.mjs` → 14 captures clair+sombre OK. Copiées dans `docs/maquettes/` (`more-light/dark`, `more-settings-light`, `more-profile-light`, `more-notifications-light`, `more-history-light/dark`, `more-proofs-light/dark`) + kit rafraîchi. Rendu Ofspace validé visuellement (canvas doux, cartes à ombre, holders neutres, StatusPill tonés, BottomSheet). Note : l'écran Notifications rend son empty-state sous le harness (les mocks dépôts/paiements ne composent pas de notifications) — non bloquant.

- M2 (1/5) ✅ `MobileClientsScreen` migré sur le kit : contenu sur canvas doux `SURFACE.canvas`, recherche en `TextInput` (icône `Search`), chips filtres statut en `PRIMARY_PILL`/`SOFT_PILL` (remplace `MobileFilterChips`), lignes client en carte (`SURFACE.card`+`shadow`, bouton) avec `Avatar` (initiales) + `StatusPill` toné (`clientStatusTone`) + solde en gros chiffre `tabular-nums` ; stats dépôts/paiements sans filet ; empty-state `Holder`+`PrimaryPill` (remplace `MobileEmptyState`) ; FAB en `PRIMARY_PILL`. Recherche debouncée + filtre statut client-side + navigation intacts. type-check + build verts.

- M2 (2/5) ✅ `MobileClientDetail` + `components/clients/AdjustmentDrawer` migrés sur le kit :
  - canvas doux ; profil en `Card` (holder initiales + `StatusPill` toné `clientStatusTone`, source UTM en `StatusPill` info) ; **hero solde** = `Card`+`Amount` (size `xl`, unité XAF atténuée) avec lien Historique + boutons Crédit (tone success) / Débit (tone danger) ; stats = 2× `StatCard` (dépôts success / paiements info) ; liste d'actions en `Card`+`ActionRow` (Holder toné + libellé/desc + chevron, calqué sur `MenuRow`, états loading/disabled pour relevé PDF et suppression).
  - **4 drawers → `BottomSheet`** : édition profil (`FormField`/`TextInput` + `PrimaryPill`/`SoftPill`), confirmation suppression (`PrimaryPill danger`), confirmation reset mdp, résultat mdp (code + `Holder` copier toné success). `AdjustmentDrawer` (crédit/débit) : shell `Drawer` → `BottomSheet`, `AmountField`/`TextArea`/`useCreateAdjustment` conservés, solde courant en `Amount`, warning toné pending, CTA `PrimaryPill` (danger si débit) ; garde-fou `handleClose` (bloque la fermeture pendant l'envoi) intact.
  - TOUTE la logique conservée : `useClient`/`useClientLedger`/`useUpdateClient`/`useResetClientPassword`/`useAdminDeleteClient`/`useCreateAdjustment`, garde `canManageUsers`, contrôle solde+paiements en cours avant suppression, génération relevé PDF, copie mot de passe. type-check + build verts.

- M2 (3/5) ✅ `MobileCreateClient` migré du **100 % inline `React.CSSProperties`** vers Tailwind + kit : suppression du thème inline + `<link>` DM Sans + `focusedField` (focus ring géré par `TextInput`) ; canvas doux ; header fixe (back ‹ + titre) + **barre de progression 3 segments** restylée (violet actif, tokens) ; contenu scrollable ; **footer collé avec CTA TOUJOURS visibles**. Étape 1/2/3 en `FormField`+`TextInput` ; 2 `<select>` natifs (indicatif pays + pays avec optgroups) stylés au gabarit `TextInput` (h-12, carte, ring) ; récap étape 3 en `Card` (holder initiales + `Row`) ; notes mot de passe tonées pending ; **écran succès** en `Card`+`Holder` succès + code + `Holder` copier (toné success) + `PrimaryPill`/`SoftPill`. TOUTE la logique conservée : `STEPS`, `COUNTRY_CODES`, `canNext`/`handleNext`/`handleBack`, `handleCreateClient` (clean phone + `useCreateClient`), `handleCopyPassword`, états succès (tempPassword/clientId). type-check + build verts.

- M2 (4/5) ✅ `MobileClientLedger` (mouvements) migré sur le kit : canvas doux ; carte info client en `Card` ; chips filtres en `PRIMARY_PILL`/`SOFT_PILL` (remplace `MobileFilterChips`) ; lignes en `Card` avec `Holder` toné + montant coloré par tone (`AMOUNT_TONE` calqué sur la palette des pills) ; empty-state `Holder`+texte (remplace `MobileEmptyState`). `ENTRY_TYPE_CONFIG` simplifié (classes hex bg/icon/amount → `tone`) en gardant icône/préfixe/label/`isInformational` (les écritures informatives = tone neutre) ; filtres + `useClient`/`useClientLedger` + refresh intacts. type-check + build verts.

## Résumé matin
_(à remplir en fin de run)_
