# BONZINI HQ — l'app mobile du personnel

App Android + iOS **interne** (pas publique) pour toute l'équipe Bonzini,
publiée par **BONZINILABS LTD**. Code : dossier `hq-app/` (Expo SDK 57).

---

## 1. Ce qui a été construit

### Une seule app, une seule connexion

| Qui se connecte | Rôle | Arrive dans | Ce qu'il y fait |
|---|---|---|---|
| Nelson, direction | `super_admin` | Administration (`/m`) | Tout |
| Opérations | `ops` | Administration (`/m`) | Dépôts, paiements, taux, cargo |
| Support / chargé de clientèle | `support`, `customer_success` | Administration (`/m`) | Clients, messagerie |
| Trésorier | `treasurer` | Administration (`/m`) | Trésorerie |
| Agent cash | `cash_agent` | Agent cash (`/a`) | Remettre les paiements en espèces |
| Tina (entrepôt de Guangzhou) | `receptionist` | Réception (`/r`) | Scanner, enregistrer colis et clients |
| Agent Douala | `warehouse_agent` | Entrepôt (`/w`) | Arrivées, encaissement, remise |

La personne tape son email, puis choisit **« Recevoir un code par email »**
ou **« Mot de passe »**. L'app lit son rôle et l'envoie dans **son** espace.
Personne n'a à choisir « quelle app » ouvrir.

### Comment l'app est faite

L'app est une **vraie app native** qui affiche les écrans du site
bonzinilabs.com. Conséquence importante :

> **Toute amélioration mise en ligne sur le site arrive dans l'app
> immédiatement**, sans republier sur les stores ni attendre Apple/Google.

L'app ajoute ce qu'un site ne sait pas faire :

- **Face ID / empreinte / code du téléphone** à l'ouverture et après
  5 minutes d'absence : un téléphone oublié ne suffit pas pour entrer.
- **Masquage dans le sélecteur d'apps** : les soldes ne s'affichent pas
  en miniature.
- **Fichiers natifs** : PDF, images, étiquettes, reçus, relevés, flyers →
  feuille de partage du téléphone (WhatsApp, WeChat, « Enregistrer dans
  Fichiers / Photos », imprimante…).
- **Copier l'image / le texte** : vrai presse-papiers du téléphone.
- **Caméra** pour les scanners (codes clients, cartons).
- **Écran « Pas de connexion »** avec « Réessayer », et rechargement
  automatique quand le réseau revient.
- **Liens** : WhatsApp, appels, e-mails s'ouvrent dans la bonne app ;
  les autres sites dans un navigateur intégré.

Dans l'app, la connexion Google et les clés d'accès sont masquées (Google
et WebAuthn refusent de fonctionner dans une app de ce type) ; le **mot de
passe** y est proposé. Sur le site, rien ne change.

### Identité de l'app

| | |
|---|---|
| Nom sous l'icône | **BONZINI HQ** |
| Identifiant iOS et Android | `com.bonzinilabs.hq` |
| Éditeur | BONZINILABS LTD |
| Icône | logo Bonzini sur fond encre `#1A1028`, « HQ » |

---

## 2. Avant de commencer (une seule fois, ~15 min)

1. **Compte Expo** (gratuit) : https://expo.dev/signup — créez une
   organisation **bonzinilabs** et utilisez-la pour tout.
2. Sur votre ordinateur (Mac ou PC), avec Node.js installé :
   ```bash
   git clone https://github.com/Nelson18062003/bonzinilabs.git
   cd bonzinilabs/hq-app
   npm install
   npx eas-cli@latest login
   npx eas-cli@latest init        # relie le projet à Expo (ajoute projectId dans app.json)
   ```
   Poussez ensuite le changement d'`app.json` (le `projectId`) sur GitHub.

Les compilations se font **dans le cloud d'Expo (EAS)** : pas besoin de
Xcode ni d'Android Studio.

---

## 3. Tester tout de suite sur Android (sans store, ~20 min)

```bash
npm run build:android:test      # = eas build -p android --profile preview
```

À la fin, Expo donne un **lien et un QR code** : ouvrez-le sur un téléphone
Android et installez l'APK. Idéal pour vérifier avec Tina et l'agent de
Douala avant la publication.

---

## 4. Google Play — publication interne

1. **Play Console** (compte BONZINILABS LTD) → *Créer une application* :
   nom **BONZINI HQ**, langue français, *Application*, *Gratuite*.
2. Compilez :
   ```bash
   npm run build:android           # fichier .aab signé par EAS
   ```
3. **La première fois, l'envoi est manuel** (exigence Google) : Play Console →
   *Tests* → **Tests internes** → *Créer une release* → importez le `.aab`
   téléchargé depuis expo.dev → *Enregistrer* → *Examiner* → *Déployer*.
4. *Testeurs* → créez une liste avec l'adresse Gmail de chaque membre de
   l'équipe (jusqu'à 100) → copiez le **lien d'invitation** et envoyez-le.
   Chacun accepte, puis installe BONZINI HQ depuis le Play Store.
5. Les fois suivantes, l'envoi peut être automatique :
   créez une clé de compte de service Google (Play Console → *Configuration*
   → *Accès aux API*), puis `npm run submit:android`.

**Plus tard (optionnel)** : une vraie *app privée* Google Play, visible
seulement de votre organisation, via *Managed Google Play* (demande un
Google Workspace ou un outil de gestion de flotte). Le test interne suffit
pour démarrer.

---

## 5. Apple — TestFlight, puis App Store privé

### 5a. TestFlight (pour démarrer, ~1 h)

```bash
npm run build:ios               # EAS demande votre identifiant Apple et crée
                                # certificats + profils tout seul
npm run submit:ios              # envoie la version sur App Store Connect
```

Dans **App Store Connect** → votre app BONZINI HQ → **TestFlight** :

- **Testeurs internes** (jusqu'à 100, sans examen Apple) : les personnes
  doivent être **utilisateurs** de votre App Store Connect (*Utilisateurs
  et accès* → inviter, rôle « Marketing » ou « Support client » suffit).
- **Testeurs externes** (jusqu'à 10 000, par email ou lien public) :
  un examen « bêta » rapide d'Apple est demandé une fois par version.

Chacun installe l'app **TestFlight** puis BONZINI HQ. Limite : une version
TestFlight expire après **90 jours** → il faut en envoyer une nouvelle.

### 5b. App Store privé — « Custom App » (la solution durable)

Comme vos comptes sont au nom d'une **société** (BONZINILABS LTD), l'app peut
être distribuée **uniquement à votre organisation**, invisible du public :

1. Inscrivez BONZINILABS LTD sur **Apple Business Manager**
   (https://business.apple.com, gratuit, utilise votre numéro D-U-N-S).
2. App Store Connect → BONZINI HQ → *Tarifs et disponibilité* →
   **Distribution privée** → ajoutez l'identifiant d'organisation Apple
   Business Manager de BONZINILABS LTD.
3. Soumettez la version à l'examen d'Apple (voir la liste ci-dessous).
4. Une fois validée, l'app apparaît dans Apple Business Manager → vous
   distribuez des **codes d'utilisation** à chaque membre de l'équipe.

### Ce qu'Apple demande pour l'examen

- **Un compte de démonstration** (email + mot de passe) qui fonctionne :
  créez un compte dédié, par exemple rôle *support*, et donnez-le dans
  *Informations pour l'examen*. Le mot de passe est accepté dans l'app.
- **Politique de confidentialité** : https://www.bonzinilabs.com/confidentialite
- **Confidentialité de l'app** (questionnaire) : données d'identification
  (email) et coordonnées, liées à l'utilisateur, non utilisées pour du suivi.
- **Chiffrement** : déjà déclaré « non » dans l'app (`ITSAppUsesNonExemptEncryption`).
- Précisez dans les notes : *« Application interne réservée au personnel de
  BONZINILABS LTD / NORTON GAUSS BONZINI SARL (réception de colis, paiements,
  trésorerie). Connexion avec le compte de démonstration fourni. »*

---

## 6. Faire évoluer l'app

| Ce qui change | Que faire |
|---|---|
| Un écran, un texte, une règle (tout ce qui est sur le site) | **Rien** : la mise en ligne du site suffit, l'app suit. |
| Icône, nom, permissions, bibliothèque native | Nouvelle compilation : `npm run build:android` / `build:ios`, puis envoi. Le numéro de build s'incrémente tout seul. |
| Nouvelle version affichée (1.0.0 → 1.1.0) | Modifier `version` dans `hq-app/app.json`. |

Avant chaque compilation : `npm run typecheck && npm run doctor`.

---

## 7. Étapes suivantes proposées

1. **Notifications push** (nouveau dépôt à valider, colis arrivé à Douala,
   paiement cash à remettre…) : nécessite une table des appareils et un
   envoi depuis Supabase.
2. **Scanner natif** plus rapide que celui du navigateur pour la réception
   à Guangzhou (gros volumes).
3. Passer en natif, un par un, les écrans les plus utilisés sur téléphone.
4. Plus tard : l'app **clients**, sur le même modèle.
