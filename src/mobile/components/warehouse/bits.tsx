// ============================================================
// ENTREPÔT — les petites pièces que plusieurs écrans partagent : le fil du
// parcours (« Étape 2 sur 3 »), la marque du transport (avion rouge, bateau
// bleu), la ligne d'un colis, la tête d'un client, et « Comment ça marche ».
// Français seulement : l'entrepôt est à Douala.
// ============================================================
import type { ReactNode } from 'react';
import { AlertTriangle, Check, ChevronRight, PackageX, Plane, Ship } from 'lucide-react';
import { cn } from '@/lib/utils';
import { clientFullName, formatDims, formatKg, initials, type ReceptionClient } from '@/lib/reception';
import { transportLabel, type WarehouseParcel } from '@/lib/warehouse';
import { SURFACE, TEXT, TYPE, BottomSheet, Holder, SoftPill } from '@/mobile/designKit';

/* ── Le fil du parcours : une barre, « Étape 2 sur 3 », une phrase pour
 * titre, une ligne d'aide. L'agent sait toujours où il en est. */
export function WhStep({ step, total, title, help, className }: { step: number; total: number; title: ReactNode; help?: ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={cn('h-1.5 flex-1 rounded-full', i < step ? 'bg-[#2C2C2C] dark:bg-[#E3E3E3]' : 'bg-[#E3E3E3] dark:bg-[#444444]')} />
        ))}
      </div>
      <p className={cn('tabular-nums', TYPE.smallStrong, TEXT.muted)}>Étape {step} sur {total}</p>
      <h1 className={cn(TYPE.heading, TEXT.strong)}>{title}</h1>
      {help && <p className={cn(TYPE.body, TEXT.muted)}>{help}</p>}
    </div>
  );
}

/** Une question sans fil : le titre en grand, une ligne d'aide. */
export function WhQuestion({ title, help, className }: { title: ReactNode; help?: ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      <h1 className={cn(TYPE.heading, TEXT.strong)}>{title}</h1>
      {help && <p className={cn(TYPE.body, TEXT.muted)}>{help}</p>}
    </div>
  );
}

/** Avion (rouge) ou bateau (bleu) : la même marque que sur l'étiquette. */
export function TransportMark({ kind, size = 44, className }: { kind: 'air' | 'sea'; size?: number; className?: string }) {
  const Icon = kind === 'air' ? Plane : Ship;
  return (
    <span aria-hidden="true" className={cn('inline-flex shrink-0 items-center justify-center rounded-lg text-white', kind === 'air' ? 'bg-[#C8102E]' : 'bg-[#0B5FA5]', className)} style={{ width: size, height: size }}>
      <Icon style={{ width: Math.round(size * 0.5), height: Math.round(size * 0.5) }} />
    </span>
  );
}

/** La case d'un colis pointé : verte (vu), ambre (abîmé), rouge (manquant), vide (à pointer). */
export function CheckMark({ parcel, size = 'md' }: { parcel: Pick<WarehouseParcel, 'checked_in_at' | 'delivered_at' | 'condition'>; size?: 'md' | 'lg' }) {
  const seen = !!parcel.checked_in_at || !!parcel.delivered_at;
  const box = size === 'lg' ? 'h-12 w-12 rounded-xl' : 'h-9 w-9 rounded-lg';
  const icon = size === 'lg' ? 'h-7 w-7' : 'h-5 w-5';
  return (
    <span className={cn('flex shrink-0 items-center justify-center border-2', box,
      parcel.condition === 'missing' ? 'border-[#EC221F] text-[#EC221F]'
      : parcel.condition === 'damaged' ? 'border-[#E8B931] bg-[#E8B931] text-[#1E1E1E]'
      : seen ? 'border-[#14AE5C] bg-[#14AE5C] text-white'
      : 'border-[#949494]')}>
      {parcel.condition === 'missing' ? <PackageX className={icon} /> : parcel.condition === 'damaged' ? <AlertTriangle className={icon} /> : seen ? <Check className={icon} strokeWidth={3} /> : null}
    </span>
  );
}

/** Une case à cocher carrée, noire quand elle est cochée. */
export function TickBox({ on, size = 'md' }: { on: boolean; size?: 'md' | 'lg' }) {
  return (
    <span className={cn('flex shrink-0 items-center justify-center border-2', size === 'lg' ? 'h-12 w-12 rounded-xl' : 'h-9 w-9 rounded-lg',
      on ? 'border-[#2C2C2C] bg-[#2C2C2C] text-white dark:border-[#E3E3E3] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]' : 'border-[#949494]')}>
      {on && <Check className={size === 'lg' ? 'h-7 w-7' : 'h-5 w-5'} strokeWidth={3} />}
    </span>
  );
}

/** Ce qu'on lit d'un colis, en trois lignes : le numéro, le contenu ; le poids, les dimensions, où il est. Un badge dessous si on veut. */
export function ParcelText({ parcel, withTransport = false, badge, className }: { parcel: WarehouseParcel; withTransport?: boolean; badge?: ReactNode; className?: string }) {
  const bits = [formatKg(parcel.weight_kg), formatDims(parcel)];
  if (withTransport) bits.push(transportLabel(parcel));
  if (parcel.warehouse_location) bits.push(`place ${parcel.warehouse_location}`);
  return (
    <span className={cn('min-w-0 flex-1', className)}>
      <span className={cn('block tabular-nums', TYPE.bodyStrong, TEXT.strong)}>{parcel.parcel_no}</span>
      <span className={cn('block break-words', TYPE.body, TEXT.body)}>{parcel.description || parcel.kind}</span>
      <span className={cn('mt-0.5 block break-words tabular-nums', TYPE.small, TEXT.muted)}>{bits.join(' · ')}</span>
      {parcel.condition_note && <span className={cn('block break-words', TYPE.small, 'text-[#975102] dark:text-[#E8B931]')}>{parcel.condition_note}</span>}
      {badge && <span className="mt-1.5 block">{badge}</span>}
    </span>
  );
}

/** Une ligne de colis qu'on touche : la case (son état), le texte, un chevron vers sa fiche. Un badge sous le texte quand il dit quelque chose de plus. */
export function ParcelLine({ parcel, onTap, onOpen, lead, badge, disabled, withTransport }: {
  parcel: WarehouseParcel; onTap?: () => void; onOpen?: () => void; lead?: ReactNode; badge?: ReactNode; disabled?: boolean; withTransport?: boolean;
}) {
  return (
    <div className={cn('flex w-full items-center gap-3 border-b py-3 last:border-b-0', SURFACE.divider, disabled && 'opacity-60')}>
      <button type="button" onClick={onTap} disabled={disabled || !onTap} className="flex min-w-0 flex-1 items-center gap-3 text-left active:opacity-70">
        {lead ?? <CheckMark parcel={parcel} />}
        <ParcelText parcel={parcel} withTransport={withTransport} badge={badge} />
      </button>
      {onOpen && (
        <button type="button" onClick={onOpen} aria-label={`Ouvrir ${parcel.parcel_no}`} className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', SURFACE.holder)}>
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

/** Le client, en une ligne : ses initiales, son nom, son code, son téléphone. */
export function ClientHead({ client, sub, size = 'lg' }: { client: ReceptionClient | null; sub?: ReactNode; size?: 'md' | 'lg' }) {
  const name = client ? clientFullName(client) : 'Client à attribuer';
  return (
    <div className="flex items-center gap-3">
      <Holder size={size} tone={client ? 'neutral' : 'pending'}>{client ? initials(name) : '?'}</Holder>
      <span className="min-w-0 flex-1">
        <span className={cn('block break-words', TYPE.bodyStrong, TEXT.strong)}>{name}</span>
        <span className={cn('block break-words tabular-nums', TYPE.small, TEXT.muted)}>{sub ?? [client?.customer_code, client?.account_name ? `compte ${client.account_name}` : null, client?.phone].filter(Boolean).join(' · ')}</span>
      </span>
    </div>
  );
}

/** Un grand bouton-réponse : une icône, une phrase, une ligne d'aide. Une question, deux ou trois réponses. */
export function AnswerButton({ icon: Icon, title, help, onClick, tone = 'neutral', loading }: { icon: React.ElementType; title: string; help?: string; onClick: () => void; tone?: 'primary' | 'neutral' | 'warn' | 'danger'; loading?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={loading} className={cn('flex min-h-[72px] w-full items-center gap-4 rounded-lg px-4 py-3 text-left transition-colors disabled:opacity-60',
      tone === 'primary' ? 'bg-[#2C2C2C] text-[#F5F5F5] active:bg-[#1E1E1E] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]' : cn(SURFACE.card, SURFACE.shadow, 'active:bg-[#F5F5F5] dark:active:bg-[#383838]'))}>
      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
        tone === 'primary' ? 'bg-white/15' : tone === 'warn' ? 'bg-[#FFF1C2] text-[#682D03] dark:bg-[#522504] dark:text-[#FFF1C2]' : tone === 'danger' ? 'bg-[#FDD3D0] text-[#900B09] dark:bg-[#900B09] dark:text-[#FDD3D0]' : SURFACE.holder)}>
        <Icon className="h-6 w-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-[17px] font-semibold leading-snug')}>{title}</span>
        {help && <span className={cn('mt-0.5 block text-[14px] leading-snug', tone === 'primary' ? 'opacity-80' : TEXT.muted)}>{help}</span>}
      </span>
      <ChevronRight className={cn('h-5 w-5 shrink-0', tone === 'primary' ? 'opacity-70' : TEXT.muted)} />
    </button>
  );
}

/** La pédagogie tient en quatre lignes, à portée de main, jamais imposée. */
const HOW = [
  'Un avion ou une boîte arrive : touchez chaque colis présent pour le pointer. Abîmé ou manquant : ouvrez sa fiche et dites-le.',
  'Le client se présente : scannez son code, ou choisissez-le dans la liste de ceux qui attendent.',
  'S\'il reste à payer, encaissez sur place : le reçu part aussitôt. Rien ne sort sans être payé.',
  'Dites qui emporte les colis, faites signer : le bon de retrait est la preuve de la remise.',
];
export function HowItWorks({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Comment ça marche">
      <ol className="space-y-4">
        {HOW.map((line, i) => (
          <li key={i} className="flex items-start gap-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2C2C2C] text-[16px] font-bold text-[#F5F5F5] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]">{i + 1}</span>
            <span className={cn('pt-1.5', TYPE.body, TEXT.strong)}>{line}</span>
          </li>
        ))}
      </ol>
      <SoftPill onClick={onClose} className="mt-6 h-14 w-full text-[17px]">Compris</SoftPill>
    </BottomSheet>
  );
}

/** La barre fixée en bas de l'écran : une phrase, un bouton. */
export function BottomBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg space-y-2 border-t px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 md:max-w-2xl', SURFACE.canvas, SURFACE.divider, className)}>
      {children}
    </div>
  );
}
