/**
 * DEV-ONLY maquette — module TAUX (rates) dans le langage designKit Ofspace/Mola.
 * Autonome (n'importe QUE les tokens designKit que j'ai écrits + raw Tailwind),
 * pour ne pas dépendre des composants du kit pendant qu'un worker tourne.
 * Rendu via un entry standalone (rates-preview.html) sur un port dédié.
 *
 * Montre les 3 écrans clés du module : Définir les taux du jour · Simulateur ·
 * Historique. Données statiques d'exemple.
 */
import { SURFACE, TEXT, PRIMARY_PILL, SOFT_PILL, TONE_PILL } from '@/mobile/designKit/tokens';
import { PAYMENT_METHOD, LOGO_PATH } from '@/mobile/designKit/methods';
import { Landmark, ArrowLeftRight, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type Key = 'alipay' | 'wechat' | 'virement' | 'cash';

function MethodLogo({ k, size = 44 }: { k: Key; size?: number }) {
  const s = { width: size, height: size };
  if (k === 'alipay')
    return (
      <div style={s} className="flex shrink-0 items-center justify-center rounded-2xl bg-white ring-1 ring-black/[0.06]">
        <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} fill="#1677FF"><path d={LOGO_PATH.alipay} /></svg>
      </div>
    );
  if (k === 'wechat')
    return (
      <div style={s} className="flex shrink-0 items-center justify-center rounded-2xl bg-[#07C160]">
        <svg viewBox="0 0 24 24" width={size * 0.56} height={size * 0.56} fill="#fff"><path d={LOGO_PATH.wechat} /></svg>
      </div>
    );
  if (k === 'cash')
    return (
      <div style={s} className="flex shrink-0 items-center justify-center rounded-2xl bg-[#E0322B]">
        <span className="font-black leading-none text-white" style={{ fontSize: size * 0.5 }}>¥</span>
      </div>
    );
  return (
    <div style={s} className="flex shrink-0 items-center justify-center rounded-2xl bg-[#ECE8F6] text-[#2C2740] dark:bg-[#2A2738] dark:text-[#E7E3F2]">
      <Landmark style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={1.8} />
    </div>
  );
}

const RATES: { k: Key; value: string }[] = [
  { k: 'alipay', value: '11 530' },
  { k: 'wechat', value: '11 480' },
  { k: 'virement', value: '11 350' },
  { k: 'cash', value: '11 200' },
];

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('rounded-[26px] p-5', SURFACE.card, SURFACE.shadow, className)}>{children}</div>;
}

function Caption({ children }: { children: React.ReactNode }) {
  return <p className="px-1 pt-2 text-[12px] font-bold uppercase tracking-wider text-[#8E8BA0]">{children}</p>;
}

function Seg({ items, active }: { items: string[]; active: number }) {
  return (
    <div className="flex rounded-full bg-[#EDEAFA] p-1 dark:bg-[#2A2738]">
      {items.map((it, i) => (
        <div
          key={it}
          className={cn(
            'flex-1 rounded-full py-2 text-center text-[13px] font-bold',
            i === active ? 'bg-white text-[#1B1A24] shadow-sm dark:bg-[#3A3650] dark:text-white' : 'text-[#8E8BA0]',
          )}
        >
          {it}
        </div>
      ))}
    </div>
  );
}

export function Rates() {
  return (
    <div className={cn('min-h-screen space-y-3 px-4 py-6', SURFACE.canvas)} style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="flex items-center justify-between px-1">
        <div className={cn('text-[26px] font-black tracking-tight', TEXT.strong)}>Taux</div>
        <div className={cn('text-[13px] font-semibold', TEXT.muted)}>Dimanche 8 juin · 14:32</div>
      </div>

      {/* A — Définir les taux du jour */}
      <Caption>Définir les taux du jour</Caption>
      <Card>
        <Seg items={['XAF → CNY', 'CNY → XAF']} active={0} />
        <div className="mt-4 flex items-baseline gap-2">
          <span className={cn('text-[13px] font-medium', TEXT.muted)}>Pour</span>
          <span className={cn('text-[24px] font-black tabular-nums', TEXT.strong)}>1 000 000</span>
          <span className="text-[15px] font-extrabold text-[#E8932A]">XAF</span>
        </div>
        <div className="mt-3 space-y-2.5">
          {RATES.map(({ k, value }) => (
            <div key={k} className="flex items-center gap-3">
              <MethodLogo k={k} size={44} />
              <div className="min-w-0 flex-1">
                <div className={cn('text-[15px] font-bold leading-tight', TEXT.strong)}>{PAYMENT_METHOD[k].label}</div>
                <div className="text-[12px] text-[#8E8BA0]">{PAYMENT_METHOD[k].cn}</div>
              </div>
              <div className="flex items-center gap-1.5 rounded-2xl bg-[#F3F1F9] px-3 py-2 dark:bg-[#2A2738]">
                <span className="text-[15px] font-bold text-[#C3BDD2] dark:text-[#5C5772]">¥</span>
                <span className={cn('text-[22px] font-black tabular-nums', TEXT.strong)}>{value}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#F3F1F9] px-4 py-3 dark:bg-[#2A2738]">
          <span className={cn('text-[13px] font-medium', TEXT.muted)}>Appliqué dès</span>
          <span className={cn('text-[14px] font-bold', TEXT.strong)}>Maintenant</span>
        </div>
        <button className={cn('mt-4 w-full py-[14px] text-[15px] font-bold', PRIMARY_PILL)}>Publier les taux</button>
      </Card>

      {/* B — Simulateur */}
      <Caption>Simulateur</Caption>
      <Card>
        <Seg items={['Depuis XAF', 'Depuis CNY']} active={0} />
        <div className="mt-4">
          <div className={cn('text-[12px] font-medium', TEXT.muted)}>Montant</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={cn('text-[40px] font-black leading-none tabular-nums', TEXT.strong)}>1 000 000</span>
            <span className="text-[18px] font-extrabold text-[#E8932A]">XAF</span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {(['alipay', 'wechat', 'virement', 'cash'] as Key[]).map((k, i) => (
            <div key={k} className={cn('flex flex-col items-center gap-1.5 rounded-2xl p-2', i === 0 ? 'bg-[#EDEAFA] dark:bg-[#2A2738]' : '')}>
              <MethodLogo k={k} size={38} />
              <span className="text-[10px] font-semibold text-[#8E8BA0]">{PAYMENT_METHOD[k].label}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-2xl bg-[#EDEAFA] p-4 dark:bg-[#221F33]">
          <div className={cn('text-[12px] font-medium', TEXT.muted)}>Votre fournisseur reçoit</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-[28px] font-black text-[#C3BDD2] dark:text-[#5C5772]">¥</span>
            <span className={cn('text-[40px] font-black leading-none tabular-nums', TEXT.strong)}>11 530</span>
          </div>
          <div className="mt-1 text-[12px] text-[#8E8BA0]">via Alipay · taux 11,53 / 1000 XAF</div>
        </div>
      </Card>

      {/* C — Historique */}
      <Caption>Historique</Caption>
      <Card className="!p-4">
        {[{ d: "Aujourd'hui", active: true, v: ['11 530', '11 480', '11 350', '11 200'] }, { d: 'Hier', active: false, v: ['11 510', '11 460', '11 330', '11 180'] }].map((row, idx) => (
          <div key={row.d} className={cn('flex items-center gap-3 py-3', idx === 0 && 'border-b border-black/5 dark:border-white/10')}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EDEAFA] dark:bg-[#2A2738]">
              <ArrowLeftRight className="h-4 w-4 text-[#2C2740] dark:text-[#E7E3F2]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={cn('text-[15px] font-bold', TEXT.strong)}>{row.d}</span>
                {row.active && <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', TONE_PILL.success)}>Actif</span>}
              </div>
              <div className="mt-0.5 text-[12px] tabular-nums text-[#8E8BA0]">¥ {row.v.join(' · ')}</div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-[#C3BDD2]" />
          </div>
        ))}
      </Card>

      {/* D — accès flyer */}
      <button className={cn('flex w-full items-center justify-center gap-1.5 py-[13px] text-[14px] font-semibold', SOFT_PILL)}>
        Voir le flyer du jour <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
