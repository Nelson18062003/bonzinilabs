import { useState } from 'react';
import { 
  Search, 
  FileText,
  Download,
  Eye,
  Image,
  File,
  ArrowDownToLine,
  ArrowUpFromLine,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { adminDeposits, adminPayments } from '@/data/adminMockData';
import { formatDate } from '@/data/mockData';

interface Proof {
  id: string;
  type: 'DEPOSIT' | 'PAYMENT';
  transactionId: string;
  clientName: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: Date;
}

export function AdminProofsPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedProof, setSelectedProof] = useState<Proof | null>(null);

  // Combine deposit and payment proofs
  const allProofs: Proof[] = [
    ...adminDeposits
      .filter(d => d.proofUrl)
      .map(d => ({
        id: `dep-proof-${d.id}`,
        type: 'DEPOSIT' as const,
        transactionId: d.id,
        clientName: d.clientName,
        fileName: d.proofFileName || 'preuve_depot.jpg',
        fileUrl: d.proofUrl!,
        uploadedAt: d.updatedAt,
      })),
    ...adminPayments
      .filter(p => p.proofUrl)
      .map(p => ({
        id: `pay-proof-${p.id}`,
        type: 'PAYMENT' as const,
        transactionId: p.id,
        clientName: p.clientName,
        fileName: p.proofFileName || 'preuve_paiement.jpg',
        fileUrl: p.proofUrl!,
        uploadedAt: p.completedAt || p.updatedAt,
      })),
  ];

  const filteredProofs = allProofs.filter((proof) => {
    const matchesSearch = 
      proof.clientName.toLowerCase().includes(search.toLowerCase()) ||
      proof.fileName.toLowerCase().includes(search.toLowerCase());
    
    const matchesType = typeFilter === 'all' || proof.type === typeFilter;

    return matchesSearch && matchesType;
  });

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
      return <Image className="h-5 w-5 text-blue-500" />;
    }
    return <File className="h-5 w-5 text-gray-500" />;
  };

  const handlePreview = (proof: Proof) => {
    setSelectedProof(proof);
    setPreviewOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Justificatifs</h1>
        <p className="text-muted-foreground">
          Preuves de dépôts et paiements
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total justificatifs</p>
                <p className="text-2xl font-bold text-foreground">{allProofs.length}</p>
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
                  {allProofs.filter(p => p.type === 'DEPOSIT').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <ArrowUpFromLine className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Preuves paiement</p>
                <p className="text-2xl font-bold text-foreground">
                  {allProofs.filter(p => p.type === 'PAYMENT').length}
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
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                <SelectItem value="DEPOSIT">Dépôts</SelectItem>
                <SelectItem value="PAYMENT">Paiements</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Proofs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProofs.map((proof) => (
          <Card key={proof.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  {getFileIcon(proof.fileName)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {proof.fileName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {proof.clientName}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary" className={
                      proof.type === 'DEPOSIT' 
                        ? 'bg-emerald-500/10 text-emerald-600' 
                        : 'bg-blue-500/10 text-blue-600'
                    }>
                      {proof.type === 'DEPOSIT' ? 'Dépôt' : 'Paiement'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(proof.uploadedAt)}
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
                <Button variant="outline" size="sm" className="flex-1">
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

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedProof?.fileName}</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
              <div className="text-center">
                {getFileIcon(selectedProof?.fileName || '')}
                <p className="text-sm text-muted-foreground mt-2">
                  Aperçu du fichier
                </p>
                <p className="text-xs text-muted-foreground">
                  (Fonctionnalité à implémenter avec stockage réel)
                </p>
              </div>
            </div>
            <div className="flex justify-between items-center mt-4 pt-4 border-t">
              <div>
                <p className="text-sm font-medium">{selectedProof?.clientName}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedProof?.type === 'DEPOSIT' ? 'Dépôt' : 'Paiement'} • {selectedProof && formatDate(selectedProof.uploadedAt)}
                </p>
              </div>
              <Button>
                <Download className="h-4 w-4 mr-2" />
                Télécharger
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
