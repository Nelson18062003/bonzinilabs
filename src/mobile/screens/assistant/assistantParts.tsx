/**
 * Pièces de l'écran Mola partagées entre l'écran d'origine (bureau) et la
 * refonte v2 (téléphone) : le texte enrichi et l'aperçu plein écran d'une image.
 */
import { useEffect } from 'react';
import { Download, X } from 'lucide-react';

// Rendu léger du texte : **gras** → <strong>. Le reste en texte brut
// (whitespace-pre-wrap gère les retours à la ligne). Pas de HTML injecté.
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\*\*[^*]+\*\*$/.test(p)
          ? <strong key={i}>{p.slice(2, -2)}</strong>
          : <span key={i}>{p}</span>,
      )}
    </>
  );
}

// Prévisualisation plein écran d'une image générée (flyer, preuve, QR, reçu).
// Tap sur le fond ou Échap → ferme. Bouton dédié pour télécharger / ouvrir.
// (Fonctionnalité venue de main / PR #140 — conservée dans le nouveau langage.)
export function ImagePreview({ image, onClose }: { image: { url: string; name: string }; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-black/90 backdrop-blur-md"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Prévisualisation : ${image.name}`}
    >
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+14px)]" onClick={(e) => e.stopPropagation()}>
        <span className="truncate text-[16px] font-medium text-white/90">{image.name}</span>
        <button onClick={onClose} aria-label="Fermer la prévisualisation" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition active:scale-95 active:bg-white/20">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center overflow-auto px-3 py-1" onClick={(e) => e.stopPropagation()}>
        <img src={image.url} alt={image.name} className="max-h-full max-w-full rounded-lg object-contain shadow-2xl" />
      </div>
      <div className="px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-3" onClick={(e) => e.stopPropagation()}>
        <a href={image.url} target="_blank" rel="noopener noreferrer" download={image.name} className="flex w-full items-center justify-center gap-2 rounded-lg bg-white py-3 text-[16px] font-semibold text-black transition active:scale-[0.99]">
          <Download className="h-4 w-4" /> Télécharger / ouvrir
        </a>
      </div>
    </div>
  );
}

