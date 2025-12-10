import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Plus, 
  MoreHorizontal,
  Mail,
  Phone,
  Building2,
  CheckCircle,
  Calendar,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AdminLayout } from '@/components/admin/AdminLayout';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { clients, tags, getClientWithTags, getClientStatusLabel } from '@/data/adminMockData';
import { formatCurrency, formatDate } from '@/data/mockData';
import { ClientStatus, Tag } from '@/types/admin';

export function AdminClientsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [activityFilter, setActivityFilter] = useState<string>('all');

  // Check if client has recent activity (last 30 days)
  const isActiveClient = (client: typeof clients[0]) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return (client.lastDepositAt && client.lastDepositAt > thirtyDaysAgo) ||
           (client.lastPaymentAt && client.lastPaymentAt > thirtyDaysAgo);
  };

  const filteredClients = clients.filter((client) => {
    const matchesSearch = 
      client.firstName.toLowerCase().includes(search.toLowerCase()) ||
      client.lastName.toLowerCase().includes(search.toLowerCase()) ||
      (client.email?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      client.whatsappNumber.includes(search);
    
    const matchesStatus = statusFilter === 'all' || client.status === statusFilter;
    const matchesTag = tagFilter === 'all' || client.tagIds.includes(tagFilter);
    const matchesActivity = activityFilter === 'all' || 
      (activityFilter === 'active' && isActiveClient(client)) ||
      (activityFilter === 'inactive' && !isActiveClient(client));

    return matchesSearch && matchesStatus && matchesTag && matchesActivity;
  });

  const getStatusColor = (status: ClientStatus) => {
    switch (status) {
      case 'ACTIVE': return 'bg-emerald-500/10 text-emerald-600';
      case 'INACTIVE': return 'bg-gray-500/10 text-gray-600';
      case 'SUSPENDED': return 'bg-red-500/10 text-red-600';
      case 'PENDING_KYC': return 'bg-amber-500/10 text-amber-600';
      default: return 'bg-gray-500/10 text-gray-600';
    }
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Clients</h1>
            <p className="text-muted-foreground">{clients.length} clients enregistrés</p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau client
          </Button>
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
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="ACTIVE">Actif</SelectItem>
                  <SelectItem value="INACTIVE">Inactif</SelectItem>
                  <SelectItem value="SUSPENDED">Suspendu</SelectItem>
                  <SelectItem value="PENDING_KYC">KYC en attente</SelectItem>
                </SelectContent>
              </Select>
              <Select value={tagFilter} onValueChange={setTagFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Tag" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les tags</SelectItem>
                  {tags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={activityFilter} onValueChange={setActivityFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Activité" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toute activité</SelectItem>
                  <SelectItem value="active">Actif récemment</SelectItem>
                  <SelectItem value="inactive">Inactif</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Clients List */}
        <div className="space-y-3">
          {filteredClients.map((client) => {
            const clientWithTags = getClientWithTags(client);
            return (
              <Card 
                key={client.id} 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/admin/clients/${client.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {client.firstName[0]}{client.lastName[0]}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-foreground">
                              {client.firstName} {client.lastName}
                            </h3>
                            <Badge className={getStatusColor(client.status)}>
                              {getClientStatusLabel(client.status)}
                            </Badge>
                            {client.kycVerified && (
                              <CheckCircle className="h-4 w-4 text-emerald-500" />
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {client.whatsappNumber}
                            </span>
                            {client.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {client.email}
                              </span>
                            )}
                          </div>
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
                            <DropdownMenuItem>Modifier</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">Suspendre</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {client.company && (
                        <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                          <Building2 className="h-3 w-3" />
                          {client.company}
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {clientWithTags.tags.map((tag) => (
                          <Badge key={tag.id} variant="secondary" className={tag.color}>
                            {tag.name}
                          </Badge>
                        ))}
                      </div>

                      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
                        <div>
                          <p className="text-xs text-muted-foreground">Solde wallet</p>
                          <p className="text-sm font-semibold text-foreground">
                            {formatCurrency(client.walletBalance)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Total dépôts</p>
                          <p className="text-sm font-semibold text-emerald-600">
                            {formatCurrency(client.totalDeposits)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Total paiements</p>
                          <p className="text-sm font-semibold text-blue-600">
                            {formatCurrency(client.totalPayments)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {filteredClients.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">Aucun client trouvé</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
