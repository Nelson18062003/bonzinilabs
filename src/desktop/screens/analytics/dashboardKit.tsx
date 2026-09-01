/**
 * Tableau de bord desktop — atomes, sur le design system.
 *
 * L'écran précédent était l'écran TÉLÉPHONE rendu en pleine largeur
 * (`DesktopAnalyticsDashboard` = 15 lignes qui rendaient les 1 799 lignes du
 * mobile). Il s'appuyait sur des primitives maison — `KpiCard`, `ChartCard`,
 * `CollapsibleSection` — qui ne connaissent ni les jetons du thème ni les
 * composants shadcn posés pour l'admin.
 *
 * Ces atomes-ci sont bâtis sur `Card`, `Table`, `Badge`, `Skeleton` et les
 * jetons sémantiques : ils suivent le thème clair/sombre sans palette
 * parallèle. Le mobile garde les siens, sa largeur les justifie.
 */
import * as React from 'react';
import { TrendUp, TrendDown, Minus } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

/** Chiffres : toujours à largeur fixe, sinon une colonne de montants danse. */
export const NUM = 'tabular-nums';

/** Étiquette de section / d'en-tête. */
export const LABEL = 'text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground';

export const TONE = {
  positive: 'text-emerald-600 dark:text-emerald-400',
  negative: 'text-destructive',
  neutral: 'text-foreground',
} as const;

/* ── Variation ───────────────────────────────────────────────────────
 *
 * Une variation se lit à son SIGNE avant son chiffre, et son sens dépend de
 * la métrique : +20 % de dépôts est bon, +20 % de délai de traitement ne
 * l'est pas. D'où `invert`, plutôt qu'un vert systématique sur le positif. */

export function DeltaBadge({
  value,
  invert = false,
  className,
}: {
  /** Variation relative, ex. 0.12 pour +12 %. `null` = pas de comparaison. */
  value: number | null | undefined;
  invert?: boolean;
  className?: string;
}) {
  if (value == null || !Number.isFinite(value)) return null;
  const flat = Math.abs(value) < 0.001;
  const good = invert ? value < 0 : value > 0;
  const Icon = flat ? Minus : value > 0 ? TrendUp : TrendDown;
  const tone = flat ? 'text-muted-foreground' : good ? TONE.positive : TONE.negative;
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[11.5px] font-semibold', NUM, tone, className)}>
      <Icon className="size-3" weight="bold" />
      {flat ? '0 %' : `${value > 0 ? '+' : ''}${(value * 100).toFixed(1).replace('.', ',')} %`}
    </span>
  );
}

/* ── Indicateur ──────────────────────────────────────────────────────── */

export function StatCard({
  label,
  value,
  hint,
  delta,
  deltaInvert,
  loading,
  tone = 'neutral',
}: {
  label: string;
  /** Déjà formaté, et EN ENTIER — pas de « 18,4 M » ici. */
  value: React.ReactNode;
  hint?: React.ReactNode;
  delta?: number | null;
  deltaInvert?: boolean;
  loading?: boolean;
  tone?: keyof typeof TONE;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className={LABEL}>{label}</div>
        {loading ? (
          <Skeleton className="mt-2 h-7 w-32" />
        ) : (
          <div className={cn('mt-1.5 text-[22px] font-bold leading-none tracking-[-0.02em]', NUM, TONE[tone])}>
            {value}
          </div>
        )}
        <div className="mt-1.5 flex items-center gap-2">
          {delta !== undefined && <DeltaBadge value={delta} invert={deltaInvert} />}
          {hint && <span className="truncate text-[11.5px] text-muted-foreground">{hint}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Bloc ────────────────────────────────────────────────────────────
 *
 * PAS d'accordéon. Sur mobile, replier 5 sections sur 6 est juste : l'écran
 * fait 390 px. Sur 1 440 px, c'est cacher ce qu'on a la place de montrer —
 * l'opérateur arrivait sur un tableau de bord presque vide qu'il fallait
 * déplier section par section. */

export function Block({
  title,
  description,
  toolbar,
  children,
  className,
}: {
  title: string;
  description?: string;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 border-b border-border px-4 py-3">
        <div className="min-w-0 space-y-0.5">
          <CardTitle className="text-sm font-semibold leading-none">{title}</CardTitle>
          {description && <CardDescription className="text-xs">{description}</CardDescription>}
        </div>
        {toolbar && <div className="flex shrink-0 items-center gap-2">{toolbar}</div>}
      </CardHeader>
      <CardContent className="p-4">{children}</CardContent>
    </Card>
  );
}

/** Squelette d'un graphique : garde la hauteur, donc pas de saut de page. */
export function ChartSkeleton({ height = 260 }: { height?: number }) {
  return <Skeleton className="w-full" style={{ height }} />;
}

export function EmptyBlock({ children, height = 260 }: { children: React.ReactNode; height?: number }) {
  return (
    <div
      className="flex items-center justify-center text-sm text-muted-foreground"
      style={{ height }}
    >
      {children}
    </div>
  );
}

/* ── Table compacte ──────────────────────────────────────────────────── */

export const DTable = Table;
export const DHead = TableHeader;
export const DBody = TableBody;
export const DRow = TableRow;

export function DTh({
  children,
  align = 'left',
  className,
}: {
  children?: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  return (
    <TableHead className={cn('h-9 px-3', LABEL, align === 'right' && 'text-right', className)}>
      {children}
    </TableHead>
  );
}

export function DTd({
  children,
  align = 'left',
  className,
}: {
  children?: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  return (
    <TableCell className={cn('px-3 py-2.5 text-[12.5px]', align === 'right' && 'text-right', className)}>
      {children}
    </TableCell>
  );
}
