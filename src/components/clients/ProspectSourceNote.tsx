// ============================================================
// Sous le sélecteur « Origine du client » : le numéro saisi est celui d'un
// prospect d'un commercial (voir `useCreateClientForm`).
//   · origine = sa fiche     → note calme : le client lui sera attribué ;
//   · autre origine choisie  → note ambrée. Le serveur attribue déjà le compte
//     au commercial du prospect à sa création (clients_match_prospect) : seul
//     un rôle qui modifie les clients (canEditClients) remplace cette origine ;
//     les autres sont prévenus que leur choix ne sera pas retenu.
// Rendue par la création de client desktop, mobile et réception.
//
// `ProspectPrefillNote`, sous le numéro : ce que la fiche du prospect a
// rempli d'office (« Repris de la fiche de Paul Etoga (prospect de Jean
// Mbarga) : nom, entreprise, ville et sexe. »), pour que l'opérateur sache
// d'où viennent ces valeurs et les vérifie avec le client. Si le numéro
// principal change ensuite pour celui d'un autre, la note devient un
// avertissement : les valeurs reprises sont restées, à vérifier.
//
// `ProspectEmailSuggestion`, sous l'email : l'adresse notée par le
// commercial, PROPOSÉE seulement — elle deviendrait l'adresse de connexion
// du client, déjà confirmée ; l'opérateur la prend d'un geste, une fois que
// le client la lui a confirmée.
// ============================================================
import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminAuthContext } from '@/contexts/AdminAuthContext';
import { Info, AlertTriangle, FileUser, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProspectSourceMatch } from '@/components/clients/useCreateClientForm';
import type { PrefillKey, ProspectPrefill } from '@/components/clients/prospectPrefill';

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

/** « nom, entreprise et ville » dans la langue de l'écran. */
type ListFormatCtor = new (lang: string, o: { style: 'long'; type: 'conjunction' }) => { format: (items: string[]) => string };
function listOf(items: string[], lang: string): string {
  // `Intl.ListFormat` (ES2021) manque aux types du projet, pas aux navigateurs.
  const ListFormat = (Intl as unknown as { ListFormat?: ListFormatCtor }).ListFormat;
  try {
    if (ListFormat) return new ListFormat(lang, { style: 'long', type: 'conjunction' }).format(items);
  } catch {
    /* langue inconnue : la virgule suffit */
  }
  return items.join(', ');
}

export function ProspectPrefillNote({ prefill, stale = false, className }: { prefill: ProspectPrefill | null; stale?: boolean; className?: string }) {
  const { t, i18n } = useTranslation('common');
  if (!prefill || prefill.filled.length === 0) return null;
  const list = listOf(
    prefill.filled.map((k: PrefillKey) => t(`clientForm.prefillKeys.${k}`)),
    i18n.language,
  );
  const name = prefill.prospectName.trim();
  const label = prefill.sourceLabel.trim();
  // Le PROSPECT nommé d'abord, son commercial entre parenthèses (le commercial n'est pas le prospect).
  const text = stale
    ? name
      ? t('clientForm.prefillStale', { name, list })
      : t('clientForm.prefillStaleAnon', { list })
    : name && label
      ? t('clientForm.prefillNote', { name, label, list })
      : name
        ? t('clientForm.prefillNoteNoLabel', { name, list })
        : t('clientForm.prefillNoteAnon', { list });
  // Une note (et non un « status ») : elle accompagne le formulaire, annoncée poliment à son apparition.
  return (
    <p
      role="note"
      aria-live="polite"
      className={cn(
        'flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-[14px] leading-snug',
        stale
          ? 'bg-[#FFF8EB] font-medium text-[#975102] dark:bg-[#3D2A0A] dark:text-[#E8B931]'
          : 'bg-[#F5F5F5] text-[#303030] dark:bg-[#383838] dark:text-[#E3E3E3]',
        className,
      )}
    >
      {stale ? (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      ) : (
        <FileUser className="mt-0.5 h-4 w-4 shrink-0 text-[#009951] dark:text-[#14AE5C]" aria-hidden />
      )}
      <span>{text}</span>
    </p>
  );
}

/**
 * L'email noté par le commercial, proposé sous le champ. Jamais posé
 * d'office : il deviendrait l'adresse de connexion du client (déjà
 * confirmée), et le commercial n'a rien vérifié.
 */
export function ProspectEmailSuggestion({ email, onUse, className }: { email: string | null; onUse: () => void; className?: string }) {
  const { t } = useTranslation('common');
  if (!email) return null;
  return (
    <div
      role="note"
      className={cn(
        'mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-[#F5F5F5] px-3 py-2.5 text-[14px] leading-snug text-[#303030] dark:bg-[#383838] dark:text-[#E3E3E3]',
        className,
      )}
    >
      <Mail className="h-4 w-4 shrink-0 text-[#5A5A5A] dark:text-[#CDCDCD]" aria-hidden />
      <div className="min-w-0 flex-1 basis-56">
        <div className="text-[13px] text-[#5A5A5A] dark:text-[#CDCDCD]">{t('clientForm.emailSuggestion')}</div>
        {/* L'adresse sur sa ligne : coupée seulement si elle ne tient pas. */}
        <div className="font-semibold [overflow-wrap:anywhere]">{email}</div>
        <div className="mt-1 text-[13px] text-[#5A5A5A] dark:text-[#CDCDCD]">{t('clientForm.emailSuggestionWarn')}</div>
      </div>
      <button
        type="button"
        onClick={onUse}
        className="inline-flex h-9 shrink-0 items-center rounded-lg border border-[#949494] bg-white px-3 text-[14px] font-semibold text-[#1E1E1E] transition-colors hover:bg-[#F5F5F5] dark:border-[#6E6E6E] dark:bg-[#2C2C2C] dark:text-[#F5F5F5] dark:hover:bg-[#383838]"
      >
        {t('clientForm.emailSuggestionUse')}
      </button>
    </div>
  );
}
