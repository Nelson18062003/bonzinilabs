/**
 * La conversation d'une fiche de classement, côté site (le commissionnaire
 * garde la version de l'espace équipe, components/ClassificationParts.tsx).
 * Bulles blanches pour l'assistant et le commissionnaire, noires pour le
 * client ; chaque code proposé dans une carte, la confiance en barre.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { BadgeCheck, Calculator } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatHs } from '@/lib/customs/hsCode';
import { candidateRate, type Candidate, type ClassificationMessage } from '@/lib/customs/files';
import { EASE } from '../styles';

function CodeCard({ c, first, simulateBase }: { c: Candidate; first: boolean; simulateBase: string }) {
  const { t } = useTranslation('customs');
  const conf = Math.round(c.confidence * 100);
  return (
    <div className={cn('rounded-3xl p-5', first ? 'bg-dz-card ring-2 ring-dz-ink' : 'bg-dz-card')}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[24px] font-black leading-none tracking-[-0.02em] tabular-nums text-dz-ink">{formatHs(c.code)}</p>
          <p className="mt-1.5 text-[16px] font-bold leading-snug text-dz-ink">{c.title}</p>
          {c.heading && <p className="mt-0.5 text-[14px] font-medium leading-snug text-dz-ink3">{formatHs(c.code.slice(0, 4))} · {c.heading}</p>}
        </div>
        <span className="shrink-0 rounded-full bg-dz-soft px-3 py-1 text-[14px] font-bold tabular-nums text-dz-ink">{candidateRate(c)}</span>
      </div>
      <div className="mt-4 flex items-center gap-3" aria-label={t('files.confidence', { pct: conf })}>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-dz-soft">
          <motion.div className={cn('h-full rounded-full', conf >= 70 ? 'bg-dz-good' : conf >= 40 ? 'bg-dz-gold' : 'bg-dz-ink3/50')}
            initial={{ width: 0 }} animate={{ width: `${conf}%` }} transition={{ duration: 0.7, ease: EASE }} />
        </div>
        <span className="text-[14px] font-bold tabular-nums text-dz-ink3">{conf} %</span>
      </div>
      {c.reasoning && <p className="mt-4 text-[15px] font-medium leading-relaxed text-dz-ink2">{c.reasoning}</p>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {c.rules.length > 0 && <p className="text-[14px] font-medium text-dz-ink3">{c.rules.join(' · ')}</p>}
        <Link to={`${simulateBase}?c=${c.code.slice(0, 6)}`}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-dz-soft px-4 text-[14px] font-bold text-dz-ink transition-colors hover:bg-dz-fill">
          <Calculator aria-hidden className="h-4 w-4" /> {t('files.simulate')}
        </Link>
      </div>
    </div>
  );
}

export function Conversation({ messages, simulateBase, onOption, optionsEnabled }: {
  messages: ClassificationMessage[];
  simulateBase: string;
  onOption?: (answer: string) => void;
  optionsEnabled?: boolean;
}) {
  const { t } = useTranslation('customs');
  return (
    <ol className="space-y-4">
      {messages.map((m, i) => {
        if (m.author === 'system') {
          return <li key={m.id} className="py-1 text-center text-[14px] font-medium text-dz-ink3">{m.body}</li>;
        }
        const mine = m.author === 'client';
        const broker = m.author === 'broker';
        const isLast = i === messages.length - 1;
        const options = m.payload?.type === 'question' ? m.payload.options ?? [] : [];
        const decided = broker && m.payload?.final_code && (m.payload.decision === 'approved' || m.payload.decision === 'changed');
        return (
          <motion.li key={m.id} className={cn('flex flex-col gap-2', mine ? 'items-end' : 'items-start')}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }}>
            <p className={cn('px-1 text-[13px] font-bold', broker ? 'text-dz-good' : 'text-dz-ink3')}>
              {mine ? t('site.classify.you') : broker ? t('files.broker') : t('site.classify.assistant')}
            </p>
            <div className={cn('max-w-[88%] whitespace-pre-line rounded-[22px] px-4 py-3 text-[16px] font-medium leading-snug',
              mine ? 'rounded-br-md bg-dz-primary text-dz-on-primary' : 'rounded-bl-md bg-dz-card text-dz-ink', broker && 'ring-2 ring-dz-good')}>
              {decided && (
                <p className="mb-1 flex items-center gap-1.5 font-black tabular-nums">
                  <BadgeCheck aria-hidden className="h-4 w-4 text-dz-good" />
                  {t(m.payload!.decision === 'changed' ? 'files.brokerChanged' : 'files.brokerApproved', { code: formatHs(m.payload!.final_code!) })}
                </p>
              )}
              {m.body}
            </div>
            {m.payload?.type === 'proposal' && m.payload.candidates?.length ? (
              <div className="w-full max-w-[88%] space-y-2">
                {m.payload.candidates.map((c, k) => <CodeCard key={c.code} c={c} first={k === 0} simulateBase={simulateBase} />)}
                {m.payload.missing_facts?.length ? (
                  <p className="px-1 text-[14px] font-medium leading-snug text-dz-ink3">{t('files.missingFacts')} {m.payload.missing_facts.join(' ; ')}</p>
                ) : null}
              </div>
            ) : null}
            {options.length > 0 && isLast && optionsEnabled && onOption && (
              <div className="flex max-w-[88%] flex-wrap gap-2">
                {options.map((o) => (
                  <button key={o} type="button" onClick={() => onOption(o)}
                    className="h-11 rounded-full bg-dz-card px-4 text-[15px] font-bold text-dz-ink ring-1 ring-dz-ink/15 transition-colors hover:bg-dz-primary hover:text-dz-on-primary">
                    {o}
                  </button>
                ))}
              </div>
            )}
          </motion.li>
        );
      })}
    </ol>
  );
}

/** La bulle « l'assistant cherche dans le tarif… ». */
export function Thinking() {
  const { t } = useTranslation('customs');
  return (
    <div className="flex flex-col items-start gap-2" role="status" aria-live="polite">
      <p className="px-1 text-[13px] font-bold text-dz-ink3">{t('site.classify.assistant')}</p>
      <div className="flex items-center gap-2.5 rounded-[22px] rounded-bl-md bg-dz-card px-4 py-3 text-[15px] font-medium text-dz-ink3">
        <span className="flex gap-1" aria-hidden>
          {[0, 1, 2].map((k) => <span key={k} className="h-1.5 w-1.5 animate-bounce rounded-full bg-dz-violet" style={{ animationDelay: `${k * 120}ms` }} />)}
        </span>
        {t('files.thinking')}
      </div>
    </div>
  );
}
