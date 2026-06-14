/**
 * Desktop admin — Treasury balance dashboard (PNG/PDF visual builder).
 *
 * Same state, preview and export as MobileBalanceDashboard — reuses the exact
 * BalanceDashboardPreview + export helpers + account list. Desktop layout: the
 * account inputs on the left, the live preview (full size — it fits without
 * downscaling on a wide column) and export buttons sticky on the right.
 */
import { useLayoutEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Download, FileText } from 'lucide-react';
import { MoneyField } from '@/components/treasury/MoneyField';
import { SectionTitle, SOFT_CARD } from '@/components/treasury/ui';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { PRIMARY_PILL } from '@/mobile/designKit';
import { cn } from '@/lib/utils';
import { DASHBOARD_ACCOUNTS, PAGE } from '@/mobile/screens/treasury/balance-dashboard/constants';
import { BalanceDashboardPreview } from '@/mobile/screens/treasury/balance-dashboard/BalanceDashboardPreview';
import { downloadDashboardPng, downloadDashboardPdf } from '@/mobile/screens/treasury/balance-dashboard/export';

export function DesktopBalanceDashboard() {
  const { hasPermission } = useAdminAuth();
  const previewRef = useRef<HTMLDivElement>(null);
  const scaleWrapRef = useRef<HTMLDivElement>(null);

  const [balances, setBalances] = useState<Record<string, number>>({});
  const [generatedAt] = useState<Date>(() => new Date());
  const [scale, setScale] = useState(1);
  const [exporting, setExporting] = useState<'png' | 'pdf' | null>(null);

  useLayoutEffect(() => {
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

  if (!hasPermission('canViewTreasury')) {
    return <Navigate to="/m" replace />;
  }

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
    <div className="space-y-6">
      <header>
        <h2 className="text-[26px] font-extrabold tracking-tight text-foreground">Dashboard soldes</h2>
        <p className="mt-1 text-[14px] text-muted-foreground">Génère le visuel des soldes par compte (PNG / PDF)</p>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Left — inputs */}
        <section>
          <SectionTitle>Soldes des comptes (XAF)</SectionTitle>
          <div className="space-y-2.5">
            {DASHBOARD_ACCOUNTS.map((a) => (
              <div key={a.key} className={cn(SOFT_CARD, 'space-y-2.5 p-4')}>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-card">
                    <img src={a.logo} alt={a.name} className="h-7 w-7 object-contain" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold text-foreground">{a.name}</div>
                    <div className="text-[11px] text-muted-foreground">{a.type}</div>
                  </div>
                </div>
                <MoneyField currency="XAF" value={balances[a.key] ?? null} onValueChange={(v) => setBalance(a.key, v)} allowDecimal decimals={0} max={null} />
              </div>
            ))}
          </div>
        </section>

        {/* Right — preview + export (sticky) */}
        <section>
          <div className="sticky top-[84px] space-y-4">
            <div>
              <SectionTitle>Aperçu</SectionTitle>
              <div
                ref={scaleWrapRef}
                className="w-full overflow-hidden rounded-2xl border border-border"
                style={{ height: PAGE.height * scale }}
              >
                <div style={{ transformOrigin: 'top left', transform: `scale(${scale})`, width: PAGE.width, height: PAGE.height }}>
                  <BalanceDashboardPreview ref={previewRef} balances={balances} generatedAt={generatedAt} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => handleExport('png')}
                disabled={exporting !== null}
                className={cn('flex h-[52px] items-center justify-center gap-2 rounded-2xl text-[15px] font-bold disabled:opacity-60', PRIMARY_PILL)}
              >
                <Download className="h-4 w-4" /> PNG
              </button>
              <button
                onClick={() => handleExport('pdf')}
                disabled={exporting !== null}
                className={cn('flex h-[52px] items-center justify-center gap-2 rounded-2xl text-[15px] font-bold disabled:opacity-60', PRIMARY_PILL)}
              >
                <FileText className="h-4 w-4" /> PDF
              </button>
            </div>
            <p className="text-center text-[11px] text-muted-foreground">
              Tu peux aussi faire une capture d'écran de l'aperçu ci-dessus.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
