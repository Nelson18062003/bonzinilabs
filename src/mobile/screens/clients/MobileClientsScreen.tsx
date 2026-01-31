import { useState } from 'react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminClients } from '@/hooks/useAdminData';
import { Loader2, Search } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { useNavigate } from 'react-router-dom';

export function MobileClientsScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: clients, isLoading } = useAdminClients();
  const navigate = useNavigate();

  const filteredClients = clients?.filter(client => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    const name = `${client.first_name || ''} ${client.last_name || ''}`.toLowerCase();
    const phone = client.phone?.toLowerCase() || '';
    return name.includes(search) || phone.includes(search);
  });

  return (
    <div className="flex flex-col min-h-full">
      <MobileHeader title="Clients" />

      <div className="flex-1 px-4 py-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher un client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-lg bg-muted border-0 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Clients List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredClients && filteredClients.length > 0 ? (
          <div className="space-y-3">
            {filteredClients.map((client) => (
              <button
                key={client.user_id}
                onClick={() => navigate(`/m/clients/${client.user_id}`)}
                className="w-full bg-card rounded-xl p-4 border border-border text-left active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-base font-medium text-primary flex-shrink-0">
                    {client.first_name?.[0] || '?'}
                    {client.last_name?.[0] || ''}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {client.first_name} {client.last_name}
                    </p>
                    {client.phone && (
                      <p className="text-sm text-muted-foreground truncate">
                        {client.phone}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-primary">
                      {formatCurrency(client.wallets?.balance_xaf || 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">Solde</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Search className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">Aucun client trouvé</p>
          </div>
        )}
      </div>
    </div>
  );
}
