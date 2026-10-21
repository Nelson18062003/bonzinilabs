// ============================================================
// Le taux du jour n'est pas (encore) là : on le DIT, et on bloque.
//
// Les écrans de création de paiement retombaient en silence sur une
// constante (« 1M XAF = ¥11 530 ») présentée comme « Taux du jour » : un
// paiement pouvait partir à un taux que personne n'avait publié. Désormais
// l'étape du montant et la confirmation attendent le vrai taux ; cette
// bannière explique pourquoi et propose de réessayer.
// ============================================================
import { AlertTriangle, Loader2, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export function RateUnavailableNotice({
  loading,
  onRetry,
  retrying = false,
  className,
}: {
  /** Le taux est en cours de lecture (premier chargement). */
  loading: boolean;
  onRetry: () => void;
  retrying?: boolean;
  className?: string;
}) {
  if (loading) {
    return (
      <div role="status" className={cn('flex items-center gap-2.5 rounded-lg bg-black/[0.04] p-3 text-[16px] dark:bg-white/[0.06]', className)}>
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        <span>Lecture du taux du jour…</span>
      </div>
    );
  }
  return (
    <div role="alert" className={cn('flex items-start gap-2.5 rounded-lg bg-[#FDD3D0] p-3 dark:bg-[#900B09]', className)}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#900B09] dark:text-[#FDD3D0]" />
      <div className="min-w-0 flex-1">
        <div className="text-[16px] font-bold text-[#900B09] dark:text-[#FDD3D0]">Taux du jour indisponible</div>
        <div className="text-[14px] text-[#900B09] dark:text-[#FDD3D0]">
          Aucun paiement ne part sans le taux publié. Réessayez, ou vérifiez qu'un taux est actif.
        </div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-white/70 px-3 text-[14px] font-semibold text-[#900B09] disabled:opacity-50 dark:bg-black/30 dark:text-[#FDD3D0]"
      >
        <RotateCw className={cn('h-4 w-4', retrying && 'animate-spin')} />
        Réessayer
      </button>
    </div>
  );
}
