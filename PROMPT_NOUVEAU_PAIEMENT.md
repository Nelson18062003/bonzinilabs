# PROMPT CLAUDE CODE — Refonte du formulaire "Nouveau Paiement" (App Admin)

> **Lis ce prompt EN ENTIER avant de toucher au code. La maquette interactive est dans `maquette_admin_nouveau_paiement_v3.jsx`. Ouvre-la et teste le flow complet (5 étapes) avant de commencer.**

---

## Objectif

Supprimer l'ancien formulaire de création de paiement dans l'application mobile admin et le remplacer par un nouveau formulaire multi-étapes basé sur la maquette fournie.

L'ancien formulaire a ces problèmes :
- "Par RMB" au lieu de "Par ¥"
- Montant confus (deux blocs séparés XAF/CNY mal alignés)
- Boutons cachés sous la bottom nav
- Étape bénéficiaire avec "Passer cette étape" mal implémenté
- Écran succès qui affiche le yuan en gros au lieu du montant XAF lisible
- Pas de conversion bidirectionnelle XAF↔¥
- 4 petits carrés QR/ID/Email/Tél incompréhensibles

---

## ÉTAPE 0 — ANALYSE COMPLÈTE DE L'EXISTANT

**C'est l'étape la plus importante. Passe le temps qu'il faut ici.**

### 0.1 Trouver l'ancien formulaire

```bash
# Trouver le composant de création de paiement
grep -rn "nouveau.*paiement\|new.*payment\|create.*payment\|CreatePayment\|NewPayment\|PaymentForm\|PaymentCreate\|PaymentWizard" src/ a/ --include="*.tsx" --include="*.ts" --include="*.jsx" -l

# Trouver les étapes du formulaire
grep -rn "step\|Step\|étape\|wizard\|Wizard" src/ a/ --include="*.tsx" --include="*.ts" | grep -i payment

# Trouver la route
grep -rn "nouveau-paiement\|new-payment\|create-payment\|add-payment" src/ a/ --include="*.tsx" --include="*.ts" -l
```

### 0.2 Comprendre le schéma de données

```bash
# Table des paiements
cat supabase/migrations/*.sql | grep -A 40 "CREATE TABLE.*payment"

# Table des bénéficiaires
cat supabase/migrations/*.sql | grep -A 30 "CREATE TABLE.*beneficiar"

# Table des clients
cat supabase/migrations/*.sql | grep -A 20 "CREATE TABLE.*client"

# Table des taux
cat supabase/migrations/*.sql | grep -A 20 "CREATE TABLE.*rate"

# Table des opérations/transactions
cat supabase/migrations/*.sql | grep -A 20 "CREATE TABLE.*operation\|CREATE TABLE.*transaction\|CREATE TABLE.*movement"

# Relations
cat supabase/migrations/*.sql | grep -i "REFERENCES\|FOREIGN KEY" | grep -i "payment\|client\|beneficiar"

# Types TypeScript
grep -rn "type.*Payment\|interface.*Payment\|type.*Beneficiar\|interface.*Beneficiar" src/ a/ --include="*.ts" --include="*.tsx"
```

### 0.3 Comprendre la logique de soumission actuelle

**C'est CRITIQUE. Le formulaire ne fait pas juste un INSERT. Il y a probablement une logique métier complexe.**

```bash
# Trouver la fonction de soumission
grep -rn "onSubmit\|handleSubmit\|handleCreate\|createPayment\|savePayment\|submitPayment" src/ a/ --include="*.tsx" --include="*.ts" | grep -i payment

# Trouver les appels Supabase liés aux paiements
grep -rn "from.*payment.*insert\|\.insert.*payment\|\.rpc.*payment\|from.*payment.*update" src/ a/ --include="*.tsx" --include="*.ts"

# Trouver si un RPC ou une Edge Function est utilisée
grep -rn "\.rpc\|edge.*function\|functions.*invoke" src/ a/ --include="*.tsx" --include="*.ts" | grep -i payment

# Trouver la logique de débit du solde client
grep -rn "solde\|balance\|debit\|credit\|wallet" src/ a/ --include="*.tsx" --include="*.ts"

# Trouver la logique de calcul du taux
grep -rn "rate\|taux\|conversion\|convert" src/ a/ --include="*.tsx" --include="*.ts" | grep -v node_modules

# Trouver la gestion des bénéficiaires
grep -rn "beneficiar\|benef\|recipient" src/ a/ --include="*.tsx" --include="*.ts"

# Trouver l'upload de QR code / images
grep -rn "upload\|storage\|bucket\|qr.*code\|qrCode" src/ a/ --include="*.tsx" --include="*.ts"
```

### 0.4 Comprendre le flow complet actuel

Avant de coder, tu dois être capable de répondre à ces questions :

1. **Quand un paiement est créé, que se passe-t-il exactement ?**
   - Est-ce qu'on débite le solde du client immédiatement ?
   - Est-ce qu'on crée une entrée dans une table `operations` / `transactions` ?
   - Est-ce qu'on crée un bénéficiaire dans une table séparée ?
   - Est-ce qu'on upload le QR code dans Supabase Storage ?

2. **Quels statuts existent pour un paiement ?**
   - created / pending / processing / executed / refused / refunded ?
   - Quel statut est assigné à la création ?

3. **Comment le taux est-il géré ?**
   - Vient-il d'une table `rates` ?
   - Est-il calculé à la volée ?
   - Le taux personnalisé est-il stocké dans le paiement ?

4. **Comment les bénéficiaires sont-ils gérés ?**
   - Table séparée avec FK vers le paiement ?
   - Champs JSON dans la table paiement ?
   - Peut-on créer un paiement SANS bénéficiaire ?

**Note toutes les réponses. Elles guident l'implémentation.**

---

## ÉTAPE 1 — SUPPRIMER L'ANCIEN FORMULAIRE

**Garde :**
- La route / navigation vers "Nouveau paiement"
- La logique de soumission (INSERT + débit solde + création bénéficiaire)
- La logique d'upload d'image (QR code, preuves)
- Les hooks existants (useClients, useRates, useBeneficiaries, etc.)
- Les fonctions utilitaires (calcul taux, formatage montant)

**Supprime :**
- L'ancien composant UI du formulaire (les étapes, les inputs, les boutons)
- Les anciens styles dédiés
- Toute mention de "RMB" dans le formulaire

---

## ÉTAPE 2 — LES 5 ÉTAPES DU NOUVEAU FORMULAIRE

### Étape 1 — Quel client ?

**Source de données :** Table `clients` via Supabase

```typescript
const { data: clients } = await supabase
  .from("clients")  // ADAPTE au nom réel
  .select("id, name, phone, email, balance, country")  // ADAPTE aux colonnes réelles
  .order("name");
```

**Affichage :** Barre de recherche (filtre par nom ou téléphone) + liste de cartes cliquables. Chaque carte montre : initiales, nom, téléphone, solde.

**Validation :** Un client doit être sélectionné pour continuer.

### Étape 2 — Comment payer ?

**4 modes :** Alipay, WeChat Pay, Virement, Cash

Les modes de paiement sont soit :
- En dur dans le code (4 modes fixes)
- Dans une table `payment_methods` en base

```bash
# Vérifier si les modes sont en base
cat supabase/migrations/*.sql | grep -i "payment_method\|payment_type\|mode_paiement"
grep -rn "payment_method\|paymentMethod\|payment_type" src/ a/ --include="*.tsx" --include="*.ts" | head -10
```

**Affichage :** 4 cartes verticales. La carte sélectionnée a une bordure de la couleur du mode + un ✓.

**Couleurs des modes :**
- Alipay : #1677ff
- WeChat : #07c160
- Virement : #A947FE
- Cash : #FE560D

**Validation :** Un mode doit être sélectionné.

### Étape 3 — Combien ?

**Source de données :** Table `rates` pour le taux du jour

```typescript
// Charger le taux du jour pour le mode sélectionné
const { data: rateData } = await supabase
  .from("rates")  // ADAPTE
  .select("base_rate")  // ADAPTE
  .eq("payment_method", selectedMode)  // ADAPTE
  .eq("is_active", true)  // ADAPTE
  .single();

const baseRate = rateData?.base_rate || 11530; // fallback
```

**Fonctionnalités :**

1. **Toggle XAF / ¥ :** Deux boutons "XAF" et "¥". Quand "XAF" est actif, l'input est en XAF et la conversion ¥ s'affiche. Quand "¥" est actif, l'inverse.

2. **Conversion bidirectionnelle :**
```typescript
// XAF → CNY
const cny = Math.round(xaf * rate / 1000000);

// CNY → XAF
const xaf = Math.round(cny * 1000000 / rate);
```

3. **Raccourcis montant :**
   - En mode XAF : 250K, 500K, 1M, 5M
   - En mode ¥ : ¥1K, ¥2.5K, ¥5K, ¥10K

4. **Taux personnalisé :** Toggle qui révèle un champ "1M XAF = [____] ¥". Quand activé, le taux saisi remplace le taux du jour pour ce paiement.

5. **Alertes :**
   - "Minimum : 10 000 XAF" si montant < 10 000 XAF
   - "Solde insuffisant (XXX XAF)" si montant > solde du client

**Validation :** Le montant doit être >= 10 000 XAF.

**Format du taux PARTOUT :** `1M XAF = ¥11 530` (jamais l'inverse, jamais "RMB")

### Étape 4 — Qui reçoit ?

**C'est l'étape la plus complexe car elle change selon le mode.**

**Option "Remplir plus tard" (tous les modes) :**
Une case à cocher en haut : "Remplir plus tard — Les infos du bénéficiaire seront ajoutées après". Quand cochée, tous les champs disparaissent et le bouton Suivant s'active.

Vérifie si l'ancien code permet de créer un paiement sans bénéficiaire :
```bash
grep -rn "beneficiar.*null\|beneficiar.*optional\|skip.*benef\|without.*benef" src/ a/ --include="*.tsx" --include="*.ts"
```

**Pour Alipay / WeChat :**

| Champ | Obligatoire | Placeholder |
|-------|-------------|-------------|
| Nom du bénéficiaire | Oui (*) | Ex: Zhang Wei |
| QR Code (upload image) | Non | Zone d'upload "Ajouter une photo du QR code" |
| Identifiant Alipay/WeChat | Non | ID Alipay du bénéficiaire |
| Téléphone | Non | +86 138 0000 0000 |
| Email | Non | zhangwei@mail.com |

Le QR code et l'identifiant sont séparés par un séparateur visuel "et / ou". Le téléphone et l'email sont masqués par défaut derrière un lien "Ajouter téléphone ou email" pour désencombrer.

**Upload du QR code :**
```typescript
// Utiliser le même mécanisme d'upload que l'ancien formulaire
// Chercher comment le QR code est uploadé actuellement :
// grep -rn "upload\|storage.*from\|bucket" src/ a/ --include="*.tsx" --include="*.ts" | grep -i "qr\|beneficiar\|payment"

// Probablement quelque chose comme :
const { data, error } = await supabase.storage
  .from("qr-codes")  // ADAPTE au bucket réel
  .upload(`qr_${paymentId}_${Date.now()}.jpg`, file);
```

**Pour Virement bancaire :**

| Champ | Obligatoire | Placeholder |
|-------|-------------|-------------|
| Nom du bénéficiaire | Oui (*) | Ex: Wang Corporation Ltd |
| Banque | Oui (*) | Ex: Bank of China |
| Numéro de compte | Oui (*) | Ex: 6214 8888 1234 5678 |

**Pour Cash :**

D'abord un choix : "Le client lui-même" ou "Quelqu'un d'autre".

Si "Le client lui-même" : on affiche la carte du client (nom + téléphone). Le nom du bénéficiaire = nom du client.

Si "Quelqu'un d'autre" :

| Champ | Obligatoire | Placeholder |
|-------|-------------|-------------|
| Nom du bénéficiaire | Oui (*) | Ex: Chen Fang |
| Téléphone | Non | Ex: +86 138 0000 0000 |

**Validation :** Si "Remplir plus tard" est coché → pas de validation. Sinon → le nom du bénéficiaire est obligatoire (+ banque et compte pour virement).

### Étape 5 — Tout est bon ?

**Affichage du récap :**

- **Montant principal en ¥** (gros, 38px) — c'est un paiement, le montant envoyé au fournisseur est l'info clé
- **Montant XAF** en dessous (15px, gris)
- Tableau récapitulatif : Client, Mode, Bénéficiaire (ou "À remplir plus tard"), ID, Banque, Compte, Téléphone, Email, Taux

**Format du taux dans le récap :** `1M XAF = ¥11 530` (+ "(perso.)" si taux personnalisé)

**Alerte solde insuffisant** si montant > solde client.

---

## ÉTAPE 3 — SOUMISSION

### 3.1 Logique de soumission

**RÉUTILISE la logique existante.** Ne la réécris pas. Trouve la fonction actuelle et appelle-la :

```bash
grep -rn "async.*createPayment\|async.*submitPayment\|async.*handleCreate.*payment\|async.*savePayment" src/ a/ --include="*.tsx" --include="*.ts"
```

Si la logique est dans un hook, utilise ce hook :
```bash
grep -rn "useCreatePayment\|usePayment\|useNewPayment" src/ a/ --include="*.tsx" --include="*.ts"
```

### 3.2 Mapping des champs formulaire → base de données

```
Formulaire              → Colonne probable en base
──────────────────────────────────────────────────
client.id               → client_id
mode.id                 → payment_method / method / type
xaf                     → amount / amount_xaf
cny                     → amount_cny / amount_rmb
rate                    → rate_applied / rate / exchange_rate
useCustomRate           → is_custom_rate (ou le rate suffit)
benef.name              → beneficiary_name / dans table beneficiaries
benef.ident             → beneficiary_id / alipay_id / wechat_id
benef.phone             → beneficiary_phone
benef.email             → beneficiary_email
benef.bank              → bank_name
benef.account           → bank_account
benef.isClient          → is_client_beneficiary (ou pas de colonne)
skipBenef               → le bénéficiaire est simplement null
qrCodeFile              → upload vers Storage, URL stockée en base
```

**ADAPTE tous les noms.** Vérifie chaque colonne dans le schéma réel.

### 3.3 Séquence de soumission

```typescript
async function handleSubmit() {
  setLoading(true);
  try {
    // 1. Créer le bénéficiaire (si pas "remplir plus tard")
    let beneficiaryId = null;
    if (!skipBenef && benef.name) {
      // Vérifier si l'ancien code crée le bénéficiaire séparément
      // ou s'il est inline dans le paiement
      // ADAPTE selon le schéma réel
    }

    // 2. Upload QR code (si Alipay/WeChat et fichier fourni)
    let qrCodeUrl = null;
    if (qrCodeFile) {
      // RÉUTILISER la logique d'upload existante
    }

    // 3. Créer le paiement
    // RÉUTILISER la fonction de création existante
    // Elle gère probablement : INSERT paiement + débit solde + création opération

    // 4. Naviguer vers la fiche du paiement créé
    // OU afficher l'écran succès

  } catch (err) {
    // Gestion d'erreurs
  } finally {
    setLoading(false);
  }
}
```

---

## ÉTAPE 4 — DESIGN

### Police

**DM Sans uniquement.**

### Couleurs

```
Violet principal    #A947FE   (boutons, focus, progress, liens)
Or                  #F3A745   (checkbox "remplir plus tard", warnings doux)
Orange              #FE560D   (astérisques obligatoires, alertes)
Vert                #34d399   (succès, solde suffisant)
Alipay              #1677ff
WeChat              #07c160

Fond page           #f8f6fa
Fond cartes         #ffffff
Texte principal     #1a1028
Texte secondaire    #7a7290
Texte tertiaire     #c4bdd0
Bordures            #ebe6f0
Fond inputs         #ffffff
```

### Hiérarchie typographique

| Élément | Taille | Poids | Couleur |
|---------|--------|-------|---------|
| Titre d'étape ("Quel client ?") | 21px | 800 | text |
| Sous-titre | 13-14px | 400 | sub |
| Nom client dans la liste | 15-16px | 700 | text |
| Solde client | 14-15px | 800 | text ou dim |
| Nom du mode de paiement | 16px | 700 | text |
| Input montant | 40px | 900 | text |
| "XAF" / "¥" à côté de l'input | 18px | 700 | sub |
| Conversion affichée | 18px | 800 | violet |
| Label de champ | 14px | 700 | text |
| Texte dans l'input | 16px | 600 | text |
| Mention "optionnel" | 12px | 500 | dim |
| Montant récap (¥) | 38px | 900 | text |
| Montant récap (XAF) | 15px | 400 | sub |
| Label récap | 13px | 400 | sub |
| Valeur récap | 13px | 700 | text |
| Bouton "Suivant" | 14-15px | 800 | blanc |
| Bouton "Retour" | 14-15px | 700 | sub |
| Compteur "3/5" | 12px | 700 | violet |

### Layout

```
height: 100dvh → flex → column → overflow: hidden
├── header: flexShrink: 0 (titre "Nouveau paiement" + progress bar + compteur X/5)
├── content: flex: 1 → overflowY: auto (le formulaire scroll ici)
└── footer: flexShrink: 0 (boutons Retour / Suivant — TOUJOURS VISIBLES)
```

**La bottom nav de l'app NE DOIT PAS s'afficher** sur ce formulaire. Le chevron "‹" en haut à gauche permet de revenir.

---

## ÉTAPE 5 — INTÉGRATION

### 5.1 Navigation

Le formulaire est accessible depuis :
- Le bouton "Paiement" sur le dashboard admin
- Le bouton "+ Nouveau paiement" dans la liste des paiements
- Éventuellement depuis la fiche d'un client

```bash
grep -rn "navigate\|router\|Link.*paiement\|Link.*payment" src/ a/ --include="*.tsx" --include="*.ts" | head -20
```

### 5.2 Après la soumission

Quand le paiement est créé :
1. Afficher l'écran succès avec : ¥ en gros, XAF en dessous, mode, client → bénéficiaire
2. Bouton "Nouveau" pour recommencer
3. Bouton "Voir la fiche" pour aller à la fiche du paiement créé

### 5.3 Gestion des erreurs

```
Erreur possible                          → Message
─────────────────────────────────────────────────
Solde insuffisant (si vérifié côté serveur) → "Solde insuffisant pour ce paiement"
Montant < minimum                         → "Le montant minimum est de 10 000 XAF"
Erreur réseau                             → "Erreur de connexion. Réessayez."
Erreur serveur                            → "Une erreur est survenue. Réessayez."
Client non trouvé                         → "Ce client n'existe plus"
```

### 5.4 Pas de bottom nav

```bash
grep -rn "hideNav\|showNav\|bottomNav\|TabBar" src/ a/ --include="*.tsx" --include="*.ts"
```

---

## RÈGLES ABSOLUES

1. **Jamais "RMB"** — écrire "¥" ou "yuan"
2. **Format du taux** : `1M XAF = ¥11 530` (jamais l'inverse)
3. **XAF en premier dans l'input montant** (toggle pour passer en ¥)
4. **¥ en premier dans le récap** (c'est un paiement, le montant envoyé prime)
5. **Boutons TOUJOURS visibles** en bas, jamais cachés par la bottom nav
6. **Bottom nav MASQUÉE** dans le formulaire
7. **Réutiliser la logique existante** de soumission, pas la réécrire
8. **DM Sans partout**, pas d'autre police
9. **Les champs du bénéficiaire changent selon le mode** (Alipay ≠ Virement ≠ Cash)
10. **L'option "Remplir plus tard" doit être fonctionnelle** — le paiement se crée avec bénéficiaire null

---

## CHECKLIST FINALE

### Flow
- [ ] 5 étapes : Client → Mode → Montant → Bénéficiaire → Résumé
- [ ] Progress bar avec 5 segments + compteur "X/5" en haut à droite
- [ ] Bouton "Retour" + "Suivant" TOUJOURS visibles en footer
- [ ] Bottom nav MASQUÉE

### Étape 1 — Client
- [ ] Recherche par nom ou téléphone
- [ ] Solde affiché pour chaque client
- [ ] Client sélectionné = bordure violette

### Étape 2 — Mode
- [ ] 4 modes avec icône + nom + couleur
- [ ] Mode sélectionné = bordure colorée + ✓

### Étape 3 — Montant
- [ ] Toggle XAF / ¥ fonctionnel
- [ ] Conversion bidirectionnelle en temps réel
- [ ] Raccourcis montant adaptés au toggle
- [ ] Taux personnalisé avec toggle
- [ ] Format taux : 1M XAF = ¥X
- [ ] Alerte solde insuffisant
- [ ] Alerte minimum 10 000 XAF

### Étape 4 — Bénéficiaire
- [ ] Option "Remplir plus tard" fonctionnelle
- [ ] Alipay/WeChat : nom + QR upload + identifiant + téléphone + email
- [ ] Virement : nom + banque + compte
- [ ] Cash : choix "client lui-même" / "quelqu'un d'autre"
- [ ] Cash "client lui-même" : affiche la carte du client, pas de saisie

### Étape 5 — Résumé
- [ ] ¥ en premier (gros), XAF en dessous
- [ ] Taux format : 1M XAF = ¥X
- [ ] "À remplir plus tard" si bénéficiaire skippé
- [ ] Alerte solde insuffisant

### Soumission
- [ ] Réutilise la logique existante (pas de réécriture)
- [ ] Le paiement se crée en base correctement
- [ ] Le solde du client est débité
- [ ] Le bénéficiaire est créé (si fourni)
- [ ] Le QR code est uploadé (si fourni)
- [ ] L'écran succès affiche ¥ en premier
- [ ] Navigation vers la fiche du paiement

### Design
- [ ] DM Sans partout
- [ ] Couleurs respectées (violet, or, orange, alipay, wechat)
- [ ] Aucune mention de "RMB"
- [ ] Bordures 1.5px
- [ ] Focus violet sur les inputs

---

## MAQUETTE DE RÉFÉRENCE

Le fichier `maquette_admin_nouveau_paiement_v3.jsx` est la référence. Teste le flow complet dans la maquette avant de coder. Le résultat final doit être visuellement identique.
