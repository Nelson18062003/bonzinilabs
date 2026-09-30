/**
 * Le résultat d'une simulation, dans l'ordre où on le lit :
 *   1. le montant à payer à la douane (gros, seul) ;
 *   2. où va l'argent (une barre, quatre familles) ;
 *   3. ce qui change la décision (à savoir, pour ne pas payer plus) ;
 *   4. le détail de la DAU et la valeur taxée — repliés.
 * Vert : texte officiel ou vérifié sur une vraie DAU ; ambre : estimé.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { AlertTriangle, BellRing, ChevronRight, Info, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LEVIES } from '@/lib/customs/levies';
import type { LiquidationLine, Simulation } from '@/lib/customs/engine';
import type { TariffLine } from '@/lib/customs/nomenclature';
import { noticeMatchesCode, phaseOf, type Notice } from '@/lib/customs/notices';
import { useCustomsNotices } from '@/hooks/useCustomsNotices';
import { useAdminNotices } from '@/hooks/useCustomsReview';
import { isSure, pct, ratePct, xaf } from '../../format';
import { useLevyLabel, useNoteText } from '../../useCustomsText';
import { CountUp, Disclosure } from '../ui';
import { dauGroups } from './groups';
import { EASE } from '../styles';

function lineSure(l: LiquidationLine, sim: Simulation, tariff: TariffLine): boolean {
  if (l.code === 'DDI') return tariff.rateHow === 0 && tariff.rateMin === tariff.rateMax;
  if (l.code === 'DAC') return isSure(sim.excise.confidence) && sim.excise.certainty === 'sure';
  if (l.code === 'TVA' || l.code === 'CAC') return sim.vat.exempt !== 'maybe';
  return isSure(LEVIES[l.code].confidence);
}

const Dot = ({ sure }: { sure: boolean }) => (
  <span aria-hidden className={cn('mt-[7px] h-2 w-2 shrink-0 rounded-full', sure ? 'bg-dz-good' : 'bg-dz-gold')} />
);

/** Les quatre familles de la barre : ce que le client comprend d'un coup d'œil. */
function Breakdown({ sim }: { sim: Simulation }) {
  const { t } = useTranslation('customs');
  const total = sim.dau.total || 1;
  const parts = dauGroups(sim);
  return (
    <div className="space-y-3">
      <div className="flex h-2.5 gap-1 overflow-hidden rounded-full">
        {parts.map((p) => (
          <motion.span key={p.key} className={cn('h-full rounded-full', p.color)}
            initial={{ width: 0 }} animate={{ width: `${(p.amount / total) * 100}%` }} transition={{ duration: 0.6, ease: EASE }} />
        ))}
      </div>
      <ul className="space-y-1.5 text-[15px]">
        {parts.map((p) => (
          <li key={p.key} className="flex min-w-0 items-center gap-2">
            <span aria-hidden className={cn('h-2 w-2 shrink-0 rounded-full', p.color)} />
            <span className="min-w-0 opacity-75">{t(`site.sim.group.${p.key}`)}</span>
            <span className="ml-auto shrink-0 whitespace-nowrap font-bold tabular-nums">{xaf(p.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LevyRows({ lines, sim, tariff }: { lines: LiquidationLine[]; sim: Simulation; tariff: TariffLine }) {
  const { t } = useTranslation('customs');
  const label = useLevyLabel();
  return (
    <ul>
      {lines.map((l) => {
        const rate = l.rate == null ? t('sim.fixed') : l.code === 'TVA' && l.rate === 0 ? t('sim.exempt') : ratePct(l.rate);
        const note = l.code === 'DAC' && sim.excise.rate > 0 ? sim.excise.basis.split(' — ')[0] : l.code === 'PRE' ? t('sim.creditable') : undefined;
        return (
          <li key={l.code} className="flex items-start gap-3 border-b border-dz-line py-2.5 last:border-b-0">
            <Dot sure={sim.dau.lines.includes(l) ? lineSure(l, sim, tariff) : isSure(LEVIES[l.code].confidence)} />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium leading-snug text-dz-ink">{label(l)}</span>
              <span className="block text-[14px] leading-snug text-dz-ink3">{rate}{note ? ` · ${note}` : ''}</span>
            </span>
            <span className="shrink-0 whitespace-nowrap text-[15px] font-semibold tabular-nums text-dz-ink">{xaf(l.amount)}</span>
          </li>
        );
      })}
    </ul>
  );
}

function CodeNews({ code, admin }: { code: string; admin: boolean }) {
  const { t } = useTranslation('customs');
  const pub = useCustomsNotices(!admin);
  const adm = useAdminNotices(admin);
  const list: Notice[] = (admin ? adm.data : pub.data) ?? [];
  const hits = list.filter((n) => n.published && n.kind === 'regulation' && phaseOf(n) !== 'past' && noticeMatchesCode(n, code));
  if (!hits.length) return null;
  const base = admin ? '/m/douane/veille' : '/douane/veille';
  return (
    <div className="rounded-3xl bg-dz-card">
      <p className="flex items-center gap-2 px-4 pt-4 text-[15px] font-semibold text-dz-ink">
        <BellRing aria-hidden className="h-[18px] w-[18px] text-dz-brand" /> {t('watch.onCode', { count: hits.length })}
      </p>
      <ul className="px-2 pb-2 pt-1">
        {hits.map((n) => (
          <li key={n.id}>
            <Link to={`${base}#${n.slug}`} className="flex min-h-11 items-center gap-3 rounded-xl px-2 py-2 text-[15px] leading-snug text-dz-ink2 hover:bg-dz-soft">
              <span className="min-w-0 flex-1">{n.title}</span>
              <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-dz-ink3" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SimResult({ sim, tariff, admin = false }: { sim: Simulation; tariff: TariffLine; admin?: boolean }) {
  const { t } = useTranslation('customs');
  const noteText = useNoteText();
  // Ce qui change la décision reste à l'écran ; le reste (« à savoir ») se replie avec le détail.
  const warnings = sim.notes.filter((n) => n.kind === 'warning');
  const infos = sim.notes.filter((n) => n.kind === 'info');
  const actions = sim.notes.filter((n) => n.kind === 'action');
  const outsideTotal = sim.outside.reduce((n, l) => n + l.amount, 0);

  return (
    <div className="space-y-4">
      {/* Le chiffre, seul. */}
      <div className="rounded-3xl bg-dz-primary p-6 text-dz-on-primary sm:p-7">
        <p className="text-[15px] font-medium opacity-70">{t('sim.headline')}</p>
        <p className="mt-2 text-[40px] font-bold leading-none tracking-[-0.03em] sm:text-[46px]">
          <CountUp value={sim.dau.total} format={xaf} />
        </p>
        <p className="mt-3 text-[15px] opacity-70">{t('sim.sharePct', { pct: pct(sim.effectiveRate) })}</p>
        <div className="mt-6"><Breakdown sim={sim} /></div>
        <dl className="mt-6 space-y-2 border-t border-dz-on-primary/15 pt-4 text-[15px]">
          {outsideTotal > 0 && (
            <div className="flex items-baseline justify-between gap-4">
              <dt className="opacity-70">{t('site.sim.withOutside')}</dt>
              <dd className="shrink-0 whitespace-nowrap font-semibold tabular-nums">{xaf(sim.totalToPay)}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between gap-4">
            <dt className="opacity-70">{t('sim.landed')}</dt>
            <dd className="shrink-0 whitespace-nowrap font-semibold tabular-nums">{xaf(sim.landedXaf)}</dd>
          </div>
        </dl>
      </div>

      {actions.length > 0 && (
        <div className="rounded-2xl bg-dz-brand-soft p-4">
          <p className="flex items-center gap-2 text-[15px] font-semibold text-dz-brand"><ShieldCheck aria-hidden className="h-[18px] w-[18px]" /> {t('sim.notesAction')}</p>
          <ul className="mt-2 space-y-2">
            {actions.map((n) => <li key={n.id} className="text-[15px] leading-snug text-dz-ink">{noteText(n)}</li>)}
          </ul>
        </div>
      )}
      {warnings.length > 0 && (
        <ul className="space-y-2">
          {warnings.map((n, i) => (
            <li key={`${n.id}-${i}`} className="flex gap-3 rounded-2xl bg-dz-warn-soft p-4">
              <AlertTriangle aria-hidden className="mt-0.5 h-[18px] w-[18px] shrink-0 text-dz-warn" />
              <span className="text-[15px] leading-snug text-dz-ink">{noteText(n)}</span>
            </li>
          ))}
        </ul>
      )}

      <CodeNews code={tariff.code} admin={admin} />

      <div className="rounded-3xl bg-dz-card px-4 sm:px-5">
        <Disclosure title={t('sim.dauTitle')} meta={t('site.sim.lines', { count: sim.dau.lines.length })} className="border-b border-dz-line">
          <LevyRows lines={sim.dau.lines} sim={sim} tariff={tariff} />
          <div className="flex justify-between gap-3 border-t border-dz-line pt-2.5 text-[15px] font-semibold">
            <span>{t('sim.total')}</span><span className="tabular-nums">{xaf(sim.dau.total)}</span>
          </div>
          {sim.outside.length > 0 && (
            <div className="mt-5">
              <p className="text-[14px] font-semibold uppercase tracking-[0.08em] text-dz-ink3">{t('sim.outsideTitle')}</p>
              <LevyRows lines={sim.outside} sim={sim} tariff={tariff} />
            </div>
          )}
          <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-dz-ink3">
            <span className="inline-flex items-center gap-2"><Dot sure /> {t('sim.legendSure')}</span>
            <span className="inline-flex items-center gap-2"><Dot sure={false} /> {t('sim.legendEstimate')}</span>
          </p>
        </Disclosure>
        {infos.length > 0 && (
          <Disclosure title={t('sim.notesWarn')} meta={String(infos.length)} className="border-b border-dz-line">
            <ul className="space-y-3">
              {infos.map((n, i) => (
                <li key={`${n.id}-${i}`} className="flex gap-3 text-[15px] leading-snug text-dz-ink2">
                  <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-dz-ink3" />{noteText(n)}
                </li>
              ))}
            </ul>
          </Disclosure>
        )}
        <Disclosure title={t('sim.valueTitle')} meta={xaf(sim.customsValue)}>
          <dl className="space-y-1.5 text-[15px]">
            {[
              [t('sim.goods'), sim.goodsXaf],
              [t('sim.freightLine'), sim.freightXaf],
              [sim.insuranceEstimated ? t('sim.insuranceEstimated') : t('sim.insuranceLine'), sim.insuranceXaf],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between gap-3">
                <dt className="text-dz-ink3">{k}</dt><dd className="tabular-nums text-dz-ink2">{xaf(Number(v))}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-3 border-t border-dz-line pt-2 font-semibold">
              <dt>{t('sim.customsValue')}</dt><dd className="tabular-nums">{xaf(sim.customsValue)}</dd>
            </div>
          </dl>
        </Disclosure>
      </div>
    </div>
  );
}
