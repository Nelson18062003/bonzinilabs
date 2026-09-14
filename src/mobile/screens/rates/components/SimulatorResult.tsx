// ============================================================
// MODULE TAUX — SimulatorResult
// Présentation migrée sur le design kit (Ofspace/Mola), calquée
// sur la maquette validée rates.tsx : carte douce, gros chiffre
// du résultat (¥ d'abord), détail du calcul en lignes sans filet.
// Le dégradé sombre inline est remplacé par les tokens.
// Logique 100% préservée : champs/props inchangés (montants déjà
// calculés en amont), libellés méthode/pays/tranche.
// ============================================================
import { cn } from '@/lib/utils';
import { PAYMENT_METHODS, COUNTRIES, TIERS } from '@/types/rates';
import type { InputCurrency } from '@/types/rates';
import { SURFACE, TEXT } from '@/mobile/designKit';
import { MethodLogo } from './MethodLogo';

interface SimulatorResultProps {
  amountXAF: number;
  amountCNY: number;
  baseRate: number;
  countryAdj: number;
  tierAdj: number;
  tierKey: string;
  finalRate: number;
  methodKey: string;
  countryKey: string;
  inputCurrency?: InputCurrency;
  inputAmount?: number;
}

export function SimulatorResult({
  amountXAF,
  amountCNY,
  baseRate,
  countryAdj,
  tierAdj,
  tierKey,
  finalRate,
  methodKey,
  countryKey,
  inputCurrency = 'xaf',
  inputAmount,
}: SimulatorResultProps) {
  const method = PAYMENT_METHODS.find((p) => p.key === methodKey);
  const country = COUNTRIES.find((c) => c.key === countryKey);
  const tier = TIERS.find((t) => t.key === tierKey);

  // Vert / rouge sémantiques (tokens) pour les ajustements.
  const adjClass = (v: number) =>
    v < 0 ? 'text-[#900B09] dark:text-[#FDD3D0]' : 'text-[#02542D] dark:text-[#CFF7D3]';

  return (
    <div className={cn('rounded-lg p-5', SURFACE.card, SURFACE.shadow)}>
      <div className={cn('mb-2 text-[16px] font-bold', TEXT.muted)}>
        Résultat de la simulation
      </div>

      {/* Badge saisie CNY — montré seulement si l'admin a saisi en CNY */}
      {inputCurrency === 'cny' && inputAmount != null && (
        <div className={cn('mb-2 flex items-center justify-between rounded-lg px-3 py-2', SURFACE.canvas)}>
          <span className={cn('text-[16px] font-semibold', TEXT.muted)}>Saisie CNY</span>
          <span className="text-[16px] font-bold text-[#975102] dark:text-[#E8B931]">
            {inputAmount.toLocaleString('fr-FR')} CNY
          </span>
        </div>
      )}

      {/* XAF envoyé */}
      <div className={cn('mb-2 flex items-center justify-between rounded-lg p-3', SURFACE.canvas)}>
        <div>
          <div className={cn('text-[16px] font-medium', TEXT.muted)}>
            {inputCurrency === 'cny' ? 'Équivalent XAF' : 'Vous envoyez'}
          </div>
          <div className={cn('text-[24px] font-bold tabular-nums', TEXT.strong)}>
            {amountXAF.toLocaleString('fr-FR')}
          </div>
        </div>
        <span className="text-[16px] font-bold text-[#975102] dark:text-[#E8B931]">XAF</span>
      </div>

      {/* Flèche */}
      <div className={cn('my-1 text-center text-lg', TEXT.muted)}>↓</div>

      {/* CNY reçu — focal, gros chiffre */}
      <div className="mb-4 rounded-lg bg-[#F5F5F5] p-4 dark:bg-[#383838]">
        <div className={cn('text-[16px] font-medium', TEXT.muted)}>
          Le client reçoit
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-[24px] font-bold text-[#B3B3B3] dark:text-[#B3B3B3]">¥</span>
          <span className={cn('text-[32px] font-bold leading-none tabular-nums', TEXT.strong)}>
            {amountCNY.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Détail du calcul */}
      <div className={cn('space-y-2 rounded-lg p-3.5', SURFACE.canvas)}>
        <div className={cn('mb-0.5 text-[16px] font-semibold', TEXT.muted)}>
          Détail du calcul
        </div>
        <div className="flex items-center justify-between gap-2 text-[16px]">
          <span className={cn('flex items-center gap-1.5', TEXT.muted)}>
            <MethodLogo method={method?.key ?? 'cash'} size={20} />
            Taux base ({method?.label})
          </span>
          <span className={cn('font-semibold tabular-nums', TEXT.strong)}>{baseRate.toLocaleString('fr-FR')} CNY</span>
        </div>
        <div className="flex justify-between text-[16px]">
          <span className={TEXT.muted}>Ajust. pays ({country?.label})</span>
          <span className={cn('font-semibold tabular-nums', adjClass(countryAdj))}>{countryAdj}%</span>
        </div>
        <div className="flex justify-between text-[16px]">
          <span className={TEXT.muted}>Ajust. tranche ({tier?.shortLabel})</span>
          <span className={cn('font-semibold tabular-nums', adjClass(tierAdj))}>{tierAdj}%</span>
        </div>
        <div className="flex justify-between border-t border-black/[0.06] pt-2 text-[16px] dark:border-white/[0.08]">
          <span className={cn('font-semibold', TEXT.strong)}>Taux final appliqué</span>
          <span className="font-bold tabular-nums text-[#1E1E1E] dark:text-[#F5F5F5]">
            {finalRate.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} CNY
          </span>
        </div>
      </div>

      {/* Formule */}
      <div className={cn('mt-3 text-center text-[16px]', TEXT.muted)}>
        {amountXAF.toLocaleString('fr-FR')} XAF × ({finalRate.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} / 1 000 000) ={' '}
        {amountCNY.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} CNY
      </div>
    </div>
  );
}
