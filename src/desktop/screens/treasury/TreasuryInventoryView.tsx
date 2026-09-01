/**
 * Trésorerie — Inventaires.
 *
 * Vue qui n'existait pas. `record_inventory_snapshot` écrivait dans
 * `treasury_inventory_snapshots` depuis toujours, la route `/inventory`
 * retombait sur Comptes, et la table n'était relue par aucun écran : on
 * enregistrait des comptages qu'on ne pouvait jamais consulter.
 *
 * Or c'est la SÉRIE des écarts qui a de la valeur, pas le comptage isolé :
 * un écart de 5 000 XAF une fois est une erreur de saisie, le même écart
 * chaque semaine sur la même caisse est un problème.
 */
import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ClipboardText } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useInventorySnapshots, useTreasuryAccounts } from '@/hooks/useTreasury';
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
} from './marketKit';
import { fmtNum } from './treasuryFormat';

export function TreasuryInventoryView({ canManage }: { canManage: boolean }) {
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const { data: accounts } = useTreasuryAccounts();
  const { data: snapshots, isLoading } = useInventorySnapshots(
    accountFilter === 'all' ? undefined : accountFilter,
  );

  const rows = snapshots ?? [];

  /**
   * Trois chiffres qui résument la santé des comptages : combien, combien
   * tombent juste, et quel écart cumulé reste à expliquer. Le cumul est en
   * valeur ABSOLUE — deux écarts opposés ne s'annulent pas, ce sont deux
   * problèmes.
   */
  const stats = useMemo(() => {
    const total = rows.length;
    const exact = rows.filter((r) => Number(r.variance) === 0).length;
    const drift = rows.reduce((sum, r) => sum + Math.abs(Number(r.variance ?? 0)), 0);
    return { total, exact, drift };
  }, [rows]);

  const accountOptions = useMemo(
    () => (accounts ?? []).map((a) => ({ id: a.id, label: a.label })),
    [accounts],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <MCard>
          <div className="p-4">
            <div className={cn('text-[10px] font-semibold uppercase tracking-[0.08em]', T.muted)}>Comptages</div>
            <div className={cn('mt-1 text-[21px] font-bold leading-none', NUM, T.ink)}>{stats.total}</div>
            <div className={cn('mt-1 text-[11.5px]', T.faint)}>enregistrés</div>
          </div>
        </MCard>
        <MCard>
          <div className="p-4">
            <div className={cn('text-[10px] font-semibold uppercase tracking-[0.08em]', T.muted)}>Sans écart</div>
            <div className={cn('mt-1 text-[21px] font-bold leading-none', NUM, stats.exact === stats.total && stats.total > 0 ? TONE.positive : T.ink)}>
              {stats.exact}
            </div>
            <div className={cn('mt-1 text-[11.5px]', T.faint)}>
              {stats.total > 0 ? `sur ${stats.total}` : '—'}
            </div>
          </div>
        </MCard>
        <MCard>
          <div className="p-4">
            <div className={cn('text-[10px] font-semibold uppercase tracking-[0.08em]', T.muted)}>Écart cumulé</div>
            <div className={cn('mt-1 text-[21px] font-bold leading-none', NUM, stats.drift > 0 ? TONE.negative : TONE.positive)}>
              {fmtNum(stats.drift, 2)}
            </div>
            <div className={cn('mt-1 text-[11.5px]', T.faint)}>en valeur absolue</div>
          </div>
        </MCard>
      </div>

      <MCard className="flex min-h-0 flex-col overflow-hidden">
        <MCardHeader
          title="Historique des comptages"
          description="Théorique contre réel, à la date du comptage"
          meta={`${rows.length} comptage${rows.length > 1 ? 's' : ''}`}
        />

        <div className={cn('flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5', M.border)}>
          <MChip label="Tous les comptes" active={accountFilter === 'all'} onClick={() => setAccountFilter('all')} />
          {accountOptions.map((a) => (
            <MChip key={a.id} label={a.label} active={accountFilter === a.id} onClick={() => setAccountFilter(a.id)} />
          ))}
        </div>

        {isLoading ? (
          <MLoading />
        ) : rows.length === 0 ? (
          <MEmpty icon={ClipboardText}>
            {canManage
              ? 'Aucun comptage enregistré. Lancez-en un depuis un compte, dans l’onglet Comptes.'
              : 'Aucun comptage enregistré.'}
          </MEmpty>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <MTable className="text-left">
              <MTableHead className={cn('sticky top-0 z-10', M.inset)}>
                <MTableRow className="hover:bg-transparent">
                  <MTh>Date</MTh>
                  <MTh>Compte</MTh>
                  <MTh align="right">Théorique</MTh>
                  <MTh align="right">Réel</MTh>
                  <MTh align="right">Écart</MTh>
                  <MTh>Motif</MTh>
                </MTableRow>
              </MTableHead>
              <MTableBody>
                {rows.map((s) => {
                  const variance = Number(s.variance ?? 0);
                  const exact = variance === 0;
                  return (
                    <MTableRow key={s.id}>
                      <MTd className="text-[12.5px]">
                        <span className={cn('font-medium', T.ink)}>
                          {format(parseISO(s.snapshot_at), 'dd MMM yyyy', { locale: fr })}
                        </span>
                        <span className={cn('ml-1.5 text-[11px]', NUM, T.faint)}>
                          {format(parseISO(s.snapshot_at), 'HH:mm')}
                        </span>
                      </MTd>
                      <MTd className={cn('text-[12.5px] font-semibold', T.ink)}>
                        {s.account?.label ?? '—'}
                        <span className={cn('ml-1.5 text-[10.5px] font-normal', T.faint)}>
                          {s.account?.currency ?? ''}
                        </span>
                      </MTd>
                      <MTd align="right" className={cn('text-[12.5px]', NUM, T.body)}>
                        {fmtNum(Number(s.theoretical_balance), 2)}
                      </MTd>
                      <MTd align="right" className={cn('text-[12.5px] font-semibold', NUM, T.ink)}>
                        {fmtNum(Number(s.actual_balance), 2)}
                      </MTd>
                      <MTd align="right" className={cn('text-[12.5px] font-bold', NUM, exact ? TONE.positive : TONE.negative)}>
                        {exact ? '0' : `${variance > 0 ? '+' : ''}${fmtNum(variance, 2)}`}
                      </MTd>
                      <MTd className={cn('max-w-[240px] truncate text-[11.5px]', T.muted)}>
                        {s.variance_reason ?? (exact ? '—' : 'Non expliqué')}
                      </MTd>
                    </MTableRow>
                  );
                })}
              </MTableBody>
            </MTable>
          </div>
        )}
      </MCard>
    </div>
  );
}
