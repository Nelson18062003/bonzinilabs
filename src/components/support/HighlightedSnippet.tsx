import { useMemo } from 'react';

interface HighlightedSnippetProps {
  text: string;
  query: string;
  maxLength?: number;
  className?: string;
}

/**
 * Affiche un extrait du texte avec les occurrences de `query` surlignées en `<mark>`.
 * Si le texte est plus long que maxLength, on cadre autour de la première occurrence.
 */
export function HighlightedSnippet({
  text,
  query,
  maxLength = 140,
  className,
}: HighlightedSnippetProps) {
  const { displayText, parts } = useMemo(() => {
    if (!text) return { displayText: '', parts: [] as Array<{ value: string; mark: boolean }> };

    const q = query.trim();
    if (!q) {
      const truncated = text.length > maxLength ? text.slice(0, maxLength) + '…' : text;
      return { displayText: truncated, parts: [{ value: truncated, mark: false }] };
    }

    // Centrage de la fenêtre autour de la première occurrence
    let snippet = text;
    const firstMatchIdx = text.toLowerCase().indexOf(q.toLowerCase());
    if (firstMatchIdx > 30 && text.length > maxLength) {
      const start = Math.max(0, firstMatchIdx - 20);
      const end = Math.min(text.length, start + maxLength);
      snippet = (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
    } else if (text.length > maxLength) {
      snippet = text.slice(0, maxLength) + '…';
    }

    // Split case-insensitive autour de chaque occurrence de q
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const split = snippet.split(regex);
    const parts = split.map((value, i) => ({ value, mark: i % 2 === 1 }));
    return { displayText: snippet, parts };
  }, [text, query, maxLength]);

  if (!displayText) return null;

  return (
    <p className={className}>
      {parts.map((p, i) =>
        p.mark ? (
          <mark
            key={i}
            className="rounded bg-bonzini-amber/30 px-0.5 font-medium text-bonzini-amber"
          >
            {p.value}
          </mark>
        ) : (
          <span key={i}>{p.value}</span>
        )
      )}
    </p>
  );
}
