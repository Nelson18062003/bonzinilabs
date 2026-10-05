/**
 * Trésorerie — libellés humains et liens entre objets.
 *
 * Le grand livre comparait ses natures et ses origines à des valeurs qui
 * n'existent pas en base (`usdt_purchases` au pluriel, alors que l'énumération
 * dit `usdt_purchase`) : l'écran affichait « usdt purchase debit xaf » et le
 * lien vers l'opération d'origine n'apparaissait jamais. Les valeurs ci-dessous
 * sont celles de `treasury_ledger_entry_kind` et `treasury_ledger_source_table`.
 */
import type { Database } from '@/integrations/supabase/types';
import { treasuryPaths } from './treasuryNav';

export type LedgerEntryKind = Database['public']['Enums']['treasury_ledger_entry_kind'];
export type LedgerSourceTable = Database['public']['Enums']['treasury_ledger_source_table'];

const ENTRY_KIND: Record<LedgerEntryKind, string> = {
  usdt_purchase_debit_xaf: 'Achat USDT · paiement',
  usdt_purchase_credit_usdt: 'Achat USDT · réception',
  usdt_sale_debit_usdt: 'Vente USDT · envoi',
  usdt_sale_credit_cny: 'Vente USDT · encaissement',
  inventory_adjustment: 'Ajustement',
  void: 'Contre-passation',
};

export function entryKindLabel(kind: string | null | undefined): string {
  if (!kind) return '—';
  return ENTRY_KIND[kind as LedgerEntryKind] ?? kind.replace(/_/g, ' ');
}

const SOURCE: Record<LedgerSourceTable, string> = {
  usdt_purchase: 'Achat',
  usdt_sale: 'Vente',
  inventory_snapshot: 'Inventaire',
  manual_adjustment: 'Ajustement',
  void: 'Annulation',
};

export function sourceLabel(source: string | null | undefined): string {
  if (!source) return '—';
  return SOURCE[source as LedgerSourceTable] ?? source;
}

/** Le chemin de l'opération d'origine d'une écriture, quand il y en a une. */
export function sourcePath(source: string | null | undefined, id: string | null | undefined): string | null {
  if (!id) return null;
  if (source === 'usdt_purchase') return treasuryPaths.operation('purchase', id);
  if (source === 'usdt_sale') return treasuryPaths.operation('sale', id);
  return null;
}

/** La table d'origine d'une opération, telle que l'attend `void_treasury_operation`. */
export function sourceTableOf(kind: 'purchase' | 'sale'): LedgerSourceTable {
  return kind === 'purchase' ? 'usdt_purchase' : 'usdt_sale';
}

/** « F-003 · Ets Kamga » — l'identifiant lisible devant le nom. */
export function counterpartyLabel(cp: { short_id?: string | null; display_name?: string | null } | null | undefined): string {
  if (!cp) return '—';
  const name = cp.display_name ?? '—';
  return cp.short_id ? `${cp.short_id} · ${name}` : name;
}

/** Nombre d'éléments, accordé : « 1 achat », « 3 achats ». */
export function plural(n: number, one: string, many?: string): string {
  return `${n.toLocaleString('fr-FR')} ${n > 1 ? (many ?? `${one}s`) : one}`;
}

/**
 * Seuls les comptes cash, Alipay et WeChat se comptent à la main ; une
 * banque ou un mobile money se réconcilie sur son relevé.
 */
export const INVENTORY_KINDS: readonly string[] = ['cash', 'alipay', 'wechat'];

export function canInventory(kind: string | null | undefined): boolean {
  return !!kind && INVENTORY_KINDS.includes(kind);
}
