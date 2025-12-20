import { useState } from 'react';
import { 
  Search, 
  User,
  ArrowDownToLine,
  ArrowUpFromLine,
  TrendingUp,
  Shield,
  Loader2,
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
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAdminAuditLogs } from '@/hooks/useAdminData';
import { formatDate } from '@/lib/formatters';

export function AdminHistoryPage() {
  const { data: logs, isLoading } = useAdminAuditLogs();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const filteredLogs = logs?.filter((log) => {
    const matchesSearch = 
      log.action_type.toLowerCase().includes(search.toLowerCase()) ||
      (log.adminProfile?.first_name?.toLowerCase().includes(search.toLowerCase()) ?? false);
    
    const matchesType = typeFilter === 'all' || log.target_type === typeFilter;

    return matchesSearch && matchesType;
  }) || [];

  const getActionIcon = (actionType: string) => {
    if (actionType.includes('deposit') || actionType.includes('DEPOSIT')) {
      return <ArrowDownToLine className="h-4 w-4" />;
    }
    if (actionType.includes('payment') || actionType.includes('PAYMENT')) {
      return <ArrowUpFromLine className="h-4 w-4" />;
    }
    if (actionType.includes('rate') || actionType.includes('RATE')) {
      return <TrendingUp className="h-4 w-4" />;
    }
    if (actionType.includes('client') || actionType.includes('CLIENT')) {
      return <User className="h-4 w-4" />;
    }
    return <Shield className="h-4 w-4" />;
  };

  const getActionColor = (actionType: string) => {
    if (actionType.includes('validate') || actionType.includes('VALIDATE')) {
      return 'bg-emerald-500/10 text-emerald-600';
    }
    if (actionType.includes('reject') || actionType.includes('REJECT')) {
      return 'bg-red-500/10 text-red-600';
    }
    return 'bg-gray-500/10 text-gray-600';
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Historique & Logs</h1>
          <p className="text-muted-foreground">
            Traçabilité des actions administrateurs
          </p>
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
                  <SelectItem value="deposit">Dépôts</SelectItem>
                  <SelectItem value="payment">Paiements</SelectItem>
                  <SelectItem value="client">Clients</SelectItem>
                  <SelectItem value="rate">Taux</SelectItem>
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
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
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
                        {log.adminProfile 
                          ? `${log.adminProfile.first_name[0]}${log.adminProfile.last_name[0]}`
                          : 'AD'
                        }
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {log.adminProfile 
                              ? `${log.adminProfile.first_name} ${log.adminProfile.last_name}`
                              : 'Admin'
                            }
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {log.action_type}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge className={getActionColor(log.action_type)}>
                            {getActionIcon(log.action_type)}
                            <span className="ml-1">{log.target_type}</span>
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>{formatDate(log.created_at)}</span>
                        {log.target_id && <span>ID: {log.target_id.slice(0, 8)}...</span>}
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
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}