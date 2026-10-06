import {spawn} from 'node:child_process';import fs from 'node:fs';import WebSocket from 'ws';
const delay=ms=>new Promise(r=>setTimeout(r,ms));let browser,web,ws;const errors=[],results=[];let seq=0;const pending=new Map();
try{
 web=spawn('node',['node_modules/vinext/dist/cli.js','start','--port','3425'],{stdio:['ignore',fs.openSync('outputs/1105-web.log','w'),'ignore']});
 browser=spawn('chromium',['--headless','--disable-extensions','--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--remote-debugging-port=9425','--user-data-dir=/tmp/krage-1105-browser','about:blank'],{stdio:'ignore'});
 let pages;for(let i=0;i<40;i++){try{pages=await(await fetch('http://127.0.0.1:9425/json')).json();if(pages.length)break}catch{}await delay(500)}
 ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.on('open',r));ws.on('message',buf=>{const m=JSON.parse(buf);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(m.error):p?.resolve(m.result)}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description??m.params.exceptionDetails.text);else if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args.map(a=>a.value??a.description).join(' '));});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))});
 await send('Runtime.enable');await send('Page.enable');await send('Page.addScriptToEvaluateOnNewDocument',{source:"localStorage.removeItem('krage-touch-layout-v2')"});await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 for(let i=0;i<40;i++){try{if((await fetch('http://127.0.0.1:3425')).ok)break}catch{}await delay(500)}


 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text+': '+r.exceptionDetails.exception?.description);return r.result.value;};
 const click=async expression=>{await evaluate(expression);await delay(100);};
 const audit=async label=>{const data=await evaluate(`(()=>{const root=document.querySelector('.lobby-section-body')||document.querySelector('.room-panel')||document.querySelector('.play-card'),bad=[];
 if(root)for(const el of root.querySelectorAll('button,input,summary')){if(!el.checkVisibility({contentVisibilityAuto:true,visibilityProperty:true})||!el.getClientRects().length||el.disabled)continue;el.scrollIntoView({block:'center',inline:'nearest'});const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);if(r.left<-.5||r.right>innerWidth+.5||y<0||y>innerHeight||(!el.contains(hit)&&hit!==el))bad.push({name:el.getAttribute('aria-label')||el.textContent.slice(0,30),rect:[r.x,r.y,r.width,r.height],hit:hit?.className});}
 if(root)root.scrollTop=0;return {bad,overflow:document.documentElement.scrollWidth>innerWidth+1,portraitBlocked:!!document.querySelector('.lobby-shell .rotate-phone')};})()`);results.push({label,...data});};
 const shot=async label=>{const r=await send('Page.captureScreenshot',{format:'jpeg',quality:65});fs.writeFileSync('outputs/1105-'+label+'.jpg',Buffer.from(r.data,'base64'));};
 for(const [width,height] of [[568,320],[667,375],[740,360],[844,390],[915,412],[1024,768],[390,844],[360,800],[1280,800]]){
  await send('Emulation.setTouchEmulationEnabled',{enabled:width!==1280,maxTouchPoints:5});await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width!==1280});await send('Page.navigate',{url:'http://127.0.0.1:3425'});await delay(1800);
  await audit(`${width}x${height}:play`);await shot(`play-${width}`);
  for(const panel of ['SETTINGS','LOCKER','CHALLENGES','LOBBY']){
   await click(`[...document.querySelectorAll('.topbar nav button')].find(b=>b.textContent==='${panel}').click()`);
   if(panel==='LOBBY')await click(`[...document.querySelectorAll('.room-panel button')].find(b=>b.textContent==='CREATE')?.click()`);
   await audit(`${width}x${height}:${panel}`);if(panel==='LOBBY'){await click(`document.querySelector('.choice-menu')?.setAttribute('open','')`);await audit(`${width}x${height}:map-options`);await click(`document.querySelector('.choice-menu')?.removeAttribute('open')`);}if(width===740||width===390)await shot(`${panel}-${width}`);
   if(panel==='SETTINGS'){await click(`[...document.querySelectorAll('.settings-visual-tabs button')].find(b=>b.textContent==='MOVEMENT').click()`);await audit(`${width}x${height}:movement`);}
  }
 }
 await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});await send('Emulation.setDeviceMetricsOverride',{width:740,height:360,deviceScaleFactor:1,mobile:true});await send('Page.navigate',{url:'http://127.0.0.1:3425'});await delay(2000);
 await click(`[...document.querySelectorAll('.play-card button')].find(b=>b.textContent.startsWith('PRACTICE')).click()`);await audit('practice');await click(`document.querySelector('.practice-start').click()`);await delay(2000);await shot('game');
 const centers=await evaluate(`['stick','fire'].map(id=>{const r=document.querySelector('.mobile-'+id).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})`);
 await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:centers.map((p,id)=>({...p,id}))});await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:centers.map((p,id)=>({...p,x:p.x+(id===0?25:6),id}))});await delay(100);
 results.push({multiTouch:await evaluate(`document.querySelector('.mobile-stick i').style.transform!=='translate(0px, 0px)'&&document.querySelector('.mobile-fire').dataset.held==='true'`)});
 await send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});results.push({cancelled:await evaluate(`!document.querySelector('.custom-control[data-held]')`)});
 await click(`document.querySelector('.mobile-adjust').click()`);await shot('editor');await click(`[...document.querySelectorAll('.touch-editor button')].find(b=>b.textContent==='SAVE').click()`);results.push({saved:await evaluate(`!!localStorage.getItem('krage-touch-layout-v3')`)});
 await send('Emulation.setTouchEmulationEnabled',{enabled:false});await send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:'http://127.0.0.1:3425'});await delay(2200);
 for(let i=0;i<5;i++){await shot(`pose-${i}`);if(i<4)await click(`document.querySelector('[aria-label="Next character"]').click()`);await delay(250);}
 fs.writeFileSync('outputs/1105-browser.json',JSON.stringify({errors,results},null,2));console.log(JSON.stringify({errors,failures:results.filter(r=>r.bad?.length||r.overflow||r.multiTouch===false||r.cancelled===false),checks:results.length}));
}finally{ws?.close();browser?.kill();web?.kill()}
