import { useLayoutEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2, Download, FileText } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { Button } from '@/components/ui/button';
import { AmountField } from '@/components/form';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { DASHBOARD_ACCOUNTS, PAGE } from './constants';
import { BalanceDashboardPreview } from './BalanceDashboardPreview';
import { downloadDashboardPng, downloadDashboardPdf } from './export';

export function MobileBalanceDashboard() {
  const { hasPermission } = useAdminAuth();
  const previewRef = useRef<HTMLDivElement>(null);
  const scaleWrapRef = useRef<HTMLDivElement>(null);

  const [balances, setBalances] = useState<Record<string, number>>({});
  const [generatedAt] = useState<Date>(() => new Date());
  const [scale, setScale] = useState(0.5);
  const [exporting, setExporting] = useState<'png' | 'pdf' | null>(null);

  // Scale the full-size (595px) preview down to fit the screen width.
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
    return <Navigate to="/m/more" replace />;
  }

  const setBalance = (key: string, v: number | null) =>
    setBalances((b) => ({ ...b, [key]: v ?? 0 }));

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
    <div className="flex flex-col min-h-full bg-background">
      <MobileHeader title="Dashboard soldes" showBack backTo="/m/more/treasury" />

      <div className="px-4 py-4 space-y-5">
        {/* Form */}
        <section>
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted-foreground mb-2">
            Soldes des comptes (XAF)
          </h2>
          <div className="space-y-3">
            {DASHBOARD_ACCOUNTS.map((a) => (
              <div key={a.key} className="bg-white border border-border rounded-2xl p-3 space-y-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-white border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
                    <img src={a.logo} alt={a.name} className="w-7 h-7 object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold text-foreground truncate">{a.name}</div>
                    <div className="text-[11px] text-muted-foreground">{a.type}</div>
                  </div>
                </div>
                <AmountField
                  currency="XAF"
                  value={balances[a.key] ?? null}
                  onValueChange={(v) => setBalance(a.key, v)}
                  allowDecimal
                  decimals={0}
                  max={null}
                  controlClassName="text-[17px]"
                />
              </div>
            ))}
          </div>
        </section>

        {/* Live preview */}
        <section>
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Aperçu</h2>
          <div
            ref={scaleWrapRef}
            className="w-full overflow-hidden rounded-xl border border-border"
            style={{ height: PAGE.height * scale }}
          >
            <div style={{ transformOrigin: 'top left', transform: `scale(${scale})`, width: PAGE.width, height: PAGE.height }}>
              <BalanceDashboardPreview ref={previewRef} balances={balances} generatedAt={generatedAt} />
            </div>
          </div>
        </section>

        {/* Export buttons */}
        <section className="grid grid-cols-2 gap-2.5">
          <Button
            onClick={() => handleExport('png')}
            disabled={exporting !== null}
            className="h-12 bg-violet-600 hover:bg-violet-700 font-bold"
          >
            {exporting === 'png' ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Download className="w-4 h-4 mr-2" />PNG</>}
          </Button>
          <Button
            onClick={() => handleExport('pdf')}
            disabled={exporting !== null}
            className="h-12 bg-amber-500 hover:bg-amber-600 font-bold"
          >
            {exporting === 'pdf' ? <Loader2 className="w-5 h-5 animate-spin" /> : <><FileText className="w-4 h-4 mr-2" />PDF</>}
          </Button>
        </section>
        <p className="text-[11px] text-muted-foreground text-center">
          Tu peux aussi faire une capture d’écran de l’aperçu ci-dessus.
        </p>
      </div>
    </div>
  );
}
