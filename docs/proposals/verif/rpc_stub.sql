-- Une RPC de type process_payment : SECURITY DEFINER, propriétaire postgres.
create or replace function public.stub_process(p_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  update public.payments set status = 'completed', amount_xaf = amount_xaf where id = p_id;
  return jsonb_build_object('success', true);
end $$;
grant execute on function public.stub_process(uuid) to authenticated;
