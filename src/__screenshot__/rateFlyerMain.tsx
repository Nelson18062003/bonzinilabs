import { createRoot } from 'react-dom/client';
import '@/index.css';
import { RateFlyer } from '@/mobile/components/rates/RateFlyer';
const p = new URLSearchParams(window.location.search);
const theme = p.get('theme') === 'light' ? 'light' : 'dark';
const S = 0.34;
createRoot(document.getElementById('root')!).render(
  <div style={{ width: 2150 * S, height: 2560 * S, overflow: 'hidden' }}>
    <div style={{ transform: `scale(${S})`, transformOrigin: 'top left', width: 2150, height: 2560 }}>
      <RateFlyer alipay={11530} wechat={11480} bank={11350} cash={11200} theme={theme} />
    </div>
  </div>,
);
