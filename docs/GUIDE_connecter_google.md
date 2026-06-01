# Guide — Connecter « Se connecter avec Google »

Ce guide est **100 % hors-code** : tout se passe dans deux sites web
(Google Cloud Console et le tableau de bord Supabase). Aucune ligne à écrire.

La base de données et le code de l'app sont **déjà prêts**. Il ne reste qu'à
brancher Google.

---

## Les 2 URLs à garder sous la main

Tu en auras besoin pendant la config. Copie-les quelque part.

| Nom | Valeur à copier |
|---|---|
| **URL de retour Supabase** (à donner à Google) | `https://fmhsohrgbznqmcvqktjw.supabase.co/auth/v1/callback` |
| **URL de retour de l'app** (à donner à Supabase) | `https://bonzinilabs.com/auth/callback` |
| (variante www) | `https://www.bonzinilabs.com/auth/callback` |
| (test local, optionnel) | `http://localhost:8080/auth/callback` |

---

## ÉTAPE B — Google Cloud Console (obtenir Client ID + Secret)

But : obtenir **2 codes** (un « Client ID » et un « Client Secret ») qu'on
collera ensuite dans Supabase.

1. Va sur **https://console.cloud.google.com/**
2. Tout en haut, **crée un projet** (menu déroulant de projet → « Nouveau projet »).
   Nomme-le `Bonzini` par ex. → Créer → sélectionne ce projet.
3. Dans la barre de recherche en haut, tape **« Google Auth Platform »** (ou
   « OAuth ») et ouvre-le. Clique **« Get started / Commencer »** si proposé.
4. **Écran de consentement (Branding / Audience)** :
   - Type d'utilisateur : **External / Externe**.
   - Nom de l'app : `Bonzini`. Email d'assistance : ton email.
   - Page d'accueil : `https://bonzinilabs.com` (facultatif au début).
   - **Astuce** : ne mets **pas** de logo custom au début (ça déclenche une
     revue Google de plusieurs jours).
   - Enregistre.
5. **Audience** : laisse en **« Testing / Test »** pour l'instant, et dans
   « Test users / Utilisateurs de test », **ajoute ton propre email Google**.
   → Ça permet de tester tout de suite sans la revue Google.
   *(Plus tard, bouton « Publish / Publier en production » pour ouvrir à tous.)*
6. **Clients** (ou « Credentials → Create credentials → OAuth client ID ») :
   - Type d'application : **Web application / Application Web**.
   - Nom : `Bonzini Web`.
   - **Authorized JavaScript origins** : ajoute
     `https://bonzinilabs.com` et `https://www.bonzinilabs.com`.
   - **Authorized redirect URIs** : ajoute **exactement**
     `https://fmhsohrgbznqmcvqktjw.supabase.co/auth/v1/callback`
   - Créer.
7. Une fenêtre affiche **« Client ID »** et **« Client secret »**.
   - **Copie les deux.** (Tu pourras les retrouver plus tard en rouvrant le client.)
   - ⚠️ **Ne colle PAS le secret dans le chat.** Tu le colleras directement
     dans Supabase à l'étape suivante.

---

## ÉTAPE C — Supabase (activer le provider Google)

1. Va sur
   **https://supabase.com/dashboard/project/fmhsohrgbznqmcvqktjw/auth/providers**
2. Cherche **Google** dans la liste → clique pour déplier.
3. Active **« Enable Sign in with Google »**.
4. Colle le **Client ID** (champ « Client IDs »).
5. Colle le **Client Secret** (champ « Client Secret »).
6. **Save**.

---

## ÉTAPE D — Supabase (autoriser les URLs de retour)

1. Va sur
   **https://supabase.com/dashboard/project/fmhsohrgbznqmcvqktjw/auth/url-configuration**
2. **Site URL** : mets `https://bonzinilabs.com`.
3. **Redirect URLs** → « Add URL » et ajoute :
   - `https://bonzinilabs.com/auth/callback`
   - `https://www.bonzinilabs.com/auth/callback`
   - `http://localhost:8080/auth/callback` (si tu veux aussi tester en local)
4. **Save**.

---

## ÉTAPE E — Tester

1. Ouvre **https://bonzinilabs.com/auth** (ou la page de connexion).
2. Clique **« Continuer avec Google »**.
3. Choisis ton compte Google (celui ajouté en test user).
4. Tu dois revenir sur l'app, puis arriver sur l'**onboarding**
   (téléphone + pays à compléter).

### Si ça coince
- **« redirect_uri_mismatch »** → l'URL de l'étape B.6 n'est pas
  *exactement* `https://fmhsohrgbznqmcvqktjw.supabase.co/auth/v1/callback`.
- **« Unverified app / App non vérifiée »** → ton email n'est pas dans les
  « Test users » (étape B.5), ou l'app n'est pas publiée.
- **Renvoyé sur la page de login sans rien** → l'URL de l'app n'est pas dans
  les « Redirect URLs » Supabase (étape D).
- **Note les emails de confirmation** : ils restent **désactivés** pour
  l'instant (le système d'emails est dormant). On les branchera plus tard.
