/**
 * Une MATRICE DE CROISSANCE : « semaine après semaine », « mois après mois ».
 *
 * Elle répond à une question que le reste du tableau de bord ne pose pas.
 * « Flux financier » et « Croissance des dépôts » montrent le volume SUR LA
 * PÉRIODE CHOISIE ; ici on demande le rythme : est-ce que cette semaine fait
 * mieux que la précédente, et est-ce que ça dure ? D'où une fenêtre propre
 * (douze semaines ou douze mois, `growthWindow`) que le sélecteur du haut ne
 * pilote pas.
 *
 * UN SEUL ENCODAGE : des barres. Le graphique clients d'avant superposait des
 * barres (les nouveaux) et une courbe (le total) sur deux axes ; retour
 * utilisateur : « je ne comprends pas ce graphique, il a une ligne et aussi
 * des barres dedans ». La leçon vaut pour toute cette famille — une question,
 * une forme. La variation d'une période à l'autre, elle, n'est pas une
 * seconde série : c'est une ÉTIQUETTE posée sur la barre.
 *
 * La dernière période est EN COURS, donc incomplète. Elle est dessinée en
 * clair et ne porte pas d'étiquette de variation : une semaine à son deuxième
 * jour afficherait « −70 % » et ce serait un mensonge. Les chiffres de tête
 * comparent, eux, les deux dernières périodes COMPLÈTES.
 *
 * Une période VIDE ne porte pas d'étiquette non plus, pour une autre raison :
 * sa barre a une hauteur nulle, et le « −100 % » se posait sur la ligne de
 * base, orphelin.
 */
import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  Cell,
  LabelList,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';
import { formatInteger } from '@/components/analytics';
import { bucketAxisLabel, bucketLabel, type DateRange } from '@/lib/analytics/dateRange';
import {
  GROWTH_MODE_LABELS,
  GROWTH_MODE_NOUN,
  GROWTH_MODE_PHRASE,
  GROWTH_MODE_TEXT,
  type GrowthMode,
} from '@/lib/analytics/growthWindow';
import { NUM, LABEL, TONE, Block, ChartSkeleton, EmptyBlock, DeltaBadge } from './dashboardKit';

/** Un point brut, tel que les hooks d'analyse le livrent. */
export interface GrowthInput {
  bucket: string;
  value: number;
}

export interface GrowthBucket {
  bucket: string;
  /** « S36 », « Sep 26 » — l'étiquette complète, pour l'infobulle. */
  label: string;
  /** L'étiquette de l'axe, plus courte quand le contexte est déjà donné. */
  axisLabel: string;
  value: number;
  /** Variation par rapport à la période précédente. `null` = rien à comparer. */
  deltaPct: number | null;
  /** La dernière période : commencée, pas finie. */
  isCurrent: boolean;
}

/**
 * Pure : des points aux barres, avec la variation d'une période à l'autre.
 *
 * Le dernier seau est marqué « en cours ». Une division par une période
 * précédente NULLE ne donne pas « +∞ » mais `null` : on n'affiche alors rien
 * plutôt qu'un pourcentage qui n'existe pas.
 */
export function buildGrowthBuckets(points: ReadonlyArray<GrowthInput>, range: DateRange): GrowthBucket[] {
  return points.map((p, i) => {
    const previous = i === 0 ? null : points[i - 1].value;
    const bucket = new Date(p.bucket);
    return {
      bucket: p.bucket,
      label: bucketLabel(bucket, range.granularity),
      axisLabel: bucketAxisLabel(bucket, range.granularity, range),
      value: p.value,
      deltaPct: previous === null || previous === 0 ? null : (p.value - previous) / previous,
      isCurrent: i === points.length - 1,
    };
  });
}

export interface GrowthSummary {
  /** La dernière période TERMINÉE — celle sur laquelle on peut conclure. */
  lastComplete: GrowthBucket | null;
  /** La période en cours, pour information. */
  current: GrowthBucket | null;
  /** Moyenne sur les périodes terminées. */
  average: number | null;
  /** La meilleure période terminée. */
  best: GrowthBucket | null;
}

/** Pure : les chiffres de tête. Ne considère que les périodes TERMINÉES. */
export function summarizeGrowth(buckets: ReadonlyArray<GrowthBucket>): GrowthSummary {
  const complete = buckets.filter((b) => !b.isCurrent);
  const current = buckets.find((b) => b.isCurrent) ?? null;
  if (complete.length === 0) {
    return { lastComplete: null, current, average: null, best: null };
  }
  const total = complete.reduce((s, b) => s + b.value, 0);
  let best = complete[0];
  for (const b of complete) if (b.value > best.value) best = b;
  return {
    lastComplete: complete[complete.length - 1],
    current,
    average: total / complete.length,
    best: best.value > 0 ? best : null,
  };
}

/**
 * Le complément de variation de l'infobulle : « · +12,4 % vs semaine
 * précédente », ou rien.
 *
 * Fonction PURE et exportée, à dessein. Écrite en ligne dans le `formatter`
 * de Recharts, elle était intestable — aucune infobulle ne se rend en jsdom,
 * faute de mise en page — et c'est là qu'une faute d'accord (« vs mois
 * précédente ») a survécu à la correction des autres libellés.
 */
export function growthDeltaPhrase(bucket: GrowthBucket, mode: GrowthMode): string {
  if (bucket.isCurrent || bucket.deltaPct === null) return '';
  const pct = (bucket.deltaPct * 100).toFixed(1).replace('.', ',');
  const sign = bucket.deltaPct > 0 ? '+' : '';
  return ` · ${sign}${pct} % ${GROWTH_MODE_TEXT[mode].vsPreviousShort}`;
}

function HeadStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <div className={LABEL}>{label}</div>
      <div className={cn('mt-0.5 truncate text-[13px] font-semibold text-foreground', NUM)}>{value}</div>
      {hint && <div className="truncate text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

/** Le sélecteur de pas, dans l'en-tête du bloc. */
function ModeSwitch({ value, onChange }: { value: GrowthMode; onChange: (m: GrowthMode) => void }) {
  return (
    <div className="inline-flex rounded-md border border-border p-0.5" role="group" aria-label="Pas de la croissance">
      {(['week', 'month'] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          aria-pressed={value === m}
          className={cn(
            'rounded-[5px] px-2.5 py-1 text-[11.5px] font-semibold transition-colors',
            value === m ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {GROWTH_MODE_LABELS[m]}
        </button>
      ))}
    </div>
  );
}

/** « +12,4 % » au-dessus d'une barre. Rien sur la période en cours. */
function DeltaLabel({
  x,
  y,
  width,
  index,
  buckets,
}: {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  index?: number;
  buckets: ReadonlyArray<GrowthBucket>;
}) {
  const bucket = index === undefined ? undefined : buckets[index];
  if (!bucket || bucket.isCurrent || bucket.deltaPct === null) return null;
  // Une barre à zéro n'a pas de hauteur : son étiquette se poserait sur la
  // ligne de base, sans rien au-dessous. « −100 % » y ressemblait à un bogue
  // d'affichage. L'absence de barre dit déjà que la période est vide.
  if (bucket.value === 0) return null;
  const positive = bucket.deltaPct > 0;
  // L'étiquette est arrondie à l'entier : sous un demi-point, « +0 % » serait
  // à la fois faux (ce n'est pas zéro) et illisible. On écrit « = ».
  const flat = Math.abs(bucket.deltaPct) < 0.005;
  return (
    <text
      x={Number(x) + Number(width) / 2}
      y={Number(y) - 6}
      textAnchor="middle"
      className={cn('text-[10px] font-bold', NUM)}
      fill={flat ? 'hsl(var(--muted-foreground))' : positive ? '#059669' : '#DC2626'}
    >
      {flat ? '=' : `${positive ? '+' : ''}${(bucket.deltaPct * 100).toFixed(0)} %`}
    </text>
  );
}

export function GrowthMatrixBlock({
  title,
  description,
  mode,
  onModeChange,
  buckets,
  loading,
  color,
  /** Met en forme une valeur — entier pour des clients, montant pour du XAF. */
  format,
  /** « nouveaux clients », « de dépôts »… — ce que la barre compte. */
  unit,
  height = 280,
}: {
  title: string;
  description: string;
  mode: GrowthMode;
  onModeChange: (mode: GrowthMode) => void;
  buckets: ReadonlyArray<GrowthBucket>;
  loading: boolean;
  color: string;
  format: (value: number) => string;
  unit: string;
  height?: number;
}) {
  const summary = useMemo(() => summarizeGrowth(buckets), [buckets]);
  const noun = GROWTH_MODE_NOUN[mode];
  const text = GROWTH_MODE_TEXT[mode];
  const empty = buckets.length === 0 || buckets.every((b) => b.value === 0);

  return (
    <Block
      title={title}
      description={`${description} · ${GROWTH_MODE_PHRASE[mode]}, sur ${buckets.length || 12} ${text.plural}`}
      toolbar={<ModeSwitch value={mode} onChange={onModeChange} />}
    >
      {loading ? (
        <ChartSkeleton height={height} />
      ) : empty ? (
        <EmptyBlock height={height}>Aucun mouvement sur les douze dernières périodes.</EmptyBlock>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-4 border-b border-border pb-3 sm:grid-cols-4">
            <HeadStat
              label={text.lastComplete}
              value={summary.lastComplete ? format(summary.lastComplete.value) : '—'}
              hint={summary.lastComplete?.axisLabel}
            />
            <div className="min-w-0">
              <div className={LABEL}>Variation</div>
              <div className="mt-0.5">
                {summary.lastComplete?.deltaPct != null ? (
                  <DeltaBadge value={summary.lastComplete.deltaPct} />
                ) : (
                  <span className={cn('text-[13px] font-semibold text-muted-foreground', NUM)}>—</span>
                )}
              </div>
              <div className="truncate text-[11px] text-muted-foreground">{text.vsPrevious}</div>
            </div>
            <HeadStat
              label={`Moyenne par ${noun}`}
              value={summary.average != null ? format(Math.round(summary.average)) : '—'}
              hint="périodes terminées"
            />
            <HeadStat
              label="Meilleure période"
              value={summary.best ? format(summary.best.value) : '—'}
              hint={summary.best?.axisLabel}
            />
          </div>

          <ResponsiveContainer width="100%" height={height}>
            {/* `top: 24` laisse la place aux étiquettes de variation, qui se
                posent AU-DESSUS des barres — sans marge, celle du maximum
                sortait du cadre. */}
            <BarChart data={buckets as GrowthBucket[]} margin={{ top: 24, right: 8, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="axisLabel"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={12}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(v) => formatInteger(Number(v))}
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                width={96}
              />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
                contentStyle={{
                  background: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                labelFormatter={(_, payload) => {
                  const b = payload?.[0]?.payload as GrowthBucket | undefined;
                  if (!b) return '';
                  return b.isCurrent ? `${b.label} · en cours` : b.label;
                }}
                formatter={(value, _name, item) => {
                  const b = item?.payload as GrowthBucket | undefined;
                  return [`${format(Number(value))}${b ? growthDeltaPhrase(b, mode) : ''}`, unit];
                }}
              />
              <Bar dataKey="value" name={unit} radius={[3, 3, 0, 0]} maxBarSize={44}>
                {buckets.map((b) => (
                  // La période en cours est PÂLE : on la voit, on ne la
                  // compare pas.
                  <Cell key={b.bucket} fill={color} fillOpacity={b.isCurrent ? 0.35 : 1} />
                ))}
                <LabelList
                  dataKey="value"
                  content={(props) => <DeltaLabel {...props} buckets={buckets} />}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {summary.current && (
            <p className={cn('mt-2 text-[11.5px]', TONE.neutral, 'text-muted-foreground')}>
              La dernière barre ({summary.current.label}) {text.currentIs} : elle n'est pas terminée, donc elle ne
              porte pas de variation.
            </p>
          )}
        </>
      )}
    </Block>
  );
}
