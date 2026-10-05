// ============================================================
// Sous le sélecteur « Origine du client » : le numéro saisi est celui d'un
// prospect d'un commercial (voir `useCreateClientForm`).
//   · origine = sa fiche     → note calme : le client lui sera attribué ;
//   · autre origine choisie  → note ambrée. Le serveur attribue déjà le compte
//     au commercial du prospect à sa création (clients_match_prospect) : seul
//     un rôle qui modifie les clients (canEditClients) remplace cette origine ;
//     les autres sont prévenus que leur choix ne sera pas retenu.
// Rendue par la création de client desktop, mobile et réception.
// ============================================================
import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminAuthContext } from '@/contexts/AdminAuthContext';
import { Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProspectSourceMatch } from '@/components/clients/useCreateClientForm';

export function ProspectSourceNote({ prospect, sourceId, className }: { prospect: ProspectSourceMatch | null; sourceId: string | null; className?: string }) {
  const { t } = useTranslation('common');
  // Contexte lu sans exiger le fournisseur : l'écran reste montable seul (tests, aperçus).
  const canOverride = useContext(AdminAuthContext)?.hasPermission('canEditClients') ?? false;
  if (!prospect || !sourceId) return null;
  const attributed = sourceId === prospect.sourceId;
  const Icon = attributed ? Info : AlertTriangle;
  return (
    <p
      role="status"
      className={cn(
        'flex items-start gap-2 text-[14px] leading-snug',
        attributed ? 'text-[#5A5A5A] dark:text-[#CDCDCD]' : 'font-medium text-[#975102] dark:text-[#E8B931]',
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>
        {attributed
          ? t('clientForm.sourceProspect', { label: prospect.sourceLabel })
          : t(canOverride ? 'clientForm.sourceProspectOther' : 'clientForm.sourceProspectKept', { label: prospect.sourceLabel })}
      </span>
    </p>
  );
}
