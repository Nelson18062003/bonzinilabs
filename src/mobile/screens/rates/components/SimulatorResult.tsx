import { PAYMENT_METHODS, COUNTRIES, TIERS } from '@/types/rates';

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
}: SimulatorResultProps) {
  const method = PAYMENT_METHODS.find((p) => p.key === methodKey);
  const country = COUNTRIES.find((c) => c.key === countryKey);
  const tier = TIERS.find((t) => t.key === tierKey);

  return (
    <div
      className="rounded-2xl p-5 text-white"
      style={{ background: 'linear-gradient(135deg, #1a1a2e, #2d1b69)' }}
    >
      <div className="text-xs text-white/50 uppercase tracking-wider mb-1.5">
        Resultat de la simulation
      </div>

      {/* XAF sent */}
      <div className="flex justify-between items-center p-3 bg-white/[0.08] rounded-xl mb-2">
        <div>
          <div className="text-[11px] text-white/40 uppercase tracking-wide">
            Vous envoyez
          </div>
          <div className="text-[22px] font-extrabold">
            {amountXAF.toLocaleString('fr-FR')}
          </div>
        </div>
        <div className="bg-white/[0.12] px-3.5 py-1.5 rounded-lg text-sm font-bold text-white/70">
          XAF
        </div>
      </div>

      {/* Arrow */}
      <div className="text-center text-lg opacity-40 my-1">&darr;</div>

      {/* CNY received */}
      <div
        className="flex justify-between items-center p-3 rounded-xl mb-4"
        style={{
          background: 'rgba(124,58,237,0.2)',
          border: '1px solid rgba(124,58,237,0.3)',
        }}
      >
        <div>
          <div className="text-[11px] text-white/40 uppercase tracking-wide">
            Client recoit
          </div>
          <div className="text-[28px] font-extrabold text-purple-400">
            {amountCNY.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-purple-400/20 px-3.5 py-1.5 rounded-lg text-sm font-bold text-purple-400">
          CNY
        </div>
      </div>

      {/* Breakdown */}
      <div className="bg-white/[0.08] rounded-xl p-3.5 space-y-2">
        <div className="text-[11px] font-semibold text-white/40 uppercase tracking-wide mb-0.5">
          Detail du calcul
        </div>
        <div className="flex justify-between text-[13px]">
          <span className="opacity-60">Taux base ({method?.label})</span>
          <span className="font-semibold">{baseRate.toLocaleString('fr-FR')} CNY</span>
        </div>
        <div className="flex justify-between text-[13px]">
          <span className="opacity-60">Ajust. pays ({country?.label})</span>
          <span className={`font-semibold ${countryAdj < 0 ? 'text-red-400' : 'text-green-400'}`}>
            {countryAdj}%
          </span>
        </div>
        <div className="flex justify-between text-[13px]">
          <span className="opacity-60">Ajust. tranche ({tier?.shortLabel})</span>
          <span className={`font-semibold ${tierAdj < 0 ? 'text-red-400' : 'text-green-400'}`}>
            {tierAdj}%
          </span>
        </div>
        <div className="border-t border-white/15 pt-2 flex justify-between text-sm">
          <span className="font-semibold">Taux final applique</span>
          <span className="font-extrabold text-purple-400">
            {finalRate.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} CNY
          </span>
        </div>
      </div>

      {/* Formula */}
      <div className="mt-3 text-[10px] opacity-30 text-center">
        {amountXAF.toLocaleString('fr-FR')} XAF x ({finalRate.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} / 1 000 000) ={' '}
        {amountCNY.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} CNY
      </div>
    </div>
  );
}
