/**
 * Les pièces d'une fiche de classement, communes au client et au commissionnaire :
 * la conversation, les codes proposés par l'IA, le code signé.
 */
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, Bot, Calculator, Scale, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Card, StatusPill, SURFACE, TEXT, TYPE } from '@/mobile/designKit';
import { formatHs } from '@/lib/customs/hsCode';
import {
  CLASSIFICATION_STATUS, candidateRate, type Candidate, type Classification, type ClassificationMessage, type ClassificationStatus,
} from '@/lib/customs/files';

export function ClassificationStatusPill({ status }: { status: ClassificationStatus }) {
  const { t } = useTranslation('customs');
  const meta = CLASSIFICATION_STATUS[status];
  return <StatusPill tone={meta.tone} label={t(`files.status.${status}`, { defaultValue: meta.fr })} />;
}

/** Un code proposé : le code, le libellé, le droit de douane, la confiance, le raisonnement. */
export function CandidateCard({ c, rank, simulateBase }: { c: Candidate; rank: number; simulateBase: string }) {
  const { t } = useTranslation('customs');
  const navigate = useNavigate();
  const pctConf = Math.round(c.confidence * 100);
  return (
    <div className={cn('space-y-2 rounded-lg p-3', rank === 0 ? SURFACE.card : SURFACE.inset, rank === 0 && SURFACE.shadow)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn('text-[20px] font-semibold tabular-nums', TEXT.strong)}>{formatHs(c.code)}</p>
          <p className={cn('text-[15px] leading-snug', TEXT.body)}>{c.title}</p>
          {c.heading && <p className={cn('text-[14px] leading-snug', TEXT.muted)}>{formatHs(c.code.slice(0, 4))} · {c.heading}</p>}
        </div>
        <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-[14px] font-semibold tabular-nums', SURFACE.inset, TEXT.strong)}>{candidateRate(c)}</span>
      </div>
      <div className="flex items-center gap-2" aria-label={t('files.confidence', { pct: pctConf, defaultValue: `Confiance ${pctConf} %` })}>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#E6E6E6] dark:bg-[#444444]">
          {/* Vert : sûr · ambre : à confirmer · gris : piste faible. Jamais de rouge : le rouge est une action. */}
          <div className={cn('h-full rounded-full', pctConf >= 70 ? 'bg-[#14AE5C]' : pctConf >= 40 ? 'bg-[#E8B931]' : 'bg-[#949494]')} style={{ width: `${pctConf}%` }} />
        </div>
        <span className={cn('text-[14px] tabular-nums', TEXT.muted)}>{pctConf} %</span>
      </div>
      {c.reasoning && <p className={cn('text-[15px] leading-snug', TEXT.body)}>{c.reasoning}</p>}
      {c.rules.length > 0 && <p className={cn('text-[14px]', TEXT.muted)}>{c.rules.join(' · ')}</p>}
      <Button size="sm" variant="neutral" onClick={() => navigate(`${simulateBase}?c=${c.code}`)}>
        <Calculator aria-hidden /> {t('files.simulate', { defaultValue: 'Simuler les droits' })}
      </Button>
    </div>
  );
}

/** Le code signé par le commissionnaire agréé : la référence, figée. */
export function SignedCard({ c, simulateBase, onLetter }: { c: Classification; simulateBase: string; onLetter?: () => void }) {
  const { t } = useTranslation('customs');
  const navigate = useNavigate();
  if (!c.final_code) return null;
  const when = c.reviewed_at ? new Date(c.reviewed_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const title = c.candidates.find((x) => x.code === c.final_code!.slice(0, 6))?.title;
  return (
    <Card className="space-y-3 border-[#14AE5C] p-5 dark:border-[#14AE5C]">
      <p className="flex items-center gap-2 text-[16px] font-semibold text-[#009951] dark:text-[#14AE5C]">
        <BadgeCheck aria-hidden className="h-5 w-5" /> {t('files.signedTitle', { defaultValue: 'Code signé par un commissionnaire agréé' })}
      </p>
      <p className={cn('text-[30px] font-semibold leading-none tabular-nums', TEXT.strong)}>{formatHs(c.final_code)}</p>
      {title && <p className={cn(TYPE.body, TEXT.body)}>{title}</p>}
      <p className={cn(TYPE.small, TEXT.muted)}>
        {t('files.signedBy', { company: c.broker_company, license: c.broker_license_no, date: when, defaultValue: `${c.broker_company} · agrément ${c.broker_license_no} · ${when}` })}
      </p>
      {c.broker_note && <p className={cn('rounded-lg p-3 text-[15px] leading-snug', SURFACE.inset, TEXT.body)}>{c.broker_note}</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="primary" className="flex-1" onClick={() => navigate(`${simulateBase}?c=${c.final_code!.slice(0, 6)}`)}>
          <Calculator aria-hidden /> {t('files.simulate', { defaultValue: 'Simuler les droits' })}
        </Button>
        {onLetter && (
          <Button variant="neutral" className="flex-1" onClick={onLetter}>
            <Scale aria-hidden /> {t('files.letterCta', { defaultValue: 'Demande de décision anticipée' })}
          </Button>
        )}
      </div>
    </Card>
  );
}

/** La conversation : le client à droite, l'assistant et le commissionnaire à gauche. */
export function Thread({
  messages, simulateBase, onOption, optionsEnabled, compactProposals = false,
}: {
  messages: ClassificationMessage[];
  simulateBase: string;
  onOption?: (answer: string) => void;
  optionsEnabled?: boolean;
  /** Les codes proposés sont déjà affichés ailleurs sur l'écran : une ligne suffit ici. */
  compactProposals?: boolean;
}) {
  const { t } = useTranslation('customs');
  return (
    <ol className="space-y-3">
      {messages.map((m, i) => {
        if (m.author === 'system') {
          return <li key={m.id} className={cn('text-center text-[14px]', TEXT.muted)}>{m.body}</li>;
        }
        const mine = m.author === 'client';
        const isLast = i === messages.length - 1;
        const options = m.payload?.type === 'question' ? m.payload.options ?? [] : [];
        return (
          <li key={m.id} className={cn('flex gap-2', mine && 'flex-row-reverse')}>
            {!mine && (
              <span className={cn('mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', m.author === 'broker' ? 'bg-[#CFF7D3] text-[#02542D] dark:bg-[#02542D] dark:text-[#CFF7D3]' : SURFACE.holder)}>
                {m.author === 'broker' ? <UserRound className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </span>
            )}
            <div className={cn('min-w-0 max-w-[88%] space-y-2', mine && 'items-end')}>
              {m.author === 'broker' && (
                <p className="text-[13px] font-semibold text-[#009951] dark:text-[#14AE5C]">{t('files.broker', { defaultValue: 'Commissionnaire agréé' })}</p>
              )}
              <div className={cn('whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-[16px] leading-snug',
                mine ? 'bg-[#2C2C2C] text-[#F5F5F5] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]' : cn(SURFACE.card, SURFACE.shadow, TEXT.body))}>
                {m.author === 'broker' && m.payload?.final_code && (m.payload.decision === 'approved' || m.payload.decision === 'changed') && (
                  <p className="mb-1 font-semibold tabular-nums">
                    {t(m.payload.decision === 'changed' ? 'files.brokerChanged' : 'files.brokerApproved', {
                      code: formatHs(m.payload.final_code),
                      defaultValue: `${m.payload.decision === 'changed' ? 'Code retenu' : 'Code validé'} : ${formatHs(m.payload.final_code)}`,
                    })}
                  </p>
                )}
                {m.body}
              </div>
              {m.payload?.type === 'proposal' && m.payload.candidates?.length && compactProposals ? (
                <p className={cn('text-[14px] tabular-nums', TEXT.muted)}>
                  {t('files.proposedCodes', { defaultValue: 'Codes proposés :' })} {m.payload.candidates.map((c) => `${formatHs(c.code)} (${Math.round(c.confidence * 100)} %)`).join(' · ')}
                </p>
              ) : m.payload?.type === 'proposal' && m.payload.candidates?.length ? (
                <div className="space-y-2">
                  {m.payload.candidates.map((c, k) => <CandidateCard key={c.code} c={c} rank={k} simulateBase={simulateBase} />)}
                  {m.payload.missing_facts?.length ? (
                    <p className={cn('text-[14px] leading-snug', TEXT.muted)}>
                      {t('files.missingFacts', { defaultValue: 'Ce qui départagerait :' })} {m.payload.missing_facts.join(' ; ')}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {options.length > 0 && isLast && optionsEnabled && onOption && (
                <div className="flex flex-wrap gap-2">
                  {options.map((o) => (
                    <button key={o} type="button" onClick={() => onOption(o)}
                      className="min-h-11 rounded-lg border border-[#2C2C2C] px-3 text-[15px] font-semibold text-[#1E1E1E] active:bg-[#F5F5F5] dark:border-[#E3E3E3] dark:text-[#F5F5F5] dark:active:bg-[#383838]">
                      {o}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** La bulle « l'assistant cherche dans le tarif… ». */
export function ThinkingBubble() {
  const { t } = useTranslation('customs');
  return (
    <div className="flex gap-2" role="status" aria-live="polite">
      <span className={cn('mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', SURFACE.holder)}><Bot className="h-4 w-4" /></span>
      <div className={cn('flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-[15px]', SURFACE.card, SURFACE.shadow, TEXT.muted)}>
        <span className="flex gap-1" aria-hidden>
          {[0, 1, 2].map((k) => <span key={k} className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: `${k * 120}ms` }} />)}
        </span>
        {t('files.thinking', { defaultValue: 'L’assistant cherche dans le tarif…' })}
      </div>
    </div>
  );
}
