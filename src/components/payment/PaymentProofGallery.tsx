import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Eye,
  Download,
  FileText,
  User,
  Building2,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { PaymentProof } from '@/hooks/usePayments';

// ── ProofImage: fallback when signed URL fails ──
function ProofImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className={cn('flex flex-col items-center justify-center bg-muted/50', className)}>
        <FileText className="w-8 h-8 text-muted-foreground mb-1" />
        <p className="text-[10px] text-muted-foreground text-center">Image indisponible</p>
      </div>
    );
  }
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />;
}

interface PaymentProofGalleryProps {
  proofs: PaymentProof[];
  title: string;
  emptyMessage: string;
  showUploadedBy?: boolean;
}

export const PaymentProofGallery = ({
  proofs,
  title,
  emptyMessage,
  showUploadedBy = true
}: PaymentProofGalleryProps) => {
  const [selectedProof, setSelectedProof] = useState<PaymentProof | null>(null);

  const isImage = (fileType: string | null) => {
    return fileType?.startsWith('image/') ?? false;
  };

  const handleDownload = (proof: PaymentProof) => {
    const link = document.createElement('a');
    link.href = proof.file_url;
    link.download = proof.file_name;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (proofs.length === 0) {
    return (
      <div className="text-center py-6">
        <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {title && (
          <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
        )}

        {/* Mobile-friendly proof list — always-visible actions */}
        <div className="space-y-2">
          {proofs.map((proof) => (
            <div
              key={proof.id}
              className="flex items-center gap-3 p-2 rounded-lg border border-border bg-muted/20"
            >
              {/* Thumbnail — tap to view */}
              <div
                className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden border border-border bg-muted/30 cursor-pointer active:scale-95 transition-transform"
                onClick={() => setSelectedProof(proof)}
              >
                {isImage(proof.file_type) ? (
                  <ProofImage
                    src={proof.file_url}
                    alt={proof.file_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <FileText className="w-6 h-6 text-primary" />
                  </div>
                )}

                {/* Upload type badge */}
                {showUploadedBy && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1 py-0.5 text-center flex items-center justify-center gap-0.5">
                    {proof.uploaded_by_type === 'admin' ? (
                      <><Building2 className="w-2.5 h-2.5" /> Bonzini</>
                    ) : (
                      <><User className="w-2.5 h-2.5" /> Moi</>
                    )}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {proof.file_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(proof.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                </p>
              </div>

              {/* Action buttons — always visible */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8"
                  onClick={() => setSelectedProof(proof)}
                >
                  {isImage(proof.file_type) ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                </Button>
                {isImage(proof.file_type) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8"
                    onClick={() => handleDownload(proof)}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Full-screen preview dialog */}
      <Dialog open={!!selectedProof} onOpenChange={() => setSelectedProof(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="flex items-center justify-between pr-8">
              <span className="truncate text-sm">{selectedProof?.file_name}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="p-4 pt-2">
            {selectedProof && isImage(selectedProof.file_type) ? (
              <>
                <ProofImage
                  src={selectedProof.file_url}
                  alt={selectedProof.file_name}
                  className="w-full max-h-[70vh] object-contain rounded-lg"
                />
                <Button
                  className="w-full mt-4"
                  variant="outline"
                  onClick={() => handleDownload(selectedProof)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Télécharger
                </Button>
              </>
            ) : selectedProof ? (
              <div className="flex flex-col items-center justify-center py-12">
                <FileText className="w-16 h-16 text-primary mb-4" />
                <p className="text-lg font-medium mb-2">{selectedProof.file_name}</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Ce fichier ne peut pas être prévisualisé
                </p>
                <Button onClick={() => handleDownload(selectedProof)}>
                  <Download className="w-4 h-4 mr-2" />
                  Télécharger
                </Button>
              </div>
            ) : null}
          </div>

          {selectedProof && showUploadedBy && (
            <div className="px-4 pb-4 pt-0">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                {selectedProof.uploaded_by_type === 'admin' ? (
                  <><Building2 className="w-3.5 h-3.5" /> Ajouté par Bonzini</>
                ) : (
                  <><User className="w-3.5 h-3.5" /> Ajouté par vous</>
                )}
                <span className="mx-1">•</span>
                {format(new Date(selectedProof.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
