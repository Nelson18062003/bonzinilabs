// ============================================================
// ESPACE COMMERCIAL — un prospect, lu section par section : identité,
// numéros, activité, ses plus gros problèmes (mis en valeur), comment
// l'aider (et ce qui l'intéresse), la suite. Les mêmes sections servent au récapitulatif de
// l'assistant (depuis le brouillon) et à la fiche (depuis la base) ;
// « Modifier » rouvre l'étape correspondante.
// ============================================================
import type { ReactNode } from 'react';
import { AlarmClock, Mail, MessageCircle, Phone, Plane, Ship, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatBirthDate, genderLabel } from '@/lib/people';
import { INTERESTS, whatsappLink, type Interest } from '@/lib/sales';
import { formatE164ForDisplay } from '@/components/form/PhoneNumberInput';
import { PhoneNumber } from './SalesBits';
import { DetailRow, SectionCard } from './SalesUi';
import { btn } from './uiClasses';
import { birthIso, canonicalCity, cleanFreeText, type ProspectDraft, type StepId } from './prospectDraft';
import { fmtWeekday } from './salesHelpers';

type OnEdit = ((step: StepId) => void) | undefined;

const ROWS = 'border-t border-[hsl(var(--s-line))] s-divide';

export function IdentitySection({ d, onEdit, delay }: { d: ProspectDraft; onEdit: OnEdit; delay?: number }) {
  const iso = birthIso(d.birth);
  return (
    <SectionCard title="Identité" onEdit={onEdit && (() => onEdit('who'))} editLabel="Modifier l’identité" delay={delay}>
      <dl className={ROWS}>
        <DetailRow label="Prénom(s)">{d.firstName.trim()}</DetailRow>
        <DetailRow label="Nom">{d.lastName.trim()}</DetailRow>
        <DetailRow label="Sexe">{genderLabel(d.gender)}</DetailRow>
        <DetailRow label="Naissance">{iso ? formatBirthDate(iso) : null}</DetailRow>
      </dl>
    </SectionCard>
  );
}

export interface ContactNumber {
  e164: string;
  label: string | null;
  main: boolean;
}

/** Les numéros (le principal d'abord) et l'email ; sur la fiche, Appeler et WhatsApp pour CHACUN. */
export function ContactSection({
  numbers,
  email,
  actions,
  onEdit,
  delay,
  title = 'Pour le joindre',
}: {
  numbers: ContactNumber[];
  email: string;
  actions?: boolean;
  onEdit: OnEdit;
  delay?: number;
  title?: string;
}) {
  return (
    <SectionCard title={title} onEdit={onEdit && (() => onEdit('reach'))} editLabel="Modifier les numéros et l’email" delay={delay}>
      <ul className={ROWS}>
        {numbers.map((n) => {
          const shown = formatE164ForDisplay(n.e164);
          return (
            <li key={n.e164} className="flex items-center gap-3 py-3 pl-4 pr-3 sm:pl-5">
              <div className="min-w-0 flex-1">
                <PhoneNumber e164={n.e164} className="text-[16px] font-semibold s-ink" />
                <div className="mt-0.5 truncate text-[13px] s-ink-2">{n.main ? 'Numéro principal' : n.label || 'Autre numéro'}</div>
              </div>
              {actions && (
                <div className="flex shrink-0 items-center gap-2">
                  <a href={`tel:${n.e164}`} aria-label={`Appeler le ${shown}`} className={btn('quiet', 'icon')}>
                    <Phone className="h-[18px] w-[18px]" aria-hidden />
                  </a>
                  <a href={whatsappLink(n.e164)} target="_blank" rel="noreferrer" aria-label={`WhatsApp : ${shown}`} className={btn('whatsapp', 'icon')}>
                    <MessageCircle className="h-[18px] w-[18px]" aria-hidden />
                  </a>
                </div>
              )}
            </li>
          );
        })}
        <li className="flex items-center gap-3 py-3 pl-4 pr-3 sm:pl-5">
          <Mail className="h-4 w-4 shrink-0 s-ink-3" aria-hidden />
          <span className={cn('min-w-0 flex-1 truncate text-[15px]', email ? 'font-medium s-ink' : 's-ink-3')}>{email || 'Pas d’email'}</span>
          {actions && email && (
            <a href={`mailto:${email}`} aria-label={`Écrire à ${email}`} className={btn('quiet', 'icon')}>
              <Mail className="h-[18px] w-[18px]" aria-hidden />
            </a>
          )}
        </li>
      </ul>
    </SectionCard>
  );
}

export function ActivitySection({ d, onEdit, delay }: { d: ProspectDraft; onEdit: OnEdit; delay?: number }) {
  return (
    <SectionCard title="Activité" onEdit={onEdit && (() => onEdit('business'))} editLabel="Modifier l’activité" delay={delay}>
      <dl className={ROWS}>
        <DetailRow label="Ville">{canonicalCity(d.city)}</DetailRow>
        <DetailRow label="Entreprise">{d.company.trim()}</DetailRow>
      </dl>
    </SectionCard>
  );
}

const INTEREST_ICON: Record<Interest, typeof Wallet> = { payments: Wallet, air: Plane, sea: Ship };

/** Ce qui le bloque, avec ses mots : mis en valeur d'un filet violet. */
export function NeedsSection({ d, onEdit, delay }: { d: ProspectDraft; onEdit: OnEdit; delay?: number }) {
  const pain = cleanFreeText(d.painPoints);
  return (
    <SectionCard title="Ses plus gros problèmes" onEdit={onEdit && (() => onEdit('needs'))} editLabel="Modifier ses problèmes" delay={delay}>
      <div className="border-t border-[hsl(var(--s-line))] px-4 pb-4 pt-3.5 sm:px-5">
        {pain ? (
          <p className="s-quote whitespace-pre-line rounded-[12px] py-3 pl-4 pr-3 text-[15px] leading-relaxed s-ink">{pain}</p>
        ) : (
          <p className="text-[15px] s-ink-3">Pas encore noté.</p>
        )}
      </div>
    </SectionCard>
  );
}

/** Ce que nous pouvons faire pour lui, et ce qui l'intéresse chez Bonzini. */
export function HelpSection({ d, onEdit, delay }: { d: ProspectDraft; onEdit: OnEdit; delay?: number }) {
  const help = cleanFreeText(d.helpNeeded);
  return (
    <SectionCard title="Comment l’aider" onEdit={onEdit && (() => onEdit('help'))} editLabel="Modifier comment l’aider" delay={delay}>
      <div className="space-y-4 border-t border-[hsl(var(--s-line))] px-4 pb-4 pt-3.5 sm:px-5">
        <Block label="Ce que nous pouvons faire">
          <p className={cn('whitespace-pre-line text-[15px] leading-relaxed', help ? 's-ink' : 's-ink-3')}>{help || 'Pas encore noté.'}</p>
        </Block>
        <Block label="Ce qui l’intéresse">
          {d.interests.length ? (
            <div className="flex flex-wrap gap-1.5">
              {INTERESTS.filter((i) => d.interests.includes(i.value)).map((i) => {
                const Icon = INTEREST_ICON[i.value];
                return (
                  <span key={i.value} className="s-tag inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium">
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    {i.label}
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="text-[15px] s-ink-3">Rien de précis.</p>
          )}
        </Block>
      </div>
    </SectionCard>
  );
}

export function NextSection({ d, onEdit, delay, due }: { d: ProspectDraft; onEdit: OnEdit; delay?: number; due?: boolean }) {
  return (
    <SectionCard title="La suite" onEdit={onEdit && (() => onEdit('next'))} editLabel="Modifier la relance et les notes" delay={delay}>
      <div className="space-y-4 border-t border-[hsl(var(--s-line))] px-4 pb-4 pt-3.5 sm:px-5">
        <Block label="Prochaine relance">
          {d.followUp ? (
            <p className={cn('inline-flex items-center gap-1.5 text-[15px] font-medium', due ? 's-warn' : 's-ink')}>
              <AlarmClock className="h-4 w-4 shrink-0" aria-hidden />
              <span className="first-letter:uppercase">{fmtWeekday(d.followUp)}</span>
              <span className="font-normal s-ink-2">· 9 h</span>
            </p>
          ) : (
            <p className="text-[15px] s-ink-3">Pas de relance prévue.</p>
          )}
        </Block>
        <Block label="Notes">
          <p className={cn('whitespace-pre-line text-[15px] leading-relaxed', d.notes.trim() ? 's-ink' : 's-ink-3')}>{d.notes.trim() || 'Aucune note.'}</p>
        </Block>
      </div>
    </SectionCard>
  );
}

function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[13px] font-medium s-ink-2">{label}</div>
      {children}
    </div>
  );
}
