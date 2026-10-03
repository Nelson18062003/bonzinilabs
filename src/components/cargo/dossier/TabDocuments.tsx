/**
 * Onglet Documents — le classeur du conteneur, refait (03/10/2026).
 *
 * Avant : sept cases figées, « obligatoires » ou non, un fichier par clic,
 * rien à renommer ni à déplacer. Le terrain demandait l'inverse : trois
 * originaux du B/L, un certificat par véhicule, des photos, des pièces que
 * personne n'avait prévues.
 *
 * Maintenant l'équipe crée ses PIÈCES (titre libre, catégorie, nombre de
 * fichiers attendus) et range dedans autant de fichiers qu'elle veut —
 * glisser-déposer ou bouton, plusieurs à la fois. Chaque fichier se voit
 * (miniature, aperçu plein écran), se renomme, s'annote, se déplace, se
 * télécharge, se supprime. Rien n'est « obligatoire » : la liste « à faire »
 * de l'aperçu dit ce qui manque, le classeur sert à ranger.
 */
import { useMemo, useRef, useState, type DragEvent, type ElementType } from 'react';
import {
  BadgeCheck, Banknote, Boxes, Building2, Camera, Car, Download, File as FileIcon,
  FileText, FolderInput, Image as ImageIcon, FolderOpen, FolderPlus, Landmark, Mail, Pencil, Plus, Receipt, ScrollText, Search, Ship, Stamp, Trash2,
  Unlock, Upload, Wallet,
} from 'lucide-react';
import { NumberField, SelectField, TextArea, TextField } from '@/components/form';
import {
  downloadCargoDocument, useCargoDocFolders, useCargoDocumentUrls, useCargoDocuments, useCreateCargoDocFolders,
  useDeleteCargoDocFolder, useDeleteCargoDocument, useUpdateCargoDocFolder, useUpdateCargoDocument, useUploadCargoDocuments,
} from '@/hooks/useCargo';
import { Empty, FieldLabel, IconButton, IconTile, Section, Tag, ToolButton, type SectionTone } from '@/components/cargo/dossier/kit';
import { DocPreview } from '@/components/cargo/dossier/DocPreview';
import {
  DOC_CATEGORIES, DOC_CATEGORY_META, STARTER_FOLDERS, categoryLabel, docTitle, fileSize, folderProgress, isDocCategory, isImage, isPdf,
  type CargoDocFolder, type DocCategory,
} from '@/lib/cargo/documents';
import type { CargoDocument, CargoShipment } from '@/lib/cargo/model';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, SOFT_PILL, PRIMARY_PILL, CenterDialog, absShort } from '@/desktop/designKit';

const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp';

/** Une icône et une teinte par catégorie : on reconnaît une pièce avant de la lire. */
export const CATEGORY_LOOK: Record<DocCategory, { icon: ElementType; tone: SectionTone }> = {
  BL: { icon: ScrollText, tone: 'blue' },
  TELEX: { icon: Unlock, tone: 'emerald' },
  PACKING_LIST: { icon: Boxes, tone: 'amber' },
  INVOICE: { icon: Receipt, tone: 'violet' },
  FREIGHT: { icon: Ship, tone: 'blue' },
  BESC: { icon: Stamp, tone: 'orange' },
  CERTIFICATE: { icon: BadgeCheck, tone: 'emerald' },
  VEHICLE: { icon: Car, tone: 'slate' },
  CUSTOMS: { icon: Landmark, tone: 'rose' },
  TAX: { icon: Building2, tone: 'slate' },
  PHOTO: { icon: Camera, tone: 'amber' },
  CORRESPONDENCE: { icon: Mail, tone: 'neutral' },
  COST: { icon: Wallet, tone: 'violet' },
  OTHER: { icon: FileIcon, tone: 'neutral' },
};
const look = (c: string | null | undefined) => CATEGORY_LOOK[isDocCategory(c) ? c : 'OTHER'];

/* ── Une tuile de fichier ─────────────────────────────────────────────────── */

function FileTile({
  doc, url, canManage, onPreview, onEdit, onDelete,
}: {
  doc: CargoDocument; url?: string; canManage: boolean;
  onPreview: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const img = isImage(doc);
  return (
    <div className={cn('group relative overflow-hidden rounded-[10px] ring-1 ring-black/[0.07] dark:ring-white/[0.08]', SURFACE.card)}>
      <button type="button" onClick={onPreview} className={cn('relative flex h-[104px] w-full items-center justify-center overflow-hidden', SURFACE.inset)} aria-label={`Voir ${docTitle(doc)}`}>
        {img && url ? (
          <img src={url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
        ) : (
          <span className="flex flex-col items-center gap-1">
            {img ? <ImageIcon className={cn('h-7 w-7', TEXT.muted)} /> : <FileText className={cn('h-7 w-7', isPdf(doc) ? 'text-rose-600 dark:text-rose-400' : TEXT.muted)} />}
            <span className={cn('text-[10px] font-bold uppercase tracking-wider', TEXT.muted)}>{isPdf(doc) ? 'PDF' : img ? 'Photo' : 'Fichier'}</span>
          </span>
        )}
      </button>
      {/* Les actions se posent sur la miniature : au survol sur ordinateur, toujours sur téléphone. */}
      <div className="absolute right-1.5 top-1.5 flex gap-0.5 rounded-md bg-white/95 p-0.5 ring-1 ring-black/[0.08] transition-opacity dark:bg-black/70 dark:ring-white/[0.1] lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100">
        <IconButton icon={Download} label="Télécharger" onClick={() => downloadCargoDocument(doc)} />
        {canManage && <IconButton icon={Pencil} label="Renommer ou déplacer" onClick={onEdit} />}
        {canManage && <IconButton icon={Trash2} label="Supprimer" danger onClick={onDelete} />}
      </div>
      <button type="button" onClick={onPreview} className="block w-full px-2.5 pb-2 pt-1.5 text-left">
        <div className={cn('truncate text-[12.5px] max-lg:text-[14px] font-semibold', TEXT.strong)} title={docTitle(doc)}>{docTitle(doc)}</div>
        <div className={cn('truncate text-[11px] max-lg:text-[12.5px] tabular-nums', TEXT.muted)}>
          {absShort(doc.created_at)}{doc.size_bytes ? ` · ${fileSize(doc.size_bytes)}` : ''}
        </div>
        {doc.note && <div className={cn('mt-0.5 truncate text-[11px] max-lg:text-[12.5px]', TEXT.body)} title={doc.note}>{doc.note}</div>}
      </button>
    </div>
  );
}

/* ── Une pièce du classeur ─────────────────────────────────────────────────── */

function FolderCard({
  folder, files, urls, canManage, uploading, onUpload, onEditFolder, onDeleteFolder, onPreview, onEditFile, onDeleteFile,
}: {
  folder: CargoDocFolder | null;
  files: CargoDocument[];
  urls: Record<string, string>;
  canManage: boolean;
  uploading: boolean;
  onUpload: (files: File[]) => void;
  onEditFolder?: () => void;
  onDeleteFolder?: () => void;
  onPreview: (doc: CargoDocument) => void;
  onEditFile: (doc: CargoDocument) => void;
  onDeleteFile: (doc: CargoDocument) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const { icon, tone } = folder ? look(folder.category) : { icon: FolderOpen, tone: 'neutral' as SectionTone };
  const progress = folder ? folderProgress(folder, files.length) : null;
  const missing = folder?.expected_count ? Math.max(0, folder.expected_count - files.length) : 0;

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (!canManage) return;
    const list = Array.from(e.dataTransfer.files ?? []);
    if (list.length) onUpload(list);
  };

  return (
    <Section
      icon={icon}
      tone={tone}
      title={folder ? folder.title : 'Non classés'}
      subtitle={folder ? [categoryLabel(folder.category), folder.note].filter(Boolean).join(' · ') : 'Fichiers sans pièce : range-les avec le crayon'}
      meta={progress ? <Tag tone={progress.complete ? 'success' : files.length > 0 ? 'warn' : 'neutral'}>{progress.label}</Tag> : <Tag>{files.length}</Tag>}
      action={canManage ? (
        <span className="flex items-center gap-0.5">
          {folder && <ToolButton icon={Upload} onClick={() => inputRef.current?.click()} disabled={uploading}>{uploading ? 'Envoi…' : 'Ajouter'}</ToolButton>}
          {onEditFolder && <IconButton icon={Pencil} label="Modifier la pièce" onClick={onEditFolder} />}
          {onDeleteFolder && <IconButton icon={Trash2} label="Supprimer la pièce" danger onClick={onDeleteFolder} />}
        </span>
      ) : undefined}
      bodyClassName="p-4"
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => { const l = Array.from(e.target.files ?? []); e.target.value = ''; if (l.length) onUpload(l); }}
      />
      <div
        onDragOver={(e) => { if (canManage && folder) { e.preventDefault(); setOver(true); } }}
        onDragLeave={() => setOver(false)}
        onDrop={folder ? onDrop : undefined}
        className={cn('rounded-[12px] transition-colors', over && 'bg-primary/5 ring-2 ring-dashed ring-primary/40')}
      >
        {files.length === 0 ? (
          <button
            type="button"
            disabled={!canManage || !folder}
            onClick={() => inputRef.current?.click()}
            className={cn(
              'flex w-full items-center justify-center gap-3 rounded-[12px] border border-dashed border-black/[0.14] px-4 py-4 text-left dark:border-white/[0.16]',
              canManage && 'hover:border-primary/50 hover:bg-primary/[0.03]',
            )}
          >
            <Upload className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
            <span className="min-w-0">
              <span className={cn('block text-[13px] max-lg:text-[15px] font-semibold', TEXT.strong)}>
                {canManage ? 'Glisse tes fichiers ici, ou clique pour choisir' : 'Aucun fichier'}
              </span>
              {canManage && <span className={cn('block text-[11.5px] max-lg:text-[13px]', TEXT.muted)}>PDF ou photos, 10 Mo par fichier, plusieurs à la fois</span>}
            </span>
          </button>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-3 max-sm:grid-cols-2">
            {files.map((d) => (
              <FileTile
                key={d.id}
                doc={d}
                url={urls[d.storage_path]}
                canManage={canManage}
                onPreview={() => onPreview(d)}
                onEdit={() => onEditFile(d)}
                onDelete={() => onDeleteFile(d)}
              />
            ))}
            {canManage && folder && (!folder.expected_count || missing > 0) && (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex min-h-[150px] flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed border-black/[0.14] text-center hover:border-primary/50 hover:bg-primary/[0.03] dark:border-white/[0.16]"
              >
                <Plus className={cn('h-5 w-5', TEXT.muted)} />
                <span className={cn('text-[12px] max-lg:text-[14px] font-semibold', TEXT.body)}>Ajouter</span>
                {missing > 0 && <span className="text-[11px] max-lg:text-[13px] font-semibold text-amber-700 dark:text-amber-400">{missing} manquant{missing > 1 ? 's' : ''}</span>}
              </button>
            )}
          </div>
        )}
      </div>
    </Section>
  );
}

/* ── Dialogues ─────────────────────────────────────────────────────────── */

function CategoryPicker({ value, onChange }: { value: DocCategory; onChange: (c: DocCategory) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
      {DOC_CATEGORIES.map((c) => {
        const { icon: Icon } = CATEGORY_LOOK[c];
        const on = c === value;
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={cn('flex h-9 max-lg:h-11 items-center gap-2 rounded-md px-2.5 text-left text-[12.5px] max-lg:text-[14px] font-semibold', on ? PRIMARY_PILL : SOFT_PILL)}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{DOC_CATEGORY_META[c].label}</span>
          </button>
        );
      })}
    </div>
  );
}

function FolderDialog({
  open, initial, onClose, onSave, saving,
}: {
  open: boolean; initial: CargoDocFolder | null; onClose: () => void; saving: boolean;
  onSave: (v: { title: string; category: DocCategory; expected_count: number | null; note: string | null }) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [category, setCategory] = useState<DocCategory>(isDocCategory(initial?.category) ? initial!.category as DocCategory : 'OTHER');
  const [expected, setExpected] = useState<number | null>(initial?.expected_count ?? null);
  const [note, setNote] = useState(initial?.note ?? '');
  const valid = title.trim().length > 0;
  const submit = () => { if (valid) onSave({ title: title.trim(), category, expected_count: expected && expected > 0 ? expected : null, note: note.trim() || null }); };
  return (
    <CenterDialog
      open={open}
      onClose={onClose}
      onConfirm={submit}
      width={600}
      title={initial ? 'Modifier la pièce' : 'Nouvelle pièce'}
      footer={
        <>
          <button type="button" onClick={onClose} className={cn('h-9 px-4 text-[13px] max-lg:text-[15px] font-semibold', SOFT_PILL)}>Annuler</button>
          <button type="button" onClick={submit} disabled={!valid || saving} className={cn('h-9 px-4 text-[13px] max-lg:text-[15px] font-bold disabled:opacity-60', PRIMARY_PILL)}>
            {saving ? 'Enregistrement…' : initial ? 'Enregistrer' : 'Créer la pièce'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <FieldLabel htmlFor="folder-title">Nom de la pièce</FieldLabel>
          <TextField id="folder-title" size="sm" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bill of lading (originaux), Certificats CICQ, Photos du chargement…" autoFocus />
        </div>
        <div>
          <FieldLabel hint={DOC_CATEGORY_META[category].hint}>Catégorie</FieldLabel>
          <CategoryPicker value={category} onChange={setCategory} />
        </div>
        <div className="grid grid-cols-[160px_1fr] gap-4 max-sm:grid-cols-1">
          <div>
            <FieldLabel htmlFor="folder-expected" hint="facultatif">Fichiers attendus</FieldLabel>
            <NumberField id="folder-expected" size="sm" value={expected} onValueChange={setExpected} min={1} placeholder="ex. 3" />
          </div>
          <div>
            <FieldLabel htmlFor="folder-note" hint="facultatif">Note</FieldLabel>
            <TextArea id="folder-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Qui l'a, où on en est, ce qu'il faut demander…" />
          </div>
        </div>
      </div>
    </CenterDialog>
  );
}

function FileDialog({
  doc, folders, onClose, onSave, saving,
}: {
  doc: CargoDocument; folders: CargoDocFolder[]; onClose: () => void; saving: boolean;
  onSave: (v: { title: string | null; note: string | null; folder_id: string | null }) => void;
}) {
  const [title, setTitle] = useState(doc.title ?? '');
  const [note, setNote] = useState(doc.note ?? '');
  const [folderId, setFolderId] = useState<string>(doc.folder_id ?? 'none');
  const submit = () => onSave({ title: title.trim() || null, note: note.trim() || null, folder_id: folderId === 'none' ? null : folderId });
  return (
    <CenterDialog
      open
      onClose={onClose}
      onConfirm={submit}
      width={540}
      title="Renommer ou déplacer"
      footer={
        <>
          <button type="button" onClick={onClose} className={cn('h-9 px-4 text-[13px] max-lg:text-[15px] font-semibold', SOFT_PILL)}>Annuler</button>
          <button type="button" onClick={submit} disabled={saving} className={cn('h-9 px-4 text-[13px] max-lg:text-[15px] font-bold disabled:opacity-60', PRIMARY_PILL)}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className={cn('text-[12px] max-lg:text-[14px]', TEXT.muted)}>Fichier d'origine : <span className={cn('font-medium', TEXT.body)}>{doc.file_name}</span></p>
        <div>
          <FieldLabel htmlFor="file-title">Nom affiché</FieldLabel>
          <TextField id="file-title" size="sm" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={doc.file_name} autoFocus />
        </div>
        <div>
          <FieldLabel>Pièce</FieldLabel>
          <SelectField
            id="file-folder"
            size="sm"
            value={folderId}
            onValueChange={setFolderId}
            options={[{ value: 'none', label: 'Non classé' }, ...folders.map((f) => ({ value: f.id, label: f.title }))]}
          />
        </div>
        <div>
          <FieldLabel htmlFor="file-note" hint="facultatif">Note</FieldLabel>
          <TextArea id="file-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Original 1/3, reçu de Kassumaye le…" />
        </div>
      </div>
    </CenterDialog>
  );
}

function StarterDialog({ open, onClose, onCreate, saving }: { open: boolean; onClose: () => void; saving: boolean; onCreate: (picked: typeof STARTER_FOLDERS) => void }) {
  const [picked, setPicked] = useState<Set<number>>(() => new Set(STARTER_FOLDERS.map((_, i) => i)));
  const toggle = (i: number) => setPicked((p) => { const n = new Set(p); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  const submit = () => onCreate(STARTER_FOLDERS.filter((_, i) => picked.has(i)));
  return (
    <CenterDialog
      open={open}
      onClose={onClose}
      onConfirm={submit}
      width={560}
      title="Préparer le classeur"
      footer={
        <>
          <button type="button" onClick={onClose} className={cn('h-9 px-4 text-[13px] max-lg:text-[15px] font-semibold', SOFT_PILL)}>Annuler</button>
          <button type="button" onClick={submit} disabled={picked.size === 0 || saving} className={cn('h-9 px-4 text-[13px] max-lg:text-[15px] font-bold disabled:opacity-60', PRIMARY_PILL)}>
            {saving ? 'Création…' : `Créer ${picked.size} pièce${picked.size > 1 ? 's' : ''}`}
          </button>
        </>
      }
    >
      <p className={cn('mb-3 text-[13px] max-lg:text-[15px]', TEXT.body)}>Les pièces habituelles d'un conteneur. Décoche ce qui ne sert pas ; tu pourras en créer d'autres, les renommer ou les supprimer.</p>
      <ul className="space-y-1.5">
        {STARTER_FOLDERS.map((f, i) => {
          const { icon, tone } = CATEGORY_LOOK[f.category];
          return (
            <li key={f.title}>
              <label className={cn('flex cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2.5 ring-1 ring-black/[0.06] dark:ring-white/[0.07]', picked.has(i) ? 'bg-primary/[0.04]' : '')}>
                <input type="checkbox" checked={picked.has(i)} onChange={() => toggle(i)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                <IconTile icon={icon} tone={tone} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-[13px] max-lg:text-[15px] font-semibold', TEXT.strong)}>{f.title}</span>
                  <span className={cn('block text-[11.5px] max-lg:text-[13px]', TEXT.muted)}>{DOC_CATEGORY_META[f.category].hint}{f.expected_count ? ` · ${f.expected_count} attendu${f.expected_count > 1 ? 's' : ''}` : ''}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </CenterDialog>
  );
}

/* ── L'onglet ─────────────────────────────────────────────────────────── */

export function TabDocuments({ shipment: s, canManage }: { shipment: CargoShipment; canManage: boolean }) {
  const { data: folders } = useCargoDocFolders(s.id);
  const { data: docsAll } = useCargoDocuments(s.id);
  const docs = useMemo(() => (docsAll ?? []).filter((d) => !d.cost_id || d.folder_id), [docsAll]);
  const { data: urls } = useCargoDocumentUrls(docs);
  const upload = useUploadCargoDocuments();
  const createFolders = useCreateCargoDocFolders();
  const updateFolder = useUpdateCargoDocFolder();
  const deleteFolder = useDeleteCargoDocFolder();
  const updateDoc = useUpdateCargoDocument();
  const deleteDoc = useDeleteCargoDocument();

  const [query, setQuery] = useState('');
  const [uploadingFolder, setUploadingFolder] = useState<string | null>(null);
  const [folderDialog, setFolderDialog] = useState<{ folder: CargoDocFolder | null } | null>(null);
  const [starterOpen, setStarterOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<CargoDocument | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<CargoDocument | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<CargoDocFolder | null>(null);
  const [preview, setPreview] = useState<{ docs: CargoDocument[]; index: number } | null>(null);

  const list = folders ?? [];
  const byFolder = useMemo(() => {
    const m: Record<string, CargoDocument[]> = {};
    for (const d of docs) (m[d.folder_id ?? 'none'] ??= []).push(d);
    for (const k of Object.keys(m)) m[k].sort((a, b) => a.created_at.localeCompare(b.created_at));
    return m;
  }, [docs]);
  const unfiled = byFolder.none ?? [];

  const needle = query.trim().toLowerCase();
  const visibleFolders = needle
    ? list.filter((f) => f.title.toLowerCase().includes(needle) || categoryLabel(f.category).toLowerCase().includes(needle) || (byFolder[f.id] ?? []).some((d) => docTitle(d).toLowerCase().includes(needle)))
    : list;

  const complete = list.filter((f) => folderProgress(f, (byFolder[f.id] ?? []).length).complete).length;
  const nextPosition = list.reduce((m, f) => Math.max(m, f.position), 0) + 1;

  const doUpload = (folder: CargoDocFolder | null, files: File[]) => {
    setUploadingFolder(folder?.id ?? 'none');
    upload.mutate(
      { shipmentId: s.id, kind: folder?.category ?? 'OTHER', folderId: folder?.id ?? null, files },
      { onSettled: () => setUploadingFolder(null) },
    );
  };

  const looseInput = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-5">
      {/* Bandeau du classeur : où on en est, chercher, créer. */}
      <div className={cn('flex flex-wrap items-center gap-x-6 gap-y-3 rounded-[14px] px-5 py-4', SURFACE.card, SURFACE.shadow)}>
        <div className="flex items-center gap-3">
          <IconTile icon={FolderOpen} tone="blue" size="lg" />
          <div>
            <div className={cn('text-[15px] max-lg:text-[17px] font-bold', TEXT.strong)}>Classeur du conteneur</div>
            <div className={cn('text-[12.5px] max-lg:text-[14px] tabular-nums', TEXT.muted)}>
              {list.length} pièce{list.length > 1 ? 's' : ''} · {docs.length} fichier{docs.length > 1 ? 's' : ''}
              {list.length > 0 && ` · ${complete} complète${complete > 1 ? 's' : ''}`}
            </div>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2 max-sm:ml-0 max-sm:w-full">
          <div className="w-[240px] max-sm:w-full">
            <TextField id="docs-search" size="sm" variant="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Chercher une pièce, un fichier…" leftIcon={<Search className="h-4 w-4" />} />
          </div>
          {canManage && (
            <>
              <input ref={looseInput} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => { const l = Array.from(e.target.files ?? []); e.target.value = ''; if (l.length) doUpload(null, l); }} />
              <ToolButton icon={FolderInput} onClick={() => looseInput.current?.click()} disabled={upload.isPending}>Déposer sans classer</ToolButton>
              <ToolButton icon={FolderPlus} primary onClick={() => setFolderDialog({ folder: null })}>Nouvelle pièce</ToolButton>
            </>
          )}
        </div>
      </div>

      {list.length === 0 && unfiled.length === 0 ? (
        <Section icon={FolderOpen} tone="blue" title="Le classeur est vide">
          <Empty
            icon={FolderPlus}
            title="Aucune pièce pour l'instant"
            action={canManage ? (
              <div className="flex flex-wrap justify-center gap-2">
                <ToolButton icon={Plus} primary onClick={() => setStarterOpen(true)}>Préparer les pièces habituelles</ToolButton>
                <ToolButton icon={FolderPlus} onClick={() => setFolderDialog({ folder: null })}>Créer une pièce</ToolButton>
              </div>
            ) : undefined}
          >
            Une pièce, c'est une case où ranger des fichiers : « Bill of lading (originaux) », « Certificats CICQ », « Photos du
            chargement »… Tu les nommes comme tu veux et tu y mets autant de PDF et de photos qu'il faut.
          </Empty>
        </Section>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
          {visibleFolders.map((f) => (
            <FolderCard
              key={f.id}
              folder={f}
              files={byFolder[f.id] ?? []}
              urls={urls ?? {}}
              canManage={canManage}
              uploading={uploadingFolder === f.id}
              onUpload={(files) => doUpload(f, files)}
              onEditFolder={() => setFolderDialog({ folder: f })}
              onDeleteFolder={() => setDeletingFolder(f)}
              onPreview={(d) => { const l = byFolder[f.id] ?? []; setPreview({ docs: l, index: l.indexOf(d) }); }}
              onEditFile={setEditingDoc}
              onDeleteFile={setDeletingDoc}
            />
          ))}
          {needle && visibleFolders.length === 0 && (
            <p className={cn('py-6 text-center text-[13px] xl:col-span-2', TEXT.muted)}>Aucune pièce ne correspond à « {query} ».</p>
          )}
          {unfiled.length > 0 && !needle && (
            <div className="xl:col-span-2">
              <FolderCard
                folder={null}
                files={unfiled}
                urls={urls ?? {}}
                canManage={canManage}
                uploading={uploadingFolder === 'none'}
                onUpload={(files) => doUpload(null, files)}
                onPreview={(d) => setPreview({ docs: unfiled, index: unfiled.indexOf(d) })}
                onEditFile={setEditingDoc}
                onDeleteFile={setDeletingDoc}
              />
            </div>
          )}
          {canManage && (
            <button
              type="button"
              onClick={() => setFolderDialog({ folder: null })}
              className={cn('flex w-full items-center justify-center gap-2 rounded-[14px] xl:col-span-2 border border-dashed border-black/[0.14] py-4 text-[13px] max-lg:text-[15px] font-semibold hover:border-primary/50 hover:bg-primary/[0.03] dark:border-white/[0.16]', TEXT.body)}
            >
              <FolderPlus className="h-4 w-4" /> Créer une autre pièce
            </button>
          )}
        </div>
      )}

      <p className={cn('flex items-center gap-2 text-[12px] max-lg:text-[14px]', TEXT.muted)}>
        <Banknote className="h-3.5 w-3.5 shrink-0" />
        Les justificatifs de coûts (reçus, factures payées) se rangent dans l'onglet Coûts, ligne par ligne. Les fichiers sont privés :
        seuls les membres autorisés du module Cargo les ouvrent.
      </p>

      {folderDialog && (
        <FolderDialog
          open
          initial={folderDialog.folder}
          saving={createFolders.isPending || updateFolder.isPending}
          onClose={() => setFolderDialog(null)}
          onSave={(v) => {
            if (folderDialog.folder) {
              updateFolder.mutate(
                { id: folderDialog.folder.id, shipmentId: s.id, patch: v, files: byFolder[folderDialog.folder.id] },
                { onSuccess: () => setFolderDialog(null) },
              );
            } else {
              createFolders.mutate({ shipmentId: s.id, folders: [{ ...v, position: nextPosition }] }, { onSuccess: () => setFolderDialog(null) });
            }
          }}
        />
      )}

      <StarterDialog
        open={starterOpen}
        saving={createFolders.isPending}
        onClose={() => setStarterOpen(false)}
        onCreate={(picked) => createFolders.mutate(
          { shipmentId: s.id, folders: picked.map((f, i) => ({ ...f, position: nextPosition + i })) },
          { onSuccess: () => setStarterOpen(false) },
        )}
      />

      {editingDoc && (
        <FileDialog
          doc={editingDoc}
          folders={list}
          saving={updateDoc.isPending}
          onClose={() => setEditingDoc(null)}
          onSave={(v) => {
            const target = list.find((f) => f.id === v.folder_id);
            updateDoc.mutate(
              { id: editingDoc.id, patch: { ...v, kind: target?.category ?? editingDoc.kind } },
              { onSuccess: () => setEditingDoc(null) },
            );
          }}
        />
      )}

      <CenterDialog
        open={!!deletingDoc}
        onClose={() => setDeletingDoc(null)}
        title="Supprimer ce fichier ?"
        footer={
          <>
            <button type="button" onClick={() => setDeletingDoc(null)} className={cn('h-9 px-4 text-[13px] font-semibold', SOFT_PILL)}>Garder</button>
            <ToolButton icon={Trash2} danger onClick={() => deletingDoc && deleteDoc.mutate(deletingDoc, { onSuccess: () => setDeletingDoc(null) })}>Supprimer</ToolButton>
          </>
        }
      >
        <p className={cn('text-[13px] max-lg:text-[15px]', TEXT.body)}>
          <b>{deletingDoc ? docTitle(deletingDoc) : ''}</b> sera effacé du classeur et du stockage. On ne pourra pas le récupérer.
        </p>
      </CenterDialog>

      <CenterDialog
        open={!!deletingFolder}
        onClose={() => setDeletingFolder(null)}
        title="Supprimer cette pièce ?"
        footer={(() => {
          const files = deletingFolder ? byFolder[deletingFolder.id] ?? [] : [];
          const run = (withFiles: boolean) => deletingFolder && deleteFolder.mutate({ folder: deletingFolder, files, withFiles }, { onSuccess: () => setDeletingFolder(null) });
          return (
            <>
              <button type="button" onClick={() => setDeletingFolder(null)} className={cn('h-9 px-4 text-[13px] font-semibold', SOFT_PILL)}>Annuler</button>
              {files.length > 0 && <ToolButton onClick={() => run(false)}>Garder les fichiers</ToolButton>}
              <ToolButton icon={Trash2} danger onClick={() => run(true)}>{files.length > 0 ? `Tout supprimer (${files.length})` : 'Supprimer'}</ToolButton>
            </>
          );
        })()}
      >
        <p className={cn('text-[13px] max-lg:text-[15px]', TEXT.body)}>
          <b>{deletingFolder?.title}</b>
          {deletingFolder && (byFolder[deletingFolder.id] ?? []).length > 0
            ? ` contient ${(byFolder[deletingFolder.id] ?? []).length} fichier(s). « Garder les fichiers » les met dans « Non classés ».`
            : ' est vide.'}
        </p>
      </CenterDialog>

      {preview && (
        <DocPreview docs={preview.docs} index={preview.index} urls={urls ?? {}} onIndex={(i) => setPreview({ ...preview, index: i })} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}
