-- Apply after 001_accounts.sql. Existing meaningful saves require a UI decision.
create or replace function public.krage_has_progress(d jsonb) returns boolean
language sql immutable set search_path=public as $$
 select d ? 'migratedTo' or d->'profile' is null
 or coalesce((d->'profile'->>'balance')::bigint,0)<>200
 or coalesce(d->>'name','Player') not in ('Player','PLAYER')
 or coalesce(d->'preferences','{}'::jsonb)<>'{}'::jsonb
 or coalesce(d->'profile'->'lifetime','{}'::jsonb)<>'{"kills":0,"headshots":0,"meleeKills":0,"matches":0,"wins":0}'::jsonb
 or jsonb_array_length(coalesce(d->'profile'->'receipts','[]'))>0
 or jsonb_array_length(coalesce(d->'profile'->'claimed','[]'))>0
 or exists(select 1 from jsonb_array_elements_text(coalesce(d->'profile'->'owned','[]')) x where x not in ('op-scout','op-warden','op-spectre','op-sable','op-flint','finish-factory'));
$$;
revoke all on function public.krage_has_progress(jsonb) from public,anon,authenticated;
grant execute on function public.krage_has_progress(jsonb) to service_role;
create or replace function public.krage_transfer(p_source uuid,p_target uuid)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare s public.krage_accounts; t public.krage_accounts;
begin
 if p_source=p_target then raise exception 'Same account'; end if;
 -- Serialize simultaneous transfers into a not-yet-created target too.
 perform pg_advisory_xact_lock(hashtextextended(p_target::text,0));
 perform 1 from public.krage_accounts where user_id in(p_source,p_target) order by user_id for update;
 select * into s from public.krage_accounts where user_id=p_source;
 select * into t from public.krage_accounts where user_id=p_target;
 if s.user_id is null then raise exception 'Guest save missing'; end if;
 if s.data->>'migratedTo'=p_target::text then return jsonb_build_object('data',t.data,'revision',t.revision); end if;
 if s.data ? 'migratedTo' then raise exception 'Guest already connected'; end if;
 if t.user_id is not null and public.krage_has_progress(t.data) then
  return jsonb_build_object('decisionRequired',true,'data',t.data,'revision',t.revision);
 end if;
 -- Only a missing or untouched starter save may receive guest progress.
 insert into public.krage_accounts(user_id,data) values(p_target,s.data)
 on conflict(user_id) do update set data=excluded.data,revision=krage_accounts.revision+1,updated_at=now()
 where not public.krage_has_progress(krage_accounts.data);
 if not found then
  select * into t from public.krage_accounts where user_id=p_target;
  return jsonb_build_object('decisionRequired',true,'data',t.data,'revision',t.revision);
 end if;
 insert into public.krage_receipts(user_id,event_id,created_at)
 select p_target,event_id,created_at from public.krage_receipts where user_id=p_source on conflict do nothing;
 update public.krage_accounts set data=jsonb_build_object('migratedTo',p_target),revision=revision+1 where user_id=p_source;
 select * into t from public.krage_accounts where user_id=p_target;
 return jsonb_build_object('data',t.data,'revision',t.revision);
end $$;
revoke all on function public.krage_transfer(uuid,uuid) from public,anon,authenticated;
grant execute on function public.krage_transfer(uuid,uuid) to service_role;
-- CAS must not let an in-flight guest write restore a consumed save.
create or replace function public.krage_commit(p_user uuid,p_revision bigint,p_data jsonb,p_event text default null)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare r public.krage_accounts; result jsonb;
begin
 select * into r from public.krage_accounts where user_id=p_user for update;
 if not found then raise exception 'Account missing'; end if;
 if r.data ? 'migratedTo' then return null; end if;
 if p_event is not null and exists(select 1 from public.krage_receipts where user_id=p_user and event_id=p_event) then return jsonb_build_object('data',r.data,'revision',r.revision); end if;
 if r.revision<>p_revision then return null; end if;
 if p_event is not null then insert into public.krage_receipts(user_id,event_id) values(p_user,p_event); end if;
 update public.krage_accounts set data=p_data,revision=revision+1,updated_at=now() where user_id=p_user returning jsonb_build_object('data',data,'revision',revision) into result;
 return result;
end $$;
