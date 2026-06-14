import { useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Mascotte Mola (le Lion Indomptable).
 *
 * Affiche l'image de la mascotte servie depuis `public/assets/mola-mascot.png`.
 * Tant que le fichier n'est pas présent (ou s'il échoue à charger), on retombe
 * proprement sur `fallback` — donc l'écran n'est jamais cassé : il suffit de
 * déposer `public/assets/mola-mascot.png` dans le repo et le lion apparaît partout
 * où ce composant est utilisé (accueil de Mola, en-tête, avatars).
 *
 * Pour changer la mascotte : remplace simplement le fichier image, rien d'autre.
 */
const MASCOT_SRC = '/assets/mola-mascot.png';

interface MolaMascotProps {
  /** Classes de taille/forme (ex. "h-20 w-20"). */
  className?: string;
  /** Rendu de repli si l'image est absente ou ne charge pas. */
  fallback?: React.ReactNode;
  /** Texte alternatif (accessibilité). */
  alt?: string;
  /** Animation « respiration » (ex. pendant que Mola réfléchit). */
  breathing?: boolean;
}

export function MolaMascot({ className, fallback = null, alt = 'Mola', breathing = false }: MolaMascotProps) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return (
    <img
      src={MASCOT_SRC}
      alt={alt}
      className={cn('object-contain', breathing && 'mola-breathe', className)}
      onError={() => setFailed(true)}
      draggable={false}
    />
  );
}
