/**
 * DEV-ONLY maquettes — REFONTE STRUCTURE module PAIEMENTS, VARIANTE C (fusion).
 * Combine V2 (« Payer » + taux du jour + actions requises) et V3 (avancement
 * du cycle de vie), avec sémantique 3 tons : ROUGE = action requise (bloquant),
 * LILAS = en cours (Bonzini), VERT = payé.
 *   · PayListV4   : carte Payer + section « À traiter » (rouge) + « Mes
 *                   paiements » en cartes avec barre d'avancement.
 *   · PayDetailV4 : gros montant RMB en exergue + taux ; timeline de suivi ;
 *                   bénéficiaire + coordonnées ; référence/dates ; documents.
 * Harness: ?screen=cpay-list-v4 | cpay-detail-v4
 */
import { LOGO_PATH } from '@/mobile/designKit/methods';
import { SURFACE, TEXT, PRIMARY_PILL } from '@/mobile/designKit/tokens';
import { Landmark, Plus, ArrowLeft, ArrowRight, Copy, ChevronRight, FileText, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

type MKey = 'alipay' | 'wechat' | 'bank' | 'cash';
const RED = '#C0504D', LILAC = '#8B5CF6', GREEN = '#2E7D52';

function MethodLogo({ k, size = 44, radius = 14 }: { k: MKey; size?: number; radius?: number }) {
  const s = { width: size, height: size, borderRadius: radius };
  if (k === 'alipay')
    return <div style={s} className="flex shrink-0 items-center justify-center bg-white ring-1 ring-black/[0.06]"><svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} fill="#1677FF"><path d={LOGO_PATH.alipay} /></svg></div>;
  if (k === 'wechat')
    return <div style={s} className="flex shrink-0 items-center justify-center bg-[#07C160]"><svg viewBox="0 0 24 24" width={size * 0.56} height={size * 0.56} fill="#fff"><path d={LOGO_PATH.wechat} /></svg></div>;
  if (k === 'cash')
    return <div style={s} className="flex shrink-0 items-center justify-center bg-[#E0322B]"><span className="font-black leading-none text-white" style={{ fontSize: size * 0.5 }}>¥</span></div>;
  return <div style={s} className="flex shrink-0 items-center justify-center bg-[#ECE8F6] text-[#2C2740] dark:bg-[#2A2738] dark:text-[#E7E3F2]"><Landmark style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={1.8} /></div>;
}

function Progress({ step, color }: { step: number; color: string }) {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={cn('h-1.5 flex-1 rounded-full', i > step && 'bg-black/[0.08] dark:bg-white/[0.10]')} style={i <= step ? { background: color } : undefined} />
      ))}
    </div>
  );
}

function Pill({ label, color }: { label: string; color: string }) {
  return <span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ color, background: `${color}1F` }}>{label}</span>;
}

/* ================================================================== *
 *  LISTE V4 — Payer + À traiter (rouge) + Mes paiements (avancement)
 * ================================================================== */
export function PayListV4() {
  return (
    <div className={cn('mx-auto min-h-screen max-w-[420px]', SURFACE.canvas)}>
      <div className="space-y-6 p-4 pt-6">
        <div className="px-1">
          <h1 className={cn('text-[26px] font-black leading-tight', TEXT.strong)}>Paiements</h1>
          <p className={cn('mt-0.5 text-[13px]', TEXT.muted)}>Réglez vos fournisseurs en Chine</p>
        </div>

        {/* Action principale + taux du jour */}
        <button className={cn('flex w-full items-center gap-4 rounded-[24px] p-5 text-left', SURFACE.card, SURFACE.shadow)}>
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#1C1B22] dark:bg-[#F2F1F7]">
            <Plus className="h-7 w-7 text-white dark:text-[#1B1A24]" strokeWidth={2.4} />
          </div>
          <div className="min-w-0 flex-1">
            <div className={cn('text-[17px] font-black', TEXT.strong)}>Payer un fournisseur</div>
            <div className={cn('mt-0.5 text-[12px]', TEXT.muted)}>Taux du jour · <span className="font-bold text-[#E8932A]">11 530</span> ¥ / 1M XAF</div>
          </div>
          <ArrowRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
        </button>

        {/* À TRAITER — bloquant, rouge */}
        <section>
          <h2 className="mb-2.5 px-1 text-[12px] font-bold uppercase tracking-wider" style={{ color: RED }}>À traiter · urgent</h2>
          <div className="space-y-3">
            <div className="rounded-[22px] bg-[#FBE7E7] p-4 dark:bg-[#3A2526]">
              <div className="flex items-center gap-3">
                <MethodLogo k="bank" size={44} radius={22} />
                <div className="min-w-0 flex-1">
                  <div className={cn('truncate text-[16px] font-bold', TEXT.strong)}>Yiwu Trading Ltd</div>
                  <div className="mt-0.5 text-[12px] tabular-nums text-[#B0524F] dark:text-[#DDA0A0]">¥ 44 800 · −4 000 000 XAF</div>
                </div>
                <Pill label="Coordonnées manquantes" color={RED} />
              </div>
              <div className="mt-3.5"><Progress step={1} color={RED} /></div>
              <button className={cn('mt-3 flex w-full items-center justify-center gap-2 py-2.5 text-[13px] font-bold', PRIMARY_PILL)}>
                Compléter les coordonnées <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        {/* MES PAIEMENTS — avancement (lilas / vert) */}
        <section>
          <h2 className={cn('mb-2.5 px-1 text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>Mes paiements</h2>
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
                <div className="mt-2 flex items-center justify-between">
                  <span className={cn('text-[12px]', TEXT.muted)}>{p.hint}</span>
                  <ChevronRight className={cn('h-4 w-4', TEXT.muted)} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ================================================================== *
 *  DÉTAIL V4 — gros montant RMB + taux · timeline · bénéficiaire · réf
 * ================================================================== */
type StepState = 'done' | 'current' | 'pending';
const TL: { label: string; sub?: string; state: StepState; action?: string; blocking?: boolean }[] = [
  { label: 'Paiement créé', sub: '11 juin 2026 · 09:12', state: 'done' },
  { label: 'Coordonnées du bénéficiaire', sub: 'À compléter pour continuer', state: 'current', action: 'Ajouter les coordonnées', blocking: true },
  { label: 'Traitement par Bonzini', state: 'pending' },
  { label: 'Bénéficiaire payé', state: 'pending' },
];

function DRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={cn('text-[13px]', TEXT.muted)}>{label}</span>
      <span className={cn('text-[13px] font-bold', mono && 'font-mono', TEXT.strong)}>{value}</span>
    </div>
  );
}

export function PayDetailV4() {
  return (
    <div className={cn('mx-auto min-h-screen max-w-[420px]', SURFACE.canvas)}>
      <div className={cn('flex items-center gap-3 px-4 py-3.5', SURFACE.canvas)}>
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-full', SURFACE.card, SURFACE.shadow)}><ArrowLeft className={cn('h-5 w-5', TEXT.strong)} /></div>
        <span className={cn('text-[17px] font-black', TEXT.strong)}>BZ-PM-2401</span>
      </div>

      <div className="space-y-4 p-4 pt-1">
        {/* MONTANT — gros RMB en exergue + taux */}
        <div className={cn('rounded-[24px] p-5', SURFACE.card, SURFACE.shadow)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <MethodLogo k="alipay" size={36} radius={11} />
              <span className={cn('text-[14px] font-bold', TEXT.strong)}>Alipay</span>
            </div>
            <Pill label="À compléter" color={RED} />
          </div>
          <div className={cn('mt-4 text-[12px] font-medium', TEXT.muted)}>Votre bénéficiaire reçoit</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-[30px] font-black text-[#C3BDD2] dark:text-[#5C5772]">¥</span>
            <span className={cn('text-[52px] font-black leading-none tabular-nums', TEXT.strong)}>28 825</span>
          </div>
          <div className={cn('mt-2 text-[14px] font-bold tabular-nums', TEXT.muted)}>Vous payez 2 500 000 XAF</div>
          <div className="mt-3 flex items-center justify-between rounded-2xl bg-[#EDEAFA] px-4 py-3 dark:bg-[#221F33]">
            <span className={cn('text-[12px] font-semibold', TEXT.muted)}>Taux du jour</span>
            <span className={cn('text-[14px] font-black tabular-nums', TEXT.strong)}>11 530 ¥ <span className="text-[11px] font-bold text-[#8E8BA0]">/ 1M XAF</span></span>
          </div>
        </div>

        {/* SUIVI — timeline */}
        <div className={cn('rounded-[24px] p-5', SURFACE.card, SURFACE.shadow)}>
          <div className={cn('mb-4 text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>Suivi du paiement</div>
          {TL.map((s, i) => {
            const last = i === TL.length - 1;
            const accent = s.blocking ? RED : LILAC;
            return (
              <div key={s.label} className="flex gap-3">
                <div className="flex flex-col items-center">
                  {s.state === 'done' ? (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: GREEN }}><Check className="h-3.5 w-3.5 text-white" strokeWidth={3} /></div>
                  ) : s.state === 'current' ? (
                    <div className="h-6 w-6 rounded-full" style={{ background: accent, boxShadow: `0 0 0 4px ${accent}33` }} />
                  ) : (
                    <div className="h-6 w-6 rounded-full border-2 border-[#C7C2D6] dark:border-[#4A4658]" />
                  )}
                  {!last && <div className="my-1 w-0.5 flex-1" style={{ minHeight: s.state === 'current' ? 60 : 26, background: s.state === 'done' ? GREEN : 'rgba(140,139,160,0.25)' }} />}
                </div>
                <div className={cn('flex-1', last ? 'pb-0' : 'pb-4')}>
                  <div className={cn('text-[15px] font-bold', s.state === 'pending' ? TEXT.muted : TEXT.strong)}>{s.label}</div>
                  {s.sub && <div className="mt-0.5 text-[12px]" style={{ color: s.blocking ? RED : undefined }}>{!s.blocking ? <span className={TEXT.muted}>{s.sub}</span> : s.sub}</div>}
                  {s.action && (
                    <button className={cn('mt-2.5 flex items-center justify-center gap-2 px-4 py-2.5 text-[13px] font-bold', PRIMARY_PILL)}>
                      {s.action} <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* BÉNÉFICIAIRE + coordonnées */}
        <div className={cn('rounded-[22px] p-5', SURFACE.card, SURFACE.shadow)}>
          <div className={cn('text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>Bénéficiaire</div>
          <div className="mt-2 flex items-center justify-between">
            <span className={cn('text-[16px] font-bold', TEXT.strong)}>Guangzhou Textile Co.</span>
            <Copy className={cn('h-4 w-4', TEXT.muted)} />
          </div>
          <div className="mt-3 border-t border-black/[0.06] pt-3 dark:border-white/[0.08]">
            <div className={cn('text-[12px]', TEXT.muted)}>Coordonnées du bénéficiaire</div>
            <div className="mt-0.5 text-[14px] font-bold" style={{ color: RED }}>À compléter</div>
          </div>
        </div>

        {/* RÉFÉRENCE / DÉTAILS */}
        <div className={cn('space-y-2.5 rounded-[22px] p-5', SURFACE.card, SURFACE.shadow)}>
          <div className={cn('mb-1 text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>Référence & détails</div>
          <DRow label="Référence" value="BZ-PM-2401" mono />
          <DRow label="Méthode" value="Alipay" />
          <DRow label="Créé le" value="11 juin 2026, 09:12" />
          <DRow label="Mis à jour le" value="11 juin 2026, 10:40" />
        </div>

        {/* DOCUMENTS */}
        <button className={cn('flex w-full items-center gap-3 rounded-[20px] px-5 py-4', SURFACE.card, SURFACE.shadow)}>
          <FileText className={cn('h-5 w-5', TEXT.muted)} />
          <span className={cn('flex-1 text-left text-[14px] font-bold', TEXT.strong)}>Documents</span>
          <ChevronRight className={cn('h-4 w-4', TEXT.muted)} />
        </button>
      </div>
    </div>
  );
}
