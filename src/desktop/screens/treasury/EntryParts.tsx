/**
 * Trésorerie — les pièces communes aux saisies d'achat et de vente :
 * champ lié (« calculé »), ligne de date repliée, référence et note repliées,
 * écran de réussite avec le reçu.
 */
import { useRef, useState, type ReactNode } from 'react';
import { Check, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BTN } from './tstyle';
import { AmountInput, TextArea, TextInput, TextLink, WhenField } from './tkit';
import { fmtWhen } from './treasuryFormat';
import { OperationReceipt, ReceiptActions } from './OperationReceipt';
import type { ReceiptData } from './receiptData';

/** Un des trois montants liés. Le calculé est grisé et le dit. */
export function LinkedField({
  id,
  label,
  unit,
  decimals,
  value,
  computed,
  onChange,
  invalid,
  big,
}: {
  id: string;
  label: string;
  unit: string;
  decimals: number;
  value: number | null;
  computed: boolean;
  onChange: (v: number | null) => void;
  invalid?: boolean;
  big?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 flex items-center justify-between text-[13.5px] font-medium text-foreground">
        {label}
        {computed && value !== null && <span className="text-[12px] font-medium text-muted-foreground">calculé</span>}
      </label>
      <div className={cn(computed && '[&>div]:border-transparent [&>div]:bg-muted/60', big && '[&_input]:text-[22px]')}>
        <AmountInput id={id} value={value} onChange={onChange} unit={unit} decimals={decimals} invalid={invalid} />
      </div>
    </div>
  );
}

/** Champ avec un lien d'action à droite du libellé (« + Nouveau »). */
export function LabeledRow({ label, htmlFor, action, error, children }: { label: string; htmlFor?: string; action?: ReactNode; error?: string | null; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={htmlFor} className="text-[13.5px] font-medium text-foreground">
          {label}
        </label>
        {action}
      </div>
      {children}
      {error && <div className="mt-1 text-[12.5px] font-medium text-red-700 dark:text-red-400">{error}</div>}
    </div>
  );
}

/** « Date : maintenant · Modifier » — la date ne s'affiche en champ que si on la change. */
export function WhenLine({ id, value, onChange }: { id: string; value: string; onChange: (iso: string) => void }) {
  const [edit, setEdit] = useState(false);
  if (edit) {
    return (
      <div>
        <label htmlFor={id} className="mb-1.5 block text-[13.5px] font-medium">
          Date
        </label>
        <WhenField id={id} value={value} onChange={onChange} />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between text-[14px]">
      <span className="text-muted-foreground">
        Date : <span className="font-medium text-foreground">{fmtWhen(value)}</span>
      </span>
      <TextLink onClick={() => setEdit(true)}>Modifier</TextLink>
    </div>
  );
}

/** Référence et note, repliées tant qu'on n'en a pas besoin. */
export function RefAndNote({ refValue, onRef, notes, onNotes, idPrefix }: { refValue: string; onRef: (v: string) => void; notes: string; onNotes: (v: string) => void; idPrefix: string }) {
  const [open, setOpen] = useState(!!(refValue || notes));
  if (!open) {
    return (
      <TextLink onClick={() => setOpen(true)} className="text-muted-foreground hover:text-foreground">
        <Plus className="h-4 w-4" /> Ajouter une référence ou une note
      </TextLink>
    );
  }
  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={`${idPrefix}-ref`} className="mb-1.5 block text-[13.5px] font-medium">
          Référence <span className="font-normal text-muted-foreground">(n° d’ordre, de transaction…)</span>
        </label>
        <TextInput id={`${idPrefix}-ref`} value={refValue} onChange={(e) => onRef(e.target.value)} />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-notes`} className="mb-1.5 block text-[13.5px] font-medium">
          Note interne <span className="font-normal text-muted-foreground">(n’apparaît pas sur le reçu)</span>
        </label>
        <TextArea id={`${idPrefix}-notes`} value={notes} onChange={(e) => onNotes(e.target.value)} />
      </div>
    </div>
  );
}

/** Après l'enregistrement : le reçu, prêt à copier. */
export function SavedView({ title, data, againLabel, onAgain, onClose }: { title: string; data: ReceiptData; againLabel: string; onAgain: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="flex flex-col items-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
        <Check className="h-6 w-6" />
      </span>
      <h3 className="mt-3 text-[20px] font-bold tracking-[-0.015em]">{title}</h3>
      <p className="mt-1 text-center text-[14px] text-muted-foreground">Voici le reçu. Copiez-le et envoyez-le comme preuve.</p>
      <div className="mt-6 flex w-full flex-col items-center gap-4 rounded-2xl bg-muted/60 px-4 py-6">
        <OperationReceipt ref={ref} data={data} />
        <ReceiptActions target={ref} data={data} className="w-[420px]" />
      </div>
      <div className="mt-6 flex w-full gap-2">
        <button type="button" className={cn(BTN.soft, 'flex-1')} onClick={onAgain}>
          {againLabel}
        </button>
        <button type="button" className={cn(BTN.ghost, 'flex-1')} onClick={onClose}>
          Fermer
        </button>
      </div>
    </div>
  );
}
