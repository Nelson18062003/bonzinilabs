/**
 * Trésorerie — Contrôle : ce qu'on vérifie, pas ce qu'on saisit tous les jours.
 *
 *   · Grand livre — chaque écriture, avec sa nature en clair et un lien vers
 *     l'opération d'origine. Une devise à la fois : un total qui additionne
 *     des XAF et des CNY ne veut rien dire ;
 *   · Inventaires — l'historique des comptages et de leurs écarts, tous
 *     comptes confondus ;
 *   · Visuel des soldes — l'image (PNG / PDF) des soldes à partager.
 */
import { useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ClipboardCheck, Download, FileText } from 'lucide-react';
import { useInventorySnapshots, useTreasuryAccounts, useTreasuryLedger } from '@/hooks/useTreasury';
import { DASHBOARD_ACCOUNTS, PAGE } from '@/mobile/screens/treasury/balance-dashboard/constants';
import { BalanceDashboardPreview } from '@/mobile/screens/treasury/balance-dashboard/BalanceDashboardPreview';
import { downloadDashboardPdf, downloadDashboardPng } from '@/mobile/screens/treasury/balance-dashboard/export';
import { BTN } from './tstyle';
import { AmountInput, Card, CardHead, Empty, ErrorState, Loading, Money, OriginCell, Picker, Segmented, StatusPill, SummaryBar, Td, Th } from './tkit';
import { useTreasuryActions } from './treasuryActions';
import { CONTROL_VIEWS, type ControlView as ControlViewKey } from './treasuryNav';
import { CURRENCY_DECIMALS, fmtNum, fmtWhen, type TreasuryCurrency } from './treasuryFormat';
import { entryKindLabel } from './treasuryLabels';

export function ControlView({ view }: { view: ControlViewKey }) {
  const navigate = useNavigate();
  return (
    <div className="space-y-4">
      <Segmented
        ariaLabel="Outils de contrôle"
        value={view}
        onChange={(v) => navigate(CONTROL_VIEWS.find((c) => c.key === v)!.path, { replace: true })}
        options={CONTROL_VIEWS.map((c) => ({ value: c.key, label: c.label }))}
      />
      {view === 'ledger' && <LedgerView />}
      {view === 'inventory' && <InventoryHistory />}
      {view === 'visual' && <BalanceVisual />}
    </div>
  );
}

/* ── Grand livre ──────────────────────────────────────────────────────── */

const LEDGER_LIMIT = 300;

function LedgerView() {
  const navigate = useNavigate();
  const [cur, setCur] = useState<TreasuryCurrency>('XAF');
  const [accountId, setAccountId] = useState('');
  const accounts = useTreasuryAccounts(cur);
  const ledger = useTreasuryLedger({ currency: cur, accountId: accountId || undefined, limit: LEDGER_LIMIT });

  const rows = ledger.data ?? [];
  const inflow = rows.filter((e) => Number(e.amount) > 0).reduce((s, e) => s + Number(e.amount), 0);
  const outflow = rows.filter((e) => Number(e.amount) < 0).reduce((s, e) => s + Number(e.amount), 0);
  const d = CURRENCY_DECIMALS[cur];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          ariaLabel="Devise"
          size="sm"
          value={cur}
          onChange={(c) => {
            setCur(c);
            setAccountId('');
          }}
          options={[
            { value: 'XAF', label: 'XAF' },
            { value: 'USDT', label: 'USDT' },
            { value: 'CNY', label: 'CNY' },
          ]}
        />
        <div className="w-[240px]">
          <Picker
            value={accountId}
            onChange={setAccountId}
            options={(accounts.data ?? []).map((a) => ({ value: a.id, label: a.label }))}
            allLabel="tous"
            prefix="Compte :"
            ariaLabel="Filtrer par compte"
          />
        </div>
      </div>
      <Card className="overflow-hidden">
        <CardHead
          title={`Grand livre · ${cur}`}
          meta={rows.length >= LEDGER_LIMIT ? `Les ${LEDGER_LIMIT} écritures les plus récentes` : 'Toutes les écritures, de la plus récente à la plus ancienne'}
        />
        {ledger.isLoading ? (
          <Loading rows={8} />
        ) : ledger.isError ? (
          <ErrorState onRetry={() => void ledger.refetch()} />
        ) : rows.length === 0 ? (
          <Empty icon={BookOpen} title="Aucune écriture" />
        ) : (
          <>
            <SummaryBar
              items={[
                { label: 'Écritures', value: rows.length },
                { label: 'Entrées', value: `+ ${fmtNum(inflow, d)} ${cur}` },
                { label: 'Sorties', value: `− ${fmtNum(Math.abs(outflow), d)} ${cur}` },
              ]}
            />
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Compte</Th>
                  <Th>Nature</Th>
                  <Th>Origine</Th>
                  <Th align="right">Montant</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => {
                  return (
                    <tr key={e.id}>
                      <Td muted>{fmtWhen(e.occurred_at)}</Td>
                      <Td className="font-medium">{e.account?.label ?? '—'}</Td>
                      <Td>{entryKindLabel(e.entry_kind)}</Td>
                      <Td>
                        <OriginCell source={e.source_table} id={e.source_id} onOpen={navigate} />
                      </Td>
                      <Td align="right">
                        <Money value={Number(e.amount)} cur={cur} sign tone size="sm" />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </Card>
    </div>
  );
}

/* ── Inventaires ──────────────────────────────────────────────────────── */

function InventoryHistory() {
  const actions = useTreasuryActions();
  const snaps = useInventorySnapshots(undefined, 200);
  const rows = snaps.data ?? [];
  const withGap = rows.filter((s) => Number(s.variance) !== 0).length;

  return (
    <Card className="overflow-hidden">
      <CardHead
        title="Inventaires"
        meta="Chaque comptage : ce que le système attendait, ce qui a été compté, l’écart"
        action={
          actions.canManage ? (
            <button type="button" className={BTN.soft} onClick={() => actions.inventory()}>
              <ClipboardCheck className="h-4 w-4" /> Faire un inventaire
            </button>
          ) : undefined
        }
      />
      {snaps.isLoading ? (
        <Loading rows={6} />
      ) : snaps.isError ? (
        <ErrorState onRetry={() => void snaps.refetch()} />
      ) : rows.length === 0 ? (
        <Empty icon={ClipboardCheck} title="Aucun inventaire enregistré">Comptez une caisse, un compte Alipay ou WeChat pour vérifier qu’il ne dérive pas.</Empty>
      ) : (
        <>
          <SummaryBar items={[{ label: 'Inventaires', value: rows.length }, { label: 'Avec écart', value: withGap }]} />
          <table className="w-full">
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Compte</Th>
                <Th align="right">Attendu</Th>
                <Th align="right">Compté</Th>
                <Th align="right">Écart</Th>
                <Th>Motif</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const cur = (s.account?.currency ?? 'XAF') as TreasuryCurrency;
                const v = Number(s.variance);
                return (
                  <tr key={s.id}>
                    <Td muted>{fmtWhen(s.snapshot_at)}</Td>
                    <Td className="font-medium">{s.account?.label ?? '—'}</Td>
                    <Td align="right"><Money value={Number(s.theoretical_balance)} cur={cur} size="sm" showCur={false} className="text-muted-foreground" /></Td>
                    <Td align="right"><Money value={Number(s.actual_balance)} cur={cur} size="sm" /></Td>
                    <Td align="right">{v === 0 ? <StatusPill tone="ok">Juste</StatusPill> : <Money value={v} cur={cur} sign tone size="sm" showCur={false} />}</Td>
                    <Td className="max-w-[320px] truncate" muted={!s.variance_reason}>{s.variance_reason ?? (v === 0 ? '—' : 'Non expliqué')}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </Card>
  );
}

/* ── Visuel des soldes ────────────────────────────────────────────────── */

function BalanceVisual() {
  const previewRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [generatedAt] = useState(() => new Date());
  const [scale, setScale] = useState(1);
  const [exporting, setExporting] = useState<'png' | 'pdf' | null>(null);

  useLayoutEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    const measure = () => {
      if (node.clientWidth > 0) setScale(Math.min(1, node.clientWidth / PAGE.width));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const exportAs = async (kind: 'png' | 'pdf') => {
    if (!previewRef.current || exporting) return;
    setExporting(kind);
    try {
      if (kind === 'png') await downloadDashboardPng(previewRef.current);
      else await downloadDashboardPdf(previewRef.current);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      <Card className="overflow-hidden">
        <CardHead title="Soldes à afficher" meta="Tapez le solde de chaque compte, en XAF. L’image se met à jour à droite." />
        <ul className="divide-y divide-border/70">
          {DASHBOARD_ACCOUNTS.map((a) => (
            <li key={a.key} className="grid grid-cols-[minmax(0,1fr)_220px] items-center gap-4 px-5 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-card">
                  <img src={a.logo} alt="" className="h-7 w-7 object-contain" />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold">{a.name}</div>
                  <div className="text-[12px] text-muted-foreground">{a.type}</div>
                </div>
              </div>
              <AmountInput
                value={balances[a.key] ?? null}
                onChange={(v) => setBalances((b) => ({ ...b, [a.key]: v ?? 0 }))}
                unit="XAF"
                decimals={0}
              />
            </li>
          ))}
        </ul>
      </Card>

      <div className="space-y-3 lg:sticky lg:top-4">
        <Card className="p-4">
          <div ref={wrapRef} className="w-full">
            <div className="mx-auto overflow-hidden rounded-lg border border-border" style={{ width: PAGE.width * scale, height: PAGE.height * scale }}>
              <div style={{ transformOrigin: 'top left', transform: `scale(${scale})`, width: PAGE.width, height: PAGE.height }}>
                <BalanceDashboardPreview ref={previewRef} balances={balances} generatedAt={generatedAt} />
              </div>
            </div>
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={BTN.primary} disabled={exporting !== null} onClick={() => void exportAs('png')}>
            <Download className="h-4 w-4" /> {exporting === 'png' ? 'Préparation…' : 'Télécharger l’image (PNG)'}
          </button>
          <button type="button" className={BTN.soft} disabled={exporting !== null} onClick={() => void exportAs('pdf')}>
            <FileText className="h-4 w-4" /> {exporting === 'pdf' ? 'Préparation…' : 'Télécharger en PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}
