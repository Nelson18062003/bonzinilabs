import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Image as ImageIcon, 
  Download, 
  FileText, 
  User, 
  Building2,
  ZoomIn,
  X
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PaymentProof } from '@/hooks/usePayments';

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
        <ImageIcon className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
        
        {/* Thumbnail Grid */}
        <div className="grid grid-cols-3 gap-2">
          {proofs.map((proof) => (
            <div 
              key={proof.id} 
              className="relative aspect-square rounded-lg overflow-hidden border border-border bg-muted cursor-pointer group"
              onClick={() => setSelectedProof(proof)}
            >
              {isImage(proof.file_type) ? (
                <img
                  src={proof.file_url}
                  alt={proof.file_name}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-2">
                  <FileText className="w-8 h-8 text-primary mb-1" />
                  <p className="text-[10px] text-muted-foreground text-center truncate w-full">
                    {proof.file_name}
                  </p>
                </div>
              )}

              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <ZoomIn className="w-6 h-6 text-white" />
              </div>

              {/* Badge for upload type */}
              {showUploadedBy && (
                <Badge
                  variant="secondary"
                  className="absolute top-1 left-1 text-[10px] py-0 px-1"
                >
                  {proof.uploaded_by_type === 'admin' ? (
                    <Building2 className="w-2.5 h-2.5 mr-0.5" />
                  ) : (
                    <User className="w-2.5 h-2.5 mr-0.5" />
                  )}
                  {proof.uploaded_by_type === 'admin' ? 'Bonzini' : 'Moi'}
                </Badge>
              )}
            </div>
          ))}
        </div>

        {/* List view for details */}
        <div className="space-y-2">
          {proofs.map((proof) => (
            <div 
              key={proof.id} 
              className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {isImage(proof.file_type) ? (
                  <ImageIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{proof.file_name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {showUploadedBy && (
                      <span>
                        {proof.uploaded_by_type === 'admin' ? 'Bonzini' : 'Vous'} •{' '}
                      </span>
                    )}
                    {format(new Date(proof.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7"
                  onClick={() => setSelectedProof(proof)}
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7"
                  onClick={() => handleDownload(proof)}
                >
                  <Download className="w-3.5 h-3.5" />
                </Button>
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

          <div className="relative flex-1 overflow-auto p-4 pt-0">
            {selectedProof && isImage(selectedProof.file_type) ? (
              <img
                src={selectedProof.file_url}
                alt={selectedProof.file_name}
                className="w-full h-auto max-h-[70vh] object-contain rounded-lg"
              />
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

          {selectedProof && (
            <div className="p-4 pt-2 border-t flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {showUploadedBy && (
                  <span className="flex items-center gap-1">
                    {selectedProof.uploaded_by_type === 'admin' ? (
                      <>
                        <Building2 className="w-3.5 h-3.5" /> Ajouté par Bonzini
                      </>
                    ) : (
                      <>
                        <User className="w-3.5 h-3.5" /> Ajouté par vous
                      </>
                    )}
                    <span className="mx-1">•</span>
                    {format(new Date(selectedProof.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                  </span>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => handleDownload(selectedProof)}>
                <Download className="w-4 h-4 mr-2" />
                Télécharger
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
