import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronRight, Loader2, Banknote, CheckCircle2 } from 'lucide-react';
import { AgentLayout } from '@/components/agent/AgentLayout';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAgentCashPayments, CashPayment } from '@/hooks/useAgentCashPayments';
import { formatRMB } from '@/lib/formatters';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

function PaymentCard({ payment, onClick }: { payment: CashPayment; onClick: () => void }) {
  const { t } = useLanguage();
  
  const getBeneficiaryName = () => {
    if (payment.cash_beneficiary_first_name && payment.cash_beneficiary_last_name) {
      return `${payment.cash_beneficiary_first_name} ${payment.cash_beneficiary_last_name}`;
    }
    return payment.beneficiary_name || '-';
  };

  const getClientName = () => {
    if (payment.profile) {
      return `${payment.profile.first_name} ${payment.profile.last_name}`;
    }
    return '-';
  };

  const isPaid = payment.status === 'completed';

  return (
    <Card 
      className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Amount - Big and prominent */}
          <div className="text-xl font-bold text-primary mb-1">
            {formatRMB(payment.amount_rmb)}
          </div>
          
          {/* Beneficiary */}
          <div className="text-sm font-medium truncate">
            {getBeneficiaryName()}
          </div>
          
          {/* Client & Phone */}
          <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
            <div>{t('client')}: {getClientName()}</div>
            <div>{payment.cash_beneficiary_phone || payment.beneficiary_phone || '-'}</div>
          </div>
          
          {/* Date & Reference */}
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <span>{format(new Date(payment.created_at), 'dd/MM/yyyy HH:mm')}</span>
            <span>•</span>
            <span className="font-mono">{payment.reference}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <Badge 
            variant={isPaid ? 'default' : 'secondary'}
            className={cn(
              isPaid && 'bg-green-500 hover:bg-green-500/80'
            )}
          >
            {isPaid ? (
              <><CheckCircle2 className="w-3 h-3 mr-1" />{t('status_paid')}</>
            ) : (
              t('status_to_pay')
            )}
          </Badge>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </div>
      </div>
    </Card>
  );
}

function PaymentList({ status }: { status: 'pending' | 'paid' }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { data: payments, isLoading } = useAgentCashPayments(status);
  const [search, setSearch] = useState('');

  const filteredPayments = payments?.filter(p => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    const beneficiaryName = `${p.cash_beneficiary_first_name || ''} ${p.cash_beneficiary_last_name || ''} ${p.beneficiary_name || ''}`.toLowerCase();
    const clientName = `${p.profile?.first_name || ''} ${p.profile?.last_name || ''}`.toLowerCase();
    return (
      beneficiaryName.includes(searchLower) ||
      clientName.includes(searchLower) ||
      p.reference.toLowerCase().includes(searchLower) ||
      p.id.toLowerCase().includes(searchLower)
    );
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('search')}
          className="pl-10"
        />
      </div>

      {/* Payment List */}
      {filteredPayments?.length === 0 ? (
        <div className="text-center py-12">
          <Banknote className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            {status === 'pending' ? t('no_pending_payments') : t('no_paid_payments')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPayments?.map(payment => (
            <PaymentCard 
              key={payment.id} 
              payment={payment}
              onClick={() => navigate(`/agent/payments/${payment.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AgentPaymentsPage() {
  const { t } = useLanguage();

  return (
    <AgentLayout title={t('cash_payments')}>
      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="pending">{t('to_pay')}</TabsTrigger>
          <TabsTrigger value="paid">{t('paid')}</TabsTrigger>
        </TabsList>
        
        <TabsContent value="pending">
          <PaymentList status="pending" />
        </TabsContent>
        
        <TabsContent value="paid">
          <PaymentList status="paid" />
        </TabsContent>
      </Tabs>
    </AgentLayout>
  );
}
