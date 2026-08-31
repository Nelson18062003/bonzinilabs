/**
 * Taux — vue « Simulateur » (l'écran par défaut du module).
 *
 * Le geste quotidien : un client écrit sur WhatsApp « j'ai 1M XAF, combien
 * reçoit mon fournisseur ? » ou « il me faut ¥50 000, je donne combien ? ».
 * Ici les DEUX champs sont liés : on tape dans l'un OU l'autre, l'autre se
 * calcule en direct — plus de bascule d'unité à comprendre. À droite, la
 * cotation au langage du flyer, prête à partager : téléchargée en PNG
 * (même pipeline html-to-image que le flyer) ou copiée en texte WhatsApp.
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownUp, Check, Copy, Download, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { TextField } from '@/components/form';
import { parseDecimal } from '@/lib/decimalInput';
import { PAYMENT_METHODS, COUNTRIES } from '@/types/rates';
import type { PaymentMethodKey, RateAdjustment, DailyRate } from '@/types/rates';
import { calculateFinalRate, getBaseRate, convertCNYtoXAF } from '@/lib/rateCalculation';
import { formatNumber } from '@/lib/formatters';
import { downloadNodePNG } from '@/lib/exportFlyer';
import { SURFACE, TEXT, Card, CardHeader, Chip, SecLabel, StatusPill, ScreenError, ScreenLoader } from '@/desktop/designKit';
import { MethodLogo } from '@/mobile/screens/rates/components/MethodLogo';
import { RateQuoteCard, QUOTE_W, QUOTE_H } from './RateQuoteCard';

interface Props {
  activeRate: DailyRate | null | undefined;
  adjustments: RateAdjustment[];
  adjustmentsLoading?: boolean;
  adjustmentsError?: boolean;
}

const FR_DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

export function RateQuoteSimulator({ activeRate, adjustments, adjustmentsLoading, adjustmentsError }: Props) {
  // UNE seule valeur saisie + le côté où elle vit — l'autre côté est TOUJOURS
  // dérivé au rendu : aucun effet de synchronisation, aucune dérive possible.
  const [amountStr, setAmountStr] = useState('1000000');
  const [side, setSide] = useState<'xaf' | 'cny'>('xaf');
  const [method, setMethod] = useState<PaymentMethodKey>('alipay');
  const [country, setCountry] = useState('cameroun');
  const [quoteTheme, setQuoteTheme] = useState<'dark' | 'light'>('dark');
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  // Champ dont le montant vient d'être copié (retour visuel ✓).
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Taux personnalisé (négocié avec le client) — vide = taux automatique.
  const [customRateStr, setCustomRateStr] = useState('');

  const countryAdjs = useMemo(() => adjustments.filter((a) => a.type === 'country'), [adjustments]);
  const tierAdjs = useMemo(() => adjustments.filter((a) => a.type === 'tier'), [adjustments]);

  const amount = parseInt(amountStr.replace(/\D/g, '')) || 0;
  const customRate = parseDecimal(customRateStr);
  const hasCustomRate = Number.isFinite(customRate) && customRate > 0;

  // Le taux « du jour » (auto) — calculé même quand un taux personnalisé est
  // appliqué, pour afficher l'écart à l'admin.
  const autoCalc = useMemo(() => {
    if (!activeRate || amount <= 0) return null;
    const baseRate = getBaseRate(activeRate, method);
    const countryPct = countryAdjs.find((c) => c.key === country)?.percentage ?? 0;
    const amountXAF = side === 'xaf' ? amount : convertCNYtoXAF(amount, baseRate, countryPct, tierAdjs);
    if (amountXAF <= 0) return null;
    const calc = calculateFinalRate(baseRate, countryPct, amountXAF, tierAdjs);
    return {
      amountXAF,
      amountCNY: side === 'cny' ? amount : calc.amountCNY,
      baseRate,
      countryPct,
      tierPct: tierAdjs.find((t) => t.key === calc.tierKey)?.percentage ?? 0,
      finalRate: calc.finalRate,
    };
  }, [activeRate, amount, side, method, country, countryAdjs, tierAdjs]);

  const result = useMemo(() => {
    if (amount <= 0) return null;
    // Taux personnalisé : conversion directe — les ajustements pays/tranche
    // ne s'appliquent pas, l'admin fixe le taux final lui-même.
    if (hasCustomRate) {
      const perUnit = customRate / 1_000_000;
      const amountXAF = side === 'xaf' ? amount : Math.round(amount / perUnit);
      const amountCNY = side === 'cny' ? amount : Math.round(amountXAF * perUnit * 100) / 100;
      return { ...(autoCalc ?? { baseRate: null, countryPct: null, tierPct: null }), amountXAF, amountCNY, finalRate: customRate, custom: true as const };
    }
    return autoCalc ? { ...autoCalc, custom: false as const } : null;
  }, [amount, side, hasCustomRate, customRate, autoCalc]);

  // Champ édité = la saisie ; champ opposé = la valeur dérivée, formatée.
  const xafDisplay = side === 'xaf' ? (amount > 0 ? formatNumber(amount) : '') : result ? formatNumber(result.amountXAF) : '';
  const cnyDisplay = side === 'cny' ? (amount > 0 ? formatNumber(amount) : '') : result ? formatNumber(Math.round(result.amountCNY)) : '';

  const editSide = (s: 'xaf' | 'cny') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    setSide(s);
    setAmountStr(raw);
  };

  // Aperçu à l'échelle du conteneur (même mécanique que RateFlyerSheet) —
  // via CALLBACK ref : le conteneur n'existe qu'une fois les taux chargés,
  // un ref classique mesuré au montage resterait à 0 et l'aperçu vide.
  const quoteNodeRef = useRef<HTMLDivElement>(null);
  const [previewEl, setPreviewEl] = useState<HTMLDivElement | null>(null);
  const [previewW, setPreviewW] = useState(0);
  useLayoutEffect(() => {
    if (!previewEl) return;
    const ro = new ResizeObserver(() => setPreviewW(previewEl.clientWidth));
    ro.observe(previewEl);
    setPreviewW(previewEl.clientWidth);
    return () => ro.disconnect();
  }, [previewEl]);
  const scale = previewW > 0 ? previewW / QUOTE_W : 0;

  const methodLabel = PAYMENT_METHODS.find((p) => p.key === method)?.label ?? method;
  const countryLabel = COUNTRIES.find((c) => c.key === country)?.label ?? country;

  const downloadQuote = async () => {
    if (exporting || !quoteNodeRef.current || !result) return;
    setExporting(true);
    try {
      await downloadNodePNG(
        quoteNodeRef.current,
        QUOTE_W,
        QUOTE_H,
        `bonzini_cotation_${new Date().toISOString().slice(0, 10)}.png`,
      );
    } catch {
      toast.error("Échec de l'export de la cotation — réessayez");
    } finally {
      setExporting(false);
    }
  };

  const copyQuoteText = async () => {
    if (!result) return;
    const now = new Date();
    const lines = [
      `🧾 Cotation Bonzini — ${FR_DAYS[now.getDay()]} ${now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`,
      `Vous payez : ${result.amountXAF.toLocaleString('fr-FR')} XAF`,
      `Votre fournisseur reçoit : ¥${Math.round(result.amountCNY).toLocaleString('fr-FR')} (${methodLabel})`,
      `Taux : ¥${result.finalRate.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} / 1M XAF — valable aujourd'hui`,
      `WhatsApp : +237 652 236 856 · bonzinilabs.com`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copie impossible dans ce navigateur');
    }
  };

  const adjClass = (v: number) =>
    v < 0 ? 'text-[#C0504D] dark:text-[#E79A9A]' : 'text-[#2E7D52] dark:text-[#7FCBA0]';

  if (adjustmentsLoading) return <ScreenLoader />;

  const bigField = (
    label: string,
    unit: React.ReactNode,
    value: string,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
    active: boolean,
    placeholder: string,
    id: string,
    /** Texte copié tel quel (« ¥11 000 ») — répondre au client sans retaper. */
    copyText: string | null,
  ) => (
    <label
      htmlFor={id}
      className={cn(
        'block cursor-text rounded-2xl px-4 py-3 transition',
        SURFACE.canvas,
        active && 'ring-2 ring-[#8B5CF6]',
      )}
    >
      <span className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>{label}</span>
      <span className="mt-0.5 flex items-baseline gap-2">
        {/* Gros chiffre 30px — input nu voulu pour l'unité inline. */}
        {/* eslint-disable-next-line no-restricted-syntax */}
        <input
          id={id}
          inputMode="numeric"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={cn(
            'min-w-0 flex-1 bg-transparent text-[30px] font-black leading-none tabular-nums outline-none',
            'placeholder:text-[#C7C2D6] dark:placeholder:text-[#4A4658]',
            TEXT.strong,
          )}
        />
        {unit}
        {copyText && (
          <button
            type="button"
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              try {
                await navigator.clipboard.writeText(copyText);
                setCopiedField(id);
                setTimeout(() => setCopiedField((cur) => (cur === id ? null : cur)), 1600);
              } catch {
                toast.error('Copie impossible dans ce navigateur');
              }
            }}
            aria-label={`Copier ${copyText}`}
            title={`Copier ${copyText}`}
            className={cn(
              'flex h-8 w-8 shrink-0 -translate-y-0.5 items-center justify-center self-center rounded-full transition',
              copiedField === id ? 'bg-[#DEEFE5] text-[#2E7D52] dark:bg-[#1E3A2C] dark:text-[#7FCBA0]' : cn(SURFACE.holder, TEXT.muted),
            )}
          >
            {copiedField === id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        )}
      </span>
    </label>
  );

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[440px_minmax(0,1fr)]">
      {/* ── Saisie — la conversation avec le client ─────────────────────── */}
      <Card className="p-0">
        <CardHeader title="Simulateur" meta={activeRate ? 'taux actifs' : 'aucun taux actif'} />
        <div className="space-y-3 p-4">
          {adjustmentsError && (
            <div className="rounded-xl bg-[#F8EFD8] px-3 py-2 text-[12px] font-semibold text-[#9A6B12] dark:bg-[#372D14] dark:text-[#E7C083]">
              Ajustements pays/tranches indisponibles — calcul sans eux.
            </div>
          )}

          {bigField(
            'Le client paie',
            <span className="shrink-0 text-[15px] font-extrabold text-[#E8932A]">XAF</span>,
            xafDisplay,
            editSide('xaf'),
            side === 'xaf',
            '1 000 000',
            'quote-xaf',
            result ? `${result.amountXAF.toLocaleString('fr-FR')} XAF` : null,
          )}

          <div className="flex items-center justify-center">
            <span className={cn('flex h-8 w-8 items-center justify-center rounded-full', SURFACE.holder)}>
              <ArrowDownUp className={cn('h-4 w-4', TEXT.muted)} />
            </span>
          </div>

          {bigField(
            'Le fournisseur reçoit',
            <span className={cn('shrink-0 text-[17px] font-extrabold', TEXT.muted)}>CNY</span>,
            cnyDisplay,
            editSide('cny'),
            side === 'cny',
            '11 500',
            'quote-cny',
            result ? `¥${Math.round(result.amountCNY).toLocaleString('fr-FR')}` : null,
          )}

          <p className={cn('px-1 text-[11px]', TEXT.muted)}>
            Tapez dans l'un ou l'autre champ — l'autre se calcule tout seul.
          </p>

          <div className="grid grid-cols-4 gap-1.5 pt-1">
            {PAYMENT_METHODS.map((pm) => {
              const active = method === pm.key;
              return (
                <button
                  key={pm.key}
                  type="button"
                  onClick={() => setMethod(pm.key)}
                  aria-pressed={active}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-xl py-2 transition',
                    active ? 'bg-[#EDEAFA] dark:bg-[#2A2738]' : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]',
                  )}
                >
                  <MethodLogo method={pm.key} size={28} />
                  <span className={cn('text-[10px] font-semibold', active ? TEXT.strong : TEXT.muted)}>{pm.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {COUNTRIES.map((c) => (
              <Chip key={c.key} label={c.label} active={country === c.key} onClick={() => setCountry(c.key)} />
            ))}
          </div>

          {/* Détail du calcul — pour l'admin, jamais dans l'image partagée.
              Le taux appliqué est ÉDITABLE : taux négocié avec le client. */}
          <div className="space-y-1.5 border-t border-black/[0.06] pt-3 text-[12px] dark:border-white/[0.08]">
            <SecLabel>Détail du calcul</SecLabel>
            {/* Dérivation automatique — grisée quand un taux personnalisé la remplace */}
            <div className={cn('space-y-1.5', hasCustomRate && 'opacity-50')}>
              <div className="flex justify-between gap-2">
                <span className={TEXT.muted}>Taux base ({methodLabel})</span>
                <span className={cn('font-semibold tabular-nums', TEXT.strong)}>
                  {result?.baseRate != null ? result.baseRate.toLocaleString('fr-FR') : '—'}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className={TEXT.muted}>Pays ({countryLabel})</span>
                <span className={cn('font-semibold tabular-nums', adjClass(result?.countryPct ?? 0))}>
                  {result?.countryPct != null ? `${result.countryPct}%` : '—'}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className={TEXT.muted}>Tranche</span>
                <span className={cn('font-semibold tabular-nums', adjClass(result?.tierPct ?? 0))}>
                  {result?.tierPct != null ? `${result.tierPct}%` : '—'}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-black/[0.06] pt-1.5 dark:border-white/[0.08]">
              <span className={cn('flex items-center gap-1.5 font-bold', TEXT.strong)}>
                Taux appliqué
                {hasCustomRate && <StatusPill tone="pending" label="Personnalisé" />}
              </span>
              <span className="flex items-center gap-1">
                <TextField
                  variant="decimal"
                  size="sm"
                  value={customRateStr}
                  onChange={(e) => setCustomRateStr(e.target.value)}
                  placeholder={autoCalc ? autoCalc.finalRate.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) : '—'}
                  wrapperClassName="w-[96px]"
                  controlClassName="h-8 text-right text-[13px] font-black tabular-nums text-[#5B4CC4] dark:text-[#B5AAF0]"
                  aria-label="Taux appliqué (modifiable)"
                />
                {customRateStr !== '' && (
                  <button
                    type="button"
                    onClick={() => setCustomRateStr('')}
                    aria-label="Revenir au taux automatique"
                    title="Revenir au taux automatique"
                    className={cn('flex h-6 w-6 items-center justify-center rounded-full', SURFACE.holder)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            </div>
            {hasCustomRate && autoCalc && (
              <p className={cn('text-[11px]', customRate < autoCalc.finalRate ? 'text-[#C0504D] dark:text-[#E79A9A]' : 'text-[#2E7D52] dark:text-[#7FCBA0]')}>
                Écart vs taux du jour ({autoCalc.finalRate.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}) :{' '}
                {customRate >= autoCalc.finalRate ? '+' : ''}
                {(customRate - autoCalc.finalRate).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ¥ / 1M
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* ── Cotation à partager ─────────────────────────────────────────── */}
      <Card className="p-0">
        <CardHeader
          title="Cotation à partager"
          meta={
            <span className="inline-flex items-center gap-1.5">
              <Chip label="Sombre" active={quoteTheme === 'dark'} onClick={() => setQuoteTheme('dark')} />
              <Chip label="Clair" active={quoteTheme === 'light'} onClick={() => setQuoteTheme('light')} />
            </span>
          }
        />
        <div className="p-4">
          {!activeRate && !hasCustomRate ? (
            <ScreenError title="Aucun taux actif" description="Publiez les taux du jour — ou saisissez un taux personnalisé — pour coter un client." />
          ) : result ? (
            <>
              <div ref={setPreviewEl} className="mx-auto max-w-[520px]">
                {scale > 0 && (
                  <div className="overflow-hidden rounded-2xl ring-1 ring-black/[0.07] dark:ring-white/[0.08]" style={{ height: Math.round(QUOTE_H * scale) }}>
                    <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: QUOTE_W, pointerEvents: 'none' }}>
                      <div ref={quoteNodeRef} style={{ width: QUOTE_W, height: QUOTE_H }}>
                        <RateQuoteCard
                          amountXAF={result.amountXAF}
                          amountCNY={result.amountCNY}
                          method={method}
                          finalRate={result.finalRate}
                          countryLabel={countryLabel}
                          theme={quoteTheme}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="mx-auto mt-3 flex max-w-[520px] gap-2.5">
                <button
                  type="button"
                  onClick={downloadQuote}
                  disabled={exporting}
                  className="flex flex-[1.5] items-center justify-center gap-2 rounded-full bg-[#1C1B22] py-3 text-[13.5px] font-bold text-white transition active:scale-[0.98] disabled:opacity-60 dark:bg-[#F2F1F7] dark:text-[#1B1A24]"
                >
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Télécharger l'image
                </button>
                <button
                  type="button"
                  onClick={copyQuoteText}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-[13.5px] font-bold transition active:scale-[0.98]',
                    copied ? 'bg-[#DEEFE5] text-[#2E7D52] dark:bg-[#1E3A2C] dark:text-[#7FCBA0]' : cn(SURFACE.card, 'ring-1 ring-black/[0.08] dark:ring-white/[0.10]', TEXT.strong),
                  )}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copié !' : 'Copier le texte'}
                </button>
              </div>
            </>
          ) : (
            <div className={cn('flex h-[420px] items-center justify-center rounded-2xl text-[13px]', SURFACE.canvas, TEXT.muted)}>
              Saisissez un montant pour générer la cotation
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
