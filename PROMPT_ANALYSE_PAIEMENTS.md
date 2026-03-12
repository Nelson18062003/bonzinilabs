# PROMPT CLAUDE CODE — Analyse complète du module Paiements

> **L'objectif est de produire un document PDF exhaustif qui documente TOUT le module des paiements. Ce document sera utilisé ensuite pour redesigner l'interface. Il doit être complet, précis et structuré.**

---

## Ce que tu dois faire

1. Analyser en profondeur tout le code du module paiements (admin + client)
2. Analyser les tables Supabase liées aux paiements
3. Générer un document PDF structuré qui explique TOUT

---

## PHASE 1 — Exploration du code

Exécute TOUTES ces commandes et note les résultats :

### 1.1 Structure des fichiers

```bash
# Tous les fichiers liés aux paiements
find src/ a/ m/ -type f \( -name "*payment*" -o -name "*paiement*" -o -name "*Payment*" -o -name "*Paiement*" \) | grep -v node_modules | sort

# Tous les fichiers liés aux bénéficiaires
find src/ a/ m/ -type f \( -name "*beneficiar*" -o -name "*benef*" -o -name "*Beneficiar*" -o -name "*recipient*" \) | grep -v node_modules | sort

# Tous les fichiers liés aux preuves
find src/ a/ m/ -type f \( -name "*proof*" -o -name "*preuve*" -o -name "*Proof*" \) | grep -v node_modules | sort

# Tous les fichiers liés aux taux
find src/ a/ m/ -type f \( -name "*rate*" -o -name "*taux*" -o -name "*Rate*" \) | grep -v node_modules | sort

# Tous les fichiers liés aux opérations/transactions
find src/ a/ m/ -type f \( -name "*operation*" -o -name "*transaction*" -o -name "*movement*" \) | grep -v node_modules | sort
```

### 1.2 Schéma de base de données

```bash
# Table payments — structure complète
cat supabase/migrations/*.sql | grep -A 50 "CREATE TABLE.*payment"

# Table beneficiaries
cat supabase/migrations/*.sql | grep -A 40 "CREATE TABLE.*beneficiar"

# Table payment_proofs
cat supabase/migrations/*.sql | grep -A 30 "CREATE TABLE.*proof"

# Table rates
cat supabase/migrations/*.sql | grep -A 30 "CREATE TABLE.*rate"

# Table operations / transactions / movements
cat supabase/migrations/*.sql | grep -A 40 "CREATE TABLE.*operation\|CREATE TABLE.*transaction\|CREATE TABLE.*movement"

# Table clients (colonnes liées au solde)
cat supabase/migrations/*.sql | grep -A 30 "CREATE TABLE.*client"

# Toutes les relations FK
cat supabase/migrations/*.sql | grep -i "REFERENCES\|FOREIGN KEY"

# Tous les INDEX
cat supabase/migrations/*.sql | grep -i "CREATE INDEX\|CREATE UNIQUE"

# Tous les TRIGGERS liés aux paiements
cat supabase/migrations/*.sql | grep -B 2 -A 20 "TRIGGER.*payment\|FUNCTION.*payment\|TRIGGER.*balance\|FUNCTION.*balance"

# Toutes les RPC (fonctions stockées)
cat supabase/migrations/*.sql | grep -B 2 -A 30 "CREATE.*FUNCTION"

# RLS (Row Level Security) sur les paiements
cat supabase/migrations/*.sql | grep -A 10 "POLICY.*payment"

# ENUM types (statuts, modes, etc.)
cat supabase/migrations/*.sql | grep -A 10 "CREATE TYPE\|ENUM"

# Contraintes CHECK
cat supabase/migrations/*.sql | grep -i "CHECK\|CONSTRAINT" | grep -i "payment\|balance\|amount\|status"
```

### 1.3 Les statuts

```bash
# Tous les statuts mentionnés dans le code
grep -rn "status.*=\|status.*===\|status.*!==\|setStatus\|updateStatus" src/ a/ m/ --include="*.tsx" --include="*.ts" | grep -i payment | sort -u

# Les statuts dans les migrations
cat supabase/migrations/*.sql | grep -i "status" | grep -i "payment"

# Les ENUM de statuts
cat supabase/migrations/*.sql | grep -A 10 "payment.*status\|status.*payment"

# Les transitions de statut (quand on passe d'un statut à un autre)
grep -rn "status.*pending\|status.*created\|status.*processing\|status.*completed\|status.*executed\|status.*validated\|status.*refused\|status.*refunded\|status.*cancelled" src/ a/ m/ --include="*.tsx" --include="*.ts"
```

### 1.4 Les modes de paiement

```bash
# Tous les modes mentionnés
grep -rn "alipay\|wechat\|virement\|cash\|payment_method\|paymentMethod\|payment_type" src/ a/ m/ --include="*.tsx" --include="*.ts" | sort -u

# Comment le mode change l'affichage
grep -rn "method.*===\|method.*!==\|type.*===.*alipay\|type.*===.*wechat\|type.*===.*cash\|type.*===.*virement" src/ a/ m/ --include="*.tsx" --include="*.ts"
```

### 1.5 La logique de création

```bash
# Fonction de création de paiement
grep -rn "createPayment\|create_payment\|insertPayment\|newPayment\|submitPayment" src/ a/ m/ --include="*.tsx" --include="*.ts" -A 30

# Appel Supabase insert
grep -rn "\.insert\|\.rpc" src/ a/ m/ --include="*.tsx" --include="*.ts" | grep -i payment
```

### 1.6 La logique de mise à jour de statut

```bash
# Fonctions de changement de statut
grep -rn "updatePayment\|update_payment\|changeStatus\|setStatus\|markAs\|validate\|refuse\|refund\|execute\|process" src/ a/ m/ --include="*.tsx" --include="*.ts" | grep -i payment

# Appels Supabase update sur les paiements
grep -rn "\.update" src/ a/ m/ --include="*.tsx" --include="*.ts" | grep -i payment
```

### 1.7 La logique du solde

```bash
# Débit / crédit du solde client
grep -rn "balance\|solde\|wallet\|debit\|credit" src/ a/ m/ --include="*.tsx" --include="*.ts" -A 5

# Quand le solde est débité (à la création ? à la validation ?)
grep -rn "balance.*-\|balance.*+\|solde.*-\|solde.*+\|decrement\|increment" src/ a/ m/ --include="*.tsx" --include="*.ts"
```

### 1.8 Les bénéficiaires

```bash
# Comment les bénéficiaires sont créés
grep -rn "beneficiar\|benef\|recipient" src/ a/ m/ --include="*.tsx" --include="*.ts" | grep -i "create\|insert\|new\|add\|save"

# Comment ils sont liés au paiement
grep -rn "beneficiary_id\|benef.*id\|payment.*beneficiar" src/ a/ m/ --include="*.tsx" --include="*.ts"

# Les champs du bénéficiaire
grep -rn "beneficiary_name\|alipay_id\|wechat_id\|bank_name\|bank_account\|qr_code" src/ a/ m/ --include="*.tsx" --include="*.ts"
```

### 1.9 Les preuves de paiement

```bash
# Upload des preuves
grep -rn "proof\|preuve\|evidence" src/ a/ m/ --include="*.tsx" --include="*.ts" | grep -i "upload\|storage\|add\|create"

# Supabase Storage buckets
grep -rn "storage.*from\|\.from\(" src/ a/ m/ --include="*.tsx" --include="*.ts"

# Types de preuves (admin vs client)
grep -rn "proof.*type\|proof.*source\|admin.*proof\|client.*proof\|bonzini.*proof" src/ a/ m/ --include="*.tsx" --include="*.ts"
```

### 1.10 Le taux

```bash
# Comment le taux est chargé
grep -rn "rate\|taux" src/ a/ m/ --include="*.tsx" --include="*.ts" | grep -i "fetch\|load\|get\|select\|from"

# Comment le taux personnalisé est géré
grep -rn "custom.*rate\|taux.*perso\|override.*rate\|manual.*rate" src/ a/ m/ --include="*.tsx" --include="*.ts"

# Comment la conversion est calculée
grep -rn "convert\|conversion\|Math.round\|amount.*rate\|rate.*amount" src/ a/ m/ --include="*.tsx" --include="*.ts" | grep -v node_modules
```

### 1.11 Les composants UI

```bash
# Lire CHAQUE composant lié aux paiements
# Pour chaque fichier trouvé en 1.1, fais :
# cat [fichier] | head -100
# pour comprendre sa structure, ses props, ses dépendances

# Les boutons d'action dans la fiche paiement
grep -rn "button\|Button\|onClick" src/ a/ m/ --include="*.tsx" --include="*.ts" | grep -i "payment\|paiement" | grep -i "valid\|refus\|process\|cancel\|delete\|suppr"
```

---

## PHASE 2 — Générer le document PDF

Après avoir collecté TOUTES ces informations, génère un document PDF professionnel structuré comme suit :

### Structure du document

```
TITRE : Analyse du module Paiements — Bonzini Platform
DATE : [date du jour]
VERSION : 1.0

TABLE DES MATIÈRES

1. VUE D'ENSEMBLE
   1.1 Architecture technique
   1.2 Tables Supabase impliquées
   1.3 Schéma des relations (texte)
   1.4 Technologies utilisées

2. CYCLE DE VIE D'UN PAIEMENT
   2.1 Diagramme des statuts (texte : Créé → En attente → En cours → Validé / Refusé)
   2.2 Description de chaque statut
   2.3 Transitions possibles (qui peut déclencher quoi)
   2.4 Ce qui se passe à chaque transition (débit solde, notifications, etc.)

3. MODES DE PAIEMENT
   3.1 Alipay
       - Champs spécifiques (QR code, identifiant, téléphone, email)
       - Flow de création
       - Spécificités d'affichage
   3.2 WeChat Pay
       - Idem
   3.3 Virement bancaire
       - Champs spécifiques (banque, compte, agence)
       - Flow de création
   3.4 Cash
       - Spécificités (bénéficiaire = client ou tiers)
       - Signature
       - Flow de création

4. BÉNÉFICIAIRES
   4.1 Structure des données
   4.2 Comment sont-ils créés
   4.3 Peut-on créer un paiement sans bénéficiaire ?
   4.4 Comment modifier un bénéficiaire après création
   4.5 Différences selon le mode

5. TAUX DE CHANGE
   5.1 D'où vient le taux
   5.2 Format de stockage
   5.3 Taux personnalisé — comment ça fonctionne
   5.4 Formule de conversion XAF ↔ CNY
   5.5 Bugs connus / incohérences trouvées

6. SOLDE CLIENT
   6.1 Quand le solde est débité (création ou validation ?)
   6.2 Quand le solde est recrédité (refus, remboursement)
   6.3 Vérifications existantes (frontend et backend)
   6.4 Contraintes en base

7. PREUVES DE PAIEMENT
   7.1 Types de preuves (admin vs client)
   7.2 Où sont stockées les preuves (bucket Supabase)
   7.3 Upload — comment ça fonctionne
   7.4 Quand peut-on ajouter/supprimer une preuve

8. FICHE PAIEMENT — AFFICHAGE ACTUEL
   8.1 App Admin — ce qui s'affiche selon le statut
   8.2 App Admin — ce qui s'affiche selon le mode
   8.3 App Client — ce qui s'affiche
   8.4 Boutons d'action — quand apparaissent-ils
       - "Passer en cours" → quand ?
       - "Valider" → quand ?
       - "Refuser" → quand ?
       - "Supprimer" → quand ?
       - "Modifier bénéficiaire" → quand ?
       - "Ajouter preuve" → quand ?
       - "Télécharger le reçu" → quand ?

9. PROBLÈMES ET INCOHÉRENCES IDENTIFIÉS
   9.1 Bugs de calcul de taux
   9.2 Problèmes de solde
   9.3 Données manquantes ou mal formatées
   9.4 Statuts incohérents
   9.5 Code mort ou statuts non utilisés
   9.6 Doublons ou répétitions dans le code

10. ANNEXES
    10.1 Liste complète des fichiers du module
    10.2 Schéma SQL des tables
    10.3 Liste des fonctions RPC
    10.4 Liste des triggers
    10.5 Liste des buckets Storage utilisés
```

### Format du PDF

- Police : DM Sans si possible, sinon Helvetica
- Titre en gros, sections numérotées
- Code SQL et TypeScript dans des blocs formatés
- Pas de captures d'écran (c'est du texte uniquement)
- Pour les diagrammes de statut, utiliser du texte formaté :
```
[Créé] ──→ [En attente d'infos] ──→ [En cours] ──→ [Validé]
                                          │
                                          └──→ [Refusé]
```

### Commande pour générer le PDF

Utilise la librairie disponible dans le projet (jsPDF, @react-pdf, ou html2pdf). Si aucune n'est disponible :

```bash
# Option 1 : Générer un fichier Markdown puis le convertir
# Crée le fichier analyse_paiements.md avec tout le contenu
# Puis utilise un outil pour convertir en PDF

# Option 2 : Installer un outil de conversion
pip install markdown-pdf --break-system-packages
# ou
npm install md-to-pdf
```

Le fichier PDF doit être sauvegardé à la racine du projet : `ANALYSE_MODULE_PAIEMENTS.pdf`

---

## CE QUE LE DOCUMENT DOIT PERMETTRE DE COMPRENDRE

Quelqu'un qui lit ce document sans connaître le code doit pouvoir répondre à ces questions :

1. Quels sont les statuts possibles d'un paiement ?
2. Quand est-ce que le bouton "Valider" apparaît ?
3. Quand est-ce que le bouton "Supprimer" apparaît ?
4. Quand est-ce qu'on peut modifier le bénéficiaire ?
5. Quand est-ce qu'on peut ajouter/supprimer une preuve ?
6. Comment le taux est calculé et stocké ?
7. Quand est-ce que le solde du client est débité ?
8. Quelles sont les différences entre Alipay, WeChat, Virement et Cash ?
9. Quels bugs existent actuellement ?
10. Quels statuts sont utilisés et lesquels ne le sont plus ?

---

## IMPORTANT

- Ne SUPPOSE rien. Si tu ne trouves pas l'info dans le code, écris "NON TROUVÉ" dans le document.
- Si tu trouves des incohérences entre le code frontend et le schéma backend, documente-les.
- Si tu trouves du code mort (fonctions non appelées, statuts non utilisés), documente-le.
- Si tu trouves des bugs évidents, documente-les dans la section 9.
- Sois exhaustif. Ce document est la base de tout le travail de redesign qui va suivre.
