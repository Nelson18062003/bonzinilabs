/**
 * DEV-ONLY maquette v8 — LISTE enrichie : barre de RECHERCHE + FILTRES
 * (statut : Tous/À traiter/En cours/Terminés · période : Ce mois…).
 * Les paiements « à traiter » (rouge) remontent en tête. Pas de numérotation
 * (la référence BZ-PM-… suffit). Reste du langage = v7.
 * Harness: ?screen=cpay-list-v8
 */
import { LOGO_PATH } from '@/mobile/designKit/methods';
import { SURFACE, TEXT } from '@/mobile/designKit/tokens';
import { Landmark, Send, ArrowRight, ChevronRight, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

type MKey = 'alipay' | 'wechat' | 'bank' | 'cash';
const RED = '#C0504D', LILAC = '#8B5CF6', GREEN = '#2E7D52';

function MethodLogo({ k, size = 44, radius = 22 }: { k: MKey; size?: number; radius?: number }) {
  const s = { width: size, height: size, borderRadius: radius };
  if (k === 'alipay') return <div style={s} className="flex shrink-0 items-center justify-center bg-white ring-1 ring-black/[0.06]"><svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} fill="#1677FF"><path d={LOGO_PATH.alipay} /></svg></div>;
  if (k === 'wechat') return <div style={s} className="flex shrink-0 items-center justify-center bg-[#07C160]"><svg viewBox="0 0 24 24" width={size * 0.56} height={size * 0.56} fill="#fff"><path d={LOGO_PATH.wechat} /></svg></div>;
  return <div style={s} className="flex shrink-0 items-center justify-center bg-[#ECE8F6] text-[#2C2740] dark:bg-[#2A2738] dark:text-[#E7E3F2]"><Landmark style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={1.8} /></div>;
}
function Progress({ step, color }: { step: number; color: string }) {
  return <div className="flex items-center gap-1">{[0, 1, 2, 3].map((i) => <div key={i} className={cn('h-1.5 flex-1 rounded-full', i > step && 'bg-black/[0.08] dark:bg-white/[0.10]')} style={i <= step ? { background: color } : undefined} />)}</div>;
}
function Pill({ label, color }: { label: string; color: string }) {
  return <span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ color, background: `${color}1F` }}>{label}</span>;
}

export function PayListV8() {
  return (
    <div className={cn('mx-auto min-h-screen max-w-[420px]', SURFACE.canvas)}>
      <div className="space-y-4 p-4 pt-6">
        <div className="px-1">
          <h1 className={cn('text-[26px] font-black leading-tight', TEXT.strong)}>Paiements</h1>
          <p className={cn('mt-0.5 text-[13px]', TEXT.muted)}>Réglez vos fournisseurs en Chine</p>
        </div>

        {/* Payer */}
        <button className={cn('flex w-full items-center gap-4 rounded-[24px] p-5 text-left', SURFACE.card, SURFACE.shadow)}>
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#1C1B22] dark:bg-[#F2F1F7]"><Send className="h-[26px] w-[26px] text-white dark:text-[#1B1A24]" strokeWidth={2.2} /></div>
          <div className="min-w-0 flex-1">
            <div className={cn('text-[17px] font-black', TEXT.strong)}>Payer un fournisseur</div>
            <div className={cn('mt-0.5 text-[12px]', TEXT.muted)}>Taux du jour · <span className="font-bold text-[#E8932A]">11 350</span> ¥ / 1 000 000 XAF</div>
          </div>
          <ArrowRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
        </button>

        {/* Recherche */}
        <div className={cn('flex items-center gap-2.5 rounded-full px-4 py-3', SURFACE.card, SURFACE.shadow)}>
          <Search className={cn('h-[18px] w-[18px] shrink-0', TEXT.muted)} />
          <span className={cn('truncate text-[14px]', TEXT.muted)}>Rechercher un fournisseur, une référence…</span>
        </div>

        {/* Filtres : statut + période */}
        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[['Tous', true], ['À traiter', false, '2'], ['En cours', false], ['Terminés', false]].map(([label, active, count]) => (
            <button key={label as string} className={cn('flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-bold', active ? 'bg-[#8B5CF6] text-white' : cn(SURFACE.card, SURFACE.shadow, TEXT.muted))}>
              {label as string}
              {count ? <span className="rounded-full bg-[#C0504D] px-1.5 text-[10px] text-white">{count as string}</span> : null}
            </button>
          ))}
          <div className="mx-1 h-5 w-px shrink-0 bg-black/[0.08] dark:bg-white/[0.10]" />
          <button className={cn('flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-bold', SURFACE.card, SURFACE.shadow, TEXT.muted)}>
            Ce mois <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Liste (à traiter en tête, rouge) */}
        <div className="space-y-3 pt-1">
          {/* À traiter — rouge */}
          <div className="rounded-[22px] bg-[#FBE7E7] p-4 dark:bg-[#3A2526]">
            <div className="flex items-center gap-3">
              <MethodLogo k="bank" />
              <div className="min-w-0 flex-1">
                <div className={cn('truncate text-[16px] font-bold', TEXT.strong)}>Yiwu Trading Ltd</div>
                <div className="mt-0.5 text-[12px] font-semibold" style={{ color: RED }}>Coordonnées manquantes</div>
              </div>
              <Pill label="À compléter" color={RED} />
            </div>
            <div className="mt-3.5"><Progress step={1} color={RED} /></div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[12px] font-semibold" style={{ color: RED }}>BZ-PM-2403 · à compléter</span>
              <ChevronRight className="h-4 w-4" style={{ color: RED }} />
            </div>
          </div>

          {[
            { k: 'alipay' as MKey, n: 'Guangzhou Textile Co.', rmb: '28 825', xaf: '2 500 000', step: 2, color: LILAC, label: 'En cours', ref: 'BZ-PM-2401 · aujourd’hui' },
            { k: 'wechat' as MKey, n: 'Shenzhen Electronics', rmb: '9 648', xaf: '850 000', step: 3, color: GREEN, label: 'Payé', ref: 'BZ-PM-2398 · 9 juin' },
          ].map((p) => (
            <div key={p.n} className={cn('rounded-[22px] p-4', SURFACE.card, SURFACE.shadow)}>
              <div className="flex items-center gap-3">
                <MethodLogo k={p.k} />
                <div className="min-w-0 flex-1">
                  <div className={cn('truncate text-[16px] font-bold', TEXT.strong)}>{p.n}</div>
                  <div className={cn('mt-0.5 text-[12px] tabular-nums', TEXT.muted)}>¥ {p.rmb} · −{p.xaf} XAF</div>
                </div>
                <Pill label={p.label} color={p.color} />
              </div>
              <div className="mt-3.5"><Progress step={p.step} color={p.color} /></div>
              <div className="mt-2 flex items-center justify-between"><span className={cn('text-[12px]', TEXT.muted)}>{p.ref}</span><ChevronRight className={cn('h-4 w-4', TEXT.muted)} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
