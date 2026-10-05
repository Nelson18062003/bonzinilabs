// Captures du parcours — domaine « teams » : clés « j.teams.<écran> » (données : tools/journey/teams.mjs).
import type { JourneyEntry } from './types';
import { TeamScreen } from '@/components/team/TeamScreen';

export const SCREENS: Record<string, JourneyEntry> = {
  'j.teams.smoke': { Comp: TeamScreen, route: '/m/equipe' },
};
