import { useState } from 'react';
import { 
  FileText, 
  Download, 
  ExternalLink, 
  X, 
  ChevronLeft, 
  ChevronRight,
  ZoomIn,
  Trash2,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
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
import { safeFormatDate } from '@/lib/depositTimeline';
import { useDeleteDepositProof } from '@/hooks/useDeposits';

interface Proof {
  id: string;
  file_name: string;
  file_url: string;
  file_type?: string | null;
  uploaded_at: string;
}

interface ProofImageGalleryProps {
  proofs: Proof[];
  canDelete?: boolean;
  depositId?: string;
}

export function ProofImageGallery({ proofs, canDelete = false, depositId }: ProofImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [proofToDelete, setProofToDelete] = useState<Proof | null>(null);
  
  const deleteProof = useDeleteDepositProof();

  const isImage = (fileType?: string | null, fileName?: string) => {
    if (fileType?.startsWith('image/')) return true;
    const ext = fileName?.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext || '');
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
    
    await deleteProof.mutateAsync({
      proofId: proofToDelete.id,
      fileUrl: proofToDelete.file_url,
    });
    
    setProofToDelete(null);
    
    // Close lightbox if the deleted proof was being viewed
    if (selectedIndex !== null) {
      const newLength = proofs.length - 1;
      if (newLength === 0) {
        setSelectedIndex(null);
      } else if (selectedIndex >= newLength) {
        setSelectedIndex(newLength - 1);
      }
    }
  };

  if (proofs.length === 0) {
    return (
      <div className="p-8 text-center">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">Aucune preuve uploadée</p>
      </div>
    );
  }

  return (
    <>
      {/* Thumbnails Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {proofs.map((proof, index) => {
          const isImg = isImage(proof.file_type, proof.file_name);
          
          return (
            <div 
              key={proof.id}
              className="relative group cursor-pointer rounded-lg overflow-hidden border border-border bg-muted/30 hover:border-primary/50 transition-all"
              onClick={() => setSelectedIndex(index)}
            >
              {isImg ? (
                <div className="aspect-square">
                  <img
                    src={proof.file_url}
                    alt={proof.file_name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.parentElement!.innerHTML = `
                        <div class="w-full h-full flex items-center justify-center bg-muted">
                          <svg class="h-12 w-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      `;
                    }}
                  />
                </div>
              ) : (
                <div className="aspect-square flex flex-col items-center justify-center p-4 bg-muted">
                  <FileText className="h-12 w-12 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground text-center truncate w-full">
                    {proof.file_name}
                  </p>
                </div>
              )}
              
              {/* Overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <ZoomIn className="h-8 w-8 text-white" />
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 text-white hover:bg-red-500/50 hover:text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      setProofToDelete(proof);
                    }}
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                )}
              </div>

              {/* File info */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                <p className="text-xs text-white truncate">{proof.file_name}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lightbox Dialog */}
      <Dialog open={selectedIndex !== null} onOpenChange={() => setSelectedIndex(null)}>
        <DialogContent 
          className="max-w-4xl w-[95vw] h-[90vh] p-0 bg-black/95 border-none"
          onKeyDown={handleKeyDown}
        >
          {selectedIndex !== null && proofs[selectedIndex] && (
            <div className="relative w-full h-full flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-4 bg-black/50">
                <div className="text-white">
                  <p className="font-medium">{proofs[selectedIndex].file_name}</p>
                  <p className="text-sm text-white/70">
                    {safeFormatDate(proofs[selectedIndex].uploaded_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
                    onClick={() => window.open(proofs[selectedIndex].file_url, '_blank')}
                  >
                    <ExternalLink className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
                    asChild
                  >
                    <a href={proofs[selectedIndex].file_url} download={proofs[selectedIndex].file_name}>
                      <Download className="h-5 w-5" />
                    </a>
                  </Button>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-white hover:bg-red-500/50"
                      onClick={() => setProofToDelete(proofs[selectedIndex])}
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
                    onClick={() => setSelectedIndex(null)}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Image container */}
              <div className="flex-1 flex items-center justify-center p-4 relative">
                {isImage(proofs[selectedIndex].file_type, proofs[selectedIndex].file_name) ? (
                  <img
                    src={proofs[selectedIndex].file_url}
                    alt={proofs[selectedIndex].file_name}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-white">
                    <FileText className="h-24 w-24 mb-4" />
                    <p className="text-lg">{proofs[selectedIndex].file_name}</p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => window.open(proofs[selectedIndex].file_url, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Ouvrir le fichier
                    </Button>
                  </div>
                )}

                {/* Navigation arrows */}
                {proofs.length > 1 && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute left-2 top-1/2 -translate-y-1/2 h-12 w-12 text-white hover:bg-white/20 disabled:opacity-30"
                      onClick={handlePrev}
                      disabled={selectedIndex === 0}
                    >
                      <ChevronLeft className="h-8 w-8" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-12 w-12 text-white hover:bg-white/20 disabled:opacity-30"
                      onClick={handleNext}
                      disabled={selectedIndex === proofs.length - 1}
                    >
                      <ChevronRight className="h-8 w-8" />
                    </Button>
                  </>
                )}
              </div>

              {/* Thumbnails footer */}
              {proofs.length > 1 && (
                <div className="p-4 bg-black/50 flex justify-center gap-2 overflow-x-auto">
                  {proofs.map((proof, index) => (
                    <button
                      key={proof.id}
                      onClick={() => setSelectedIndex(index)}
                      className={`w-16 h-16 rounded-md overflow-hidden border-2 flex-shrink-0 transition-all ${
                        index === selectedIndex 
                          ? 'border-primary ring-2 ring-primary/50' 
                          : 'border-transparent hover:border-white/50'
                      }`}
                    >
                      {isImage(proof.file_type, proof.file_name) ? (
                        <img
                          src={proof.file_url}
                          alt={proof.file_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted">
                          <FileText className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Counter */}
              <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
                {selectedIndex + 1} / {proofs.length}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={proofToDelete !== null} onOpenChange={() => setProofToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette preuve ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le fichier "{proofToDelete?.file_name}" ? 
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteProof}
              disabled={deleteProof.isPending}
            >
              {deleteProof.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Suppression...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
