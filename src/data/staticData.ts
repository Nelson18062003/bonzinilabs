// Static data that doesn't change - deposit/payment method instructions

import { DepositMethodInfo, PaymentMethodInfo } from '@/types';

// Deposit Methods Info
export const depositMethodsInfo: DepositMethodInfo[] = [
  {
    method: 'BANK_TRANSFER',
    label: 'Virement bancaire',
    icon: 'Building2',
    description: 'Effectuez un virement vers notre compte',
    instructions: [
      'Connectez-vous à votre application bancaire',
      'Effectuez un virement vers le compte indiqué',
      'Utilisez votre ID client comme référence',
      'Téléchargez le reçu de virement',
    ],
    accountInfo: {
      bankName: 'Afriland First Bank',
      accountNumber: '10005 00001 12345678901 23',
      accountName: 'BONZINI SARL',
    },
  },
  {
    method: 'CASH_DEPOSIT',
    label: 'Dépôt cash en banque',
    icon: 'Banknote',
    description: 'Déposez de l\'argent en agence bancaire',
    instructions: [
      'Rendez-vous dans une agence Afriland First Bank',
      'Effectuez un dépôt sur le compte Bonzini',
      'Mentionnez votre ID client',
      'Conservez et téléchargez le bordereau',
    ],
    accountInfo: {
      bankName: 'Afriland First Bank',
      accountNumber: '10005 00001 12345678901 23',
      accountName: 'BONZINI SARL',
    },
  },
  {
    method: 'AGENCY_DEPOSIT',
    label: 'Dépôt en agence Bonzini',
    icon: 'Store',
    description: 'Déposez directement dans nos locaux',
    instructions: [
      'Rendez-vous à notre agence',
      'Présentez votre pièce d\'identité',
      'Effectuez votre dépôt',
      'Recevez votre reçu',
    ],
    accountInfo: {
      address: 'Rue de la Joie, Douala, Cameroun',
    },
  },
  {
    method: 'ORANGE_MONEY_TRANSFER',
    label: 'Orange Money - Transfert',
    icon: 'Smartphone',
    description: 'Transférez via Orange Money',
    instructions: [
      'Composez #150*1*1#',
      'Entrez le numéro: 691 000 001',
      'Saisissez le montant',
      'Confirmez avec votre code PIN',
      'Téléchargez le SMS de confirmation',
    ],
    accountInfo: {
      phone: '691 000 001',
      accountName: 'BONZINI SARL',
    },
  },
  {
    method: 'ORANGE_MONEY_WITHDRAWAL',
    label: 'Orange Money - Retrait code',
    icon: 'KeyRound',
    description: 'Générez un code de retrait',
    instructions: [
      'Composez #150*1*2#',
      'Générez un code de retrait',
      'Envoyez le code au: 691 000 002',
      'Attendez la confirmation',
    ],
    accountInfo: {
      phone: '691 000 002',
    },
  },
  {
    method: 'MTN_MONEY_TRANSFER',
    label: 'MTN Money - Transfert',
    icon: 'Smartphone',
    description: 'Transférez via MTN Money',
    instructions: [
      'Composez *126#',
      'Sélectionnez "Transfert d\'argent"',
      'Entrez le numéro: 670 000 001',
      'Saisissez le montant',
      'Confirmez avec votre code PIN',
    ],
    accountInfo: {
      phone: '670 000 001',
      accountName: 'BONZINI SARL',
    },
  },
  {
    method: 'MTN_MONEY_WITHDRAWAL',
    label: 'MTN Money - Retrait code',
    icon: 'KeyRound',
    description: 'Générez un code de retrait MTN',
    instructions: [
      'Composez *126#',
      'Sélectionnez "Retrait sans carte"',
      'Générez un code',
      'Envoyez le code au: 670 000 002',
    ],
    accountInfo: {
      phone: '670 000 002',
    },
  },
  {
    method: 'WAVE',
    label: 'Wave',
    icon: 'Waves',
    description: 'Transférez via Wave',
    instructions: [
      'Ouvrez l\'application Wave',
      'Sélectionnez "Envoyer"',
      'Entrez le numéro: 691 000 003',
      'Saisissez le montant',
      'Confirmez le transfert',
    ],
    accountInfo: {
      phone: '691 000 003',
      accountName: 'BONZINI SARL',
    },
  },
];

// Payment Methods Info
export const paymentMethodsInfo: PaymentMethodInfo[] = [
  {
    method: 'ALIPAY',
    label: 'Alipay',
    icon: 'QrCode',
    description: 'Paiement via Alipay',
    requiredFields: ['qrCode', 'accountNumber', 'chineseName'],
  },
  {
    method: 'WECHAT',
    label: 'WeChat Pay',
    icon: 'MessageCircle',
    description: 'Paiement via WeChat',
    requiredFields: ['qrCode', 'accountNumber', 'chineseName'],
  },
  {
    method: 'BANK_TRANSFER',
    label: 'Virement bancaire',
    icon: 'Building2',
    description: 'Virement vers compte chinois',
    requiredFields: ['bankName', 'bankAccountNumber', 'bankAccountName'],
  },
  {
    method: 'CASH_COUNTER',
    label: 'Cash Counter',
    icon: 'Banknote',
    description: 'Retrait au comptoir',
    requiredFields: ['chineseName', 'idNumber', 'phone'],
  },
];
