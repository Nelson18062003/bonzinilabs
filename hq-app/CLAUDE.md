@AGENTS.md

# BONZINI HQ — app mobile du personnel (Expo SDK 57)

Coque native autour des écrans du site (https://www.bonzinilabs.com) :
une WebView sur `/m/login`, connexion unique, puis le site envoie chacun
vers son espace selon son rôle (`src/lib/staffHome.ts` côté site).

- `App.tsx` : verrou Face ID / empreinte, écran hors connexion, masque
  dans le sélecteur d'apps, couleur des bords = fond de la page.
- `src/HQWebView.tsx` : liens (bonzinilabs.com dans l'app, le reste
  dehors), retour Android, caméra, rechargement après plantage.
- `src/bridge.ts` : script injecté — téléchargements `<a download>`,
  `navigator.share`, `navigator.clipboard` → messages vers l'app.
- `src/files.ts` : fichiers réels + feuille de partage du téléphone.

Côté site, `isNativeApp()` (`src/lib/nativeApp.ts`) masque Google et les
clés d'accès (impossibles en WebView) et montre le mot de passe.

Ne JAMAIS créer `ios/` ni `android/` : EAS les génère (CNG). Tout réglage
natif passe par `app.json`. Vérifier avant de livrer :
`npm run typecheck && npm run doctor`.
Guide de publication : `../docs/APP_MOBILE_BONZINI_HQ.md`.
