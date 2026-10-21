/**
 * Fiche client › Téléphones (maquette 10/11) : tous ses numéros avec leur
 * libellé, le principal en tête (celui des SMS et de la connexion), un
 * crayon par numéro, « Ajouter un numéro » (jusqu'à 10). Enregistrement :
 * `admin_set_client_phones` (la RPC recopie le principal dans la fiche),
 * réservé à `canManageUsers` comme l'ancienne feuille « Modifier ».
 * Sans ce droit : la liste en lecture, un toucher appelle le numéro.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { MessageCircle, Pencil, Phone, Plus } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useClient } from '@/hooks/useClientManagement';
import { useClientPhones, useSetClientPhones } from '@/hooks/useClientPhones';
import { useClientPhonesEditor } from '@/components/clients/useClientPhonesEditor';
import { MAX_PHONES } from '@/components/clients/useCreateClientForm';
import { PhoneNumberInput, formatE164ForDisplay, toE164 } from '@/components/form/PhoneNumberInput';
import { cn } from '@/lib/utils';
import {
  BigButton, BottomSheet, Dock, IconCircle, ItemList, ItemRow, ScreenLoader, ScreenTop, Tag, TEXT, FOCUS_RING,
} from '@/mobile/designKit';
import { BIG_FIELD, BigInput, FieldLabel } from './parts';

export function MobileClientPhones() {
  const { clientId = '' } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const canEdit = hasPermission('canManageUsers');
  const { data: client, isLoading } = useClient(clientId);
  const { data: saved, isLoading: phonesLoading } = useClientPhones(client?.id);
  const editor = useClientPhonesEditor();
  const setPhones = useSetClientPhones();
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [openNew, setOpenNew] = useState(false);

  useEffect(() => {
    if (!client || phonesLoading || ready) return;
    editor.reset(saved, client.phone, client.country);
    setReady(true);
  }, [client, saved, phonesLoading, ready, editor]);

  // « Ajouter un numéro » : la ligne ajoutée s'ouvre aussitôt.
  const lastKey = editor.rows[editor.rows.length - 1]?.key ?? null;
  useEffect(() => {
    if (!openNew) return;
    setEditing(lastKey);
    setOpenNew(false);
  }, [openNew, lastKey]);

  if (isLoading || !client || !ready) return <ScreenLoader className="min-h-[100dvh]" />;

  const rows = editor.rows;
  const row = rows.find((r) => r.key === editing) ?? null;
  const rowIndex = row ? rows.indexOf(row) : -1;

  const save = async () => {
    if (editor.primaryInvalid) { toast.error('Numéro principal invalide : sans lui, le client ne reçoit aucun SMS.'); return; }
    if (editor.extrasInvalid) { toast.error('Un numéro est incomplet : complétez-le ou retirez-le.'); return; }
    try {
      await setPhones.mutateAsync({ userId: client.id, phones: editor.toInputs() });
      toast.success('Numéros enregistrés');
      navigate(`/m/clients/${client.id}`);
    } catch {
      /* le hook affiche l'erreur */
    }
  };

  const add = () => {
    editor.addPhone();
    setOpenNew(true);
  };

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-[#1E1E1E]">
      <ScreenTop title={`Téléphones · ${client.firstName || 'Client'}`} backTo={`/m/clients/${client.id}`} />
      <ItemList className="pt-2">
        {rows.map((r, i) => {
          const e164 = toE164(r.value);
          const shown = e164 ? formatE164ForDisplay(e164) : r.value.national || 'Numéro à compléter';
          return (
            <ItemRow
              key={r.key}
              leading={<IconCircle icon={i === 0 ? MessageCircle : Phone} />}
              title={<span className="tabular-nums">{shown}</span>}
              subtitle={r.label || (i === 0 ? 'WhatsApp' : 'Sans libellé')}
              onClick={canEdit ? () => setEditing(r.key) : e164 ? () => { window.location.href = `tel:${e164}`; } : undefined}
              right={
                i === 0 ? (
                  <Tag tone="neutral">Principal</Tag>
                ) : canEdit ? (
                  <span
                    aria-hidden
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F5F5F5] dark:bg-[#383838]"
                  >
                    <Pencil className={cn('h-5 w-5', TEXT.strong)} />
                  </span>
                ) : undefined
              }
            />
          );
        })}
        {canEdit && rows.length < MAX_PHONES && (
          <ItemRow leading={<IconCircle icon={Plus} />} title="Ajouter un numéro" subtitle="Jusqu'à 10, avec un libellé" onClick={add} />
        )}
      </ItemList>

      {canEdit && (
        <Dock>
          <BigButton onClick={() => void save()} loading={setPhones.isPending} disabled={!editor.changed}>Enregistrer</BigButton>
        </Dock>
      )}

      <BottomSheet open={!!row} onClose={() => setEditing(null)}>
        {row && (
          <>
            <h3 className={cn('text-[22px] font-semibold leading-tight', TEXT.strong)}>{rowIndex === 0 ? 'Numéro principal' : 'Numéro'}</h3>
            <FieldLabel className="mt-4" htmlFor="ph-edit">Numéro</FieldLabel>
            <PhoneNumberInput id="ph-edit" value={row.value} onChange={(value) => editor.setPhone(row.key, { value })} controlClassName={BIG_FIELD} />
            <FieldLabel htmlFor="ph-label">Libellé</FieldLabel>
            <BigInput id="ph-label" value={row.label} placeholder="Boutique, Chine, son agent…" onChange={(e) => editor.setPhone(row.key, { label: e.target.value })} maxLength={40} />
            <div className="mt-5 flex flex-col gap-2.5">
              <BigButton onClick={() => setEditing(null)}>OK</BigButton>
              {rowIndex > 0 && (
                <BigButton variant="soft" onClick={() => { editor.makePrimary(row.key); setEditing(null); }}>Mettre en principal</BigButton>
              )}
              {rowIndex > 0 && (
                <button
                  type="button"
                  onClick={() => { editor.removePhone(row.key); setEditing(null); }}
                  className={cn('h-11 text-[17px] font-semibold text-[#C00F0C] dark:text-[#FCB3AD]', FOCUS_RING)}
                >
                  Retirer ce numéro
                </button>
              )}
            </div>
          </>
        )}
      </BottomSheet>
    </div>
  );
}
