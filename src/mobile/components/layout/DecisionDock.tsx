import { ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { SURFACE } from '@/mobile/designKit';

/** Ce que la barre occupe en bas : on réserve la même place dans le flux
 *  pour que la dernière ligne de la fiche reste lisible au-dessus. */
const DOCK_SPACE_PX = 84;

/**
 * La barre de décision collante des fiches dépôt / paiement.
 *
 * Quand le bouton principal de « La décision » n'est plus à l'écran —
 * l'opérateur lit la preuve, ouvre « Le détail » ou « Le suivi » — le même
 * geste reste sous le pouce, en bas. Une seule action : la barre ne redonne
 * pas une décision à prendre, elle rapproche celle que l'écran propose déjà.
 * Elle glisse depuis le bas (18/100 s ; sans mouvement si l'appareil le
 * demande), respecte la zone de sécurité de l'iPhone, s'efface avec le clavier
 * (`html.kb-open`, cf. index.css) et passe sous les feuilles basses (z-60).
 *
 * À rendre EN FIN de contenu défilant : le fragment pose aussi une cale de la
 * hauteur de la barre, pour que rien ne reste caché dessous.
 */
export function DecisionDock({ show, children }: { show: boolean; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <>
      {show && <div aria-hidden style={{ height: DOCK_SPACE_PX }} />}
      <AnimatePresence>
        {show && (
          <motion.div
            data-dock
            role="region"
            aria-label="La décision"
            initial={reduce ? false : { y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'tween', duration: reduce ? 0 : 0.18, ease: 'easeOut' }}
            className={cn('decision-dock fixed inset-x-0 bottom-0 z-40 border-t', SURFACE.canvas, SURFACE.divider)}
          >
            <div className="mx-auto max-w-lg px-5 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pt-3 md:max-w-2xl">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
