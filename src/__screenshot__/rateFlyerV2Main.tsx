import { createRoot } from 'react-dom/client';
import '@/index.css';
// Google Fonts n'est pas joignable ici : DM Sans depuis node_modules.
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/dm-sans/latin-700.css';
import '@fontsource/dm-sans/latin-800.css';
import '@fontsource/dm-sans/latin-900.css';
import { BASE_2409, COUNTRIES_2409, DATE_2409, FlyerEssential, FlyerSimple, FlyerTable, TIERS_2409 } from './rateFlyerV2';
import type { Base } from './rateFlyerV2';

// /rate-flyer-v2.html?variant=table|essential&country=gabon[&diverge=1][&flat=1]
const p = new URLSearchParams(window.location.search);
const country = COUNTRIES_2409.find((c) => c.key === p.get('country')) ?? COUNTRIES_2409[0];
// diverge=1 : un jour où les modes n'ont pas le même taux (13/05 : 11 350 / 11 400 / 11 400 / 11 450).
const base: Base = p.get('diverge') ? { cash: 11350, alipay: 11400, wechat: 11400, virement: 11450 } : BASE_2409;
// flat=1 : tous les paliers à 0 % (un seul taux, comme le flyer actuel).
const tiers = p.get('flat') ? TIERS_2409.map((t) => ({ ...t, pct: 0 })) : TIERS_2409;
const v = p.get('variant');
const Flyer = v === 'table' ? FlyerTable : v === 'simple' ? FlyerSimple : v === 'rouge' ? (props: Parameters<typeof FlyerSimple>[0]) => <FlyerSimple {...props} alert /> : v === 'simple1' ? (props: Parameters<typeof FlyerSimple>[0]) => <FlyerSimple {...props} small={false} /> : FlyerEssential;
createRoot(document.getElementById('root')!).render(
  <div id="flyer" style={{ width: 1080, height: 1350 }}>
    <Flyer country={country} base={base} tiers={tiers} date={DATE_2409} />
  </div>,
);
