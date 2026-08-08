/**
 * Trésorerie — dashboard soldes (générateur du visuel PNG / PDF).
 *
 * Rebuilt onto the console's dimensional contract (`@/desktop/ui/tokens`).
 *
 * `BalanceDashboardPreview` is deliberately still imported from the mobile
 * module and deliberately NOT restyled: it is not console chrome, it is the
 * artefact that gets exported. Its geometry is locked to the PDF generator
 * (A4 at 1pt = 1px), so putting it on the console's type scale would change the
 * file an operator sends out. Everything *around* it — the entry form, the
 * export actions, the frame — is now console.
 *
 * The screen prints no total: the total is inside the preview, which is on the
 * same screen, and a number printed twice is a number an operator has to check.
 *
 * Guarded on `canViewTreasury`.
 */
import * as React from 'react';
import { Navigate } from 'react-router-dom';
import { Download, FileText } from 'lucide-react';
import { parseAmount } from '@/components/form/AmountField';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { cn } from '@/lib/utils';
import { DS, DT, DFG } from '@/desktop/ui/tokens';
import { Button, Input, Panel, PanelHead } from '@/desktop/ui/primitives';
import { ScreenHead, Workspace } from '@/desktop/ui/layout';
import { DASHBOARD_ACCOUNTS, PAGE } from '@/mobile/screens/treasury/balance-dashboard/constants';
import { BalanceDashboardPreview } from '@/mobile/screens/treasury/balance-dashboard/BalanceDashboardPreview';
import { downloadDashboardPng, downloadDashboardPdf } from '@/mobile/screens/treasury/balance-dashboard/export';

/**
 * Money entry on the console ladder — geometry from `Input`, grammar from the
 * shared `parseAmount`. Labelled by `ariaLabel` because the visible label here
 * is the account row itself.
 */
function MoneyInput({
  ariaLabel,
  currency,
  decimals,
  value,
  onValueChange,
}: {
  ariaLabel: string;
  currency: string;
  decimals: number;
  value: number | null;
  onValueChange: (v: number | null) => void;
}) {
  const formatter = React.useMemo(
    () => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: decimals, useGrouping: true }),
    [decimals],
  );
  const format = React.useCallback(
    (n: number | null) => (n == null || Number.isNaN(n) ? '' : formatter.format(n)),
    [formatter],
  );
  const [display, setDisplay] = React.useState(() => format(value));
  const [focused, setFocused] = React.useState(false);

  React.useEffect(() => {
    if (!focused) setDisplay(format(value));
  }, [value, focused, format]);

  return (
    <div className="flex items-center gap-2">
      <Input
        aria-label={ariaLabel}
        inputMode={decimals > 0 ? 'decimal' : 'numeric'}
        value={display}
        placeholder="0"
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          const parsed = parseAmount(display, decimals > 0);
          setDisplay(parsed == null ? '' : format(parsed));
        }}
        onChange={(e) => {
          const cleaned = e.target.value.replace(/[^\d.,\s-]/g, '');
          setDisplay(cleaned);
          onValueChange(parseAmount(cleaned, decimals > 0));
        }}
        className="text-right tabular-nums"
      />
      <span className={cn(DT.label, DFG.muted, 'shrink-0')}>{currency}</span>
    </div>
  );
}

export function DesktopBalanceDashboard() {
  const { hasPermission } = useAdminAuth();
  const previewRef = React.useRef<HTMLDivElement>(null);
  const scaleWrapRef = React.useRef<HTMLDivElement>(null);

  const [balances, setBalances] = React.useState<Record<string, number>>({});
  const [generatedAt] = React.useState<Date>(() => new Date());
  const [scale, setScale] = React.useState(1);
  const [exporting, setExporting] = React.useState<'png' | 'pdf' | null>(null);

  /* The preview is a fixed A4 canvas; it is scaled down to whatever the column
     gives it rather than reflowed, so what is on screen is what gets exported. */
  React.useLayoutEffect(() => {
    const node = scaleWrapRef.current;
    if (!node) return;
    const measure = () => {
      const w = node.clientWidth;
      if (w > 0) setScale(Math.min(1, w / PAGE.width));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  if (!hasPermission('canViewTreasury')) return <Navigate to="/m" replace />;

  const setBalance = (key: string, v: number | null) => setBalances((b) => ({ ...b, [key]: v ?? 0 }));

  const handleExport = async (kind: 'png' | 'pdf') => {
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
    <Workspace
      head={
        <ScreenHead
          title="Dashboard soldes"
          subtitle="Génère le visuel des soldes par compte (PNG / PDF)"
          actions={
            <>
              <Button
                icon={Download}
                loading={exporting === 'png'}
                disabled={exporting !== null}
                onClick={() => handleExport('png')}
              >
                PNG
              </Button>
              <Button
                variant="primary"
                icon={FileText}
                loading={exporting === 'pdf'}
                disabled={exporting !== null}
                onClick={() => handleExport('pdf')}
              >
                PDF
              </Button>
            </>
          }
        />
      }
    >
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        {/* Saisie */}
        <Panel className="overflow-hidden">
          <PanelHead title="Soldes des comptes" hint="Montants en XAF · le total est calculé dans l’aperçu" />
          {DASHBOARD_ACCOUNTS.map((a, idx) => (
            <div
              key={a.key}
              className={cn(
                'flex min-h-11 items-center gap-3 px-4 py-3',
                idx < DASHBOARD_ACCOUNTS.length - 1 && 'border-b',
                DS.line,
              )}
            >
              <span
                className={cn(
                  'inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border',
                  DS.card,
                  DS.line,
                )}
              >
                <img src={a.logo} alt="" className="h-6 w-6 object-contain" />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn('block truncate font-semibold', DT.body, DFG.strong)}>{a.name}</span>
                <span className={cn('block truncate', DT.label, DFG.faint)}>{a.type}</span>
              </span>
              <span className="w-44 shrink-0">
                <MoneyInput
                  ariaLabel={`Solde ${a.name} en XAF`}
                  currency="XAF"
                  decimals={0}
                  value={balances[a.key] ?? null}
                  onValueChange={(v) => setBalance(a.key, v)}
                />
              </span>
            </div>
          ))}
        </Panel>

        {/* Aperçu — l'artefact exporté, à sa géométrie d'origine. */}
        <Panel className="sticky top-[84px] overflow-hidden">
          <PanelHead title="Aperçu" hint="Rendu exact du fichier exporté (A4)" />
          <div className="p-4">
            <div
              ref={scaleWrapRef}
              className={cn('w-full overflow-hidden rounded-lg border', DS.line)}
              style={{ height: PAGE.height * scale }}
            >
              <div
                style={{
                  transformOrigin: 'top left',
                  transform: `scale(${scale})`,
                  width: PAGE.width,
                  height: PAGE.height,
                }}
              >
                <BalanceDashboardPreview ref={previewRef} balances={balances} generatedAt={generatedAt} />
              </div>
            </div>
            <p className={cn(DT.label, DFG.faint, 'mt-3')}>
              Une capture d'écran de l'aperçu ci-dessus fait aussi l'affaire.
            </p>
          </div>
        </Panel>
      </div>
    </Workspace>
  );
}
