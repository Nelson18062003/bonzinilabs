/**
 * DEV-ONLY maquette — app ADMIN (`/m`) « Connexion sans mot de passe ».
 *
 * Construit avec les composants RÉELS de l'écran de connexion existant
 * (`MobileLoginScreen`) : LoginBackground + BonziniLogo + PremiumInput +
 * ProgressDots + le pill charbon du designKit. Aucun style inventé — toute
 * nouveauté (cases de code, clés de secours) est dérivée de SURFACE/TEXT.
 *
 * Parcours couverts :
 *   1. Mise en place (une seule fois)  : email → code email → Authenticator → clés → Face ID
 *   2. Quotidien                       : Face ID, ou email → code Authenticator
 *   3. Récupération                    : téléphone perdu → clé de secours
 *
 * Harness : /screenshot.html?screen=aauth-email&theme=light
 */
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TONE_HOLDER } from '@/mobile/designKit/tokens';
import { BonziniLogo } from '@/components/BonziniLogo';
import { LoginBackground } from '@/components/auth/LoginBackground';
import { PremiumInput } from '@/components/auth/PremiumInput';
import { ProgressDots } from '@/components/auth/ProgressDots';
import {
  Mail,
  ShieldCheck,
  Smartphone,
  Clock,
  KeyRound,
  ScanFace,
  Check,
  Download,
  RefreshCw,
  Copy,
} from 'lucide-react';

/* ─────────────────────────── primitives partagées ───────────────────────── */

/** Pill charbon — classe copiée telle quelle de MobileLoginScreen (ligne 217). */
const PILL =
  'w-full h-12 rounded-full bg-[#1C1B22] text-white dark:bg-[#F2F1F7] dark:text-[#1B1A24] text-[15px] font-bold flex items-center justify-center gap-2 transition active:scale-[0.99]';

/** Action secondaire — carte blanche + ombre. `SOFT_PILL` (#EDEAFA) disparaît
 *  sur le canvas (#ECEAF7) : sur cet écran il ne se lit pas comme un bouton. */
const PILL_SOFT = cn(
  'w-full h-12 rounded-full text-[15px] font-bold flex items-center justify-center gap-2',
  SURFACE.card,
  SURFACE.shadow,
  TEXT.strong,
);

const GHOST = 'w-full py-2.5 text-[14px] font-medium text-muted-foreground';

/** Cadre commun : identique à MobileLoginScreen (logo centré + footer). */
function Shell({ children }: { children: ReactNode }) {
  return (
    <LoginBackground>
      <div className="flex-1 flex flex-col justify-center px-6 py-12">
        <div className="flex justify-center mb-6">
          <BonziniLogo size="xl" showText={false} />
        </div>
        <div className="max-w-sm mx-auto w-full">{children}</div>
      </div>
      <div className="p-6 text-center text-sm text-muted-foreground">
        <p>Bonzini Labs &copy; 2026</p>
      </div>
    </LoginBackground>
  );
}

function Title({ title, sub }: { title: string; sub?: ReactNode }) {
  return (
    <div className="text-center mb-8">
      <h1 className="text-2xl font-bold mb-1">{title}</h1>
      {sub && <p className="text-muted-foreground text-sm leading-relaxed">{sub}</p>}
    </div>
  );
}

/** Gros rond d'illustration — reprend TONE_HOLDER du designKit. */
function Holder({
  icon: Icon,
  tone = 'neutral',
}: {
  icon: typeof Mail;
  tone?: 'neutral' | 'info' | 'success' | 'pending';
}) {
  return (
    <div className="flex justify-center mb-6">
      <div className={cn('h-16 w-16 rounded-full flex items-center justify-center', TONE_HOLDER[tone])}>
        <Icon className="h-7 w-7" />
      </div>
    </div>
  );
}

/** Cases de saisie du code — carte + ombre du designKit, comme les champs. */
function CodeBoxes({ value, length = 6 }: { value: string; length?: number }) {
  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length }, (_, i) => (
        <div
          key={i}
          className={cn(
            'flex-1 h-14 rounded-2xl flex items-center justify-center text-[22px] font-bold tabular-nums',
            SURFACE.card,
            SURFACE.shadow,
            TEXT.strong,
            i === value.length && 'ring-2 ring-[#8B5CF6]',
          )}
        >
          {value[i] ?? ''}
        </div>
      ))}
    </div>
  );
}

/** Liste numérotée dans une carte — même carte que les champs. */
function Steps({ items }: { items: string[] }) {
  return (
    <div className={cn('rounded-2xl p-4 space-y-3', SURFACE.card, SURFACE.shadow)}>
      {items.map((label, i) => (
        <div key={label} className="flex gap-3 items-start">
          <span className="h-5 w-5 shrink-0 rounded-full bg-[#EAE7FA] text-[#5B4CC4] dark:bg-[#272252] dark:text-[#B5AAF0] text-[11px] font-bold flex items-center justify-center mt-px">
            {i + 1}
          </span>
          <span className={cn('text-[13px] leading-snug', TEXT.strong)}>{label}</span>
        </div>
      ))}
    </div>
  );
}

/** Liste cochée (récapitulatifs). */
function Checks({ items }: { items: string[] }) {
  return (
    <div className={cn('rounded-2xl p-4 space-y-3', SURFACE.card, SURFACE.shadow)}>
      {items.map((label) => (
        <div key={label} className="flex gap-3 items-start">
          <span className="h-5 w-5 shrink-0 rounded-full bg-[#DEEFE5] text-[#2E7D52] dark:bg-[#1E3A2C] dark:text-[#7FCBA0] flex items-center justify-center mt-px">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
          <span className={cn('text-[13px] leading-snug', TEXT.strong)}>{label}</span>
        </div>
      ))}
    </div>
  );
}

/** Ligne d'option cliquable — reprend la carte des champs. */
function OptionRow({
  icon: Icon,
  title,
  sub,
  tone = 'neutral',
}: {
  icon: typeof Mail;
  title: string;
  sub: string;
  tone?: 'neutral' | 'info';
}) {
  return (
    <div className={cn('rounded-2xl p-3.5 flex items-center gap-3', SURFACE.card, SURFACE.shadow)}>
      <span
        className={cn(
          'h-10 w-10 shrink-0 rounded-full flex items-center justify-center',
          tone === 'info' ? TONE_HOLDER.info : SURFACE.holder,
        )}
      >
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0">
        <span className={cn('block text-[14px] font-bold leading-tight', TEXT.strong)}>{title}</span>
        <span className={cn('block text-[12px] leading-snug mt-0.5', TEXT.muted)}>{sub}</span>
      </span>
    </div>
  );
}

const noop = () => undefined;

/* ═══════════════ Parcours 1 — mise en place (une seule fois) ═════════════ */

/** 1/9 — l'adresse email (l'écran actuel, plus le raccourci Face ID). */
export function AAuthEmail() {
  return (
    <Shell>
      <Title title="Administration" sub="Entrez votre adresse email pour continuer" />
      <div className="mb-6">
        <PremiumInput
          id="aauth-email"
          type="email"
          label="Adresse email"
          value="papa@bonzini.com"
          onChange={noop}
          icon={<Mail className="w-5 h-5" />}
          isValid
        />
      </div>
      <ProgressDots totalSteps={2} currentStep={0} className="mb-6" />
      <button type="button" className={PILL}>
        Continuer
      </button>
    </Shell>
  );
}

/** 2/9 — le code reçu par email (option non négociable). */
export function AAuthOtpEmail() {
  return (
    <Shell>
      <Holder icon={Mail} tone="info" />
      <Title
        title="Votre code est parti"
        sub={
          <>
            Envoyé à pap***@bonzini.com
            <br />
            Il est valable 10 minutes.
          </>
        }
      />
      <div className="mb-4">
        <CodeBoxes value="417" />
      </div>
      <p className="text-center text-[12px] text-muted-foreground mb-6">
        Vous ne le voyez pas ? Regardez dans les spams.
      </p>
      <button type="button" className={cn(PILL, 'opacity-40')}>
        Valider
      </button>
      <button type="button" className={cn(GHOST, 'mt-1 flex items-center justify-center gap-1.5')}>
        <RefreshCw className="h-3.5 w-3.5" />
        Renvoyer le code (0:42)
      </button>
    </Shell>
  );
}

/** 3/9 — pourquoi on demande un deuxième verrou. */
export function AAuthTwoFaIntro() {
  return (
    <Shell>
      <Holder icon={ShieldCheck} />
      <Title
        title="Protégeons votre compte"
        sub="Vous gérez la trésorerie et les paiements. On ajoute un deuxième verrou."
      />
      <div className="mb-4">
        <Steps
          items={[
            'Vous installez une petite application sur votre téléphone',
            'Vous scannez un carré avec l’appareil photo',
            'C’est terminé, et vous ne le referez jamais',
          ]}
        />
      </div>
      <p className="text-center text-[12px] text-muted-foreground mb-6">Environ 2 minutes.</p>
      <button type="button" className={PILL}>
        Commencer
      </button>
    </Shell>
  );
}

/** 4/9 — installer Google Authenticator (on l'emmène au magasin). */
export function AAuthTwoFaInstall() {
  return (
    <Shell>
      <Holder icon={Smartphone} />
      <Title
        title="Installez l’application"
        sub={
          <>
            Elle s’appelle Google Authenticator.
            <br />
            Elle est gratuite.
          </>
        }
      />
      <div className="space-y-2.5 mb-6">
        <OptionRow icon={Smartphone} title="App Store" sub="Pour iPhone" />
        <OptionRow icon={Smartphone} title="Play Store" sub="Pour Android" />
      </div>
      <button type="button" className={PILL}>
        Je l’ai installée
      </button>
      <button type="button" className={cn(GHOST, 'mt-1')}>
        Je l’ai déjà
      </button>
    </Shell>
  );
}

/** 5/9 — le carré à scanner (+ code manuel de repli). */
export function AAuthTwoFaQr() {
  return (
    <Shell>
      <Title title="Scannez ce carré" sub="Dans l’application, appuyez sur « + » puis visez ce carré." />
      <div className="flex justify-center mb-6">
        <div className={cn('rounded-2xl bg-white p-3', SURFACE.shadow)}>
          <QrPlaceholder />
        </div>
      </div>
      <div className={cn('rounded-2xl p-3.5 mb-6 text-center', SURFACE.card, SURFACE.shadow)}>
        <p className={cn('text-[12px] mb-1.5', TEXT.muted)}>Ça ne marche pas ? Entrez ce code à la main :</p>
        <p className={cn('font-mono text-[14px] font-bold tracking-widest', TEXT.strong)}>K5J2 9QX7 MB4T</p>
        <button type="button" className={cn('mt-2 inline-flex items-center gap-1.5 text-[12px] font-bold text-[#5B4CC4] dark:text-[#B5AAF0]')}>
          <Copy className="h-3.5 w-3.5" />
          Copier
        </button>
      </div>
      <button type="button" className={PILL}>
        C’est scanné
      </button>
    </Shell>
  );
}

/** 6/9 — vérifier que l'application est bien liée. */
export function AAuthTwoFaVerify() {
  return (
    <Shell>
      <Holder icon={Clock} />
      <Title title="Le code de l’application" sub="Ouvrez l’application, lisez les 6 chiffres à côté de « Bonzini »." />
      <div className="mb-4">
        <CodeBoxes value="82041" />
      </div>
      <p className="text-center text-[12px] text-muted-foreground mb-6">
        Les chiffres changent toutes les 30 secondes, c’est normal.
      </p>
      <button type="button" className={PILL}>
        Valider
      </button>
    </Shell>
  );
}

/** 7/9 — les clés de secours (l'écran qui évite le drame). */
export function AAuthBackupCodes() {
  const codes = [
    '4K7M-92XQ',
    'P3TW-6BNZ',
    'H8LR-51VD',
    'Q2FY-77JS',
    'N6CX-30GK',
    'B9UE-48MT',
    'Z5AH-16PW',
    'R1DV-83LQ',
  ];
  return (
    <Shell>
      <Holder icon={KeyRound} tone="pending" />
      <Title title="Vos clés de secours" sub="Le jour où vous perdez votre téléphone, elles vous font rentrer." />
      <div className={cn('rounded-2xl p-4 mb-4 grid grid-cols-2 gap-y-2.5 gap-x-3', SURFACE.card, SURFACE.shadow)}>
        {codes.map((c) => (
          <span key={c} className={cn('font-mono text-[13px] text-center', TEXT.strong)}>
            {c}
          </span>
        ))}
      </div>
      <p className="text-center text-[12px] text-muted-foreground mb-6">
        Imprimez-les ou photographiez-les.
        <br />
        Chaque clé ne sert qu’une fois.
      </p>
      <button type="button" className={cn(PILL_SOFT, 'mb-2')}>
        <Download className="h-4 w-4" />
        Télécharger le PDF
      </button>
      <button type="button" className={PILL}>
        Je les ai gardées
      </button>
    </Shell>
  );
}

/** 8/9 — proposer Face ID pour la suite (jamais imposé). */
export function AAuthPasskeyOffer() {
  return (
    <Shell>
      <Holder icon={ScanFace} tone="info" />
      <Title
        title="La prochaine fois, juste votre visage ?"
        sub="Plus d’email à taper, plus de code à recopier. Vous ouvrez, vous regardez, vous êtes dedans."
      />
      <div className="mb-6">
        <Checks
          items={['Votre visage ne quitte jamais votre téléphone', 'Un voleur avec votre téléphone n’entre pas']}
        />
      </div>
      <button type="button" className={PILL}>
        <ScanFace className="h-[18px] w-[18px]" />
        Activer Face ID
      </button>
      <button type="button" className={cn(GHOST, 'mt-1')}>
        Plus tard
      </button>
    </Shell>
  );
}

/** 9/9 — récapitulatif de fin de mise en place. */
export function AAuthDone() {
  return (
    <Shell>
      <Holder icon={Check} tone="success" />
      <Title title="Tout est prêt" sub="Vous n’aurez plus jamais à refaire ça." />
      <div className="mb-6">
        <Checks
          items={['Face ID activé sur cet iPhone', 'Application Authenticator liée', '8 clés de secours gardées']}
        />
      </div>
      <button type="button" className={PILL}>
        Entrer dans Bonzini
      </button>
    </Shell>
  );
}

/* ═════════════════════ Parcours 2 — tous les jours ═══════════════════════ */

/** L'écran de 95 % des connexions : un seul geste. */
export function AAuthDaily() {
  return (
    <Shell>
      <Title title="Bonjour Papa" sub="Bonzini Administration" />
      <div className="flex justify-center mb-8">
        <div className={cn('h-24 w-24 rounded-full flex items-center justify-center', TONE_HOLDER.info)}>
          <ScanFace className="h-11 w-11" strokeWidth={1.5} />
        </div>
      </div>
      <button type="button" className={PILL}>
        <ScanFace className="h-[18px] w-[18px]" />
        Se connecter
      </button>
      <button type="button" className={cn(GHOST, 'mt-1')}>
        Utiliser mon adresse email
      </button>
    </Shell>
  );
}

/** Sur un appareil inconnu : après le code email, le code de l'application. */
export function AAuthDailyTotp() {
  return (
    <Shell>
      <Holder icon={Clock} />
      <Title title="Votre code Bonzini" sub="Ouvrez votre application Authenticator et lisez les 6 chiffres." />
      <div className="mb-6">
        <CodeBoxes value="396" />
      </div>
      <ProgressDots totalSteps={2} currentStep={1} className="mb-6" />
      <button type="button" className={cn(PILL, 'opacity-40')}>
        Valider
      </button>
      <button type="button" className={cn(GHOST, 'mt-1')}>
        Je n’ai pas accès à mon application
      </button>
    </Shell>
  );
}

/* ═══════════════════ Parcours 3 — le jour où ça coince ═══════════════════ */

/** Téléphone perdu : deux issues, jamais zéro. */
export function AAuthRecover() {
  return (
    <Shell>
      <Holder icon={KeyRound} tone="pending" />
      <Title title="Comment vous aider ?" sub="Choisissez ce qui vous ressemble aujourd’hui." />
      <div className="space-y-2.5 mb-6">
        <OptionRow
          icon={KeyRound}
          tone="info"
          title="J’ai mes clés de secours"
          sub="Les 8 codes de la mise en place"
        />
        <OptionRow icon={RefreshCw} title="J’ai tout perdu" sub="Un super admin vous rappelle" />
      </div>
      <button type="button" className={GHOST}>
        Revenir en arrière
      </button>
    </Shell>
  );
}

/** Utiliser une clé de secours — et on lui reconfigure son nouveau téléphone après. */
export function AAuthBackupUse() {
  return (
    <Shell>
      <Holder icon={KeyRound} tone="info" />
      <Title title="Une clé de secours" sub="Recopiez une clé de votre liste. Elle ne servira plus après." />
      <div className="mb-4">
        <PremiumInput
          id="aauth-backup"
          type="text"
          label="Clé de secours"
          value="4K7M-92XQ"
          onChange={noop}
          icon={<KeyRound className="w-5 h-5" />}
          isValid
        />
      </div>
      <p className="text-center text-[12px] text-muted-foreground mb-6">Il vous restera 7 clés.</p>
      <button type="button" className={PILL}>
        Valider
      </button>
    </Shell>
  );
}

/* ───────────────────────────── QR décoratif ──────────────────────────────
   Motif déterministe (aucun aléa → capture stable d'un run à l'autre).      */
function QrPlaceholder() {
  const N = 25;
  const on = (x: number, y: number) => {
    const finder = (fx: number, fy: number) =>
      x >= fx && x < fx + 7 && y >= fy && y < fy + 7 &&
      !(x > fx && x < fx + 6 && y > fy && y < fy + 6 && !(x > fx + 1 && x < fx + 5 && y > fy + 1 && y < fy + 5));
    if (finder(0, 0) || finder(N - 7, 0) || finder(0, N - 7)) return true;
    if ((x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9)) return false;
    return ((x * 7 + y * 13 + ((x * y) % 5)) % 3) === 0;
  };
  const cells: ReactNode[] = [];
  for (let y = 0; y < N; y += 1) {
    for (let x = 0; x < N; x += 1) {
      if (on(x, y)) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#1B1A24" />);
    }
  }
  return (
    <svg viewBox={`0 0 ${N} ${N}`} className="h-40 w-40" shapeRendering="crispEdges" aria-label="Code à scanner">
      <rect width={N} height={N} fill="#FFFFFF" />
      {cells}
    </svg>
  );
}
