# Catalogue complet des capacités — Mola atteint TOUTE la plateforme

> **Date :** 2026-06-03 · Objectif : étiqueter **toutes** les actions (plus de « module par module ») + poser la **convention** pour le futur.

## 1. Ce qui a été fait
- **Étiquetage exhaustif** (migration `20260603180000_mola_capability_tags_full.sql`) : **toutes** les actions d'écriture de la plateforme portent désormais une étiquette `@mola` → `find_capability` les **voit toutes**.
- **Garde-fou** : les actions adossées à un **outil dédié riche** portent un champ `"tool"`. `do_capability` **redirige** vers cet outil (calcul de taux, vérif de solde, carte de confirmation) au lieu de l'exécuter en générique.
- **Convention `CLAUDE.md`** : toute **nouvelle** RPC doit porter une étiquette `@mola` dans sa migration. La plateforme reste AI-native **par construction**.

## 2. Couverture — toutes les actions d'écriture (≈27 découvrables)
| Module | Actions étiquetées (découvrables par Mola) | Mécanisme |
|---|---|---|
| **Clients** | créer, supprimer | outil dédié |
| **Dépôts** | créer, valider, rejeter · annuler, revenir à « créé », démarrer la revue | dédié + **découverte** |
| **Paiements** | créer, compléter bénéficiaire, annuler · scanner/confirmer/traiter cash · supprimer/remplacer une preuve | dédié + **découverte** |
| **Taux** | définir le taux du jour, ajuster par pays/palier | outil dédié |
| **Wallet** | créditer/débiter | outil dédié |
| **Trésorerie** | achat/vente USDT, contreparties (créer/modifier/supprimer), ajuster compte, annuler opération, inventaire | outil dédié |
| **Bénéficiaires** | créer/modifier/archiver (registre) | outil dédié |

→ **Mola atteint la totalité des actions opérationnelles**, soit via un **outil dédié riche**, soit via la **découverte** (`find_capability` + `do_capability`). Les deux sont dans le **même registre** : `find_capability` liste **tout**.

## 3. Lectures
Toute **question/analyse** est déjà couverte sans limite par l'outil SQL libre (`query_database`, scopé par rôle). Mola peut donc « lire » n'importe quelle donnée de n'importe quel module.

## 4. Volontairement NON exposé (`expose:false`)
- **Sensible (ta décision)** : créer/gérer des admins, réinitialiser des mots de passe. (Suppression/remplacement de preuve = **ON**, par ta décision.)
- **Interne** : générateurs de référence, prédicats d'auth (`is_admin`…), helpers de calcul. Jamais des « actions » au sens métier.

## 5. La garantie pour le futur (convention)
`CLAUDE.md` → section **« Mola — Convention AI-native »** : **toute nouvelle action = une étiquette `@mola`** dans la migration. Résultat : quand tu ajoutes un module, ses actions sont **automatiquement** découvrables par Mola — **sans réécriture côté IA**, juste l'étiquette (écrite en même temps que la RPC).

## 6. Rappel honnête (anti-magie)
- Mola **ne fabrique pas** ses outils : un humain crée l'action (RPC) + l'étiquette ; Mola la **découvre et l'utilise**.
- « Tout est étiqueté **aujourd'hui** » : oui pour les actions **existantes**. Pour les **futures**, c'est la **convention** qui le garantit (1 ligne par action).
- Non testé en runtime ici (pas de DB) : étiquettes en JSON valide, migration robuste (par signature réelle). Validation = au déploiement (`db push` + `gen-types`).

*Plateforme AI-native : catalogue complet aujourd'hui + convention pour demain.*
