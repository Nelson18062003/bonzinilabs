import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  Filter,
  Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAdminWallets } from '@/hooks/useAdminData';
import { formatXAF } from '@/lib/formatters';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function AdminWalletsPage() {
  const navigate = useNavigate();
  const { data: wallets, isLoading } = useAdminWallets();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'balance' | 'name' | 'updated'>('balance');

  const filteredWallets = wallets
    ?.filter((wallet) => {
      const searchLower = search.toLowerCase();
      return wallet.clientName.toLowerCase().includes(searchLower);
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'balance':
          return (b.balance_xaf || 0) - (a.balance_xaf || 0);
        case 'name':
          return a.clientName.localeCompare(b.clientName);
        case 'updated':
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        default:
          return 0;
      }
    }) || [];

  const totalBalance = wallets?.reduce((sum, w) => sum + (w.balance_xaf || 0), 0) || 0;

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Wallets Clients</h1>
            <p className="text-muted-foreground">Gestion des soldes et mouvements</p>
          </div>
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
                    {formatXAF(totalBalance)} XAF
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ≈ {Math.round(totalBalance / 87).toLocaleString()} RMB
                  </p>
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
                  <p className="text-sm text-muted-foreground">Wallets actifs</p>
                  <p className="text-xl font-bold text-emerald-600">
                    {wallets?.filter(w => w.balance_xaf > 0).length || 0}
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
                  <p className="text-sm text-muted-foreground">Total wallets</p>
                  <p className="text-xl font-bold text-blue-600">
                    {wallets?.length || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                <SelectTrigger className="w-full sm:w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Trier par" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="balance">Solde (décroissant)</SelectItem>
                  <SelectItem value="name">Nom (A-Z)</SelectItem>
                  <SelectItem value="updated">Dernière mise à jour</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Wallets List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-3">
            {filteredWallets.map((wallet) => (
              <Card 
                key={wallet.id} 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/admin/wallets/${wallet.user_id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {wallet.clientName.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold text-foreground">
                          {wallet.clientName}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {wallet.profile?.phone || 'Pas de téléphone'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-lg font-bold text-foreground">
                        {formatXAF(wallet.balance_xaf)} XAF
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ≈ {Math.round(wallet.balance_xaf / 87).toLocaleString()} RMB
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border">
                    <div className="flex items-center gap-2">
                      <ArrowDownToLine className="h-4 w-4 text-emerald-500" />
                      <div>
                        <p className="text-xs text-muted-foreground">Total crédité</p>
                        <p className="text-sm font-medium text-emerald-600">
                          {formatXAF(wallet.totalDeposits)} XAF
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <ArrowUpFromLine className="h-4 w-4 text-red-500" />
                      <div>
                        <p className="text-xs text-muted-foreground">Total débité</p>
                        <p className="text-sm font-medium text-red-600">
                          {formatXAF(wallet.totalPayments)} XAF
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredWallets.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">Aucun wallet trouvé</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}