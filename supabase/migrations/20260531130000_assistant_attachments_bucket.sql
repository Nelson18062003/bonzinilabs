-- Assistant DO IA — bucket privé pour les pièces jointes du chat (images + PDF).
-- L'admin téléverse dans son propre dossier ; l'Edge Function (service role) lit
-- les fichiers pour les transmettre à Claude (vision / documents).

insert into storage.buckets (id, name, public)
values ('assistant-attachments', 'assistant-attachments', false)
on conflict (id) do nothing;

-- Un admin actif peut téléverser UNIQUEMENT dans son propre dossier ({user_id}/...)
drop policy if exists "assistant_attachments_admin_insert" on storage.objects;
create policy "assistant_attachments_admin_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'assistant-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and coalesce(ur.is_disabled, false) = false
    )
  );

-- Un admin actif peut relire ses propres pièces jointes (utile pour les aperçus de l'historique)
drop policy if exists "assistant_attachments_admin_select" on storage.objects;
create policy "assistant_attachments_admin_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'assistant-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and coalesce(ur.is_disabled, false) = false
    )
  );

-- Un admin peut supprimer ses propres pièces jointes
drop policy if exists "assistant_attachments_admin_delete" on storage.objects;
create policy "assistant_attachments_admin_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'assistant-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
