/**
 * DEV-ONLY maquettes — REFONTE APP CLIENT, module PAIEMENTS.
 * 3 directions from scratch (disposition, couleurs, icônes, UX/UI) pour choix
 * client. Chaque direction = un écran scroll unique : en-tête · solde + CTA
 * « Payer un fournisseur » · liste de paiements (statuts réels du flux) ·
 * aperçu étape Montant · bottom nav repensée. Données statiques réalistes.
 *
 *   A — « Continuité » : le langage validé de l'admin (canvas lilas, cartes
 *       blanches ombre douce, pilule charbon), décliné client (plus grand,
 *       moins dense). Une seule marque, un seul langage.
 *   B — « Grand lisible » : 50+ d'abord — blanc cassé chaud, texte géant,
 *       UNE couleur d'accent (ambre), statuts en français clair, cibles 56px.
 *   C — « Éditoriale ivoire » : premium distinctif — ivoire, encre, titres
 *       Syne, cartes à bordure encre (style reçu/facture), ¥ rouge.
 *
 * Zéro dégradé partout. Vrais logos méthodes (source unique LOGO_PATH).
 */
import { LOGO_PATH } from '@/mobile/designKit/methods';
import { SURFACE, TEXT, PRIMARY_PILL, TONE_PILL } from '@/mobile/designKit/tokens';
import {
  Landmark, Plus, ChevronRight, Home, Send, ArrowDownToLine, CircleUser,
  HelpCircle, ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type MKey = 'alipay' | 'wechat' | 'bank' | 'cash';

function MethodLogo({ k, size = 44, radius = 16 }: { k: MKey; size?: number; radius?: number }) {
  const s = { width: size, height: size, borderRadius: radius };
  if (k === 'alipay')
    return (
      <div style={s} className="flex shrink-0 items-center justify-center bg-white ring-1 ring-black/[0.06]">
        <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} fill="#1677FF"><path d={LOGO_PATH.alipay} /></svg>
      </div>
    );
  if (k === 'wechat')
    return (
      <div style={s} className="flex shrink-0 items-center justify-center bg-[#07C160]">
        <svg viewBox="0 0 24 24" width={size * 0.56} height={size * 0.56} fill="#fff"><path d={LOGO_PATH.wechat} /></svg>
      </div>
    );
  if (k === 'cash')
    return (
      <div style={s} className="flex shrink-0 items-center justify-center bg-[#E0322B]">
        <span className="font-black leading-none text-white" style={{ fontSize: size * 0.5 }}>¥</span>
      </div>
    );
  return (
    <div style={s} className="flex shrink-0 items-center justify-center bg-[#ECE8F6] text-[#2C2740] dark:bg-[#2A2738] dark:text-[#E7E3F2]">
      <Landmark style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={1.8} />
    </div>
  );
}

// Paiements d'exemple — statuts RÉELS du flux client.
const PAYMENTS: {
  k: MKey; name: string; xaf: string; rmb: string; when: string;
  status: 'completed' | 'processing' | 'waiting_beneficiary_info' | 'cash_pending';
}[] = [
  { k: 'alipay', name: 'Guangzhou Textile Co.', xaf: '2 500 000', rmb: '28 825', when: "Aujourd'hui, 09:12", status: 'processing' },
  { k: 'wechat', name: 'Shenzhen Electronics', xaf: '850 000', rmb: '9 648', when: 'Hier, 16:40', status: 'completed' },
  { k: 'cash', name: 'Retrait cash · Guangzhou', xaf: '1 200 000', rmb: '13 836', when: 'Hier, 11:05', status: 'cash_pending' },
  { k: 'bank', name: 'Yiwu Trading Ltd', xaf: '4 000 000', rmb: '44 800', when: '6 juin', status: 'waiting_beneficiary_info' },
];

/* ================================================================== *
 *  DIRECTION A — « Continuité » (langage admin validé, décliné client)
 * ================================================================== */
const A_STATUS: Record<string, { label: string; cls: string }> = {
  completed: { label: 'Payé', cls: TONE_PILL.success },
  processing: { label: 'En cours', cls: TONE_PILL.info },
  waiting_beneficiary_info: { label: 'Infos requises', cls: TONE_PILL.warning },
  cash_pending: { label: 'Cash à retirer', cls: TONE_PILL.warning },
};

export function PayDirA() {
  return (
    <div className={cn('mx-auto min-h-screen max-w-[420px]', SURFACE.canvas)}>
      <div className="space-y-5 p-4 pt-6">
        {/* En-tête */}
        <div className="flex items-center justify-between px-1">
          <div>
            <div className={cn('text-[13px]', TEXT.muted)}>Bonjour Papa Nguemo 👋</div>
            <h1 className={cn('text-[24px] font-black leading-tight', TEXT.strong)}>Paiements</h1>
          </div>
          <div className={cn('flex h-11 w-11 items-center justify-center rounded-full', SURFACE.card, SURFACE.shadow)}>
            <HelpCircle className={cn('h-5 w-5', TEXT.muted)} />
          </div>
        </div>

        {/* Solde + action principale */}
        <div className={cn('rounded-[24px] p-5', SURFACE.card, SURFACE.shadow)}>
          <div className={cn('text-[12px] font-semibold uppercase tracking-wider', TEXT.muted)}>Mon solde</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={cn('text-[36px] font-black leading-none tabular-nums', TEXT.strong)}>4 250 000</span>
            <span className="text-[15px] font-extrabold text-[#E8932A]">XAF</span>
          </div>
          <button className={cn('mt-4 flex w-full items-center justify-center gap-2 py-[15px] text-[15px] font-bold', PRIMARY_PILL)}>
            <Send className="h-[17px] w-[17px]" /> Payer un fournisseur
          </button>
          <div className={cn('mt-2.5 text-center text-[12px]', TEXT.muted)}>
            Taux du jour : <span className="font-bold tabular-nums">11 530</span> ¥ pour 1M XAF
          </div>
        </div>

        {/* Aperçu étape Montant (langage du wizard) */}
        <div>
          <div className={cn('mb-2 px-1 text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>Nouveau paiement — montant</div>
          <div className={cn('rounded-[24px] p-5', SURFACE.card, SURFACE.shadow)}>
            <div className={cn('text-[12px] font-medium', TEXT.muted)}>Vous payez</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className={cn('text-[40px] font-black leading-none tabular-nums', TEXT.strong)}>2 500 000</span>
              <span className="text-[18px] font-extrabold text-[#E8932A]">XAF</span>
            </div>
            <div className="mt-3 rounded-2xl bg-[#EDEAFA] p-4 dark:bg-[#221F33]">
              <div className={cn('text-[12px]', TEXT.muted)}>Votre fournisseur reçoit</div>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="text-[22px] font-black text-[#C3BDD2] dark:text-[#5C5772]">¥</span>
                <span className={cn('text-[32px] font-black leading-none tabular-nums', TEXT.strong)}>28 825</span>
              </div>
            </div>
          </div>
        </div>

        {/* Liste */}
        <div>
          <div className="mb-2 flex items-center justify-between px-1">
            <span className={cn('text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>Mes paiements</span>
            <span className={cn('text-[12px] font-semibold', TEXT.muted)}>Tout voir</span>
          </div>
          <div className={cn('rounded-[24px] px-4', SURFACE.card, SURFACE.shadow)}>
            {PAYMENTS.map((p, i) => (
              <div key={p.name} className={cn('flex items-center gap-3 py-3.5', i < PAYMENTS.length - 1 && 'border-b border-black/[0.05] dark:border-white/[0.06]')}>
                <MethodLogo k={p.k} size={46} radius={23} />
                <div className="min-w-0 flex-1">
                  <div className={cn('truncate text-[15px] font-bold', TEXT.strong)}>{p.name}</div>
                  <div className={cn('mt-0.5 text-[12px]', TEXT.muted)}>{p.when}</div>
                </div>
                <div className="text-right">
                  <div className={cn('text-[15px] font-extrabold tabular-nums', TEXT.strong)}>−{p.xaf}</div>
                  <span className={cn('mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold', A_STATUS[p.status].cls)}>
                    {A_STATUS[p.status].label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom nav — pilule charbon flottante (en flux pour la capture) */}
      <div className="px-6 pb-6">
        <div className="flex items-center justify-between rounded-full bg-[#1C1B22] px-7 py-3.5 text-white shadow-[0_18px_40px_-18px_rgba(20,16,40,0.55)] dark:bg-[#F2F1F7] dark:text-[#1B1A24]">
          {[
            { I: Home, l: 'Accueil', on: false },
            { I: Send, l: 'Payer', on: true },
            { I: ArrowDownToLine, l: 'Déposer', on: false },
            { I: CircleUser, l: 'Profil', on: false },
          ].map(({ I, l, on }) => (
            <div key={l} className={cn('flex flex-col items-center gap-0.5', !on && 'opacity-45')}>
              <I className="h-[19px] w-[19px]" strokeWidth={on ? 2.4 : 2} />
              <span className="text-[10px] font-bold">{l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================================================================== *
 *  DIRECTION B — « Grand lisible » (50+ d'abord : géant, une couleur)
 * ================================================================== */
const B = {
  canvas: 'bg-[#FAF7F2] dark:bg-[#141210]',
  card: 'bg-white dark:bg-[#1F1C18]',
  strong: 'text-[#211B12] dark:text-[#F4EFE6]',
  muted: 'text-[#8A8073] dark:text-[#9C9284]',
  shadow: 'shadow-[0_10px_30px_-14px_rgba(60,45,20,0.18)] dark:shadow-none dark:ring-1 dark:ring-white/[0.07]',
  accent: '#D97B06',
};
const B_STATUS: Record<string, { label: string; dot: string }> = {
  completed: { label: 'Payé au fournisseur', dot: '#2E7D52' },
  processing: { label: 'En cours de paiement', dot: '#1D6FB8' },
  waiting_beneficiary_info: { label: 'Il manque une information', dot: '#D97B06' },
  cash_pending: { label: 'Cash prêt à retirer', dot: '#D97B06' },
};

export function PayDirB() {
  return (
    <div className={cn('mx-auto min-h-screen max-w-[420px]', B.canvas)}>
      <div className="space-y-6 p-5 pt-7">
        {/* En-tête très simple */}
        <div className="px-0.5">
          <h1 className={cn('text-[30px] font-black leading-tight', B.strong)}>Mes paiements</h1>
          <p className={cn('mt-1 text-[16px]', B.muted)}>Payez vos fournisseurs en Chine, simplement.</p>
        </div>

        {/* Solde géant + UN bouton géant */}
        <div className={cn('rounded-[28px] p-6', B.card, B.shadow)}>
          <div className={cn('text-[15px] font-semibold', B.muted)}>Argent disponible</div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className={cn('text-[44px] font-black leading-none tabular-nums', B.strong)}>4 250 000</span>
            <span className="text-[18px] font-extrabold" style={{ color: B.accent }}>XAF</span>
          </div>
          <button
            className="mt-5 flex h-[60px] w-full items-center justify-center gap-2.5 rounded-2xl text-[18px] font-extrabold text-white"
            style={{ background: B.accent }}
          >
            <Plus className="h-6 w-6" strokeWidth={2.6} /> Faire un paiement
          </button>
        </div>

        {/* Étape Montant — une seule question, très gros */}
        <div className={cn('rounded-[28px] p-6', B.card, B.shadow)}>
          <div className={cn('text-[17px] font-bold', B.strong)}>Combien envoyez-vous ?</div>
          <div className="mt-3 flex items-baseline gap-2 border-b-2 border-[#E9E2D6] pb-3 dark:border-[#3A342B]">
            <span className={cn('text-[46px] font-black leading-none tabular-nums', B.strong)}>2 500 000</span>
            <span className="text-[19px] font-extrabold" style={{ color: B.accent }}>XAF</span>
          </div>
          <div className={cn('mt-3 flex items-center justify-between text-[16px]', B.muted)}>
            <span>Le fournisseur reçoit</span>
            <span className={cn('text-[22px] font-black tabular-nums', B.strong)}>¥ 28 825</span>
          </div>
        </div>

        {/* Liste — une GROSSE carte par paiement, statut en français clair */}
        <div className="space-y-3.5">
          {PAYMENTS.slice(0, 3).map((p) => (
            <div key={p.name} className={cn('rounded-[28px] p-5', B.card, B.shadow)}>
              <div className="flex items-center gap-4">
                <MethodLogo k={p.k} size={56} radius={18} />
                <div className="min-w-0 flex-1">
                  <div className={cn('truncate text-[18px] font-extrabold', B.strong)}>{p.name}</div>
                  <div className={cn('mt-0.5 text-[14px]', B.muted)}>{p.when}</div>
                </div>
                <ChevronRight className={cn('h-6 w-6 shrink-0', B.muted)} />
              </div>
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#F5F0E7] px-4 py-3 dark:bg-[#2A2620]">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: B_STATUS[p.status].dot }} />
                  <span className={cn('text-[15px] font-bold', B.strong)}>{B_STATUS[p.status].label}</span>
                </div>
                <span className={cn('text-[17px] font-black tabular-nums', B.strong)}>{p.xaf} F</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom nav — 3 onglets, libellés toujours visibles, très grands (en flux pour la capture) */}
      <div className="border-t border-[#EDE6DA] bg-white px-4 pb-5 pt-2.5 dark:border-[#2E2922] dark:bg-[#1F1C18]">
        <div className="flex items-center justify-around">
          {[
            { I: Home, l: 'Accueil', on: false },
            { I: Send, l: 'Payer', on: true },
            { I: CircleUser, l: 'Mon compte', on: false },
          ].map(({ I, l, on }) => (
            <div key={l} className="flex flex-col items-center gap-1" style={{ color: on ? B.accent : undefined }}>
              <I className={cn('h-7 w-7', !on && B.muted)} strokeWidth={on ? 2.5 : 2} />
              <span className={cn('text-[13px] font-extrabold', !on && B.muted)}>{l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================================================================== *
 *  DIRECTION C — « Éditoriale ivoire » (premium print, bordure encre)
 * ================================================================== */
const C = {
  canvas: 'bg-[#F5F1E8] dark:bg-[#171511]',
  card: 'bg-[#FDFBF6] dark:bg-[#201D17]',
  strong: 'text-[#1C1A16] dark:text-[#F1ECE0]',
  muted: 'text-[#7E7669] dark:text-[#97907F]',
  border: 'border-[1.5px] border-[#1C1A16] dark:border-[#E8E2D2]',
  ink: '#1C1A16',
};
const C_STATUS: Record<string, { label: string; color: string }> = {
  completed: { label: 'PAYÉ', color: '#2E7D52' },
  processing: { label: 'EN COURS', color: '#1D6FB8' },
  waiting_beneficiary_info: { label: 'À COMPLÉTER', color: '#B8860B' },
  cash_pending: { label: 'CASH PRÊT', color: '#B8860B' },
};

export function PayDirC() {
  return (
    <div className={cn('mx-auto min-h-screen max-w-[420px]', C.canvas)}>
      <div className="space-y-5 p-4 pt-7">
        {/* En-tête éditorial */}
        <div className="px-1">
          <div className={cn('text-[11px] font-bold uppercase tracking-[0.18em]', C.muted)}>Bonzini · Compte client</div>
          <h1 className={cn('mt-1 text-[32px] font-extrabold leading-none', C.strong)} style={{ fontFamily: 'Syne, sans-serif' }}>
            Paiements
          </h1>
        </div>

        {/* Solde — carte reçu */}
        <div className={cn('rounded-[20px] p-5', C.card, C.border)}>
          <div className="flex items-start justify-between">
            <div>
              <div className={cn('text-[11px] font-bold uppercase tracking-[0.14em]', C.muted)}>Solde disponible</div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className={cn('text-[38px] font-black leading-none tabular-nums', C.strong)}>4 250 000</span>
                <span className={cn('text-[14px] font-extrabold', C.muted)}>XAF</span>
              </div>
            </div>
            <span className="mt-1 inline-flex rounded-md bg-[#7C5CF0] px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white">Actif</span>
          </div>
          <div className="my-4 border-t border-dashed border-[#C9C2B2] dark:border-[#4A453A]" />
          <button className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl text-[15px] font-extrabold text-[#F5F1E8] dark:bg-[#E8E2D2] dark:text-[#1C1A16]" style={{ background: C.ink }}>
            Payer un fournisseur <ArrowRight className="h-[17px] w-[17px]" />
          </button>
        </div>

        {/* Étape Montant — façon bordereau */}
        <div className={cn('rounded-[20px] p-5', C.card, C.border)}>
          <div className={cn('text-[11px] font-bold uppercase tracking-[0.14em]', C.muted)}>Ordre de paiement — montant</div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className={cn('text-[15px] font-semibold', C.muted)}>Vous payez</span>
            <span className={cn('text-[30px] font-black tabular-nums', C.strong)}>2 500 000 <span className="text-[14px]">XAF</span></span>
          </div>
          <div className="my-3 border-t border-dashed border-[#C9C2B2] dark:border-[#4A453A]" />
          <div className="flex items-baseline justify-between">
            <span className={cn('text-[15px] font-semibold', C.muted)}>Le fournisseur reçoit</span>
            <span className="text-[30px] font-black tabular-nums text-[#C2342C]">¥ 28 825</span>
          </div>
          <div className={cn('mt-2 text-right text-[11px] font-semibold uppercase tracking-wide', C.muted)}>Taux appliqué 11 530 / 1M</div>
        </div>

        {/* Liste — registre */}
        <div>
          <div className={cn('mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.18em]', C.muted)}>Registre — juin 2026</div>
          <div className={cn('rounded-[20px] px-4', C.card, C.border)}>
            {PAYMENTS.map((p, i) => (
              <div key={p.name} className={cn('flex items-center gap-3 py-3.5', i < PAYMENTS.length - 1 && 'border-b border-dashed border-[#C9C2B2] dark:border-[#4A453A]')}>
                <MethodLogo k={p.k} size={42} radius={12} />
                <div className="min-w-0 flex-1">
                  <div className={cn('truncate text-[14.5px] font-extrabold', C.strong)}>{p.name}</div>
                  <div className="mt-0.5 text-[10.5px] font-black uppercase tracking-wide" style={{ color: C_STATUS[p.status].color }}>
                    {C_STATUS[p.status].label}
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn('text-[15px] font-black tabular-nums', C.strong)}>−{p.xaf}</div>
                  <div className={cn('text-[11px] tabular-nums', C.muted)}>¥ {p.rmb}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom nav — barre encre éditoriale (en flux pour la capture) */}
      <div className="px-6 pb-6">
        <div className="flex items-center justify-between rounded-2xl px-7 py-3.5 text-[#F5F1E8] dark:bg-[#E8E2D2] dark:text-[#1C1A16]" style={{ background: C.ink }}>
          {[
            { I: Home, l: 'Accueil', on: false },
            { I: Send, l: 'Payer', on: true },
            { I: ArrowDownToLine, l: 'Déposer', on: false },
            { I: CircleUser, l: 'Profil', on: false },
          ].map(({ I, l, on }) => (
            <div key={l} className={cn('flex flex-col items-center gap-0.5', !on && 'opacity-40')}>
              <I className="h-[19px] w-[19px]" strokeWidth={on ? 2.4 : 2} />
              <span className="text-[10px] font-extrabold uppercase tracking-wide">{l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
