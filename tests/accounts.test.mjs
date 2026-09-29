import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {createAccounts,accountAction,cleanPreferences} from '../server/accounts.mjs';
import {newProfile,challenges} from '../.server-build/progression.js';
const base=()=>({profile:newProfile(),name:'Player',preferences:{}});
function service(){
 const rows=new Map(),receipts=new Set(),outbox=mkdtempSync(join(tmpdir(),'krage-account-test-'));
 const api=createAccounts({url:'https://example.test',key:'public',secret:'private',outbox,fetcher:async(url,options)=>{
  const path=new URL(url),body=options.body?JSON.parse(options.body):null;
  const ok=data=>new Response(JSON.stringify(data),{status:200});
  if(path.pathname==='/auth/v1/user')return options.headers.Authorization==='Bearer '+'valid'.repeat(8)?ok({id:'user',email_confirmed_at:'today'}):new Response('{}',{status:401});
  if(path.pathname.endsWith('krage_accounts')){
   if(options.method==='POST'){if(!rows.has(body.user_id))rows.set(body.user_id,{data:body.data,revision:0});return ok(null);}
   const id=path.searchParams.get('user_id').slice(3);return ok(rows.has(id)?[rows.get(id)]:[]);
  }
  if(path.pathname.endsWith('krage_commit')){
   const row=rows.get(body.p_user),event=body.p_user+':'+body.p_event;
   if(row.data.migratedTo)return ok(null);
   if(body.p_event&&receipts.has(event))return ok(row);
   if(row.revision!==body.p_revision)return ok(null);
   const next={data:body.p_data,revision:row.revision+1};rows.set(body.p_user,next);if(body.p_event)receipts.add(event);return ok(next);
  }
  throw Error('Unexpected request '+path.pathname);
 }});
 return {api,rows,outbox,close(){api.close();rmSync(outbox,{recursive:true,force:true})}};
}
await test('claim is persisted, repeat claims cannot credit twice, and forged rewards are rejected',async()=>{
 const s=service();try{const data=base(),challenge=challenges(data.profile)[0];data.profile[challenge.period][challenge.metric]=challenge.target;s.rows.set('user',{data,revision:0});
 const first=await s.api.mutate('user',d=>accountAction(d,{type:'claim',id:challenge.id}));
 assert.ok(first.data.profile.claimed.includes(challenge.id));assert.ok(first.data.profile.balance>200);
 const again=await s.api.mutate('user',d=>accountAction(d,{type:'claim',id:challenge.id}));assert.equal(again.data.profile.balance,first.data.profile.balance);
 assert.equal((await s.api.get('user')).data.profile.balance,first.data.profile.balance);
 assert.throws(()=>accountAction(data,{type:'grant',balance:999999}));assert.throws(()=>accountAction(base(),{type:'claim',id:challenge.id}));
 }finally{s.close()}
});
await test('concurrent purchases cannot overspend or double-charge one item',async()=>{
 const s=service();try{const data=base();data.profile.balance=900;s.rows.set('user',{data,revision:0});
 const result=await Promise.allSettled(['skin-echo-carbon','skin-kilo-carbon'].map(id=>s.api.mutate('user',d=>accountAction(d,{type:'buy',id}))));
 assert.equal(result.filter(r=>r.status==='fulfilled').length,1);const p=(await s.api.get('user')).data.profile;assert.equal(p.balance,400);
 await s.api.mutate('user',d=>accountAction(d,{type:'buy',id:'skin-echo-carbon'}));assert.equal((await s.api.get('user')).data.profile.balance,400);
 assert.throws(()=>accountAction(base(),{type:'equip',id:'skin-edge-hook',weapon:3}));
 }finally{s.close()}
});
await test('actual binding codes survive preference patches; protected values and device quality do not',()=>{
 const p=cleanPreferences({bindings:{KeyW:'ArrowUp',Mouse0:'KeyF',bad:'KeyR'},quality:'high',balance:9999,sensitivity:99});
 assert.deepEqual(p.bindings,{KeyW:'ArrowUp',Mouse0:'KeyF'});assert.equal(p.sensitivity,2.5);assert.equal(p.balance,undefined);assert.equal(p.quality,undefined);
 const data=accountAction(base(),{type:'preferences',name:'  <Rivet>  ',preferences:{volume:.3}});assert.equal(data.name,'Rivet');assert.equal(data.preferences.volume,.3);
 assert.throws(()=>accountAction(data,{type:'preferences',preferences:{crouchKey:'KeyC',slideKey:'KeyC'}}));
});
await test('outbox processes later rewards after a failed or migrated guest receipt and deduplicates',async()=>{
 const s=service();try{
  s.rows.set('guest',{data:{migratedTo:'user'},revision:1});s.rows.set('user',{data:base(),revision:0});
  const receipt={id:'round-1',seconds:90,eligible:true,kills:5,headshots:1,meleeKills:0,matches:1,wins:1};
  writeFileSync(join(s.outbox,'00-bad.json'),'not-json');
  writeFileSync(join(s.outbox,'01-retry.json'),JSON.stringify({id:'broken',receipt}));s.rows.set('broken',{data:{profile:null},revision:0});
  writeFileSync(join(s.outbox,'02-valid.json'),JSON.stringify({id:'guest',receipt}));await s.api.drain();
  assert.equal((await s.api.get('user')).data.profile.lifetime.matches,1);const balance=(await s.api.get('user')).data.profile.balance;
  writeFileSync(join(s.outbox,'03-duplicate.json'),JSON.stringify({id:'user',receipt}));await s.api.drain();assert.equal((await s.api.get('user')).data.profile.balance,balance);
  assert.ok(readdirSync(s.outbox).includes('00-bad.json.invalid'));assert.ok(readdirSync(s.outbox).includes('01-retry.json'));
 }finally{s.close()}
});
await test('HTTP account endpoint verifies auth, rejects other origins and persists across requests',async()=>{
 const s=service(),server=createServer((req,res)=>void s.api.handle(req,res,['http://game.test']));await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/account';
 try{
  assert.equal((await fetch(url,{headers:{Origin:'http://evil.test'}})).status,403);
  assert.equal((await fetch(url)).status,400);
  const headers={Origin:'http://game.test',Authorization:'Bearer '+'valid'.repeat(8),'Content-Type':'application/json'};
  const save=await fetch(url,{method:'POST',headers,body:JSON.stringify({type:'preferences',name:'Knox',preferences:{volume:.4}})});assert.equal(save.status,200);
  const loaded=await(await fetch(url,{headers})).json();assert.equal(loaded.data.name,'Knox');assert.equal(loaded.data.preferences.volume,.4);
  const before=loaded.revision,again=await(await fetch(url,{headers})).json();assert.equal(again.revision,before);
 }finally{await new Promise(r=>server.close(r));s.close()}
});
