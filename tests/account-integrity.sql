-- Run only against a disposable database after both migrations.
begin;
insert into auth.users(id) select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,8)n;
create function pg_temp.starter() returns jsonb language sql as $$ select '{"name":"Player","preferences":{},"profile":{"balance":200,"owned":["op-scout","finish-factory"],"receipts":[],"claimed":[],"lifetime":{"kills":0,"headshots":0,"meleeKills":0,"matches":0,"wins":0}}}'::jsonb $$;
insert into krage_accounts(user_id,data) select id,pg_temp.starter() from auth.users where id::text not like '%000000000002' and id::text not like '%000000000008';
update krage_accounts set data=jsonb_set(data,'{profile,balance}','750') where user_id::text in ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000007');
update krage_accounts set data=jsonb_set(data,'{profile,balance}','900') where user_id='00000000-0000-4000-8000-000000000004';
insert into krage_receipts(user_id,event_id) values('00000000-0000-4000-8000-000000000001','match:earned');
do $$ declare r jsonb; before_data jsonb; begin
 r=krage_transfer('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002');
 assert (r->'data'->'profile'->>'balance')::int=750,'new account did not inherit guest';
 assert exists(select 1 from krage_receipts where user_id='00000000-0000-4000-8000-000000000002' and event_id='match:earned'),'receipt history missing';
 assert (select data ? 'migratedTo' from krage_accounts where user_id='00000000-0000-4000-8000-000000000001'),'guest not consumed';
 r=krage_transfer('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002');assert (r->'data'->'profile'->>'balance')::int=750,'retry duplicated credits';
 select data into before_data from krage_accounts where user_id='00000000-0000-4000-8000-000000000004';
 r=krage_transfer('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004');
 assert r->>'decisionRequired'='true','existing account not detected';
 assert (select data=before_data from krage_accounts where user_id='00000000-0000-4000-8000-000000000004'),'existing account overwritten';
 assert not (select data ? 'migratedTo' from krage_accounts where user_id='00000000-0000-4000-8000-000000000003'),'guest consumed before confirmation';
 update krage_accounts set revision=12 where user_id='00000000-0000-4000-8000-000000000006';
 r=krage_transfer('00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000006');assert (r->'data'->'profile'->>'balance')::int=750,'untouched precreated account blocked';
 r=krage_commit('00000000-0000-4000-8000-000000000001',0,pg_temp.starter());assert r is null,'late write restored migrated guest';
 r=krage_commit('00000000-0000-4000-8000-000000000002',999,pg_temp.starter());assert r is null,'stale revision accepted';
 r=krage_commit('00000000-0000-4000-8000-000000000002',0,pg_temp.starter(),'match:earned');assert (r->'data'->'profile'->>'balance')::int=750,'duplicate receipt mutated account';
end $$;
set local role authenticated;
do $$ begin
 begin perform * from public.krage_accounts;raise exception 'Authenticated read allowed';exception when insufficient_privilege then null;end;
 begin perform public.krage_transfer('00000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000008');raise exception 'Client migration allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
