import type React from 'react';

/** Un écran du parcours à capturer : le composant, la route du routeur en mémoire, et son motif. */
export type JourneyEntry = { Comp: React.ComponentType; route: string; path?: string; wrap?: 'lang' };
