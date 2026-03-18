// ============================================================
// MODULE DEPOTS — ProofUpload (from scratch)
// Multi-file upload with drag-drop, preview, confirmation
// Max 5 files, images + PDF
// ============================================================
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Camera, Image, X, FileCheck, Loader2, Eye, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// No hard limit on the number of proof files

interface FileWithPreview {
  file: File;
  previewUrl: string | null;
  id: string;
}

interface ProofUploadProps {
  onFilesSelect: (files: File[]) => void;
  selectedFiles: File[];
  onConfirm: () => void;
  isSubmitting: boolean;
}

interface LegacyProofUploadProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onConfirm: () => void;
  isSubmitting: boolean;
}

type Props = ProofUploadProps | LegacyProofUploadProps;

function isMultiFileProps(props: Props): props is ProofUploadProps {
  return 'onFilesSelect' in props;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export const ProofUpload = (props: Props) => {
  const [dragActive, setDragActive] = useState(false);
  const [filesWithPreview, setFilesWithPreview] = useState<FileWithPreview[]>([]);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isMultiMode = isMultiFileProps(props);

  // Sync internal state when parent clears selectedFiles externally (e.g. after upload success)
  useEffect(() => {
    if (isMultiMode && (props as ProofUploadProps).selectedFiles.length === 0 && filesWithPreview.length > 0) {
      filesWithPreview.forEach(f => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); });
      setFilesWithPreview([]);
      setShowConfirmDialog(false);
    }
  }, [isMultiMode ? (props as ProofUploadProps).selectedFiles?.length : null]);

  const onFilesChange = (files: File[]) => {
    if (isMultiMode) {
      props.onFilesSelect(files);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      props.onFileSelect(files[0] || (null as any));
    }
  };

  const handleFilesChange = (newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const filesToAdd = fileArray;

    const newFilesWithPreview: FileWithPreview[] = filesToAdd.map((file) => ({
      file,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
    }));

    const updatedFiles = [...filesWithPreview, ...newFilesWithPreview];
    setFilesWithPreview(updatedFiles);
    onFilesChange(updatedFiles.map((f) => f.file));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) handleFilesChange(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) handleFilesChange(files);
  };

  const handleRemoveFile = (id: string) => {
    const fileToRemove = filesWithPreview.find((f) => f.id === id);
    if (fileToRemove?.previewUrl) URL.revokeObjectURL(fileToRemove.previewUrl);

    const updatedFiles = filesWithPreview.filter((f) => f.id !== id);
    setFilesWithPreview(updatedFiles);
    onFilesChange(updatedFiles.map((f) => f.file));
  };

  const handleRemoveAll = () => {
    filesWithPreview.forEach((f) => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    });
    setFilesWithPreview([]);
    onFilesChange([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const hasFiles = filesWithPreview.length > 0;
  const atLimit = false; // No file limit

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Upload className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-foreground">Joindre les preuves de dépôt</h3>
      </div>

      {/* Drop zone */}
      {!atLimit && (
        <div
          className={cn(
            'border-2 border-dashed rounded-xl p-4 text-center transition-all cursor-pointer',
            dragActive
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30',
            hasFiles && 'py-3',
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          {!hasFiles ? (
            <>
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="w-7 h-7 text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">
                Glissez vos fichiers ici
              </p>
              <p className="text-xs text-muted-foreground">
                ou cliquez pour parcourir
              </p>
            </>
          ) : (
            <div className="flex items-center justify-center gap-2 text-primary">
              <Upload className="w-4 h-4" />
              <p className="text-sm font-medium">Ajouter d'autres preuves</p>
            </div>
          )}
        </div>
      )}

      {/* Quick action buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          disabled={atLimit}
          onClick={() => {
            if (fileInputRef.current) {
              fileInputRef.current.accept = 'image/*';
              fileInputRef.current.capture = 'environment';
              fileInputRef.current.click();
            }
          }}
        >
          <Camera className="w-4 h-4 mr-2" />
          Appareil photo
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          disabled={atLimit}
          onClick={() => {
            if (fileInputRef.current) {
              fileInputRef.current.accept = 'image/*,.pdf';
              fileInputRef.current.removeAttribute('capture');
              fileInputRef.current.click();
            }
          }}
        >
          <Image className="w-4 h-4 mr-2" />
          Galerie
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Formats acceptés : JPG, PNG, PDF &bull; Max 10 MB par fichier
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        multiple
        onChange={handleInputChange}
        className="hidden"
      />

      {/* Files preview grid */}
      {hasFiles && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">
              {filesWithPreview.length} fichier{filesWithPreview.length > 1 ? 's' : ''} sélectionné
              {filesWithPreview.length > 1 ? 's' : ''}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveAll();
              }}
              className="text-destructive hover:text-destructive"
            >
              <X className="w-4 h-4 mr-1" />
              Tout supprimer
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {filesWithPreview.map((fileItem) => (
              <div
                key={fileItem.id}
                className="relative group aspect-square rounded-lg overflow-hidden border border-border bg-muted/30"
              >
                {fileItem.previewUrl ? (
                  <>
                    <img
                      src={fileItem.previewUrl}
                      alt={fileItem.file.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        variant="secondary"
                        size="icon"
                        className="w-8 h-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewingImage(fileItem.previewUrl);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-2">
                    <FileCheck className="w-8 h-8 text-primary mb-1" />
                    <p className="text-[10px] text-muted-foreground text-center truncate w-full">
                      {fileItem.file.name}
                    </p>
                  </div>
                )}

                {/* Remove button */}
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-1 right-1 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFile(fileItem.id);
                  }}
                >
                  <X className="w-3 h-3" />
                </Button>

                {/* File size badge */}
                <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                  {formatFileSize(fileItem.file.size)}
                </div>
              </div>
            ))}
          </div>

          {/* Confirm button */}
          <Button
            className="w-full btn-primary-gradient"
            onClick={() => setShowConfirmDialog(true)}
            disabled={props.isSubmitting}
          >
            {props.isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Envoi en cours...
              </>
            ) : (
              <>
                <FileCheck className="w-4 h-4 mr-2" />
                Confirmer l'envoi ({filesWithPreview.length} preuve
                {filesWithPreview.length > 1 ? 's' : ''})
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            En confirmant, vous attestez que ces preuves correspondent bien à ce dépôt.
          </p>
        </div>
      )}

      {/* Confirmation dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-primary" />
              Confirmer l'envoi des preuves
            </AlertDialogTitle>
            <AlertDialogDescription>
              Vous allez envoyer {filesWithPreview.length} preuve
              {filesWithPreview.length > 1 ? 's' : ''} de dépôt. Cette action déclenchera la
              vérification par notre équipe.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-2">
            {filesWithPreview.slice(0, 4).map((fileItem) => (
              <div
                key={fileItem.id}
                className="aspect-square rounded-lg overflow-hidden border border-border bg-muted/30"
              >
                {fileItem.previewUrl ? (
                  <img
                    src={fileItem.previewUrl}
                    alt={fileItem.file.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <FileCheck className="w-6 h-6 text-primary" />
                  </div>
                )}
              </div>
            ))}
            {filesWithPreview.length > 4 && (
              <div className="aspect-square rounded-lg bg-muted/50 flex items-center justify-center">
                <span className="text-sm font-medium text-muted-foreground">
                  +{filesWithPreview.length - 4}
                </span>
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowConfirmDialog(false);
                props.onConfirm();
              }}
              className="btn-primary-gradient"
            >
              <FileCheck className="w-4 h-4 mr-2" />
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image viewer dialog */}
      <Dialog open={!!viewingImage} onOpenChange={() => setViewingImage(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>Aperçu de la preuve</DialogTitle>
          </DialogHeader>
          <div className="p-4 pt-2">
            {viewingImage && (
              <img
                src={viewingImage}
                alt="Aperçu"
                className="w-full max-h-[70vh] object-contain rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
