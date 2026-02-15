import * as React from 'react';
import { DayPicker } from 'react-day-picker';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type GlassCalendarProps = React.ComponentProps<typeof DayPicker>;

/**
 * Premium liquid glass calendar for mobile — large touch targets, glassmorphic
 * styling, smooth transitions. Uses react-day-picker v9 API.
 */
export function GlassCalendar({
  className,
  classNames,
  showOutsideDays = true,
  locale = fr,
  ...props
}: GlassCalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      locale={locale}
      className={cn('glass-calendar', className)}
      classNames={{
        // Root & layout
        root: 'w-full',
        months: 'flex flex-col',
        month: 'space-y-3',

        // Caption (month/year header)
        month_caption: 'flex items-center justify-center relative h-10',
        caption_label: 'text-base font-semibold text-foreground',

        // Navigation
        nav: 'flex items-center',
        button_previous: cn(
          'absolute left-0 z-10',
          'w-10 h-10 rounded-xl',
          'bg-card/60 backdrop-blur-md border border-border/30',
          'flex items-center justify-center',
          'text-foreground/70 hover:text-foreground',
          'active:scale-95 transition-all duration-150',
          'shadow-sm',
        ),
        button_next: cn(
          'absolute right-0 z-10',
          'w-10 h-10 rounded-xl',
          'bg-card/60 backdrop-blur-md border border-border/30',
          'flex items-center justify-center',
          'text-foreground/70 hover:text-foreground',
          'active:scale-95 transition-all duration-150',
          'shadow-sm',
        ),
        chevron: 'h-5 w-5',

        // Grid
        month_grid: 'w-full border-collapse',
        weekdays: 'flex mb-1',
        weekday: cn(
          'flex-1 h-10 flex items-center justify-center',
          'text-xs font-semibold uppercase tracking-wider',
          'text-muted-foreground/60',
        ),
        weeks: '',
        week: 'flex',

        // Day cells — 44px+ touch targets
        day: cn(
          'flex-1 aspect-square flex items-center justify-center',
          'relative p-0.5',
        ),
        day_button: cn(
          'w-full h-full min-h-[44px] rounded-xl',
          'flex items-center justify-center',
          'text-sm font-medium text-foreground',
          'transition-all duration-200 ease-out',
          'hover:bg-primary/8',
          'active:scale-90',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
        ),

        // States
        selected: cn(
          '!bg-primary !text-primary-foreground',
          'shadow-[0_2px_12px_-2px_hsl(var(--primary)/0.4)]',
          'font-bold',
        ),
        today: cn(
          'bg-primary/10 text-primary font-bold',
          'ring-1 ring-primary/20',
        ),
        outside: 'text-muted-foreground/30',
        disabled: 'text-muted-foreground/20 cursor-not-allowed',
        hidden: 'invisible',

        // Range
        range_start: 'rounded-l-xl bg-primary text-primary-foreground',
        range_middle: 'bg-primary/10 text-primary rounded-none',
        range_end: 'rounded-r-xl bg-primary text-primary-foreground',

        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === 'left' ? (
            <ChevronLeft className="h-5 w-5" />
          ) : (
            <ChevronRight className="h-5 w-5" />
          ),
      }}
      {...props}
    />
  );
}
