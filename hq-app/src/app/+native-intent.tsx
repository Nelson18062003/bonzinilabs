// Liens système (bonzinihq://…, notifications, liens bonzinilabs.com) :
// l'app n'a qu'un écran principal ; la page du site visée est mise en
// attente (links.ts) et ouverte par l'écran principal une fois la personne
// connectée. Ne jamais planter ici.
import { queueSitePath, sitePathFromUrl } from '../links';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    queueSitePath(sitePathFromUrl(path));
  } catch {
    // lien illisible : on ouvre simplement l'app
  }
  return '/';
}
