import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
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
} from "@/components/ui/alert-dialog";
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { PaymentProof } from '@/hooks/usePayments';
import { useDeletePaymentProof } from '@/hooks/useAdminPayments';
import { 
  Upload, 
  Download, 
  Trash2, 
  ExternalLink, 
  FileIcon, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  ZoomIn,
  Plus,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface FileWithPreview {
  id: string;
  file: File;
  preview: string | null;
}

interface AdminPaymentProofGalleryProps {
  proofs: PaymentProof[];
  paymentId: string;
  canUpload: boolean;
  canDelete: boolean;
  onUpload: (files: File[], description: string) => Promise<void>;
  isUploading: boolean;
}

export function AdminPaymentProofGallery({
  proofs,
  paymentId,
  canUpload,
  canDelete,
  onUpload,
  isUploading,
}: AdminPaymentProofGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [proofToDelete, setProofToDelete] = useState<string | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileWithPreview[]>([]);
  const [description, setDescription] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const deleteProof = useDeletePaymentProof();

  const isImage = (proof: PaymentProof) => {
    return proof.file_type?.startsWith('image/') || 
           /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(proof.file_name);
  };

  const handlePrev = () => {
    if (selectedIndex !== null && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
  };

  const handleNext = () => {
    if (selectedIndex !== null && selectedIndex < proofs.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') handlePrev();
    if (e.key === 'ArrowRight') handleNext();
    if (e.key === 'Escape') setSelectedIndex(null);
  };

  const handleDeleteProof = async () => {
    if (!proofToDelete) return;
    await deleteProof.mutateAsync(proofToDelete);
    setProofToDelete(null);
    if (selectedIndex !== null && proofs.length <= 1) {
      setSelectedIndex(null);
    }
  };

  const handleFilesChange = (files: FileList | null) => {
    if (!files) return;
    
    const validFiles = Array.from(files).filter(file => {
      const isValidType = file.type.startsWith('image/') || file.type === 'application/pdf';
      const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB
      return isValidType && isValidSize;
    });

    const newFiles = validFiles.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
    }));

    setSelectedFiles(prev => [...prev, ...newFiles]);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFilesChange(e.dataTransfer.files);
  };

  const handleRemoveFile = (id: string) => {
    setSelectedFiles(prev => {
      const toRemove = prev.find(f => f.id === id);
      if (toRemove?.preview) {
        URL.revokeObjectURL(toRemove.preview);
      }
      return prev.filter(f => f.id !== id);
    });
  };

  const handleUploadFiles = async () => {
    if (selectedFiles.length === 0) return;
    
    const files = selectedFiles.map(f => f.file);
    await onUpload(files, description);
    
    // Cleanup previews
    selectedFiles.forEach(f => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    
    setSelectedFiles([]);
    setDescription('');
    setIsUploadDialogOpen(false);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      selectedFiles.forEach(f => {
        if (f.preview) URL.revokeObjectURL(f.preview);
      });
    };
  }, []);

  const selectedProof = selectedIndex !== null ? proofs[selectedIndex] : null;

  return (
    <div className="space-y-4">
      {/* Upload button */}
      {canUpload && (
        <div className="flex justify-end">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setIsUploadDialogOpen(true)}
          >
            <Upload className="w-4 h-4 mr-1" />
            Ajouter des preuves
          </Button>
        </div>
      )}

      {/* Proofs grid */}
      {proofs.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {proofs.map((proof, index) => (
            <div 
              key={proof.id} 
              className="relative group aspect-square rounded-lg overflow-hidden bg-muted border cursor-pointer"
              onClick={() => setSelectedIndex(index)}
            >
              {isImage(proof) ? (
                <img 
                  src={proof.file_url} 
                  alt={proof.file_name}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-2">
                  <FileIcon className="w-10 h-10 text-muted-foreground mb-2" />
                  <p className="text-xs text-center text-muted-foreground truncate w-full">
                    {proof.file_name}
                  </p>
                </div>
              )}
              
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button size="icon" variant="secondary" className="h-8 w-8">
                  <ZoomIn className="w-4 h-4" />
                </Button>
                {canDelete && (
                  <Button 
                    size="icon" 
                    variant="destructive" 
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      setProofToDelete(proof.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
              
              {/* Badge for uploader */}
              <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white">
                {proof.uploaded_by_type === 'admin' ? 'Admin' : 'Client'}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-8">
          Aucune preuve pour le moment
        </p>
      )}

      {/* Lightbox dialog */}
      <Dialog open={selectedIndex !== null} onOpenChange={() => setSelectedIndex(null)}>
        <DialogContent 
          className="max-w-4xl w-[95vw] max-h-[90vh] p-0 overflow-hidden"
          onKeyDown={handleKeyDown}
        >
          {selectedProof && (
            <>
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{selectedProof.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Par {selectedProof.uploaded_by_type === 'admin' ? 'Admin' : 'Client'} • {format(new Date(selectedProof.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" asChild>
                    <a href={selectedProof.file_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </Button>
                  <Button variant="ghost" size="icon" asChild>
                    <a href={selectedProof.file_url} download={selectedProof.file_name}>
                      <Download className="w-4 h-4" />
                    </a>
                  </Button>
                  {canDelete && (
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setProofToDelete(selectedProof.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setSelectedIndex(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Content */}
              <div className="relative flex-1 flex items-center justify-center bg-black/90 min-h-[400px] max-h-[60vh]">
                {isImage(selectedProof) ? (
                  <img 
                    src={selectedProof.file_url} 
                    alt={selectedProof.file_name}
                    className="max-w-full max-h-[60vh] object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-white">
                    <FileIcon className="w-20 h-20 mb-4 opacity-60" />
                    <p className="text-lg font-medium mb-2">{selectedProof.file_name}</p>
                    <Button variant="secondary" asChild>
                      <a href={selectedProof.file_url} download={selectedProof.file_name}>
                        <Download className="w-4 h-4 mr-2" />
                        Télécharger
                      </a>
                    </Button>
                  </div>
                )}

                {/* Navigation */}
                {proofs.length > 1 && (
                  <>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full opacity-80 hover:opacity-100"
                      onClick={handlePrev}
                      disabled={selectedIndex === 0}
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full opacity-80 hover:opacity-100"
                      onClick={handleNext}
                      disabled={selectedIndex === proofs.length - 1}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </Button>
                  </>
                )}
              </div>

              {/* Thumbnails */}
              {proofs.length > 1 && (
                <div className="p-4 border-t bg-muted/50">
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {proofs.map((proof, index) => (
                      <button
                        key={proof.id}
                        className={cn(
                          "flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors",
                          index === selectedIndex ? "border-primary" : "border-transparent hover:border-muted-foreground"
                        )}
                        onClick={() => setSelectedIndex(index)}
                      >
                        {isImage(proof) ? (
                          <img 
                            src={proof.file_url} 
                            alt={proof.file_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-muted">
                            <FileIcon className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-center text-muted-foreground mt-2">
                    {selectedIndex! + 1} / {proofs.length}
                  </p>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Upload dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter des preuves de paiement</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Drop zone */}
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
                isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
              )}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium">
                Glissez-déposez vos fichiers ici
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                ou cliquez pour sélectionner
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Images et PDF • Max 10 MB par fichier
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => handleFilesChange(e.target.files)}
            />

            {/* Selected files preview */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  {selectedFiles.length} fichier{selectedFiles.length > 1 ? 's' : ''} sélectionné{selectedFiles.length > 1 ? 's' : ''}
                </Label>
                <div className="grid grid-cols-3 gap-2 max-h-[200px] overflow-y-auto">
                  {selectedFiles.map(({ id, file, preview }) => (
                    <div key={id} className="relative group aspect-square rounded-lg overflow-hidden bg-muted border">
                      {preview ? (
                        <img 
                          src={preview} 
                          alt={file.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-2">
                          <FileIcon className="w-8 h-8 text-muted-foreground" />
                          <p className="text-[10px] text-muted-foreground truncate w-full text-center mt-1">
                            {file.name}
                          </p>
                        </div>
                      )}
                      <button
                        className="absolute top-1 right-1 p-1 bg-destructive rounded-full text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleRemoveFile(id)}
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1 py-0.5 truncate">
                        {formatFileSize(file.size)}
                      </div>
                    </div>
                  ))}
                  
                  {/* Add more button */}
                  <button
                    className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 flex items-center justify-center transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Plus className="w-6 h-6 text-muted-foreground" />
                  </button>
                </div>
              </div>
            )}

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (optionnelle)</Label>
              <Textarea
                id="description"
                placeholder="Décrivez les preuves..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsUploadDialogOpen(false);
                setSelectedFiles([]);
                setDescription('');
              }}
            >
              Annuler
            </Button>
            <Button 
              onClick={handleUploadFiles}
              disabled={selectedFiles.length === 0 || isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Envoyer {selectedFiles.length > 0 && `(${selectedFiles.length})`}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!proofToDelete} onOpenChange={() => setProofToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette preuve ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La preuve sera définitivement supprimée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProof}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteProof.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
