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

 await send('Emulation.setDeviceMetricsOverride',{width:1024,height:768,deviceScaleFactor:1,mobile:true});await send('Page.navigate',{url:'http://127.0.0.1:3425'});await delay(2200);
 console.log(JSON.stringify(await evaluate(`(()=>{const e=document.querySelector('.play-card'),s=getComputedStyle(e);return {rect:e.getBoundingClientRect().toJSON(),styles:Object.fromEntries(['top','bottom','height','translate','transform','marginTop','justifyContent','overflow','position','scrollBehavior'].map(k=>[k,s[k]])),scrollTop:e.scrollTop,ancestors:(()=>{let a=e,arr=[];while(a){arr.push([a.className,a.scrollTop,a.clientHeight,a.scrollHeight,getComputedStyle(a).overflow]);a=a.parentElement}return arr})()}})()`)));
 await audit('debug');console.log(JSON.stringify(results));
}finally{ws?.close();browser?.kill();web?.kill()}
