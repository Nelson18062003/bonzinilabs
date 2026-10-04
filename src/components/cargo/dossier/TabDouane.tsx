/**
 * Onglet Douane — les étapes camerounaises, refaites le 04/10/2026.
 *
 * Avant : six dates figées. Maintenant chaque étape (BESC, CIVIC, télex,
 * avis d'arrivée, bon à délivrer, déclaration, visite, liquidation, bon à
 * enlever, sortie, restitution du vide — et celles que l'équipe ajoute) a :
 *   · un état (à faire, en cours, fait, ne s'applique pas) et ses dates ;
 *   · une référence et une note ;
 *   · SES PIÈCES : une pièce du classeur, dont les fichiers se voient ici
 *     comme dans l'onglet Documents (même fichier, deux portes d'entrée).
 * Chaque étape est expliquée en une phrase : on apprend le dédouanement en
 * le faisant.
 */
import { useMemo, useRef, useState } from 'react';
import { differenceInCalendarDays } from 'date-fns';
import {
  AlertTriangle, Anchor, CheckCircle2, Circle, CircleDashed, ClipboardCheck, Clock, FileText, Hourglass, Landmark, LogOut, Paperclip, Pencil, Plus,
  Ship, Stamp, Trash2, Upload,
} from 'lucide-react';
import { DateField, TextArea, TextField } from '@/components/form';
import {
  useCargoDocFolders, useCargoDocumentUrls, useCargoDocuments, useCargoPackages, useCargoShipmentParties, useCargoSteps, useCreateCargoDocFolders,
  useCreateCargoSteps, useDeleteCargoStep, useUpdateCargoShipment, useUpdateCargoStep, useUploadCargoDocuments,
} from '@/hooks/useCargo';
import { Empty, FieldLabel, IconButton, IconTile, Section, Tag, ToolButton, type SectionTone } from '@/components/cargo/dossier/kit';
import { DocPreview } from '@/components/cargo/dossier/DocPreview';
import { docTitle, isImage } from '@/lib/cargo/documents';
import { isVehicle } from '@/lib/cargo/loadplan';
import { PHASES, STATUS_LABEL, STEP_DEF, seedSteps, shipmentPatchFor, type CargoStep, type StepPhase, type StepStatus } from '@/lib/cargo/steps';
import { fmtDay, fmtDayFull } from '@/lib/cargo/model';
import type { CargoDocument, CargoShipment } from '@/lib/cargo/model';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, SOFT_PILL, PRIMARY_PILL, CenterDialog } from '@/desktop/designKit';

const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp';
const today = () => new Date().toISOString().slice(0, 10);
const dayOf = (d: string | null) => (d ? fmtDay(new Date(`${d}T12:00:00`)) : null);

const PHASE_LOOK: Record<StepPhase, { icon: typeof Ship; tone: SectionTone }> = {
  before: { icon: Stamp, tone: 'orange' },
  arrival: { icon: Anchor, tone: 'blue' },
  clearance: { icon: Landmark, tone: 'rose' },
  exit: { icon: LogOut, tone: 'emerald' },
};

const STATUS_ICON: Record<StepStatus, { icon: typeof Circle; cls: string }> = {
  todo: { icon: Circle, cls: 'text-muted-foreground' },
  doing: { icon: Hourglass, cls: 'text-amber-600 dark:text-amber-400' },
  done: { icon: CheckCircle2, cls: 'text-emerald-600 dark:text-emerald-400' },
  skipped: { icon: CircleDashed, cls: 'text-muted-foreground/60' },
};

/* ── Une étape ─────────────────────────────────────────────────────────── */

function StepRow({
  step, files, urls, canManage, uploading, onToggle, onEdit, onUpload, onPreview,
}: {
  step: CargoStep; files: CargoDocument[]; urls: Record<string, string>; canManage: boolean; uploading: boolean;
  onToggle: () => void; onEdit: () => void; onUpload: (f: File[]) => void; onPreview: (d: CargoDocument) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const def = step.key ? STEP_DEF[step.key] : undefined;
  const st = (step.status as StepStatus) ?? 'todo';
  const { icon: SIcon, cls } = STATUS_ICON[st];
  const late = st !== 'done' && st !== 'skipped' && step.due_on && differenceInCalendarDays(new Date(`${step.due_on}T12:00:00`), new Date()) < 0;
  return (
    <li className={cn('flex gap-3 py-4 first:pt-0 last:pb-0', st === 'skipped' && 'opacity-55')}>
      <button
        type="button"
        disabled={!canManage}
        onClick={onToggle}
        aria-label={st === 'done' ? 'Remettre à faire' : 'Marquer fait'}
        title={canManage ? (st === 'done' ? 'Remettre à faire' : 'Marquer fait aujourd’hui') : undefined}
        className={cn('mt-0.5 shrink-0 rounded-full', canManage && 'hover:scale-110 transition-transform')}
      >
        <SIcon className={cn('h-6 w-6', cls)} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('text-[14.5px] max-lg:text-[16px] font-bold', st === 'done' ? TEXT.body : TEXT.strong)}>{step.title}</span>
          <Tag tone={st === 'done' ? 'success' : st === 'doing' ? 'warn' : 'neutral'}>{STATUS_LABEL[st]}</Tag>
          {step.reference && <Tag tone="info">{step.reference}</Tag>}
          {late && <Tag tone="danger"><AlertTriangle className="h-3 w-3" /> en retard</Tag>}
        </div>
        {def?.hint && <p className={cn('mt-0.5 text-[12.5px] max-lg:text-[14px] leading-relaxed', TEXT.muted)}>{def.hint}</p>}
        <div className={cn('mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[12.5px] max-lg:text-[14px] tabular-nums', TEXT.body)}>
          {step.done_on && <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> fait le {dayOf(step.done_on)}</span>}
          {step.due_on && st !== 'done' && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> pour le {dayOf(step.due_on)}</span>}
        </div>
        {step.note && <p className={cn('mt-2 rounded-lg px-3 py-2 text-[12.5px] max-lg:text-[14px] leading-relaxed', SURFACE.inset, TEXT.body)}>{step.note}</p>}
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {files.map((d) => (
            <button key={d.id} type="button" onClick={() => onPreview(d)} title={docTitle(d)} className={cn('flex h-11 items-center gap-2 overflow-hidden rounded-lg pr-2.5 ring-1 ring-black/[0.08] hover:ring-primary/40 dark:ring-white/[0.1]', SURFACE.card)}>
              {isImage(d) && urls[d.storage_path]
                ? <img src={urls[d.storage_path]} alt="" className="h-11 w-11 object-cover" />
                : <span className={cn('flex h-11 w-11 items-center justify-center', SURFACE.inset)}><FileText className="h-5 w-5 text-rose-600 dark:text-rose-400" /></span>}
              <span className={cn('max-w-[150px] truncate text-[12px] max-lg:text-[13px] font-semibold', TEXT.body)}>{docTitle(d)}</span>
            </button>
          ))}
          {canManage && (
            <>
              <input ref={inputRef} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => { const l = Array.from(e.target.files ?? []); e.target.value = ''; if (l.length) onUpload(l); }} />
              <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className={cn('inline-flex h-11 items-center gap-1.5 rounded-lg border border-dashed border-black/[0.16] px-3 text-[12px] max-lg:text-[13px] font-semibold hover:border-primary/50 disabled:opacity-60 dark:border-white/[0.18]', TEXT.body)}>
                {uploading ? <Upload className="h-3.5 w-3.5 animate-pulse" /> : <Paperclip className="h-3.5 w-3.5" />}
                {uploading ? 'Envoi…' : files.length ? 'Ajouter une pièce' : 'Joindre les pièces'}
              </button>
            </>
          )}
        </div>
      </div>
      {canManage && <IconButton icon={Pencil} label="Modifier l'étape" onClick={onEdit} />}
    </li>
  );
}

/* ── Dialogue d'une étape ───────────────────────────────────────────────── */

function StepDialog({
  step, folders, onClose, onSave, onDelete, saving,
}: {
  step: CargoStep | null; folders: { id: string; title: string }[]; onClose: () => void; saving: boolean;
  onSave: (v: { title: string; phase: StepPhase; status: StepStatus; due_on: string | null; done_on: string | null; reference: string | null; note: string | null; folder_id: string | null }) => void;
  onDelete?: () => void;
}) {
  const def = step?.key ? STEP_DEF[step.key] : undefined;
  const [title, setTitle] = useState(step?.title ?? '');
  const [phase, setPhase] = useState<StepPhase>((step?.phase as StepPhase) ?? 'clearance');
  const [status, setStatus] = useState<StepStatus>((step?.status as StepStatus) ?? 'todo');
  const [due, setDue] = useState(step?.due_on ?? '');
  const [done, setDone] = useState(step?.done_on ?? '');
  const [reference, setReference] = useState(step?.reference ?? '');
  const [note, setNote] = useState(step?.note ?? '');
  const [folder, setFolder] = useState(step?.folder_id ?? '');
  const valid = title.trim().length > 0;
  const submit = () => {
    if (!valid) return;
    onSave({
      title: title.trim(), phase, status, due_on: due || null, done_on: status === 'done' ? done || today() : null,
      reference: reference.trim() || null, note: note.trim() || null, folder_id: folder || null,
    });
  };
  return (
    <CenterDialog
      open
      onClose={onClose}
      onConfirm={submit}
      width={620}
      title={step ? 'Modifier l’étape' : 'Ajouter une étape'}
      footer={
        <>
          {onDelete && <ToolButton icon={Trash2} danger onClick={onDelete}>Supprimer</ToolButton>}
          <button type="button" onClick={onClose} className={cn('ml-auto h-9 px-4 text-[13px] max-lg:text-[15px] font-semibold', SOFT_PILL)}>Annuler</button>
          <button type="button" onClick={submit} disabled={!valid || saving} className={cn('h-9 px-4 text-[13px] max-lg:text-[15px] font-bold disabled:opacity-60', PRIMARY_PILL)}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
        </>
      }
    >
      <div className="space-y-4">
        {def?.hint && <p className={cn('rounded-lg px-3 py-2 text-[12.5px] max-lg:text-[14px] leading-relaxed', SURFACE.inset, TEXT.body)}>{def.hint}</p>}
        <div>
          <FieldLabel htmlFor="step-title">Étape</FieldLabel>
          <TextField id="step-title" size="sm" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Rendez-vous chez le déclarant, paiement des frais du port…" />
        </div>
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <div>
            <FieldLabel>Moment</FieldLabel>
            <div className="grid grid-cols-2 gap-1">
              {PHASES.map((p) => (
                <button key={p.key} type="button" onClick={() => setPhase(p.key)} className={cn('h-8 max-lg:h-10 rounded-md px-2 text-[12px] max-lg:text-[14px] font-semibold', p.key === phase ? PRIMARY_PILL : SOFT_PILL)}>{p.label}</button>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel>État</FieldLabel>
            <div className="grid grid-cols-2 gap-1">
              {(['todo', 'doing', 'done', 'skipped'] as StepStatus[]).map((k) => (
                <button key={k} type="button" onClick={() => { setStatus(k); if (k === 'done' && !done) setDone(today()); }} className={cn('h-8 max-lg:h-10 rounded-md px-2 text-[12px] max-lg:text-[14px] font-semibold', k === status ? PRIMARY_PILL : SOFT_PILL)}>{STATUS_LABEL[k]}</button>
              ))}
            </div>
          </div>
          <div><FieldLabel htmlFor="step-due" hint="facultatif">À faire pour le</FieldLabel><DateField id="step-due" size="sm" value={due} onChange={(e) => setDue(e.target.value)} /></div>
          <div><FieldLabel htmlFor="step-done">Fait le</FieldLabel><DateField id="step-done" size="sm" value={done} onChange={(e) => setDone(e.target.value)} disabled={status !== 'done'} /></div>
          <div><FieldLabel htmlFor="step-ref" hint="facultatif">Référence</FieldLabel><TextField id="step-ref" size="sm" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="MI2661716, n° de déclaration, n° de quittance…" /></div>
          <div>
            <FieldLabel htmlFor="step-folder" hint="ses fichiers">Pièce du classeur</FieldLabel>
            <select id="step-folder" value={folder} onChange={(e) => setFolder(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-[13px] max-lg:h-11 max-lg:text-[16px]">
              <option value="">— créée au premier fichier —</option>
              {folders.map((f) => <option key={f.id} value={f.id}>{f.title}</option>)}
            </select>
          </div>
        </div>
        <div>
          <FieldLabel htmlFor="step-note" hint="facultatif">Note</FieldLabel>
          <TextArea id="step-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Qui s'en occupe, ce qui bloque, ce qu'on attend…" />
        </div>
      </div>
    </CenterDialog>
  );
}

/* ── L'onglet ─────────────────────────────────────────────────────────── */

export function TabDouane({ shipment: s, canManage }: { shipment: CargoShipment; canManage: boolean }) {
  const { data: steps } = useCargoSteps(s.id);
  const { data: folders } = useCargoDocFolders(s.id);
  const { data: docs } = useCargoDocuments(s.id);
  const { data: packages } = useCargoPackages(s.id);
  const { data: parties } = useCargoShipmentParties(s.id);
  const createSteps = useCreateCargoSteps();
  const updateStep = useUpdateCargoStep();
  const deleteStep = useDeleteCargoStep();
  const createFolders = useCreateCargoDocFolders();
  const upload = useUploadCargoDocuments();
  const updateShipment = useUpdateCargoShipment();
  const [dialog, setDialog] = useState<{ step: CargoStep | null } | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ docs: CargoDocument[]; index: number } | null>(null);

  const list = useMemo(() => steps ?? [], [steps]);
  const stepFiles = useMemo(() => {
    const m: Record<string, CargoDocument[]> = {};
    for (const st of list) m[st.id] = st.folder_id ? (docs ?? []).filter((d) => d.folder_id === st.folder_id) : [];
    return m;
  }, [list, docs]);
  const allFiles = useMemo(() => Object.values(stepFiles).flat(), [stepFiles]);
  const { data: urls } = useCargoDocumentUrls(allFiles);
  const hasVehicles = (packages ?? []).some(isVehicle);
  const relevant = list.filter((x) => x.status !== 'skipped');
  const doneCount = relevant.filter((x) => x.status === 'done').length;
  const current = list.find((x) => x.status === 'doing') ?? list.find((x) => x.status === 'todo');
  const declarant = (parties ?? []).find((l) => l.role === 'DECLARANT');

  const freeTime = s.free_time_ends_on ? new Date(s.free_time_ends_on + 'T12:00:00') : null;
  const daysLeft = freeTime ? differenceInCalendarDays(freeTime, new Date()) : null;
  const overdue = daysLeft != null && daysLeft < 0 && !s.gate_out_at;
  const soon = daysLeft != null && daysLeft >= 0 && daysLeft <= 3 && !s.gate_out_at;

  /** Les étapes standard, pré-remplies, reliées aux pièces du classeur qui leur correspondent. */
  const prepare = () => {
    const seeded = seedSteps(s, hasVehicles).map((st) => {
      const def = STEP_DEF[st.key];
      const f = (folders ?? []).find((x) => (def.docMatch ? def.docMatch.test(x.title) : false) || (def.docCategory && def.docCategory !== 'CUSTOMS' && x.category === def.docCategory));
      return { ...st, folder_id: f?.id ?? null };
    });
    createSteps.mutate({ shipmentId: s.id, steps: seeded });
  };

  const toggle = (st: CargoStep) => {
    const next: StepStatus = st.status === 'done' ? 'todo' : 'done';
    const doneOn = next === 'done' ? today() : null;
    const def = st.key ? STEP_DEF[st.key] : undefined;
    updateStep.mutate({ step: st, patch: { status: next, done_on: doneOn }, shipmentPatch: shipmentPatchFor(def, next, doneOn, null) });
  };

  const uploadTo = async (st: CargoStep, files: File[]) => {
    setUploading(st.id);
    try {
      let folderId = st.folder_id;
      const def = st.key ? STEP_DEF[st.key] : undefined;
      if (!folderId) {
        const ids = await createFolders.mutateAsync({ shipmentId: s.id, folders: [{ title: st.title, category: def?.docCategory ?? 'CUSTOMS', position: 100 + (st.position ?? 0) }] });
        folderId = ids[0];
        await updateStep.mutateAsync({ step: st, patch: { folder_id: folderId } });
      }
      const folder = (folders ?? []).find((f) => f.id === folderId);
      await upload.mutateAsync({ shipmentId: s.id, kind: folder?.category ?? def?.docCategory ?? 'CUSTOMS', folderId, files });
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-5 max-lg:grid-cols-1">
      <div className="space-y-5">
        {/* Où en est le dédouanement. */}
        <div className={cn('flex flex-wrap items-center gap-x-6 gap-y-3 rounded-[14px] px-5 py-4', SURFACE.card, SURFACE.shadow)}>
          <div className="flex items-center gap-3">
            <IconTile icon={ClipboardCheck} tone="rose" size="lg" />
            <div>
              <div className={cn('text-[15px] max-lg:text-[17px] font-bold', TEXT.strong)}>Dédouanement au Cameroun</div>
              <div className={cn('text-[12.5px] max-lg:text-[14px]', TEXT.muted)}>
                {list.length === 0 ? 'Étapes pas encore préparées' : `${doneCount} étape${doneCount > 1 ? 's' : ''} faite${doneCount > 1 ? 's' : ''} sur ${relevant.length}`}
                {current && <> · en cours : <b className={TEXT.body}>{current.title}</b></>}
                {declarant && <> · déclarante : <b className={TEXT.body}>{declarant.party.name}</b></>}
              </div>
            </div>
          </div>
          {relevant.length > 0 && (
            <div className="ml-auto h-2 w-[200px] overflow-hidden rounded-full bg-muted max-sm:ml-0 max-sm:w-full">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round((doneCount / relevant.length) * 100)}%` }} />
            </div>
          )}
          {canManage && list.length > 0 && <ToolButton icon={Plus} onClick={() => setDialog({ step: null })}>Ajouter une étape</ToolButton>}
        </div>

        {list.length === 0 ? (
          <Section icon={ClipboardCheck} tone="rose" title="Les étapes de ce conteneur">
            <Empty
              icon={ClipboardCheck}
              title="Prépare les étapes du dédouanement"
              action={canManage ? <ToolButton icon={Plus} primary onClick={prepare} disabled={createSteps.isPending}>Préparer les étapes</ToolButton> : undefined}
            >
              BESC{hasVehicles ? ', CIVIC des véhicules' : ''}, télex, avis d'arrivée, bon à délivrer, déclaration, visite, liquidation, bon à enlever,
              sortie, restitution du vide : chaque étape expliquée, avec ses dates, sa référence et ses pièces. Ce que le dossier sait déjà est coché.
            </Empty>
          </Section>
        ) : (
          PHASES.map((p) => {
            const items = list.filter((x) => x.phase === p.key);
            if (items.length === 0) return null;
            const { icon, tone } = PHASE_LOOK[p.key];
            const done = items.filter((x) => x.status === 'done').length;
            return (
              <Section key={p.key} icon={icon} tone={tone} title={p.label} subtitle={p.hint} meta={`${done} / ${items.filter((x) => x.status !== 'skipped').length}`}>
                <ul className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
                  {items.map((st) => (
                    <StepRow
                      key={st.id}
                      step={st}
                      files={stepFiles[st.id] ?? []}
                      urls={urls ?? {}}
                      canManage={canManage}
                      uploading={uploading === st.id}
                      onToggle={() => toggle(st)}
                      onEdit={() => setDialog({ step: st })}
                      onUpload={(f) => void uploadTo(st, f)}
                      onPreview={(d) => { const l = stepFiles[st.id] ?? []; setPreview({ docs: l, index: l.indexOf(d) }); }}
                    />
                  ))}
                </ul>
              </Section>
            );
          })
        )}
      </div>

      <div className="space-y-5">
        <Section icon={Hourglass} tone={overdue ? 'rose' : soon ? 'amber' : 'neutral'} title="Franchise au port" subtitle="au-delà, surestaries et stockage courent chaque jour">
          {freeTime ? (
            <div className={cn('text-[24px] font-extrabold tabular-nums', overdue ? 'text-destructive' : soon ? 'text-amber-700 dark:text-amber-400' : TEXT.strong)}>
              {overdue ? `dépassée de ${-daysLeft!} j` : daysLeft === 0 ? "finit aujourd'hui" : `${daysLeft} j restants`}
            </div>
          ) : (
            <p className={cn('text-[13px] max-lg:text-[15px]', TEXT.muted)}>Date pas encore connue : elle figure sur l'avis d'arrivée.</p>
          )}
          {freeTime && <div className={cn('text-[12.5px] max-lg:text-[14px]', TEXT.muted)}>jusqu'au {fmtDayFull(freeTime)}</div>}
          {canManage && (
            <div className="mt-3">
              <FieldLabel htmlFor="free-time">Fin de franchise</FieldLabel>
              <DateField id="free-time" size="sm" value={s.free_time_ends_on ?? ''} onChange={(e) => updateShipment.mutate({ id: s.id, patch: { free_time_ends_on: e.target.value || null } })} />
            </div>
          )}
        </Section>

        <Section icon={FileText} title="Références">
          <dl className="space-y-3 text-[13px] max-lg:text-[15px]">
            <div className="flex items-baseline justify-between gap-3"><dt className={TEXT.muted}>BESC</dt><dd className={cn('font-semibold tabular-nums', TEXT.strong)}>{s.besc_number ?? '—'}</dd></div>
            <div className="flex items-baseline justify-between gap-3"><dt className={TEXT.muted}>Déclaration</dt><dd className={cn('font-semibold tabular-nums', TEXT.strong)}>{s.customs_declaration_ref ?? '—'}</dd></div>
            <div className="flex items-baseline justify-between gap-3"><dt className={TEXT.muted}>B/L</dt><dd className={cn('font-semibold tabular-nums', TEXT.strong)}>{s.bl_number}</dd></div>
          </dl>
          <p className={cn('mt-3 text-[12px] max-lg:text-[14px]', TEXT.muted)}>Les références se saisissent dans chaque étape (crayon) : la fiche les reprend partout.</p>
        </Section>

        <Section icon={Landmark} title="L’ordre des choses">
          <ol className={cn('list-decimal space-y-1.5 pl-4 text-[12.5px] max-lg:text-[14px] leading-relaxed', TEXT.body)}>
            <li><b>Avant l'arrivée</b> : BESC, CIVIC des véhicules, télex release.</li>
            <li><b>À l'arrivée</b> : avis d'arrivée, puis bon à délivrer contre le B/L ou le télex.</li>
            <li><b>Dédouanement</b> : déclaration, visite, liquidation et paiement des droits.</li>
            <li><b>Sortie</b> : bon à enlever, sortie du port, retour du vide avant la fin de la franchise.</li>
          </ol>
        </Section>
      </div>

      {dialog && (
        <StepDialog
          step={dialog.step}
          folders={(folders ?? []).map((f) => ({ id: f.id, title: f.title }))}
          saving={updateStep.isPending || createSteps.isPending}
          onClose={() => setDialog(null)}
          onDelete={dialog.step && !dialog.step.key ? () => deleteStep.mutate(dialog.step!, { onSuccess: () => setDialog(null) }) : undefined}
          onSave={(v) => {
            if (dialog.step) {
              const def = dialog.step.key ? STEP_DEF[dialog.step.key] : undefined;
              updateStep.mutate(
                { step: dialog.step, patch: v, shipmentPatch: shipmentPatchFor(def, v.status, v.done_on, v.reference ?? '') },
                { onSuccess: () => setDialog(null) },
              );
            } else {
              createSteps.mutate({ shipmentId: s.id, steps: [{ ...v, position: list.reduce((m, x) => Math.max(m, x.position), 0) + 1 }] }, { onSuccess: () => setDialog(null) });
            }
          }}
        />
      )}
      {preview && <DocPreview docs={preview.docs} index={preview.index} urls={urls ?? {}} onIndex={(i) => setPreview({ ...preview, index: i })} onClose={() => setPreview(null)} />}
    </div>
  );
}
