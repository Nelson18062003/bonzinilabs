/**
 * Contreparties — fournisseurs USDT et acheteurs CNY.
 *
 * Rebuilt onto the desktop dimensional contract (`@/desktop/ui`). What left:
 * the mobile treasury `Segmented` (~39px) and `Pill` (36px) from the tab row,
 * the 40px header pill, the 52px `PrimaryPill` and its hand-rolled 52px
 * "Annuler" twin, and the hand-set 26px title. What replaced them: `Segment`
 * and `Chip` inside a `Toolbar` (28px), a `ScreenHead` action `Button` (32px)
 * and a form built from `Field` / `Input` / `Select` / `Button` at the page
 * step (32px).
 *
 * Two shape changes:
 *  · the card grid is a `DataTable` — a counterparty row is a code, a name, a
 *    phone and a WeChat id, which is a table, and the table brings the sticky
 *    header and keyboard navigation every other list in the console has;
 *  · the create form moved from a block wedged between the tabs and the list
 *    into the `Workbench` inspector, so opening it no longer pushes the list
 *    down the page and closing it does not re-render the list.
 *
 * The phone control is the same two-part control as the shared
 * `PhoneInputWithCountry` — a dial-code `<select>` plus a digits-only field,
 * emitting the canonical `joinPhone(...)` string — rebuilt here on the desktop
 * primitives so it sits on the 32px step. The value semantics are unchanged:
 * `splitPhone` / `joinPhone` are the same shared helpers.
 *
 * Data layer untouched (`useCounterparties`, `useCreateCounterparty`).
 */
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AlertTriangle, Archive, Plus, RefreshCw, Users } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCounterparties, useCreateCounterparty } from '@/hooks/useTreasury';
import { COUNTRY_CODES, formatPhone, joinPhone, splitPhone } from '@/data/countryCodes';
import type { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { CONTROL, DT, DFG } from '@/desktop/ui/tokens';
import { Badge, Button, Chip, EmptyState, Field, Input, Ref, Segment, Select } from '@/desktop/ui/primitives';
import { DataTable, type Column } from '@/desktop/ui/DataTable';
import { ScreenHead, Toolbar, Workbench } from '@/desktop/ui/layout';

type CounterpartyType = Database['public']['Enums']['treasury_counterparty_type'];

const TABS: { value: CounterpartyType; label: string }[] = [
  { value: 'usdt_supplier', label: 'Fournisseurs USDT' },
  { value: 'cny_buyer', label: 'Acheteurs CNY' },
];

/**
 * Dial code + national digits, emitting the canonical `+237691234567` string.
 * Same contract as the shared mobile `PhoneInputWithCountry`, on the desktop
 * control step.
 */
function PhoneEntry({
  label,
  value,
  onValueChange,
  defaultDialCode,
}: {
  label: string;
  value: string | null;
  onValueChange: (next: string | null) => void;
  defaultDialCode: string;
}) {
  const initial = useMemo(() => splitPhone(value, defaultDialCode), [value, defaultDialCode]);
  const [dialCode, setDialCode] = useState(initial.dialCode);
  const [local, setLocal] = useState(initial.local);

  // Sync from the outside (form reset, tab switch changing the default code).
  useEffect(() => {
    const next = splitPhone(value, defaultDialCode);
    setDialCode(next.dialCode);
    setLocal(next.local);
  }, [value, defaultDialCode]);

  return (
    <div>
      <span className={cn(DT.label, DFG.base, 'mb-1 block font-semibold')}>{label}</span>
      <div className="flex gap-2">
        <Select
          aria-label="Code pays"
          value={dialCode}
          onChange={(e) => {
            setDialCode(e.target.value);
            onValueChange(joinPhone(e.target.value, local));
          }}
          className="w-32 font-semibold"
        >
          {COUNTRY_CODES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.code}
            </option>
          ))}
        </Select>
        <Input
          aria-label={label}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="6XX XX XX XX"
          value={local}
          onChange={(e) => {
            const digitsOnly = e.target.value.replace(/\D/g, '');
            setLocal(digitsOnly);
            onValueChange(joinPhone(dialCode, digitsOnly));
          }}
          className="flex-1 tabular-nums"
        />
      </div>
    </div>
  );
}

export function DesktopCounterpartiesScreen() {
  const { hasPermission } = useAdminAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<CounterpartyType>('usdt_supplier');
  const [showArchived, setShowArchived] = useState(false);
  const { data, isLoading, isError, isFetching, refetch } = useCounterparties(tab, showArchived);
  const create = useCreateCounterparty();
  const canManage = hasPermission('canManageTreasury');

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState<string | null>(null);
  const [wechat, setWechat] = useState('');
  const [notes, setNotes] = useState('');

  if (!hasPermission('canViewTreasury')) {
    return <Navigate to="/m" replace />;
  }

  const resetForm = () => {
    setName('');
    setCompany('');
    setPhone(null);
    setWechat('');
    setNotes('');
    setShowForm(false);
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    const result = await create.mutateAsync({
      type: tab,
      display_name: name.trim(),
      legal_name: company.trim() || undefined,
      phone: phone ?? undefined,
      wechat_id: wechat.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    if (result.success) resetForm();
  };

  const defaultDialCode = tab === 'usdt_supplier' ? '+237' : '+86';
  const isSupplier = tab === 'usdt_supplier';
  const rows = data ?? [];

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'short_id',
      header: 'Code',
      width: '110px',
      cell: (c) => <Ref>{c.short_id}</Ref>,
    },
    {
      key: 'name',
      header: 'Contrepartie',
      cell: (c) => (
        <span className="block min-w-0">
          <span className={cn('flex items-center gap-2 truncate font-semibold', DFG.strong)}>
            {c.display_name}
            {!c.is_active ? <Badge tone="neutral">Archivée</Badge> : null}
          </span>
          {c.legal_name ? <span className={cn('block truncate', DT.label, DFG.muted)}>{c.legal_name}</span> : null}
        </span>
      ),
    },
    {
      key: 'phone',
      header: 'Téléphone',
      width: '200px',
      hideBelow: 760,
      cell: (c) => (
        <span className={cn('whitespace-nowrap', DFG.muted)}>{c.phone ? formatPhone(c.phone) : '—'}</span>
      ),
    },
    {
      key: 'wechat',
      header: 'WeChat',
      width: '180px',
      hideBelow: 1000,
      cell: (c) => <span className={cn('truncate', DFG.muted)}>{c.wechat_id || '—'}</span>,
    },
  ];

  return (
    <Workbench
      head={
        <ScreenHead
          title="Contreparties"
          subtitle="Fournisseurs USDT et acheteurs CNY"
          actions={
            canManage && !showForm ? (
              <Button variant="primary" icon={Plus} onClick={() => setShowForm(true)}>
                Nouvelle contrepartie
              </Button>
            ) : undefined
          }
        />
      }
      toolbar={
        <Toolbar>
          <Segment value={tab} onChange={setTab} options={TABS} />
          <Chip active={showArchived} onClick={() => setShowArchived((v) => !v)}>
            {/* Glyph size comes from the control table, never from a hand-
                written `h-…` — this chip sits at the toolbar step. */}
            <Archive className={CONTROL.toolbar.glyph} aria-hidden />
            Archivées
          </Chip>
        </Toolbar>
      }
      inspector={
        canManage && showForm ? (
          <div className="space-y-4 p-4">
            <h3 className={cn(DT.title, DFG.strong)}>
              Nouvelle contrepartie {isSupplier ? '(fournisseur USDT)' : '(acheteur CNY)'}
            </h3>

            <div className="space-y-3">
              <Field label="Nom" required>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Entreprise">
                <Input value={company} onChange={(e) => setCompany(e.target.value)} />
              </Field>
              <PhoneEntry
                label="Téléphone / WhatsApp"
                value={phone}
                onValueChange={setPhone}
                defaultDialCode={defaultDialCode}
              />
              {!isSupplier ? (
                <Field label="WeChat ID">
                  <Input value={wechat} onChange={(e) => setWechat(e.target.value)} />
                </Field>
              ) : null}
              <Field label="Notes">
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
            </div>

            <div className="flex justify-end gap-2">
              <Button onClick={resetForm}>Annuler</Button>
              <Button variant="primary" disabled={!name.trim()} loading={create.isPending} onClick={handleCreate}>
                Créer
              </Button>
            </div>
          </div>
        ) : null
      }
      onCloseInspector={resetForm}
    >
      <DataTable
        label="Liste des contreparties"
        rows={rows}
        columns={columns}
        getRowId={(c) => c.id}
        onRowClick={canManage ? (c) => navigate(`/m/more/treasury/counterparties/${c.id}`) : undefined}
        isLoading={isLoading}
        empty={
          isError ? (
            <EmptyState
              icon={AlertTriangle}
              title="Impossible de charger les contreparties"
              hint="La requête a échoué — la liste n'est pas vide, elle n'a pas pu être lue."
              action={
                <Button icon={RefreshCw} loading={isFetching} onClick={() => refetch()}>
                  Réessayer
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Users}
              title={`Aucune contrepartie ${isSupplier ? 'fournisseur' : 'acheteur'} pour l'instant.`}
              hint={showArchived ? undefined : 'Les contreparties archivées sont masquées.'}
            />
          )
        }
      />
    </Workbench>
  );
}
