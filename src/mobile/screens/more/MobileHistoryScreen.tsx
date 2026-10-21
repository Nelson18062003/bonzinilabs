/**
 * Journal, v2 (maquette 06-messages-douane-outils/13) : Tous · Dépôts ·
 * Paiements · Clients · Taux ; groupé par jour ; une ligne = les initiales
 * de l'auteur, l'action en mots, « auteur · objet », l'heure, et un chevron
 * qui ouvre l'objet (dépôt, paiement, client, taux) — l'ordinateur ne menait
 * nulle part. « … » : rechercher, période, exporter (CSV).
 *
 * Données : useAdminAuditLogs (les 100 dernières entrées), lecture seule.
 * Garde : canViewLogs, comme le menu de l'ordinateur.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Download, Search } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAdminAuditLogs } from '@/hooks/useAdminData';
import { cn } from '@/lib/utils';
import {
  BigButton, BottomSheet, Chip, DayLabel, EmptyLine, Initials, ItemList, ItemRow, MoreButton, ScreenTop, SearchBox, TEXT, useSheet,
} from '@/mobile/designKit';
import { SkeletonListScreen } from '@/mobile/components/ui/SkeletonCard';
import { PullToRefresh } from '@/mobile/components/ui/PullToRefresh';
import { ChoiceChips, MenuSheet } from '@/mobile/screens/operations/parts';
import { groupByDay } from '@/mobile/screens/operations/opsLabels';

const FILTERS = [
  { value: 'all', label: 'Tous' },
  { value: 'deposit', label: 'Dépôts' },
  { value: 'payment', label: 'Paiements' },
  { value: 'client', label: 'Clients' },
  { value: 'rate', label: 'Taux' },
] as const;
type Filter = (typeof FILTERS)[number]['value'];
type Period = 'all' | 'today' | '7d' | '30d';

const ACTIONS: Record<string, string> = {
  validate_deposit: 'Dépôt validé',
  reject_deposit: 'Dépôt refusé',
  create_deposit_for_client: 'Dépôt créé',
  create_client_deposit: 'Dépôt créé',
  cancel_deposit: 'Dépôt annulé',
  delete_deposit: 'Dépôt supprimé',
  start_deposit_review: 'Dépôt en vérification',
  set_deposit_verified: 'Vu en banque',
  delete_deposit_proof: 'Preuve supprimée',
  create_payment_for_client: 'Paiement créé',
  create_admin_payment: 'Paiement créé',
  complete_payment: 'Paiement payé',
  reject_payment: 'Paiement refusé',
  start_processing: 'Paiement en cours',
  process_payment: 'Paiement traité',
  cancel_payment: 'Paiement annulé',
  delete_payment: 'Paiement supprimé',
  admin_correct_payment: 'Montant corrigé',
  create_payment_batch: 'Lot créé',
  confirm_cash_payment: 'Cash remis',
  scan_cash_payment: 'QR cash lu',
  create_client: 'Client créé',
  update_client: 'Client modifié',
  admin_adjust_wallet: 'Solde ajusté',
  set_wallet_overdraft: 'Découvert autorisé',
  admin_set_wallet_overdraft: 'Découvert autorisé',
  create_admin: 'Accès créé',
  update_admin_profile: 'Accès modifié',
  reset_admin_password: 'Mot de passe réinitialisé',
  reset_client_password: 'Mot de passe client réinitialisé',
  add_exchange_rate: 'Taux modifié',
  update_daily_rate: 'Taux modifié',
  create_daily_rates: 'Taux modifié',
};

function actionLabel(a: string): string {
  const key = a.toLowerCase();
  if (ACTIONS[key]) return ACTIONS[key];
  const s = key.replace(/_/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type Log = NonNullable<ReturnType<typeof useAdminAuditLogs>['data']>[number];

function objectOf(log: Log): string {
  const d = (log.details ?? {}) as Record<string, unknown>;
  const pick = (k: string) => (typeof d[k] === 'string' || typeof d[k] === 'number' ? String(d[k]) : '');
  return pick('reference') || pick('deposit_reference') || pick('payment_reference') || pick('client_name') || pick('description') || '';
}

function linkOf(log: Log): string | null {
  const id = log.target_id;
  switch (log.target_type) {
    case 'deposit': return id ? `/m/deposits/${id}` : null;
    case 'payment': return id ? `/m/payments/${id}` : null;
    case 'client':
    case 'wallet': return id ? `/m/clients/${id}` : null;
    case 'rate':
    case 'daily_rates': return '/m/more/rates';
    default: return null;
  }
}

const matchesFilter = (log: Log, f: Filter) => f === 'all' || log.target_type === f || (f === 'rate' && log.target_type === 'daily_rates') || (f === 'client' && log.target_type === 'wallet');

export function MobileHistoryScreen() {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const allowed = hasPermission('canViewLogs');
  const { data: logs, isLoading, isError, refetch } = useAdminAuditLogs();
  const [filter, setFilter] = useState<Filter>('all');
  const [period, setPeriod] = useState<Period>('all');
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const more = useSheet();
  const periodSheet = useSheet();

  const rows = useMemo(() => {
    const now = Date.now();
    const from = period === 'today' ? new Date(new Date().toDateString()).getTime() : period === '7d' ? now - 7 * 864e5 : period === '30d' ? now - 30 * 864e5 : 0;
    const t = q.trim().toLowerCase();
    return (logs ?? []).filter((l) => {
      if (!matchesFilter(l, filter)) return false;
      if (from && new Date(l.created_at).getTime() < from) return false;
      if (!t) return true;
      const who = `${l.adminProfile?.first_name ?? ''} ${l.adminProfile?.last_name ?? ''}`.toLowerCase();
      return actionLabel(l.action_type).toLowerCase().includes(t) || l.action_type.toLowerCase().includes(t) || who.includes(t) || objectOf(l).toLowerCase().includes(t);
    });
  }, [logs, filter, period, q]);

  const exportCsv = () => {
    if (rows.length === 0) { toast.error('Rien à exporter'); return; }
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [
      ['Date', 'Auteur', 'Action', 'Objet', 'Type', 'Identifiant'].map(esc).join(','),
      ...rows.map((l) => [
        format(new Date(l.created_at), 'yyyy-MM-dd HH:mm'),
        `${l.adminProfile?.first_name ?? ''} ${l.adminProfile?.last_name ?? ''}`.trim() || 'Système',
        actionLabel(l.action_type),
        objectOf(l),
        l.target_type ?? '',
        l.target_id ?? '',
      ].map((v) => esc(String(v))).join(',')),
    ];
    const blob = new Blob([`﻿${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `journal_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  if (!allowed) {
    return (
      <div className="flex min-h-full flex-col">
        <ScreenTop title="Journal" backTo="/m/more" />
        <EmptyLine>Vous n'avez pas accès au journal.</EmptyLine>
      </div>
    );
  }

  const groups = groupByDay(rows, (l) => l.created_at);

  return (
    <div className="flex min-h-full flex-col">
      <ScreenTop title="Journal" backTo="/m/more" right={<MoreButton onClick={more.show} />} />
      {searching && (
        <div className="px-5 pt-3">
          <SearchBox value={q} onChange={setQ} autoFocus placeholder="Action, auteur, référence" />
        </div>
      )}
      <PullToRefresh onRefresh={refetch} className="flex-1 pb-6">
        <div className="scrollbar-hide flex gap-2 overflow-x-auto px-5 pb-1 pt-3.5">
          {FILTERS.map((f) => <Chip key={f.value} label={f.label} active={filter === f.value} onClick={() => setFilter(f.value)} />)}
        </div>
        {isLoading ? (
          <div className="px-5 pt-3"><SkeletonListScreen count={5} /></div>
        ) : isError ? (
          <EmptyLine action={{ label: 'Réessayer', onClick: () => void refetch() }}>Le journal n'a pas pu être chargé.</EmptyLine>
        ) : rows.length === 0 ? (
          <EmptyLine>Aucune action.</EmptyLine>
        ) : (
          groups.map((g) => (
            <section key={g.label}>
              <DayLabel>{g.label}</DayLabel>
              <ItemList>
                {g.rows.map((l) => {
                  const who = `${l.adminProfile?.first_name ?? ''} ${l.adminProfile?.last_name ?? ''}`.trim() || 'Système';
                  const obj = objectOf(l);
                  const to = linkOf(l);
                  return (
                    <ItemRow
                      key={l.id}
                      leading={<Initials name={who} />}
                      title={actionLabel(l.action_type)}
                      subtitle={obj ? `${l.adminProfile?.first_name || who} · ${obj}` : (l.adminProfile?.first_name || who)}
                      right={<span className={cn('shrink-0 text-[15px] tabular-nums', TEXT.muted)}>{format(new Date(l.created_at), 'HH:mm')}</span>}
                      chevron={!!to}
                      onClick={to ? () => navigate(to) : undefined}
                    />
                  );
                })}
              </ItemList>
            </section>
          ))
        )}
      </PullToRefresh>

      <MenuSheet
        open={more.open}
        onClose={more.hide}
        items={[
          { label: searching ? 'Fermer la recherche' : 'Rechercher', icon: Search, onClick: () => { if (searching) setQ(''); setSearching(!searching); } },
          { label: 'Période', icon: CalendarDays, hint: period === 'all' ? undefined : period === 'today' ? "Aujourd'hui" : period === '7d' ? '7 jours' : '30 jours', onClick: periodSheet.show },
          { label: 'Exporter (CSV)', icon: Download, onClick: exportCsv },
        ]}
      />
      <BottomSheet open={periodSheet.open} onClose={periodSheet.hide}>
        <h3 className={cn('mb-4 text-[22px] font-semibold', TEXT.strong)}>Période</h3>
        <ChoiceChips<Period>
          options={[{ value: 'all', label: 'Tout' }, { value: 'today', label: "Aujourd'hui" }, { value: '7d', label: '7 jours' }, { value: '30d', label: '30 jours' }]}
          value={period}
          onChange={setPeriod}
        />
        <BigButton className="mt-6" onClick={periodSheet.hide}>Voir le journal</BigButton>
      </BottomSheet>
    </div>
  );
}
