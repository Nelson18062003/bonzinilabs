import { Lock } from 'lucide-react';

interface ClosedBannerProps {
  message: string;
}

export function ClosedBanner({ message }: ClosedBannerProps) {
  return (
    <div className="flex items-center gap-2 border-t border-border bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
      <Lock className="h-3.5 w-3.5" />
      <span>{message}</span>
    </div>
  );
}
