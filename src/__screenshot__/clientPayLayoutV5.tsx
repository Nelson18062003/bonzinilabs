/**
 * DEV-ONLY maquette — FICHE PAIEMENT v5 (révisée d'après retours).
 *   1. Montant RMB + taux MIS EN EXERGUE (hero dominant).
 *   2. Bénéficiaire REMONTE · Suivi (timeline) DESCEND (swap).
 *   3. Bénéficiaire NUANCÉ par méthode (ex. Alipay : QR + nom fournisseur +
 *      nom du compte + identifiant Alipay/email/téléphone).
 *   4. Preuve de paiement (ajoutée par Bonzini) + reçu téléchargeable.
 * Exemple : paiement Alipay TERMINÉ. Harness: ?screen=cpay-detail-v5
 */
import { LOGO_PATH } from '@/mobile/designKit/methods';
import { SURFACE, TEXT, PRIMARY_PILL, SOFT_PILL } from '@/mobile/designKit/tokens';
import { ArrowLeft, Copy, ChevronRight, Download, QrCode, ImageIcon, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const GREEN = '#2E7D52';

function AlipayLogo({ size = 36, radius = 11 }: { size?: number; radius?: number }) {
  return <div style={{ width: size, height: size, borderRadius: radius }} className="flex shrink-0 items-center justify-center bg-white ring-1 ring-black/[0.06]"><svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} fill="#1677FF"><path d={LOGO_PATH.alipay} /></svg></div>;
}

function Pill({ label, color }: { label: string; color: string }) {
  return <span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ color, background: `${color}1F` }}>{label}</span>;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <div className={cn('text-[11px]', TEXT.muted)}>{label}</div>
        <div className={cn('mt-0.5 truncate text-[14px] font-bold', TEXT.strong)}>{value}</div>
      </div>
      <Copy className={cn('h-4 w-4 shrink-0', TEXT.muted)} />
    </div>
  );
}

export function PayDetailV5() {
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

      <div className="space-y-4 p-4 pt-1">
        {/* 1) MONTANT — hero dominant : ¥ RMB énorme + taux mis en avant */}
        <div className={cn('rounded-[26px] p-6', SURFACE.card, SURFACE.shadow)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><AlipayLogo size={30} radius={9} /><span className={cn('text-[13px] font-bold', TEXT.strong)}>Alipay</span></div>
            <Pill label="Payé" color={GREEN} />
          </div>
          <div className={cn('mt-5 text-[13px] font-semibold', TEXT.muted)}>Votre bénéficiaire reçoit</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-[34px] font-black text-[#C3BDD2] dark:text-[#5C5772]">¥</span>
            <span className={cn('text-[58px] font-black leading-none tabular-nums', TEXT.strong)}>9 648</span>
          </div>
          <div className={cn('mt-2.5 text-[15px] font-bold tabular-nums', TEXT.muted)}>Vous avez payé 850 000 XAF</div>
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#EDEAFA] px-4 py-3.5 dark:bg-[#221F33]">
            <span className={cn('text-[12px] font-bold uppercase tracking-wide', TEXT.muted)}>Taux du jour</span>
            <span className={cn('text-[16px] font-black tabular-nums', TEXT.strong)}>11 350 ¥ <span className="text-[11px] font-bold text-[#8E8BA0]">/ 1 000 000 XAF</span></span>
          </div>
        </div>

        {/* 2) BÉNÉFICIAIRE — remonté, nuancé par méthode (ici Alipay) */}
        <div className={cn('rounded-[22px] p-5', SURFACE.card, SURFACE.shadow)}>
          <div className={cn('mb-3 text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>Bénéficiaire · Alipay</div>
          <div className="flex gap-4">
            {/* QR */}
            <button className="flex flex-col items-center gap-1.5">
              <div className="flex h-[92px] w-[92px] items-center justify-center rounded-2xl bg-white ring-1 ring-black/[0.07]"><QrCode className="h-12 w-12 text-[#1B1A24]" /></div>
              <span className="text-[10px] font-semibold text-[#5B4CC4] dark:text-[#B5AAF0]">Agrandir</span>
            </button>
            {/* champs spécifiques Alipay */}
            <div className="min-w-0 flex-1 divide-y divide-black/[0.05] dark:divide-white/[0.07]">
              <Field label="Nom du fournisseur" value="Shenzhen Electronics Co." />
              <Field label="Nom du compte" value="Li Wei" />
              <Field label="Identifiant Alipay" value="li.wei@alipay.com" />
            </div>
          </div>
        </div>

        {/* 3) PREUVE + REÇU — le client voit la preuve Bonzini, télécharge son reçu */}
        <div className={cn('rounded-[22px] p-5', SURFACE.card, SURFACE.shadow)}>
          <div className={cn('mb-3 text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>Preuve & reçu</div>
          <div className="flex items-center gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[#ECE8F6] dark:bg-[#2A2738]"><ImageIcon className="h-7 w-7 text-[#8E8BA0]" /></div>
            <div className="min-w-0 flex-1">
              <div className={cn('text-[14px] font-bold', TEXT.strong)}>Preuve de paiement</div>
              <div className={cn('mt-0.5 text-[12px]', TEXT.muted)}>Ajoutée par Bonzini · toucher pour voir</div>
            </div>
            <ChevronRight className={cn('h-4 w-4', TEXT.muted)} />
          </div>
          <button className={cn('mt-4 flex w-full items-center justify-center gap-2 py-[14px] text-[14px] font-bold', PRIMARY_PILL)}>
            <Download className="h-[16px] w-[16px]" /> Télécharger le reçu
          </button>
        </div>

        {/* 4) SUIVI — descendu, ici tout est fait (vert) */}
        <div className={cn('rounded-[22px] p-5', SURFACE.card, SURFACE.shadow)}>
          <div className={cn('mb-4 text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>Suivi du paiement</div>
          {TL.map((s, i) => {
            const last = i === TL.length - 1;
            return (
              <div key={s.label} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full" style={{ background: GREEN }}><Check className="h-3 w-3 text-white" strokeWidth={3} /></div>
                  {!last && <div className="my-1 w-0.5 flex-1" style={{ minHeight: 18, background: GREEN }} />}
                </div>
                <div className={cn('flex-1', last ? 'pb-0' : 'pb-3')}>
                  <div className={cn('text-[14px] font-bold', TEXT.strong)}>{s.label}</div>
                  <div className={cn('mt-0.5 text-[11px]', TEXT.muted)}>{s.sub}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 5) RÉFÉRENCE & DÉTAILS */}
        <div className={cn('rounded-[22px] p-5', SURFACE.card, SURFACE.shadow)}>
          <div className={cn('mb-2 text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>Référence & détails</div>
          {[['Référence', 'BZ-PM-2398'], ['Méthode', 'Alipay'], ['Créé le', '9 juin 2026, 14:20'], ['Payé le', '9 juin 2026, 16:40']].map(([l, v]) => (
            <div key={l} className="flex items-center justify-between gap-3 py-1.5">
              <span className={cn('text-[13px]', TEXT.muted)}>{l}</span>
              <span className={cn('text-[13px] font-bold', l === 'Référence' && 'font-mono', TEXT.strong)}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
