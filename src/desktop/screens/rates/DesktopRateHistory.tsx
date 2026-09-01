/**
 * Taux — carte C « Historique » (docs/admin-redesign/06).
 *
 * Table par mode + GESTION des publications : chaque ligne se corrige
 * (valeurs, date d'effet) ou se supprime — une faute de frappe publiée
 * n'est plus gravée. Actions au survol, gardées par canManageRates, via
 * les RPC auditées update_daily_rate / delete_daily_rate. Supprimer la
 * publication active réactive la plus récente restante (côté RPC).
 */
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Clock, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TextField } from '@/components/form';
import { BzDateTimeField } from '@/mobile/components/BzDateTimePicker';
import { parseDecimal } from '@/lib/decimalInput';
import { PAYMENT_METHODS } from '@/types/rates';
import type { DailyRate, PaymentMethodKey } from '@/types/rates';
import { useDailyRatesHistory, useUpdateDailyRate, useDeleteDailyRate } from '@/hooks/useDailyRates';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import {
  SURFACE,
  TEXT,
  Card,
  CardHeader,
  Holder,
  ScreenLoader,
  ScreenError,
  StatusPill,
  Th,
  Td,
  CenterDialog,
  PrimaryPill,
  SoftPill,
  FormField,
} from '@/desktop/designKit';
import { MethodLogo } from '@/mobile/screens/rates/components/MethodLogo';

function variationOf(rate: DailyRate, previous?: DailyRate): number | null {
  if (!previous || !previous.rate_cash) return null;
  return ((rate.rate_cash - previous.rate_cash) / previous.rate_cash) * 100;
}

const toLocalInput = (iso: string) => format(parseISO(iso), "yyyy-MM-dd'T'HH:mm");

export function DesktopRateHistory() {
  const { data: history, isLoading, isError } = useDailyRatesHistory(20);
  const { hasPermission } = useAdminAuth();
  const canManage = hasPermission('canManageRates');
  const updateRate = useUpdateDailyRate();
  const deleteRate = useDeleteDailyRate();

  const [editing, setEditing] = useState<DailyRate | null>(null);
  const [editValues, setEditValues] = useState<Record<PaymentMethodKey, string>>({ cash: '', alipay: '', wechat: '', virement: '' });
  const [editDate, setEditDate] = useState('');
  const [deleting, setDeleting] = useState<DailyRate | null>(null);

  const openEdit = (rate: DailyRate) => {
    setEditValues({
      cash: String(rate.rate_cash),
      alipay: String(rate.rate_alipay),
      wechat: String(rate.rate_wechat),
      virement: String(rate.rate_virement),
    });
    setEditDate(toLocalInput(rate.effective_at));
    setEditing(rate);
  };

  // Colonnes NUMERIC(10,4) : on n'arrondit PAS — même précision que la
  // création (une correction ne doit pas tronquer un taux décimal).
  const editParsed = PAYMENT_METHODS.map((pm) => parseDecimal(editValues[pm.key]));
  const editValid = editParsed.every((v) => Number.isFinite(v) && v > 0);

  const saveEdit = () => {
    if (!editing || !editValid || updateRate.isPending) return;
    const [d, t] = editDate.split('T');
    const [y, mo, da] = (d ?? '').split('-').map(Number);
    const [h, mi] = (t ?? '').split(':').map(Number);
    const local = new Date(y || 0, (mo || 1) - 1, da || 1, h || 0, mi || 0, 0, 0);
    updateRate.mutate(
      {
        rateId: editing.id,
        rate_cash: parseDecimal(editValues.cash),
        rate_alipay: parseDecimal(editValues.alipay),
        rate_wechat: parseDecimal(editValues.wechat),
        rate_virement: parseDecimal(editValues.virement),
        effective_at: Number.isNaN(local.getTime()) ? undefined : local.toISOString(),
      },
      { onSuccess: () => setEditing(null) },
    );
  };

  const confirmDelete = () => {
    if (!deleting || deleteRate.isPending) return;
    deleteRate.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
  };

  return (
    <Card className="flex min-h-0 flex-col overflow-hidden p-0">
      <CardHeader title="Historique" meta={history ? `${history.length} publications` : undefined} />
      {isLoading ? (
        <ScreenLoader />
      ) : isError ? (
        <ScreenError title="Erreur de chargement" description="Impossible de charger l'historique." />
      ) : !history || history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <Holder icon={Clock} size="lg" />
          <p className={cn('mt-3 text-[13px]', TEXT.muted)}>Aucun historique de taux</p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full text-left">
            <thead className={cn('sticky top-0 z-10', SURFACE.card)}>
              <tr>
                <Th first>Date</Th>
                {PAYMENT_METHODS.map((pm) => (
                  <Th key={pm.key} align="right">
                    <span className="inline-flex items-center gap-1">
                      <MethodLogo method={pm.key} size={14} />
                      {pm.label}
                    </span>
                  </Th>
                ))}
                <Th align="right">Δ cash</Th>
                <Th last className="w-[72px]" />
              </tr>
            </thead>
            <tbody>
              {history.map((rate, i) => {
                const variation = variationOf(rate, history[i + 1]);
                const up = variation !== null && variation >= 0;
                return (
                  <tr key={rate.id} className={cn('group', rate.is_active && 'bg-muted/50 dark:bg-white/[0.05]')}>
                    <Td first>
                      <div className="leading-[15px]">
                        <div className={cn('flex items-center gap-1.5 text-[12px] font-bold', TEXT.strong)}>
                          {format(parseISO(rate.effective_at), 'dd MMM yyyy', { locale: fr })}
                          {rate.is_active && <StatusPill tone="success" label="Actif" />}
                        </div>
                        <div className={cn('text-[10.5px] tabular-nums', TEXT.muted)}>
                          {format(parseISO(rate.effective_at), 'HH:mm')}
                        </div>
                      </div>
                    </Td>
                    {/* Cellules pilotées par PAYMENT_METHODS — même source que
                        l'en-tête, l'ordre ne peut pas diverger. */}
                    {PAYMENT_METHODS.map((pm) => (
                      <Td
                        key={pm.key}
                        align="right"
                        className={cn(
                          'text-[12.5px] tabular-nums',
                          pm.key === 'cash' ? cn('font-semibold', TEXT.strong) : TEXT.muted,
                        )}
                      >
                        {(rate[`rate_${pm.key}` as keyof DailyRate] as number).toLocaleString('fr-FR')}
                      </Td>
                    ))}
                    <Td align="right">
                      {variation !== null ? (
                        <span
                          className={cn(
                            'inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                            up
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                              : 'bg-destructive/10 text-destructive',
                          )}
                        >
                          {up ? '+' : ''}
                          {variation.toFixed(1)}%
                        </span>
                      ) : (
                        <span className={cn('text-[11px]', TEXT.muted)}>—</span>
                      )}
                    </Td>
                    <Td last align="right">
                      {canManage ? (
                        <span className="inline-flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                          <button
                            type="button"
                            onClick={() => openEdit(rate)}
                            aria-label="Corriger cette publication"
                            title="Corriger"
                            className={cn('flex h-7 w-7 items-center justify-center rounded-full', SURFACE.holder)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleting(rate)}
                            aria-label="Supprimer cette publication"
                            title="Supprimer"
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-destructive/10 text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      ) : (
                        <span aria-hidden />
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Corriger une publication ── */}
      <CenterDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        onConfirm={saveEdit}
        title="Corriger la publication"
        width={460}
        footer={
          <>
            <PrimaryPill onClick={saveEdit} disabled={!editValid} loading={updateRate.isPending} className="flex-1">
              Enregistrer
            </PrimaryPill>
            <SoftPill onClick={() => setEditing(null)} className="flex-1">
              Annuler
            </SoftPill>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {PAYMENT_METHODS.map((pm) => (
              <FormField key={pm.key} label={pm.label} htmlFor={`edit-rate-${pm.key}`}>
                <TextField
                  id={`edit-rate-${pm.key}`}
                  variant="decimal"
                  value={editValues[pm.key]}
                  onChange={(e) => setEditValues((prev) => ({ ...prev, [pm.key]: e.target.value }))}
                  controlClassName="text-right font-bold tabular-nums"
                />
              </FormField>
            ))}
          </div>
          <FormField label="Date d'effet">
            <BzDateTimeField value={editDate} onChange={setEditDate} accent="#8B5CF6" disableFuture={false} />
          </FormField>
          <p className={cn('text-[12px]', TEXT.muted)}>
            La correction est journalisée (avant/après) dans le journal d'audit.
          </p>
        </div>
      </CenterDialog>

      {/* ── Supprimer une publication ── */}
      <CenterDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Supprimer la publication"
        width={440}
        footer={
          <>
            <PrimaryPill danger onClick={confirmDelete} loading={deleteRate.isPending} className="flex-1">
              Supprimer
            </PrimaryPill>
            <SoftPill onClick={() => setDeleting(null)} className="flex-1">
              Annuler
            </SoftPill>
          </>
        }
      >
        <p className={cn('text-[14px]', TEXT.muted)}>
          Supprimer la publication du{' '}
          <b className={TEXT.strong}>
            {deleting ? format(parseISO(deleting.effective_at), "dd MMMM yyyy 'à' HH:mm", { locale: fr }) : ''}
          </b>{' '}
          ? {deleting?.is_active && 'Elle est ACTIVE : la publication la plus récente restante sera réactivée. '}
          Cette action est journalisée et irréversible.
        </p>
      </CenterDialog>
    </Card>
  );
}
