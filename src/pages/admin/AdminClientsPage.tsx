import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  MoreHorizontal,
  Phone,
  Loader2,
  Trash2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminResponsiveHeader, AdminResponsiveFilters } from '@/components/admin/ui/AdminResponsive';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAdminClients } from '@/hooks/useAdminData';
import { useAdminDeleteClient } from '@/hooks/useAdminDeleteClient';
import { formatXAF } from '@/lib/formatters';

export function AdminClientsPage() {
  const navigate = useNavigate();
  const { data: clients, isLoading } = useAdminClients();
  const deleteClient = useAdminDeleteClient();
  const [search, setSearch] = useState('');
  const [clientToDelete, setClientToDelete] = useState<{ userId: string; name: string } | null>(null);

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
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <AdminResponsiveHeader
          title="Clients"
          subtitle={`${clients?.length || 0} clients enregistrés`}
        />

        {/* Filters */}
        <AdminResponsiveFilters>
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom, téléphone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 w-full"
            />
          </div>
        </AdminResponsiveFilters>

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
                className="cursor-pointer hover:shadow-md transition-all active:scale-[0.99]"
                onClick={() => navigate(`/admin/clients/${client.user_id}`)}
              >
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <Avatar className="h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {client.first_name[0]}{client.last_name[0]}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-foreground text-sm sm:text-base truncate">
                              {client.first_name} {client.last_name}
                            </h3>
                            <Badge className="bg-emerald-500/10 text-emerald-600 text-xs">
                              Actif
                            </Badge>
                          </div>
                          {client.phone && (
                            <div className="flex items-center gap-1 mt-1 text-xs sm:text-sm text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              <span className="truncate">{client.phone}</span>
                            </div>
                          )}
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/admin/clients/${client.user_id}`);
                            }}>
                              Voir le profil
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/admin/wallets/${client.user_id}`);
                            }}>
                              Voir le wallet
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive focus:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setClientToDelete({
                                  userId: client.user_id,
                                  name: `${client.first_name} ${client.last_name}`,
                                });
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Supprimer le client
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Stats grid - responsive */}
                      <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border">
                        <div>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">Solde</p>
                          <p className="text-xs sm:text-sm font-semibold text-foreground truncate">
                            {formatXAF(client.walletBalance)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">Dépôts</p>
                          <p className="text-xs sm:text-sm font-semibold text-emerald-600 truncate">
                            {formatXAF(client.totalDeposits)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">Paiements</p>
                          <p className="text-xs sm:text-sm font-semibold text-blue-600 truncate">
                            {formatXAF(client.totalPayments)}
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

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!clientToDelete} onOpenChange={() => setClientToDelete(null)}>
          <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer ce client ?</AlertDialogTitle>
              <AlertDialogDescription>
                Vous êtes sur le point de supprimer définitivement <strong>{clientToDelete?.name}</strong> et toutes ses données associées.
                <br /><br />
                <span className="text-destructive font-medium">Cette action est irréversible.</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel className="w-full sm:w-auto">Annuler</AlertDialogCancel>
              <AlertDialogAction
                className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (clientToDelete) {
                    deleteClient.mutate(clientToDelete.userId);
                    setClientToDelete(null);
                  }
                }}
                disabled={deleteClient.isPending}
              >
                {deleteClient.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Suppression...
                  </>
                ) : (
                  'Supprimer'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
}
