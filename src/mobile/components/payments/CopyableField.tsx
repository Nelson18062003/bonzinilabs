import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { copyToClipboard } from '@/lib/clipboard';

interface CopyableFieldProps {
  label: string;
  value: string;
  copyLabel?: string;
}

export function CopyableField({ label, value, copyLabel }: CopyableFieldProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await copyToClipboard(value, copyLabel || label);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground">{label}</span>
      <button
        onClick={handleCopy}
        className="flex items-center gap-1.5 font-medium active:scale-95 transition-transform"
      >
        <span>{value}</span>
        {copied ? (
          <Check className="w-3.5 h-3.5 text-green-500" />
        ) : (
          <Copy className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </button>
    </div>
  );
}
