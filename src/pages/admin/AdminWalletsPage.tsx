import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { clients, dashboardStats } from '@/data/adminMockData';
import { formatCurrency, mockWalletOperations } from '@/data/mockData';

export function AdminWalletsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const filteredClients = clients.filter((client) => {
    return (
      client.firstName.toLowerCase().includes(search.toLowerCase()) ||
      client.lastName.toLowerCase().includes(search.toLowerCase()) ||
      client.email.toLowerCase().includes(search.toLowerCase())
    );
  });

  const totalBalance = clients.reduce((sum, c) => sum + c.walletBalance, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Wallets Clients</h1>
        <p className="text-muted-foreground">Gestion des soldes et mouvements</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Solde total</p>
                <p className="text-xl font-bold text-foreground">
                  {formatCurrency(totalBalance)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Crédits aujourd'hui</p>
                <p className="text-xl font-bold text-emerald-600">
                  +{formatCurrency(850000)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <TrendingDown className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Débits aujourd'hui</p>
                <p className="text-xl font-bold text-red-600">
                  -{formatCurrency(750000)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Wallets List */}
      <div className="space-y-3">
        {filteredClients.map((client) => (
          <Card 
            key={client.id} 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate(`/admin/clients/${client.id}`)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {client.firstName[0]}{client.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-foreground">
                      {client.firstName} {client.lastName}
                    </h3>
                    <p className="text-sm text-muted-foreground">{client.email}</p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-lg font-bold text-foreground">
                    {formatCurrency(client.walletBalance)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ≈ {Math.round(client.walletBalance / 87).toLocaleString()} RMB
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border">
                <div className="flex items-center gap-2">
                  <ArrowDownToLine className="h-4 w-4 text-emerald-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Total crédité</p>
                    <p className="text-sm font-medium text-emerald-600">
                      {formatCurrency(client.totalDeposits)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowUpFromLine className="h-4 w-4 text-red-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Total débité</p>
                    <p className="text-sm font-medium text-red-600">
                      {formatCurrency(client.totalPayments)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredClients.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">Aucun wallet trouvé</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
