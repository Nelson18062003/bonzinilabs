// ============================================================
// Substitution de variables dans les templates de réponse admin
//
// Variables supportées (entre doubles accolades) :
//   {{client_first_name}}
//   {{client_last_name}}
//   {{client_full_name}}
//   {{client_phone}}
//   {{conversation_subject}}
//   {{today}}            — date du jour (ex: "17 mai 2026")
//   {{admin_first_name}}
//
// Les variables non résolues restent telles quelles, pour que l'admin
// puisse les éditer avant envoi si elles n'ont pas pu être substituées.
// ============================================================
import { format } from 'date-fns';
import type { Locale } from 'date-fns';

export interface TemplateContext {
  clientFirstName?: string | null;
  clientLastName?: string | null;
  clientPhone?: string | null;
  conversationSubject?: string | null;
  adminFirstName?: string | null;
  /** Locale date-fns pour le formatage de {{today}} */
  dateLocale?: Locale;
  /** Fallback si le sujet est vide (par défaut "Discussion générale") */
  defaultSubject?: string;
}

export interface TemplateVariableInfo {
  key: string;
  label: string;
  example: string;
}

/** Liste des variables disponibles pour affichage dans l'UI d'édition */
export const TEMPLATE_VARIABLES: TemplateVariableInfo[] = [
  { key: 'client_first_name', label: 'Prénom du client', example: 'Jean' },
  { key: 'client_last_name', label: 'Nom du client', example: 'Dupont' },
  { key: 'client_full_name', label: 'Nom complet', example: 'Jean Dupont' },
  { key: 'client_phone', label: 'Téléphone client', example: '+237 6XX XX XX XX' },
  { key: 'conversation_subject', label: 'Sujet de la conv.', example: 'Question paiement' },
  { key: 'today', label: 'Date du jour', example: '17 mai 2026' },
  { key: 'admin_first_name', label: 'Votre prénom', example: 'Marie' },
];

/**
 * Remplace les variables {{key}} dans la chaîne par les valeurs du contexte.
 * Les variables introuvables ou null sont remplacées par une chaîne vide,
 * sauf si `keepMissing` est true (utile pour debug).
 */
export function substituteTemplateVars(
  content: string,
  ctx: TemplateContext,
  keepMissing = false
): string {
  const subject = ctx.conversationSubject?.trim() || ctx.defaultSubject || 'Discussion générale';
  const fullName = `${ctx.clientFirstName ?? ''} ${ctx.clientLastName ?? ''}`.trim();
  const today = format(new Date(), 'd MMMM yyyy', ctx.dateLocale ? { locale: ctx.dateLocale } : undefined);

  const map: Record<string, string | null | undefined> = {
    client_first_name: ctx.clientFirstName,
    client_last_name: ctx.clientLastName,
    client_full_name: fullName || null,
    client_phone: ctx.clientPhone,
    conversation_subject: subject,
    today,
    admin_first_name: ctx.adminFirstName,
  };

  return content.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (match, key: string) => {
    const value = map[key.toLowerCase()];
    if (value != null && value !== '') return value;
    return keepMissing ? match : '';
  });
}

/**
 * Petit aperçu de la chaîne avec exemples (utilisé dans l'éditeur de template).
 */
export function previewWithExamples(content: string): string {
  const ctx: TemplateContext = {
    clientFirstName: 'Jean',
    clientLastName: 'Dupont',
    clientPhone: '+237 6XX XX XX XX',
    conversationSubject: 'Question paiement',
    adminFirstName: 'Marie',
  };
  return substituteTemplateVars(content, ctx);
}
