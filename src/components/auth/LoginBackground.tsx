import { cn } from '@/lib/utils';

interface LoginBackgroundProps {
  children: React.ReactNode;
  className?: string;
}

export function LoginBackground({ children, className }: LoginBackgroundProps) {
  return (
    <div
      className={cn(
        'min-h-screen flex flex-col bg-gradient-to-br from-primary/5 via-background to-primary/10 relative overflow-hidden',
        className
      )}
    >
      {/* Animated decorative blur circles */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-float" />
      <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-primary/5 rounded-full blur-3xl animate-float-delayed" />
      <div
        className="absolute top-1/3 right-0 w-40 h-40 bg-primary/[0.08] rounded-full blur-2xl animate-float"
        style={{ animationDelay: '1s' }}
      />

      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col">
        {children}
      </div>
    </div>
  );
}
