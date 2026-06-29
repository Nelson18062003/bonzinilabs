/**
 * DEV-ONLY maquettes — REFONTE STRUCTURE (IA) du module PAIEMENTS client.
 * On ne change PAS le langage visuel (déjà validé) — on repense la
 * DISPOSITION et la HIÉRARCHIE :
 *   · PayListV2   : action principale mise en avant · section « Action requise »
 *                   surfacée en tête · lignes centrées sur le FOURNISSEUR.
 *   · PayDetailV2 : le STATUT + la PROCHAINE ACTION en tête (pas le montant) ;
 *                   montant/fournisseur/détails ensuite, par ordre d'importance.
 * Données statiques. Harness: ?screen=cpay-list-v2 | cpay-detail-v2
 */
import { LOGO_PATH } from '@/mobile/designKit/methods';
import { SURFACE, TEXT, PRIMARY_PILL, TONE_PILL } from '@/mobile/designKit/tokens';
import {
  Landmark, Plus, ChevronRight, ArrowRight, AlertCircle, QrCode, Clock,
  ArrowLeft, Copy, FileText,
} from 'lucide-react';
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

function Caption({ children }: { children: React.ReactNode }) {
  return <h2 className={cn('mb-2.5 px-1 text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>{children}</h2>;
}

/* ================================================================== *
 *  LISTE V2 — action en tête · « Action requise » · fournisseur d'abord
 * ================================================================== */
export function PayListV2() {
  const recents = [
    { k: 'alipay' as MKey, name: 'Guangzhou Textile Co.', when: "Aujourd'hui", rmb: '28 825', xaf: '2 500 000', label: 'En cours', tone: TONE_PILL.info },
    { k: 'wechat' as MKey, name: 'Shenzhen Electronics', when: 'Hier', rmb: '9 648', xaf: '850 000', label: 'Payé', tone: TONE_PILL.success },
    { k: 'alipay' as MKey, name: 'Foshan Furniture', when: '6 juin', rmb: '13 100', xaf: '1 140 000', label: 'Payé', tone: TONE_PILL.success },
  ];
  return (
    <div className={cn('mx-auto min-h-screen max-w-[420px]', SURFACE.canvas)}>
      <div className="space-y-6 p-4 pt-6">
        {/* En-tête compact */}
        <div className="px-1">
          <h1 className={cn('text-[26px] font-black leading-tight', TEXT.strong)}>Paiements</h1>
          <p className={cn('mt-0.5 text-[13px]', TEXT.muted)}>Réglez vos fournisseurs en Chine</p>
        </div>

        {/* ACTION PRINCIPALE — mise en avant (le cœur de l'app) */}
        <button className={cn('flex w-full items-center gap-4 rounded-[24px] p-5 text-left', SURFACE.card, SURFACE.shadow)}>
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#1C1B22] dark:bg-[#F2F1F7]">
            <Plus className="h-7 w-7 text-white dark:text-[#1B1A24]" strokeWidth={2.4} />
          </div>
          <div className="min-w-0 flex-1">
            <div className={cn('text-[17px] font-black', TEXT.strong)}>Payer un fournisseur</div>
            <div className={cn('mt-0.5 text-[12px]', TEXT.muted)}>
              Taux du jour · <span className="font-bold text-[#E8932A]">11 530</span> ¥ / 1M XAF
            </div>
          </div>
          <ArrowRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
        </button>

        {/* ACTION REQUISE — surfacé en tête (ce qui bloque le client) */}
        <section>
          <Caption>Action requise</Caption>
          <div className="space-y-2.5">
            <button className="flex w-full items-center gap-3 rounded-[20px] bg-[#FDF1DD] p-4 text-left dark:bg-[#3A2F1A]">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F4D9A6] dark:bg-[#5A4A24]">
                <AlertCircle className="h-5 w-5 text-[#9A6B12] dark:text-[#E0B978]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className={cn('truncate text-[15px] font-bold', TEXT.strong)}>Yiwu Trading Ltd</div>
                <div className="mt-0.5 text-[12px] font-semibold text-[#9A6B12] dark:text-[#E0B978]">Coordonnées du fournisseur manquantes</div>
              </div>
              <span className="shrink-0 rounded-full bg-[#1C1B22] px-3 py-1.5 text-[11px] font-bold text-white dark:bg-[#F2F1F7] dark:text-[#1B1A24]">Compléter</span>
            </button>
            <button className="flex w-full items-center gap-3 rounded-[20px] bg-[#FDF1DD] p-4 text-left dark:bg-[#3A2F1A]">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F4D9A6] dark:bg-[#5A4A24]">
                <QrCode className="h-5 w-5 text-[#9A6B12] dark:text-[#E0B978]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className={cn('truncate text-[15px] font-bold', TEXT.strong)}>Retrait cash · Guangzhou</div>
                <div className="mt-0.5 text-[12px] font-semibold text-[#9A6B12] dark:text-[#E0B978]">Présentez le QR au bureau</div>
              </div>
              <span className="shrink-0 rounded-full bg-[#1C1B22] px-3 py-1.5 text-[11px] font-bold text-white dark:bg-[#F2F1F7] dark:text-[#1B1A24]">Voir le QR</span>
            </button>
          </div>
        </section>

        {/* MES PAIEMENTS — fournisseur d'abord, filtre discret */}
        <section>
          <div className="mb-2.5 flex items-center justify-between px-1">
            <span className={cn('text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>Mes paiements</span>
            <div className="flex gap-1.5">
              {['Tous', 'En cours', 'Terminés'].map((f, i) => (
                <span key={f} className={cn('rounded-full px-2.5 py-1 text-[11px] font-bold', i === 0 ? 'bg-[#8B5CF6] text-white' : cn(SURFACE.card, TEXT.muted))}>{f}</span>
              ))}
            </div>
          </div>
          <div className={cn('rounded-[24px] px-4', SURFACE.card, SURFACE.shadow)}>
            {recents.map((p, i) => (
              <div key={p.name} className={cn('flex items-center gap-3 py-3.5', i < recents.length - 1 && 'border-b border-black/[0.05] dark:border-white/[0.06]')}>
                <MethodLogo k={p.k} size={46} radius={23} />
                <div className="min-w-0 flex-1">
                  <div className={cn('truncate text-[15px] font-bold', TEXT.strong)}>{p.name}</div>
                  <div className={cn('mt-0.5 truncate text-[12px] tabular-nums', TEXT.muted)}>{p.when} · ¥ {p.rmb}</div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={cn('text-[15px] font-extrabold tabular-nums', TEXT.strong)}>−{p.xaf}</span>
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', p.tone)}>{p.label}</span>
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
 *  DÉTAIL V2 — STATUT + ACTION en tête, puis montant / fournisseur
 * ================================================================== */
export function PayDetailV2() {
  return (
    <div className={cn('mx-auto min-h-screen max-w-[420px]', SURFACE.canvas)}>
      {/* En-tête : juste retour + référence (le statut devient le héros) */}
      <div className={cn('flex items-center gap-3 px-4 py-3.5', SURFACE.canvas)}>
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-full', SURFACE.card, SURFACE.shadow)}><ArrowLeft className={cn('h-5 w-5', TEXT.strong)} /></div>
        <span className={cn('text-[17px] font-black', TEXT.strong)}>BZ-PM-2401</span>
      </div>

      <div className="space-y-4 p-4 pt-1">
        {/* 1) HÉROS = STATUT + PROCHAINE ACTION (ce que le client veut d'abord) */}
        <div className={cn('rounded-[24px] p-5', SURFACE.card, SURFACE.shadow)}>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#F4D9A6] dark:bg-[#5A4A24]">
              <AlertCircle className="h-6 w-6 text-[#9A6B12] dark:text-[#E0B978]" />
            </div>
            <div>
              <div className="text-[12px] font-bold uppercase tracking-wider text-[#9A6B12] dark:text-[#E0B978]">Action requise</div>
              <div className={cn('text-[17px] font-black leading-tight', TEXT.strong)}>Coordonnées manquantes</div>
            </div>
          </div>
          <p className={cn('mt-3 text-[14px] leading-relaxed', TEXT.muted)}>
            Ajoutez les coordonnées de votre fournisseur pour que Bonzini puisse effectuer le règlement.
          </p>
          <button className={cn('mt-4 flex w-full items-center justify-center gap-2 py-[14px] text-[15px] font-bold', PRIMARY_PILL)}>
            Ajouter les coordonnées <ArrowRight className="h-[17px] w-[17px]" />
          </button>
        </div>

        {/* 2) MONTANT — résumé compact (plus le bloc dominant) */}
        <div className={cn('rounded-[22px] p-5', SURFACE.card, SURFACE.shadow)}>
          <div className="flex items-center gap-3">
            <MethodLogo k="alipay" size={40} radius={12} />
            <div className={cn('text-[15px] font-bold', TEXT.strong)}>Alipay</div>
          </div>
          <div className="mt-3 flex items-end justify-between">
            <div>
              <div className={cn('text-[12px]', TEXT.muted)}>Votre fournisseur reçoit</div>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="text-[22px] font-black text-[#C3BDD2] dark:text-[#5C5772]">¥</span>
                <span className={cn('text-[32px] font-black leading-none tabular-nums', TEXT.strong)}>28 825</span>
              </div>
            </div>
            <div className="text-right">
              <div className={cn('text-[12px]', TEXT.muted)}>Vous payez</div>
              <div className={cn('mt-0.5 text-[17px] font-extrabold tabular-nums', TEXT.strong)}>2 500 000 <span className="text-[12px] text-[#AAA7BD]">XAF</span></div>
            </div>
          </div>
          <div className={cn('mt-3 rounded-xl px-3 py-2 text-center text-[12px]', SURFACE.canvas, TEXT.muted)}>Taux appliqué · 11 530 ¥ / 1M XAF</div>
        </div>

        {/* 3) FOURNISSEUR — compact */}
        <div className={cn('rounded-[22px] p-5', SURFACE.card, SURFACE.shadow)}>
          <div className="flex items-center justify-between">
            <span className={cn('text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>Fournisseur</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className={cn('text-[16px] font-bold', TEXT.strong)}>Guangzhou Textile Co.</span>
            <Copy className={cn('h-4 w-4', TEXT.muted)} />
          </div>
        </div>

        {/* 4) Documents + 5) Détails & historique — repli, en bas */}
        <button className={cn('flex w-full items-center gap-3 rounded-[20px] px-5 py-4', SURFACE.card, SURFACE.shadow)}>
          <FileText className={cn('h-5 w-5', TEXT.muted)} />
          <span className={cn('flex-1 text-left text-[14px] font-bold', TEXT.strong)}>Documents</span>
          <ChevronRight className={cn('h-4 w-4', TEXT.muted)} />
        </button>
        <button className={cn('flex w-full items-center gap-3 rounded-[20px] px-5 py-4', SURFACE.card, SURFACE.shadow)}>
          <Clock className={cn('h-5 w-5', TEXT.muted)} />
          <span className={cn('flex-1 text-left text-[14px] font-bold', TEXT.strong)}>Détails & historique</span>
          <ChevronRight className={cn('h-4 w-4', TEXT.muted)} />
        </button>
      </div>
    </div>
  );
}
