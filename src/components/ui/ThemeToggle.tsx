import { useTheme } from 'next-themes';
import { Sun, Moon, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

const themes = [
  { value: 'light', icon: Sun, label: 'Clair' },
  { value: 'dark', icon: Moon, label: 'Sombre' },
  { value: 'system', icon: Monitor, label: 'Auto' },
] as const;

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div className={cn('flex gap-1 rounded-2xl bg-[#EDEAFA] p-1 dark:bg-[#2F2C3D]', className)}>
      {themes.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={cn(
            'flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-1.5 text-[14px] font-bold transition-all min-[360px]:text-[16px]',
            theme === value
              ? 'bg-white text-[#1B1A24] shadow-sm dark:bg-[#46415C] dark:text-[#F2F1F7]'
              : 'text-[#8E8BA0] hover:text-[#1B1A24] dark:text-[#9B98AD] dark:hover:text-[#F2F1F7]'
          )}
          title={label}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

/** Compact theme toggle for menus - cycles through themes on click */
export function ThemeToggleCompact() {
  const { theme, setTheme } = useTheme();

  const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
  const CurrentIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;
  const label = theme === 'dark' ? 'Sombre' : theme === 'light' ? 'Clair' : 'Auto';

  return (
    <button
      onClick={() => setTheme(next)}
      className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#EDEAFA] text-sm font-medium text-[#1B1A24] active:scale-95 transition-all dark:bg-[#2F2C3D] dark:text-[#F2F1F7]"
    >
      <CurrentIcon className="w-4 h-4" />
      {label}
    </button>
  );
}
