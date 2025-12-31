import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface RateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { rateRmbToXaf: number; effectiveAt: Date }) => void;
  isLoading?: boolean;
  initialData?: {
    rateRmbToXaf: number;
    effectiveAt: Date;
  };
  mode: 'create' | 'edit';
}

export function RateFormDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
  initialData,
  mode,
}: RateFormDialogProps) {
  const [rate, setRate] = useState<string>('');
  const [date, setDate] = useState<Date>(new Date());
  const [time, setTime] = useState<string>(format(new Date(), 'HH:mm'));

  useEffect(() => {
    if (initialData) {
      setRate(initialData.rateRmbToXaf.toString());
      setDate(initialData.effectiveAt);
      setTime(format(initialData.effectiveAt, 'HH:mm'));
    } else {
      setRate('');
      setDate(new Date());
      setTime(format(new Date(), 'HH:mm'));
    }
  }, [initialData, open]);

  const handleSubmit = () => {
    const rateValue = parseFloat(rate);
    if (isNaN(rateValue) || rateValue <= 0) return;

    const [hours, minutes] = time.split(':').map(Number);
    const effectiveAt = new Date(date);
    effectiveAt.setHours(hours, minutes, 0, 0);

    onSubmit({ rateRmbToXaf: rateValue, effectiveAt });
  };

  const previewCNY = rate && !isNaN(parseFloat(rate)) 
    ? Math.round(1000000 / parseFloat(rate)).toLocaleString()
    : '—';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Nouveau taux de change' : 'Modifier le taux'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Définir un nouveau taux XAF vers CNY'
              : 'Corriger la valeur ou la date du taux'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {/* Rate input */}
          <div className="space-y-2">
            <Label htmlFor="rate">Taux (1 CNY = ? XAF)</Label>
            <Input
              id="rate"
              type="number"
              step="0.01"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="Ex: 86.21"
            />
            <p className="text-sm text-muted-foreground">
              Entrez combien de XAF pour 1 CNY
            </p>
          </div>

          {/* Date picker */}
          <div className="space-y-2">
            <Label>Date d'effet</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !date && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PPP', { locale: fr }) : 'Choisir une date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  locale={fr}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time input */}
          <div className="space-y-2">
            <Label htmlFor="time">Heure</Label>
            <Input
              id="time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>

          {/* Preview */}
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Aperçu :</p>
            <p className="text-lg font-semibold">
              1 000 000 XAF = {previewCNY} CNY
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Effectif le {date ? format(date, 'dd MMMM yyyy', { locale: fr }) : '—'} à {time}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isLoading || !rate || parseFloat(rate) <= 0}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : mode === 'create' ? (
                'Créer le taux'
              ) : (
                'Enregistrer'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
