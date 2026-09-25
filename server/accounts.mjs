import {newProfile,refreshProfile,purchase,equipCosmetic,equipWeaponFinish,claimChallenge,recordMatch,CATALOG,weaponFinish} from '../.server-build/progression.js';
import {mkdirSync,writeFileSync,renameSync,readdirSync,readFileSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
export function cleanPreferences(value){
 const p={};if(!value||typeof value!=='object'||Array.isArray(value))return p;
 const numbers={sensitivity:[.2,2.5],fov:[75,115],volume:[0,1],cameraMotion:[0,1]};
 for(const [k,[min,max]] of Object.entries(numbers))if(Number.isFinite(value[k]))p[k]=Math.max(min,Math.min(max,value[k]));
 for(const k of ['musicEnabled','effectsEnabled','invertY'])if(typeof value[k]==='boolean')p[k]=value[k];
 if(['#eaffdf','#7bffff','#f9fa6d','#ff78c5'].includes(value.crosshair))p.crosshair=value.crosshair;
 for(const k of ['crouchKey','slideKey'])if(typeof value[k]==='string'&&/^(Key[A-Z]|Digit[0-9]|ShiftLeft|ControlLeft|AltLeft|Space|Arrow(Up|Down|Left|Right))$/.test(value[k]))p[k]=value[k];
 if(value.bindings&&typeof value.bindings==='object'&&!Array.isArray(value.bindings))p.bindings=Object.fromEntries(Object.entries(value.bindings).filter(([k,v])=>['forward','backward','left','right','jump','reload','melee','scoreboard','weapon1','weapon2','weapon3'].includes(k)&&typeof v==='string'&&/^[A-Za-z][A-Za-z0-9]{0,24}$/.test(v)));
 return p;
}
export function accountAction(data,action,now=Date.now()){
 let profile=refreshProfile(data.profile,now);let preferences=data.preferences??{},name=data.name;
 if(action.type==='buy'){
  const item=CATALOG.find(i=>i.id===action.id);if(!item)throw Error('Unknown item');
  if(!profile.owned.includes(item.id)&&profile.balance<item.cost)throw Error('Not enough KR');
  profile=purchase(profile,item.id);
 }else if(action.type==='equip'){
  if(!profile.owned.includes(action.id))throw Error('Skin not owned');
  const item=CATALOG.find(i=>i.id===action.id);if(!item)throw Error('Unknown item');
  if(action.weapon!==undefined){if(![0,1,2,3].includes(action.weapon)||item.kind!=='finish'||('weapon'in item&&item.weapon!==action.weapon))throw Error('Invalid weapon');profile=equipWeaponFinish(profile,action.weapon,item.id);}else profile=equipCosmetic(profile,item.id);
 }else if(action.type==='claim')profile=claimChallenge(profile,action.id,now);
 else if(action.type==='preferences'){
  preferences={...preferences,...cleanPreferences(action.preferences)};
  if(typeof action.name==='string')name=action.name.replace(/[\x00-\x1f<>]/g,'').trim().slice(0,16)||'Player';
 }else if(action.type!=='refresh')throw Error('Unsupported account action');
 return {...data,name,preferences,profile};
}
export function createAccounts({url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY,secret=process.env.SUPABASE_SECRET_KEY,fetcher=fetch,outbox=process.env.KRAGE_ACCOUNT_OUTBOX||'server/data/account-outbox'}={}){
 const enabled=!!(url&&key&&secret);let draining=false;const cache=new Map();
 async function request(path,{token=secret,method='GET',body,prefer}={}){
  const r=await fetcher(url+path,{method,headers:{apikey:token===secret?secret:key,Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
  if(!r.ok)throw Error(r.status===401||r.status===403?'Sign in again':'Account service unavailable');
  return r.status===204?null:JSON.parse(await r.text()||'null');
 }
 async function verify(token){
  if(!enabled)throw Error('Accounts are not configured yet');
  if(typeof token!=='string'||token.length>8192||token.length<20)throw Error('Sign in required');
  const hash=createHash('sha256').update(token).digest('hex'),cached=cache.get(hash);
  if(cached&&cached.until>Date.now())return cached.user;
  const user=await request('/auth/v1/user',{token});
  if(!user?.id||(!user.is_anonymous&&!user.email_confirmed_at))throw Error('Verify your email first');
  if(cache.size>=1000)cache.delete(cache.keys().next().value);
  cache.set(hash,{user:{id:user.id,anonymous:!!user.is_anonymous},until:Date.now()+15000});return {id:user.id,anonymous:!!user.is_anonymous};
 }
 async function get(id){
  const path='/rest/v1/krage_accounts?user_id=eq.'+encodeURIComponent(id)+'&select=data,revision';
  let rows=await request(path);
  if(!rows.length){const profile=newProfile();profile.ledger[0].reason='Account starter grant';await request('/rest/v1/krage_accounts',{method:'POST',body:{user_id:id,data:{profile,name:'Player',preferences:{}}},prefer:'resolution=ignore-duplicates'});rows=await request(path);}
  if(!rows[0])throw Error('Account unavailable');return rows[0];
 }
 async function mutate(id,fn,event=null){
  for(let attempt=0;attempt<5;attempt++){
   const row=await get(id);if(row.data.migratedTo)throw Error('Guest save already connected. Sign in');const data=fn(row.data);
   const result=await request('/rest/v1/rpc/krage_commit',{method:'POST',body:{p_user:id,p_revision:row.revision,p_data:data,p_event:event}});
   if(result)return result;
  }throw Error('Account changed on another device. Try again');
 }
 function queue(id,receipt){
  if(!enabled)return;mkdirSync(outbox,{recursive:true,mode:0o700});
  const file=join(outbox,createHash('sha256').update(id+receipt.id).digest('hex')+'.json');
  writeFileSync(file+'.tmp',JSON.stringify({id,receipt}),{mode:0o600});renameSync(file+'.tmp',file);void drain();
 }
 async function drain(){
  if(!enabled||draining)return;draining=true;
  try{mkdirSync(outbox,{recursive:true,mode:0o700});for(const file of readdirSync(outbox).filter(f=>f.endsWith('.json')).slice(0,20)){
   try{const job=JSON.parse(readFileSync(join(outbox,file),'utf8'));await mutate(job.id,data=>({...data,profile:recordMatch(data.profile,job.receipt)}),'match:'+job.receipt.id);unlinkSync(join(outbox,file));}catch{break;}
  }}finally{draining=false;}
 }
 const rates=new Map();let active=0;
 async function handle(req,res,origins){
  if(!req.url?.startsWith('/account'))return false;
  const origin=req.headers.origin;if(origin&&!origins.includes(origin)){res.writeHead(403);res.end();return true;}
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');res.setHeader('Vary','Origin');
  if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return true;}
  if(req.url!=='/account'){res.writeHead(404);res.end('{}');return true;}
  let counted=false;try{
   const ip=req.socket.remoteAddress,now=Date.now(),rate=rates.get(ip);if(active>=16||(rate&&rate.until>now&&rate.count>=90)){res.writeHead(429);res.end(JSON.stringify({error:'Please wait a moment'}));return true;}if(rate&&rate.until>now)rate.count++;else{if(rates.size>2000)rates.clear();rates.set(ip,{count:1,until:now+60000});}active++;counted=true;req.setTimeout(10000);
   if(!enabled){res.writeHead(503);res.end(JSON.stringify({error:'Accounts are not configured yet'}));return true;}
   if(!['GET','POST'].includes(req.method)){res.writeHead(405);res.end('{}');return true;}
   const user=await verify(req.headers.authorization?.replace(/^Bearer /,''));let result;
   if(req.method==='GET')result=await mutate(user.id,data=>accountAction(data,{type:'refresh'}));

   else{let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>16384)throw Error('Request too large');}const action=JSON.parse(body);
    if(action.type==='migrate'){
     if(user.anonymous)throw Error('Connect a verified account first');
     const source=await verify(action.guestToken);if(!source.anonymous||source.id===user.id)throw Error('Invalid guest save');
     result=await request('/rest/v1/rpc/krage_transfer',{method:'POST',body:{p_source:source.id,p_target:user.id}});
    }else result=await mutate(user.id,data=>accountAction(data,action));}
   res.end(JSON.stringify(result));
  }catch(e){res.writeHead(400);res.end(JSON.stringify({error:e.message||'Account request failed'}));}finally{if(counted)active--;}return true;
 }
 const timer=enabled?setInterval(()=>void drain(),15000):null;timer?.unref();
 return {enabled,verify,get,mutate,queue,drain,handle,close(){if(timer)clearInterval(timer)},cosmetics(data){return {operator:CATALOG.find(i=>i.id===data.profile.operator)?.variant??0,weaponFinishes:[0,1,2,3].map(w=>weaponFinish(data.profile,w))}}};
}
