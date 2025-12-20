import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Camera, Image, X, FileCheck, Loader2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaymentProofUploadProps {
  onFilesSelect: (files: File[]) => void;
  selectedFiles: File[];
  onConfirm: () => void;
  isSubmitting: boolean;
  disabled?: boolean;
}

export const PaymentProofUpload = ({ 
  onFilesSelect, 
  selectedFiles, 
  onConfirm, 
  isSubmitting,
  disabled = false 
}: PaymentProofUploadProps) => {
  const [dragActive, setDragActive] = useState(false);
  const [previews, setPreviews] = useState<{ file: File; url: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesChange = (newFiles: File[]) => {
    const validFiles = newFiles.filter(
      (file) => file.type.startsWith('image/') || file.type === 'application/pdf'
    );

    if (validFiles.length !== newFiles.length) {
      // Some files were filtered
    }

    // Create previews for images
    const newPreviews = validFiles.map((file) => ({
      file,
      url: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
    }));

    setPreviews((prev) => [...prev, ...newPreviews]);
    onFilesSelect([...selectedFiles, ...validFiles]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) handleFilesChange(files);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleFilesChange(files);
  };

  const handleRemove = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    const removedPreview = previews[index];
    if (removedPreview?.url) {
      URL.revokeObjectURL(removedPreview.url);
    }
    setPreviews((prev) => prev.filter((_, i) => i !== index));
    onFilesSelect(newFiles);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (disabled) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Upload className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-foreground">Instructions de paiement</h3>
      </div>

      <p className="text-xs text-muted-foreground">
        Ajoutez des images ou documents pour indiquer à Bonzini où et comment effectuer le paiement.
      </p>

      {/* Files preview grid */}
      {selectedFiles.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {selectedFiles.map((file, index) => (
            <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-border bg-muted">
              {previews[index]?.url ? (
                <img
                  src={previews[index].url}
                  alt={`Aperçu ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-2">
                  <FileCheck className="w-6 h-6 text-primary mb-1" />
                  <p className="text-[10px] text-muted-foreground text-center truncate w-full">
                    {file.name}
                  </p>
                </div>
              )}
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 w-6 h-6"
                onClick={() => handleRemove(index)}
              >
                <X className="w-3 h-3" />
              </Button>
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1 py-0.5 text-center truncate">
                {formatFileSize(file.size)}
              </div>
            </div>
          ))}

          {/* Add more button */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
            }}
            className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors"
          >
            <Plus className="w-6 h-6 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground mt-1">Ajouter</span>
          </div>
        </div>
      )}

      {/* Drop zone when no files */}
      {selectedFiles.length === 0 && (
        <>
          <div
            className={cn(
              'border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer',
              dragActive
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30'
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="w-7 h-7 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              Glissez vos fichiers ici
            </p>
            <p className="text-xs text-muted-foreground">
              ou cliquez pour parcourir
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.accept = 'image/*';
                  fileInputRef.current.setAttribute('capture', 'environment');
                  fileInputRef.current.click();
                }
              }}
            >
              <Camera className="w-4 h-4 mr-2" />
              Photo
            </Button>
            <Button
              variant="outline"
              className="flex-1"
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
        </>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Formats acceptés : JPG, PNG, PDF • Max 10 MB par fichier
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        multiple
        onChange={handleInputChange}
        className="hidden"
      />

      {/* Confirm Button */}
      {selectedFiles.length > 0 && (
        <Button
          className="w-full btn-primary-gradient"
          onClick={onConfirm}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Envoi en cours...
            </>
          ) : (
            <>
              <FileCheck className="w-4 h-4 mr-2" />
              Envoyer {selectedFiles.length} fichier{selectedFiles.length > 1 ? 's' : ''}
            </>
          )}
        </Button>
      )}
    </div>
  );
};
