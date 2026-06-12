import { useLayoutEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Download, FileText } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { MoneyField } from '@/components/treasury/MoneyField';
import { PrimaryPill, SectionTitle, SOFT_CARD } from '@/components/treasury/ui';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { cn } from '@/lib/utils';
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
    <div className="flex flex-col min-h-full bg-background">
      <MobileHeader title="Dashboard soldes" showBack backTo="/m/more/treasury" />

      <div className="px-5 py-5 space-y-6">
        {/* Form */}
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

        {/* Live preview */}
        <section>
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
        </section>

        {/* Export buttons */}
        <section className="grid grid-cols-2 gap-2.5">
          <PrimaryPill onClick={() => handleExport('png')} disabled={exporting !== null} loading={exporting === 'png'}>
            <Download className="mr-2 h-4 w-4" />
            PNG
          </PrimaryPill>
          <PrimaryPill onClick={() => handleExport('pdf')} disabled={exporting !== null} loading={exporting === 'pdf'}>
            <FileText className="mr-2 h-4 w-4" />
            PDF
          </PrimaryPill>
        </section>
        <p className="text-center text-[11px] text-muted-foreground">
          Tu peux aussi faire une capture d’écran de l’aperçu ci-dessus.
        </p>
      </div>
    </div>
  );
}
