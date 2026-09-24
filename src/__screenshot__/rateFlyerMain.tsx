import { createRoot } from 'react-dom/client';
import '@/index.css';
import { RateFlyer } from '@/mobile/components/rates/RateFlyer';
const p = new URLSearchParams(window.location.search);
const theme = p.get('theme') === 'light' ? 'light' : 'dark';
const S = 0.34;
// ?rates=alipay,wechat,bank,cash&country=Gabon,GA : les chiffres d'un jour réel.
const r = (p.get('rates') ?? '11530,11480,11350,11200').split(',').map(Number);
const c = p.get('country')?.split(',');
createRoot(document.getElementById('root')!).render(
  <div style={{ width: 2150 * S, height: 2560 * S, overflow: 'hidden' }}>
    <div style={{ transform: `scale(${S})`, transformOrigin: 'top left', width: 2150, height: 2560 }}>
      <RateFlyer alipay={r[0]} wechat={r[1]} bank={r[2]} cash={r[3]} theme={theme} country={c ? { label: c[0], iso: c[1] } : null} />
    </div>
  </div>,
);
