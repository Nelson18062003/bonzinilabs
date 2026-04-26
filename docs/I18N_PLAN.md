# i18n strategy plan (batches 2–3)

> Plan validated before touching any JSON file.
> **Generated** : 2026-04-26 · **Baseline** : 84.36% coverage, 147 missing keys per language.

## TL;DR

Three real groups of work, no architectural rewrite needed:

| Namespace | Missing FR/EN/ZH | Strategy | Owner of fix |
|---|---:|---|---|
| `payments` | **131** (form.* 46 + detail.* 85) | Add nested keys matching current code shape | Batch 2 (FR), Batch 3 (EN+ZH) |
| `common` | **12** (AdjustmentDrawer, MobileTabBar) | Add flat keys to common namespace | Batch 2 (FR), Batch 3 (EN+ZH) |
| `agent` | **3** (cash-agent details) | Add flat snake_case to agent namespace | Batch 2 (FR), Batch 3 (EN+ZH) |
| `auth` | **1** (resetPassword.linkExpired) | Add nested key to auth namespace | Batch 2 (FR), Batch 3 (EN+ZH) |

**Total to add per language: 147 keys × 3 languages = 441 entries.**

The previous batch's audit also flagged 74 "common" keys that were false positives — they live in `agent.json` and the code reaches them via `useLanguage()` which proxies to `useTranslation('agent')` (`src/contexts/LanguageContext.tsx`). The auditor is now aware of that indirection, so the count dropped from 206 → 147.

## Naming convention decision

| Section | Existing convention | Decision |
|---|---|---|
| `payments.form.*` | camelCase, nested | **Keep** — `form.beneficiary.title`, `form.beneficiary.idTypes.qr`, etc. |
| `payments.detail.*` | camelCase, nested 2–3 levels | **Keep** — `detail.fields.name`, `detail.form.qrPreview`, `detail.dialog.editTitle` |
| `common.*` | camelCase, flat | **Keep** — `actionCannotBeUndone`, `manualDebit`, etc. |
| `agent.*` | snake_case, flat | **Keep** — `agent_login`, `signed_by` (matches existing 78 entries) |
| `auth.*` | camelCase, nested | **Keep** — `resetPassword.linkExpired` |

Rationale: every section is internally consistent; touching the convention would force code changes everywhere for no user-visible win. Better to standardize next time we open one of these files for a real feature.

> **One-off carve-out** : the snake_case in `agent.*` is a leftover from the legacy `LanguageContext` cash-agent module. We migrate it to camelCase **only** when (a) we touch the cash-agent screens for a real feature, OR (b) we open Batch 9 (admin i18n migration). For now: keep snake_case to ship without churn.

## Final shape — `payments.json`

```json
{
  "title": "Paiements",
  "subtitle": "...",
  "newPayment": "Nouveau paiement",
  "noPayments": "Aucun paiement",
  "method": { ... },
  "status": { ... },
  "statusLabels": { ... },
  "statusConfig": { ... },
  "rejectionReasons": { ... },
  "success": "...",

  "form": {
    "steps": {
      "method": "Mode",
      "amount": "Montant",
      "beneficiary": "Bénéficiaire",
      "confirm": "Résumé"
    },
    "methods": {
      "alipay": { "label": "Alipay", "desc": "Paiement via Alipay" },
      "wechat": { "label": "WeChat Pay", "desc": "Paiement via WeChat" },
      "bank_transfer": { "label": "Virement bancaire", "desc": "Vers compte bancaire chinois" },
      "cash": { "label": "Cash", "desc": "Retrait au bureau Bonzini" }
    },
    "chooseMethod": "Choisissez un mode de paiement",
    "howToReceive": "Comment votre fournisseur reçoit-il l'argent ?",   // NEW
    "rateApplied": "Taux appliqué",                                     // NEW
    "byXAF": "En XAF",                                                  // NEW
    "byRMB": "En RMB",                                                  // NEW
    "youSend": "Vous payez",
    "supplierReceives": "Fournisseur reçoit",
    "amountDebited": "Montant débité",                                  // NEW
    "balance": "Solde",
    "addFunds": "Recharger mon compte",                                 // NEW
    "insufficientBalance": "Solde insuffisant",
    "amountTooHigh": "...",
    "rate": "Taux",
    "qrUploadError": "Échec de l'envoi du QR Code",                     // NEW
    "continue": "Continuer",                                            // NEW
    "submit": "Confirmer le paiement",
    "submitting": "Envoi en cours...",
    "success": "...",
    "error": "...",
    "summary": "Récapitulatif",

    "beneficiary": {                                                    // NEW (entire block)
      "title": "Informations bénéficiaire",
      "whoPicks": "Qui retire les fonds ?",
      "mustPresentQr": "Le bénéficiaire devra présenter un QR Code à l'agent.",
      "selectOrCreate": "Choisissez un bénéficiaire enregistré ou créez-en un nouveau.",
      "existing": "Enregistré",
      "new": "Nouveau",
      "noneRegistered": "Aucun bénéficiaire enregistré.",
      "createNew": "Créer un bénéficiaire",
      "myself": "Moi-même",
      "anotherPerson": "Une autre personne",
      "provideDetails": "Indiquez son nom et téléphone",
      "fullNameRequired": "Nom complet (obligatoire)",
      "fullName": "Nom complet",
      "phoneRequired": "Téléphone (obligatoire)",
      "phoneLabel": "Téléphone",
      "emailOptional": "Email (optionnel)",
      "addQrCode": "Ajouter le QR Code",
      "orProvideInfo": "Ou renseignez ses coordonnées",
      "idType": "Type d'identifiant",
      "idTypes": {
        "qr": "QR Code",
        "id": "Identifiant",
        "email": "Email",
        "phone": "Téléphone"
      },
      "alipayWechatId": "Identifiant Alipay ou WeChat",
      "nameRequired": "Nom (obligatoire)",
      "bankRequired": "Banque (obligatoire)",
      "bankName": "Nom de la banque",
      "accountRequired": "Numéro de compte (obligatoire)",
      "accountNumber": "Numéro de compte",
      "swiftAgency": "SWIFT / IBAN / agence (optionnel)",
      "additionalInfo": "Informations complémentaires",
      "addLater": "Compléter plus tard"
    },

    "confirm": {                                                        // NEW (entire block)
      "method": "Mode de paiement",
      "beneficiary": "Bénéficiaire",
      "beneficiaryLater": "À compléter après création",
      "amountDebited": "Montant débité",
      "newBalance": "Nouveau solde",
      "debitNotice": "Votre solde sera débité immédiatement après confirmation."
    }
  },

  "detail": {
    "title": "Détail du paiement",
    "notFound": "Paiement introuvable",                                 // NEW
    "backToPayments": "Retour aux paiements",                           // NEW
    "createdAt": "Créé",                                                // NEW
    "createdOn": "Créé le",                                             // NEW
    "processedOn": "Traité le",                                         // NEW
    "reference": "Référence",                                           // NEW
    "method": "Mode",                                                   // NEW
    "rateApplied": "Taux appliqué",                                     // NEW
    "locked": "Verrouillé",                                             // NEW
    "edit": "Modifier",                                                 // NEW
    "addInfo": "Ajouter les infos",                                     // NEW
    "downloadReceipt": "Télécharger le reçu",                           // NEW
    "downloadReceiptPDF": "Télécharger le reçu PDF",                    // NEW
    "downloadQrCode": "Télécharger le QR Code",                         // NEW
    "qrCodeBeneficiary": "QR Code du bénéficiaire",                     // NEW
    "tapToEnlarge": "Appuyer pour agrandir",                            // NEW
    "beneficiary": "Bénéficiaire",                                      // NEW
    "missingInfo": "Informations manquantes",                           // NEW
    "addBeneficiaryPrompt": "Ajoutez les coordonnées du bénéficiaire pour que Bonzini puisse traiter votre paiement.", // NEW
    "documents": "Documents",                                           // NEW
    "noDocuments": "Aucun document pour le moment",                     // NEW
    "bonziniProofs": "Preuves Bonzini ({{count}})",                     // NEW (interpolated)
    "bonziniProofsDescription": "Justificatifs envoyés par Bonzini après traitement.", // NEW
    "myInstructions": "Mes pièces jointes ({{count}})",                 // NEW (interpolated)
    "myInstructionsDescription": "Pièces que vous avez ajoutées pour aider Bonzini.", // NEW
    "noMoreModifications": "Plus de modifications possibles",           // NEW
    "readyForProcessing": "Prêt à être traité",                         // NEW
    "bonziniWillProcess": "Bonzini va traiter votre paiement sous 24h.", // NEW
    "rejectionReason": "Motif du rejet",                                // NEW
    "bonziniMessage": "Message de Bonzini",                             // NEW
    "historyAndDetails": "Historique & détails",                        // NEW
    "cashPayment": "Paiement en cash",                                  // NEW
    "cashQrWillBeGenerated": "Un QR sera généré une fois le paiement validé.", // NEW
    "qrScannedAtOffice": "QR scanné au bureau",                         // NEW
    "processingAtOffice": "Bonzini prépare votre paiement.",            // NEW
    "cashPaymentCompleted": "Paiement cash effectué",                   // NEW
    "signatureRecordedOn": "Signature enregistrée le",                  // NEW
    "signedBy": "Signé par",                                            // NEW
    "beneficiarySignature": "Signature du bénéficiaire",                // NEW

    "fields": {                                                         // NEW (entire block)
      "name": "Nom",
      "phone": "Téléphone",
      "email": "Email",
      "bank": "Banque",
      "accountNumber": "Numéro de compte",
      "notes": "Notes",
      "beneficiaryName": "Nom du bénéficiaire",
      "beneficiaryPhone": "Téléphone du bénéficiaire",
      "beneficiaryEmail": "Email du bénéficiaire"
    },

    "form": {                                                           // NEW (entire block — edit dialog)
      "provideAtLeastOne": "Fournissez au moins un élément.",
      "provideBankInfo": "Renseignez les coordonnées bancaires complètes.",
      "qrPreview": "Aperçu du QR Code",
      "qrBeneficiary": "QR Code du bénéficiaire",
      "clickToReplace": "Toucher pour remplacer",
      "addQrCode": "Ajouter un QR Code",
      "ofBeneficiary": "du bénéficiaire",
      "or": "ou",
      "phoneNumber": "Numéro de téléphone",
      "emailOptional": "Email (optionnel)",
      "beneficiaryNameOptional": "Nom du bénéficiaire (optionnel)",
      "beneficiaryNameRequired": "Nom du bénéficiaire (obligatoire)",
      "fullName": "Nom complet",
      "bankNameRequired": "Banque (obligatoire)",
      "accountNumberRequired": "Numéro de compte (obligatoire)",
      "bankAccountNumber": "Numéro de compte bancaire",
      "accountHolderName": "Nom du titulaire du compte",
      "commentOptional": "Commentaire (optionnel)",
      "additionalInstructions": "Instructions supplémentaires",
      "noInfoRequired": "Aucune information requise",
      "cashQrAutoGenerated": "Le QR sera généré automatiquement à la confirmation."
    },

    "validation": {                                                     // NEW (entire block)
      "atLeastOneContact": "Fournissez au moins un canal (QR, téléphone ou email).",
      "nameRequired": "Le nom est obligatoire.",
      "bankNameRequired": "Le nom de la banque est obligatoire.",
      "bankAccountRequired": "Le numéro de compte est obligatoire."
    },

    "dialog": {                                                         // NEW (entire block)
      "addTitle": "Ajouter les informations bénéficiaire",
      "editTitle": "Modifier les informations bénéficiaire",
      "alipayDescription": "Indiquez au moins un canal pour que Bonzini puisse régler votre fournisseur Alipay.",
      "wechatDescription": "Indiquez au moins un canal pour que Bonzini puisse régler votre fournisseur WeChat.",
      "bankTransferDescription": "Renseignez le compte bancaire du bénéficiaire.",
      "cashDescription": "Pas d'information à fournir : un QR sera généré pour le retrait au bureau.",
      "save": "Enregistrer",
      "completeLater": "Compléter plus tard",
      "close": "Fermer"
    },

    "toast": {                                                          // NEW (entire block)
      "beneficiarySaved": "Informations enregistrées.",
      "saveFailed": "Échec de la sauvegarde.",
      "completeLater": "Vous pourrez compléter ces informations plus tard.",
      "receiptDownloaded": "Reçu téléchargé.",
      "receiptError": "Échec du téléchargement du reçu."
    }
  }
}
```

(All blocks marked `// NEW` are the missing keys — others already exist.)

## Final shape — `common.json` (12 missing keys to add flat)

```json
{
  // ... existing keys preserved ...

  "amountXAF": "Montant en XAF",
  "manualDebit": "Débit manuel",
  "manualCredit": "Crédit manuel",
  "insufficientBalance": "Solde insuffisant",
  "newBalance": "Nouveau solde",
  "reason": "Motif",
  "reasonRecordedNote": "Le motif sera consigné dans l'historique.",
  "adjustmentReasonPlaceholder": "Ex : régularisation, geste commercial…",
  "actionCannotBeUndone": "Cette action est irréversible.",
  "processing": "En cours…",
  "debit": "Débit",
  "home": "Accueil"
}
```

## Final shape — `agent.json` (3 missing keys, snake_case to match existing)

```json
{
  // ... existing keys preserved ...

  "signed_by": "Signé par",
  "beneficiary_signature": "Signature du bénéficiaire",
  "qr_already_scanned_continue": "QR déjà scanné — continuer ?"
}
```

## Final shape — `auth.json` (1 missing key)

```json
{
  // ... existing keys preserved ...

  "resetPassword": {
    // ... existing nested keys ...
    "linkExpired": "Le lien de réinitialisation a expiré. Demandez-en un nouveau."
  }
}
```

## Translation strategy for EN and ZH (Batch 3)

- **EN** : produced from FR validated copy. Direct, professional fintech tone — match the wording of `landing.json`/`auth.json` EN already shipping.
- **ZH (Simplified)** : machine-draft from EN, manual review of finance terms (Alipay 支付宝, WeChat Pay 微信支付, transfer 转账, beneficiary 收款人). Mark with `[ZH-DRAFT]` comments any term that needs native validation; ship as soon as possible, refine after.

## Decisions you (product owner) must validate before Batch 2

1. **Naming convention frozen for now** — agree to keep snake_case in `agent.*` legacy and camelCase-nested elsewhere? *(my recommendation: yes, refactor later in Batch 9)*
2. **`beneficiary.swiftAgency` label** — the code prompts SWIFT / IBAN / agency. Keep all three? Or simplify to "SWIFT / IBAN" only (most fournisseurs)? *(my recommendation: keep all three for flexibility)*
3. **Tone** — the current FR JSON sometimes uses imperative ("Choisissez un mode") and sometimes infinitive. I lean towards **imperative direct** ("Choisissez", "Renseignez", "Confirmez") for clarity. Validate?
4. **"Bonzini va traiter votre paiement sous 24h"** — keep the 24h promise in copy? Or make it generic ("rapidement") to avoid SLA? *(my recommendation: keep 24h, it's already in the landing page; matches CLAUDE.md frontend rule)*
5. **`detail.bonziniProofs` interpolation** — the count is shown as `({{count}})`. Validate? Or remove?
6. **Cash-agent module migration** — defer to Batch 9, OR include the snake_case → camelCase rename in this batch? *(my recommendation: defer, scope creep)*

## Risks

- **Risk A** — adding 441 entries by hand may introduce typos or inconsistent French. *Mitigation* : the auditor in CI will catch missing keys; for tone consistency we'll review the FR file as a whole after Batch 2 is in.
- **Risk B** — the `MISSING (NEW)` keys above were drafted from reading the code. Some labels may be slightly off-tone for the user. *Mitigation* : Batch 2 includes a manual visual test on real screens; you can request label changes before Batch 3 (EN/ZH) is shipped.
- **Risk C** — interpolated keys (`{{count}}`) require the i18next interpolation feature. Already enabled in `src/i18n/index.ts:95-97`. No code change needed.

## Done when

- `npm run check:i18n` exits 0 in all 3 languages.
- Manual visual test on `NewPaymentPage` and `PaymentDetailPage` shows zero raw key in the UI.
- All `t()` calls return human-readable French text.
