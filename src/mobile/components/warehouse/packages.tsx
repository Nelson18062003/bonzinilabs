// ============================================================
// ENTREPÔT — les paquets avion de 32 kg, à Douala. L'équipe apporte les
// PAQUETS (PQ-…) : le chef vérifie qu'ils sont TOUS là (le grand compteur,
// et en rouge ceux qui manquent), puis il ouvre chacun et pointe ses colis.
// Ici les pièces de l'écran de pointage : le compteur, l'alerte des paquets
// absents, la ligne d'un paquet, la pastille « PQ-… » d'un colis et le
// message d'un scan. Français seulement : l'entrepôt est à Douala.
// ============================================================
import { Check, ChevronRight, Package, PackageCheck, PackageOpen } from 'lucide-react';
import type { AirPackage } from '@/lib/airPackage';
import { fmtKg1 } from '@/lib/airPackage';
import { PACKAGE_STAGE_META, nParcels, packageStage, type PackageStage, type PackagesProgress } from '@/lib/warehouse';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TONE_PILL, TYPE, Button, StatusPill, type Tone } from '@/mobile/designKit';

type Progress = PackagesProgress;
/** Ce qu'on sait du pointage des colis d'un paquet (checkinSummary). */
interface ParcelsCount { total: number; seen: number; missing: number; pending: number }
type Outcome = 'ok' | 'again' | 'unknown' | 'refused';

/** La pastille du paquet d'un colis : « PQ-000124 ». */
export function PackageChip({ no, className }: { no: string; className?: string }) {
  return (
    <span className={cn('inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[14px] font-semibold tabular-nums', SURFACE.inset, SURFACE.divider, TEXT.body, className)}>
      <Package className="h-4 w-4 shrink-0" aria-hidden="true" />
      {no}
    </span>
  );
}

/** Le carré d'un paquet : pointillé ambre (attendu), encre (reçu), vert (ouvert). */
export function PackageMark({ stage, size = 44 }: { stage: PackageStage; size?: number }) {
  const Icon = stage === 'opened' ? PackageOpen : stage === 'received' ? PackageCheck : Package;
  return (
    <span aria-hidden="true" style={{ width: size, height: size }}
      className={cn('inline-flex shrink-0 items-center justify-center rounded-lg border-2',
        stage === 'opened' ? 'border-[#14AE5C] bg-[#14AE5C] text-white'
        : stage === 'received' ? 'border-[#2C2C2C] bg-[#2C2C2C] text-[#F5F5F5] dark:border-[#E3E3E3] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]'
        : 'border-dashed border-[#E8B931] text-[#975102] dark:text-[#E8B931]')}>
      <Icon style={{ width: Math.round(size * 0.5), height: Math.round(size * 0.5) }} />
    </span>
  );
}

/** « Paquets reçus 3 / 5 » en très grand : le chef voit d'un coup d'œil si tout est arrivé. */
export function PackagesCounter({ progress }: { progress: Progress }) {
  const left = progress.missing.length;
  const pct = progress.total ? Math.round((progress.received / progress.total) * 100) : 0;
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <span>
          <span className={cn('block', TYPE.small, TEXT.muted)}>Paquets reçus</span>
          <span className={cn('block text-[40px] font-semibold leading-none tabular-nums', TEXT.strong)} data-testid="packages-counter">
            {progress.received} <span className={cn('text-[22px] font-normal', TEXT.muted)}>/ {progress.total}</span>
          </span>
        </span>
        {left > 0
          ? <span className={cn('text-right font-semibold tabular-nums', TYPE.body, 'text-[#C00F0C] dark:text-[#FCB3AD]')}>{left} pas encore là</span>
          : <span className={cn('inline-flex items-center gap-1.5 text-right font-semibold', TYPE.body, 'text-[#009951] dark:text-[#14AE5C]')}><Check className="h-5 w-5" strokeWidth={3} /> Tous là</span>}
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-[#E6E6E6] dark:bg-[#444444]">
        <div className={cn('h-full rounded-full transition-all', left > 0 ? 'bg-[#E8B931]' : 'bg-[#14AE5C]')} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Tous là : une phrase verte. Sinon, en rouge, les numéros des paquets qu'on n'a pas vus — on touche pour voir ce qu'ils contiennent. */
export function PackagesVerdict({ progress, onShow }: { progress: Progress; onShow: (no: string) => void }) {
  if (progress.total === 0) return null;
  if (progress.missing.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-lg border-2 border-[#14AE5C] bg-[#EBFFEE] p-4 dark:bg-[#02542D]/40" role="status">
        <PackageCheck className="mt-0.5 h-6 w-6 shrink-0 text-[#009951] dark:text-[#14AE5C]" />
        <span>
          <span className={cn('block', TYPE.bodyStrong, TEXT.strong)}>{progress.total > 1 ? `Les ${progress.total} paquets sont là` : 'Le paquet est là'}</span>
          <span className={cn('block', TYPE.small, TEXT.muted)}>{progress.opened === progress.total ? 'Tous sont ouverts : finissez de pointer leurs colis.' : 'Ouvrez-les un par un et pointez leurs colis.'}</span>
        </span>
      </div>
    );
  }
  const n = progress.missing.length;
  return (
    <div className="space-y-3 rounded-lg border-2 border-[#EC221F] bg-[#FEE9E7] p-4 dark:bg-[#900B09]/30" role="alert">
      <p className={cn(TYPE.bodyStrong, 'text-[#900B09] dark:text-[#FDD3D0]')}>{n > 1 ? `${n} paquets pas encore reçus` : '1 paquet pas encore reçu'}</p>
      <div className="flex flex-wrap gap-2">
        {progress.missing.map((k) => (
          <button key={k.id} type="button" onClick={() => onShow(k.package_no)}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border-2 border-[#EC221F] bg-white px-3 text-[16px] font-semibold tabular-nums text-[#900B09] active:bg-[#FDD3D0] dark:bg-[#2C2C2C] dark:text-[#FDD3D0]">
            <Package className="h-4 w-4" aria-hidden="true" />{k.package_no}
          </button>
        ))}
      </div>
      <p className={cn(TYPE.small, 'text-[#900B09] dark:text-[#FDD3D0]')}>Scannez-les dès qu'ils arrivent. Refusé au départ ou perdu ? Touchez-le : ses colis se déclarent manquants.</p>
    </div>
  );
}

/** La ligne d'un paquet : son numéro, son état, ses colis pointés ; « Ouvrir » quand il est reçu, sinon la flèche vers son contenu. */
export function PackageRow({ pkg, count, onShow, onOpen, opening }: { pkg: AirPackage; count: ParcelsCount; onShow: () => void; onOpen: () => void; opening?: boolean }) {
  const stage = packageStage(pkg);
  const meta = PACKAGE_STAGE_META[stage];
  const done = count.total > 0 && count.pending === 0;
  const facts = [nParcels(count.total || pkg.parcel_count), pkg.client_count > 1 ? `${pkg.client_count} clients` : null, Number(pkg.net_weight_kg) > 0 ? fmtKg1(pkg.net_weight_kg) : null].filter(Boolean).join(' · ');
  return (
    <div className={cn('flex w-full items-center gap-3 border-b py-3 last:border-b-0', SURFACE.divider)}>
      <button type="button" onClick={onShow} className="flex min-w-0 flex-1 items-center gap-3 text-left active:opacity-70">
        <PackageMark stage={stage} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn('tabular-nums', TYPE.bodyStrong, TEXT.strong)}>{pkg.package_no}</span>
            <StatusPill tone={meta.tone} label={meta.label} className="h-7 text-[14px]" />
          </span>
          <span className={cn('mt-0.5 block tabular-nums', TYPE.small, TEXT.muted)}>{facts}</span>
          {stage === 'opened' && (
            <span className={cn('block tabular-nums', TYPE.smallStrong, done ? 'text-[#009951] dark:text-[#14AE5C]' : TEXT.body)}>
              {done ? 'Tous ses colis sont pointés' : `${count.seen} / ${count.total} pointés`}
              {count.missing > 0 && <span className="text-[#C00F0C] dark:text-[#FCB3AD]"> · {count.missing} manquant{count.missing > 1 ? 's' : ''}</span>}
            </span>
          )}
        </span>
      </button>
      {stage === 'received'
        ? <Button onClick={onOpen} loading={opening} className="h-11 shrink-0 px-4"><PackageOpen /> Ouvrir</Button>
        : (
          <button type="button" onClick={onShow} aria-label={`Voir ${pkg.package_no}`} className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', SURFACE.holder)}>
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
    </div>
  );
}

const OUTCOME_TONE: Record<Outcome, Tone> = { ok: 'success', again: 'pending', unknown: 'danger', refused: 'danger' };

/** Le résultat d'un scan venu d'ailleurs (le lien du scanner de l'app), dans le style de la boîte de scan. */
export function ScanNotice({ result, className }: { result: { outcome: Outcome; text: string }; className?: string }) {
  return <p className={cn('rounded-lg px-4 py-2.5', TYPE.bodyStrong, TONE_PILL[OUTCOME_TONE[result.outcome]], className)} role="status" aria-live="polite">{result.text}</p>;
}
