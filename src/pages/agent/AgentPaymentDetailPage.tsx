import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, CheckCircle2, User, Phone, Mail, AlertCircle, Building2, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AgentLayout } from '@/components/agent/AgentLayout';
import { SignatureCanvas } from '@/components/cash/SignatureCanvas';
import { CashReceiptDownloadButton } from '@/components/cash/CashReceiptDownloadButton';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAgentCashPaymentDetail } from '@/hooks/useAgentCashPayments';
import { useConfirmCashPayment } from '@/hooks/useCashPayment';
import { formatRMB } from '@/lib/formatters';
import { format } from 'date-fns';

export default function AgentPaymentDetailPage() {
  const { paymentId } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { data: payment, isLoading, error } = useAgentCashPaymentDetail(paymentId);
  const confirmPayment = useConfirmCashPayment();
  
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [cashHanded, setCashHanded] = useState(false);
  const [confirmedName, setConfirmedName] = useState('');
  const [isConfirmed, setIsConfirmed] = useState(false);

  const getBeneficiaryName = () => {
    if (payment?.cash_beneficiary_first_name && payment?.cash_beneficiary_last_name) {
      return `${payment.cash_beneficiary_first_name} ${payment.cash_beneficiary_last_name}`;
    }
    return payment?.beneficiary_name || '-';
  };

  const handleProceedToPayment = () => {
    setConfirmedName(getBeneficiaryName());
    setShowConfirmation(true);
  };

  const handleSignatureSave = async (signatureDataUrl: string) => {
    if (!payment || !cashHanded) return;

    await confirmPayment.mutateAsync({
      paymentId: payment.id,
      signatureDataUrl,
      signedByName: confirmedName || getBeneficiaryName(),
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

  // Success state after confirmation
  if (isConfirmed) {
    return (
      <AgentLayout>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-24 h-24 rounded-full bg-green-500/10 flex items-center justify-center mb-6">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-green-600 mb-2">{t('payment_success')}</h1>
          <p className="text-4xl font-bold mb-2">{formatRMB(payment.amount_rmb)}</p>
          <p className="text-lg text-muted-foreground mb-2">{getBeneficiaryName()}</p>
          <p className="text-sm text-muted-foreground mb-8">{t('proof_available')}</p>
          
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

  // Already paid state (read-only)
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
          <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>
          <Badge className="bg-green-500 hover:bg-green-500/80 mb-4 text-base px-4 py-1">
            {t('already_paid')}
          </Badge>
          <p className="text-4xl font-bold">{formatRMB(payment.amount_rmb)}</p>
          {payment.cash_paid_at && (
            <p className="text-muted-foreground mt-2">
              {t('already_paid_on')} {format(new Date(payment.cash_paid_at), 'dd/MM/yyyy HH:mm')}
            </p>
          )}
        </div>

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
          </CardContent>
        </Card>

        {/* Signature proof */}
        {payment.cash_signature_url && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('signature')}</CardTitle>
            </CardHeader>
            <CardContent>
              <img 
                src={payment.cash_signature_url} 
                alt="Signature" 
                className="max-h-32 mx-auto border rounded-lg bg-white p-2"
              />
              {payment.cash_signed_by_name && (
                <p className="text-center text-sm text-muted-foreground mt-2">
                  {t('paid_by')}: {payment.cash_signed_by_name}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Download PDF Button */}
        <div className="mt-4">
          <CashReceiptDownloadButton
            payment={payment}
            client={payment.profile}
            variant="default"
            className="w-full"
            label="下载凭证 / Download Receipt"
          />
        </div>
      </AgentLayout>
    );
  }

  // Confirmation screen (signature + checkbox)
  if (showConfirmation) {
    return (
      <AgentLayout>
        <Button 
          variant="ghost" 
          className="mb-4"
          onClick={() => setShowConfirmation(false)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('back')}
        </Button>

        <h1 className="text-xl font-bold mb-4">{t('cash_confirmation')}</h1>

        {/* Recap Block */}
        <Card className="mb-4 border-primary/50 bg-primary/5">
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground mb-1">{t('amount_to_pay')}</p>
            <p className="text-4xl font-bold text-primary mb-3">{formatRMB(payment.amount_rmb)}</p>
            
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{getBeneficiaryName()}</span>
              </div>
              {(payment.cash_beneficiary_phone || payment.beneficiary_phone) && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{payment.cash_beneficiary_phone || payment.beneficiary_phone}</span>
                </div>
              )}
              <div className="text-xs text-muted-foreground mt-2">
                ID: {payment.id.slice(0, 8)}...
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Warning */}
        <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg mb-4 text-center">
          ⚠️ {t('verify_identity')}
        </p>

        {/* Confirmed Name */}
        <Card className="mb-4">
          <CardContent className="py-4 space-y-3">
            <Label htmlFor="confirmedName">{t('beneficiary_name_confirmed')}</Label>
            <Input
              id="confirmedName"
              value={confirmedName}
              onChange={(e) => setConfirmedName(e.target.value)}
              placeholder={getBeneficiaryName()}
            />
          </CardContent>
        </Card>

        {/* Cash Handed Checkbox */}
        <Card className="mb-4">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="cashHanded"
                checked={cashHanded}
                onCheckedChange={(checked) => setCashHanded(checked as boolean)}
                className="mt-0.5"
              />
              <Label 
                htmlFor="cashHanded" 
                className="text-base font-medium cursor-pointer"
              >
                ✓ {t('cash_handed')}
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Signature Zone */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('signature_required')}</CardTitle>
            <p className="text-sm text-muted-foreground">{t('signature_instruction')}</p>
          </CardHeader>
          <CardContent>
            <SignatureCanvas
              onSave={handleSignatureSave}
              onCancel={() => setShowConfirmation(false)}
              isLoading={confirmPayment.isPending}
            />
            {!cashHanded && (
              <p className="text-sm text-destructive mt-2 text-center">
                ⚠️ {t('cash_handed')} - {t('signature_required')}
              </p>
            )}
          </CardContent>
        </Card>
      </AgentLayout>
    );
  }

  // Main payment detail view (before confirmation)
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

      {/* Amount Block - Very prominent */}
      <Card className="mb-4 border-primary/50 bg-primary/5">
        <CardContent className="py-6 text-center">
          <p className="text-sm text-muted-foreground mb-1">{t('amount_to_pay')}</p>
          <p className="text-5xl font-bold text-primary">{formatRMB(payment.amount_rmb)}</p>
          <Badge variant="secondary" className="mt-3">
            {t('status_to_pay')}
          </Badge>
        </CardContent>
      </Card>

      {/* Beneficiary Info */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">{t('beneficiary_info')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-muted-foreground" />
            <span className="font-medium text-lg">{getBeneficiaryName()}</span>
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

      {/* Client Info */}
      {payment.profile && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">{t('client_info')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-3">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <span>{payment.profile.first_name} {payment.profile.last_name}</span>
            </div>
            {payment.profile.phone && (
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>{payment.profile.phone}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payment Details */}
      <Card className="mb-6">
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

      {/* CTA Button */}
      <Button 
        className="w-full h-14 text-lg"
        onClick={handleProceedToPayment}
      >
        <CheckCircle2 className="w-5 h-5 mr-2" />
        {t('proceed_to_payment')}
      </Button>
    </AgentLayout>
  );
}
