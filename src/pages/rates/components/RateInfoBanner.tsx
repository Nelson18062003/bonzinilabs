import { Sparkles } from 'lucide-react';

export function RateInfoBanner() {
  return (
    <div className="flex items-center gap-3 rounded-[20px] bg-[#EAE7FA] p-4 dark:bg-[#272252]">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/60 dark:bg-black/20">
        <Sparkles className="h-5 w-5 text-[#5B4CC4] dark:text-[#B5AAF0]" />
      </div>
      <div>
        <p className="text-[14px] font-bold text-[#5B4CC4] dark:text-[#B5AAF0]">Suivez les taux en temps réel</p>
        <p className="mt-0.5 text-[12px] text-[#6E66A8] dark:text-[#9C93D6]">Mis à jour chaque matin pour vous offrir le meilleur cours.</p>
      </div>
    </div>
  );
}
