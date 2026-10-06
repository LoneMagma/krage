import {spawn} from 'node:child_process';import fs from 'node:fs';import WebSocket from 'ws';
const delay=ms=>new Promise(r=>setTimeout(r,ms));let browser,web,ws;const errors=[],results=[];let seq=0;const pending=new Map();
try{
 web=spawn('node',['node_modules/vinext/dist/cli.js','start','--port','3422'],{stdio:['ignore',fs.openSync('outputs/mobile-web.log','w'),'ignore']});
 browser=spawn('chromium',['--headless','--disable-extensions','--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--remote-debugging-port=9422','--user-data-dir=/tmp/krage-final-browser','about:blank'],{stdio:'ignore'});
 let pages;for(let i=0;i<40;i++){try{pages=await(await fetch('http://127.0.0.1:9422/json')).json();if(pages.length)break}catch{}await delay(500)}
 ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.on('open',r));ws.on('message',buf=>{const m=JSON.parse(buf);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(m.error):p?.resolve(m.result)}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description??m.params.exceptionDetails.text);else if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args.map(a=>a.value??a.description).join(' '));});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))});
 await send('Runtime.enable');await send('Page.enable');await send('Page.addScriptToEvaluateOnNewDocument',{source:"localStorage.removeItem('krage-touch-layout-v2')"});await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 for(let i=0;i<40;i++){try{if((await fetch('http://127.0.0.1:3422')).ok)break}catch{}await delay(500)}

 await send('Emulation.setTouchEmulationEnabled',{enabled:false});await send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:'http://127.0.0.1:3422'});await delay(4000);
 for(let i=0;i<5;i++){
 const shot=await send('Page.captureScreenshot',{format:'jpeg',quality:65});fs.writeFileSync('outputs/character-pose-'+i+'.jpg',Buffer.from(shot.data,'base64'));
 results.push({pose:i,label:(await send('Runtime.evaluate',{expression:"document.querySelector('.operator-shop-trigger').textContent",returnByValue:true})).result.value});
 if(i<4){await send('Runtime.evaluate',{expression:"document.querySelector('[aria-label=\"Next character\"]').click()"});await delay(900);}
 }
 await send('Runtime.evaluate',{expression:"document.querySelector('.operator-shop-trigger').click()"});await delay(1600);
 results.push(JSON.parse((await send('Runtime.evaluate',{expression:`JSON.stringify({characterLocker:!!document.querySelector('.character-locker'),locked:document.querySelector('.character-status')?.textContent,buyDisabled:document.querySelector('.character-description .arsenal-equip')?.disabled,balance:document.querySelector('.locker-balance')?.textContent})`,returnByValue:true})).result.value));
 const shot=await send('Page.captureScreenshot',{format:'jpeg',quality:65});fs.writeFileSync('outputs/character-locker.jpg',Buffer.from(shot.data,'base64'));
 await send('Runtime.evaluate',{expression:"[...document.querySelectorAll('.character-choices button')].find(b=>b.textContent.includes('Vera')).click()"});await delay(400);
 await send('Runtime.evaluate',{expression:"document.querySelector('.character-description .arsenal-equip').click()"});await delay(600);
 results.push({freeEquip:(await send('Runtime.evaluate',{expression:"document.querySelector('.character-status').textContent==='EQUIPPED'",returnByValue:true})).result.value});
 console.log(JSON.stringify({errors,results}));
}finally{ws?.close();browser?.kill();web?.kill()}
