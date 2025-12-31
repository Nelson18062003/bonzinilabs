import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ExportablePayment, generatePaymentsExportPDF, downloadPaymentsExportPDF } from '@/lib/generatePaymentsExportPDF';
import { Download, Eye, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface PaymentExportPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payments: ExportablePayment[];
}

const formatRMB = (amount: number): string => {
  return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

const getMethodLabel = (method: string): string => {
  switch (method) {
    case 'alipay': return 'Alipay';
    case 'wechat': return 'WeChat Pay';
    case 'bank_transfer': return 'Bank Transfer';
    case 'cash': return 'Cash';
    default: return method;
  }
};

export function PaymentExportPreviewModal({
  open,
  onOpenChange,
  payments,
}: PaymentExportPreviewModalProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const totalRMB = payments.reduce((sum, p) => sum + p.amount_rmb, 0);

  useEffect(() => {
    // Clean up blob URL when modal closes
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  useEffect(() => {
    if (!open) {
      setPdfUrl(null);
      setShowPreview(false);
    }
  }, [open]);

  const handleGeneratePreview = async () => {
    setIsGenerating(true);
    try {
      const doc = await generatePaymentsExportPDF(payments);
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setShowPreview(true);
    } catch (error) {
      console.error('Preview generation error:', error);
      toast.error('Failed to generate preview');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await downloadPaymentsExportPDF(payments);
      toast.success(`${payments.length} payment(s) exported`);
      onOpenChange(false);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download PDF');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Export Payments Preview</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {!showPreview ? (
            <ScrollArea className="h-[60vh]">
              <div className="space-y-4 p-4">
                {/* Summary */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Number of Payments</p>
                    <p className="text-3xl font-bold text-primary">{payments.length}</p>
                  </div>
                  <div className="bg-primary/10 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Total Amount</p>
                    <p className="text-3xl font-bold text-primary">{formatRMB(totalRMB)} RMB</p>
                  </div>
                </div>

                {/* Payment cards */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground">Payments to Export:</h3>
                  {payments.map((payment, index) => (
                    <div 
                      key={payment.id} 
                      className="border rounded-lg p-4 bg-card"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium bg-primary/10 text-primary px-2 py-1 rounded">
                          Payment {index + 1}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {getMethodLabel(payment.method)}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{payment.beneficiary_name || 'No beneficiary name'}</p>
                          {payment.beneficiary_phone && (
                            <p className="text-sm text-muted-foreground">{payment.beneficiary_phone}</p>
                          )}
                          {payment.beneficiary_bank_name && (
                            <p className="text-sm text-muted-foreground">
                              {payment.beneficiary_bank_name} - {payment.beneficiary_bank_account}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary">
                            {formatRMB(payment.amount_rmb)} RMB
                          </p>
                          {payment.beneficiary_qr_code_url && (
                            <span className="text-xs text-green-600">QR Code included</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollArea>
          ) : (
            <div className="h-[60vh]">
              {pdfUrl && (
                <iframe
                  src={pdfUrl}
                  className="w-full h-full border rounded-lg"
                  title="PDF Preview"
                />
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {!showPreview ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                variant="secondary" 
                onClick={handleGeneratePreview}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Eye className="w-4 h-4 mr-2" />
                )}
                Preview PDF
              </Button>
              <Button onClick={handleDownload} disabled={isDownloading}>
                {isDownloading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Download
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setShowPreview(false)}>
                Back to Summary
              </Button>
              <Button onClick={handleDownload} disabled={isDownloading}>
                {isDownloading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Download PDF
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
