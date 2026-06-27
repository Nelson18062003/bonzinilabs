/**
 * DEV-ONLY maquette — module CLIENT « Historique » (activité du compte).
 * Langage validé : opérations groupées par jour, crédit vert / débit neutre
 * (cohérent avec l'accueil), filtres Tous/Crédits/Débits, bouton « Relevé ».
 * Harness: ?screen=chist-list
 */
import { SURFACE, TEXT, SOFT_PILL } from '@/mobile/designKit/tokens';
import { ArrowDownLeft, ArrowUpRight, FileDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const GREEN = '#2E7D52';

type Op = { credit: boolean; label: string; desc: string; amount: string };
const GROUPS: { date: string; ops: Op[] }[] = [
  {
    date: 'vendredi 13 juin',
    ops: [
      { credit: true, label: 'Dépôt validé', desc: 'Cash agence · BZ-DP-2405', amount: '1 000 000' },
      { credit: false, label: 'Paiement fournisseur', desc: 'Guangzhou Textile · BZ-PM-2401', amount: '2 500 000' },
    ],
  },
  {
    date: 'mercredi 11 juin',
    ops: [
      { credit: true, label: 'Remboursement', desc: 'Paiement annulé · BZ-PM-2380', amount: '600 000' },
      { credit: true, label: 'Dépôt validé', desc: 'Orange Money · BZ-DP-2412', amount: '500 000' },
    ],
  },
];

const FILTERS = ['Tous', 'Crédits', 'Débits'];

export function HistoryScreen() {
  return (
    <div className={cn('mx-auto min-h-screen max-w-[420px]', SURFACE.canvas)}>
      <div className="space-y-4 p-4 pt-6">
        {/* En-tête */}
        <div className="flex items-start justify-between gap-3 px-1">
          <div>
            <h1 className={cn('text-[26px] font-black leading-tight', TEXT.strong)}>Historique</h1>
            <p className={cn('mt-0.5 text-[13px]', TEXT.muted)}>Tous vos mouvements de compte</p>
          </div>
          <button className={cn('flex shrink-0 items-center gap-1.5 px-4 py-2.5 text-[13px] font-bold', SOFT_PILL)}>
            <FileDown className="h-4 w-4" /> Relevé
          </button>
        </div>

        {/* Filtres */}
        <div className="flex items-center gap-2">
          {FILTERS.map((f, i) => (
            <button
              key={f}
              className={cn(
                'rounded-full px-4 py-2 text-[12.5px] font-bold transition-colors',
                i === 0 ? 'bg-[#8B5CF6] text-white' : cn(SURFACE.card, SURFACE.shadow, TEXT.muted),
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Groupes par jour */}
        {GROUPS.map((g) => (
          <section key={g.date}>
            <h2 className={cn('mb-2 px-1 text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>{g.date}</h2>
            <div className="space-y-2.5">
              {g.ops.map((op) => (
                <div key={op.desc} className={cn('flex items-center gap-3 rounded-[18px] p-3.5', SURFACE.card, SURFACE.shadow)}>
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                    style={{ background: op.credit ? `${GREEN}1F` : 'rgba(0,0,0,0.05)' }}
                  >
                    {op.credit ? <ArrowDownLeft className="h-5 w-5" style={{ color: GREEN }} /> : <ArrowUpRight className={cn('h-5 w-5', TEXT.muted)} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={cn('truncate text-[14px] font-bold', TEXT.strong)}>{op.label}</div>
                    <div className={cn('mt-0.5 truncate text-[12px]', TEXT.muted)}>{op.desc}</div>
                  </div>
                  <div className={cn('shrink-0 text-right text-[14px] font-black tabular-nums', !op.credit && TEXT.strong)} style={op.credit ? { color: GREEN } : undefined}>
                    {op.credit ? '+' : '−'} {op.amount}
                    <div className={cn('text-[10px] font-semibold', TEXT.muted)}>XAF</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
