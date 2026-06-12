import { useMemo } from 'react';

interface HighlightedSnippetProps {
  text: string;
  query: string;
  maxLength?: number;
  className?: string;
}

export function HighlightedSnippet({
  text,
  query,
  maxLength = 140,
  className,
}: HighlightedSnippetProps) {
  const { parts } = useMemo(() => {
    if (!text) return { parts: [] as Array<{ value: string; mark: boolean }> };

    const q = query.trim();
    if (!q) {
      const truncated = text.length > maxLength ? text.slice(0, maxLength) + '…' : text;
      return { parts: [{ value: truncated, mark: false }] };
    }

    let snippet = text;
    const firstMatchIdx = text.toLowerCase().indexOf(q.toLowerCase());
    if (firstMatchIdx > 30 && text.length > maxLength) {
      const start = Math.max(0, firstMatchIdx - 20);
      const end = Math.min(text.length, start + maxLength);
      snippet = (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
    } else if (text.length > maxLength) {
      snippet = text.slice(0, maxLength) + '…';
    }

    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const split = snippet.split(regex);
    const parts = split.map((value, i) => ({ value, mark: i % 2 === 1 }));
    return { parts };
  }, [text, query, maxLength]);

  if (parts.length === 0) return null;

  return (
    <p className={className}>
      {parts.map((p, i) =>
        p.mark ? (
          <mark
            key={i}
            className="rounded bg-[hsl(258_100%_97%)] px-0.5 font-medium text-bonzini-violet dark:bg-[hsl(258_45%_22%)]"
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
