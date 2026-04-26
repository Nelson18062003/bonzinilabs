# Relecture libellés FR — Batch 2 (avant pose dans le JSON)

> **À toi** : parcours les sections, signale les libellés à modifier.
> Format de retour le plus simple : **« change [clé] en [nouveau libellé] »**.
> Tout ce qui n'est pas signalé sera posé tel quel.

## Décisions appliquées

| Question | Choix retenu |
|---|---|
| Ton | **Impératif** sur les CTAs et titres ("Choisissez", "Renseignez", "Confirmez"), **neutre** sur les descriptions |
| Promesse de délai | **"rapidement"** (jamais "sous 24h" ni "sous X heures" dans le client) |
| `beneficiary.swiftAgency` | Garde **"SWIFT / IBAN / agence"** (contexte importateur africain → 3 cas réels) |
| Interpolation `{{count}}` | Conservée pour les compteurs de pièces jointes |

---

## 1. `payments` namespace — étape 1 du formulaire (méthode + montant)

### form.* (top-level)

| Clé | Contexte | Libellé FR |
|---|---|---|
| `form.howToReceive` | Sous-titre étape 1, "comment le fournisseur reçoit l'argent" | Comment votre fournisseur reçoit-il l'argent ? |
| `form.rateApplied` | Bandeau au-dessus du calculateur | Taux appliqué |
| `form.byXAF` | Onglet devise (saisie en XAF) | En XAF |
| `form.byRMB` | Onglet devise (saisie en RMB) | En RMB |
| `form.amountDebited` | Label sous l'input quand on saisit en RMB | Montant débité |
| `form.addFunds` | Lien sous l'alerte "solde insuffisant" | Recharger mon compte |
| `form.qrUploadError` | Toast d'erreur d'upload QR | Échec de l'envoi du QR Code |
| `form.continue` | CTA "passer à l'étape suivante" | Continuer |

## 2. `payments.form.beneficiary` — étape 3 du formulaire (le bénéficiaire)

| Clé | Contexte | Libellé FR |
|---|---|---|
| `form.beneficiary.title` | Titre de la section bénéficiaire | À qui voulez-vous payer ? |
| `form.beneficiary.whoPicks` | Titre quand méthode = cash | Qui retire les fonds ? |
| `form.beneficiary.mustPresentQr` | Note méthode = cash | Le bénéficiaire devra présenter un QR Code à l'agent Bonzini. |
| `form.beneficiary.selectOrCreate` | Aide générale | Choisissez un bénéficiaire enregistré ou créez-en un nouveau. |
| `form.beneficiary.existing` | Onglet "déjà enregistré" | Enregistré |
| `form.beneficiary.new` | Onglet "nouveau bénéficiaire" | Nouveau |
| `form.beneficiary.noneRegistered` | Empty state liste vide | Aucun bénéficiaire enregistré pour le moment. |
| `form.beneficiary.createNew` | Bouton dans l'empty state | Créer un bénéficiaire |
| `form.beneficiary.myself` | Option cash : "moi-même" | Moi-même |
| `form.beneficiary.anotherPerson` | Option cash : autre personne | Une autre personne |
| `form.beneficiary.provideDetails` | Description du choix "autre" | Indiquez son nom et son téléphone. |
| `form.beneficiary.fullNameRequired` | Label, version requise | Nom complet (obligatoire) |
| `form.beneficiary.fullName` | Placeholder du champ nom | Nom complet |
| `form.beneficiary.phoneRequired` | Label téléphone obligatoire | Téléphone (obligatoire) |
| `form.beneficiary.phoneLabel` | Label téléphone simple | Téléphone |
| `form.beneficiary.emailOptional` | Label email optionnel | Email (optionnel) |
| `form.beneficiary.addQrCode` | CTA d'upload QR | Ajouter le QR Code |
| `form.beneficiary.orProvideInfo` | Séparateur "ou renseigner les coordonnées" | Ou renseignez ses coordonnées |
| `form.beneficiary.idType` | Label radio group "type d'identifiant" | Type d'identifiant |
| `form.beneficiary.idTypes.qr` | Option radio QR | QR Code |
| `form.beneficiary.idTypes.id` | Option radio ID Alipay/WeChat | Identifiant |
| `form.beneficiary.idTypes.email` | Option radio email | Email |
| `form.beneficiary.idTypes.phone` | Option radio téléphone | Téléphone |
| `form.beneficiary.alipayWechatId` | Placeholder "ID Alipay ou WeChat" | Identifiant Alipay ou WeChat |
| `form.beneficiary.nameRequired` | Label nom obligatoire (virement) | Nom (obligatoire) |
| `form.beneficiary.bankRequired` | Label banque obligatoire | Banque (obligatoire) |
| `form.beneficiary.bankName` | Placeholder banque | Nom de la banque |
| `form.beneficiary.accountRequired` | Label compte obligatoire | Numéro de compte (obligatoire) |
| `form.beneficiary.accountNumber` | Placeholder compte | Numéro de compte |
| `form.beneficiary.swiftAgency` | Label champ SWIFT/IBAN/agence | SWIFT / IBAN / agence (optionnel) |
| `form.beneficiary.additionalInfo` | Placeholder zone notes | Informations complémentaires |
| `form.beneficiary.addLater` | Bouton secondaire "compléter plus tard" | Compléter plus tard |

## 3. `payments.form.confirm` — étape 4 (récapitulatif)

| Clé | Contexte | Libellé FR |
|---|---|---|
| `form.confirm.method` | Ligne récap : méthode | Mode de paiement |
| `form.confirm.beneficiary` | Ligne récap : bénéficiaire | Bénéficiaire |
| `form.confirm.beneficiaryLater` | Mention si bénéficiaire différé | À compléter après création |
| `form.confirm.amountDebited` | Ligne récap : montant total débité | Montant débité |
| `form.confirm.newBalance` | Ligne récap : nouveau solde | Nouveau solde |
| `form.confirm.debitNotice` | Note avant submit | Votre solde sera débité à la confirmation. |

## 4. `payments.detail` — fiche paiement (top-level)

| Clé | Contexte | Libellé FR |
|---|---|---|
| `detail.notFound` | Empty state paiement introuvable | Paiement introuvable |
| `detail.backToPayments` | CTA retour | Retour aux paiements |
| `detail.createdAt` | Ligne info "créé" | Créé |
| `detail.createdOn` | Ligne info "créé le …" | Créé le |
| `detail.processedOn` | Ligne info "traité le" | Traité le |
| `detail.reference` | Ligne info référence | Référence |
| `detail.method` | Ligne info mode | Mode |
| `detail.rateApplied` | Bloc taux dans la hero | Taux appliqué |
| `detail.locked` | Badge "verrouillé" sur les paiements en cours/finalisés | Verrouillé |
| `detail.edit` | Bouton "modifier" | Modifier |
| `detail.addInfo` | CTA quand info manquante | Ajouter les infos |
| `detail.downloadReceipt` | Aria-label icône PDF | Télécharger le reçu |
| `detail.downloadReceiptPDF` | CTA "télécharger reçu" version cash | Télécharger le reçu PDF |
| `detail.downloadQrCode` | CTA "télécharger QR" dans le drawer | Télécharger le QR Code |
| `detail.qrCodeBeneficiary` | Titre du drawer fullscreen QR | QR Code du bénéficiaire |
| `detail.tapToEnlarge` | Hint sous QR | Appuyer pour agrandir |
| `detail.beneficiary` | Titre section bénéficiaire | Bénéficiaire |
| `detail.missingInfo` | Titre alerte info manquante | Informations manquantes |
| `detail.addBeneficiaryPrompt` | Description sous l'alerte | Ajoutez les coordonnées du bénéficiaire pour que Bonzini puisse régler votre paiement. |
| `detail.documents` | Titre section documents | Documents |
| `detail.noDocuments` | Empty state documents | Aucun document pour le moment. |
| `detail.bonziniProofs` | Titre sous-section preuves Bonzini, avec compteur | Preuves Bonzini ({{count}}) |
| `detail.bonziniProofsDescription` | Description sous-section | Justificatifs envoyés par Bonzini après le règlement de votre fournisseur. |
| `detail.myInstructions` | Titre sous-section pièces client, avec compteur | Mes pièces jointes ({{count}}) |
| `detail.myInstructionsDescription` | Description sous-section | Pièces que vous avez ajoutées pour aider Bonzini à régler votre fournisseur. |
| `detail.noMoreModifications` | Note "plus de modif possibles" | Vous ne pouvez plus modifier ce paiement. |
| `detail.readyForProcessing` | Titre carte "prêt à payer" | Prêt à être traité |
| `detail.bonziniWillProcess` | Description sous le titre "prêt à payer" | Bonzini va régler votre fournisseur rapidement. |
| `detail.rejectionReason` | Titre carte rejet | Motif du rejet |
| `detail.bonziniMessage` | Titre carte commentaire admin visible client | Message de Bonzini |
| `detail.historyAndDetails` | Titre accordéon timeline | Historique & détails |
| `detail.cashPayment` | Texte hero méthode cash | Paiement en cash |
| `detail.cashQrWillBeGenerated` | Description avant génération QR cash | Un QR Code sera généré dès la validation. |
| `detail.qrScannedAtOffice` | Card "QR scanné" cash | QR scanné au bureau |
| `detail.processingAtOffice` | Description sous la card | Bonzini prépare votre paiement. |
| `detail.cashPaymentCompleted` | Card "cash terminé" | Paiement cash effectué |
| `detail.signatureRecordedOn` | Préfixe avant la date de signature | Signature enregistrée le |
| `detail.signedBy` | Préfixe nom signataire | Signé par |
| `detail.beneficiarySignature` | Label image signature | Signature du bénéficiaire |

## 5. `payments.detail.fields` — champs en lecture (CopyableField)

| Clé | Contexte | Libellé FR |
|---|---|---|
| `detail.fields.name` | Label "Nom" | Nom |
| `detail.fields.phone` | Label "Téléphone" | Téléphone |
| `detail.fields.email` | Label "Email" | Email |
| `detail.fields.bank` | Label "Banque" | Banque |
| `detail.fields.accountNumber` | Label "Numéro de compte" | Numéro de compte |
| `detail.fields.notes` | Label "Notes" | Notes |
| `detail.fields.beneficiaryName` | Aria-label "Nom du bénéficiaire" | Nom du bénéficiaire |
| `detail.fields.beneficiaryPhone` | Aria-label "Téléphone du bénéficiaire" | Téléphone du bénéficiaire |
| `detail.fields.beneficiaryEmail` | Aria-label "Email du bénéficiaire" | Email du bénéficiaire |

## 6. `payments.detail.form` — dialog d'édition bénéficiaire (vue client)

| Clé | Contexte | Libellé FR |
|---|---|---|
| `detail.form.provideAtLeastOne` | Hint Alipay/WeChat | Fournissez au moins un canal de paiement. |
| `detail.form.provideBankInfo` | Hint virement | Renseignez les coordonnées bancaires complètes. |
| `detail.form.qrPreview` | Alt aperçu image QR | Aperçu du QR Code |
| `detail.form.qrBeneficiary` | Alt image QR bénéficiaire | QR Code du bénéficiaire |
| `detail.form.clickToReplace` | Hint "remplacer" sous l'image QR | Touchez pour remplacer |
| `detail.form.addQrCode` | CTA upload QR | Ajouter un QR Code |
| `detail.form.ofBeneficiary` | Hint sous CTA | du bénéficiaire |
| `detail.form.or` | Séparateur entre QR et coordonnées | ou |
| `detail.form.phoneNumber` | Label téléphone | Numéro de téléphone |
| `detail.form.emailOptional` | Label email | Email (optionnel) |
| `detail.form.beneficiaryNameOptional` | Label nom (optionnel pour Alipay) | Nom du bénéficiaire (optionnel) |
| `detail.form.beneficiaryNameRequired` | Label nom (obligatoire pour virement) | Nom du bénéficiaire (obligatoire) |
| `detail.form.fullName` | Placeholder nom | Nom complet |
| `detail.form.bankNameRequired` | Label banque obligatoire | Banque (obligatoire) |
| `detail.form.accountNumberRequired` | Label compte obligatoire | Numéro de compte (obligatoire) |
| `detail.form.bankAccountNumber` | Placeholder compte | Numéro de compte bancaire |
| `detail.form.accountHolderName` | Placeholder titulaire | Nom du titulaire du compte |
| `detail.form.commentOptional` | Label commentaire | Commentaire (optionnel) |
| `detail.form.additionalInstructions` | Placeholder zone commentaire | Instructions supplémentaires |
| `detail.form.noInfoRequired` | Hint méthode cash | Aucune information à fournir. |
| `detail.form.cashQrAutoGenerated` | Hint méthode cash, sous le précédent | Un QR Code sera généré dès la confirmation. |

## 7. `payments.detail.validation` — messages d'erreur du dialog

| Clé | Contexte | Libellé FR |
|---|---|---|
| `detail.validation.atLeastOneContact` | Erreur Alipay/WeChat | Fournissez au moins un canal (QR Code, téléphone ou email). |
| `detail.validation.nameRequired` | Erreur virement | Le nom du bénéficiaire est obligatoire. |
| `detail.validation.bankNameRequired` | Erreur virement | La banque est obligatoire. |
| `detail.validation.bankAccountRequired` | Erreur virement | Le numéro de compte est obligatoire. |

## 8. `payments.detail.dialog` — labels du dialog d'édition

| Clé | Contexte | Libellé FR |
|---|---|---|
| `detail.dialog.addTitle` | Titre dialog : ajouter | Ajouter les informations du bénéficiaire |
| `detail.dialog.editTitle` | Titre dialog : modifier | Modifier les informations du bénéficiaire |
| `detail.dialog.alipayDescription` | Description Alipay | Indiquez au moins un canal pour que Bonzini puisse régler votre fournisseur Alipay. |
| `detail.dialog.wechatDescription` | Description WeChat | Indiquez au moins un canal pour que Bonzini puisse régler votre fournisseur WeChat. |
| `detail.dialog.bankTransferDescription` | Description virement | Renseignez les coordonnées bancaires du bénéficiaire. |
| `detail.dialog.cashDescription` | Description cash | Aucune info à fournir : un QR Code sera généré pour le retrait au bureau. |
| `detail.dialog.save` | CTA primaire | Enregistrer |
| `detail.dialog.completeLater` | CTA secondaire | Compléter plus tard |
| `detail.dialog.close` | CTA fermer (méthode cash) | Fermer |

## 9. `payments.detail.toast` — messages toast

| Clé | Contexte | Libellé FR |
|---|---|---|
| `detail.toast.beneficiarySaved` | Succès enregistrement | Informations enregistrées. |
| `detail.toast.saveFailed` | Erreur enregistrement | Échec de l'enregistrement. |
| `detail.toast.completeLater` | Info "compléter plus tard" | Vous pourrez compléter ces informations plus tard. |
| `detail.toast.receiptDownloaded` | Succès download PDF | Reçu téléchargé. |
| `detail.toast.receiptError` | Erreur download PDF | Échec du téléchargement. |

## 10. `common` namespace — AdjustmentDrawer & MobileTabBar (12 clés)

| Clé | Contexte | Libellé FR |
|---|---|---|
| `common.amountXAF` | Label montant XAF | Montant en XAF |
| `common.manualDebit` | Titre du drawer "débit manuel" | Débit manuel |
| `common.manualCredit` | Titre du drawer "crédit manuel" | Crédit manuel |
| `common.insufficientBalance` | Erreur solde insuffisant | Solde insuffisant |
| `common.newBalance` | Label "nouveau solde" | Nouveau solde |
| `common.reason` | Label "motif" | Motif |
| `common.reasonRecordedNote` | Note sous le champ motif | Le motif sera consigné dans l'historique. |
| `common.adjustmentReasonPlaceholder` | Placeholder du champ motif | Ex : régularisation, geste commercial… |
| `common.actionCannotBeUndone` | Note d'avertissement | Cette action est irréversible. |
| `common.processing` | Bouton en cours | En cours… |
| `common.debit` | Label catégorie "débit" | Débit |
| `common.home` | Tab bar mobile : accueil | Accueil |

## 11. `agent` namespace — cash-agent (3 clés, snake_case legacy)

| Clé | Contexte | Libellé FR |
|---|---|---|
| `agent.signed_by` | Préfixe signataire | Signé par |
| `agent.beneficiary_signature` | Label image signature | Signature du bénéficiaire |
| `agent.qr_already_scanned_continue` | Confirmation re-scan | QR déjà scanné — continuer ? |

## 12. `auth` namespace (1 clé)

| Clé | Contexte | Libellé FR |
|---|---|---|
| `auth.resetPassword.linkExpired` | Erreur lien expiré | Le lien de réinitialisation a expiré. Demandez-en un nouveau. |

---

## Récap des choix sensibles

Voici les libellés où j'ai pris une décision active (au-delà de la traduction littérale) :

1. `form.beneficiary.title` → **« À qui voulez-vous payer ? »** au lieu de « Informations bénéficiaire » (plus client-friendly).
2. `detail.bonziniWillProcess` → **« Bonzini va régler votre fournisseur rapidement. »** (suit ton choix sur "rapidement").
3. `detail.addBeneficiaryPrompt` → mention « pour que Bonzini puisse **régler** votre paiement » (verbe métier, pas "transférer").
4. `form.beneficiary.swiftAgency` → **« SWIFT / IBAN / agence (optionnel) »** (les 3 conservés).
5. `detail.bonziniProofs` / `detail.myInstructions` → format **« Titre ({{count}}) »** avec compteur en parenthèses.
6. `form.beneficiary.mustPresentQr` → précision « **agent Bonzini** » au lieu de « agent » seul (clarté).

---

## Comment me retourner les corrections

Format conseillé, n'importe lequel marche :

```
change `form.beneficiary.title` en "Vers qui paye-t-on ?"
change `detail.bonziniWillProcess` en "Votre paiement est en cours."
ok pour le reste
```

Ou simplement « tout est OK » et je passe à la pose en JSON.
