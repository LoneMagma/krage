-- Run once in Supabase SQL Editor. No browser may write balances or inventory.
create table if not exists public.krage_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 revision bigint not null default 0,
 data jsonb not null,
 updated_at timestamptz not null default now()
);
create table if not exists public.krage_receipts (
 user_id uuid references auth.users(id) on delete cascade,
 event_id text not null,
 created_at timestamptz not null default now(),
 primary key(user_id,event_id)
);
alter table public.krage_accounts enable row level security;
alter table public.krage_receipts enable row level security;
revoke all on public.krage_accounts, public.krage_receipts from anon, authenticated;
grant all on public.krage_accounts, public.krage_receipts to service_role;
create or replace function public.krage_commit(p_user uuid,p_revision bigint,p_data jsonb,p_event text default null)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare current_row public.krage_accounts; result jsonb;
begin
 select * into current_row from public.krage_accounts where user_id=p_user for update;
 if not found then raise exception 'Account missing'; end if;
 if p_event is not null and exists(select 1 from public.krage_receipts where user_id=p_user and event_id=p_event) then
  return jsonb_build_object('data',current_row.data,'revision',current_row.revision);
 end if;
 if current_row.revision<>p_revision then return null; end if;
 if p_event is not null then insert into public.krage_receipts(user_id,event_id) values(p_user,p_event); end if;
 update public.krage_accounts set data=p_data,revision=revision+1,updated_at=now() where user_id=p_user
 returning jsonb_build_object('data',data,'revision',revision) into result;
 return result;
end $$;
revoke all on function public.krage_commit(uuid,bigint,jsonb,text) from public,anon,authenticated;
grant execute on function public.krage_commit(uuid,bigint,jsonb,text) to service_role;
-- INSERT ONLY: an existing account can never be overwritten by guest migration.
create or replace function public.krage_transfer(p_source uuid,p_target uuid)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare s public.krage_accounts; t public.krage_accounts; inserted boolean;
begin
 if p_source=p_target then raise exception 'Same account'; end if;
 select * into s from public.krage_accounts where user_id=p_source for update;
 if s.user_id is null then raise exception 'Guest save missing'; end if;
 select * into t from public.krage_accounts where user_id=p_target;
 if found then return jsonb_build_object('data',t.data,'revision',t.revision); end if;
 if s.data ? 'migratedTo' then raise exception 'Guest already connected'; end if;
 insert into public.krage_accounts(user_id,data) values(p_target,s.data) on conflict do nothing;
 inserted=found;
 if inserted then update public.krage_accounts set data=jsonb_build_object('migratedTo',p_target),revision=revision+1 where user_id=p_source; end if;
 select * into t from public.krage_accounts where user_id=p_target;
 return jsonb_build_object('data',t.data,'revision',t.revision);
end $$;
revoke all on function public.krage_transfer(uuid,uuid) from public,anon,authenticated;
grant execute on function public.krage_transfer(uuid,uuid) to service_role;
