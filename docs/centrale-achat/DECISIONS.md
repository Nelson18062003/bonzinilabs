# Centrale d'achat — Journal des décisions

> Chaque décision est numérotée, datée, motivée, et porte un statut :
> ✅ **prise** · 🕒 **proposée, en attente de validation** · 📌 **position posée** (argumentée, réversible si contre-preuve).
> Convention héritée des docs de refonte Mola : on documente la décision **et** son pourquoi, pour que personne ne la re-litige sans nouvel argument.

---

## D-001 ✅ Structure documentaire du projet — 2026-06-10
**Décision :** toute la conception vit dans `docs/centrale-achat/`, un fichier par phase (`00-`, `10-`, `20-`…), plus ce journal et un `README.md` d'index. Chaque évolution est documentée au fil de l'eau, jamais a posteriori.
**Pourquoi :** c'est le format qui a fait ses preuves sur la refonte Mola (`docs/assistant-ops/refonte/`) — numérotation par phase, journaux de lots, état en tête de README. On ne réinvente pas une convention interne qui marche.

## D-002 ✅ Discipline de preuve — 2026-06-10
**Décision :** chaque affirmation porte un niveau de confiance (🟢 vérifié / 🟡 étayé / 🔴 à confirmer), une référence `fichier:ligne` pour le code, une URL + date pour le web (à partir de la Phase 1). Aucun terme métier procurement n'est défini de mémoire : tout passe par la Phase 1 sourcée.
**Pourquoi :** règle imposée par le brief + leçon Mola n°1 (un agent — ou un architecte — qui devine au lieu d'inspecter produit des faussetés énoncées avec aplomb).

## D-003 🕒 Workflow en 7 phases avec gates — 2026-06-10
**Décision proposée :** Proposition A (cadrage → domaine → diagnostic terrain → modèle métier → UX → agent IA → archi/coûts → roadmap), une gate de validation par phase, questionnaire terrain parallélisé pendant la Phase 1. Alternative B compressée (4 phases) documentée et déconseillée.
**Pourquoi :** le sujet est gros (« diagnostic architectural, pas patch ») ; les gates évitent de construire le modèle de données sur des suppositions terrain. Le coût de la lenteur est inférieur au coût d'un modèle métier faux.
**Attend :** réponse Q-1.

## D-004 🕒 Lot 1 = outil interne + catch-up rétroactif mai 2026 — 2026-06-10
**Décision proposée :** le Lot 1 d'implémentation (post-Phase 7) cible l'app **admin** (père + toi), avec saisie rétroactive de la mission mai 2026 comme cas de validation réel, et des rapports générés transmis au client. L'exposition dans l'app cliente vient dans un lot ultérieur.
**Pourquoi :** la valeur immédiate est le rapport propre de la mission existante ; exposer une UI client avant que le modèle et les données soient fiables, c'est exposer des chiffres faux à la personne dont c'est l'argent.
**Attend :** réponse Q-5.

## D-005 📌 Pas d'intégration WeChat — stratégie « côté capture » — 2026-06-10
**Position :** aucune automatisation du WeChat personnel du père (pas d'API officielle ; passerelles tierces = violation CGU + risque de ban d'un compte opérationnellement vital). La plateforme se place **en aval** : capture rapide en visite d'usine, partage de captures/exports, OCR best-effort, validation humaine. WeCom étudié en Phase 1 uniquement si une entité chinoise existe (Q-8).
**Pourquoi :** réalité des CGU Tencent (sourçage formel en Phase 1) + asymétrie des risques : perdre le compte WeChat du père coûte plus cher que tout ce que l'intégration rapporterait.
**Confiance :** haute ; à sourcer formellement en Phase 1 (URL + date).

## D-006 📌 Le fournisseur-usine est une entité nouvelle, distincte de `treasury_counterparties` — 2026-06-10
**Position :** ne pas réutiliser `treasury_counterparties` (contreparties de change USDT/CNY, `types.ts:884-931`) pour modéliser les usines. En revanche, hériter des doctrines treasury (append-only, contre-écriture, multi-devises natif, reporting XAF) et **lier** les paiements fournisseurs aux comptes treasury (`cash_guangzhou`, `alipay_papa`, `wechat_papa`) pour que la caisse reste juste sans double saisie.
**Pourquoi :** sémantiques différentes (un vendeur d'USDT n'est pas une usine de meubles) ; mais le cash qui paie une avance fournisseur sort physiquement d'un compte treasury existant — l'ignorer créerait deux vérités de caisse (risque R-5).

## D-007 📌 Le module naît AI-native via la convention `@mola` — 2026-06-10
**Position :** chaque RPC du module porte son étiquette `@mola` dès sa migration de création (c'est déjà une obligation `CLAUDE.md`), le test de parité l'impose en CI, et l'agent achat découvre ses capacités par introspection live (`mola_discover_capabilities`) — zéro catalogue manuel pour les écritures.
**Pourquoi :** c'est la leçon centrale de la refonte Mola (`14-AI-NATIVE-DIAGNOSTIC-DESIGN.md`) : un catalogue écrit à la main devient un miroir partiel et figé, source des « refus d'actions possibles ». La question « extension de Mola vs agent frère » reste ouverte pour la Phase 5 — elle ne change pas cette position.
