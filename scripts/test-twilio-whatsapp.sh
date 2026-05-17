#!/bin/bash
# ============================================================
# Test Twilio WhatsApp Business — envoie un message via l'API
#
# Prérequis :
#   1. Compte Twilio avec WhatsApp sender configuré
#   2. Récupérer 2 valeurs dans https://console.twilio.com/ :
#      - Account SID (commence par "AC...")
#      - Auth Token (cliquer sur "View" pour le révéler)
#   3. Pour tester en mode "réponse libre" (sans template approuvé) :
#      → Envoie d'abord n'importe quel message DEPUIS ton téléphone perso
#        VERS le numéro Twilio (+16626425166). Ça ouvre une fenêtre de 24h.
#
# Usage :
#   export TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
#   export TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
#   ./test-twilio-whatsapp.sh +33612345678 "Coucou depuis Twilio !"
#
# Le 1er argument = numéro de destination (format E.164, avec +)
# Le 2e argument = corps du message (optionnel, défaut: "Test depuis Bonzini")
# ============================================================

set -e

# Couleurs terminal
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ─── Vérification des credentials ───
if [ -z "$TWILIO_ACCOUNT_SID" ] || [ -z "$TWILIO_AUTH_TOKEN" ]; then
  echo -e "${RED}❌ Credentials Twilio manquants${NC}"
  echo ""
  echo "Définis-les avec :"
  echo "  export TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
  echo "  export TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
  echo ""
  echo "Récupère-les sur https://console.twilio.com/ (page d'accueil)"
  exit 1
fi

# ─── Configuration ───
TWILIO_WHATSAPP_FROM="${TWILIO_WHATSAPP_FROM:-whatsapp:+16626425166}"
TO_PHONE="${1:-}"
MESSAGE_BODY="${2:-Test depuis Bonzini 🚀}"

# ─── Validation args ───
if [ -z "$TO_PHONE" ]; then
  echo -e "${RED}❌ Numéro de destination manquant${NC}"
  echo ""
  echo "Usage : $0 +33612345678 \"Mon message\""
  echo ""
  echo -e "${YELLOW}⚠️  Important : ton téléphone perso doit avoir envoyé un${NC}"
  echo -e "${YELLOW}    message au numéro Twilio dans les dernières 24h, sinon${NC}"
  echo -e "${YELLOW}    le message libre sera rejeté (règle Meta).${NC}"
  exit 1
fi

# Formatage du destinataire (préfixe whatsapp: si pas déjà là)
if [[ "$TO_PHONE" != whatsapp:* ]]; then
  TO_PHONE="whatsapp:$TO_PHONE"
fi

# ─── Récap avant envoi ───
echo -e "${BLUE}┌─────────────────────────────────────────────────────${NC}"
echo -e "${BLUE}│  Test Twilio WhatsApp${NC}"
echo -e "${BLUE}├─────────────────────────────────────────────────────${NC}"
echo -e "${BLUE}│  From      :${NC} $TWILIO_WHATSAPP_FROM"
echo -e "${BLUE}│  To        :${NC} $TO_PHONE"
echo -e "${BLUE}│  Message   :${NC} $MESSAGE_BODY"
echo -e "${BLUE}│  Account   :${NC} ${TWILIO_ACCOUNT_SID:0:10}…"
echo -e "${BLUE}└─────────────────────────────────────────────────────${NC}"
echo ""

# ─── Appel API ───
echo "📡 Envoi en cours…"
echo ""

RESPONSE=$(curl -sS -X POST "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Messages.json" \
  --data-urlencode "From=$TWILIO_WHATSAPP_FROM" \
  --data-urlencode "To=$TO_PHONE" \
  --data-urlencode "Body=$MESSAGE_BODY" \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN")

# ─── Analyse réponse ───
STATUS=$(echo "$RESPONSE" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
ERROR_CODE=$(echo "$RESPONSE" | grep -o '"code":[0-9]*' | head -1 | cut -d':' -f2)
ERROR_MSG=$(echo "$RESPONSE" | grep -o '"message":"[^"]*"' | head -1 | cut -d'"' -f4)
SID=$(echo "$RESPONSE" | grep -o '"sid":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$ERROR_CODE" ] && [ "$ERROR_CODE" != "0" ]; then
  echo -e "${RED}❌ Erreur Twilio :${NC}"
  echo "   Code : $ERROR_CODE"
  echo "   Message : $ERROR_MSG"
  echo ""
  echo -e "${YELLOW}Réponse brute :${NC}"
  echo "$RESPONSE"
  echo ""

  # Aide pour les erreurs courantes
  case "$ERROR_CODE" in
    63016)
      echo -e "${YELLOW}💡 Erreur 63016 = fenêtre de 24h fermée.${NC}"
      echo "   → Envoie un message DEPUIS $TO_PHONE vers le numéro Twilio,"
      echo "     puis réessaie dans la minute."
      ;;
    63007)
      echo -e "${YELLOW}💡 Erreur 63007 = numéro non WhatsApp.${NC}"
      echo "   → Vérifie que $TO_PHONE a bien WhatsApp installé."
      ;;
    21408)
      echo -e "${YELLOW}💡 Erreur 21408 = WhatsApp désactivé sur ton sender.${NC}"
      echo "   → Va dans la console Twilio → Senders et vérifie le statut."
      ;;
    21211)
      echo -e "${YELLOW}💡 Erreur 21211 = numéro invalide.${NC}"
      echo "   → Format requis : +33612345678 (avec + et indicatif pays)."
      ;;
  esac
  exit 1
fi

echo -e "${GREEN}✅ Message envoyé !${NC}"
echo "   SID     : $SID"
echo "   Status  : $STATUS"
echo ""
echo "📲 Vérifie WhatsApp sur le téléphone de destination ($TO_PHONE)."
echo ""
echo -e "${BLUE}💡 Astuce : suis le statut du message dans la console Twilio :${NC}"
echo "   https://console.twilio.com/us1/monitor/logs/sms?frameUrl=/console/sms/logs/$SID"
