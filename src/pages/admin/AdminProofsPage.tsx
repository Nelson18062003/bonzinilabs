import { useState } from 'react';
import { 
  Search, 
  FileText,
  Download,
  Eye,
  Image,
  File,
  ArrowDownToLine,
  Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAdminProofs } from '@/hooks/useAdminData';
import { formatDate } from '@/lib/formatters';

export function AdminProofsPage() {
  const { data: proofs, isLoading } = useAdminProofs();
  const [search, setSearch] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedProof, setSelectedProof] = useState<typeof proofs extends (infer T)[] | undefined ? T : never | null>(null);

  const filteredProofs = proofs?.filter((proof) => {
    const matchesSearch = 
      proof.clientName.toLowerCase().includes(search.toLowerCase()) ||
      proof.file_name.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  }) || [];

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
      return <Image className="h-5 w-5 text-blue-500" />;
    }
    return <File className="h-5 w-5 text-gray-500" />;
  };

  const handlePreview = (proof: typeof selectedProof) => {
    setSelectedProof(proof);
    setPreviewOpen(true);
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Justificatifs</h1>
          <p className="text-muted-foreground">
            Preuves de dépôts
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total justificatifs</p>
                  <p className="text-2xl font-bold text-foreground">{proofs?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <ArrowDownToLine className="h-6 w-6 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Preuves dépôt</p>
                  <p className="text-2xl font-bold text-foreground">
                    {proofs?.length || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par client ou nom de fichier..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Proofs Grid */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProofs.map((proof) => (
              <Card key={proof.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      {getFileIcon(proof.file_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {proof.file_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {proof.clientName}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">
                          Dépôt
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(proof.uploaded_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => handlePreview(proof)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Voir
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => window.open(proof.file_url, '_blank')}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Télécharger
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredProofs.length === 0 && (
              <div className="col-span-full">
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground">Aucun justificatif trouvé</p>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* Preview Dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedProof?.file_name}</DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              {selectedProof?.file_url && (
                <img 
                  src={selectedProof.file_url} 
                  alt={selectedProof.file_name}
                  className="w-full rounded-lg"
                />
              )}
              <div className="flex justify-between items-center mt-4 pt-4 border-t">
                <div>
                  <p className="text-sm font-medium">{selectedProof?.clientName}</p>
                  <p className="text-xs text-muted-foreground">
                    Dépôt • {selectedProof && formatDate(selectedProof.uploaded_at)}
                  </p>
                </div>
                <Button onClick={() => window.open(selectedProof?.file_url, '_blank')}>
                  <Download className="h-4 w-4 mr-2" />
                  Télécharger
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}