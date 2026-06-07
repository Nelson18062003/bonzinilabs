/**
 * DEV-ONLY maquette — refonte du flyer "Taux du jour" dans le langage de la réf
 * (Ofspace Banking) : surface douce, cartes blanches à ombre diffuse, AUCUN
 * dégradé / barre arc-en-ciel, gros chiffres NEUTRES, couleur réservée aux
 * icônes de méthode (reconnaissance Alipay/WeChat). Ratio réel 2150×2560 → 860×1024.
 *
 * Rendu à /screenshot.html?screen=flyer. C'est la spec pour porter ensuite le
 * design dans supabase/functions/generate-flyer (Satori).
 */
import type { ReactNode } from 'react';
import { Landmark, Banknote } from 'lucide-react';
import { cn } from '@/lib/utils';

const RATES = [
  { name: 'Alipay', cn: '支付宝', note: 'Instantané · 即时到账', rate: '11 530', chip: 'bg-[#1677FF]', glyph: '支' as ReactNode },
  { name: 'WeChat Pay', cn: '微信支付', note: 'Instantané · 即时到账', rate: '11 480', chip: 'bg-[#07C160]', glyph: '微' as ReactNode },
  { name: 'Virement', cn: '银行转账', note: '1–2 h ouvrées · 工作时间', rate: '11 350', chip: 'neutral', glyph: <Landmark className="h-6 w-6" /> },
  { name: 'Cash', cn: '现金', note: 'Remise en main propre · 现场', rate: '11 200', chip: 'neutral', glyph: <Banknote className="h-6 w-6" /> },
];

function RateCard({ r }: { r: typeof RATES[number] }) {
  const neutral = r.chip === 'neutral';
  return (
    <div className="flex flex-col rounded-[20px] bg-white p-5 shadow-[0_10px_34px_-14px_rgba(40,28,80,0.22)] dark:bg-[#19172180] dark:shadow-none dark:ring-1 dark:ring-white/5">
      <div className="flex items-center gap-3">
        <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px]', neutral ? 'bg-[#EEEAF7] text-[#2C2740] dark:bg-[#2A2738] dark:text-[#E7E3F2]' : cn(r.chip, 'text-white'))}>
          {typeof r.glyph === 'string' ? <span className="text-[26px] font-bold leading-none">{r.glyph}</span> : r.glyph}
        </div>
        <div className="min-w-0">
          <div className="text-[20px] font-bold leading-tight text-[#1A1726] dark:text-[#F1EEF8]">{r.name}</div>
          <div className="text-[13px] text-[#8B83A0]">{r.cn}</div>
        </div>
      </div>
      <div className="mt-3 flex items-end gap-1.5">
        <span className="mb-1 text-[22px] font-bold text-[#C3BDD2] dark:text-[#5C5772]">¥</span>
        <span className="text-[46px] font-black leading-none tracking-tight text-[#1A1726] dark:text-[#F1EEF8]">{r.rate}</span>
      </div>
      <div className="mt-2 text-[12.5px] font-medium text-[#8B83A0]">{r.note}</div>
    </div>
  );
}

function Contact({ region, cn: cnLabel, phone, dot }: { region: string; cn: string; phone: string; dot: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={cn('flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold text-white', dot)}>W</div>
      <div>
        <div className="text-[11.5px] text-[#8B83A0]">{cnLabel}</div>
        <div className="text-[16px] font-bold tracking-tight text-[#1A1726] dark:text-[#F1EEF8]">{phone}</div>
      </div>
    </div>
  );
}

export function Flyer() {
  return (
    <div className="flex h-[1024px] w-[860px] flex-col justify-between bg-[#F3F1F9] p-11 dark:bg-[#0D0C14]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[40px] font-black leading-none tracking-tight text-[#1A1726] dark:text-[#F1EEF8]">Bonzini</div>
          <div className="mt-1.5 text-[12px] font-medium uppercase tracking-[0.3em] text-[#8B83A0]">Paiements vers la Chine</div>
        </div>
        <div className="rounded-full bg-[#1A1726] px-4 py-2 text-[13px] font-bold text-white dark:bg-[#F1EEF8] dark:text-[#1A1726]">
          Taux du jour · 今日汇率
        </div>
      </div>

      {/* Date + heure */}
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[15px] text-[#8B83A0]">2026年6月7日，星期日</div>
          <div className="text-[22px] font-bold tracking-tight text-[#1A1726] dark:text-[#F1EEF8]">Dimanche 7 juin 2026</div>
        </div>
        <div className="text-right">
          <div className="text-[36px] font-black leading-none tracking-tight text-[#1A1726] dark:text-[#F1EEF8]">14:32</div>
          <div className="mt-1 text-[12px] text-[#8B83A0]">Guangzhou · UTC+8</div>
        </div>
      </div>

      {/* Héro */}
      <div>
        <div className="text-[15px] font-medium text-[#8B83A0]">Pour</div>
        <div className="flex items-end gap-3">
          <span className="text-[68px] font-black leading-none tracking-tight text-[#1A1726] dark:text-[#F1EEF8]">1 000 000</span>
          <span className="mb-2 text-[30px] font-extrabold tracking-tight text-[#E8932A]">XAF</span>
        </div>
        <div className="mt-1.5 text-[15px] font-medium text-[#8B83A0]">vous réglez votre fournisseur en ¥ :</div>
      </div>

      {/* Grille 2×2 */}
      <div className="grid grid-cols-2 gap-4">
        {RATES.map((r) => <RateCard key={r.name} r={r} />)}
      </div>

      {/* Footer */}
      <div>
        <div className="h-px w-full bg-[#1A1726]/10 dark:bg-white/10" />
        <div className="mt-5 flex items-center justify-between">
          <div className="text-[24px] font-extrabold tracking-tight text-[#1A1726] dark:text-[#F1EEF8]">bonzinilabs.com</div>
          <div className="flex items-center gap-6">
            <Contact region="CM" cn="Cameroun · WhatsApp" phone="+237 652 236 856" dot="bg-[#25D366]" />
            <Contact region="CN" cn="中国 · WhatsApp / 微信" phone="+86 131 3849 5598" dot="bg-[#07C160]" />
          </div>
        </div>
        <div className="mt-4 text-[11.5px] leading-relaxed text-[#A8A2B8]">
          Les taux affichés sont indicatifs et peuvent varier sans préavis. · 显示汇率仅供参考，可能随时变动。
        </div>
      </div>
    </div>
  );
}
