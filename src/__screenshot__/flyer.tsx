/**
 * DEV-ONLY maquette — refonte v2 du flyer "Taux du jour".
 * Priorités demandées par le client : TEXTE TRÈS GROS (clients 50+ ans),
 * VRAIS logos officiels Alipay/WeChat (chemins simple-icons), icônes propres
 * (pas d'emoji) pour Virement/Cash, structure claire, couleurs resserrées,
 * zéro dégradé / arc-en-ciel.
 *
 * Liste verticale → chaque taux a une ligne pleine largeur avec un chiffre
 * énorme. Rendu à /screenshot.html?screen=flyer (largeur 1000, hauteur auto).
 * Spec pour le port dans supabase/functions/generate-flyer (Satori).
 */
import type { ReactNode } from 'react';
import { Landmark, Banknote } from 'lucide-react';
import { cn } from '@/lib/utils';

// Logos officiels (simple-icons, viewBox 0 0 24 24).
const ALIPAY = 'M19.695 15.07c3.426 1.158 4.203 1.22 4.203 1.22V3.846c0-2.124-1.705-3.845-3.81-3.845H3.914C1.808.001.102 1.722.102 3.846v16.31c0 2.123 1.706 3.845 3.813 3.845h16.173c2.105 0 3.81-1.722 3.81-3.845v-.157s-6.19-2.602-9.315-4.119c-2.096 2.602-4.8 4.181-7.607 4.181-4.75 0-6.361-4.19-4.112-6.949.49-.602 1.324-1.175 2.617-1.497 2.025-.502 5.247.313 8.266 1.317a16.796 16.796 0 0 0 1.341-3.302H5.781v-.952h4.799V6.975H4.77v-.953h5.81V3.591s0-.409.411-.409h2.347v2.84h5.744v.951h-5.744v1.704h4.69a19.453 19.453 0 0 1-1.986 5.06c1.424.52 2.702 1.011 3.654 1.333m-13.81-2.032c-.596.06-1.71.325-2.321.869-1.83 1.608-.735 4.55 2.968 4.55 2.151 0 4.301-1.388 5.99-3.61-2.403-1.182-4.438-2.028-6.637-1.809';
const WECHAT = 'M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.27-.027-.407-.03zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z';

function Tile({ children }: { children: ReactNode }) {
  return <div className="flex h-[104px] w-[104px] shrink-0 items-center justify-center rounded-[26px]">{children}</div>;
}

const ROWS = [
  {
    name: 'Alipay', cn: '支付宝', note: 'Instantané', rate: '11 530',
    tile: (
      <div className="flex h-[104px] w-[104px] shrink-0 items-center justify-center rounded-[26px] bg-white ring-1 ring-black/[0.06]">
        <svg viewBox="0 0 24 24" className="h-[68px] w-[68px]" fill="#1677FF"><path d={ALIPAY} /></svg>
      </div>
    ),
  },
  {
    name: 'WeChat Pay', cn: '微信支付', note: 'Instantané', rate: '11 480',
    tile: (
      <div className="flex h-[104px] w-[104px] shrink-0 items-center justify-center rounded-[26px] bg-[#07C160]">
        <svg viewBox="0 0 24 24" className="h-[60px] w-[60px]" fill="#FFFFFF"><path d={WECHAT} /></svg>
      </div>
    ),
  },
  {
    name: 'Virement', cn: '银行转账', note: '1–2 h ouvrées', rate: '11 350',
    tile: <Tile><div className="flex h-[104px] w-[104px] items-center justify-center rounded-[26px] bg-[#ECE8F6] dark:bg-[#2A2738]"><Landmark className="h-[52px] w-[52px] text-[#2C2740] dark:text-[#E7E3F2]" strokeWidth={1.8} /></div></Tile>,
  },
  {
    name: 'Cash', cn: '现金', note: 'En main propre', rate: '11 200',
    tile: <Tile><div className="flex h-[104px] w-[104px] items-center justify-center rounded-[26px] bg-[#ECE8F6] dark:bg-[#2A2738]"><Banknote className="h-[52px] w-[52px] text-[#2C2740] dark:text-[#E7E3F2]" strokeWidth={1.8} /></div></Tile>,
  },
];

export function Flyer() {
  return (
    <div className="flex w-[1000px] flex-col gap-7 bg-[#F2F0F8] p-[52px] dark:bg-[#0D0C14]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[58px] font-black leading-none tracking-tight text-[#1A1726] dark:text-[#F1EEF8]">Bonzini</div>
          <div className="mt-2 text-[18px] font-semibold uppercase tracking-[0.28em] text-[#8B83A0]">Paiements vers la Chine</div>
        </div>
        <div className="rounded-full bg-[#1A1726] px-6 py-3.5 text-[24px] font-bold text-white dark:bg-[#F1EEF8] dark:text-[#1A1726]">
          Taux du jour
        </div>
      </div>

      {/* Date + heure */}
      <div className="flex items-end justify-between border-t border-[#1A1726]/10 pt-6 dark:border-white/10">
        <div>
          <div className="text-[34px] font-extrabold tracking-tight text-[#1A1726] dark:text-[#F1EEF8]">Dimanche 7 juin 2026</div>
          <div className="mt-1 text-[22px] text-[#8B83A0]">2026年6月7日 · 星期日</div>
        </div>
        <div className="text-right">
          <div className="text-[56px] font-black leading-none tracking-tight text-[#1A1726] dark:text-[#F1EEF8]">14:32</div>
          <div className="mt-1.5 text-[20px] text-[#8B83A0]">Guangzhou · UTC+8</div>
        </div>
      </div>

      {/* Contexte */}
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[24px] font-semibold text-[#8B83A0]">Pour</div>
          <div className="flex items-end gap-3">
            <span className="text-[80px] font-black leading-none tracking-tight text-[#1A1726] dark:text-[#F1EEF8]">1 000 000</span>
            <span className="mb-2.5 text-[40px] font-extrabold tracking-tight text-[#E8932A]">XAF</span>
          </div>
        </div>
        <div className="mb-2 max-w-[300px] text-right text-[22px] font-medium leading-snug text-[#8B83A0]">vous payez votre fournisseur en ¥ :</div>
      </div>

      {/* Lignes de taux (grosses) */}
      <div className="flex flex-col gap-4">
        {ROWS.map((r) => (
          <div key={r.name} className="flex items-center gap-6 rounded-[28px] bg-white p-6 shadow-[0_12px_40px_-16px_rgba(40,28,80,0.25)] dark:bg-[#191726] dark:shadow-none dark:ring-1 dark:ring-white/[0.06]">
            {r.tile}
            <div className="min-w-0 flex-1">
              <div className="text-[44px] font-extrabold leading-none tracking-tight text-[#1A1726] dark:text-[#F1EEF8]">{r.name}</div>
              <div className="mt-2 text-[24px] text-[#8B83A0]">{r.cn} · {r.note}</div>
            </div>
            <div className="flex items-end gap-2">
              <span className="mb-3 text-[44px] font-bold text-[#C3BDD2] dark:text-[#5C5772]">¥</span>
              <span className="text-[88px] font-black leading-none tracking-tighter text-[#1A1726] dark:text-[#F1EEF8]">{r.rate}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-[#1A1726]/10 pt-6 dark:border-white/10">
        <div className="flex items-center justify-between">
          <div className="text-[36px] font-extrabold tracking-tight text-[#1A1726] dark:text-[#F1EEF8]">bonzinilabs.com</div>
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-[18px] font-bold text-white">W</div>
              <div>
                <div className="text-[16px] text-[#8B83A0]">Cameroun</div>
                <div className="text-[24px] font-bold tracking-tight text-[#1A1726] dark:text-[#F1EEF8]">+237 652 236 856</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#07C160] text-[18px] font-bold text-white">W</div>
              <div>
                <div className="text-[16px] text-[#8B83A0]">中国 · 微信</div>
                <div className="text-[24px] font-bold tracking-tight text-[#1A1726] dark:text-[#F1EEF8]">+86 131 3849 5598</div>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-5 text-[17px] leading-relaxed text-[#A8A2B8]">
          Taux indicatifs, susceptibles de varier sans préavis. · 显示汇率仅供参考，可能随时变动。
        </div>
      </div>
    </div>
  );
}
