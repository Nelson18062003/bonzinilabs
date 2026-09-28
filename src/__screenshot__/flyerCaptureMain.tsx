import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RateFlyer, FLYER_WIDTH, FLYER_HEIGHT } from '@/mobile/components/rates/RateFlyer';
import { buildFlyerData, type FlyerLang } from '@/lib/rateFlyer';
import { flyerPngFile } from '@/lib/exportFlyer';
import type { DailyRate, RateAdjustment } from '@/types/rates';

// /flyer-capture-preview.html?country=gabon&lang=en — le flyer PHOTOGRAPHIÉ par le
// vrai pipeline (flyerPngFile), comme dans le panneau « Flyer du jour ».
// Sert à vérifier l'image elle-même (polices, drapeaux), pas seulement le DOM.
const p = new URLSearchParams(window.location.search);
const rate: DailyRate = { id: 'r', rate_cash: 10700, rate_alipay: 10800, rate_wechat: 10800, rate_virement: 10800, effective_at: '2026-09-24T06:02:56Z', created_at: '', created_by: null, is_active: true };
const adj = (type: 'country' | 'tier', key: string, percentage: number, is_reference = false): RateAdjustment =>
  ({ id: key, type, key, label: key, percentage, is_reference, sort_order: 0, updated_at: '', updated_by: null });
const adjustments: RateAdjustment[] = [
  adj('country', 'cameroun', 0, true), adj('country', 'gabon', -1), adj('country', 'tchad', -1), adj('country', 'rca', -1), adj('country', 'congo', -1), adj('country', 'guinee', -1),
  adj('tier', 't3', 0, true), adj('tier', 't2', Number(p.get('t2') ?? 0)), adj('tier', 't1', -2),
];
const data = buildFlyerData(rate, adjustments, p.get('country') ?? 'cameroun', new Date('2026-09-28T10:00:00Z'), (p.get('lang') as FlyerLang) ?? 'fr');

// ?domfont=1 : DM Sans présente À L'ÉCRAN (API FontFace, comme une police déjà
// en cache) mais introuvable pour la capture — le cas « flyer cassé ».
async function domFont() {
  if (p.get('domfont') !== '1') return;
  const w = [600, 700, 800, 900];
  const urls = await Promise.all(w.map((x) => import(`../../node_modules/@fontsource/dm-sans/files/dm-sans-latin-${x}-normal.woff2?url`).then((m) => m.default as string)));
  await Promise.all(urls.map(async (u, i) => { const f = new FontFace('DM Sans', `url(${u})`, { weight: String(w[i]) }); await f.load(); document.fonts.add(f); }));
}

function App() {
  const node = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const t0 = performance.now();
    void domFont().then(() => new Promise((r) => requestAnimationFrame(r))).then(() => flyerPngFile(node.current!, data.country.key, data.lang)
      ).then((f) => { setUrl(URL.createObjectURL(f)); (window as unknown as { __captureMs: number }).__captureMs = Math.round(performance.now() - t0); })
      .catch((e) => setErr(String(e)));
  }, []);
  return (
    <>
      {url && <img id="out" src={url} style={{ width: FLYER_WIDTH, height: FLYER_HEIGHT, display: 'block' }} />}
      {err && <pre id="err">{err}</pre>}
      <div aria-hidden style={{ position: 'fixed', left: -20000, top: 0, width: FLYER_WIDTH, height: FLYER_HEIGHT }}>
        <div ref={node} style={{ width: FLYER_WIDTH, height: FLYER_HEIGHT }}><RateFlyer data={data} /></div>
      </div>
    </>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
