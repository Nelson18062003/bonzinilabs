import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  MoreHorizontal,
  Phone,
  Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AdminLayout } from '@/components/admin/AdminLayout';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAdminClients } from '@/hooks/useAdminData';
import { formatXAF } from '@/lib/formatters';

export function AdminClientsPage() {
  const navigate = useNavigate();
  const { data: clients, isLoading } = useAdminClients();
  const [search, setSearch] = useState('');

  const filteredClients = clients?.filter((client) => {
    const searchLower = search.toLowerCase();
    return (
      client.first_name.toLowerCase().includes(searchLower) ||
      client.last_name.toLowerCase().includes(searchLower) ||
      (client.phone?.includes(search) ?? false)
    );
  }) || [];

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Clients</h1>
            <p className="text-muted-foreground">{clients?.length || 0} clients enregistrés</p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom, téléphone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Clients List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-3">
            {filteredClients.map((client) => (
              <Card 
                key={client.id} 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/admin/clients/${client.user_id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {client.first_name[0]}{client.last_name[0]}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-foreground">
                              {client.first_name} {client.last_name}
                            </h3>
                            <Badge className="bg-emerald-500/10 text-emerald-600">
                              Actif
                            </Badge>
                          </div>
                          {client.phone && (
                            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {client.phone}
                              </span>
                            </div>
                          )}
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>Voir le profil</DropdownMenuItem>
                            <DropdownMenuItem>Voir le wallet</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
                        <div>
                          <p className="text-xs text-muted-foreground">Solde wallet</p>
                          <p className="text-sm font-semibold text-foreground">
                            {formatXAF(client.walletBalance)} XAF
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Total dépôts</p>
                          <p className="text-sm font-semibold text-emerald-600">
                            {formatXAF(client.totalDeposits)} XAF
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Total paiements</p>
                          <p className="text-sm font-semibold text-blue-600">
                            {formatXAF(client.totalPayments)} XAF
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredClients.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">Aucun client trouvé</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}