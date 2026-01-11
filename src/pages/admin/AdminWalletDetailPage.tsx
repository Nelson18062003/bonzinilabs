import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  Calendar,
  Loader2,
  Settings2,
  FileDown,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { WalletAdjustmentModal } from '@/components/admin/WalletAdjustmentModal';
import { StatementDownloadModal } from '@/components/admin/StatementDownloadModal';
import { useProfileByUserId } from '@/hooks/useProfile';
import { useWalletByUserId, useWalletOperations } from '@/hooks/useWallet';
import { formatXAF, formatDate } from '@/lib/formatters';
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
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [showStatementModal, setShowStatementModal] = useState(false);
  
  const { data: profile, isLoading: loadingProfile } = useProfileByUserId(clientId);
  const { data: wallet, isLoading: loadingWallet } = useWalletByUserId(clientId);
  const { data: operations, isLoading: loadingOperations } = useWalletOperations(wallet?.id);

  const isLoading = loadingProfile || loadingWallet || loadingOperations;

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="p-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (!profile || !wallet) {
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

  const getOperationIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return <ArrowDownCircle className="h-4 w-4 text-emerald-600" />;
      case 'payment':
        return <ArrowUpCircle className="h-4 w-4 text-red-600" />;
      case 'adjustment':
        return <RefreshCw className="h-4 w-4 text-amber-600" />;
      default:
        return <RefreshCw className="h-4 w-4" />;
    }
  };

  const getOperationBadge = (type: string) => {
    switch (type) {
      case 'deposit':
        return <Badge className="bg-emerald-500/10 text-emerald-600">Crédit</Badge>;
      case 'payment':
        return <Badge className="bg-red-500/10 text-red-600">Débit</Badge>;
      case 'adjustment':
        return <Badge className="bg-amber-500/10 text-amber-600">Ajustement</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  // Calculate totals from operations
  const totalCredits = (operations || [])
    .filter(op => op.operation_type === 'deposit' || (op.operation_type === 'adjustment' && op.amount_xaf > 0))
    .reduce((sum, op) => sum + Math.abs(op.amount_xaf), 0);

  const totalDebits = (operations || [])
    .filter(op => op.operation_type === 'payment' || (op.operation_type === 'adjustment' && op.amount_xaf < 0))
    .reduce((sum, op) => sum + Math.abs(op.amount_xaf), 0);

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
                  {profile.first_name[0]}{profile.last_name[0]}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Wallet - {profile.first_name} {profile.last_name}
                </h1>
                <p className="text-muted-foreground">
                  Dernière mise à jour: {formatDate(wallet.updated_at)}
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowStatementModal(true)}>
              <FileDown className="h-4 w-4 mr-2" />
              Relevé PDF
            </Button>
            <Button onClick={() => setShowAdjustmentModal(true)}>
              <Settings2 className="h-4 w-4 mr-2" />
              Ajustement
            </Button>
          </div>
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
                    {formatXAF(wallet.balance_xaf)} XAF
                  </p>
                  <p className="text-sm text-muted-foreground">
                    ≈ {Math.round(wallet.balance_xaf / 87).toLocaleString()} RMB
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
                    +{formatXAF(totalCredits)} XAF
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
                    -{formatXAF(totalDebits)} XAF
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
              <Badge variant="outline">{(operations || []).length} opérations</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {operations && operations.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
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
                          {formatDate(operation.created_at)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getOperationIcon(operation.operation_type)}
                          {getOperationBadge(operation.operation_type)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-foreground">
                          {operation.description || 'N/A'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-semibold ${
                          operation.operation_type === 'deposit'
                            ? 'text-emerald-600'
                            : operation.operation_type === 'payment'
                            ? 'text-red-600'
                            : operation.amount_xaf >= 0
                            ? 'text-emerald-600'
                            : 'text-red-600'
                        }`}>
                          {operation.operation_type === 'payment' || operation.amount_xaf < 0 ? '-' : '+'}
                          {formatXAF(Math.abs(operation.amount_xaf))} XAF
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
        </div>

        {/* Adjustment Modal */}
        {clientId && profile && wallet && (
          <WalletAdjustmentModal
            open={showAdjustmentModal}
            onOpenChange={setShowAdjustmentModal}
            userId={clientId}
            clientName={`${profile.first_name} ${profile.last_name}`}
            currentBalance={wallet.balance_xaf}
          />
        )}

        {/* Statement Download Modal */}
        {clientId && profile && wallet && operations && (
          <StatementDownloadModal
            open={showStatementModal}
            onOpenChange={setShowStatementModal}
            clientName={`${profile.first_name} ${profile.last_name}`}
            clientPhone={profile.phone || undefined}
            userId={clientId}
            operations={operations.map(op => ({
              id: op.id,
              created_at: op.created_at,
              operation_type: op.operation_type,
              amount_xaf: op.amount_xaf,
              balance_before: op.balance_before,
              balance_after: op.balance_after,
              description: op.description,
            }))}
            currentBalance={wallet.balance_xaf}
          />
        )}
      </div>
    </AdminLayout>
  );
}