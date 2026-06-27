// ============================================================
// MODULE DEPOTS — ProofUpload (from scratch)
// Multi-file upload with drag-drop, preview, confirmation
// Max 5 files, images + PDF
// ============================================================
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('deposits');
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
        <Upload className="w-5 h-5 text-[#8B5CF6]" />
        <h3 className="font-semibold text-[#1B1A24] dark:text-[#F2F1F7]">{t('proof.title')}</h3>
      </div>

      {/* Drop zone */}
      {!atLimit && (
        <div
          className={cn(
            'cursor-pointer rounded-2xl border-2 border-dashed p-4 text-center transition-all',
            dragActive
              ? 'border-[#8B5CF6] bg-[#EDEAFA]/60 dark:bg-[#272252]/60'
              : 'border-black/15 hover:border-[#8B5CF6] hover:bg-[#EDEAFA]/40 dark:border-white/15 dark:hover:bg-[#272252]/40',
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
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#EDEAFA] dark:bg-[#2F2C3D]">
                <Upload className="w-7 h-7 text-[#8B5CF6]" />
              </div>
              <p className="mb-1 text-sm font-medium text-[#1B1A24] dark:text-[#F2F1F7]">
                {t('proof.dragFiles')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('proof.orClick')}
              </p>
            </>
          ) : (
            <div className="flex items-center justify-center gap-2 text-[#8B5CF6]">
              <Upload className="w-4 h-4" />
              <p className="text-sm font-medium">{t('proof.addMore')}</p>
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
          {t('proof.camera')}
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
          {t('proof.gallery')}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        {t('proof.acceptedFormats')}
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
              {filesWithPreview.length > 1
                ? t('proof.filesSelected_plural', { count: filesWithPreview.length })
                : t('proof.filesSelected', { count: filesWithPreview.length })}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveAll();
              }}
              className="text-[#C0504D] hover:text-[#C0504D] dark:text-[#E79A9A]"
            >
              <X className="w-4 h-4 mr-1" />
              {t('proof.removeAll')}
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {filesWithPreview.map((fileItem) => (
              <div
                key={fileItem.id}
                className="group relative aspect-square overflow-hidden rounded-2xl bg-[#F4F3FA] ring-1 ring-black/[0.06] dark:bg-[#2A2836] dark:ring-white/[0.06]"
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
                    <FileCheck className="w-8 h-8 text-[#8B5CF6] mb-1" />
                    <p className="text-[10px] text-muted-foreground text-center truncate w-full">
                      {fileItem.file.name}
                    </p>
                  </div>
                )}

                {/* Remove button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-6 w-6 bg-[#C0504D] text-white opacity-0 transition-opacity hover:bg-[#C0504D]/90 group-hover:opacity-100"
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
            className="h-12 w-full rounded-full bg-[#1C1B22] text-white hover:bg-[#1C1B22]/90 dark:bg-[#F2F1F7] dark:text-[#1B1A24] dark:hover:bg-[#F2F1F7]/90"
            onClick={() => setShowConfirmDialog(true)}
            disabled={props.isSubmitting}
          >
            {props.isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('proof.sending')}
              </>
            ) : (
              <>
                <FileCheck className="w-4 h-4 mr-2" />
                {filesWithPreview.length > 1
                  ? t('proof.confirmSend_plural', { count: filesWithPreview.length })
                  : t('proof.confirmSend', { count: filesWithPreview.length })}
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            {t('proof.attestation')}
          </p>
        </div>
      )}

      {/* Confirmation dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-[#8B5CF6]" />
              {t('proof.confirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {filesWithPreview.length > 1
                ? t('proof.confirmDescription_plural', { count: filesWithPreview.length })
                : t('proof.confirmDescription', { count: filesWithPreview.length })}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-2">
            {filesWithPreview.slice(0, 4).map((fileItem) => (
              <div
                key={fileItem.id}
                className="aspect-square overflow-hidden rounded-2xl bg-[#F4F3FA] ring-1 ring-black/[0.06] dark:bg-[#2A2836] dark:ring-white/[0.06]"
              >
                {fileItem.previewUrl ? (
                  <img
                    src={fileItem.previewUrl}
                    alt={fileItem.file.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <FileCheck className="w-6 h-6 text-[#8B5CF6]" />
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
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowConfirmDialog(false);
                props.onConfirm();
              }}
              className="rounded-full bg-[#1C1B22] text-white hover:bg-[#1C1B22]/90 dark:bg-[#F2F1F7] dark:text-[#1B1A24] dark:hover:bg-[#F2F1F7]/90"
            >
              <FileCheck className="w-4 h-4 mr-2" />
              {t('common:confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image viewer dialog */}
      <Dialog open={!!viewingImage} onOpenChange={() => setViewingImage(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>{t('proof.previewTitle')}</DialogTitle>
          </DialogHeader>
          <div className="p-4 pt-2">
            {viewingImage && (
              <img
                src={viewingImage}
                alt={t('proof.previewAlt')}
                className="w-full max-h-[70vh] object-contain rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
