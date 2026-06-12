/**
 * DEV-ONLY maquette WIZARD « Nouveau paiement » (étape 4.1 refonte client).
 * Aligne le formulaire de création sur le langage validé v7/v8 :
 *   · en-tête drill-in (retour rond + titre) — fini le PageHeader à bordure
 *   · progression 4 segments lilas AVEC libellés (Méthode·Montant·Bénéficiaire·Résumé)
 *   · méthodes AVEC taux du jour par mode (ambre) ; cash = « Retrait au bureau »
 *   · montant : segment XAF/RMB en carte blanche, gros chiffre, bloc lilas
 *     « Votre bénéficiaire reçoit » + taux « 1 000 000 XAF = 11 480 ¥ »,
 *     solde après paiement, presets une ligne
 *   · bénéficiaire : Enregistré/Nouveau en carte blanche, alias d'abord,
 *     « plus tard » en lien discret (≠ CTA), doublon ambre, moi-même/autre
 *   · résumé : hero idem fiche v7 (logo+label, reçoit ¥, payez XAF, taux lilas)
 *   · CTA unique en pied (pilule sombre)
 * Harness: ?screen=cpay-wiz-method | -amount | -benef | -benef-new | -confirm
 */
import { LOGO_PATH } from '@/mobile/designKit/methods';
import { SURFACE, TEXT, PRIMARY_PILL, SOFT_PILL } from '@/mobile/designKit/tokens';
import {
  ArrowLeft, ArrowRight, Check, Landmark, User, Users, ChevronRight,
  ImagePlus, Info, AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type MKey = 'alipay' | 'wechat' | 'bank' | 'cash';
const LILAC = '#8B5CF6';
const AMBER = '#E8932A';

function MethodLogo({ k, size = 44, radius }: { k: MKey; size?: number; radius?: number }) {
  const s = { width: size, height: size, borderRadius: radius ?? Math.round(size * 0.27) };
  if (k === 'alipay') return <div style={{ ...s, background: '#1677FF' }} className="flex shrink-0 items-center justify-center"><svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="#fff"><path d={LOGO_PATH.alipay} /></svg></div>;
  if (k === 'wechat') return <div style={{ ...s, background: '#07C160' }} className="flex shrink-0 items-center justify-center"><svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="#fff"><path d={LOGO_PATH.wechat} /></svg></div>;
  if (k === 'cash') return <div style={{ ...s, background: '#E0322B' }} className="flex shrink-0 items-center justify-center font-black text-white"><span style={{ fontSize: size * 0.5 }}>¥</span></div>;
  return <div style={{ ...s, background: '#7C66DC' }} className="flex shrink-0 items-center justify-center"><Landmark className="text-white" style={{ width: size * 0.5, height: size * 0.5 }} /></div>;
}

const STEPS = ['Méthode', 'Montant', 'Bénéficiaire', 'Résumé'];

/** Cadre commun du wizard : en-tête drill-in + progression + CTA en pied. */
function Frame({ step, cta, children }: { step: number; cta: string; children: React.ReactNode }) {
  return (
    <div className={cn('mx-auto flex min-h-screen max-w-[420px] flex-col', SURFACE.canvas)}>
      <div className="flex items-center gap-3 px-4 pb-1 pt-4">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', SURFACE.card, SURFACE.shadow)}>
          <ArrowLeft className={cn('h-5 w-5', TEXT.strong)} />
        </div>
        <span className={cn('text-[17px] font-black', TEXT.strong)}>Nouveau paiement</span>
      </div>

      <div className="px-4 pb-1 pt-3">
        <div className="flex gap-1.5">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 flex-col items-center gap-1.5">
              <div className={cn('h-1.5 w-full rounded-full', i <= step ? 'bg-[#8B5CF6]' : 'bg-black/[0.07] dark:bg-white/[0.09]')} />
              <span className={cn('text-[10px] font-bold', i <= step ? 'text-[#5B4CC4] dark:text-[#B5AAF0]' : TEXT.muted)}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-4 px-4 py-4">{children}</div>

      <div className="px-4 pb-6 pt-2">
        <button className={cn('flex w-full items-center justify-center gap-2 py-[15px] text-[15px] font-bold', PRIMARY_PILL)}>
          {cta} <ArrowRight className="h-[17px] w-[17px]" />
        </button>
      </div>
    </div>
  );
}

/* ===================== ÉTAPE 1 — MÉTHODE ===================== */
export function WizMethod() {
  const METHODS: { k: MKey; label: string; desc: string; rate: string; sel?: boolean }[] = [
    { k: 'alipay', label: 'Alipay', desc: 'Règlement sur compte Alipay', rate: '11 480', sel: true },
    { k: 'wechat', label: 'WeChat Pay', desc: 'Règlement sur compte WeChat', rate: '11 350' },
    { k: 'bank', label: 'Virement bancaire', desc: 'Règlement sur compte bancaire', rate: '11 200' },
    { k: 'cash', label: 'Cash', desc: 'Retrait au bureau Bonzini', rate: '11 530' },
  ];
  return (
    <Frame step={0} cta="Continuer">
      <div className="px-1">
        <h1 className={cn('text-[18px] font-black', TEXT.strong)}>Comment votre fournisseur est-il payé ?</h1>
        <p className={cn('mt-0.5 text-[13px]', TEXT.muted)}>Le taux du jour dépend du mode choisi.</p>
      </div>
      <div className="space-y-3">
        {METHODS.map((m) => (
          <div key={m.k} className={cn('flex w-full items-center gap-4 rounded-[20px] p-4', SURFACE.card, SURFACE.shadow, m.sel && 'ring-2 ring-[#8B5CF6]')}>
            <MethodLogo k={m.k} size={48} />
            <div className="min-w-0 flex-1">
              <p className={cn('text-[16px] font-bold leading-tight', TEXT.strong)}>{m.label}</p>
              <p className={cn('mt-0.5 text-[12px]', TEXT.muted)}>{m.desc}</p>
              <p className={cn('mt-1 text-[12px]', TEXT.muted)}>
                <span className="font-bold" style={{ color: AMBER }}>{m.rate}</span> ¥ / 1 000 000 XAF
              </p>
            </div>
            {m.sel && (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#8B5CF6]">
                <Check className="h-4 w-4 text-white" strokeWidth={3} />
              </span>
            )}
          </div>
        ))}
      </div>
    </Frame>
  );
}

/* ===================== ÉTAPE 2 — MONTANT ===================== */
export function WizAmount() {
  return (
    <Frame step={1} cta="Continuer">
      {/* Devise — segment en carte blanche (lisible sur le canvas) */}
      <div className={cn('inline-flex w-full items-center gap-1 rounded-full p-1', SURFACE.card, SURFACE.shadow)}>
        <button className="flex-1 rounded-full bg-[#8B5CF6] py-2 text-[13px] font-bold text-white">En XAF</button>
        <button className={cn('flex-1 rounded-full py-2 text-[13px] font-bold', TEXT.muted)}>En RMB</button>
      </div>

      {/* Montant — gros chiffre + conversion + taux DANS le même bloc lilas */}
      <div className={cn('rounded-[22px] p-5', SURFACE.card, SURFACE.shadow)}>
        <div className="flex items-center justify-between">
          <span className={cn('text-[12px] font-medium', TEXT.muted)}>Vous payez</span>
          <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums', SURFACE.holder)}>Solde · 4 250 000 XAF</span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className={cn('min-w-0 flex-1 text-[40px] font-black leading-none tabular-nums', TEXT.strong)}>2 500 000</span>
          <span className="shrink-0 text-[18px] font-extrabold" style={{ color: AMBER }}>XAF</span>
        </div>

        <div className="mt-4 rounded-2xl bg-[#EDEAFA] p-4 dark:bg-[#221F33]">
          <div className={cn('text-[12px]', TEXT.muted)}>Votre bénéficiaire reçoit</div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="text-[22px] font-black text-[#C3BDD2] dark:text-[#5C5772]">¥</span>
            <span className={cn('text-[30px] font-black leading-none tabular-nums', TEXT.strong)}>28 700</span>
          </div>
          <div className={cn('mt-3 border-t border-black/[0.05] pt-2.5 text-[12px] tabular-nums dark:border-white/[0.08]', TEXT.muted)}>
            Taux du jour · <span className={cn('font-bold', TEXT.strong)}>1 000 000 XAF = 11 480 ¥</span>
          </div>
        </div>

        <p className={cn('mt-3 text-[12px] tabular-nums', TEXT.muted)}>
          Solde après paiement : <span className="font-bold">1 750 000 XAF</span>
        </p>
      </div>

      {/* Presets — une seule ligne */}
      <div className="grid grid-cols-5 gap-2">
        {['100K', '250K', '500K', '1M', 'Tout'].map((p) => (
          <button key={p} className={cn('rounded-xl py-2.5 text-[12px] font-bold', p === '1M' ? 'bg-[#8B5CF6] text-white' : cn(SURFACE.card, SURFACE.shadow, TEXT.muted))}>{p}</button>
        ))}
      </div>

      <p className={cn('px-1 text-center text-[11px]', TEXT.muted)}>Minimum 10 000 XAF · Maximum 50 000 000 XAF</p>
    </Frame>
  );
}

/* ============== ÉTAPE 3 — BÉNÉFICIAIRE (enregistré) ============== */
export function WizBenefSaved() {
  const SAVED = [
    { alias: 'Guangzhou Textile', sub: 'gz-textile@alipay.cn', sel: true },
    { alias: 'Li Wei · tissus', sub: 'li.wei-1988', sel: false },
  ];
  return (
    <Frame step={2} cta="Continuer">
      <div className="px-1">
        <h1 className={cn('text-[18px] font-black', TEXT.strong)}>Qui voulez-vous payer ?</h1>
        <p className={cn('mt-0.5 text-[13px]', TEXT.muted)}>Choisissez un bénéficiaire Alipay enregistré ou créez-en un nouveau.</p>
      </div>

      <div className={cn('inline-flex w-full items-center gap-1 rounded-full p-1', SURFACE.card, SURFACE.shadow)}>
        <button className={cn('flex-1 rounded-full bg-[#8B5CF6] py-2 text-[13px] font-bold text-white')}>Enregistré</button>
        <button className={cn('flex-1 rounded-full py-2 text-[13px] font-bold', TEXT.muted)}>Nouveau</button>
      </div>

      <div className="space-y-2.5">
        {SAVED.map((b) => (
          <div key={b.alias} className={cn('flex w-full items-center gap-3 rounded-2xl p-3.5', SURFACE.card, SURFACE.shadow, b.sel && 'ring-2 ring-[#8B5CF6]')}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1677FF] text-[15px] font-bold text-white">{b.alias[0]}</div>
            <div className="min-w-0 flex-1">
              <p className={cn('truncate text-[15px] font-bold', TEXT.strong)}>{b.alias}</p>
              <p className={cn('truncate text-[12px]', TEXT.muted)}>{b.sub}</p>
            </div>
            {b.sel && (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#8B5CF6]">
                <Check className="h-4 w-4 text-white" strokeWidth={3} />
              </span>
            )}
          </div>
        ))}
      </div>

      {/* « Plus tard » = lien discret, PAS un bouton concurrent du CTA */}
      <button className={cn('flex w-full items-center justify-center gap-1 py-2 text-[13px] font-semibold text-[#5B4CC4] dark:text-[#B5AAF0]')}>
        Compléter les coordonnées plus tard <ChevronRight className="h-4 w-4" />
      </button>
    </Frame>
  );
}

/* ============== ÉTAPE 3bis — BÉNÉFICIAIRE (nouveau) ============== */
function Input({ label, value, placeholder }: { label: string; value?: string; placeholder?: string }) {
  return (
    <div>
      <label className={cn('mb-1.5 block px-0.5 text-[13px] font-semibold', TEXT.strong)}>{label}</label>
      <div className={cn('flex h-12 items-center rounded-2xl px-4 text-[16px]', SURFACE.card, SURFACE.shadow)}>
        {value ? <span className={cn('font-semibold', TEXT.strong)}>{value}</span> : <span className="text-[#9B98AD]">{placeholder}</span>}
      </div>
    </div>
  );
}

export function WizBenefNew() {
  return (
    <Frame step={2} cta="Continuer">
      <div className={cn('inline-flex w-full items-center gap-1 rounded-full p-1', SURFACE.card, SURFACE.shadow)}>
        <button className={cn('flex-1 rounded-full py-2 text-[13px] font-bold', TEXT.muted)}>Enregistré</button>
        <button className="flex-1 rounded-full bg-[#8B5CF6] py-2 text-[13px] font-bold text-white">Nouveau</button>
      </div>

      {/* Pour qui ? */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className={cn('flex items-center gap-2 rounded-2xl p-3.5', SURFACE.card, SURFACE.shadow)}>
          <User className={cn('h-5 w-5', TEXT.muted)} />
          <span className={cn('text-[14px] font-semibold', TEXT.muted)}>Moi-même</span>
        </div>
        <div className={cn('flex items-center gap-2 rounded-2xl p-3.5 ring-2 ring-[#8B5CF6]', SURFACE.card, SURFACE.shadow)}>
          <Users className={cn('h-5 w-5', TEXT.strong)} />
          <span className={cn('text-[14px] font-semibold', TEXT.strong)}>Une autre personne</span>
        </div>
      </div>

      <Input label="Alias (nom court, pour vous)" value="Shenzhen Elec." />
      <Input label="Nom du fournisseur" value="Shenzhen Electronics Co." />

      {/* QR — tuile d'upload */}
      <div>
        <label className={cn('mb-1.5 block px-0.5 text-[13px] font-semibold', TEXT.strong)}>QR Code Alipay</label>
        <div className={cn('flex items-center gap-3 rounded-2xl border-2 border-dashed border-[#C9C2F0] p-4 dark:border-[#4A4660]', SURFACE.card)}>
          <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl', SURFACE.holder)}>
            <ImagePlus className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className={cn('text-[14px] font-bold', TEXT.strong)}>Ajouter le QR Code</p>
            <p className={cn('text-[12px]', TEXT.muted)}>Photo ou capture d'écran</p>
          </div>
        </div>
      </div>

      <p className={cn('text-center text-[12px]', TEXT.muted)}>— ou —</p>
      <Input label="Identifiant Alipay" placeholder="Email, téléphone ou ID Alipay" />

      {/* Doublon (soft) — ambre, jamais bloquant */}
      <div className="flex items-start gap-2.5 rounded-2xl bg-[#FDF1DD] p-3.5 dark:bg-[#3A2F1A]">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#9A6B12] dark:text-[#E0B978]" />
        <p className="text-[12.5px] text-[#9A6B12] dark:text-[#E0B978]">
          Ce compte ressemble à « Shenzhen Elec. » déjà enregistré. <span className="font-bold underline">Utiliser celui-ci</span>
        </p>
      </div>

      <label className={cn('flex items-center gap-2 px-0.5 text-[13px]', TEXT.muted)}>
        <span className="flex h-4 w-4 items-center justify-center rounded border border-black/20 dark:border-white/25" />
        Ne pas enregistrer ce bénéficiaire dans mon carnet
      </label>
    </Frame>
  );
}

/* ===================== ÉTAPE 4 — RÉSUMÉ ===================== */
export function WizConfirm() {
  return (
    <Frame step={3} cta="Confirmer le paiement">
      {/* Hero — même langage que la fiche v7 */}
      <div className={cn('rounded-[26px] p-6', SURFACE.card, SURFACE.shadow)}>
        <div className="flex items-center gap-2">
          <MethodLogo k="alipay" size={30} radius={9} />
          <span className={cn('text-[13px] font-bold', TEXT.strong)}>Alipay</span>
        </div>
        <div className={cn('mt-5 text-[13px] font-semibold', TEXT.muted)}>Votre bénéficiaire reçoit</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-[30px] font-black text-[#C3BDD2] dark:text-[#5C5772]">¥</span>
          <span className={cn('text-[46px] font-black leading-none tabular-nums', TEXT.strong)}>28 700</span>
        </div>
        <div className={cn('mt-2.5 text-[15px] font-bold tabular-nums', TEXT.muted)}>Vous payez 2 500 000 XAF</div>
        <div className="mt-4 rounded-2xl bg-[#EDEAFA] px-4 py-3.5 dark:bg-[#221F33]">
          <div className={cn('text-[11px] font-bold uppercase tracking-wide', TEXT.muted)}>Taux du jour appliqué</div>
          <div className={cn('mt-1 text-[17px] font-black tabular-nums', TEXT.strong)}>1 000 000 XAF = 11 480 ¥</div>
        </div>
      </div>

      {/* Récap */}
      <div className={cn('rounded-[22px] p-5', SURFACE.card, SURFACE.shadow)}>
        <div className="flex items-center justify-between gap-3 py-1.5">
          <span className={cn('text-[13px]', TEXT.muted)}>Bénéficiaire</span>
          <span className={cn('text-[13px] font-bold', TEXT.strong)}>Guangzhou Textile</span>
        </div>
        <div className="flex items-center justify-between gap-3 py-1.5">
          <span className={cn('text-[13px]', TEXT.muted)}>Identifiant Alipay</span>
          <span className={cn('text-[13px] font-bold', TEXT.strong)}>gz-textile@alipay.cn</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 border-t border-black/[0.06] pt-3 dark:border-white/[0.08]">
          <span className={cn('text-[14px] font-semibold', TEXT.strong)}>Débité maintenant</span>
          <span className={cn('text-[15px] font-black tabular-nums', TEXT.strong)}>2 500 000 XAF</span>
        </div>
        <div className="flex items-center justify-between gap-3 py-1.5">
          <span className={cn('text-[13px]', TEXT.muted)}>Nouveau solde</span>
          <span className={cn('text-[13px] font-bold tabular-nums', TEXT.strong)}>1 750 000 XAF</span>
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-2xl bg-[#EAE7FA] p-3.5 dark:bg-[#272252]">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#5B4CC4] dark:text-[#B5AAF0]" />
        <p className="text-[12.5px] text-[#5B4CC4] dark:text-[#B5AAF0]">
          Votre solde est débité à la confirmation. Bonzini règle ensuite votre fournisseur et vous envoie la preuve.
        </p>
      </div>
    </Frame>
  );
}
