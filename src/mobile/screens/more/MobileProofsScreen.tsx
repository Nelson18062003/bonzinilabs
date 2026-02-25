import { useState } from 'react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import {
  Search,
  FileText,
  Download,
  Eye,
  Image,
  File,
  ArrowDownToLine,
  X,
} from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer';
import { useAdminProofs } from '@/hooks/useAdminData';
import { formatDate } from '@/lib/formatters';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { SkeletonListScreen } from '@/mobile/components/ui/SkeletonCard';
import { PullToRefresh } from '@/mobile/components/ui/PullToRefresh';

export function MobileProofsScreen() {
  const { data: proofs, isLoading, refetch } = useAdminProofs();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [selectedProof, setSelectedProof] = useState<any>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const filteredProofs = proofs?.filter((proof) => {
    if (!debouncedSearch) return true;
    const s = debouncedSearch.toLowerCase();
    return (
      proof.clientName.toLowerCase().includes(s) ||
      proof.file_name.toLowerCase().includes(s)
    );
  }) || [];

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
      return <Image className="w-6 h-6 text-blue-500" />;
    }
    return <File className="w-6 h-6 text-gray-500" />;
  };

  const isImage = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
  };

  const handlePreview = (proof: typeof selectedProof) => {
    setSelectedProof(proof);
    setPreviewOpen(true);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <MobileHeader title="Justificatifs" backTo="/m/more" showBack />

      <PullToRefresh onRefresh={refetch} className="flex-1 overflow-y-auto">
        {/* Stats */}
        <div className="px-4 py-4 grid grid-cols-2 gap-3">
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{proofs?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <ArrowDownToLine className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{proofs?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Dépôts</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher par client ou fichier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-lg bg-muted border-0 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Proofs Grid */}
        {isLoading ? (
          <div className="px-4 pb-6">
            <SkeletonListScreen count={4} />
          </div>
        ) : (
        <div className="px-4 pb-6">
          <div className="grid grid-cols-2 gap-3">
            {filteredProofs.map((proof) => (
              <button
                key={proof.id}
                onClick={() => handlePreview(proof)}
                className="bg-card rounded-xl border border-border overflow-hidden active:scale-[0.98] transition-transform text-left"
              >
                {/* Thumbnail */}
                <div className="aspect-square bg-muted flex items-center justify-center relative">
                  {isImage(proof.file_name) ? (
                    <img
                      src={proof.file_url}
                      alt={proof.file_name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    getFileIcon(proof.file_name)
                  )}
                  <div className="absolute top-2 right-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/90 text-white font-medium">
                      Dépôt
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="p-3">
                  <p className="text-sm font-medium truncate">{proof.file_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{proof.clientName}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {formatDate(proof.uploaded_at)}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {filteredProofs.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              Aucun justificatif trouvé
            </div>
          )}
        </div>
        )}
      </PullToRefresh>

      {/* Preview Drawer */}
      <Drawer open={previewOpen} onOpenChange={setPreviewOpen}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="flex flex-row items-center justify-between">
            <DrawerTitle className="truncate pr-4">{selectedProof?.file_name}</DrawerTitle>
            <DrawerClose asChild>
              <button className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </DrawerClose>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {selectedProof?.file_url && isImage(selectedProof.file_name) && (
              <img
                src={selectedProof.file_url}
                alt={selectedProof.file_name}
                className="w-full rounded-xl"
              />
            )}

            <div className="mt-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Client</span>
                <span className="font-medium">{selectedProof?.clientName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium">Dépôt</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium">
                  {selectedProof && formatDate(selectedProof.uploaded_at)}
                </span>
              </div>
            </div>
          </div>

          <DrawerFooter className="flex-row gap-3">
            <button
              onClick={() => window.open(selectedProof?.file_url, '_blank')}
              className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center gap-2 font-medium"
            >
              <Download className="w-5 h-5" />
              Télécharger
            </button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
