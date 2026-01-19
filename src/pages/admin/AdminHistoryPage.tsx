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
import { AdminResponsiveHeader, AdminResponsiveFilters } from '@/components/admin/ui/AdminResponsive';
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
    if (actionType.includes('deposit') || actionType.includes('DEPOSIT')) return <ArrowDownToLine className="h-3 w-3 sm:h-4 sm:w-4" />;
    if (actionType.includes('payment') || actionType.includes('PAYMENT')) return <ArrowUpFromLine className="h-3 w-3 sm:h-4 sm:w-4" />;
    if (actionType.includes('rate') || actionType.includes('RATE')) return <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4" />;
    if (actionType.includes('client') || actionType.includes('CLIENT')) return <User className="h-3 w-3 sm:h-4 sm:w-4" />;
    return <Shield className="h-3 w-3 sm:h-4 sm:w-4" />;
  };

  const getActionColor = (actionType: string) => {
    if (actionType.includes('validate') || actionType.includes('VALIDATE')) return 'bg-emerald-500/10 text-emerald-600';
    if (actionType.includes('reject') || actionType.includes('REJECT')) return 'bg-red-500/10 text-red-600';
    return 'bg-gray-500/10 text-gray-600';
  };

  return (
    <AdminLayout>
      <div className="space-y-4 sm:space-y-6">
        <AdminResponsiveHeader title="Historique & Logs" subtitle="Traçabilité des actions" />

        <AdminResponsiveFilters>
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 w-full" />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="deposit">Dépôts</SelectItem>
              <SelectItem value="payment">Paiements</SelectItem>
              <SelectItem value="client">Clients</SelectItem>
              <SelectItem value="rate">Taux</SelectItem>
            </SelectContent>
          </Select>
        </AdminResponsiveFilters>

        <Card>
          <CardHeader className="p-4 sm:p-6"><CardTitle className="text-base sm:text-lg">Journal d'activité</CardTitle></CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
              <div className="divide-y divide-border">
                {filteredLogs.map((log) => (
                  <div key={log.id} className="flex gap-2 sm:gap-4 p-3 sm:p-4">
                    <Avatar className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {log.adminProfile ? `${log.adminProfile.first_name[0]}${log.adminProfile.last_name[0]}` : 'AD'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-medium text-foreground truncate">
                            {log.adminProfile ? `${log.adminProfile.first_name} ${log.adminProfile.last_name}` : 'Admin'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{log.action_type}</p>
                        </div>
                        <Badge className={`${getActionColor(log.action_type)} text-[10px] sm:text-xs flex-shrink-0`}>
                          {getActionIcon(log.action_type)}
                          <span className="ml-1">{log.target_type}</span>
                        </Badge>
                      </div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">{formatDate(log.created_at)}</p>
                    </div>
                  </div>
                ))}
                {filteredLogs.length === 0 && <p className="text-center text-muted-foreground py-8">Aucun log trouvé</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
