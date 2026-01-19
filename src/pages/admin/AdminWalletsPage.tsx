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
import { 
  AdminResponsiveHeader, 
  AdminResponsiveFilters,
  AdminStatGrid,
} from '@/components/admin/ui/AdminResponsive';
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
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <AdminResponsiveHeader
          title="Wallets Clients"
          subtitle="Gestion des soldes et mouvements"
        />

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Wallet className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-muted-foreground">Solde total</p>
                  <p className="text-lg sm:text-xl font-bold text-foreground truncate">
                    {formatXAF(totalBalance)} XAF
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    ≈ {Math.round(totalBalance / 87).toLocaleString()} RMB
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  <ArrowDownToLine className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Wallets actifs</p>
                  <p className="text-lg sm:text-xl font-bold text-emerald-600">
                    {wallets?.filter(w => w.balance_xaf > 0).length || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <ArrowUpFromLine className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Total wallets</p>
                  <p className="text-lg sm:text-xl font-bold text-blue-600">
                    {wallets?.length || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filters */}
        <AdminResponsiveFilters>
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 w-full"
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
              <SelectItem value="updated">Dernière MAJ</SelectItem>
            </SelectContent>
          </Select>
        </AdminResponsiveFilters>

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
                className="cursor-pointer hover:shadow-md transition-all active:scale-[0.99]"
                onClick={() => navigate(`/admin/wallets/${wallet.user_id}`)}
              >
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-2 sm:gap-4">
                    <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
                      <Avatar className="h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                          {wallet.clientName.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-foreground text-sm sm:text-base truncate">
                          {wallet.clientName}
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">
                          {wallet.profile?.phone || 'Pas de téléphone'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="text-sm sm:text-lg font-bold text-foreground">
                        {formatXAF(wallet.balance_xaf)}
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
                        ≈ {Math.round(wallet.balance_xaf / 87).toLocaleString()} RMB
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:gap-4 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border">
                    <div className="flex items-center gap-2">
                      <ArrowDownToLine className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Total crédité</p>
                        <p className="text-xs sm:text-sm font-medium text-emerald-600 truncate">
                          {formatXAF(wallet.totalDeposits)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <ArrowUpFromLine className="h-3 w-3 sm:h-4 sm:w-4 text-red-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Total débité</p>
                        <p className="text-xs sm:text-sm font-medium text-red-600 truncate">
                          {formatXAF(wallet.totalPayments)}
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
