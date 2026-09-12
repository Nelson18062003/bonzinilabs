# Bonzini Cargo — exploration des fonctionnalités, par sous-module

> Ce que le module peut devenir, trié par valeur pour l'ops et le client,
> avec ce que chaque fonction exige (données, API, migration). Les lignes
> marquées **✓** sont livrées ; **→** sont prêtes à faire sans dépendance
> externe ; **⏳** attendent une source de données ; **✗** sont écartées.

## 0. Principes d'interface (ce qui rend l'outil clair)

1. **Une phrase avant un chiffre.** Chaque dossier s'ouvre sur « En mer —
   position il y a 1 j » et « Kribi · 11 oct. », pas sur une grille.
2. **Le parcours se lit d'un coup d'œil.** Une ligne d'escales avec le navire
   dessus vaut mieux qu'une liste de codes. ✓ (stepper dans le dossier)
3. **Ce qu'il reste à faire est calculé, jamais saisi.** Fret, télex, B/L,
   facture, BESC : l'état vient des données. ✓ (« À faire » dans le dossier
   et compteur dans la flotte)
4. **La carte est une vue, le dossier est l'objet.** Tout clic sur la carte
   mène au dossier ; le dossier montre sa carte. ✓
5. **Aucun code à l'écran.** Jalons, statuts, ports : en français. ✓
6. **Clavier partout sur desktop.** ↑/↓ dans la table, Entrée ouvre, Échap
   ferme. ✓
7. **Les données sont exportables.** CSV de la flotte, un clic. ✓

## 1. Ma flotte (workbench)

| Fonction | État | Ce qu'elle apporte | Prérequis |
|---|---|---|---|
| Files : Tous · En mer · Arrivent sous 7 j · À régler · Sans suivi | ✓ | Les filtres qui comptent, avec compteurs | — |
| Tri par arrivée / client, recherche, filtres armateur / destination | ✓ | Retrouver une boîte en 2 s | — |
| Colonne « À faire » (n étapes ouvertes, rouge si arrivée sous 7 j) | ✓ | Voir d'un coup ce qui bloque | — |
| Export CSV | ✓ | Partager la flotte au transitaire / au client | — |
| Vue « par client » (grouper les lignes) | → | Répondre à un client sur tous ses conteneurs | — |
| Vue « par navire » | → | Préparer une arrivée (n boîtes le même jour) | — |
| Colonnes personnalisables, densité | → | Confort ops | — |
| Import CSV du tableau transitaire (client, B/L, boîte, dates, fret) | → | Ajouter 10 dossiers en une fois | RPC manuel ✓ + recherche Maersk ✓ |
| Sélection multiple : marquer réglé / télex, exporter | → | Traiter par lot | — |

## 2. Dossier conteneur

| Fonction | État | Ce qu'elle apporte | Prérequis |
|---|---|---|---|
| Où / quand, parcours, faits, suivi, carte, documents, note | ✓ | Tout ce qu'on sait, ordonné | — |
| « À faire » : fret → télex → B/L → facture → BESC → prévenir le client | ✓ | La liste que l'ops coche avant l'arrivée | — |
| Renseigner le navire à la main (nom, IMO, MMSI, voyage, ETA) | ✓ | Placer une boîte CMA CGM sur la carte sans API | — |
| Copier le n° de boîte / B/L en un clic | ✓ | Zéro faute de frappe dans les mails | — |
| Historique des ETA (chaque changement horodaté, courbe) | ⏳ | « L'armateur a reculé 3 fois » — argument face au transitaire | table `cargo_eta_history` + écriture dans cargo-sync |
| Historique des positions (trace réelle du navire) | ⏳ | Trace exacte, pas indicative | table `cargo_position_history` + AIS régulier |
| Coûts du dossier (fret, surestaries, stockage, douane, transport) vs devis | → | La vraie facture d'un conteneur | table `cargo_costs` |
| Checklist douane Cameroun (BESC, DI, SGS/RVC, ANOR) avec état par pièce | → | Ne rien découvrir au port | s'appuie sur le manuel cargo |
| Commentaires horodatés (au lieu d'une note unique) | → | Suivre qui a dit quoi | table `cargo_comments` |
| Lien de partage lecture seule (client, transitaire) | → | « Regarde toi-même » | RPC token + page publique |
| Rappel automatique (Telegram / mail) à J-7 sans télex | → | Ne plus rater une arrivée | radar Mola existant |

## 3. Suivre une référence

| Fonction | État | Prérequis |
|---|---|---|
| B/L / booking / boîte → armateur détecté → résultat → ajouter | ✓ | — |
| Ajouter sans suivi armateur (saisie manuelle) | ✓ | migration 2026-09-12 |
| Armateurs : Maersk ✓ · CMA CGM ⏳ (accès API demandé) · MSC/COSCO ⏳ | | API armateur ou agrégateur |
| Reconnaître un B/L transitaire (House B/L) et demander le Master B/L | → | — |
| Coller plusieurs références d'un coup | → | — |

## 4. Carte

| Fonction | État | Prérequis |
|---|---|---|
| Vecteur OpenFreeMap (OSM), clair/sombre, globe, plein écran | ✓ | — |
| Statut vivant, badge conteneurs, parcouru/restant, ports avec compteurs | ✓ | — |
| Panneau synchronisé, cartes navire / port, couches | ✓ | — |
| Positions AIS automatiques (au lieu du dernier relevé) | ⏳ | `AISSTREAM_API_KEY` (gratuit) |
| Trace réelle et « rejouer le voyage » | ⏳ | historique des positions |
| Dwell / congestion des ports (façon Atlas) | ✗ pour l'instant | données payantes |

## 5. Clients et Mola

| Fonction | État | Prérequis |
|---|---|---|
| Lier un dossier à un client Bonzini (`client_id`) → onglet Cargo dans la fiche client | → | — |
| Vue client dans l'app (lecture seule, sans notes ni coûts) | → | RLS client + écran |
| Notifications client (arrivée sous 7 j, télex reçu) par SMS/mail | → | drainers existants |
| Mola : « où en est le conteneur de GAUSS ? » | ✓ côté données (RPC étiquetées) | outil dédié `cargo_status` à ajouter à l'assistant |

## 6. Ordre de bataille proposé

1. Import CSV du tableau transitaire + vue par client (une session).
2. Historique des ETA + rappel J-7 (une session, une migration).
3. Coûts du dossier + checklist douane (deux sessions).
4. Lien de partage et vue client (deux sessions, sécurité à revoir).
5. AIS automatique dès que la clé est posée ; CMA CGM dès que l'accès arrive.
