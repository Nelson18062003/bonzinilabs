import { useState } from 'react';
import { 
  Search, 
  Filter,
  User,
  ArrowDownToLine,
  ArrowUpFromLine,
  TrendingUp,
  Shield,
  Wallet,
  LogIn,
  LogOut,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { adminLogs } from '@/data/adminMockData';
import { formatDate } from '@/data/mockData';
import { AdminActionType } from '@/types/admin';

export function AdminHistoryPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');

  const filteredLogs = adminLogs.filter((log) => {
    const matchesSearch = 
      log.description.toLowerCase().includes(search.toLowerCase()) ||
      log.adminUserName.toLowerCase().includes(search.toLowerCase());
    
    const matchesType = typeFilter === 'all' || log.targetType === typeFilter;
    const matchesUser = userFilter === 'all' || log.adminUserId === userFilter;

    return matchesSearch && matchesType && matchesUser;
  });

  const getActionIcon = (actionType: AdminActionType) => {
    switch (actionType) {
      case 'DEPOSIT_VALIDATED':
      case 'DEPOSIT_REJECTED':
        return <ArrowDownToLine className="h-4 w-4" />;
      case 'PAYMENT_PROCESSED':
      case 'PAYMENT_COMPLETED':
        return <ArrowUpFromLine className="h-4 w-4" />;
      case 'RATE_UPDATED':
      case 'RATE_CREATED':
      case 'RATE_DELETED':
        return <TrendingUp className="h-4 w-4" />;
      case 'CLIENT_UPDATED':
      case 'CLIENT_SUSPENDED':
        return <User className="h-4 w-4" />;
      case 'WALLET_CREDITED':
      case 'WALLET_DEBITED':
        return <Wallet className="h-4 w-4" />;
      case 'LOGIN':
        return <LogIn className="h-4 w-4" />;
      case 'LOGOUT':
        return <LogOut className="h-4 w-4" />;
      default:
        return <Shield className="h-4 w-4" />;
    }
  };

  const getActionColor = (actionType: AdminActionType) => {
    if (actionType.includes('VALIDATED') || actionType.includes('COMPLETED') || actionType.includes('CREDITED')) {
      return 'bg-emerald-500/10 text-emerald-600';
    }
    if (actionType.includes('REJECTED') || actionType.includes('SUSPENDED') || actionType.includes('DEBITED')) {
      return 'bg-red-500/10 text-red-600';
    }
    if (actionType.includes('PROCESSING') || actionType.includes('UPDATED')) {
      return 'bg-amber-500/10 text-amber-600';
    }
    return 'bg-gray-500/10 text-gray-600';
  };

  const getTargetTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      DEPOSIT: 'Dépôt',
      PAYMENT: 'Paiement',
      CLIENT: 'Client',
      RATE: 'Taux',
      WALLET: 'Wallet',
      AUTH: 'Auth',
    };
    return labels[type] || type;
  };

  const uniqueUsers = [...new Set(adminLogs.map(log => log.adminUserId))];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Historique & Logs</h1>
        <p className="text-muted-foreground">
          Traçabilité des actions administrateurs
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Dépôts', type: 'DEPOSIT', icon: ArrowDownToLine, color: 'text-emerald-500' },
          { label: 'Paiements', type: 'PAYMENT', icon: ArrowUpFromLine, color: 'text-blue-500' },
          { label: 'Clients', type: 'CLIENT', icon: User, color: 'text-amber-500' },
          { label: 'Taux', type: 'RATE', icon: TrendingUp, color: 'text-primary' },
        ].map((item) => (
          <Card key={item.type}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {adminLogs.filter(l => l.targetType === item.type).length}
                  </p>
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                </div>
                <item.icon className={`h-8 w-8 ${item.color} opacity-50`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher dans les logs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous types</SelectItem>
                <SelectItem value="DEPOSIT">Dépôts</SelectItem>
                <SelectItem value="PAYMENT">Paiements</SelectItem>
                <SelectItem value="CLIENT">Clients</SelectItem>
                <SelectItem value="RATE">Taux</SelectItem>
                <SelectItem value="WALLET">Wallet</SelectItem>
                <SelectItem value="AUTH">Auth</SelectItem>
              </SelectContent>
            </Select>
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Utilisateur" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {uniqueUsers.map((userId) => {
                  const user = adminLogs.find(l => l.adminUserId === userId);
                  return (
                    <SelectItem key={userId} value={userId}>
                      {user?.adminUserName}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Journal d'activité</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredLogs.map((log, index) => (
              <div 
                key={log.id} 
                className={`flex gap-4 pb-4 ${
                  index < filteredLogs.length - 1 ? 'border-b border-border' : ''
                }`}
              >
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {log.adminUserName.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {log.adminUserName}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {log.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge className={getActionColor(log.actionType)}>
                        {getActionIcon(log.actionType)}
                        <span className="ml-1">{getTargetTypeLabel(log.targetType)}</span>
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>{formatDate(log.createdAt)}</span>
                    {log.ipAddress && <span>IP: {log.ipAddress}</span>}
                    {log.targetId && <span>ID: {log.targetId}</span>}
                  </div>
                </div>
              </div>
            ))}

            {filteredLogs.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                Aucun log trouvé
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
