/**
 * Le visuel des soldes — maquettes 07-tresorerie/28 (saisir) et 29 (l'image).
 *
 * Les 6 comptes fixes de l'image (MTN, Orange, UBA, Afriland, Ecobank, CCA),
 * un champ par compte, le total ; puis l'image à l'échelle de l'écran, en
 * clair ou en sombre, à partager (feuille native) ou en PDF. Même image que
 * sur ordinateur (`BalanceDashboardPreview`), sombre par défaut là-bas.
 */
import { useLayoutEffect, useRef, useState } from 'react';
import { FileText, Loader2, Share } from 'lucide-react';
import { toast } from 'sonner';
import { DASHBOARD_ACCOUNTS, LIGHT_COLORS, COLORS, PAGE } from './balance-dashboard/constants';
import { BalanceDashboardPreview } from './balance-dashboard/BalanceDashboardPreview';
import { captureDashboardPng, dashboardFileName, downloadDashboardPdf } from './balance-dashboard/export';
import { fmtNum } from '@/desktop/screens/treasury/treasuryFormat';
import { cn } from '@/lib/utils';
import { BigButton, Chip, Dock, SURFACE, ScreenTop, TEXT, TextInput, formatPad } from '@/mobile/designKit';
import { CapsLabel, TreasuryGate } from './parts';
import { shareOrDownload } from './treasuryMobile';

export function BalanceVisualScreen() {
  return (
    <TreasuryGate>
      <VisualBody />
    </TreasuryGate>
  );
}

function VisualBody() {
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [step, setStep] = useState<'edit' | 'image'>('edit');
  const balances = Object.fromEntries(DASHBOARD_ACCOUNTS.map((a) => [a.key, Number(texts[a.key] || 0)]));
  const total = DASHBOARD_ACCOUNTS.reduce((s, a) => s + (balances[a.key] || 0), 0);

  if (step === 'image') return <ImageStep balances={balances} onBack={() => setStep('edit')} />;

  return (
    <div className="flex min-h-full flex-col">
      <ScreenTop title="Visuel des soldes" />
      <div className="px-5 pt-5">
        <CapsLabel>Soldes en XAF</CapsLabel>
        <div className="mt-1">
          {DASHBOARD_ACCOUNTS.map((a) => (
            <div key={a.key} className={cn('flex items-center gap-3.5 border-b py-3', SURFACE.divider)}>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#D9D9D9] bg-white dark:border-[#444444]">
                <img src={a.logo} alt="" className="h-9 w-9 object-contain" />
              </span>
              <label htmlFor={`bv-${a.key}`} className="min-w-0 flex-1">
                <span className={cn('block truncate text-[17px] font-semibold', TEXT.strong)}>{a.name.replace(/ (Cameroon|First Bank)$/, '')}</span>
                <span className={cn('block text-[15px]', TEXT.muted)}>{a.type === 'Bank' ? 'Banque' : a.type}</span>
              </label>
              <TextInput
                id={`bv-${a.key}`}
                inputMode="numeric"
                value={texts[a.key] ? formatPad(texts[a.key]) : ''}
                placeholder="0"
                onChange={(e) => setTexts((t) => ({ ...t, [a.key]: e.target.value.replace(/\D/g, '').slice(0, 13) }))}
                className="h-12 w-[140px] shrink-0 text-right text-[17px] font-bold tabular-nums"
              />
            </div>
          ))}
        </div>
        <div className={cn('mt-4 flex items-center justify-between rounded-lg border px-4 py-4', SURFACE.divider)}>
          <span className={cn('text-[16px]', TEXT.muted)}>Total</span>
          <span className={cn('text-[22px] font-bold tabular-nums', TEXT.strong)}>{fmtNum(total, 0)} XAF</span>
        </div>
      </div>
      <Dock>
        <BigButton onClick={() => setStep('image')}>Voir l’image</BigButton>
      </Dock>
    </div>
  );
}

function ImageStep({ balances, onBack }: { balances: Record<string, number>; onBack: () => void }) {
  const previewRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [generatedAt] = useState(() => new Date());
  const [scale, setScale] = useState(0.55);
  const [busy, setBusy] = useState<'share' | 'pdf' | null>(null);

  useLayoutEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    const measure = () => node.clientWidth > 0 && setScale(Math.min(1, node.clientWidth / PAGE.width));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const bg = theme === 'light' ? LIGHT_COLORS.bg : COLORS.bg;
  const run = async (kind: 'share' | 'pdf') => {
    if (!previewRef.current || busy) return;
    setBusy(kind);
    try {
      if (kind === 'pdf') await downloadDashboardPdf(previewRef.current, bg);
      else await shareOrDownload(await captureDashboardPng(previewRef.current, bg), dashboardFileName('png'));
    } catch {
      toast.error('Impossible de préparer l’image');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <ScreenTop title="Visuel des soldes" onBack={onBack} />
      <div className="space-y-3 px-5 pt-4">
        <div className="flex gap-2">
          <Chip label="Clair" active={theme === 'light'} onClick={() => setTheme('light')} />
          <Chip label="Sombre" active={theme === 'dark'} onClick={() => setTheme('dark')} />
        </div>
        <div ref={wrapRef} className="w-full">
          <div className={cn('mx-auto overflow-hidden rounded-lg border', SURFACE.divider)} style={{ width: PAGE.width * scale, height: PAGE.height * scale }}>
            <div style={{ transformOrigin: 'top left', transform: `scale(${scale})`, width: PAGE.width, height: PAGE.height }}>
              <BalanceDashboardPreview ref={previewRef} balances={balances} generatedAt={generatedAt} theme={theme} />
            </div>
          </div>
        </div>
      </div>
      <Dock>
        <div className="grid grid-cols-[1.6fr_1fr] gap-2.5">
          <BigButton onClick={() => void run('share')} disabled={!!busy}>
            {busy === 'share' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Share className="h-5 w-5" />} Partager l’image
          </BigButton>
          <BigButton variant="soft" onClick={() => void run('pdf')} disabled={!!busy}>
            {busy === 'pdf' ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />} PDF
          </BigButton>
        </div>
      </Dock>
    </div>
  );
}
