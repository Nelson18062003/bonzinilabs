/**
 * Trésorerie — Grand livre.
 *
 * Vue qui n'existait pas. `treasury_ledger_entries` est la SOURCE DE VÉRITÉ
 * des soldes : chaque achat, vente, ajustement et inventaire y écrit une
 * ligne, et le solde d'un compte n'est rien d'autre que la somme de ses
 * lignes. La table n'était montrée nulle part, donc à la question « d'où
 * vient ce solde ? » il fallait recouper trois écrans sans jamais être sûr.
 *
 * Chaque ligne pointe vers l'opération qui l'a produite : le grand livre est
 * le point d'entrée vers le reste du module, pas une impasse.
 */
import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { Receipt } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useTreasuryLedger, useTreasuryAccounts } from '@/hooks/useTreasury';
import {
  M,
  T,
  NUM,
  TONE,
  MCard,
  MCardHeader,
  MChip,
  MTh,
  MTd,
  MTable,
  MTableHead,
  MTableBody,
  MTableRow,
  MEmpty,
  MLoading,
  MTag,
} from './marketKit';
import { fmtNum, type TreasuryCurrency } from './treasuryFormat';
import { treasuryPaths } from './treasuryNav';

const CURRENCIES: ReadonlyArray<TreasuryCurrency | 'all'> = ['all', 'XAF', 'USDT', 'CNY'];

/** Libellés des natures d'écriture : l'enum sortait brut à l'écran. */
const KIND_LABELS: Record<string, string> = {
  purchase: 'Achat',
  sale: 'Vente',
  adjustment: 'Ajustement',
  inventory: 'Inventaire',
  settlement: 'Règlement',
  transfer: 'Transfert',
};

function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind.replace(/_/g, ' ');
}

/** Vers l'opération d'origine, quand l'écriture en a une. */
function sourceLink(sourceTable: string | null, sourceId: string | null): string | null {
  if (!sourceId) return null;
  if (sourceTable === 'usdt_purchases') return treasuryPaths.operation('purchase', sourceId);
  if (sourceTable === 'usdt_sales') return treasuryPaths.operation('sale', sourceId);
  return null;
}

export function TreasuryLedgerView() {
  const [currency, setCurrency] = useState<TreasuryCurrency | 'all'>('all');
  const [accountId, setAccountId] = useState<string>('all');

  const { data: accounts } = useTreasuryAccounts();
  const { data: entries, isLoading } = useTreasuryLedger({
    currency: currency === 'all' ? undefined : currency,
    accountId: accountId === 'all' ? undefined : accountId,
  });

  const rows = entries ?? [];

  /** Entrées, sorties et net sur ce qui est affiché — pas sur toute la base. */
  const totals = useMemo(() => {
    let credit = 0;
    let debit = 0;
    for (const e of rows) {
      const amount = Number(e.amount ?? 0);
      if (amount >= 0) credit += amount;
      else debit += amount;
    }
    return { credit, debit, net: credit + debit };
  }, [rows]);

  const accountOptions = useMemo(
    () =>
      (accounts ?? []).filter((a) => currency === 'all' || a.currency === currency),
    [accounts, currency],
  );

  const mixedCurrencies = currency === 'all';

  return (
    <MCard className="flex min-h-0 flex-col overflow-hidden">
      <MCardHeader
        title="Grand livre"
        description="Chaque mouvement qui compose les soldes"
        meta={`${rows.length} écriture${rows.length > 1 ? 's' : ''}`}
      />

      <div className={cn('flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5', M.border)}>
        {CURRENCIES.map((c) => (
          <MChip
            key={c}
            label={c === 'all' ? 'Toutes devises' : c}
            active={currency === c}
            onClick={() => {
              setCurrency(c);
              setAccountId('all'); // un compte d'une autre devise n'a plus de sens
            }}
          />
        ))}
        {accountOptions.length > 0 && (
          <>
            <span className={cn('mx-1 h-4 w-px', M.border, 'border-l')} aria-hidden />
            <MChip label="Tous les comptes" active={accountId === 'all'} onClick={() => setAccountId('all')} />
            {accountOptions.map((a) => (
              <MChip key={a.id} label={a.label} active={accountId === a.id} onClick={() => setAccountId(a.id)} />
            ))}
          </>
        )}
      </div>

      {/* Le net n'a de sens que dans UNE devise : additionner des XAF et des
          CNY ne veut rien dire. On l'affiche donc seulement quand une devise
          est choisie, plutôt que de montrer un total faux. */}
      {!isLoading && rows.length > 0 && (
        <div className={cn('flex flex-wrap items-center gap-6 border-b px-4 py-2.5', M.border, M.inset)}>
          <div>
            <span className={cn('text-[10px] font-semibold uppercase tracking-[0.08em]', T.muted)}>Entrées</span>
            <div className={cn('text-[13px] font-bold', NUM, TONE.positive)}>{fmtNum(totals.credit, 2)}</div>
          </div>
          <div>
            <span className={cn('text-[10px] font-semibold uppercase tracking-[0.08em]', T.muted)}>Sorties</span>
            <div className={cn('text-[13px] font-bold', NUM, TONE.negative)}>{fmtNum(totals.debit, 2)}</div>
          </div>
          {!mixedCurrencies && (
            <div>
              <span className={cn('text-[10px] font-semibold uppercase tracking-[0.08em]', T.muted)}>Net {currency}</span>
              <div className={cn('text-[13px] font-bold', NUM, T.ink)}>{fmtNum(totals.net, 2)}</div>
            </div>
          )}
          {mixedCurrencies && (
            <span className={cn('text-[11px]', T.faint)}>
              Choisissez une devise pour voir le net — des devises différentes ne s’additionnent pas.
            </span>
          )}
        </div>
      )}

      {isLoading ? (
        <MLoading />
      ) : rows.length === 0 ? (
        <MEmpty icon={Receipt}>Aucune écriture pour ce filtre.</MEmpty>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <MTable className="text-left">
            <MTableHead className={cn('sticky top-0 z-10', M.inset)}>
              <MTableRow className="hover:bg-transparent">
                <MTh>Date</MTh>
                <MTh>Nature</MTh>
                <MTh>Compte</MTh>
                <MTh align="right">Montant</MTh>
                <MTh>Origine</MTh>
              </MTableRow>
            </MTableHead>
            <MTableBody>
              {rows.map((e) => {
                const amount = Number(e.amount ?? 0);
                const link = sourceLink(e.source_table, e.source_id);
                return (
                  <MTableRow key={e.id}>
                    <MTd className="text-[12.5px]">
                      <span className={cn('font-medium', T.ink)}>
                        {format(parseISO(e.occurred_at), 'dd MMM yyyy', { locale: fr })}
                      </span>
                      <span className={cn('ml-1.5 text-[11px]', NUM, T.faint)}>
                        {format(parseISO(e.occurred_at), 'HH:mm')}
                      </span>
                    </MTd>
                    <MTd><MTag>{kindLabel(e.entry_kind)}</MTag></MTd>
                    <MTd className={cn('text-[12.5px]', T.body)}>{e.account?.label ?? '—'}</MTd>
                    <MTd align="right" className={cn('text-[12.5px] font-bold', NUM, amount >= 0 ? TONE.positive : TONE.negative)}>
                      {amount >= 0 ? '+' : ''}{fmtNum(amount, 2)}
                      <span className={cn('ml-1 text-[10.5px] font-normal', T.faint)}>{e.currency}</span>
                    </MTd>
                    <MTd className="text-[11.5px]">
                      {link ? (
                        <Link to={link} className="font-semibold text-primary underline-offset-2 hover:underline">
                          Voir l’opération
                        </Link>
                      ) : (
                        <span className={T.faint}>—</span>
                      )}
                    </MTd>
                  </MTableRow>
                );
              })}
            </MTableBody>
          </MTable>
        </div>
      )}
    </MCard>
  );
}
