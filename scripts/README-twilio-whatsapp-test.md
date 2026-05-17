# Test Twilio WhatsApp — comment ça marche

## Vue d'ensemble du setup actuel

Tu as fini la configuration côté Twilio :
- Numéro WhatsApp Business : **+16626425166**
- Statut sender : **Online** ✅
- WhatsApp Business Account ID : 26750914857851491

Côté Meta (WhatsApp Manager) :
- Compte connecté à Twilio ✅
- **En attente de "partner verification"** ⏳ (Meta valide ton entreprise)
- Tier 1 actif : 250 messages business-initiated/jour
- Quota 0/250 utilisé pour le moment

## Que peux-tu faire pendant la vérification Meta ?

| Action | Possible ? |
|---|---|
| Envoyer un **template approuvé** à n'importe qui | ✅ (250/jour max) |
| **Répondre librement** à quelqu'un qui t'a écrit dans les dernières 24h | ✅ (illimité) |
| Démarrer une conv à froid avec un **message texte libre** | ❌ Bloqué (template requis) |
| Afficher "Nelson Consulting Center" comme nom expéditeur | ❌ Pas encore validé |

## Comment accélérer la vérification Meta ?

Va dans WhatsApp Manager → ton compte → **profil business** :
1. **Ajoute un site web** (le bouton "Add website" affiché dans l'alerte)
2. Remplis la description, le secteur d'activité, l'adresse
3. Ajoute le logo Bonzini
4. Si tu as un numéro de SIRET / registre commerce, ajoute-le aussi

Plus le profil est complet, plus Meta valide vite. Durée typique : 24h à 3 jours.

## Tester maintenant — le flow rapide

### Étape 1 : Récupère tes credentials Twilio

Va sur https://console.twilio.com/ → page d'accueil. Tu y vois :
- **Account SID** : commence par `AC...` (clique pour copier)
- **Auth Token** : clique sur "View" pour le révéler, puis copie

### Étape 2 : Ouvre une fenêtre de 24h

Depuis ton **téléphone perso** (pas le compte business) :
1. Ouvre WhatsApp
2. Démarre une nouvelle conversation avec `+16626425166`
3. Envoie n'importe quel message (genre "test")

Cette action crée une session de 24h pendant laquelle Twilio peut te répondre en texte libre.

### Étape 3 : Lance le script de test

Dans ton terminal local (pas dans le sandbox) :

```bash
cd bonzinilabs
chmod +x scripts/test-twilio-whatsapp.sh

# Renseigne tes credentials (juste pour cette session terminal)
export TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Envoie un message à ton numéro perso
./scripts/test-twilio-whatsapp.sh +33TONNUMERO "Coucou depuis Bonzini ! 🚀"
```

### Étape 4 : Vérifie

- Le terminal affiche `✅ Message envoyé !` avec un SID
- **Ton iPhone perso reçoit le message** sur WhatsApp dans les 10 secondes
- Tu peux suivre le statut dans https://console.twilio.com/us1/monitor/logs/sms

## Erreurs possibles et solutions

| Code Twilio | Sens | Fix |
|---|---|---|
| `63016` | Fenêtre 24h fermée | Renvoie un message de ton tél perso vers le numéro Twilio, puis ré-essaie |
| `63007` | Numéro non WhatsApp | Vérifie que le destinataire a bien WhatsApp installé |
| `21211` | Numéro mal formaté | Format obligatoire : `+33612345678` (avec + et indicatif pays) |
| `21408` | WhatsApp désactivé sur le sender | Va vérifier l'état du sender dans la console Twilio |

Le script gère ces erreurs et te donne le bon message d'aide directement.

## Intégration future dans Bonzini

Une fois la vérification Meta finie et que tu valides que ça marche, on pourra :

1. **Webhook entrant** : recevoir les messages WhatsApp clients dans une Edge Function Supabase, les stocker dans `chat_messages` avec un nouveau `media_type='whatsapp'` ou un canal séparé
2. **Webhook sortant** : quand un admin répond dans le chat in-app, on envoie aussi un message WhatsApp via l'API Twilio
3. **Templates** : créer des templates Twilio approuvés pour les notifications automatiques (dépôt validé, paiement traité, etc.)
4. **Côté admin** : le chat in-app actuel devient le canal unifié — peu importe que le client ait écrit via l'app ou via WhatsApp, tout arrive au même endroit

À discuter quand tu auras testé que l'API marche.
