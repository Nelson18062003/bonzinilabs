# Coordonnées de paiement — la procédure

Nos coordonnées de paiement (4 banques, Orange Money, MTN MoMo) sont au même
endroit dans l'app client et dans l'app de l'équipe. On peut les copier, ou les
envoyer en **PDF** ou en **images**, en **portrait** ou en **paysage**.

## 1. Où les trouver

| App | Chemin |
|---|---|
| Client (téléphone) | **Profil › Coordonnées de paiement** |
| Client, pendant un dépôt par banque | Fiche du dépôt : **RIB <banque> · PDF**, **Toutes nos banques · PDF**, et le lien **Toutes nos coordonnées de paiement** |
| Équipe (téléphone) | **Plus › Outils › Coordonnées de paiement**, ou **Plus › Paramètres › Coordonnées de paiement** |
| Équipe (ordinateur) | Barre de gauche, **Opérations › Coordonnées de paiement**, ou **Tous les outils** |

La page a deux onglets : **Banques** et **Mobile Money**.

## 2. Envoyer nos coordonnées à un client

1. Ouvrir **Coordonnées de paiement**.
2. Choisir l'onglet **Banques** ou **Mobile Money**.
3. Choisir la **mise en page** :
   - **Portrait** : pour un téléphone et pour imprimer ;
   - **Paysage** : pour un écran d'ordinateur ou une tablette.
4. Choisir le **format** :
   - **PDF** : un seul fichier, toutes les pages. Sur **ordinateur**, il se
     télécharge. Sur **téléphone**, la feuille de partage s'ouvre (WhatsApp,
     e-mail, Fichiers…).
   - **Images** : une image par page. Un aperçu s'ouvre avec, en haut,
     **Envoyer les N images** (téléphone) ou **Télécharger les N images**
     (ordinateur). On peut aussi toucher une seule page pour l'enregistrer.
5. Pour **une seule banque** : sous la carte de la banque, **RIB · PDF** ou
   **RIB · Image** (une page, avec le rappel de la preuve de paiement).
6. Pour envoyer en **texte** : toucher une ligne (IBAN, SWIFT, RIB, numéro,
   code) pour la copier, ou **Copier les coordonnées** sur la carte d'une
   banque ou d'un opérateur, puis coller dans la conversation.

Côté client, la page rappelle en encadré la référence à écrire dans le motif
du virement : **son identifiant client** (BZ-…), comme l'écran « Mon
identifiant client ». La fiche PDF, elle, garde « votre nom + n° de commande »
en attendant votre décision (voir § 5).

### Quel document pour quelle demande

| Le client demande… | Envoyer |
|---|---|
| « Votre RIB UBA » (ou une autre banque) | **RIB · Image** de cette banque (WhatsApp) ou **RIB · PDF** (e-mail) |
| « Vos coordonnées bancaires » | **Toutes nos banques**, en Images ou en PDF |
| « Comment payer par Orange / MTN ? » | Onglet **Mobile Money**, **Fiche Mobile Money** |
| Un virement depuis l'étranger | Le RIB de la banque choisie : il porte le **SWIFT** |

Tous les documents sont au nom de **NORTON GAUSS BONZINI SARL**, en français
puis en anglais, sans site ni téléphone.

## 3. Changer une coordonnée (nouvelle banque, nouveau numéro)

Toutes les coordonnées viennent d'**un seul fichier** :
`src/data/depositMethodsData.ts`. L'écran de dépôt, la page Coordonnées de
paiement, les PDF, les images et le devis cargo le lisent. On ne les recopie
nulle part ailleurs.

- **Banque** (`banks`) : `codeBanque`, `codeAgence`, `accountNumber`,
  `cleRib`, `iban`, `swift`. Toujours partir du **RIB émis par la banque**.
  L'IBAN camerounais s'écrit `CM21` + banque + agence + compte + clé.
- **Mobile Money** : `orangeMoneyAccount`, `mtnMoneyAccount` (numéro,
  titulaire tel qu'il s'affiche avant de valider), `omMerchantInfo`,
  `mtnMerchantInfo` (code de retrait).
- **Wave** est fermé (`WAVE_ENABLED = false`) : le numéro enregistré était un
  numéro d'exemple. Pour le rouvrir, saisir le vrai numéro et le vrai
  titulaire dans `waveAccount`, puis passer `WAVE_ENABLED` à `true`.
- **Numéros de contact** (WhatsApp, appels — ce ne sont pas des comptes de
  paiement) : `src/lib/companyContacts.ts` pour le site, les pages légales, le
  flyer et la carte de devis ; et une copie dans
  `supabase/functions/generate-flyer/index.ts` (fonction serveur, à changer en
  même temps puis à redéployer).

Ensuite :

1. `npm run test` : les tests recalculent chaque **IBAN** (contrôle ISO) et
   chaque **clé RIB**. Si un chiffre est faux, le test échoue. La fiche
   n'imprime jamais un compte dont l'IBAN ou la clé ne se vérifie pas.
2. `npm run type-check` puis `npm run build`.
3. Déployer. L'app, les PDF et les images sont à jour en même temps.

> **Important.** Tant que la branche n'est pas fusionnée dans `main` et
> déployée, la production continue d'afficher les anciennes coordonnées
> (ancien MTN, IBAN UBA et CCA faux, Wave). Après le déploiement, remplacer
> aussi les anciennes fiches déjà envoyées aux clients (la fiche bancaire du
> 24/09 et la fiche Mobile Money du 18/09).

## 4. Contrôles faits le 24/09/2026

| Compte | Constat | Action |
|---|---|---|
| CCA-Bank | L'agence était **10444** au lieu de **10044** : IBAN et RIB faux | Corrigé d'après le RIB émis par CCA-Bank (C-Online) |
| UBA | L'IBAN avait un chiffre de trop ; le SWIFT n'avait que 7 caractères | Corrigé (`CM21 10033 05214 14011000141 88`, `UNAFCMCX`) — **à confirmer avec UBA** |
| Ecobank, Afriland | IBAN et clé RIB vérifiés | — |
| MTN MoMo | Ancienne ligne 652 23 68 56 (NGANGON SOH NELSON) | Remplacée par 652 40 36 02 (NORTON GAUSS BONZINI SARL 1) |
| Wave | Numéro d'exemple (+237 691 000 003, « BONZINI TRADING ») proposé aux clients | Retiré des choix de dépôt ; plus jamais affiché, même pour un ancien dépôt |
| Étapes Mobile Money dans l'app | « Composez #150*1*1# », « *126# » puis « Transfert d'argent » : menus inventés, contraires à la fiche | Remplacées par les étapes de la fiche (puce commerciale, numéro, nom affiché à vérifier) |
| Plafonds affichés | « Limite 500 000 XAF » (dépôt Mobile Money) et « Maximum 50 000 000 XAF » (paiement) contredisaient la règle « aucun plafond » | Retirés ; le paiement rappelle que le maximum est le solde disponible |

## 5. Points à confirmer par la direction

- **Numéro WhatsApp de la société** : le site, les pages légales et les flyers
  affichent +237 652 236 856, l'ancienne ligne MTN personnelle. Faut-il le
  garder, ou passer à un autre numéro ?
- **Numéro Chine** : +86 131 3849 5598 sur les flyers, mais +86 186 6743 9286
  dans les réglages d'expédition (étiquettes colis).
- **Agences Bonzini** (Bonapriso, Bonamoussadi, Yaoundé) proposées pour les
  dépôts en espèces : adresses et horaires jamais confirmés.
- **Mention du virement** : la fiche dit « votre nom + n° de commande » ;
  l'app demande d'écrire l'identifiant client (BZ-…) dans le libellé. Choisir
  une seule règle.
- **UBA** : faire confirmer l'IBAN et le SWIFT corrigés par la banque.
