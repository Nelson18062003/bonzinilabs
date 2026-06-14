/**
 * DEV-ONLY maquettes — module CLIENT « Dépôts » (refonte).
 * Applique le langage validé (paiements v7/v8) à l'argent ENTRANT :
 *   · liste cycle de vie (rouge=à toi d'agir · lilas=Bonzini vérifie · vert=crédité)
 *   · wizard montant → méthode → récap (coordonnées Bonzini où verser)
 *   · fiche « preuve en attente » (countdown + coordonnées + upload + suivi)
 *   · fiche « crédité »
 * Montants en XAF uniquement (pas de ¥ ni de taux — on approvisionne le solde).
 * Harness: ?screen=cdep-list | -wiz-amount | -wiz-method | -wiz-recap
 *          | -detail-awaiting  | -wiz-bank | -detail-validated
 */
import { SURFACE, TEXT, PRIMARY_PILL } from '@/mobile/designKit/tokens';
import {
  ArrowLeft, ArrowRight, ArrowDownToLine, Check, ChevronRight, Copy, Clock,
  Landmark, Store, ImagePlus, Info, AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
// Vrais logos officiels (Orange/Wave/Ecobank/UBA/Afriland) récupérés via
// Wikimedia + site Wave. MTN composé (jaune + « MTN » bleu = couleurs exactes,
// le SVG libre étant monochrome). CCA : monogramme (aucune source libre).
import orangeLogo from '@/assets/deposit-logos/orange.svg';
import waveLogo from '@/assets/deposit-logos/wave.png';
import ecobankLogo from '@/assets/deposit-logos/ecobank.png';
import ubaLogo from '@/assets/deposit-logos/uba.svg';
import afrilandLogo from '@/assets/deposit-logos/afriland-mark.png';

type Fam = 'bank' | 'agency' | 'orange' | 'mtn' | 'wave';
type Bank = 'ecobank' | 'uba' | 'cca' | 'afriland';
const RED = '#C0504D', LILAC = '#8B5CF6', GREEN = '#2E7D52', AMBER = '#E8932A';

const tile = (size: number, radius?: number) =>
  ({ width: size, height: size, borderRadius: radius ?? Math.round(size * 0.27) }) as const;

/* Logos des moyens de paiement. Mobile money = vrai logo de marque (Orange
 * carré officiel, pingouin Wave) ; MTN = pastille jaune + « MTN » bleu (logo
 * typographique officiel) ; banque/agence = icône premium sur fond de marque. */
function FamLogo({ k, size = 48, radius }: { k: Fam; size?: number; radius?: number }) {
  const s = tile(size, radius);
  if (k === 'orange') return <img src={orangeLogo} alt="Orange Money" style={s} className="shrink-0 object-cover" />;
  if (k === 'wave') return <img src={waveLogo} alt="Wave" style={s} className="shrink-0 object-cover" />;
  if (k === 'mtn') return (
    <div style={{ ...s, background: '#FFCC00' }} className="flex shrink-0 items-center justify-center">
      <span className="font-black tracking-tighter text-[#004F9F]" style={{ fontSize: Math.round(size * 0.34), lineHeight: 1 }}>MTN</span>
    </div>
  );
  if (k === 'agency') return <div style={s} className="flex shrink-0 items-center justify-center bg-[#1C1B22]"><Store style={{ width: size * 0.5, height: size * 0.5 }} className="text-white" strokeWidth={1.9} /></div>;
  return <div style={s} className="flex shrink-0 items-center justify-center bg-[#3B3E9E]"><Landmark style={{ width: size * 0.5, height: size * 0.5 }} className="text-white" strokeWidth={1.9} /></div>;
}

/* Logos de banque — vrai logo sur tuile blanche (rendu premium standard).
 * `wide` = wordmark horizontal · sinon emblème carré. CCA : monogramme
 * (couleur de marque ; logo officiel non disponible librement). */
const BANKS: Record<Bank, { label: string; src?: string; wide?: boolean; mono?: string; bg?: string }> = {
  ecobank: { label: 'Ecobank Cameroun', src: ecobankLogo, wide: true },
  uba: { label: 'UBA Cameroun', src: ubaLogo, wide: true },
  afriland: { label: 'Afriland First Bank', src: afrilandLogo },
  cca: { label: 'CCA-BANK', mono: 'CCA', bg: '#1B3C8F' },
};
function BankLogo({ k, size = 48, radius }: { k: Bank; size?: number; radius?: number }) {
  const b = BANKS[k];
  if (!b.src) return (
    <div style={{ ...tile(size, radius), background: b.bg }} className="flex shrink-0 items-center justify-center">
      <span className="font-black tracking-tight text-white" style={{ fontSize: Math.round(size * 0.3), lineHeight: 1 }}>{b.mono}</span>
    </div>
  );
  const w = b.wide ? size * 0.82 : size * 0.6;
  const h = b.wide ? size * 0.52 : size * 0.6;
  return (
    <div style={tile(size, radius)} className="flex shrink-0 items-center justify-center overflow-hidden bg-white ring-1 ring-black/[0.06]">
      <img src={b.src} alt={b.label} className="object-contain" style={{ width: w, height: h }} />
    </div>
  );
}
function Progress({ step, color }: { step: number; color: string }) {
  return <div className="flex items-center gap-1">{[0, 1, 2, 3].map((i) => <div key={i} className={cn('h-1.5 flex-1 rounded-full', i > step && 'bg-black/[0.08] dark:bg-white/[0.10]')} style={i <= step ? { background: color } : undefined} />)}</div>;
}
function Pill({ label, color }: { label: string; color: string }) {
  return <span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ color, background: `${color}1F` }}>{label}</span>;
}
function Caption({ children }: { children: React.ReactNode }) {
  return <h2 className={cn('mb-2 px-1 text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>{children}</h2>;
}

/* ============================ LISTE ============================ */
export function DepList() {
  const items = [
    { k: 'orange' as Fam, label: 'Orange Money – Transfert', xaf: '500 000', step: 2, color: LILAC, pill: 'En vérification', hint: 'Bonzini vérifie votre versement', ref: 'BZ-DP-2412 · 13 juin 2026' },
    { k: 'agency' as Fam, label: 'Cash agence Bonzini', xaf: '1 000 000', step: 3, color: GREEN, pill: 'Crédité', hint: 'Crédité le 11 juin', ref: 'BZ-DP-2405 · 11 juin 2026' },
  ];
  return (
    <div className={cn('mx-auto min-h-screen max-w-[420px]', SURFACE.canvas)}>
      <div className="space-y-5 p-4 pt-6">
        <div className="px-1">
          <h1 className={cn('text-[26px] font-black leading-tight', TEXT.strong)}>Dépôts</h1>
          <p className={cn('mt-0.5 text-[13px]', TEXT.muted)}>Approvisionnez votre compte en XAF</p>
        </div>

        <button className={cn('flex w-full items-center gap-4 rounded-[24px] p-5 text-left', SURFACE.card, SURFACE.shadow)}>
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#1C1B22] dark:bg-[#F2F1F7]"><ArrowDownToLine className="h-[26px] w-[26px] text-white dark:text-[#1B1A24]" strokeWidth={2.2} /></div>
          <div className="min-w-0 flex-1">
            <div className={cn('text-[17px] font-black', TEXT.strong)}>Nouveau dépôt</div>
            <div className={cn('mt-0.5 text-[12px] tabular-nums', TEXT.muted)}>Solde · <span className={cn('font-bold', TEXT.strong)}>4 250 000 XAF</span></div>
          </div>
          <ArrowRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
        </button>

        {/* Filtres */}
        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {['Tous', 'À traiter', 'En cours', 'Terminés'].map((tb, i) => (
            <button key={tb} className={cn('flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-bold', i === 0 ? 'bg-[#8B5CF6] text-white' : cn(SURFACE.card, SURFACE.shadow, TEXT.muted))}>
              {tb}{i === 1 && <span className="rounded-full bg-[#C0504D] px-1.5 text-[10px] text-white">1</span>}
            </button>
          ))}
        </div>

        {/* À traiter (rouge) */}
        <section>
          <h2 className="mb-2 px-1 text-[11.5px] font-bold uppercase tracking-wider" style={{ color: RED }}>À traiter · urgent</h2>
          <div className="rounded-[22px] bg-[#FBE7E7] p-4 dark:bg-[#3A2526]">
            <div className="flex items-center gap-3">
              <FamLogo k="bank" size={44} radius={22} />
              <div className="min-w-0 flex-1">
                <div className={cn('truncate text-[16px] font-bold', TEXT.strong)}>Virement bancaire</div>
                <div className="mt-0.5 text-[12px] font-semibold" style={{ color: RED }}>Preuve de versement manquante</div>
              </div>
              <Pill label="Preuve en attente" color={RED} />
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className={cn('text-[20px] font-black tabular-nums', TEXT.strong)}>750 000</span>
              <span className="text-[12px] font-bold" style={{ color: RED }}>XAF</span>
            </div>
            <div className="mt-3"><Progress step={0} color={RED} /></div>
            <button className={cn('mt-3 flex w-full items-center justify-center gap-2 py-2.5 text-[13px] font-bold', PRIMARY_PILL)}>Ajouter la preuve <ArrowRight className="h-4 w-4" /></button>
          </div>
        </section>

        <section>
          <Caption>Mes dépôts</Caption>
          <div className="space-y-3">
            {items.map((p) => (
              <div key={p.ref} className={cn('rounded-[22px] p-4', SURFACE.card, SURFACE.shadow)}>
                <div className="flex items-center gap-3">
                  <FamLogo k={p.k} size={44} radius={22} />
                  <div className="min-w-0 flex-1">
                    <div className={cn('truncate text-[16px] font-bold', TEXT.strong)}>{p.label}</div>
                    <div className={cn('mt-0.5 text-[13px] font-bold tabular-nums', TEXT.strong)}>+{p.xaf} <span className={cn('text-[11px] font-semibold', TEXT.muted)}>XAF</span></div>
                  </div>
                  <Pill label={p.pill} color={p.color} />
                </div>
                <div className="mt-3"><Progress step={p.step} color={p.color} /></div>
                <div className="mt-2 flex items-center justify-between">
                  <span className={cn('truncate text-[12px]', TEXT.muted)}>{p.ref}</span>
                  <ChevronRight className={cn('h-4 w-4 shrink-0', TEXT.muted)} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ============================ WIZARD ============================ */
const PHASES = ['Montant', 'Méthode', 'Confirmation'];
function WizFrame({ phase, cta, showPhases = true, children }: { phase: number; cta: string; showPhases?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn('mx-auto flex min-h-screen max-w-[420px] flex-col', SURFACE.canvas)}>
      <div className="flex items-center gap-3 px-4 pb-1 pt-4">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', SURFACE.card, SURFACE.shadow)}><ArrowLeft className={cn('h-5 w-5', TEXT.strong)} /></div>
        <span className={cn('text-[17px] font-black', TEXT.strong)}>Nouveau dépôt</span>
      </div>
      {showPhases && (
        <div className="px-4 pb-1 pt-3">
          <div className="flex gap-1.5">
            {PHASES.map((label, i) => (
              <div key={label} className="flex flex-1 flex-col items-center gap-1.5">
                <div className={cn('h-1.5 w-full rounded-full', i <= phase ? 'bg-[#8B5CF6]' : 'bg-black/[0.07] dark:bg-white/[0.09]')} />
                <span className={cn('text-[10px] font-bold', i <= phase ? 'text-[#5B4CC4] dark:text-[#B5AAF0]' : TEXT.muted)}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex-1 space-y-4 px-4 py-4">{children}</div>
      <div className="px-4 pb-6 pt-2"><button className={cn('flex w-full items-center justify-center gap-2 py-[15px] text-[15px] font-bold', PRIMARY_PILL)}>{cta} <ArrowRight className="h-[17px] w-[17px]" /></button></div>
    </div>
  );
}

export function DepWizAmount() {
  return (
    <WizFrame phase={0} cta="Continuer" showPhases={false}>
      <div className={cn('rounded-[22px] p-5', SURFACE.card, SURFACE.shadow)}>
        <div className="flex items-center justify-between gap-2">
          <span className={cn('text-[12px] font-medium', TEXT.muted)}>Montant du dépôt</span>
          <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums', SURFACE.holder)}>Solde · 4 250 000 XAF</span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className={cn('min-w-0 flex-1 text-[40px] font-black leading-none tabular-nums', TEXT.strong)}>500 000</span>
          <span className="shrink-0 text-[18px] font-extrabold" style={{ color: AMBER }}>XAF</span>
        </div>
        <div className="mt-4 rounded-2xl bg-[#EDEAFA] p-4 dark:bg-[#221F33]">
          <div className={cn('text-[12px]', TEXT.muted)}>Nouveau solde après dépôt</div>
          <div className={cn('mt-0.5 text-[24px] font-black tabular-nums', TEXT.strong)}>4 750 000 <span className="text-[14px]" style={{ color: AMBER }}>XAF</span></div>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {['100K', '250K', '500K', '1M'].map((p) => (
          <button key={p} className={cn('rounded-xl py-2.5 text-[12px] font-bold', p === '500K' ? 'bg-[#8B5CF6] text-white' : cn(SURFACE.card, SURFACE.shadow, TEXT.muted))}>{p}</button>
        ))}
      </div>
      <p className={cn('px-1 text-center text-[11px]', TEXT.muted)}>Minimum 10 000 XAF · Maximum 50 000 000 XAF</p>
    </WizFrame>
  );
}

export function DepWizMethod() {
  const fams: { k: Fam; label: string; desc: string; sel?: boolean }[] = [
    { k: 'bank', label: 'Banque / Microfinance', desc: 'Virement ou dépôt cash au guichet', sel: true },
    { k: 'agency', label: 'Cash en agence Bonzini', desc: 'Déposez en espèces à nos agences' },
    { k: 'orange', label: 'Orange Money', desc: 'Transfert ou retrait code marchand' },
    { k: 'mtn', label: 'MTN Mobile Money', desc: 'Transfert ou retrait code marchand' },
    { k: 'wave', label: 'Wave', desc: 'Transfert Wave vers Bonzini' },
  ];
  return (
    <WizFrame phase={1} cta="Continuer">
      <div className="px-1">
        <h1 className={cn('text-[18px] font-black', TEXT.strong)}>Comment versez-vous les fonds ?</h1>
        <p className={cn('mt-0.5 text-[13px]', TEXT.muted)}>Choisissez votre moyen de versement à Bonzini.</p>
      </div>
      <div className="space-y-3">
        {fams.map((m) => (
          <div key={m.k} className={cn('flex w-full items-center gap-4 rounded-[20px] p-4', SURFACE.card, SURFACE.shadow, m.sel && 'ring-2 ring-[#8B5CF6]')}>
            <FamLogo k={m.k} size={48} />
            <div className="min-w-0 flex-1">
              <p className={cn('text-[16px] font-bold leading-tight', TEXT.strong)}>{m.label}</p>
              <p className={cn('mt-0.5 text-[12px]', TEXT.muted)}>{m.desc}</p>
            </div>
            {m.sel
              ? <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#8B5CF6]"><Check className="h-4 w-4 text-white" strokeWidth={3} /></span>
              : <ChevronRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />}
          </div>
        ))}
      </div>
    </WizFrame>
  );
}

export function DepWizBank() {
  const list: { k: Bank; sel?: boolean }[] = [
    { k: 'ecobank', sel: true }, { k: 'uba' }, { k: 'cca' }, { k: 'afriland' },
  ];
  return (
    <WizFrame phase={1} cta="Continuer">
      <div className="px-1">
        <h1 className={cn('text-[18px] font-black', TEXT.strong)}>Vers quelle banque ?</h1>
        <p className={cn('mt-0.5 text-[13px]', TEXT.muted)}>Choisissez la banque Bonzini où vous allez verser.</p>
      </div>
      <div className="space-y-3">
        {list.map((b) => (
          <div key={b.k} className={cn('flex w-full items-center gap-4 rounded-[20px] p-4', SURFACE.card, SURFACE.shadow, b.sel && 'ring-2 ring-[#8B5CF6]')}>
            <BankLogo k={b.k} size={48} />
            <div className="min-w-0 flex-1">
              <p className={cn('text-[16px] font-bold leading-tight', TEXT.strong)}>{BANKS[b.k].label}</p>
              <p className={cn('mt-0.5 text-[12px]', TEXT.muted)}>Compte Bonzini disponible</p>
            </div>
            {b.sel
              ? <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#8B5CF6]"><Check className="h-4 w-4 text-white" strokeWidth={3} /></span>
              : <ChevronRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />}
          </div>
        ))}
      </div>
    </WizFrame>
  );
}

function CoordRow({ label, value, mono, last }: { label: string; value: string; mono?: boolean; last?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 py-3', !last && 'border-b border-black/[0.05] dark:border-white/[0.07]')}>
      <div className="min-w-0">
        <div className={cn('text-[11px]', TEXT.muted)}>{label}</div>
        <div className={cn('mt-0.5 truncate text-[14px] font-bold', mono && 'font-mono', TEXT.strong)}>{value}</div>
      </div>
      <Copy className={cn('h-4 w-4 shrink-0', TEXT.muted)} />
    </div>
  );
}

export function DepWizRecap() {
  return (
    <WizFrame phase={2} cta="J'ai compris, créer le dépôt">
      {/* Montant héros */}
      <div className={cn('rounded-[26px] p-6', SURFACE.card, SURFACE.shadow)}>
        <div className="flex items-center gap-2"><BankLogo k="ecobank" size={30} radius={9} /><span className={cn('text-[13px] font-bold', TEXT.strong)}>Virement bancaire · Ecobank</span></div>
        <div className={cn('mt-5 text-[13px] font-semibold', TEXT.muted)}>Vous allez verser</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className={cn('text-[46px] font-black leading-none tracking-tight tabular-nums', TEXT.strong)}>500 000</span>
          <span className="text-[18px] font-extrabold" style={{ color: AMBER }}>XAF</span>
        </div>
      </div>
      {/* Coordonnées Bonzini */}
      <section>
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className={cn('text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>Compte Bonzini · où verser</h2>
          <span className="text-[12px] font-bold text-[#5B4CC4] dark:text-[#B5AAF0]">Tout copier</span>
        </div>
        <div className={cn('rounded-[22px] p-5', SURFACE.card, SURFACE.shadow)}>
          <CoordRow label="Banque" value="Ecobank Cameroun SA" />
          <CoordRow label="Titulaire" value="NORTON GAUSS BONZINI SARL" />
          <CoordRow label="Numéro de compte" value="30245039710" mono />
          <CoordRow label="Référence à indiquer" value="BZ-DP-2418" mono last />
        </div>
      </section>
      <div className="flex items-start gap-2.5 rounded-2xl bg-[#EAE7FA] p-3.5 dark:bg-[#272252]">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#5B4CC4] dark:text-[#B5AAF0]" />
        <p className="text-[12.5px] text-[#5B4CC4] dark:text-[#B5AAF0]">Indiquez bien la <b>référence</b> lors du virement. Vous ajouterez la preuve juste après, votre solde est crédité dès vérification.</p>
      </div>
    </WizFrame>
  );
}

/* ============================ FICHE ============================ */
function DetailFrame({ ref_, children }: { ref_: string; children: React.ReactNode }) {
  return (
    <div className={cn('mx-auto min-h-screen max-w-[420px]', SURFACE.canvas)}>
      <div className="flex items-center gap-3 px-4 pb-1 pt-4">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', SURFACE.card, SURFACE.shadow)}><ArrowLeft className={cn('h-5 w-5', TEXT.strong)} /></div>
        <span className={cn('truncate text-[17px] font-black', TEXT.strong)}>{ref_}</span>
      </div>
      <div className="space-y-5 px-4 pb-8 pt-3">{children}</div>
    </div>
  );
}

export function DepDetailAwaiting() {
  const TL = [
    { label: 'Dépôt déclaré', sub: '13 juin · 09:14', st: 'done' as const },
    { label: 'Preuve de versement', sub: 'À ajouter', st: 'todo' as const },
    { label: 'Vérification Bonzini', sub: '', st: 'pending' as const },
    { label: 'Solde crédité', sub: '', st: 'pending' as const },
  ];
  return (
    <DetailFrame ref_="BZ-DP-2418">
      {/* Action rouge + countdown */}
      <div className="rounded-[22px] bg-[#FBE7E7] p-4 dark:bg-[#3A2526]">
        <div className="flex items-center justify-between">
          <p className="px-1 text-[13px] font-semibold" style={{ color: RED }}>Ajoutez votre preuve de versement</p>
          <span className="flex items-center gap-1 rounded-full bg-white/70 px-2 py-1 text-[11px] font-bold tabular-nums dark:bg-black/30" style={{ color: RED }}><Clock className="h-3 w-3" /> 23 h 12</span>
        </div>
        <button className={cn('mt-3 flex w-full items-center justify-center gap-2 py-2.5 text-[13px] font-bold', PRIMARY_PILL)}>Ajouter la preuve <ArrowRight className="h-4 w-4" /></button>
      </div>

      {/* Montant héros */}
      <div className={cn('rounded-[26px] p-6', SURFACE.card, SURFACE.shadow)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><BankLogo k="ecobank" size={30} radius={9} /><span className={cn('text-[13px] font-bold', TEXT.strong)}>Virement · Ecobank</span></div>
          <Pill label="Preuve en attente" color={RED} />
        </div>
        <div className={cn('mt-5 text-[13px] font-semibold', TEXT.muted)}>Montant à verser</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className={cn('text-[52px] font-black leading-none tracking-tight tabular-nums', TEXT.strong)}>500 000</span>
          <span className="text-[18px] font-extrabold" style={{ color: AMBER }}>XAF</span>
        </div>
      </div>

      {/* Coordonnées Bonzini */}
      <section>
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className={cn('text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>Compte Bonzini · où verser</h2>
          <span className="text-[12px] font-bold text-[#5B4CC4] dark:text-[#B5AAF0]">Tout copier</span>
        </div>
        <div className={cn('rounded-[22px] p-5', SURFACE.card, SURFACE.shadow)}>
          <CoordRow label="Banque" value="Ecobank Cameroun SA" />
          <CoordRow label="Titulaire" value="NORTON GAUSS BONZINI SARL" />
          <CoordRow label="Numéro de compte" value="30245039710" mono />
          <CoordRow label="Référence à indiquer" value="BZ-DP-2418" mono last />
        </div>
      </section>

      {/* Preuve — upload */}
      <section>
        <Caption>Preuve de versement</Caption>
        <label className={cn('flex items-center gap-3 rounded-[22px] border-2 border-dashed border-[#C9C2F0] p-4 dark:border-[#4A4660]', SURFACE.card)}>
          <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl', SURFACE.holder)}><ImagePlus className="h-6 w-6" /></div>
          <div className="min-w-0 flex-1">
            <p className={cn('text-[14px] font-bold', TEXT.strong)}>Ajouter une photo ou capture</p>
            <p className={cn('text-[12px]', TEXT.muted)}>Reçu, capture du virement… (JPG, PNG, PDF)</p>
          </div>
        </label>
      </section>

      {/* Suivi */}
      <section>
        <Caption>Suivi du dépôt</Caption>
        <div className={cn('rounded-[22px] p-5', SURFACE.card, SURFACE.shadow)}>
          {TL.map((s, i) => {
            const last = i === TL.length - 1;
            const color = s.st === 'done' ? GREEN : s.st === 'todo' ? RED : undefined;
            return (
              <div key={s.label} className="flex gap-3">
                <div className="flex flex-col items-center">
                  {s.st === 'pending'
                    ? <div className="h-5 w-5 shrink-0 rounded-full border-2 border-black/[0.10] dark:border-white/[0.12]" />
                    : <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ background: color }}>{s.st === 'done' ? <Check className="h-3 w-3 text-white" strokeWidth={3} /> : <AlertCircle className="h-3 w-3 text-white" strokeWidth={3} />}</div>}
                  {!last && <div className="my-1 w-0.5 flex-1" style={{ minHeight: 16, background: s.st === 'done' ? GREEN : 'rgba(0,0,0,0.08)' }} />}
                </div>
                <div className={cn('min-w-0 flex-1', last ? 'pb-0' : 'pb-3')}>
                  <div className={cn('text-[14px] font-bold', s.st === 'pending' ? TEXT.muted : TEXT.strong)}>{s.label}</div>
                  {s.sub && <div className={cn('mt-0.5 text-[11px]', s.st === 'todo' ? 'font-semibold' : TEXT.muted)} style={s.st === 'todo' ? { color: RED } : undefined}>{s.sub}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <button className={cn('w-full py-3 text-center text-[13px] font-semibold', TEXT.muted)}>Annuler ce dépôt</button>
    </DetailFrame>
  );
}

export function DepDetailValidated() {
  const TL = ['Dépôt déclaré', 'Preuve envoyée', 'Vérifiée par Bonzini', 'Solde crédité'];
  return (
    <DetailFrame ref_="BZ-DP-2405">
      {/* Montant héros — crédité */}
      <div className={cn('rounded-[26px] p-6', SURFACE.card, SURFACE.shadow)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><FamLogo k="agency" size={30} radius={9} /><span className={cn('text-[13px] font-bold', TEXT.strong)}>Cash agence Bonzini</span></div>
          <Pill label="Crédité" color={GREEN} />
        </div>
        <div className={cn('mt-5 text-[13px] font-semibold', TEXT.muted)}>Montant crédité sur votre solde</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-[34px] font-black" style={{ color: GREEN }}>+</span>
          <span className={cn('text-[52px] font-black leading-none tracking-tight tabular-nums', TEXT.strong)}>1 000 000</span>
          <span className="text-[18px] font-extrabold" style={{ color: AMBER }}>XAF</span>
        </div>
        <div className={cn('mt-2.5 text-[15px] font-bold tabular-nums', TEXT.muted)}>Crédité le 11 juin 2026</div>
      </div>

      {/* Suivi tout vert */}
      <section>
        <Caption>Suivi du dépôt</Caption>
        <div className={cn('rounded-[22px] p-5', SURFACE.card, SURFACE.shadow)}>
          {TL.map((label, i) => {
            const last = i === TL.length - 1;
            return (
              <div key={label} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ background: GREEN }}><Check className="h-3 w-3 text-white" strokeWidth={3} /></div>
                  {!last && <div className="my-1 w-0.5 flex-1" style={{ minHeight: 16, background: GREEN }} />}
                </div>
                <div className={cn('min-w-0 flex-1', last ? 'pb-0' : 'pb-3')}>
                  <div className={cn('text-[14px] font-bold', TEXT.strong)}>{label}</div>
                  <div className={cn('mt-0.5 text-[11px]', TEXT.muted)}>11 juin 2026</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Détails */}
      <section>
        <Caption>Détails</Caption>
        <div className={cn('rounded-[22px] p-5', SURFACE.card, SURFACE.shadow)}>
          {[['Référence', 'BZ-DP-2405'], ['Méthode', 'Cash agence Bonzini'], ['Agence', 'Douala – Bonapriso'], ['Créé le', '11 juin 2026, 10:02'], ['Crédité le', '11 juin 2026, 14:20']].map(([l, v], i, a) => (
            <div key={l} className={cn('flex items-center justify-between gap-3 py-2', i < a.length - 1 && 'border-b border-black/[0.05] dark:border-white/[0.07]')}>
              <span className={cn('text-[13px]', TEXT.muted)}>{l}</span>
              <span className={cn('truncate text-[13px] font-bold', l === 'Référence' && 'font-mono', TEXT.strong)}>{v}</span>
            </div>
          ))}
        </div>
      </section>
    </DetailFrame>
  );
}
