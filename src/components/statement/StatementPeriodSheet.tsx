// ============================================================
// StatementPeriodSheet — « Relevé de compte » : choisir la période
// avant de générer le PDF. Partagé par l'app client (HistoryPage),
// l'admin mobile (MobileClientDetail) et l'admin desktop
// (DesktopClientPanel) — une feuille basse convient aux trois.
//
// Le composant ne charge rien : il résout la période et la remet au
// parent (`onGenerate(range)`), qui lit les écritures et génère.
// ============================================================
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, FileDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BottomSheet, Chip, PrimaryPill, SURFACE, TEXT } from '@/mobile/designKit';
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

export interface StatementPeriodSheetProps {
  open: boolean;
  onClose: () => void;
  /** Reçoit la période résolue ; la feuille se ferme quand la promesse aboutit. */
  onGenerate: (range: StatementRange) => Promise<void>;
  isGenerating: boolean;
  /** Couleur d'accent du calendrier (défaut : violet Bonzini). */
  accent?: string;
}

export function StatementPeriodSheet({
  open,
  onClose,
  onGenerate,
  isGenerating,
  accent = '#8B5CF6',
}: StatementPeriodSheetProps) {
  const { t, i18n } = useTranslation('common');
  const [preset, setPreset] = useState<StatementPeriodPreset>(DEFAULT_STATEMENT_PRESET);
  const [custom, setCustom] = useState<StatementCustomDays>({ from: '', to: '' });

  const customIncomplete = preset === 'custom' && (!custom.from || !custom.to);
  // `open` dans les dépendances : la période « aujourd'hui » se recalcule à
  // chaque ouverture, pas seulement au premier rendu de l'écran.
  const range = useMemo(
    () => (customIncomplete ? null : buildStatementRange(preset, custom)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [preset, custom, customIncomplete, open],
  );

  const generate = async () => {
    if (!range || isGenerating) return;
    await onGenerate(range);
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={() => { if (!isGenerating) onClose(); }}
      title={
        <span className="flex items-center gap-2">
          <FileDown className="h-5 w-5 text-[#1E1E1E] dark:text-[#F5F5F5]" />
          {t('statementPeriod.title', { defaultValue: 'Relevé de compte' })}
        </span>
      }
    >
      <p className={cn('text-[16px] leading-snug', TEXT.muted)}>
        {t('statementPeriod.hint', {
          defaultValue: "Choisissez la période à couvrir. Le PDF indique le solde d'ouverture, les mouvements et le solde de clôture.",
        })}
      </p>

      {/* Préréglages — deux colonnes, puces de 44 px */}
      <div className="mt-4 grid grid-cols-2 gap-2">
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

      {/* Dates libres */}
      {preset === 'custom' && (
        <div className="mt-3">
          <BzDateRangeField
            value={custom}
            onChange={setCustom}
            accent={accent}
            defaultOpen
            placeholder={t('statementPeriod.customPlaceholder', { defaultValue: 'Date de début → date de fin' })}
          />
        </div>
      )}

      {/* Aperçu de la période résolue */}
      <div className={cn('mt-4 flex min-h-11 items-center gap-2.5 rounded-lg px-3.5 py-2.5', SURFACE.canvas)}>
        <CalendarDays className="h-4 w-4 shrink-0" style={{ color: accent }} />
        <span className={cn('text-[14px] font-semibold', range ? TEXT.strong : TEXT.muted)}>
          {range
            ? statementPeriodLabel(range, i18n.language)
            : t('statementPeriod.pickDates', { defaultValue: 'Choisissez une date de début et une date de fin.' })}
        </span>
      </div>

      <div className="mt-5">
        <PrimaryPill onClick={generate} disabled={!range} loading={isGenerating} className="w-full">
          {isGenerating
            ? t('statementPeriod.generating', { defaultValue: 'Préparation du relevé…' })
            : t('statementPeriod.generate', { defaultValue: 'Générer le PDF' })}
        </PrimaryPill>
      </div>
    </BottomSheet>
  );
}
