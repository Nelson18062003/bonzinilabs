import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Phone, 
  Calendar,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAdminClientDetail } from '@/hooks/useAdminData';
import { formatXAF, formatDate } from '@/lib/formatters';
import { DEPOSIT_METHOD_LABELS, DEPOSIT_STATUS_LABELS } from '@/data/staticData';

export function AdminClientDetailPage() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const { data: client, isLoading } = useAdminClientDetail(clientId || '');

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (!client) {
    return (
      <AdminLayout>
        <div className="p-6">
          <Button variant="ghost" onClick={() => navigate('/admin/clients')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
          <Card className="mt-4">
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">Client non trouvé</p>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  const recentDeposits = client.deposits?.slice(0, 5) || [];

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/clients')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14">
                <AvatarFallback className="bg-primary/10 text-primary text-lg">
                  {client.first_name[0]}{client.last_name[0]}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-foreground">
                    {client.first_name} {client.last_name}
                  </h1>
                  <Badge className="bg-emerald-500/10 text-emerald-600">
                    Actif
                  </Badge>
                </div>
                <p className="text-muted-foreground">
                  Client depuis le {formatDate(client.created_at)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate(`/admin/wallets/${client.user_id}`)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Solde Wallet</p>
                  <p className="text-xl font-bold text-foreground">
                    {formatXAF(client.wallet?.balance_xaf || 0)} XAF
                  </p>
                  <p className="text-xs text-primary">Voir les mouvements →</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <ArrowDownCircle className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Dépôts</p>
                  <p className="text-xl font-bold text-emerald-600">
                    {formatXAF(client.totalDeposits)} XAF
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <ArrowUpCircle className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Paiements</p>
                  <p className="text-xl font-bold text-blue-600">
                    {formatXAF(client.totalPayments)} XAF
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Calendar className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Dernier dépôt</p>
                  <p className="text-lg font-semibold text-foreground">
                    {client.deposits?.[0] 
                      ? formatDate(client.deposits[0].created_at)
                      : 'N/A'
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Client Info */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {client.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">{client.phone}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Deposits */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Derniers dépôts</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin/deposits')}>
                Voir tout
              </Button>
            </CardHeader>
            <CardContent>
              {recentDeposits.length > 0 ? (
                <div className="space-y-3">
                  {recentDeposits.map((deposit) => (
                    <div key={deposit.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-500/10">
                          <ArrowDownCircle className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {DEPOSIT_METHOD_LABELS[deposit.method] || deposit.method}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(deposit.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-emerald-600">
                          +{formatXAF(deposit.amount_xaf)} XAF
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {DEPOSIT_STATUS_LABELS[deposit.status] || deposit.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucun dépôt
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}