// ============================================================
// LE RELEVÉ DE COMPTE — lecture des données et fabrication du fichier.
//
// Les écrans lisent les écritures de la période (grand livre) ; ici on va
// chercher, pour chacune, son PAIEMENT (taux, montant ¥, mode, bénéficiaire,
// statut) ou son DÉPÔT (mode, banque), puis on fabrique le PDF.
// `db` : le client Supabase de l'écran — `supabaseAdmin` côté équipe,
// `supabase` côté client (RLS : le client ne lit que ses propres lignes).
// ============================================================
import { createElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { AccountStatementPDF } from '@/lib/pdf/templates/AccountStatementPDF';
import {
  buildStatementDocument, statementFileName,
  type StatementClient, type StatementDetails, type StatementEntry, type StatementLang,
} from '@/lib/accountStatement';

type Db = SupabaseClient<Database>;

/** Les requêtes « in (…) » restent courtes : l'URL a une longueur maximale. */
const CHUNK = 150;

function chunks<T>(list: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += CHUNK) out.push(list.slice(i, i + CHUNK));
  return out;
}

/** Le paiement ou le dépôt derrière chaque écriture. */
export async function fetchStatementDetails(db: Db, entries: StatementEntry[]): Promise<StatementDetails> {
  const paymentIds = [...new Set(entries.filter((e) => e.referenceType === 'payment' && e.referenceId).map((e) => e.referenceId as string))];
  const depositIds = [...new Set(entries.filter((e) => e.referenceType === 'deposit' && e.referenceId).map((e) => e.referenceId as string))];
  const details: StatementDetails = { payments: {}, deposits: {} };

  await Promise.all([
    ...chunks(paymentIds).map(async (ids) => {
      const { data, error } = await db
        .from('payments')
        .select('id, reference, amount_rmb, exchange_rate, method, beneficiary_name, cash_beneficiary_first_name, cash_beneficiary_last_name, status')
        .in('id', ids);
      if (error) throw error;
      for (const p of data ?? []) {
        const cashName = [p.cash_beneficiary_first_name, p.cash_beneficiary_last_name].filter(Boolean).join(' ');
        details.payments[p.id] = {
          reference: p.reference,
          amountRmb: p.amount_rmb == null ? null : Number(p.amount_rmb),
          rate: p.exchange_rate == null ? null : Math.round(Number(p.exchange_rate)),
          method: p.method,
          beneficiary: p.beneficiary_name || cashName || null,
          status: p.status,
        };
      }
    }),
    ...chunks(depositIds).map(async (ids) => {
      const { data, error } = await db.from('deposits').select('id, reference, method, bank_name').in('id', ids);
      if (error) throw error;
      for (const d of data ?? []) details.deposits[d.id] = { reference: d.reference, method: d.method, bank: d.bank_name };
    }),
  ]);
  return details;
}

/** Une opération au format de l'app client (useWallet) → une écriture du relevé. */
export function entryFromWalletOp(op: {
  id: string; operation_type: string; amount_xaf: number; balance_before: number; balance_after: number;
  reference_id: string | null; reference_type: string | null; description: string | null; created_at: string; is_test?: boolean;
}): StatementEntry {
  return {
    id: op.id,
    entryType: op.operation_type,
    amountXAF: op.amount_xaf,
    balanceBefore: op.balance_before,
    balanceAfter: op.balance_after,
    referenceType: op.reference_type,
    referenceId: op.reference_id,
    description: op.description,
    createdAt: op.created_at,
    isTest: op.is_test,
  };
}

export interface DownloadStatementInput {
  db: Db;
  lang: StatementLang;
  client: StatementClient;
  entries: StatementEntry[];
  range: { from: Date; to: Date } | null;
  /** Solde après la dernière écriture avant la période (pour une période vide). */
  balanceBeforeRange?: number | null;
  now?: Date;
}

/** Tout le relevé : détails, document, PDF. Renvoie le fichier (pour le télécharger ou le partager). */
export async function buildAccountStatementFile({ db, lang, client, entries, range, balanceBeforeRange, now = new Date() }: DownloadStatementInput): Promise<File> {
  const details = await fetchStatementDetails(db, entries);
  const doc = buildStatementDocument({ lang, client, entries, details, range, balanceBeforeRange, now });
  const el = createElement(AccountStatementPDF, { doc }) as unknown as Parameters<typeof pdf>[0];
  const blob = await pdf(el).toBlob();
  return new File([blob], statementFileName(doc, range, now), { type: 'application/pdf' });
}

/** Télécharge le relevé (dans l'app BONZINI HQ, le téléchargement passe par la feuille de partage). */
export async function downloadAccountStatement(input: DownloadStatementInput): Promise<void> {
  const file = await buildAccountStatementFile(input);
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
