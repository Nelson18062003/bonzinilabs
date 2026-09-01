/**
 * Trésorerie — ADAPTATEUR au-dessus du design system (shadcn/ui).
 *
 * Ce fichier réimplémentait boutons, champs, table, dialogue et badges à la
 * main. C'était le vrai problème : shadcn/ui est installé dans le projet
 * (53 composants, `components.json`) et l'admin ne s'en servait pas — 1 écran
 * desktop sur 37. Tout est maintenant composé à partir de `@/components/ui`,
 * avec les VARIABLES du thème (`bg-card`, `text-muted-foreground`,
 * `border-border`…) plutôt que des couleurs écrites en dur.
 *
 * Le fichier ne garde que ce qui est propre au métier :
 *   · les chiffres en mono tabulaire (une colonne de montants doit s'aligner) ;
 *   · les tonalités achat / vente ;
 *   · quelques compositions récurrentes (en-tête de carte, ligne de faits).
 *
 * Géométrie alignée sur la bibliothèque Figma de référence : contrôles 32px,
 * rayon 10px (`--radius: 0.625rem` dans le thème `.admin-theme`).
 */
import * as React from 'react';
import { CaretDown as ChevronDown, CaretLeft as ChevronLeft, CaretRight as ChevronRight, CaretUpDown as ChevronsUpDown, IconContext, MagnifyingGlass as Search, X } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/* ── Tokens sémantiques ──────────────────────────────────────────────
 * Plus aucune couleur en dur : tout passe par les variables du thème,
 * donc le clair/sombre suit tout seul. */

export const M = {
  canvas: 'bg-background',
  card: 'bg-card',
  inset: 'bg-muted/50',
  border: 'border-border',
  rule: 'border-border/60',
  hover: 'hover:bg-muted/50',
} as const;

export const T = {
  ink: 'text-foreground',
  body: 'text-foreground/85',
  muted: 'text-muted-foreground',
  faint: 'text-muted-foreground/70',
} as const;

/** Chiffres : toujours en mono tabulaire. */
export const NUM = 'tabular-nums';

/** Étiquette de section / en-tête de colonne. */
export const LABEL = 'text-[10px] font-semibold uppercase tracking-[0.08em]';

/** Tonalités métier — achat (entrée de stock) / vente (sortie) / résultat. */
export const TONE = {
  purchase: 'text-indigo-600 dark:text-indigo-400',
  sale: 'text-amber-600 dark:text-amber-400',
  positive: 'text-emerald-600 dark:text-emerald-400',
  negative: 'text-destructive',
  /** Filets verticaux d'en-tête — même famille que la couleur de texte. */
  purchaseBar: 'border-indigo-500 dark:border-indigo-400',
  saleBar: 'border-amber-500 dark:border-amber-400',
} as const;

/**
 * Fonds teintés des mêmes familles. Palette Tailwind (donc automatiquement
 * cohérente clair/sombre) plutôt que des hex écrits à la main : c'était le
 * dernier endroit du module où une couleur ne venait pas du design system.
 */
export const TONE_BG = {
  purchase: 'bg-indigo-50 dark:bg-indigo-950/40',
  sale: 'bg-amber-50 dark:bg-amber-950/40',
  positive: 'bg-emerald-50 dark:bg-emerald-950/40',
  negative: 'bg-destructive/10',
} as const;

/**
 * Racine de page du module : le thème `.admin-theme` est posé par la coquille,
 * il n'y a plus de fond à repeindre ici — juste la typo du module.
 */
export const M_PAGE = 'font-ui';

/* ── Boutons ─────────────────────────────────────────────────────── */

export function MButton({
  children,
  onClick,
  variant = 'secondary',
  disabled,
  loading,
  type = 'button',
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}) {
  const map = { primary: 'default', secondary: 'outline', danger: 'destructive', ghost: 'ghost' } as const;
  return (
    <Button type={type} variant={map[variant]} size="compact" onClick={onClick} disabled={disabled || loading} className={className}>
      {children}
    </Button>
  );
}

export function MIconButton({
  icon: Icon,
  onClick,
  label,
  danger,
}: {
  icon: React.ElementType;
  onClick?: () => void;
  label: string;
  danger?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={danger ? 'text-destructive hover:bg-destructive/10 hover:text-destructive' : undefined}
    >
      <Icon />
    </Button>
  );
}

/* ── Onglets soulignés ───────────────────────────────────────────── */

/**
 * Onglets de vue — primitives Radix `Tabs` du design system.
 *
 * La version précédente était une `<nav>` de `<button>` : elle avait l'air
 * juste, mais elle n'avait ni `role="tablist"`, ni navigation au clavier par
 * flèches, ni lien `aria-controls` vers le panneau. Radix apporte les trois.
 * Le soulignement reste le nôtre — l'habillage par défaut est une pilule.
 */
export function MTabs<K extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
}: {
  tabs: ReadonlyArray<{ key: K; label: string }>;
  value: K;
  onChange: (k: K) => void;
  ariaLabel: string;
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as K)}>
      <TabsList
        aria-label={ariaLabel}
        className="h-auto w-full justify-start gap-6 rounded-none border-b border-border bg-transparent p-0"
      >
        {tabs.map((t) => (
          <TabsTrigger
            key={t.key}
            value={t.key}
            className={cn(
              '-mb-px rounded-none border-b-2 border-transparent bg-transparent px-0 pb-2.5 pt-0 text-sm font-medium text-muted-foreground shadow-none transition-colors',
              'hover:text-foreground',
              'data-[state=active]:border-foreground data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none',
            )}
          >
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

/* ── Filtre + compteur ───────────────────────────────────────────── */

export function MChip({
  label,
  count,
  active,
  onClick,
}: {
  label: React.ReactNode;
  count?: number | null;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Button variant={active ? 'default' : 'outline'} size="compact" onClick={onClick} className="gap-1.5">
      {label}
      {count != null && (
        <span className={cn(NUM, 'rounded px-1 text-[10.5px] font-bold', active ? 'bg-background/20' : 'bg-foreground/10')}>
          {count}
        </span>
      )}
    </Button>
  );
}

/* ── Menu déroulant ──────────────────────────────────────────────── */

export function MDropdown<V extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: V;
  options: ReadonlyArray<{ value: V; label: string }>;
  onChange: (v: V) => void;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="compact" className="gap-1.5">
          {label && <span className="text-muted-foreground">{label}</span>}
          {current?.label ?? ''}
          <ChevronDown className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map((o) => (
          <DropdownMenuItem key={o.value} onSelect={() => onChange(o.value)} className={o.value === value ? 'font-semibold' : undefined}>
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ── Recherche ───────────────────────────────────────────────────── */

export function MSearch({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-8 pr-7" />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Effacer"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/* ── Carte ───────────────────────────────────────────────────────── */

export function MCard({ children, className }: { children: React.ReactNode; className?: string }) {
  // `shadow-none` était forcé ici : combiné à un canvas de la même couleur
  // que les cartes, une carte n'avait NI fond distinct NI relief. On rend son
  // ombre au composant (`shadow-sm`, celle du design system).
  return <Card className={className}>{children}</Card>;
}

/**
 * En-tête de carte — vraie composition `CardHeader` / `CardTitle` /
 * `CardDescription` du design system, plus un `<div>` maison.
 *
 * `description` est la ligne qui manquait : une carte de trésorerie affiche un
 * agrégat, et l'agrégat a besoin de dire CE QU'IL COMPTE (« 11 opérations sur
 * 30 jours ») pour être lisible sans deviner.
 */
export function MCardHeader({
  title,
  meta,
  description,
  action,
}: {
  title: React.ReactNode;
  meta?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b border-border px-4 py-2.5">
      <div className="min-w-0 space-y-0.5">
        <CardTitle className="text-sm font-semibold leading-none">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {meta && <span className={cn('text-xs', T.muted)}>{meta}</span>}
        {action}
      </div>
    </CardHeader>
  );
}

export function MSection({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={cn(LABEL, T.muted)}>{children}</span>
      {right}
    </div>
  );
}

/* ── Table ───────────────────────────────────────────────────────── */

export function MTh({
  children,
  align = 'left',
  sortable,
  sorted,
  onSort,
  className,
}: {
  children?: React.ReactNode;
  align?: 'left' | 'right';
  sortable?: boolean;
  sorted?: 'asc' | 'desc' | null;
  onSort?: () => void;
  className?: string;
}) {
  const inner = (
    <span className={cn('inline-flex items-center gap-1', LABEL, sorted ? 'text-foreground' : 'text-muted-foreground')}>
      {children}
      {sorted ? <ChevronDown className={cn('size-3', sorted === 'asc' && 'rotate-180')} /> : sortable && <ChevronsUpDown className="size-3 opacity-45" />}
    </span>
  );
  return (
    <TableHead className={cn('h-9 px-4', align === 'right' && 'text-right', className)}>
      {sortable && onSort ? (
        <button type="button" onClick={onSort} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {inner}
        </button>
      ) : (
        inner
      )}
    </TableHead>
  );
}

export function MTd({
  children,
  align = 'left',
  className,
}: {
  children?: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  return <TableCell className={cn('px-4 py-2.5', align === 'right' && 'text-right', className)}>{children}</TableCell>;
}

/** Badge Achat / Vente. */
export function MTypeTag({ kind }: { kind: 'purchase' | 'sale' }) {
  return (
    <Badge variant={kind === 'purchase' ? 'indigo' : 'amber'} className="uppercase tracking-[0.05em]">
      {kind === 'purchase' ? 'Achat' : 'Vente'}
    </Badge>
  );
}

/** Marqueur d'état (annulée, archivée…). */
export function MTag({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'danger' }) {
  return (
    <Badge variant={tone === 'danger' ? 'rose' : 'secondary'} className="uppercase tracking-[0.05em]">
      {children}
    </Badge>
  );
}

/* ── Pagination ──────────────────────────────────────────────────── */

export function MPagination({
  page,
  pages,
  rangeLabel,
  total,
  onPage,
}: {
  page: number;
  pages: number;
  rangeLabel: string;
  total: string;
  onPage: (p: number) => void;
}) {
  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-2">
      <span className="text-xs text-muted-foreground">
        <span className={NUM}>{rangeLabel}</span> sur <span className={cn(NUM, 'font-semibold text-foreground')}>{total}</span>
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Page précédente">
          <ChevronLeft />
        </Button>
        <span className={cn('px-2 text-xs', NUM, T.body)}>
          {page} / {pages}
        </span>
        <Button variant="outline" size="icon-sm" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Page suivante">
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

/* ── Formulaire ──────────────────────────────────────────────────── */

export function MField({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs leading-snug text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export const MInput = Input;

/* ── Dialogue ────────────────────────────────────────────────────── */

export function MDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  footer,
  width = 460,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}) {
  // ⌘⏎ / Ctrl+⏎ valide — raccourci conservé de l'ancien dialogue maison.
  React.useEffect(() => {
    if (!open || !onConfirm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onConfirm();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onConfirm]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent style={{ maxWidth: width }}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
        {footer && <DialogFooter className="gap-2 sm:justify-start">{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}

/* ── États ───────────────────────────────────────────────────────── */

export function MEmpty({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <span className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <p className="mt-3 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

/**
 * Chargement — squelettes du design system, pas un rond qui tourne.
 *
 * Un spinner centré ne dit rien de ce qui arrive ; des lignes à la bonne
 * hauteur montrent la table qui se remplit et évitent le saut de mise en page
 * quand les données tombent.
 */
export function MLoading({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="ml-auto h-4 w-24" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

/* ── Icônes ──────────────────────────────────────────────────────────
 *
 * Le module utilise le pack **Phosphor** (celui du fichier Figma). Phosphor
 * expose la graisse du trait en prop plutôt qu'en jeu d'icônes séparé : un
 * seul `IconContext` fixe donc l'aspect pour TOUT le module, au lieu de
 * répéter `weight=` sur chaque appel et de laisser dériver deux écrans.
 *
 * `bold` et non `regular` : à 14-16 px, le trait fin de Phosphor s'efface à
 * côté du texte DM Sans en 600. Les fonds gardent `regular` là où l'icône est
 * décorative (états vides), via une surcharge locale.
 */
export function MIcons({ children }: { children: React.ReactNode }) {
  return (
    <IconContext.Provider value={{ weight: 'bold', size: '1em' }}>
      {children}
    </IconContext.Provider>
  );
}


/* ── Table ───────────────────────────────────────────────────────────
 *
 * Les écrans montaient leurs tables en balises brutes (`<table>`, `<thead>`,
 * `<tr>`) et n'empruntaient au design system que les cellules. Ils passent
 * désormais par la composition complète : bordures, survol, ligne
 * sélectionnée et défilement viennent d'un seul endroit.
 */
export { Table as MTable, TableHeader as MTableHead, TableBody as MTableBody, TableRow as MTableRow };

/* ── Fil d'Ariane ────────────────────────────────────────────────────
 *
 * Sur les pages de détail et de saisie, une flèche « retour » disait qu'on
 * pouvait partir sans dire vers quoi. Le fil d'Ariane nomme le chemin et
 * rend chaque niveau cliquable — c'est ce qui manquait pour circuler dans le
 * module. Construit sur les primitives `Breadcrumb` du design system.
 */
export function MCrumbs({ items }: { items: ReadonlyArray<{ label: string; to?: string }> }) {
  return (
    <Breadcrumb>
      <BreadcrumbList className="text-xs">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <React.Fragment key={`${c.label}-${i}`}>
              <BreadcrumbItem>
                {c.to && !last ? (
                  <BreadcrumbLink asChild>
                    <Link to={c.to}>{c.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{c.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
              {!last && <BreadcrumbSeparator />}
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
