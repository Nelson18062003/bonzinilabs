/**
 * DEV-ONLY maquettes — REFONTE STRUCTURE (IA) du module PAIEMENTS, VARIANTE B :
 * concept « SUIVI » (cycle de vie). Différent de la V2 (bannière d'action) :
 *   · PayListV3   : onglets par étape (À compléter / En cours / Terminés, avec
 *                   compteurs) ; chaque paiement = carte avec barre d'avancement.
 *   · PayDetailV3 : une TIMELINE de progression est le cœur (créé → coordonnées
 *                   → traitement → payé), l'action est posée sur l'étape en cours.
 * Données statiques. Harness: ?screen=cpay-list-v3 | cpay-detail-v3
 */
import { LOGO_PATH } from '@/mobile/designKit/methods';
import { SURFACE, TEXT, PRIMARY_PILL, TONE_PILL } from '@/mobile/designKit/tokens';
import { Landmark, Plus, ArrowLeft, ArrowRight, Copy, ChevronRight, FileText, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

type MKey = 'alipay' | 'wechat' | 'bank' | 'cash';

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

// Barre d'avancement 4 étapes (créé · coordonnées · traitement · payé).
function Progress({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={cn('h-1.5 flex-1 rounded-full', i <= step ? 'bg-[#8B5CF6]' : 'bg-black/[0.08] dark:bg-white/[0.10]')} />
      ))}
    </div>
  );
}

/* ================================================================== *
 *  LISTE V3 — onglets par étape + cartes avec avancement
 * ================================================================== */
export function PayListV3() {
  const items = [
    { k: 'bank' as MKey, supplier: 'Yiwu Trading Ltd', rmb: '44 800', xaf: '4 000 000', step: 1, hint: 'Coordonnées manquantes', tone: TONE_PILL.pending, label: 'À compléter' },
    { k: 'alipay' as MKey, supplier: 'Guangzhou Textile Co.', rmb: '28 825', xaf: '2 500 000', step: 2, hint: 'Bonzini règle votre fournisseur', tone: TONE_PILL.info, label: 'En cours' },
  ];
  return (
    <div className={cn('mx-auto min-h-screen max-w-[420px]', SURFACE.canvas)}>
      <div className="space-y-5 p-4 pt-6">
        <div className="flex items-end justify-between px-1">
          <h1 className={cn('text-[26px] font-black leading-tight', TEXT.strong)}>Paiements</h1>
        </div>

        {/* Action principale — pilule pleine largeur */}
        <button className={cn('flex w-full items-center justify-center gap-2 py-[15px] text-[15px] font-bold', PRIMARY_PILL)}>
          <Plus className="h-[18px] w-[18px]" /> Payer un fournisseur
        </button>

        {/* Onglets PAR ÉTAPE — la structure principale */}
        <div className={cn('flex items-center gap-1 rounded-full p-1', SURFACE.card, SURFACE.shadow)}>
          {[['À compléter', '2', true], ['En cours', '1', false], ['Terminés', '', false]].map(([label, count, active]) => (
            <div key={label as string} className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[12.5px] font-bold', active ? 'bg-[#8B5CF6] text-white' : TEXT.muted)}>
              {label}
              {count ? <span className={cn('rounded-full px-1.5 text-[10px]', active ? 'bg-white/25' : 'bg-black/[0.06] dark:bg-white/[0.12]')}>{count as string}</span> : null}
            </div>
          ))}
        </div>

        {/* Cartes avec avancement */}
        <div className="space-y-3">
          {items.map((p) => (
            <div key={p.supplier} className={cn('rounded-[22px] p-4', SURFACE.card, SURFACE.shadow)}>
              <div className="flex items-center gap-3">
                <MethodLogo k={p.k} size={44} radius={22} />
                <div className="min-w-0 flex-1">
                  <div className={cn('truncate text-[16px] font-bold', TEXT.strong)}>{p.supplier}</div>
                  <div className={cn('mt-0.5 text-[12px] tabular-nums', TEXT.muted)}>¥ {p.rmb} · −{p.xaf} XAF</div>
                </div>
                <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold', p.tone)}>{p.label}</span>
              </div>
              <div className="mt-3.5"><Progress step={p.step} /></div>
              <div className="mt-2 flex items-center justify-between">
                <span className={cn('text-[12px] font-semibold', p.step === 1 ? 'text-[#9A6B12] dark:text-[#E0B978]' : TEXT.muted)}>{p.hint}</span>
                <ChevronRight className={cn('h-4 w-4', TEXT.muted)} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================================================================== *
 *  DÉTAIL V3 — TIMELINE de progression au cœur
 * ================================================================== */
type StepState = 'done' | 'current' | 'pending';
const TL: { label: string; sub?: string; state: StepState; action?: string }[] = [
  { label: 'Paiement créé', sub: '11 juin · 09:12', state: 'done' },
  { label: 'Coordonnées du fournisseur', sub: 'À compléter pour continuer', state: 'current', action: 'Ajouter les coordonnées' },
  { label: 'Traitement par Bonzini', state: 'pending' },
  { label: 'Fournisseur payé', state: 'pending' },
];

export function PayDetailV3() {
  return (
    <div className={cn('mx-auto min-h-screen max-w-[420px]', SURFACE.canvas)}>
      <div className={cn('flex items-center gap-3 px-4 py-3.5', SURFACE.canvas)}>
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-full', SURFACE.card, SURFACE.shadow)}><ArrowLeft className={cn('h-5 w-5', TEXT.strong)} /></div>
        <span className={cn('text-[17px] font-black', TEXT.strong)}>BZ-PM-2401</span>
      </div>

      <div className="space-y-4 p-4 pt-1">
        {/* Résumé compact : fournisseur + montant */}
        <div className={cn('flex items-center gap-3 rounded-[22px] p-4', SURFACE.card, SURFACE.shadow)}>
          <MethodLogo k="alipay" size={46} radius={14} />
          <div className="min-w-0 flex-1">
            <div className={cn('truncate text-[16px] font-bold', TEXT.strong)}>Guangzhou Textile Co.</div>
            <div className={cn('mt-0.5 text-[12px] tabular-nums', TEXT.muted)}>¥ 28 825 reçu · −2 500 000 XAF</div>
          </div>
        </div>

        {/* TIMELINE — le cœur : où ça en est, quelle est la prochaine étape */}
        <div className={cn('rounded-[24px] p-5', SURFACE.card, SURFACE.shadow)}>
          <div className={cn('mb-4 text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>Suivi du paiement</div>
          <div>
            {TL.map((s, i) => {
              const last = i === TL.length - 1;
              return (
                <div key={s.label} className="flex gap-3">
                  {/* rail */}
                  <div className="flex flex-col items-center">
                    {s.state === 'done' ? (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2E7D52]"><Check className="h-3.5 w-3.5 text-white" strokeWidth={3} /></div>
                    ) : s.state === 'current' ? (
                      <div className="h-6 w-6 rounded-full bg-[#E8932A] ring-4 ring-[#F4D9A6] dark:ring-[#5A4A24]" />
                    ) : (
                      <div className="h-6 w-6 rounded-full border-2 border-[#C7C2D6] dark:border-[#4A4658]" />
                    )}
                    {!last && <div className={cn('my-1 w-0.5 flex-1', s.state === 'done' ? 'bg-[#2E7D52]' : 'bg-black/[0.08] dark:bg-white/[0.10]')} style={{ minHeight: s.state === 'current' ? 64 : 28 }} />}
                  </div>
                  {/* content */}
                  <div className={cn('flex-1', last ? 'pb-0' : 'pb-4')}>
                    <div className={cn('text-[15px] font-bold', s.state === 'pending' ? TEXT.muted : TEXT.strong)}>{s.label}</div>
                    {s.sub && <div className={cn('mt-0.5 text-[12px]', s.state === 'current' ? 'text-[#9A6B12] dark:text-[#E0B978]' : TEXT.muted)}>{s.sub}</div>}
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
        </div>

        {/* Fournisseur + secondaire */}
        <div className={cn('rounded-[22px] p-5', SURFACE.card, SURFACE.shadow)}>
          <div className={cn('text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>Fournisseur</div>
          <div className="mt-2 flex items-center justify-between">
            <span className={cn('text-[16px] font-bold', TEXT.strong)}>Guangzhou Textile Co.</span>
            <Copy className={cn('h-4 w-4', TEXT.muted)} />
          </div>
        </div>

        <button className={cn('flex w-full items-center gap-3 rounded-[20px] px-5 py-4', SURFACE.card, SURFACE.shadow)}>
          <FileText className={cn('h-5 w-5', TEXT.muted)} />
          <span className={cn('flex-1 text-left text-[14px] font-bold', TEXT.strong)}>Documents</span>
          <ChevronRight className={cn('h-4 w-4', TEXT.muted)} />
        </button>
      </div>
    </div>
  );
}
