/**
 * Créer un client SANS quitter la liste.
 *
 * `/m/clients/new` rendait une page entière : cliquer sur « Nouveau » faisait
 * disparaître la liste, son filtre et sa position de défilement, pour un
 * formulaire de sept champs. Au retour, tout était à refaire. Sur un écran
 * de 1 440 px, la place ne manque pourtant pas — c'est une contrainte de
 * téléphone appliquée à un poste de travail.
 *
 * La liste reste donc affichée, en arrière-plan, et le formulaire s'ouvre
 * par-dessus. L'URL `/m/clients/new` NE CHANGE PAS : elle reste partageable,
 * le bouton Précédent la ferme, et le lien depuis le tableau de bord
 * continue de fonctionner. Fermer revient à `/m/clients`.
 *
 * Le MOBILE garde sa page pleine : à 390 px, une fenêtre par-dessus une
 * liste n'a pas de sens. Seule la branche desktop de la route change.
 */
import { useNavigate } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { Dialog, DialogPortal, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { DesktopClientsScreen } from './DesktopClientsScreen';
import { DesktopCreateClient } from './DesktopCreateClient';

export function DesktopCreateClientDialog() {
  const navigate = useNavigate();

  return (
    <>
      {/* La liste, toujours là : c'est le contexte qu'on ne veut pas perdre. */}
      <DesktopClientsScreen />

      <Dialog
        open
        onOpenChange={(next) => {
          if (!next) navigate('/m/clients');
        }}
      >
        <DialogPortal>
          {/* Voile PROPRE à cette fenêtre. Le `bg-black/80` par défaut de
              shadcn efface la liste — or l'intérêt est justement de la
              garder visible derrière. Un voile léger et un flou suffisent à
              porter le regard sur le formulaire sans noircir l'écran. */}
          <DialogPrimitive.Overlay
            className={cn(
              'fixed inset-0 z-50 bg-foreground/20 backdrop-blur-[2px]',
              'data-[state=open]:animate-in data-[state=open]:fade-in-0',
              'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
            )}
          />
          <DialogPrimitive.Content
            className={cn(
              'fixed left-1/2 top-1/2 z-50 w-[min(920px,calc(100vw-4rem))] -translate-x-1/2 -translate-y-1/2',
              // Le formulaire peut dépasser la hauteur de l'écran (dix
              // numéros possibles) : il défile DANS la fenêtre, jamais la
              // page derrière.
              'max-h-[88vh] overflow-y-auto rounded-3xl border border-border bg-background p-6 shadow-2xl',
              'duration-200 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
              'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
            )}
          >
            {/* Radix exige un titre accessible ; il est visuellement porté
                par l'en-tête du formulaire, donc on ne le duplique pas. */}
            <DialogTitle className="sr-only">Nouveau client</DialogTitle>
            <DialogDescription className="sr-only">
              Identité, contact et localisation du nouveau client
            </DialogDescription>

            <DialogPrimitive.Close
              className="absolute right-5 top-5 rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Fermer"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>

            <DesktopCreateClient embedded />
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
    </>
  );
}
