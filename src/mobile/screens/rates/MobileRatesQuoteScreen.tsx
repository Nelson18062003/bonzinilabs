/**
 * Cotation · image à partager (maquette 08-taux/24).
 *
 * La VRAIE image de marque `RateQuoteCard` (couleurs et mise en page
 * inchangées : c'est le contenu envoyé au client), en français ou anglais,
 * sombre ou clair. « Taux appliqué · Modifier » pose un taux personnalisé.
 * « Partager l'image » ouvre la feuille de partage du téléphone (WhatsApp,
 * Enregistrer…), et télécharge sur ordinateur ; « Copier le texte » copie le
 * texte WhatsApp. Les chiffres viennent de l'URL (le simulateur).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Check, Copy, Download, Share } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RateQuoteCard, QUOTE_H, QUOTE_W } from '@/desktop/screens/rates/RateQuoteCard';
import { FLYER_TEXT, type FlyerLang } from '@/lib/rateFlyer';
import { loadFlyerFonts } from '@/lib/flyerFonts';
import { captureNodePng } from '@/lib/nodeImage';
import { copyImageFile, deliverFile, downloadFile } from '@/components/customer-code/exportShippingLabel';
import { ActionSheet, BigButton, Chip, Dock, EmptyLine, KVBox, MoreButton, ScreenTop, TEXT, useSheet } from '@/mobile/designKit';
import { CustomRateSheet } from './CustomRateSheet';
import { DockSpacer } from './parts';
import { computeQuote, quoteSearch, quoteText, readQuote } from './quoteCalc';
import { METHOD_NAME, dec } from './rateFormat';
import { useRatesData } from './useRatesData';

const LANG_KEY = 'bz.quote.lang';

export function MobileRatesQuoteScreen() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const q = useMemo(() => readQuote(params), [params]);
  const { activeRate, adjustments, sheets } = useRatesData();
  const result = computeQuote(activeRate, adjustments, q);
  const more = useSheet();
  const customSheet = useSheet();

  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [lang, setLangState] = useState<FlyerLang>(() => { try { return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'fr'; } catch { return 'fr'; } });
  const setLang = (l: FlyerLang) => { setLangState(l); try { localStorage.setItem(LANG_KEY, l); } catch { /* navigation privée */ } };
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const sheet = sheets.find((s) => s.key === q.country) ?? sheets.find((s) => s.isReference);
  const countryLabel = (FLYER_TEXT[lang].countries as Record<string, string>)[q.country] ?? sheet?.label ?? q.country;

  // Aperçu à l'échelle du conteneur ; le nœud capturé, lui, reste en taille naturelle.
  const nodeRef = useRef<HTMLDivElement>(null);
  useEffect(() => { void loadFlyerFonts().catch(() => undefined); }, []);
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    if (!box) return;
    const ro = new ResizeObserver(() => setW(box.clientWidth));
    ro.observe(box);
    setW(box.clientWidth);
    return () => ro.disconnect();
  }, [box]);
  const scale = w > 0 ? w / QUOTE_W : 0;

  const makeFile = async (): Promise<File> => {
    if (!nodeRef.current) throw new Error('Aperçu absent');
    const extraFontCSS = await loadFlyerFonts().catch(() => '');
    const dataUrl = await captureNodePng(nodeRef.current, { width: QUOTE_W, height: QUOTE_H, pixelRatio: 1, extraFontCSS, webkitWarmup: true });
    const blob = await (await fetch(dataUrl)).blob();
    const name = `bonzini_${lang === 'en' ? 'quote' : 'cotation'}_${new Date().toISOString().slice(0, 10)}.png`;
    return new File([blob], name, { type: 'image/png' });
  };

  const run = async (what: 'share' | 'download' | 'copy') => {
    if (busy || !result) return;
    setBusy(true);
    try {
      const file = await makeFile();
      if (what === 'download') { downloadFile(file); toast.success('Image téléchargée'); }
      else if (what === 'copy') {
        const o = await copyImageFile(file);
        if (o === 'copied') toast.success('Image copiée');
        else if (o === 'downloaded') toast.success('Image téléchargée');
      } else {
        const o = await deliverFile(file, 'Cotation Bonzini');
        if (o === 'downloaded') toast.success('Image téléchargée');
      }
    } catch {
      toast.error('Image impossible à créer — réessayez');
    } finally {
      setBusy(false);
    }
  };

  const copyText = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(quoteText(result, q.method, METHOD_NAME[q.method], lang));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copie impossible sur cet appareil');
    }
  };

  const setCustom = (rate: number) => {
    setParams(quoteSearch({ ...q, customRate: rate }), { replace: true });
  };

  return (
    <div className="flex min-h-full flex-col">
      <ScreenTop
        title="Cotation"
        onBack={() => navigate(`/m/more/rates/simulator?${quoteSearch(q)}`)}
        right={<MoreButton onClick={more.show} />}
      />

      {!result ? (
        <EmptyLine action={{ label: 'Simulateur', onClick: () => navigate('/m/more/rates/simulator') }}>
          {activeRate ? 'Montant manquant' : 'Aucun taux publié'}
        </EmptyLine>
      ) : (
        <>
          <div className="px-5 pt-5">
            <div ref={setBox} className="overflow-hidden rounded-lg border border-[#D9D9D9] dark:border-[#444444]" style={{ height: scale > 0 ? Math.round(QUOTE_H * scale) : undefined, aspectRatio: scale > 0 ? undefined : '1 / 1' }}>
              {scale > 0 && (
                <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: QUOTE_W, pointerEvents: 'none' }}>
                  <div ref={nodeRef} style={{ width: QUOTE_W, height: QUOTE_H }}>
                    <RateQuoteCard
                      amountXAF={result.amountXAF}
                      amountCNY={result.amountCNY}
                      method={q.method}
                      finalRate={result.finalRate}
                      countryLabel={countryLabel}
                      showCountry={!(sheet?.isReference ?? q.country === 'cameroun')}
                      theme={theme}
                      lang={lang}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 px-5 pt-4">
            <Chip label="FR" active={lang === 'fr'} onClick={() => setLang('fr')} />
            <Chip label="EN" active={lang === 'en'} onClick={() => setLang('en')} />
            <span className="w-3" aria-hidden />
            <Chip label="Sombre" active={theme === 'dark'} onClick={() => setTheme('dark')} />
            <Chip label="Clair" active={theme === 'light'} onClick={() => setTheme('light')} />
          </div>

          <div className="px-5 pt-4">
            <KVBox
              rows={[{
                label: result.custom ? 'Taux personnalisé' : 'Taux appliqué',
                value: (
                  <span className="inline-flex items-center gap-5">
                    {dec(result.finalRate)}
                    <button type="button" onClick={customSheet.show} className={cn('-my-2 py-2 font-semibold underline underline-offset-[3px]', TEXT.strong)}>Modifier</button>
                  </span>
                ),
              }]}
            />
          </div>

          <DockSpacer />
          <Dock>
            <BigButton onClick={() => void run('share')} loading={busy}><Share className="h-5 w-5" /> Partager l’image</BigButton>
            <BigButton variant="soft" onClick={() => void copyText()}>
              {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />} {copied ? 'Texte copié' : 'Copier le texte'}
            </BigButton>
          </Dock>
        </>
      )}

      <ActionSheet
        open={more.open}
        onClose={more.hide}
        actions={[
          { label: 'Télécharger l’image', icon: Download, onClick: () => void run('download'), disabled: !result },
          { label: 'Copier l’image', icon: Copy, onClick: () => void run('copy'), disabled: !result },
        ]}
      />
      <CustomRateSheet
        open={customSheet.open}
        onClose={customSheet.hide}
        auto={result?.auto?.finalRate ?? null}
        custom={q.customRate}
        onApply={setCustom}
      />
    </div>
  );
}
