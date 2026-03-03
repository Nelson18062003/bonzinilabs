import { Sparkles } from 'lucide-react';

export function RateInfoBanner() {
  return (
    <div className="bg-gradient-to-r from-violet-100 to-violet-50 rounded-2xl p-4 flex items-center gap-3 border border-violet-200">
      <div className="w-[42px] h-[42px] rounded-xl bg-violet-500/10 flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-5 h-5 text-violet-500" />
      </div>
      <div>
        <p className="text-sm font-bold text-gray-900 mb-0.5">
          Suivez les taux en temps r&eacute;el
        </p>
        <p className="text-xs text-stone-500 leading-relaxed">
          Les taux sont mis &agrave; jour chaque matin pour vous offrir le meilleur cours.
        </p>
      </div>
    </div>
  );
}
