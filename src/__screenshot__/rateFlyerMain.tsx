import { createRoot } from 'react-dom/client';
import '@/index.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/dm-sans/latin-700.css';
import '@fontsource/dm-sans/latin-800.css';
import '@fontsource/dm-sans/latin-900.css';
import { RateFlyer, FLYER_WIDTH, FLYER_HEIGHT } from '@/mobile/components/rates/RateFlyer';
import { buildFlyerData } from '@/lib/rateFlyer';
import type { DailyRate, RateAdjustment } from '@/types/rates';

// /flyer-real-preview.html?rates=cash,alipay,wechat,virement&country=gabon — le VRAI flyer
// de l'app (RateFlyer), avec les taux et réglages de production du 24/09/2026 par défaut.
const p = new URLSearchParams(window.location.search);
const [cash, alipay, wechat, virement] = (p.get('rates') ?? '10700,10800,10800,10800').split(',').map(Number);
const rate: DailyRate = { id: 'r', rate_cash: cash, rate_alipay: alipay, rate_wechat: wechat, rate_virement: virement, effective_at: '2026-09-24T06:02:56Z', created_at: '', created_by: null, is_active: true };
const adj = (type: 'country' | 'tier', key: string, percentage: number, is_reference = false): RateAdjustment =>
  ({ id: key, type, key, label: key, percentage, is_reference, sort_order: 0, updated_at: '', updated_by: null });
const flat = p.get('flat') === '1';
const adjustments: RateAdjustment[] = [
  adj('country', 'cameroun', 0, true), adj('country', 'gabon', -1), adj('country', 'tchad', -1), adj('country', 'rca', -1), adj('country', 'congo', -1), adj('country', 'guinee', -1),
  adj('tier', 't3', 0, true), adj('tier', 't2', Number(p.get('t2') ?? 0)), adj('tier', 't1', flat ? 0 : -2),
];
const data = buildFlyerData(rate, adjustments, p.get('country') ?? 'cameroun', new Date('2026-09-24T10:00:00Z'));
createRoot(document.getElementById('root')!).render(
  <div id="flyer" style={{ width: FLYER_WIDTH, height: FLYER_HEIGHT }}>
    <RateFlyer data={data} />
  </div>,
);
