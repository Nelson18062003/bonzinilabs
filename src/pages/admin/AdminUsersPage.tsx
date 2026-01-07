import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAdminAuth, ADMIN_ROLE_LABELS } from '@/contexts/AdminAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAdminUsers } from '@/hooks/useAdminData';
import { formatDate } from '@/lib/formatters';
import { CreateAgentModal } from '@/components/admin/CreateAgentModal';
import { 
  Search,
  Shield,
  Users,
  UserCheck,
  UserPlus,
  Loader2,
} from 'lucide-react';

export function AdminUsersPage() {
  const { currentUser } = useAdminAuth();
  const { data: users, isLoading } = useAdminUsers();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateAgent, setShowCreateAgent] = useState(false);

  const filteredUsers = users?.filter(user => {
    const searchLower = searchQuery.toLowerCase();
    const profile = user.profile;
    if (!profile) return false;
    return (
      profile.first_name.toLowerCase().includes(searchLower) ||
      profile.last_name.toLowerCase().includes(searchLower)
    );
  }) || [];

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'super_admin': return 'default';
      case 'ops': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Utilisateurs Admin</h1>
            <p className="text-muted-foreground">Gérez les comptes de l'équipe Bonzini</p>
          </div>
          <Button onClick={() => setShowCreateAgent(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Créer un Agent Cash
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total utilisateurs</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Super Admins</CardTitle>
              <Shield className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {users?.filter(u => u.role === 'super_admin').length || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Autres rôles</CardTitle>
              <UserCheck className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                {users?.filter(u => u.role !== 'super_admin').length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un utilisateur..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Users Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Créé le</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {user.profile?.first_name?.[0]}{user.profile?.last_name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-foreground">
                              {user.profile?.first_name} {user.profile?.last_name}
                              {user.user_id === currentUser?.id && (
                                <span className="ml-2 text-xs text-muted-foreground">(vous)</span>
                              )}
                            </p>
                            <p className="text-sm text-muted-foreground">{user.profile?.phone || '-'}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(user.role)} className="gap-1">
                          <Shield className="h-3 w-3" />
                          {ADMIN_ROLE_LABELS[user.role] || user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(user.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create Agent Modal */}
        <CreateAgentModal open={showCreateAgent} onOpenChange={setShowCreateAgent} />
      </div>
    </AdminLayout>
  );
}