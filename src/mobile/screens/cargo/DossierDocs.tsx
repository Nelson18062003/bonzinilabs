/**
 * Dossier conteneur · onglet Documents, refonte v2 (maquette 04/03).
 *
 * Une ligne par pièce du classeur (B/L, télex, packing list, factures…) avec
 * son état (Reçu · Attendu · N manquent). Toucher une pièce ouvre sa feuille :
 * ses fichiers (ouvrir, télécharger, renommer, déplacer, supprimer), déposer
 * des fichiers, modifier ou supprimer la pièce. « Ajouter une pièce » en bas ;
 * « Déposer sans classer » et « Préparer les pièces habituelles » sous la liste.
 * Mêmes hooks que le classeur de l'ordinateur (TabDocuments).
 */
import { useMemo, useRef, useState } from 'react';
import { Download, ExternalLink, FileText, FolderInput, FolderPlus, ListChecks, Pencil, Trash2, Upload } from 'lucide-react';
import {
  downloadCargoDocument, openCargoDocument, useCargoDocFolders, useCargoDocuments, useCreateCargoDocFolders, useDeleteCargoDocFolder,
  useDeleteCargoDocument, useUpdateCargoDocFolder, useUpdateCargoDocument, useUploadCargoDocuments,
} from '@/hooks/useCargo';
import {
  DOC_CATEGORIES, STARTER_FOLDERS, categoryLabel, docTitle, fileSize, folderProgress, type CargoDocFolder, type DocCategory,
} from '@/lib/cargo/documents';
import type { CargoDocument, CargoShipment } from '@/lib/cargo/model';
import { fmtDay } from '@/lib/cargo/model';
import {
  ActionSheet, BigButton, BottomSheet, ConfirmSheet, Dock, EmptyLine, FormField, IconCircle, ItemList, ItemRow, TextArea, TextInput, useSheet,
  type Tone,
} from '@/mobile/designKit';
import { CapsLabel, ChipRow } from '@/mobile/components/cargo/v2';

const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp';

function folderTag(f: CargoDocFolder, count: number): { tone: Tone; label: string } {
  const p = folderProgress(f, count);
  if (p.complete) return { tone: 'success', label: 'Reçu' };
  if (count === 0) return { tone: 'pending', label: 'Attendu' };
  const missing = (f.expected_count ?? 0) - count;
  return { tone: 'pending', label: missing > 1 ? `${missing} manquent` : `${missing} manque` };
}

function FolderForm({ open, onClose, folder, onSave, saving }: { open: boolean; onClose: () => void; folder: CargoDocFolder | null; onSave: (v: { title: string; category: DocCategory; expected_count: number | null; note: string | null }) => void; saving: boolean }) {
  const [title, setTitle] = useState(folder?.title ?? '');
  const [category, setCategory] = useState<DocCategory>((folder?.category as DocCategory) ?? 'OTHER');
  const [expected, setExpected] = useState(folder?.expected_count ? String(folder.expected_count) : '');
  const [note, setNote] = useState(folder?.note ?? '');
  const n = expected.trim() ? Number(expected) : null;
  const valid = title.trim().length > 0 && (n == null || (Number.isInteger(n) && n > 0 && n <= 99));
  return (
    <BottomSheet open={open} onClose={onClose} title={folder ? 'Modifier la pièce' : 'Nouvelle pièce'}>
      <div className="space-y-4">
        <FormField label="Titre" htmlFor="doc-title"><TextInput id="doc-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bill of lading (originaux)" /></FormField>
        <div>
          <CapsLabel className="mb-2">Catégorie</CapsLabel>
          <ChipRow className="-mx-6 px-6" options={DOC_CATEGORIES.map((c) => ({ value: c, label: categoryLabel(c) }))} value={category} onChange={setCategory} />
        </div>
        <FormField label="Fichiers attendus" htmlFor="doc-n"><TextInput id="doc-n" inputMode="numeric" value={expected} onChange={(e) => setExpected(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="Facultatif" /></FormField>
        <FormField label="Note" htmlFor="doc-note"><TextArea id="doc-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Facultatif" /></FormField>
        <BigButton disabled={!valid} loading={saving} onClick={() => onSave({ title: title.trim(), category, expected_count: n, note: note.trim() || null })}>Enregistrer</BigButton>
      </div>
    </BottomSheet>
  );
}

export function DossierDocs({ s, canManage }: { s: CargoShipment; canManage: boolean }) {
  const { data: folders } = useCargoDocFolders(s.id);
  const { data: docsAll } = useCargoDocuments(s.id);
  const docs = useMemo(() => (docsAll ?? []).filter((d) => !d.cost_id || d.folder_id), [docsAll]);
  const upload = useUploadCargoDocuments();
  const createFolders = useCreateCargoDocFolders();
  const updateFolder = useUpdateCargoDocFolder();
  const deleteFolder = useDeleteCargoDocFolder();
  const updateDoc = useUpdateCargoDocument();
  const deleteDoc = useDeleteCargoDocument();
  const list = useMemo(() => folders ?? [], [folders]);
  const byFolder = useMemo(() => {
    const m: Record<string, CargoDocument[]> = {};
    for (const d of docs) (m[d.folder_id ?? 'none'] ??= []).push(d);
    return m;
  }, [docs]);
  const unfiled = byFolder.none ?? [];

  const [openFolder, setOpenFolder] = useState<CargoDocFolder | 'none' | null>(null);
  const [form, setForm] = useState<{ folder: CargoDocFolder | null } | null>(null);
  const [fileMenu, setFileMenu] = useState<CargoDocument | null>(null);
  const [rename, setRename] = useState<{ doc: CargoDocument; title: string } | null>(null);
  const [move, setMove] = useState<CargoDocument | null>(null);
  const [delFile, setDelFile] = useState<CargoDocument | null>(null);
  const [delFolder, setDelFolder] = useState<CargoDocFolder | null>(null);
  const folderMore = useSheet();
  const input = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<CargoDocFolder | null>(null);

  const pickFiles = (folder: CargoDocFolder | null) => { uploadTarget.current = folder; input.current?.click(); };
  const onFiles = (files: File[]) => {
    const f = uploadTarget.current;
    if (files.length) upload.mutate({ shipmentId: s.id, kind: f?.category ?? 'OTHER', folderId: f?.id ?? null, files });
  };
  const current = openFolder === 'none' ? null : openFolder;
  const currentFiles = openFolder == null ? [] : byFolder[openFolder === 'none' ? 'none' : openFolder.id] ?? [];
  const nextPosition = list.reduce((m, f) => Math.max(m, f.position), 0) + 1;

  return (
    <>
      <input ref={input} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => { const l = Array.from(e.target.files ?? []); e.target.value = ''; onFiles(l); }} />
      {list.length === 0 && unfiled.length === 0 ? (
        <EmptyLine action={canManage ? { label: 'Préparer les pièces habituelles', onClick: () => createFolders.mutate({ shipmentId: s.id, folders: STARTER_FOLDERS.map((f, i) => ({ ...f, position: i + 1 })) }) } : undefined}>
          Le classeur est vide.
        </EmptyLine>
      ) : (
        <ItemList className="pt-2">
          {list.map((f) => {
            const files = byFolder[f.id] ?? [];
            return (
              <ItemRow
                key={f.id}
                leading={<IconCircle icon={FileText} />}
                title={f.title}
                subtitle={f.note || `${categoryLabel(f.category)} · ${folderProgress(f, files.length).label}`}
                tag={folderTag(f, files.length)}
                onClick={() => setOpenFolder(f)}
              />
            );
          })}
          {unfiled.length > 0 && (
            <ItemRow leading={<IconCircle icon={FolderInput} />} title="Non classés" subtitle={`${unfiled.length} fichier${unfiled.length > 1 ? 's' : ''}`} onClick={() => setOpenFolder('none')} chevron />
          )}
        </ItemList>
      )}

      {canManage && (
        <ItemList className="pt-3">
          <ItemRow leading={<IconCircle icon={Upload} />} title="Déposer sans classer" onClick={() => pickFiles(null)} />
          {list.length > 0 && (
            <ItemRow leading={<IconCircle icon={ListChecks} />} title="Préparer les pièces habituelles" onClick={() => {
              const have = new Set(list.map((f) => f.category));
              const add = STARTER_FOLDERS.filter((f) => !have.has(f.category)).map((f, i) => ({ ...f, position: nextPosition + i }));
              if (add.length) createFolders.mutate({ shipmentId: s.id, folders: add });
            }} />
          )}
        </ItemList>
      )}

      {canManage && <Dock><BigButton onClick={() => setForm({ folder: null })}>Ajouter une pièce</BigButton></Dock>}

      {/* La feuille d'une pièce : ses fichiers et ses gestes. */}
      <BottomSheet open={openFolder != null} onClose={() => setOpenFolder(null)} title={current ? current.title : 'Non classés'}>
        {currentFiles.length === 0 ? <p className="py-3 text-[16px] text-[#5A5A5A]">Aucun fichier.</p> : (
          <div>
            {currentFiles.map((d) => (
              <ItemRow key={d.id} leading={<IconCircle icon={FileText} />} title={docTitle(d)} subtitle={`${fmtDay(new Date(d.created_at))} · ${fileSize(d.size_bytes)}`} onClick={() => setFileMenu(d)} />
            ))}
          </div>
        )}
        {canManage && (
          <div className="mt-4 flex flex-col gap-2.5">
            <BigButton loading={upload.isPending} onClick={() => pickFiles(current)}>Déposer des fichiers</BigButton>
            {current && <BigButton variant="soft" onClick={folderMore.show}>Modifier ou supprimer la pièce</BigButton>}
          </div>
        )}
      </BottomSheet>
      <ActionSheet
        open={folderMore.open}
        onClose={folderMore.hide}
        title={current?.title}
        actions={[
          { label: 'Modifier la pièce', icon: Pencil, onClick: () => { if (current) { setOpenFolder(null); setForm({ folder: current }); } } },
          { label: 'Supprimer la pièce', icon: Trash2, danger: true, onClick: () => { if (current) { setOpenFolder(null); setDelFolder(current); } } },
        ]}
      />
      <ActionSheet
        open={fileMenu != null}
        onClose={() => setFileMenu(null)}
        title={fileMenu ? docTitle(fileMenu) : undefined}
        actions={fileMenu ? [
          { label: 'Ouvrir', icon: ExternalLink, onClick: () => void openCargoDocument(fileMenu) },
          { label: 'Télécharger', icon: Download, onClick: () => void downloadCargoDocument(fileMenu) },
          { label: 'Renommer', icon: Pencil, onClick: () => setRename({ doc: fileMenu, title: docTitle(fileMenu) }), hidden: !canManage },
          { label: 'Déplacer', icon: FolderInput, onClick: () => setMove(fileMenu), hidden: !canManage },
          { label: 'Supprimer le fichier', icon: Trash2, danger: true, onClick: () => setDelFile(fileMenu), hidden: !canManage },
        ] : []}
      />
      <ActionSheet
        open={move != null}
        onClose={() => setMove(null)}
        title="Déplacer vers"
        actions={move ? [
          ...list.filter((f) => f.id !== move.folder_id).map((f) => ({ label: f.title, icon: FolderPlus, onClick: () => updateDoc.mutate({ id: move.id, patch: { folder_id: f.id, kind: f.category } }) })),
          ...(move.folder_id ? [{ label: 'Non classés', icon: FolderInput, onClick: () => updateDoc.mutate({ id: move.id, patch: { folder_id: null } }) }] : []),
        ] : []}
      />
      <BottomSheet open={rename != null} onClose={() => setRename(null)} title="Renommer">
        {rename && (
          <div className="space-y-4">
            <TextInput value={rename.title} onChange={(e) => setRename({ ...rename, title: e.target.value })} aria-label="Nom du fichier" />
            <BigButton loading={updateDoc.isPending} onClick={() => updateDoc.mutate({ id: rename.doc.id, patch: { title: rename.title.trim() || null } }, { onSuccess: () => setRename(null) })}>Enregistrer</BigButton>
          </div>
        )}
      </BottomSheet>
      {form && (
        <FolderForm
          key={form.folder?.id ?? 'new'}
          open
          folder={form.folder}
          onClose={() => setForm(null)}
          saving={createFolders.isPending || updateFolder.isPending}
          onSave={(v) => {
            if (form.folder) updateFolder.mutate({ id: form.folder.id, shipmentId: s.id, patch: v, files: byFolder[form.folder.id] ?? [] }, { onSuccess: () => setForm(null) });
            else createFolders.mutate({ shipmentId: s.id, folders: [{ ...v, position: nextPosition }] }, { onSuccess: () => setForm(null) });
          }}
        />
      )}
      <ConfirmSheet
        open={delFile != null}
        danger
        onClose={() => setDelFile(null)}
        title="Supprimer ce fichier ?"
        subtitle={delFile ? docTitle(delFile) : undefined}
        confirmLabel="Supprimer"
        loading={deleteDoc.isPending}
        onConfirm={() => { if (delFile) deleteDoc.mutate(delFile, { onSuccess: () => setDelFile(null) }); }}
      />
      <ConfirmSheet
        open={delFolder != null}
        danger
        onClose={() => setDelFolder(null)}
        title="Supprimer la pièce ?"
        subtitle={delFolder?.title}
        rows={delFolder ? [{ label: 'Ses fichiers', value: `${(byFolder[delFolder.id] ?? []).length} · non classés` }] : undefined}
        confirmLabel="Supprimer la pièce"
        loading={deleteFolder.isPending}
        onConfirm={() => { if (delFolder) deleteFolder.mutate({ folder: delFolder, files: byFolder[delFolder.id] ?? [], withFiles: false }, { onSuccess: () => setDelFolder(null) }); }}
      />
    </>
  );
}
