# PROMPT CLAUDE CODE — Refonte du formulaire "Nouveau Client" (App Admin)

> **Lis ce prompt EN ENTIER avant de toucher au code. La maquette de référence est `maquette_admin_nouveau_client.jsx`.**

---

## Objectif

Supprimer l'ancien formulaire de création de client dans l'application mobile admin et le remplacer par un nouveau formulaire multi-étapes basé sur la maquette fournie. Le formulaire actuel est cassé : boutons cachés sous la bottom nav, champ "Genre" inutile, labels confus, mauvais placeholders, pas responsive.

---

## ÉTAPE 0 — ANALYSER L'EXISTANT

### 0.1 Trouver l'ancien formulaire

```bash
# Trouver le composant de création client
grep -rn "nouveau.*client\|new.*client\|create.*client\|CreateClient\|NewClient\|AddClient\|ClientForm\|ClientCreate" src/ a/ --include="*.tsx" --include="*.ts" --include="*.jsx" -l

# Trouver la route
grep -rn "nouveau-client\|new-client\|create-client\|add-client" src/ a/ --include="*.tsx" --include="*.ts" -l

# Trouver les composants de formulaire partagés
grep -rn "StepForm\|MultiStep\|Stepper\|FormStep\|Wizard" src/ a/ --include="*.tsx" --include="*.ts" -l

# Trouver la soumission vers Supabase
grep -rn "from.*client.*insert\|\.insert.*client\|createClient\|addClient" src/ a/ --include="*.tsx" --include="*.ts"
```

### 0.2 Comprendre le schéma de la table clients

```bash
# Trouver la table clients dans Supabase
grep -rn "from.*clients\|table.*clients" supabase/ --include="*.sql"
cat supabase/migrations/*.sql | grep -A 30 "CREATE TABLE.*client"

# Trouver le type TypeScript du client
grep -rn "type.*Client\|interface.*Client" src/ a/ --include="*.ts" --include="*.tsx"
```

**IMPORTANT : Note tous les champs de la table.** Le formulaire ne doit envoyer QUE les champs qui existent en base. Si un champ de la maquette n'existe pas en base (ex: "entreprise"), il faut vérifier s'il correspond à un autre nom (ex: "company", "societe", "society", "business_name").

### 0.3 Comprendre le flow actuel

```bash
# Trouver comment le formulaire valide et soumet
grep -rn "onSubmit\|handleSubmit\|handleCreate\|saveClient" src/ a/ --include="*.tsx" --include="*.ts" | grep -i client

# Trouver si un mot de passe est généré
grep -rn "password\|mot.*passe\|generatePassword\|tempPassword" src/ a/ --include="*.tsx" --include="*.ts"

# Trouver si un message WhatsApp est envoyé
grep -rn "whatsapp\|sendSMS\|sendMessage\|notification" src/ a/ --include="*.tsx" --include="*.ts" | grep -i client
```

---

## ÉTAPE 1 — SUPPRIMER L'ANCIEN FORMULAIRE

Après avoir compris la structure, **supprime l'ancien composant de formulaire** mais **garde** :
- La route/navigation vers la page "Nouveau client"
- La fonction de soumission vers Supabase (insert)
- La logique de génération de mot de passe temporaire
- La logique d'envoi du mot de passe par WhatsApp (si elle existe)

**Supprime** :
- L'ancien composant UI du formulaire
- Les anciens styles dédiés
- Le champ "Genre" (Homme/Femme/Autre) — inutile pour un service de paiement
- Les anciennes étapes et la barre de progression

---

## ÉTAPE 2 — CRÉER LE NOUVEAU FORMULAIRE

### 2.1 Structure des fichiers

```
src/components/clients/ (ou a/components/ selon l'archi)
├── NewClientForm.tsx           ← Composant principal (les 3 étapes)
├── NewClientStepIdentity.tsx   ← Étape 1 : Prénom, Nom, Entreprise
├── NewClientStepContact.tsx    ← Étape 2 : WhatsApp, Email, Pays, Ville
├── NewClientStepReview.tsx     ← Étape 3 : Vérification avant soumission
└── NewClientProgress.tsx       ← Barre de progression 3 segments
```

### 2.2 Les 3 étapes du formulaire

**Étape 1 — Identité :**
| Champ | Label | Obligatoire | Placeholder | Type |
|-------|-------|-------------|-------------|------|
| prenom | Prénom | Oui (*) | Ex: Fabrice | text |
| nom | Nom | Oui (*) | Ex: Bienvenue | text |
| entreprise | Entreprise | Non (afficher "optionnel") | Ex: Jako Cargo SARL | text |

Titre : "Qui est votre client ?"
Sous-titre : "Prénom, nom et entreprise"

**Étape 2 — Contact :**
| Champ | Label | Obligatoire | Placeholder | Type |
|-------|-------|-------------|-------------|------|
| phone | WhatsApp | Oui (*) | 6XX XXX XXX | tel |
| email | Email | Non (afficher "optionnel") | fabrice@jakocargo.com | email |
| pays | Pays | Oui (*) | Select : Cameroun, Gabon, Tchad, RCA, Congo | select |
| ville | Ville | Non (afficher "optionnel") | Ex: Douala | text |

Titre : "Comment le joindre ?"
Sous-titre : "WhatsApp, email et localisation"

Note sous le champ WhatsApp : "Le client recevra son mot de passe par WhatsApp"

Le champ WhatsApp a un sélecteur de code pays à gauche (+237 par défaut). Les codes pays disponibles :
- +237 Cameroun
- +241 Gabon
- +235 Tchad
- +236 RCA
- +242 Congo

**Étape 3 — Vérification :**
Affiche un récapitulatif de toutes les infos saisies :
- Initiales du client dans un cercle violet
- Nom complet en gros
- Entreprise (si renseignée)
- Tableau : WhatsApp, Email, Pays, Ville

Note en bas : "Un mot de passe temporaire sera envoyé au client par WhatsApp. Il devra le changer lors de sa première connexion."

Titre : "Tout est correct ?"
Sous-titre : "Vérifiez avant de créer le compte"

### 2.3 Validation

```typescript
// Étape 1 : Continuer activé si prénom ET nom remplis
const canGoStep2 = form.prenom.trim().length > 0 && form.nom.trim().length > 0;

// Étape 2 : Continuer activé si WhatsApp rempli (minimum 9 chiffres)
const canGoStep3 = form.phone.trim().length >= 9;

// Étape 3 : Bouton "Créer le client" toujours activé (les validations sont passées)
```

**Le bouton "Continuer" est GRISÉ** (background: couleur border, texte dim, cursor: not-allowed) quand la validation ne passe pas.

**Le bouton "Continuer" est VIOLET** (background: #A947FE, texte blanc) quand la validation passe.

### 2.4 Soumission (Étape 3 → Supabase)

```typescript
async function handleCreateClient() {
  setLoading(true);

  try {
    // 1. Construire le nom complet
    const fullName = `${form.prenom.trim()} ${form.nom.trim()}`;

    // 2. Construire le numéro avec le code pays
    const fullPhone = `${countryCode}${form.phone.trim()}`;
    // Nettoyer : enlever les espaces, tirets, etc.
    const cleanPhone = fullPhone.replace(/[\s\-().]/g, "");

    // 3. Générer un mot de passe temporaire (si la logique existe déjà, la réutiliser)
    // Chercher la fonction existante : generatePassword, generateTempPassword, etc.

    // 4. Insérer dans Supabase
    // ADAPTER les noms de colonnes au schéma réel
    const { data, error } = await supabase
      .from("clients")  // ADAPTE au nom réel de la table
      .insert({
        name: fullName,           // ou first_name + last_name si séparés
        // first_name: form.prenom,  // si la table a des colonnes séparées
        // last_name: form.nom,
        phone: cleanPhone,
        email: form.email.trim() || null,
        company: form.entreprise.trim() || null,  // ou business_name, societe, etc.
        country: form.pays,
        city: form.ville.trim() || null,
        // password: hashedTempPassword,  // si mot de passe géré côté client
        // status: "active",
      })
      .select()
      .single();

    if (error) throw error;

    // 5. Envoyer le mot de passe par WhatsApp (si cette logique existe)
    // Réutiliser la fonction existante

    // 6. Naviguer vers la fiche du client créé
    // navigate(`/clients/${data.id}`);
    // OU
    // router.push(`/clients/${data.id}`);

  } catch (err) {
    // Afficher une erreur
    console.error("Erreur création client:", err);
    // Toast ou alert selon le système existant dans l'app
  } finally {
    setLoading(false);
  }
}
```

**IMPORTANT :** Adapte les noms de colonnes au schéma RÉEL. Vérifie avec :
```bash
cat supabase/migrations/*.sql | grep -A 30 "CREATE TABLE.*client"
```

---

## ÉTAPE 3 — DESIGN EXACT

### 3.1 Police

**DM Sans uniquement.** Pas de Syne, pas de Helvetica, pas de police système.

```css
font-family: 'DM Sans', sans-serif;
```

S'assurer que DM Sans est chargée dans l'app. Si ce n'est pas le cas, ajouter :
```html
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
```

### 3.2 Couleurs

```typescript
const COLORS = {
  violet: "#A947FE",       // Bouton principal, focus input, progress bar active
  gold: "#F3A745",         // Note informative, warning doux
  orange: "#FE560D",       // Astérisque champ obligatoire (*)
  green: "#34d399",        // Succès (après création)

  bg: "#f8f6fa",           // Fond de page
  card: "#ffffff",          // Fond cartes et footer
  text: "#1a1028",          // Texte principal
  sub: "#7a7290",           // Texte secondaire (sous-titres, labels secondaires)
  dim: "#c4bdd0",           // Texte tertiaire (optionnel, placeholder, progress inactive)
  border: "#ebe6f0",        // Bordures, séparateurs
  inputBg: "#f8f6fa",       // Fond des inputs
};
```

### 3.3 Hiérarchie typographique

| Élément | Taille | Poids | Couleur |
|---------|--------|-------|---------|
| Titre d'étape ("Qui est votre client ?") | 24px | 800 | text |
| Sous-titre d'étape | 14px | 400 | sub |
| Label de champ | 15px | 700 | text |
| Mention "optionnel" | 12px | 500 | dim |
| Texte dans l'input | 17px | 600 | text |
| Placeholder | 17px | 400 | dim |
| Note sous un champ | 12px | 500 | dim |
| Bouton "Continuer" | 16px | 800 | blanc |
| Bouton "Retour" | 15px | 700 | sub |
| Progress label actif | 10px | 800 | violet |
| Progress label inactif | 10px | 500 | dim |
| Nom dans le récap | 17px | 800 | text |
| Label dans le récap | 13px | 400 | sub |
| Valeur dans le récap | 13px | 700 | text |

### 3.4 Layout — règle absolue

```
height: 100dvh → flex → column → overflow: hidden
├── header: flexShrink: 0 (titre + progress bar)
├── content: flex: 1 → overflowY: auto (formulaire scrollable)
└── footer: flexShrink: 0 (boutons Retour/Continuer TOUJOURS visibles)
```

**Les boutons Retour et Continuer ne doivent JAMAIS être cachés.** Ils sont dans le footer, au-dessus de tout. La bottom nav de l'app NE DOIT PAS apparaître sur cette page — le formulaire prend tout l'écran.

### 3.5 Comportements

**Focus input :** Quand on clique dans un input, sa bordure passe de `border` (#ebe6f0) à `violet` (#A947FE). Au blur, retour à la bordure normale.

**Bouton Continuer :** Affiche le compteur d'étape : "Continuer (1/3)", "Continuer (2/3)". À l'étape 3 : "Créer le client".

**Bouton Retour :** N'apparaît PAS à l'étape 1. Apparaît aux étapes 2 et 3.

**À l'étape 1 :** Le bouton "Continuer" prend toute la largeur.
**Aux étapes 2 et 3 :** "Retour" prend 40% de la largeur, "Continuer/Créer" prend 60%.

**Sélecteur de pays WhatsApp :** Le code pays (+237) est un bouton à gauche du champ téléphone. Quand on change le pays (étape 2, champ Pays), le code pays du WhatsApp se met à jour automatiquement.

**Étape 3 — Initiales :** Les initiales sont calculées depuis la première lettre du prénom + première lettre du nom, en majuscule. Cercle fond `violet` 10% opacité, texte `violet`.

---

## ÉTAPE 4 — INTÉGRATION DANS L'APP

### 4.1 Navigation

Le formulaire est accessible depuis :
1. Le bouton "+" ou "Nouveau client" dans la liste des clients
2. Éventuellement depuis le dashboard admin

Vérifie comment la navigation fonctionne dans l'app :
```bash
grep -rn "navigate\|router\|useNavigate\|useRouter\|Link.*client" src/ a/ --include="*.tsx" --include="*.ts" | head -20
```

### 4.2 Après la création

Quand le client est créé avec succès :
1. Afficher un message de confirmation (toast ou redirect)
2. Naviguer vers la fiche du client nouvellement créé
3. OU revenir à la liste des clients avec le nouveau client en tête

Vérifie le comportement actuel et reproduis-le.

### 4.3 Gestion des erreurs

```typescript
// Erreurs possibles :
// 1. Numéro de téléphone déjà utilisé → "Ce numéro est déjà associé à un client"
// 2. Email déjà utilisé → "Cet email est déjà associé à un client"
// 3. Erreur réseau → "Erreur de connexion. Vérifiez votre réseau."
// 4. Erreur serveur → "Une erreur est survenue. Réessayez."

// Vérifier les contraintes UNIQUE dans la table :
// grep -rn "UNIQUE\|unique" supabase/migrations/*.sql | grep client
```

Les erreurs doivent s'afficher de manière visible — soit sous le champ concerné (bordure rouge + message), soit dans un toast en haut.

### 4.4 Pas de bottom nav

Quand le formulaire est ouvert, la bottom nav de l'app (Accueil, Dépôts, Paiements, Clients, Plus) **ne doit PAS s'afficher**. Le formulaire prend tout l'écran. Le bouton "‹" en haut à gauche permet de revenir en arrière.

Vérifie comment les autres formulaires de l'app gèrent ça :
```bash
grep -rn "hideNav\|showNav\|bottomNav\|TabBar\|NavigationBar" src/ a/ --include="*.tsx" --include="*.ts"
```

---

## ÉTAPE 5 — MAPPING CHAMPS FORMULAIRE ↔ BASE DE DONNÉES

Le formulaire a ces champs :
```
prenom    → ?
nom       → ?
entreprise → ?
phone     → ?
email     → ?
pays      → ?
ville     → ?
```

**Tu DOIS identifier la correspondance exacte avec la table Supabase.**

Possibilités courantes :
```
prenom     → first_name, prenom, firstname
nom        → last_name, nom, lastname
           → OU name (prénom + nom concaténés)
entreprise → company, business_name, societe, society, entreprise
phone      → phone, telephone, whatsapp, phone_number
email      → email
pays       → country, pays
ville      → city, ville
```

Si la table n'a qu'un seul champ `name` (pas de first_name/last_name séparés), concaténer :
```typescript
const name = `${form.prenom.trim()} ${form.nom.trim()}`;
```

Si la table a des champs séparés, envoyer séparément.

**Ne PAS ajouter de colonnes à la table.** Utilise ce qui existe. Si un champ du formulaire n'a pas de correspondance en base, demande (en commentaire dans le code) s'il faut ajouter une migration.

---

## CHECKLIST FINALE

### Formulaire
- [ ] 3 étapes : Identité → Contact → Vérification
- [ ] Champ "Genre" supprimé (n'existe plus)
- [ ] Barre de progression avec "1. Identité" / "2. Contact" / "3. Vérification"
- [ ] Étape active en violet, étapes passées en violet, futures en gris
- [ ] Titres : "Qui est votre client ?" / "Comment le joindre ?" / "Tout est correct ?"
- [ ] Placeholders contextuels : Fabrice, Bienvenue, Jako Cargo SARL, etc.

### Champs
- [ ] Prénom : obligatoire, astérisque orange
- [ ] Nom : obligatoire, astérisque orange
- [ ] Entreprise : optionnel, mention "optionnel" en gris
- [ ] WhatsApp : obligatoire, sélecteur code pays, note "mot de passe par WhatsApp"
- [ ] Email : optionnel
- [ ] Pays : obligatoire, select avec 5 pays CEMAC
- [ ] Ville : optionnel

### Validation
- [ ] Bouton grisé quand validation ne passe pas
- [ ] Bouton violet quand validation OK
- [ ] Étape 1 : prénom + nom remplis pour continuer
- [ ] Étape 2 : WhatsApp rempli (min 9 chiffres) pour continuer
- [ ] Le code pays change quand on change le pays

### Design
- [ ] Police DM Sans partout
- [ ] Couleurs de la charte (violet #A947FE, or #F3A745, orange #FE560D)
- [ ] Focus input = bordure violette
- [ ] Inputs assez grands (17px, padding 16px)
- [ ] Labels 15px, titres 24px

### Layout
- [ ] Boutons Retour/Continuer TOUJOURS visibles en bas
- [ ] Bottom nav MASQUÉE dans le formulaire
- [ ] Le formulaire prend tout l'écran (100dvh)
- [ ] Le contenu scroll entre le header et les boutons
- [ ] Les boutons ne sont JAMAIS cachés par la bottom nav ou le clavier

### Connexion base de données
- [ ] Les noms de colonnes correspondent au schéma réel
- [ ] Le numéro de téléphone est nettoyé (pas d'espaces, format E.164)
- [ ] Les champs optionnels envoient `null` si vides (pas une string vide)
- [ ] La gestion d'erreurs affiche un message clair
- [ ] Après création, navigation vers la fiche client ou la liste

---

## MAQUETTE DE RÉFÉRENCE

Le fichier `maquette_admin_nouveau_client.jsx` montre le rendu visuel exact. Il est interactif : on peut remplir les champs, naviguer entre les étapes, voir le récapitulatif. Le résultat final doit être visuellement identique à cette maquette.
