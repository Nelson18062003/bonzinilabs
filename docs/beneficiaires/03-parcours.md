# Phase 3 — Design des parcours (tous les cas)

> Objet : couvrir **exhaustivement** les parcours client **et** admin, par mode, avec états et cas
> limites. Logique d'interaction (pas le visuel — appliqué au build, Phase 5).
> Couleurs de mode (rappel SPECS) : alipay **bleu** `#1677ff`, wechat **vert** `#07c160`, virement
> **violet** `#8b5cf6`, cash **rouge** `#dc2626`. Affichage **alias en titre**, identifiant/nom réel
> en sous-titre.
>
> Ancrages code (à remplacer/brancher) : carnet `src/pages/BeneficiariesPage.tsx` (stub) · étape
> client `NewPaymentBeneficiaryStep.tsx` + `NewPaymentPage.tsx` · étape admin
> `MobileNewPayment.tsx` · hooks `src/hooks/useBeneficiaries.ts` · complétion snapshot
> `EditBeneficiaryPage.tsx` + `useUpdateBeneficiaryInfo` (`usePayments.ts:300`) · détail client admin
> `MobileClientDetail.tsx`.

---

## 0. Matrice d'exhaustivité (parcours × mode)

| Parcours | alipay | wechat | virement | cash |
|---|:--:|:--:|:--:|:--:|
| **Client** — payer → choisir existant | ✓ | ✓ | ✓ | ✓ |
| **Client** — payer → nouveau (enregistré au passage) | ✓ | ✓ | ✓ | ✓ |
| **Client** — payer → **se payer soi-même** | ✓¹ | ✓¹ | ✓¹ | ✓² |
| **Client** — payer → compléter plus tard (skip) | ✓ | ✓ | ✓ | n/a³ |
| **Client** — carnet : lister / ajouter / éditer / archiver | ✓ | ✓ | ✓ | ✓ |
| **Admin** — payer p/ client → choisir dans SES bénéf. | ✓ | ✓ | ✓ | ✓ |
| **Admin** — payer p/ client → créer au carnet du client | ✓ | ✓ | ✓ | ✓ |
| **Admin** — rechercher/filtrer le carnet d'un client | ✓ | ✓ | ✓ | ✓ |

¹ « moi-même » = bénéficiaire normal **tagué `relation_type='self'`** (le compte Alipay/WeChat/bancaire du client) ; il faut saisir le compte une fois, réutilisable ensuite.
² cash « moi-même » = **auto-rempli depuis le profil** (nom + téléphone), **pas** enregistré comme entrée de carnet (c'est le client).
³ cash crée toujours au moins le récepteur (ou self) ; pas de « waiting_beneficiary_info » pour cash (statut `cash_pending`).

---

## A. CLIENT — Carnet hors flux (`/beneficiaries`) — **remplace le stub**

### A1. Liste
- **Filtre par mode** (onglets/segments couleur du mode) + **« Tous »**. Recherche texte sur
  `alias` / `identifier` / `bank_account` / `phone`.
- Item = avatar (1ʳᵉ lettre de l'alias) · **alias** (titre) · identifiant ou nom réel (sous-titre,
  CJK possible) · badge mode coloré. Tri par `updated_at` desc (récents en haut).
- **Empty state** : illustration + « Aucun bénéficiaire » + CTA « Ajouter ».
- Source : `useBeneficiaries(method?)` (déjà OK), QR en signed-URL (déjà OK).

### A2. Ajouter (hors paiement)
1. Choix du **mode** (4 cartes couleur).
2. **Formulaire par mode** (spec Phase 2 §3) — `alias` requis en tête, puis champs du mode.
3. **Validation Zod dure** (bouton désactivé tant qu'incomplet) → miroir des `CHECK` DB.
4. **Anti-doublon** : à la saisie de l'identifiant/compte, si collision → bandeau « Déjà : *<alias>*.
   Ouvrir / Fusionner ? » (pas d'erreur sèche).
5. Save via `useCreateBeneficiary` → toast succès → retour liste.

### A3. Éditer
- Même formulaire pré-rempli (`useUpdateBeneficiary` — **à brancher**, aujourd'hui mort).
- **Rappel snapshot** : un bandeau discret « Les paiements déjà créés ne sont pas modifiés » (lève
  l'inquiétude). Édition **toujours permise** quel que soit l'état des paiements (cf. Phase 2 §4).

### A4. Archiver (= « supprimer »)
- Action « Supprimer » → **modale de confirmation** → `is_active=false` (archivage, réversible).
- **Aucun effet** sur les paiements passés (snapshot + FK `SET NULL`).
- Option (v2) : vue « Archivés » avec « Restaurer ». MVP : archivage simple, l'entrée disparaît des
  listes/sélecteurs.

### A5. Cas par mode (formulaire)
| Mode | Champs (alias requis partout) |
|---|---|
| alipay/wechat | `name` + (identifiant **ou** QR) ; type d'identifiant (id/email/tél) ; tél/email opt. |
| virement | `name`, `bank_name`, `bank_account` ; `bank_extra` opt. |
| cash | `name`, `phone` ; email/notes opt. |

---

## B. CLIENT — Création de paiement (étapes 1 Mode → 2 Montant → 3 Bénéficiaire → 4 Résumé)

> Étape 3 reconstruite. Onglets **Existant / Nouveau** + chemins **moi-même** et **plus tard**.

### B1. Choisir un bénéficiaire existant
- Onglet « Existant » : `useBeneficiaries(selectedMethod)` filtré par mode → sélection → le
  **snapshot** se construit depuis l'entrée choisie (`buildBeneficiarySnapshot`, à conserver).
- Empty → message + bascule « Nouveau ».

### B2. Nouveau bénéficiaire (enregistré au passage)
- Formulaire par mode (= A5) + `alias` requis.
- **Anti-doublon** avant save (offre l'existant si collision).
- **Save non silencieux** (corrige G7) : 
  - succès → bénéficiaire ajouté au carnet + lié au paiement ;
  - **échec d'enregistrement** → on **n'avale pas l'erreur** : toast « Bénéficiaire non enregistré
    au carnet, le paiement va continuer » (le **snapshot** part quand même → paiement intègre).
- Option « Ne pas enregistrer ce bénéficiaire » (case à cocher) pour le ponctuel → snapshot seul,
  pas d'écriture carnet. *(satisfait « saisie ponctuelle non enregistrée ».)*

### B3. Se payer soi-même
- **cash** : bouton « Moi-même » → auto `name`+`phone` depuis le profil (déjà OK), `relation='self'`,
  **non enregistré** au carnet.
- **alipay/wechat/virement** : toggle « C'est mon compte » → `relation_type='self'` ; les champs
  du compte restent requis (Alipay vérifie le nom) ; **enregistrable** et réutilisable comme tout
  bénéficiaire. *(Nouveau vs aujourd'hui : self n'existait que pour cash.)*

### B4. Compléter plus tard (skip)
- Disponible alipay/wechat/virement (pas cash). Paiement créé en `waiting_beneficiary_info`.
- Complétion ultérieure via `EditBeneficiaryPage` (met à jour **le snapshot du paiement** via
  `useUpdateBeneficiaryInfo`) **+ nouveauté** : case « Enregistrer aussi au carnet » (→
  `useCreateBeneficiary`).

### B5. Cas limites client
| Cas | Comportement |
|---|---|
| Carnet vide | Onglet Existant → empty + CTA Nouveau |
| Collision doublon | Bandeau « utiliser l'existant ? », pas d'erreur |
| Champs incomplets | Bouton désactivé (Zod dur) — **fini la validation molle** |
| Solde insuffisant / montant < 10k / > 50M | Inchangé (garde-fous existants) |
| Nom/banque en chinois | Accepté ; alias latin sert de repère en liste |
| QR uploadé | Compression + signed-URL (réutilisé) |
| Bénéficiaire archivé | Absent du sélecteur ; visible seulement dans l'historique des paiements |

---

## C. ADMIN — Paiement pour le compte d'un client (`MobileNewPayment`, 5 étapes) — **branchement**

> Aujourd'hui l'admin **re-saisit tout** ; les hooks admin sont morts. On les branche, scopés au
> **client sélectionné à l'étape 1** (`client.user_id`).

### C1. Voir & choisir dans LES bénéficiaires du client
- Étape 4 : `useAdminClientBeneficiaries(client.user_id, mode)` → **à brancher** → liste des
  bénéficiaires **de ce client uniquement** (RLS admin + filtre `client_id` → **zéro fuite
  cross-client**). Onglet Existant/Nouveau comme côté client (thème dark admin).

### C2. Créer un bénéficiaire pour le client
- Onglet Nouveau → `useAdminCreateBeneficiary({client_id: client.user_id, ...})` → **à brancher** →
  enregistré au carnet du client, **immédiatement visible côté client** (mêmes lignes, backend
  partagé). Trace `created_by` = admin *(à ajouter, cf. Phase 4)*.

### C3. Rechercher / filtrer
- Barre de recherche (alias/identifiant) + filtre par mode dans la liste du client.

### C4. Par mode + self + plus tard
- Mêmes règles que client (A5/B3/B4), thème admin. Cash « moi-même » = auto depuis la fiche client
  (déjà `benef.isClient`).

### C5. Cas limites admin
| Cas | Comportement |
|---|---|
| Client sans bénéficiaire | Empty + CTA Nouveau |
| Admin change de client en cours | Réinitialiser sélection bénéficiaire + recharger la liste du nouveau client |
| Collision doublon dans le carnet du client | Même UX douce |
| Taux personnalisé | Inchangé (existant) |
| Scoping | **Jamais** afficher les bénéficiaires d'un autre client |

---

## D. ADMIN — Carnet d'un client hors paiement *(RETENU ✅)*
- **Décision porteur produit : inclus.** Section « Bénéficiaires » dans `MobileClientDetail.tsx`
  (réutilise `useAdminClientBeneficiaries` + create/edit/archive admin) : l'admin liste / ajoute /
  édite / archive le carnet d'un client **hors d'un paiement**.
- Même scoping strict (`client_id` du client affiché) ; thème admin (dark) ; recherche/filtre par
  mode comme §A1. → +1 écran à bâtir (Lot 4, Phase 4).

---

## E. Cas transverses (s'appliquent partout)

1. **Immuabilité snapshot** : aucun écran n'affiche un paiement en lisant la ligne `beneficiaries`
   vivante. Règle de revue de code (Phase 6).
2. **Composant anti-doublon partagé** (client + admin) : même logique de détection/offre.
3. **Chinois** : saisie/collage CJK libre ; affichage alias-first ; **bouton copier** sur
   identifiant/compte/nom côté admin (transcription portail).
4. **Archivés** : exclus des sélecteurs/listes actives ; conservés pour l'historique.
5. **Permissions/scoping** : client = ses bénéficiaires (RLS `client_id`) ; admin = ceux du client
   **sélectionné** uniquement. Aucune route ne doit fuiter cross-client.
6. **Réseau CEMAC** : react-query `staleTime 30s` (cache), compression image QR (réutilisés) ;
   formulaires tolérants au collage ; pas de rechargement bloquant.

---

## F. Cycle de vie d'un bénéficiaire (états)
```
[création] --> active --(archiver)--> archived --(restaurer, v2)--> active
                  |                         |
                  +---- référencé par paiements (snapshot figé) ----+
                  (l'état n'affecte JAMAIS les paiements passés)
```

---

## Auto-contrôle Phase 3
- ✅ Exhaustivité : matrice §0 couvre client/admin × 4 modes × {existant, nouveau, self, plus tard,
  carnet} + cas limites (§B5/C5/E).
- ✅ Snapshot (Q4) rappelé comme règle transverse (E1) + bandeau UX rassurant (A3).
- ✅ Scoping anti-fuite (E5, C1) ; chinois (E3, A/B) ; doublons (A2/B2 + E2).
- ✅ Self étendu à tous les modes (B3) — manque comblé vs existant.
- ✅ Save non silencieux (B2) — corrige G7 ; validation dure (B5) — corrige G5.
- ✅ Ancrages `fichier:ligne` pour chaque parcours (réutilisation vs branchement explicites).
- ⏳ À confirmer : **[?]** section carnet dans le détail client admin (§D, option). Puis **Phase 4
  (plan d'implémentation par lots)**.
