import { useRef, useState } from 'react';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PAYMENT_METHODS } from '@/types/rates';
import type { DailyRate } from '@/types/rates';
import { useCreateDailyRates } from '@/hooks/useDailyRates';
import { RateFlyer } from '@/mobile/components/rates/RateFlyer';
import { downloadFlyerPNG, downloadFlyerPDF } from '@/lib/exportFlyer';

interface RateSetTabProps {
  currentRate: DailyRate | null | undefined;
}

export function RateSetTab({ currentRate }: RateSetTabProps) {
  const [direction, setDirection] = useState<'xaf_cny' | 'cny_xaf'>('xaf_cny');
  const [rates, setRates] = useState<Record<string, string>>({
    cash: currentRate?.rate_cash?.toString() || '',
    alipay: currentRate?.rate_alipay?.toString() || '',
    wechat: currentRate?.rate_wechat?.toString() || '',
    virement: currentRate?.rate_virement?.toString() || '',
  });
  const [dateOption, setDateOption] = useState<'now' | 'today' | 'yesterday' | 'custom'>('now');
  const [customDate, setCustomDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [customHour, setCustomHour] = useState(new Date().getHours());
  const [customMin, setCustomMin] = useState(0);
  const [flyerDark, setFlyerDark] = useState(true);
  const [exportingPNG, setExportingPNG] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const flyerExportRef = useRef<HTMLDivElement>(null);

  const createRates = useCreateDailyRates();

  const getEffectiveAt = (): string => {
    const now = new Date();
    if (dateOption === 'now') return now.toISOString();
    if (dateOption === 'today') {
      now.setHours(0, 0, 0, 0);
      return now.toISOString();
    }
    if (dateOption === 'yesterday') {
      now.setDate(now.getDate() - 1);
      now.setHours(0, 0, 0, 0);
      return now.toISOString();
    }
    // custom
    const d = new Date(customDate);
    d.setHours(customHour, customMin, 0, 0);
    return d.toISOString();
  };

  const handleApply = () => {
    createRates.mutate({
      rate_cash: parseInt(rates.cash) || 0,
      rate_alipay: parseInt(rates.alipay) || 0,
      rate_wechat: parseInt(rates.wechat) || 0,
      rate_virement: parseInt(rates.virement) || 0,
      effective_at: getEffectiveAt(),
    });
  };

  return (
    <div className="space-y-5">
      {/* Direction toggle */}
      <div className="flex gap-2">
        {[
          { key: 'cny_xaf' as const, label: '1 CNY \u2192 XAF' },
          { key: 'xaf_cny' as const, label: '1M XAF \u2192 CNY' },
        ].map((d) => (
          <button
            key={d.key}
            onClick={() => setDirection(d.key)}
            className={`flex-1 py-3 rounded-xl font-semibold text-[13px] cursor-pointer border-2 transition-colors ${
              direction === d.key
                ? 'border-purple-600 bg-purple-50 text-purple-600'
                : 'border-border bg-white text-muted-foreground'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <p className="text-[13px] text-muted-foreground font-medium">
        {direction === 'xaf_cny'
          ? 'CNY pour 1 000 000 XAF par mode :'
          : 'XAF pour 1 CNY par mode :'}
      </p>

      {/* Rate inputs */}
      <div className="space-y-2.5">
        {PAYMENT_METHODS.map((pm) => (
          <div
            key={pm.key}
            className="bg-white rounded-[14px] p-3.5 flex items-center gap-3 shadow-sm border border-border/50"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: `${pm.color}15` }}
            >
              {pm.icon}
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-foreground">{pm.label}</div>
              <div className="text-[11px] text-muted-foreground">
                {direction === 'xaf_cny' ? 'CNY / 1M XAF' : 'XAF / 1 CNY'}
              </div>
            </div>
            <Input
              type="text"
              value={rates[pm.key]}
              onChange={(e) => setRates({ ...rates, [pm.key]: e.target.value })}
              className="w-[100px] text-right text-base font-bold"
            />
          </div>
        ))}
      </div>

      {/* Verification block */}
      <div
        className="rounded-[14px] p-4 border"
        style={{
          background: 'linear-gradient(135deg, #f8f0ff, #eef2ff)',
          borderColor: '#e8daff',
        }}
      >
        <div className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-1">
          Verification de vos taux saisis
        </div>
        <div className="text-[11px] text-muted-foreground mb-3">
          Taux de base (meilleur cas : Cameroun, gros montant &ge; 1M XAF). Les
          ajustements pays et tranches s'appliqueront automatiquement.
        </div>
        {PAYMENT_METHODS.map((pm) => {
          const val = parseFloat(rates[pm.key]) || 0;
          return (
            <div
              key={pm.key}
              className="flex justify-between items-center py-2 border-b border-purple-600/10 last:border-0"
            >
              <div className="flex items-center gap-2">
                <span className="text-base">{pm.icon}</span>
                <div>
                  <div className="text-[13px] font-semibold text-foreground">{pm.label}</div>
                  <div className="text-[11px] text-muted-foreground">
                    1M XAF = {val.toLocaleString('fr-FR')} CNY
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[15px] font-bold text-purple-600">
                  {val.toLocaleString('fr-FR')}
                </div>
                <div className="text-[10px] text-muted-foreground">CNY</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Date selector */}
      <div>
        <p className="text-sm font-semibold text-foreground mb-2.5">Date d'effet</p>
        <div className="flex gap-2 mb-2.5">
          {[
            { key: 'now' as const, label: 'Maintenant' },
            { key: 'today' as const, label: "Aujourd'hui" },
            { key: 'yesterday' as const, label: 'Hier' },
          ].map((d) => (
            <button
              key={d.key}
              onClick={() => setDateOption(d.key)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold cursor-pointer border-0 transition-colors ${
                dateOption === d.key
                  ? 'bg-purple-600 text-white'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setDateOption('custom')}
          className={`w-full py-3 rounded-xl text-[13px] font-medium cursor-pointer flex items-center justify-center gap-2 border-2 transition-colors ${
            dateOption === 'custom'
              ? 'border-purple-600 bg-purple-50 text-purple-600'
              : 'border-border bg-white text-muted-foreground'
          }`}
        >
          Autre date...
        </button>

        {dateOption === 'custom' && (
          <div className="bg-white rounded-xl p-3.5 border border-border mt-2.5 space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                Date
              </label>
              <Input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="font-semibold"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                Heure
              </label>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setCustomHour((h) => Math.max(0, h - 1))}
                  className="w-10 h-10 rounded-xl border border-border bg-muted/50 text-lg cursor-pointer flex items-center justify-center"
                >
                  &minus;
                </button>
                <div className="w-14 h-11 rounded-xl bg-muted flex items-center justify-center text-[22px] font-extrabold text-foreground">
                  {String(customHour).padStart(2, '0')}
                </div>
                <button
                  onClick={() => setCustomHour((h) => Math.min(23, h + 1))}
                  className="w-10 h-10 rounded-xl border border-border bg-muted/50 text-lg cursor-pointer flex items-center justify-center"
                >
                  +
                </button>
                <span className="text-[22px] font-extrabold text-foreground">:</span>
                <button
                  onClick={() => setCustomMin((m) => Math.max(0, m - 1))}
                  className="w-10 h-10 rounded-xl border border-border bg-muted/50 text-lg cursor-pointer flex items-center justify-center"
                >
                  &minus;
                </button>
                <div className="w-14 h-11 rounded-xl bg-muted flex items-center justify-center text-[22px] font-extrabold text-foreground">
                  {String(customMin).padStart(2, '0')}
                </div>
                <button
                  onClick={() => setCustomMin((m) => Math.min(59, m + 1))}
                  className="w-10 h-10 rounded-xl border border-border bg-muted/50 text-lg cursor-pointer flex items-center justify-center"
                >
                  +
                </button>
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg py-2 px-3 text-center text-[13px] text-purple-600 font-semibold">
              {customDate.split('-').reverse().join('/')} a {String(customHour).padStart(2, '0')}:{String(customMin).padStart(2, '0')}
            </div>
          </div>
        )}
      </div>

      {/* Apply button */}
      <Button
        onClick={handleApply}
        disabled={createRates.isPending}
        className="w-full py-6 rounded-[14px] text-base font-bold shadow-lg"
        style={{
          background: createRates.isSuccess
            ? 'linear-gradient(135deg, #10b981, #059669)'
            : 'linear-gradient(135deg, #a78bfa, #7c3aed)',
        }}
      >
        {createRates.isPending ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : createRates.isSuccess ? (
          '\u2713 Taux appliques !'
        ) : (
          'Appliquer les nouveaux taux'
        )}
      </Button>

      {/* ── FLYER DU JOUR ── */}
      <div className="mt-2 rounded-[18px] border border-border/60 overflow-hidden" style={{ background: 'linear-gradient(135deg,#f8f0ff,#eef2ff)' }}>
        {/* Header */}
        <div className="px-4 pt-4 pb-3 flex items-center justify-between">
          <div>
            <div className="text-[14px] font-extrabold text-foreground">Flyer du jour</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Taux actuels — prêt à partager</div>
          </div>
          {/* Dark / Light toggle */}
          <div className="flex gap-1.5">
            {(['dark', 'light'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFlyerDark(t === 'dark')}
                className="px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer border-0 transition-colors"
                style={{
                  background: (t === 'dark') === flyerDark ? '#7c3aed' : 'rgba(0,0,0,0.06)',
                  color: (t === 'dark') === flyerDark ? '#fff' : 'rgba(0,0,0,0.4)',
                }}
              >
                {t === 'dark' ? 'Dark' : 'Light'}
              </button>
            ))}
          </div>
        </div>

        {/* Miniature preview */}
        <div className="px-4 pb-3 overflow-hidden flex justify-center">
          <div style={{ transform: 'scale(0.42)', transformOrigin: 'top center', height: 900 * 0.42, pointerEvents: 'none' }}>
            <RateFlyer
              rates={{
                alipay: parseInt(rates.alipay) || currentRate?.rate_alipay || 0,
                wechat: parseInt(rates.wechat) || currentRate?.rate_wechat || 0,
                bank: parseInt(rates.virement) || currentRate?.rate_virement || 0,
                cash: parseInt(rates.cash) || currentRate?.rate_cash || 0,
              }}
              dark={flyerDark}
            />
          </div>
        </div>

        {/* Export buttons */}
        <div className="px-4 pb-4 flex gap-2.5">
          <button
            onClick={async () => {
              if (!flyerExportRef.current || exportingPNG) return;
              setExportingPNG(true);
              try { await downloadFlyerPNG(flyerExportRef.current); }
              finally { setExportingPNG(false); }
            }}
            className="flex-1 py-3 rounded-[12px] text-[13px] font-bold cursor-pointer border-0 flex items-center justify-center gap-2 transition-opacity"
            style={{ background: '#7c3aed', color: '#fff', opacity: exportingPNG ? 0.6 : 1 }}
          >
            {exportingPNG ? <Loader2 className="w-4 h-4 animate-spin" /> : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>}
            PNG
          </button>
          <button
            onClick={async () => {
              if (!flyerExportRef.current || exportingPDF) return;
              setExportingPDF(true);
              try { await downloadFlyerPDF(flyerExportRef.current); }
              finally { setExportingPDF(false); }
            }}
            className="flex-1 py-3 rounded-[12px] text-[13px] font-bold cursor-pointer border-0 flex items-center justify-center gap-2 transition-opacity"
            style={{ background: '#f3a745', color: '#fff', opacity: exportingPDF ? 0.6 : 1 }}
          >
            {exportingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
            PDF
          </button>
        </div>
      </div>

      {/* Flyer caché à pleine taille pour l'export — opacity:0 dans le viewport pour que html2canvas rende correctement */}
      <div style={{ position: 'fixed', top: 0, left: 0, opacity: 0, pointerEvents: 'none', zIndex: -1 }}>
        <div ref={flyerExportRef} style={{ width: 440 }}>
          <RateFlyer
            rates={{
              alipay: parseInt(rates.alipay) || currentRate?.rate_alipay || 0,
              wechat: parseInt(rates.wechat) || currentRate?.rate_wechat || 0,
              bank: parseInt(rates.virement) || currentRate?.rate_virement || 0,
              cash: parseInt(rates.cash) || currentRate?.rate_cash || 0,
            }}
            dark={flyerDark}
          />
        </div>
      </div>
    </div>
  );
}
