import { toast } from 'sonner';

/**
 * Copy text to clipboard with toast feedback.
 * Falls back to document.execCommand for non-secure contexts (e.g., localhost HTTP).
 */
export async function copyToClipboard(text: string, label?: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    toast.success(label ? `${label} copié` : 'Copié');
    return true;
  } catch {
    toast.error('Impossible de copier');
    return false;
  }
}
