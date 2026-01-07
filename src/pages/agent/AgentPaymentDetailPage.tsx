import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, CheckCircle2, User, Phone, Mail, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AgentLayout } from '@/components/agent/AgentLayout';
import { SignatureCanvas } from '@/components/cash/SignatureCanvas';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAgentCashPaymentDetail } from '@/hooks/useAgentCashPayments';
import { useConfirmCashPayment } from '@/hooks/useCashPayment';
import { formatRMB } from '@/lib/formatters';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function AgentPaymentDetailPage() {
  const { paymentId } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { data: payment, isLoading, error } = useAgentCashPaymentDetail(paymentId);
  const confirmPayment = useConfirmCashPayment();
  const [showSignature, setShowSignature] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const handleSignatureSave = async (signatureDataUrl: string) => {
    if (!payment) return;

    const signedByName = payment.cash_beneficiary_first_name && payment.cash_beneficiary_last_name
      ? `${payment.cash_beneficiary_first_name} ${payment.cash_beneficiary_last_name}`
      : payment.beneficiary_name || 'Unknown';

    await confirmPayment.mutateAsync({
      paymentId: payment.id,
      signatureDataUrl,
      signedByName,
    });

    setIsConfirmed(true);
  };

  if (isLoading) {
    return (
      <AgentLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AgentLayout>
    );
  }

  if (error || !payment) {
    return (
      <AgentLayout>
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
          <p className="text-lg font-medium">{t('payment_not_found')}</p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => navigate('/agent/payments')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('back_to_list')}
          </Button>
        </div>
      </AgentLayout>
    );
  }

  const isPaid = payment.status === 'completed';
  const getBeneficiaryName = () => {
    if (payment.cash_beneficiary_first_name && payment.cash_beneficiary_last_name) {
      return `${payment.cash_beneficiary_first_name} ${payment.cash_beneficiary_last_name}`;
    }
    return payment.beneficiary_name || '-';
  };

  // Success state
  if (isConfirmed) {
    return (
      <AgentLayout>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-green-600 mb-2">{t('payment_success')}</h1>
          <p className="text-3xl font-bold mb-2">{formatRMB(payment.amount_rmb)}</p>
          <p className="text-muted-foreground mb-8">{getBeneficiaryName()}</p>
          
          <div className="flex gap-3">
            <Button 
              variant="outline"
              onClick={() => navigate('/agent/payments')}
            >
              {t('back_to_list')}
            </Button>
            <Button onClick={() => navigate('/agent/scan')}>
              {t('scan_another')}
            </Button>
          </div>
        </div>
      </AgentLayout>
    );
  }

  // Already paid state
  if (isPaid) {
    return (
      <AgentLayout>
        <Button 
          variant="ghost" 
          className="mb-4"
          onClick={() => navigate('/agent/payments')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('back')}
        </Button>

        <div className="text-center py-8 mb-6">
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
          <Badge className="bg-green-500 hover:bg-green-500/80 mb-4">
            {t('already_paid')}
          </Badge>
          <p className="text-3xl font-bold">{formatRMB(payment.amount_rmb)}</p>
          <p className="text-muted-foreground mt-2">
            {payment.cash_paid_at && format(new Date(payment.cash_paid_at), 'dd/MM/yyyy HH:mm')}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('beneficiary_info')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-muted-foreground" />
              <span>{getBeneficiaryName()}</span>
            </div>
            {(payment.cash_beneficiary_phone || payment.beneficiary_phone) && (
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>{payment.cash_beneficiary_phone || payment.beneficiary_phone}</span>
              </div>
            )}
            {payment.beneficiary_email && (
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span>{payment.beneficiary_email}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {payment.cash_signature_url && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">Signature</CardTitle>
            </CardHeader>
            <CardContent>
              <img 
                src={payment.cash_signature_url} 
                alt="Signature" 
                className="max-h-24 mx-auto"
              />
              {payment.cash_signed_by_name && (
                <p className="text-center text-sm text-muted-foreground mt-2">
                  {payment.cash_signed_by_name}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </AgentLayout>
    );
  }

  // Pending payment - main flow
  return (
    <AgentLayout>
      <Button 
        variant="ghost" 
        className="mb-4"
        onClick={() => navigate('/agent/payments')}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        {t('back')}
      </Button>

      {/* Amount to pay - VERY prominent */}
      <Card className="mb-4 border-primary/50 bg-primary/5">
        <CardContent className="py-6 text-center">
          <p className="text-sm text-muted-foreground mb-1">{t('amount_to_pay')}</p>
          <p className="text-4xl font-bold text-primary">{formatRMB(payment.amount_rmb)}</p>
          <Badge variant="secondary" className="mt-2">
            {t('status_to_pay')}
          </Badge>
        </CardContent>
      </Card>

      {/* Payment Info */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">{t('payment_details')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('payment_id')}</span>
            <span className="font-mono">{payment.id.slice(0, 8)}...</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('reference')}</span>
            <span className="font-mono">{payment.reference}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('date')}</span>
            <span>{format(new Date(payment.created_at), 'dd/MM/yyyy HH:mm')}</span>
          </div>
        </CardContent>
      </Card>

      {/* Beneficiary Info */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">{t('beneficiary_info')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">{getBeneficiaryName()}</span>
          </div>
          {(payment.cash_beneficiary_phone || payment.beneficiary_phone) && (
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span>{payment.cash_beneficiary_phone || payment.beneficiary_phone}</span>
            </div>
          )}
          {payment.beneficiary_email && (
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span>{payment.beneficiary_email}</span>
            </div>
          )}
          {payment.profile && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-1">{t('client')}</p>
              <p className="font-medium">{payment.profile.first_name} {payment.profile.last_name}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Signature Section */}
      {showSignature ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('signature_required')}</CardTitle>
          </CardHeader>
          <CardContent>
            <SignatureCanvas
              onSave={handleSignatureSave}
              onCancel={() => setShowSignature(false)}
              isLoading={confirmPayment.isPending}
            />
          </CardContent>
        </Card>
      ) : (
        <Button 
          className="w-full h-14 text-lg"
          onClick={() => setShowSignature(true)}
        >
          <CheckCircle2 className="w-5 h-5 mr-2" />
          {t('confirm_payment')}
        </Button>
      )}
    </AgentLayout>
  );
}
