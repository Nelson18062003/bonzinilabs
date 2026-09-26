@AGENTS.md

# BONZINI HQ — app mobile du personnel (Expo SDK 57, Expo Router)

App NATIVE (Android + iOS, interne) : connexion, onglets, accueil, scanner et
« Moi » sont natifs ; les écrans métier restent ceux du site
(https://www.bonzinilabs.com) dans UNE WebView toujours montée, que les
onglets natifs pilotent sans rechargement.

## Routes (`src/app/`)
- `_layout.tsx` : SafeArea + HQProvider + pile (scanner en plein écran, Moi en modale).
- `index.tsx` : WebView + barre d'onglets native par rôle + accueil natif +
  connexion native + verrou Face ID + hors ligne + masque arrière-plan.
- `scanner.tsx` : expo-camera (QR + codes-barres), torche, mode continu.
- `me.tsx` : profil, verrou, déconnexion.

## Modules (`src/`)
- `store.tsx` : utilisateur (d'après le site), page courante, poignée WebView, scan en cours.
- `HQWebView.tsx` : WebView + poignée (navigate, setSession, logout, deliverScan).
- `bridge.ts` / `files.ts` : script injecté (téléchargements, partage,
  presse-papiers, thème) → fichiers et feuille de partage natifs.
- `supabase.ts` : `loginClient` (connexion seulement) et `db` (lectures
  natives avec le jeton transmis par le site).
- `roles.ts`, `tabs.ts`, `scan.ts` : miroir des règles du site — le test
  `src/tests/hqApp/parity.test.ts` (racine) échoue en cas de dérive.

## Session — règle absolue
Le SITE est le seul à garder et rafraîchir la session (supabase-js). L'app
se connecte, confie la session au site (`setSession`) puis reçoit chaque
jeton (message `auth`). Ne jamais rafraîchir côté app, ne jamais appeler
`signOut` d'un client de l'app (révoquerait la session du site).

Côté site : `src/lib/nativeBridge.ts`, `src/components/NativeAppBridge.tsx`,
`src/lib/nativeApp.ts`, `useQrScanner` (caméra native dans l'app).

Ne JAMAIS créer `ios/` ni `android/` (EAS les génère). Avant de livrer :
`npm run typecheck && npm run doctor`. Guide : `../docs/APP_MOBILE_BONZINI_HQ.md`.
