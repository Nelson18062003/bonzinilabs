import { Loader2 } from 'lucide-react';

/**
 * Bouton « Continuer avec Google » — respecte les Google Branding Guidelines
 * (fond blanc, logo « G » officiel multicolore, libellé clair). Réutilisé sur
 * l'écran de connexion ET d'inscription.
 */
interface GoogleButtonProps {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  label: string;
}

export function GoogleButton({ onClick, loading, disabled, label }: GoogleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full flex items-center justify-center gap-3 h-12 rounded-xl border border-border bg-white text-[#1f1f1f] font-medium text-sm shadow-sm transition-all hover:bg-gray-50 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed dark:bg-white"
      aria-label={label}
    >
      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
      ) : (
        <GoogleG className="h-5 w-5 shrink-0" />
      )}
      <span>{label}</span>
    </button>
  );
}

/** Logo « G » officiel Google (SVG 4 couleurs). */
function GoogleG({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}
