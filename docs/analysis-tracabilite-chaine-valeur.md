# Analyse — Traçabilité de la chaîne de valeur XAF → USDT → CNY

> **Statut** : Phase 1 en cours — audit lecture-seule de la codebase.
> **Doctrine validée en Phase 0** :
> 1. Valorisation stock USDT : **WAC** (Weighted Average Cost).
> 2. Granularité : **agrégée sur période** (Tier 2). Marge par transaction client repoussée en Tier 3.
> 3. Reconnaissance du gain : **à la vente USDT → CNY**.
> 4. Cash CNY : **comptes multiples** (`cash_guangzhou`, `alipay_papa`, `wechat_papa`, …) + inventaire hebdo.
> 5. Devise de reporting : **XAF** principal, soldes natifs affichés par devise.
> 6. Audit trail : **append-only**, voiding par contre-écriture, pas de hard delete.
>
> **Précisions métier confirmées** :
> - Achats USDT : **100 % en XAF**.
> - Frais bancaires / MM / Binance : **ignorés en Tier 1/2** (à réintroduire plus tard).
> - Stock CNY réel : oui — cash récupéré au bureau Guangzhou par le père ou un responsable bureau + comptes Alipay/WeChat personnels du père.
> - Saisie par : moi + mon père (mobile-friendly impératif).

---

## 1. Stack & architecture
_À compléter (Phase 1 en cours)._

## 2. Modèle de données existant
_À compléter._

## 3. Modèle taux / pricing actuel
_À compléter — point critique : précision décimale._

## 4. Modules admin existants
_À compléter._

## 5. RPC / fonctions SECURITY DEFINER
_À compléter._

## 6. Système de permissions & rôles
_À compléter — qui pourra saisir achats/ventes USDT ?_

## 7. Mobile-friendliness
_À compléter — saisie depuis WhatsApp par le père = formulaire mobile prioritaire._

## 8. Dette technique bloquante potentielle
_À compléter — précision numeric sur taux, contraintes FK, patterns à respecter._

## 9. Points d'extension naturels pour le nouveau module
_À compléter — où poser les nouvelles tables / pages sans casser l'existant._

---

## Synthèse Phase 1
_À compléter une fois l'audit terminé._
