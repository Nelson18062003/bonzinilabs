import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  Settings,
  Plus,
  RefreshCw,
  Calendar,
  User,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { 
  clients, 
  adminUsers,
  getWalletByClientId,
  getWalletOperationsByClientId,
} from '@/data/adminMockData';
import { formatCurrency, formatDate } from '@/data/mockData';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { WalletOperation, WalletOperationType } from '@/types/admin';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function AdminWalletDetailPage() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const { hasPermission, logAction, currentUser } = useAdminAuth();
  
  const client = clients.find(c => c.id === clientId);
  const wallet = client ? getWalletByClientId(client.id) : null;
  const operations = client ? getWalletOperationsByClientId(client.id) : [];
  
  const [isAdjustmentDialogOpen, setIsAdjustmentDialogOpen] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentDescription, setAdjustmentDescription] = useState('');

  if (!client || !wallet) {
    return (
      <AdminLayout>
        <div className="p-6">
          <Button variant="ghost" onClick={() => navigate('/admin/wallets')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
          <Card className="mt-4">
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">Wallet non trouvé</p>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  const getOperationIcon = (type: WalletOperationType) => {
    switch (type) {
      case 'CREDIT':
        return <ArrowDownCircle className="h-4 w-4 text-emerald-600" />;
      case 'DEBIT':
        return <ArrowUpCircle className="h-4 w-4 text-red-600" />;
      case 'ADJUSTMENT':
        return <Settings className="h-4 w-4 text-amber-600" />;
    }
  };

  const getOperationBadge = (type: WalletOperationType) => {
    switch (type) {
      case 'CREDIT':
        return <Badge className="bg-emerald-500/10 text-emerald-600">Crédit</Badge>;
      case 'DEBIT':
        return <Badge className="bg-red-500/10 text-red-600">Débit</Badge>;
      case 'ADJUSTMENT':
        return <Badge className="bg-amber-500/10 text-amber-600">Ajustement</Badge>;
    }
  };

  const getSourceLabel = (op: WalletOperation) => {
    switch (op.sourceType) {
      case 'DEPOSIT':
        return `Dépôt #${op.sourceId?.slice(-4) || 'N/A'}`;
      case 'PAYMENT':
        return `Paiement #${op.sourceId?.slice(-4) || 'N/A'}`;
      case 'MANUAL':
        const admin = adminUsers.find(a => a.id === op.createdByAdminUserId);
        return `Manuel - ${admin ? `${admin.firstName} ${admin.lastName}` : 'Admin'}`;
    }
  };

  const handleAdjustment = () => {
    const amount = parseFloat(adjustmentAmount);
    if (isNaN(amount) || amount <= 0 || !adjustmentDescription.trim()) return;

    const finalAmount = adjustmentType === 'DEBIT' ? -amount : amount;
    
    logAction(
      adjustmentType === 'CREDIT' ? 'WALLET_CREDITED' : 'WALLET_DEBITED',
      'WALLET',
      wallet.id,
      `Ajustement manuel ${adjustmentType === 'CREDIT' ? '+' : '-'}${formatCurrency(amount)} pour ${client.firstName} ${client.lastName}: ${adjustmentDescription}`
    );

    setIsAdjustmentDialogOpen(false);
    setAdjustmentAmount('');
    setAdjustmentDescription('');
  };

  // Calculate totals from operations
  const totalCredits = operations
    .filter(op => op.type === 'CREDIT' || (op.type === 'ADJUSTMENT' && op.amountXAF > 0))
    .reduce((sum, op) => sum + Math.abs(op.amountXAF), 0);

  const totalDebits = operations
    .filter(op => op.type === 'DEBIT' || (op.type === 'ADJUSTMENT' && op.amountXAF < 0))
    .reduce((sum, op) => sum + Math.abs(op.amountXAF), 0);

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/wallets')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {client.firstName[0]}{client.lastName[0]}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Wallet - {client.firstName} {client.lastName}
                </h1>
                <p className="text-muted-foreground">
                  Dernière mise à jour: {formatDate(wallet.updatedAt)}
                </p>
              </div>
            </div>
          </div>
          {hasPermission('canProcessDeposits') && (
            <Dialog open={isAdjustmentDialogOpen} onOpenChange={setIsAdjustmentDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Ajustement manuel
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Ajustement manuel du wallet</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Type d'ajustement</Label>
                    <Select 
                      value={adjustmentType} 
                      onValueChange={(v) => setAdjustmentType(v as 'CREDIT' | 'DEBIT')}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CREDIT">
                          <span className="flex items-center gap-2">
                            <ArrowDownCircle className="h-4 w-4 text-emerald-600" />
                            Crédit (ajout)
                          </span>
                        </SelectItem>
                        <SelectItem value="DEBIT">
                          <span className="flex items-center gap-2">
                            <ArrowUpCircle className="h-4 w-4 text-red-600" />
                            Débit (retrait)
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Montant (XAF)</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={adjustmentAmount}
                      onChange={(e) => setAdjustmentAmount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description (obligatoire)</Label>
                    <Textarea
                      placeholder="Raison de l'ajustement..."
                      value={adjustmentDescription}
                      onChange={(e) => setAdjustmentDescription(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg text-sm">
                    <p className="text-muted-foreground">
                      Cet ajustement sera loggué avec votre identifiant admin ({currentUser?.firstName} {currentUser?.lastName}).
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAdjustmentDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button 
                    onClick={handleAdjustment}
                    disabled={!adjustmentAmount || !adjustmentDescription.trim()}
                  >
                    Confirmer l'ajustement
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Wallet Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Wallet className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Solde actuel</p>
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency(wallet.currentBalanceXAF)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    ≈ {Math.round(wallet.currentBalanceXAF / 87).toLocaleString()} RMB
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <ArrowDownCircle className="h-7 w-7 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total crédité</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    +{formatCurrency(totalCredits)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-red-500/10 flex items-center justify-center">
                  <ArrowUpCircle className="h-7 w-7 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total débité</p>
                  <p className="text-2xl font-bold text-red-600">
                    -{formatCurrency(totalDebits)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Operations Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Historique des mouvements
              </CardTitle>
              <Badge variant="outline">{operations.length} opérations</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {operations.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {operations.map((operation) => (
                    <TableRow key={operation.id}>
                      <TableCell className="text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {formatDate(operation.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getOperationIcon(operation.type)}
                          {getOperationBadge(operation.type)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {operation.sourceType === 'MANUAL' && (
                            <User className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="text-sm">{getSourceLabel(operation)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-foreground">
                          {operation.description}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-semibold ${
                          operation.type === 'CREDIT' || (operation.type === 'ADJUSTMENT' && operation.amountXAF > 0)
                            ? 'text-emerald-600'
                            : 'text-red-600'
                        }`}>
                          {operation.type === 'DEBIT' || (operation.type === 'ADJUSTMENT' && operation.amountXAF < 0)
                            ? '-'
                            : '+'}
                          {formatCurrency(Math.abs(operation.amountXAF))}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-8 text-center">
                <Wallet className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Aucun mouvement enregistré</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="flex gap-4">
          <Button variant="outline" onClick={() => navigate(`/admin/clients/${clientId}`)}>
            Voir la fiche client
          </Button>
          <Button variant="outline" onClick={() => navigate('/admin/deposits')}>
            Voir les dépôts
          </Button>
          <Button variant="outline" onClick={() => navigate('/admin/payments')}>
            Voir les paiements
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}