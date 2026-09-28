// ============================================================
// StatementPeriodSheet — « Relevé de compte » : la période ET la langue,
// avant de fabriquer le PDF (refait le 28/09/2026).
//
//   · Téléphone (app client, admin mobile) : feuille basse, calendrier.
//   · Ordinateur (`variant="dialog"`, panneau client desktop) : fenêtre
//     centrée, deux champs de date « Du / Au » tapables au clavier.
//   · Périodes toutes faites (aujourd'hui, 7 / 30 jours, ce mois-ci, mois
//     dernier, 3 mois, tout l'historique) ou dates libres.
//   · Langue du relevé : Français | English — retenue sur l'appareil.
//
// Le composant ne charge rien : il remet la période et la langue au parent
// (`onGenerate(range, lang)`), qui lit les écritures et fabrique le PDF.
// ============================================================
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, FileDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BottomSheet, Chip, PrimaryPill, Segmented, SURFACE, TEXT } from '@/mobile/designKit';
import { CenterDialog } from '@/desktop/designKit';
import { BzDateRangeField } from '@/mobile/components/BzDateRangeField';
import {
  DEFAULT_STATEMENT_PRESET,
  STATEMENT_PRESETS,
  buildStatementRange,
  statementPeriodLabel,
  type StatementCustomDays,
  type StatementPeriodPreset,
  type StatementRange,
} from '@/lib/statementPeriod';
import type { StatementLang } from '@/lib/accountStatement';

export interface StatementPeriodSheetProps {
  open: boolean;
  onClose: () => void;
  /** Reçoit la période résolue et la langue ; la feuille se ferme si le PDF est parti (`false` = rien généré, on reste). */
  onGenerate: (range: StatementRange, lang: StatementLang) => Promise<boolean | void>;
  isGenerating: boolean;
  /** Couleur d'accent du calendrier (défaut : violet Bonzini). */
  accent?: string;
  /** `dialog` : fenêtre centrée (ordinateur) ; `sheet` : feuille basse (téléphone). */
  variant?: 'sheet' | 'dialog';
}

const LANG_KEY = 'bz.statement.lang';

function initialLang(uiLang: string): StatementLang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'fr' || saved === 'en') return saved;
  } catch { /* navigation privée */ }
  return uiLang.startsWith('en') ? 'en' : 'fr';
}

/** « YYYY-MM-DD » du jour, heure de Douala (borne haute des champs de date). */
function todayDay(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala' }).format(new Date());
}

export function StatementPeriodSheet({
  open,
  onClose,
  onGenerate,
  isGenerating,
  accent = '#8B5CF6',
  variant = 'sheet',
}: StatementPeriodSheetProps) {
  const { t, i18n } = useTranslation('common');
  const [preset, setPreset] = useState<StatementPeriodPreset>(DEFAULT_STATEMENT_PRESET);
  const [custom, setCustom] = useState<StatementCustomDays>({ from: '', to: '' });
  const [lang, setLangState] = useState<StatementLang>(() => initialLang(i18n.language ?? 'fr'));
  const setLang = (l: StatementLang) => {
    setLangState(l);
    try { localStorage.setItem(LANG_KEY, l); } catch { /* navigation privée */ }
  };

  const customIncomplete = preset === 'custom' && (!custom.from || !custom.to);
  const customInverted = preset === 'custom' && !!custom.from && !!custom.to && custom.from > custom.to;
  // `open` dans les dépendances : la période « aujourd'hui » se recalcule à
  // chaque ouverture, pas seulement au premier rendu de l'écran.
  const range = useMemo(
    () => (customIncomplete || customInverted ? null : buildStatementRange(preset, custom)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [preset, custom, customIncomplete, customInverted, open],
  );

  const generate = async () => {
    if (!range || isGenerating) return;
    const done = await onGenerate(range, lang);
    if (done !== false) onClose();
  };

  const dialog = variant === 'dialog';
  const today = todayDay();

  const body = (
    <>
      <p className={cn('text-[15px] leading-snug', TEXT.muted)}>
        {t('statementPeriod.hint2', {
          defaultValue: 'Solde d’ouverture, chaque dépôt et chaque paiement (avec son taux et le montant en ¥), puis le solde de clôture.',
        })}
      </p>

      {/* 1 · La période */}
      <div className={cn('mt-4 text-[13px] font-bold uppercase tracking-wide', TEXT.muted)}>
        {t('statementPeriod.periodLabel', { defaultValue: 'Période' })}
      </div>
      <div className={cn('mt-2 grid gap-2', dialog ? 'grid-cols-3' : 'grid-cols-2')}>
        {STATEMENT_PRESETS.map((p) => (
          <Chip
            key={p.id}
            label={t(p.labelKey, { defaultValue: p.labelFr })}
            active={preset === p.id}
            onClick={() => setPreset(p.id)}
            className="w-full justify-center px-2"
          />
        ))}
      </div>

      {/* Dates libres : deux champs au clavier sur ordinateur, calendrier sur téléphone */}
      {preset === 'custom' && (
        dialog ? (
          <div className="mt-3 grid grid-cols-2 gap-3">
            {(['from', 'to'] as const).map((k) => (
              <label key={k} className="block">
                <span className={cn('text-[13px] font-semibold', TEXT.muted)}>
                  {k === 'from' ? t('statementPeriod.fromDate', { defaultValue: 'Du' }) : t('statementPeriod.toDate', { defaultValue: 'Au' })}
                </span>
                {/* Champ date natif : saisie au clavier et calendrier du navigateur. */}
                {/* eslint-disable-next-line no-restricted-syntax */}
                <input
                  type="date"
                  value={custom[k]}
                  max={today}
                  onChange={(e) => setCustom((c) => ({ ...c, [k]: e.target.value }))}
                  className={cn('mt-1 h-11 w-full rounded-lg px-3 text-[15px] font-semibold outline-none ring-1 ring-black/10 focus:ring-2 dark:ring-white/15', SURFACE.canvas, TEXT.strong)}
                  style={{ colorScheme: 'light dark' }}
                />
              </label>
            ))}
          </div>
        ) : (
          <div className="mt-3">
            <BzDateRangeField
              value={custom}
              onChange={setCustom}
              accent={accent}
              defaultOpen
              placeholder={t('statementPeriod.customPlaceholder', { defaultValue: 'Date de début → date de fin' })}
            />
          </div>
        )
      )}

      {/* 2 · La langue du relevé */}
      <div className={cn('mt-5 text-[13px] font-bold uppercase tracking-wide', TEXT.muted)}>
        {t('statementPeriod.languageLabel', { defaultValue: 'Langue du relevé' })}
      </div>
      <Segmented<StatementLang>
        className="mt-2"
        value={lang}
        onChange={setLang}
        options={[
          { value: 'fr', label: 'Français' },
          { value: 'en', label: 'English' },
        ]}
      />

      {/* Ce qui va sortir */}
      <div className={cn('mt-5 flex min-h-11 items-center gap-2.5 rounded-lg px-3.5 py-2.5', SURFACE.canvas)}>
        <CalendarDays className="h-4 w-4 shrink-0" style={{ color: accent }} />
        <span className={cn('text-[14px] font-semibold', range ? TEXT.strong : TEXT.muted)}>
          {range
            ? statementPeriodLabel(range, i18n.language)
            : customInverted
              ? t('statementPeriod.inverted', { defaultValue: 'La date de début doit précéder la date de fin.' })
              : t('statementPeriod.pickDates', { defaultValue: 'Choisissez une date de début et une date de fin.' })}
        </span>
      </div>
    </>
  );

  const button = (
    <PrimaryPill onClick={generate} disabled={!range} loading={isGenerating} className="w-full">
      {isGenerating
        ? t('statementPeriod.generating', { defaultValue: 'Préparation du relevé…' })
        : t('statementPeriod.download', { defaultValue: 'Télécharger le relevé (PDF)' })}
    </PrimaryPill>
  );

  const title = (
    <span className="flex items-center gap-2">
      <FileDown className="h-5 w-5 text-[#1E1E1E] dark:text-[#F5F5F5]" />
      {t('statementPeriod.title', { defaultValue: 'Relevé de compte' })}
    </span>
  );

  if (dialog) {
    return (
      <CenterDialog
        open={open}
        onClose={() => { if (!isGenerating) onClose(); }}
        onConfirm={() => void generate()}
        title={title}
        width={600}
        footer={button}
      >
        {body}
      </CenterDialog>
    );
  }

  return (
    <BottomSheet open={open} onClose={() => { if (!isGenerating) onClose(); }} title={title}>
      {body}
      <div className="mt-5">{button}</div>
    </BottomSheet>
  );
}
