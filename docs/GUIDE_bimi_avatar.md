# Guide — Logo en photo de profil (BIMI)

Objectif : afficher le logo Bonzini dans le **rond à côté de l'expéditeur** dans
la boîte de réception (avatar). Standard utilisé : **BIMI**.

> ⚠️ Pré-requis pour que l'avatar s'affiche : (1) le SVG en ligne, (2) **DMARC en
> mode strict** (`quarantine` ou `reject`). On y va **par étapes** pour ne RIEN
> casser de tes emails existants (Gmail Workspace + Resend).

---

## Ce qui est déjà prêt (côté code)
- ✅ Logo **SVG conforme BIMP** : `public/bimi-logo.svg`
  → sera servi à **`https://www.bonzinilabs.com/bimi-logo.svg`** une fois l'app
  **déployée** (ta PR/merge → Vercel).

---

## Les 2 enregistrements DNS (chez Vercel)

Vercel → ton projet → **Domains → bonzinilabs.com → DNS Records → Add**.

### 1) DMARC — ÉTAPE 1 : mode « observation » (zéro risque, à faire maintenant)
| Champ | Valeur |
|---|---|
| Type | `TXT` |
| Name / Host | `_dmarc` |
| Value | `v=DMARC1; p=none; rua=mailto:dmarc@bonzinilabs.com; adkim=r; aspf=r` |

- `p=none` = **n'impacte aucun email** (juste de l'observation). 100 % sûr.
- `rua=` : adresse qui reçoit les rapports. Utilise une adresse que tu as
  (ex. crée `dmarc@bonzinilabs.com` dans Google Workspace, ou mets ton email).

### 2) BIMI — le pointeur vers le logo (à faire maintenant aussi)
| Champ | Valeur |
|---|---|
| Type | `TXT` |
| Name / Host | `default._bimi` |
| Value | `v=BIMI1; l=https://www.bonzinilabs.com/bimi-logo.svg;` |

---

## ÉTAPE 2 (dans ~1 à 2 semaines) : activer l'avatar

Une fois que les rapports DMARC confirment que **tous** tes envois légitimes
(Resend + Google Workspace) passent bien, on **renforce** DMARC — c'est ce qui
**allume l'avatar** :

| Champ | Nouvelle valeur |
|---|---|
| `_dmarc` (TXT) | `v=DMARC1; p=quarantine; rua=mailto:dmarc@bonzinilabs.com; adkim=r; aspf=r` |

> 🚦 Tu peux aller plus vite (passer direct à `p=quarantine`) **si** tu es sûr
> que seuls **Resend** et **Google Workspace** envoient des emails depuis
> `@bonzinilabs.com`. Sinon, l'étape « observation » d'abord évite d'envoyer tes
> vrais emails en spam.

---

## Où l'avatar s'affichera
- ✅ **Yahoo Mail, Apple Mail, Fastmail…** : avec les étapes ci-dessus (gratuit).
- 💰 **Gmail** : exige **en plus** un certificat payant **VMC** (~1000 $/an,
  via DigiCert/Entrust), lié à une **marque déposée**. Tant qu'il n'est pas
  fourni, Gmail n'affiche pas le logo (mais rien n'est cassé). À décider plus tard.

---

## Récap des étapes
1. **Déployer l'app** (ta PR) → le SVG devient accessible en ligne.
2. **Ajouter** les 2 enregistrements DNS (DMARC `p=none` + BIMI) chez Vercel.
3. **Attendre ~1-2 semaines** + vérifier les rapports DMARC.
4. **Passer DMARC à `p=quarantine`** → l'avatar s'allume (hors Gmail).
5. *(Optionnel, payant)* Certificat **VMC** pour l'avatar Gmail.
