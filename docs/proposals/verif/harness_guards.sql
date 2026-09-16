create type public.deposit_status as enum ('created','awaiting_proof','proof_submitted','admin_review','validated','rejected','pending_correction','cancelled','cancelled_by_admin');
create table public.wallets (id uuid primary key default gen_random_uuid(), user_id uuid unique not null, balance_xaf bigint not null default 0);
create table public.deposits (id uuid primary key default gen_random_uuid(), user_id uuid not null, amount_xaf bigint not null, status public.deposit_status not null default 'created', created_at timestamptz default now());
create table public.ledger_entries (id uuid primary key default gen_random_uuid(), user_id uuid not null, amount_xaf bigint not null);
create or replace function public.admin_has_permission(uid uuid, perm text) returns boolean language sql stable security definer as $$
  select exists (select 1 from public.user_roles where user_id = uid and (is_disabled = false or is_disabled is null)
                 and ((perm = 'canManageUsers' and role in ('super_admin','ops')) or (perm = 'canProcessDeposits' and role in ('super_admin','ops')))) $$;

-- F-033 : admin_delete_client AVEC les gardes proposées (extrait fidèle de docs/proposals/…clients…sql)
create or replace function public.admin_delete_client(p_user_id uuid) returns json language plpgsql security definer set search_path = public as $$
declare v_wallet public.wallets%rowtype;
begin
  if not public.admin_has_permission(auth.uid(), 'canManageUsers') then
    return json_build_object('success', false, 'error', 'Accès non autorisé');
  end if;
  if exists (select 1 from user_roles where user_id = p_user_id) then
    return json_build_object('success', false, 'error', 'Impossible de supprimer un utilisateur admin/agent. Supprimez d''abord son rôle.');
  end if;
  select * into v_wallet from public.wallets where user_id = p_user_id for update;
  if v_wallet.balance_xaf is not null and v_wallet.balance_xaf <> 0 then
    return json_build_object('success', false, 'error',
      'Impossible de supprimer un client dont le solde n''est pas nul (' || v_wallet.balance_xaf || ' XAF)');
  end if;
  if exists (select 1 from public.payments where user_id = p_user_id
             and status in ('created','waiting_beneficiary_info','ready_for_payment','processing','cash_pending','cash_scanned')) then
    return json_build_object('success', false, 'error', 'Impossible de supprimer un client ayant des paiements en cours');
  end if;
  if exists (select 1 from public.deposits where user_id = p_user_id
             and status in ('created','awaiting_proof','proof_submitted','admin_review','pending_correction')) then
    return json_build_object('success', false, 'error', 'Impossible de supprimer un client ayant des dépôts en attente');
  end if;
  delete from public.ledger_entries where user_id = p_user_id;
  delete from public.deposits where user_id = p_user_id;
  delete from public.payments where user_id = p_user_id;
  delete from public.wallets where user_id = p_user_id;
  return json_build_object('success', true);
end $$;

-- F-025 : la garde proposée pour create_client_deposit, isolée dans une fonction de test
create or replace function public.stub_create_client_deposit(p_user_id uuid, p_amount_xaf bigint) returns json language plpgsql security definer set search_path = public as $$
begin
  if p_user_id is distinct from auth.uid()
     and not public.admin_has_permission(auth.uid(), 'canProcessDeposits') then
    return json_build_object('success', false, 'error', 'Vous ne pouvez déclarer un dépôt que sur votre propre compte');
  end if;
  insert into public.deposits (user_id, amount_xaf) values (p_user_id, p_amount_xaf);
  return json_build_object('success', true);
end $$;
grant execute on all functions in schema public to authenticated;

-- Données
insert into public.wallets (user_id, balance_xaf) values ('00000000-0000-0000-0000-000000000001', 1213450), ('00000000-0000-0000-0000-000000000002', 0), ('00000000-0000-0000-0000-000000000003', 0);
insert into public.payments (user_id, amount_xaf, amount_rmb, status) values ('00000000-0000-0000-0000-000000000002', 10, 1, 'processing');
