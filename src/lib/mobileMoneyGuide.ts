// ============================================================
// LA FICHE MOBILE MONEY — les données, tirées de la même source que l'app
// (src/data/depositMethodsData.ts) pour que la fiche envoyée au client dise
// toujours les mêmes numéros, noms et codes que l'écran de dépôt.
// Deux opérateurs, deux façons chacun : la FLOTTE (transfert vers notre
// numéro) et le RETRAIT (paiement par code marchand).
// ============================================================
import { mtnMerchantInfo, mtnMoneyAccount, omMerchantInfo, orangeMoneyAccount } from '@/data/depositMethodsData';

export type MobileMoneyOperatorKey = 'orange' | 'mtn';

export interface MobileMoneyOperator {
  key: MobileMoneyOperatorKey;
  name: string;
  /** Le nom qui s'affiche sur le téléphone du client à la confirmation. */
  holder: string;
  /** Le numéro, groupé pour la lecture : « 696 10 38 64 ». */
  number: string;
  /** Le numéro international : « +237 696 10 38 64 ». */
  numberIntl: string;
  /** Le code marchand, avec MONTANT à remplacer. */
  merchantCode: string;
  /** Le code USSD du transfert classique, pour la façon « Flotte ». */
  transferUssd: string;
  /** Le nom du PIN, tel que l'opérateur le dit. */
  pinName: string;
  /** Une précision sur le nom affiché, quand il pourrait faire douter (le « 1 » de MTN). */
  holderNote?: string;
}

/**
 * Le plafond usuel d'UNE opération Mobile Money au Cameroun — celui que l'app
 * rappelle sous les retraits (`instructions.notes.*WithdrawalLimit`). Différent
 * de MOBILE_MONEY_TRANSACTION_LIMIT (depositMethodsData), qui borne le montant
 * d'un dépôt déclaré dans le formulaire, flotte comprise.
 */
export const MOBILE_MONEY_USUAL_CAP_XAF = 500_000;

export interface MobileMoneyGuideData {
  operators: MobileMoneyOperator[];
  limitXaf: number;
}

/** « 6 96 10 38 64 » → « 696 10 38 64 » ; « +237 691 000 003 » reste tel quel. */
export function groupPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  const local = digits.startsWith('237') ? digits.slice(3) : digits;
  if (local.length !== 9) return raw.trim();
  return `${local.slice(0, 3)} ${local.slice(3, 5)} ${local.slice(5, 7)} ${local.slice(7, 9)}`;
}

export function intlPhone(raw: string): string {
  return `+237 ${groupPhone(raw)}`;
}

export function mobileMoneyGuideData(): MobileMoneyGuideData {
  return {
    operators: [
      {
        key: 'orange', name: 'Orange Money', holder: orangeMoneyAccount.accountName, number: groupPhone(orangeMoneyAccount.phone), numberIntl: intlPhone(orangeMoneyAccount.phone),
        merchantCode: omMerchantInfo.merchantCode, transferUssd: '#150*1*1#', pinName: 'code PIN Orange Money',
      },
      {
        key: 'mtn', name: 'MTN Mobile Money', holder: mtnMoneyAccount.accountName, number: groupPhone(mtnMoneyAccount.phone), numberIntl: intlPhone(mtnMoneyAccount.phone),
        merchantCode: mtnMerchantInfo.merchantCode, transferUssd: '*126#', pinName: 'code PIN MTN MoMo',
        holderNote: 'Le « 1 » fait partie du nom.',
      },
    ],
    limitXaf: MOBILE_MONEY_USUAL_CAP_XAF,
  };
}

export const MOBILE_MONEY_GUIDE_FILENAME = 'bonzini-coordonnees-mobile-money.pdf';
