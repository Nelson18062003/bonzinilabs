/**
 * DEV-ONLY maquettes v7 — COHÉRENCE & STRUCTURE.
 * LISTE : icône d'ENVOI (avion) au lieu du « + » sur la carte Payer.
 * FICHE : rythme « intitulé → bloc » (comme le module Taux), moins de boîtes
 *   flottantes, hiérarchie nette (montant = héros), regroupement « preuve +
 *   détails ». Reçu en haut · taux « 1 000 000 XAF = 11 350 ¥ ».
 * Harness: ?screen=cpay-list-v7 | cpay-detail-v7
 */
import { LOGO_PATH } from '@/mobile/designKit/methods';
import { SURFACE, TEXT, PRIMARY_PILL } from '@/mobile/designKit/tokens';
import { Landmark, Send, ArrowLeft, ArrowRight, Copy, ChevronRight, Download, QrCode, Check, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type MKey = 'alipay' | 'wechat' | 'bank' | 'cash';
const RED = '#C0504D', LILAC = '#8B5CF6', GREEN = '#2E7D52';

function MethodLogo({ k, size = 44, radius = 14 }: { k: MKey; size?: number; radius?: number }) {
  const s = { width: size, height: size, borderRadius: radius };
  if (k === 'alipay') return <div style={s} className="flex shrink-0 items-center justify-center bg-white ring-1 ring-black/[0.06]"><svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} fill="#1677FF"><path d={LOGO_PATH.alipay} /></svg></div>;
  if (k === 'wechat') return <div style={s} className="flex shrink-0 items-center justify-center bg-[#07C160]"><svg viewBox="0 0 24 24" width={size * 0.56} height={size * 0.56} fill="#fff"><path d={LOGO_PATH.wechat} /></svg></div>;
  if (k === 'cash') return <div style={s} className="flex shrink-0 items-center justify-center bg-[#E0322B]"><span className="font-black leading-none text-white" style={{ fontSize: size * 0.5 }}>¥</span></div>;
  return <div style={s} className="flex shrink-0 items-center justify-center bg-[#ECE8F6] text-[#2C2740] dark:bg-[#2A2738] dark:text-[#E7E3F2]"><Landmark style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={1.8} /></div>;
}
function Progress({ step, color }: { step: number; color: string }) {
  return <div className="flex items-center gap-1">{[0, 1, 2, 3].map((i) => <div key={i} className={cn('h-1.5 flex-1 rounded-full', i > step && 'bg-black/[0.08] dark:bg-white/[0.10]')} style={i <= step ? { background: color } : undefined} />)}</div>;
}
function Pill({ label, color }: { label: string; color: string }) {
  return <span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ color, background: `${color}1F` }}>{label}</span>;
}
function Caption({ children }: { children: React.ReactNode }) {
  return <h2 className={cn('mb-2 px-1.5 text-[11.5px] font-bold uppercase tracking-wider', TEXT.muted)}>{children}</h2>;
}

/* ============================ LISTE v7 ============================ */
export function PayListV7() {
  return (
    <div className={cn('mx-auto min-h-screen max-w-[420px]', SURFACE.canvas)}>
      <div className="space-y-6 p-4 pt-6">
        <div className="px-1">
          <h1 className={cn('text-[26px] font-black leading-tight', TEXT.strong)}>Paiements</h1>
          <p className={cn('mt-0.5 text-[13px]', TEXT.muted)}>Réglez vos fournisseurs en Chine</p>
        </div>

        <button className={cn('flex w-full items-center gap-4 rounded-[24px] p-5 text-left', SURFACE.card, SURFACE.shadow)}>
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#1C1B22] dark:bg-[#F2F1F7]"><Send className="h-[26px] w-[26px] text-white dark:text-[#1B1A24]" strokeWidth={2.2} /></div>
          <div className="min-w-0 flex-1">
            <div className={cn('text-[17px] font-black', TEXT.strong)}>Payer un fournisseur</div>
            <div className={cn('mt-0.5 text-[12px]', TEXT.muted)}>Taux du jour · <span className="font-bold text-[#E8932A]">11 350</span> ¥ / 1 000 000 XAF</div>
          </div>
          <ArrowRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
        </button>

        <section>
          <h2 className="mb-2 px-1.5 text-[11.5px] font-bold uppercase tracking-wider" style={{ color: RED }}>À traiter · urgent</h2>
          <div className="rounded-[22px] bg-[#FBE7E7] p-4 dark:bg-[#3A2526]">
            <div className="flex items-center gap-3">
              <MethodLogo k="bank" size={44} radius={22} />
              <div className="min-w-0 flex-1">
                <div className={cn('truncate text-[16px] font-bold', TEXT.strong)}>Yiwu Trading Ltd</div>
                <div className="mt-0.5 text-[12px] font-semibold" style={{ color: RED }}>Coordonnées manquantes</div>
              </div>
              <Pill label="À compléter" color={RED} />
            </div>
            <div className="mt-3.5"><Progress step={1} color={RED} /></div>
            <button className={cn('mt-3 flex w-full items-center justify-center gap-2 py-2.5 text-[13px] font-bold', PRIMARY_PILL)}>Compléter les coordonnées <ArrowRight className="h-4 w-4" /></button>
          </div>
        </section>

        <section>
          <Caption>Mes paiements</Caption>
          <div className="space-y-3">
            {[
              { k: 'alipay' as MKey, n: 'Guangzhou Textile Co.', rmb: '28 825', xaf: '2 500 000', step: 2, color: LILAC, label: 'En cours', hint: 'Bonzini règle votre fournisseur' },
              { k: 'wechat' as MKey, n: 'Shenzhen Electronics', rmb: '9 648', xaf: '850 000', step: 3, color: GREEN, label: 'Payé', hint: 'Payé le 9 juin' },
            ].map((p) => (
              <div key={p.n} className={cn('rounded-[22px] p-4', SURFACE.card, SURFACE.shadow)}>
                <div className="flex items-center gap-3">
                  <MethodLogo k={p.k} size={44} radius={22} />
                  <div className="min-w-0 flex-1">
                    <div className={cn('truncate text-[16px] font-bold', TEXT.strong)}>{p.n}</div>
                    <div className={cn('mt-0.5 text-[12px] tabular-nums', TEXT.muted)}>¥ {p.rmb} · −{p.xaf} XAF</div>
                  </div>
                  <Pill label={p.label} color={p.color} />
                </div>
                <div className="mt-3.5"><Progress step={p.step} color={p.color} /></div>
                <div className="mt-2 flex items-center justify-between"><span className={cn('text-[12px]', TEXT.muted)}>{p.hint}</span><ChevronRight className={cn('h-4 w-4', TEXT.muted)} /></div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ============================ FICHE v7 ============================ */
function Field({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 py-3', !last && 'border-b border-black/[0.05] dark:border-white/[0.07]')}>
      <div className="min-w-0"><div className={cn('text-[11px]', TEXT.muted)}>{label}</div><div className={cn('mt-0.5 truncate text-[14px] font-bold', TEXT.strong)}>{value}</div></div>
      <Copy className={cn('h-4 w-4 shrink-0', TEXT.muted)} />
    </div>
  );
}

export function PayDetailV7() {
  const TL = [
    { label: 'Paiement créé', sub: '9 juin · 14:20' },
    { label: 'Coordonnées du bénéficiaire', sub: 'Complétées' },
    { label: 'Traitement par Bonzini', sub: '9 juin · 15:05' },
    { label: 'Bénéficiaire payé', sub: '9 juin · 16:40' },
  ];
  return (
    <div className={cn('mx-auto min-h-screen max-w-[420px]', SURFACE.canvas)}>
      <div className={cn('flex items-center gap-3 px-4 py-3.5', SURFACE.canvas)}>
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-full', SURFACE.card, SURFACE.shadow)}><ArrowLeft className={cn('h-5 w-5', TEXT.strong)} /></div>
        <span className={cn('text-[17px] font-black', TEXT.strong)}>BZ-PM-2398</span>
      </div>

      <div className="space-y-5 p-4 pt-1">
        {/* Reçu — en haut */}
        <button className={cn('flex w-full items-center justify-center gap-2 py-[15px] text-[15px] font-bold', PRIMARY_PILL)}>
          <Download className="h-[17px] w-[17px]" /> Télécharger le reçu
        </button>

        {/* MONTANT — héros (sans intitulé, c'est le focal) */}
        <div className={cn('rounded-[26px] p-6', SURFACE.card, SURFACE.shadow)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><MethodLogo k="alipay" size={30} radius={9} /><span className={cn('text-[13px] font-bold', TEXT.strong)}>Alipay</span></div>
            <Pill label="Payé" color={GREEN} />
          </div>
          <div className={cn('mt-5 text-[13px] font-semibold', TEXT.muted)}>Votre bénéficiaire reçoit</div>
          <div className="mt-1 flex items-baseline gap-2"><span className="text-[34px] font-black text-[#C3BDD2] dark:text-[#5C5772]">¥</span><span className={cn('text-[58px] font-black leading-none tabular-nums', TEXT.strong)}>9 648</span></div>
          <div className={cn('mt-2.5 text-[15px] font-bold tabular-nums', TEXT.muted)}>Vous avez payé 850 000 XAF</div>
          <div className="mt-4 rounded-2xl bg-[#EDEAFA] px-4 py-3.5 dark:bg-[#221F33]">
            <div className={cn('text-[11px] font-bold uppercase tracking-wide', TEXT.muted)}>Taux du jour appliqué</div>
            <div className={cn('mt-1 text-[17px] font-black tabular-nums', TEXT.strong)}>1 000 000 XAF = 11 350 ¥</div>
          </div>
        </div>

        {/* Section — Bénéficiaire */}
        <section>
          <Caption>Bénéficiaire · Alipay</Caption>
          <div className={cn('rounded-[22px] p-5', SURFACE.card, SURFACE.shadow)}>
            <div className="flex gap-4">
              <button className="flex flex-col items-center gap-1.5">
                <div className="flex h-[88px] w-[88px] items-center justify-center rounded-2xl bg-white ring-1 ring-black/[0.07]"><QrCode className="h-11 w-11 text-[#1B1A24]" /></div>
                <span className="text-[10px] font-semibold text-[#5B4CC4] dark:text-[#B5AAF0]">Agrandir</span>
              </button>
              <div className="min-w-0 flex-1">
                <Field label="Nom du fournisseur" value="Shenzhen Electronics Co." />
                <Field label="Nom du compte" value="Li Wei" />
                <Field label="Identifiant Alipay" value="li.wei@alipay.com" last />
              </div>
            </div>
          </div>
        </section>

        {/* Section — Suivi */}
        <section>
          <Caption>Suivi du paiement</Caption>
          <div className={cn('rounded-[22px] p-5', SURFACE.card, SURFACE.shadow)}>
            {TL.map((s, i) => {
              const last = i === TL.length - 1;
              return (
                <div key={s.label} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full" style={{ background: GREEN }}><Check className="h-3 w-3 text-white" strokeWidth={3} /></div>
                    {!last && <div className="my-1 w-0.5 flex-1" style={{ minHeight: 16, background: GREEN }} />}
                  </div>
                  <div className={cn('flex-1', last ? 'pb-0' : 'pb-3')}>
                    <div className={cn('text-[14px] font-bold', TEXT.strong)}>{s.label}</div>
                    <div className={cn('mt-0.5 text-[11px]', TEXT.muted)}>{s.sub}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Section — Preuve & détails (regroupés) */}
        <section>
          <Caption>Preuve & détails</Caption>
          <div className={cn('rounded-[22px] p-5', SURFACE.card, SURFACE.shadow)}>
            <button className="flex w-full items-center gap-3 border-b border-black/[0.05] pb-4 text-left dark:border-white/[0.07]">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#ECE8F6] dark:bg-[#2A2738]"><ImageIcon className="h-6 w-6 text-[#8E8BA0]" /></div>
              <div className="min-w-0 flex-1">
                <div className={cn('text-[14px] font-bold', TEXT.strong)}>Preuve de paiement</div>
                <div className={cn('mt-0.5 text-[12px]', TEXT.muted)}>Ajoutée par Bonzini · toucher pour agrandir</div>
              </div>
              <ChevronRight className={cn('h-4 w-4', TEXT.muted)} />
            </button>
            <div className="pt-3">
              {[['Référence', 'BZ-PM-2398'], ['Méthode', 'Alipay'], ['Créé le', '9 juin 2026, 14:20'], ['Payé le', '9 juin 2026, 16:40']].map(([l, v]) => (
                <div key={l} className="flex items-center justify-between gap-3 py-1.5"><span className={cn('text-[13px]', TEXT.muted)}>{l}</span><span className={cn('text-[13px] font-bold', l === 'Référence' && 'font-mono', TEXT.strong)}>{v}</span></div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
