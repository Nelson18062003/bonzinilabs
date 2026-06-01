# Checklist de déploiement — tout ce qui a été construit

Coche au fur et à mesure. **Ordre conseillé.** Les liens « Copy raw file » 📋
sont sur GitHub (branche `claude/sharp-rubin-7fL5e`).

---

## PARTIE A — Back-end (dès maintenant, indépendant du site)

### A1. Lancer 2 migrations restantes (SQL Editor)
SQL Editor : https://supabase.com/dashboard/project/fmhsohrgbznqmcvqktjw/sql/new

- [ ] **Emails « doux »** (accusé dépôt, paiement en cours, mot de passe) :
  `.../supabase/migrations/20260601140000_email_soft_transactional.sql`
- [ ] **Relances** (dépôt non finalisé, profil incomplet) :
  `.../supabase/migrations/20260601160000_email_reminders_cron.sql`

*(La migration « message support » 20260601120000 a déjà été lancée.)*

### A2. Redéployer la fonction `send-email`
Elle a gagné **plein de nouveaux templates + le logo agrandi**.
- [ ] Functions → `send-email` → Edit → coller la dernière version → Deploy
  `.../supabase/functions/send-email/index.ts`

➡️ **Après A1+A2** : message support, accusé de dépôt, paiement en cours,
relances, et le **logo agrandi** sur TOUS les emails sont actifs.

---

## PARTIE B — Front (le site bonzinilabs.com)

### B1. Créer + merger la Pull Request
- [ ] PR : https://github.com/Nelson18062003/bonzinilabs/compare/main...claude/sharp-rubin-7fL5e?expand=1
- [ ] Merge → Vercel redéploie (~1-2 min)

➡️ **Après B1** : bouton **Google**, écran **OTP** (dormant), email **mot de
passe modifié**, et le **logo BIMI** (`/bimi-logo.svg`) deviennent en ligne.

---

## PARTIE C — Activations (APRÈS le déploiement front)

### C1. Activer l'OTP (vérification par code à l'inscription)
- [ ] Auth → Email Templates → **Confirm signup** : coller
  `.../docs/email-previews/confirm_signup.html` (objet : « Votre code de vérification Bonzini »)
- [ ] Auth → activer **« Confirm email »**

### C2. Avatar BIMI (logo dans la boîte de réception)
- [ ] Vercel DNS : ajouter **DMARC** (`_dmarc` TXT, `p=none…`) + **BIMI**
  (`default._bimi` TXT) — cf. `docs/GUIDE_bimi_avatar.md`
- [ ] (~1-2 semaines plus tard) passer DMARC en `p=quarantine` → avatar allumé

---

## PLUS TARD (optionnel)
- [ ] **VMC** (certificat payant) pour l'avatar **Gmail**
- [ ] **A6** : permettre à un client « téléphone-seul » d'ajouter son email
  (feature front — à construire ; dépend de la Partie B)

---

### Déjà fait ✅
Connexion Google (back), SMTP Resend, outbox + drainer + cron, webhooks Resend,
14 templates d'emails, reset password (template + SMTP), interrupteurs des
emails métier, logo BIMI (SVG).
