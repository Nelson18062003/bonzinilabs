# Industrialisation des capacités auto-découvertes

> **Date :** 2026-06-03 · Suite du PoC (doc 16). On étiquette la plateforme + on durcit le mécanisme.

## 1. Capacités étiquetées (migration `20260603160000`)
**Opérationnelles — exposées (ON), découvrables + exécutables par Mola (avec confirmation) :**
| Capacité | RPC | Permission | Danger |
|---|---|---|---|
| Annuler un dépôt | `cancel_deposit` (PoC) | canProcessDeposits | ⚠️ |
| Remettre un dépôt à « créé » | `revert_deposit_to_created` | canProcessDeposits | ⚠️ |
| Démarrer la revue d'un dépôt | `start_deposit_review` | canProcessDeposits | — |
| Confirmer un paiement cash | `confirm_cash_payment` (PoC) | canProcessPayments | — |
| Scanner un paiement cash | `scan_cash_payment` | canProcessPayments | — |
| Traiter un paiement | `process_payment` | canProcessPayments | ⚠️ |
| Stats dépôts (lecture) | `get_deposit_stats` (PoC) | canViewDeposits | — |

**Sensibles — ÉTEINTES (expose:false), documentées, en attente de TA décision :**
`delete_payment_proof` (suppression de preuve, audit-sensible), `admin_reset_client_password`, `admin_reset_password`, `admin_create_admin`, `toggle_admin_status`, `update_admin_role`, `update_admin_profile`.
→ **Pour les activer : passer `expose` à true.** Elles vérifient déjà super_admin en interne ; je les laisse OFF par prudence jusqu'à ton feu vert.

## 2. Durcissements (sécurité)
- **Re-vérification de la permission de la capacité À LA CONFIRMATION** (pas seulement à la préparation) — couvre le cas d'un rôle modifié entre les deux.
- **Résolveur client par NOM** (`findClientsByName`) : « le grand livre de Jonas Boco » → résolu (et désambiguïsé si plusieurs).
- Rappel : tout passe par **carte de confirmation** + le RPC garde son `is_admin` interne (défense en profondeur).

## 3. Volontairement NON étiquetées (à clarifier avec toi)
- `cancel_client_deposit` (doublon de `cancel_deposit`), `submit_deposit_proof` (flux de preuve → géré par les pièces jointes), `create_wallet_adjustment` (doublon d'`adjust_wallet`), `admin_setup_client` (doublon de `create_client`).
- **Groupe « exchange_rate »** (`add/update/delete_exchange_rate`) : semble être un système de taux **parallèle/legacy** distinct de `daily_rates`/`rate_adjustments` (que Mola gère déjà). **Risque de confusion → laissé OFF, à clarifier** : est-ce encore utilisé ?

## 4. Caveats honnêtes
- `confirm_cash_payment` a un paramètre `p_signature_url` (URL d'une signature) que le modèle ne peut pas inventer → utile surtout quand l'admin fournit l'info ; sinon limité. (Le param vient normalement d'un upload UI.)
- `process_payment(p_action, …)` : les valeurs valides de `p_action` ne sont pas documentées ici → si Mola se trompe, le RPC renvoie une erreur et Mola se corrige (boucle d'auto-correction). À vérifier au déploiement.
- **Non testé en runtime** (pas de DB/Deno) : signatures vérifiées dans les migrations, étiquettes parsées (11/11), edge équilibré. **Preuve = déploiement.**

## 5. Où en est la profondeur de Mola
- Avant : ~19 actions (outils faits-main) → ~44 %.
- Maintenant : +6 actions opérationnelles **auto-découvertes** (annuler/revert/revue dépôt, scanner/confirmer/traiter paiement) **sans nouvel outil codé**.
- Surtout : **le mécanisme est en place** → toute future RPC étiquetée = Mola la prend **automatiquement**. Le plafond ne se referme plus.

## 6. Ce qu'il reste (et qui dépend de TA décision)
1. **Activer ou non les 7 sensibles** (admin / mot de passe / suppression de preuve). Décision de confiance — la tienne.
2. **Clarifier le groupe exchange_rate** (legacy ?).
3. À terme : migrer les 19 outils faits-main vers des étiquettes (même garanties, moins de code) + exposer le registre en **MCP** (doc 15).

*Industrialisation en place. Mola découvre et agit ; le sensible attend ton feu.*
