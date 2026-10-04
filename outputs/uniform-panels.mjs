import {spawn} from 'node:child_process';import fs from 'node:fs';import WebSocket from 'ws';
const delay=ms=>new Promise(r=>setTimeout(r,ms));let browser,web,ws;const errors=[],results=[];let seq=0;const pending=new Map();
try{
 web=spawn('node',['node_modules/vinext/dist/cli.js','start','--port','3420'],{stdio:['ignore',fs.openSync('outputs/mobile-web.log','w'),'ignore']});
 browser=spawn('chromium',['--headless','--disable-extensions','--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--remote-debugging-port=9420','--user-data-dir=/tmp/krage-compact-browser','about:blank'],{stdio:'ignore'});
 let pages;for(let i=0;i<40;i++){try{pages=await(await fetch('http://127.0.0.1:9420/json')).json();if(pages.length)break}catch{}await delay(500)}
 ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.on('open',r));ws.on('message',buf=>{const m=JSON.parse(buf);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(m.error):p?.resolve(m.result)}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description??m.params.exceptionDetails.text);else if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args.map(a=>a.value??a.description).join(' '));});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))});
 await send('Runtime.enable');await send('Page.enable');await send('Page.addScriptToEvaluateOnNewDocument',{source:"localStorage.removeItem('krage-touch-layout-v2')"});await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 for(let i=0;i<40;i++){try{if((await fetch('http://127.0.0.1:3420')).ok)break}catch{}await delay(500)}
 await send('Emulation.setTouchEmulationEnabled',{enabled:false});
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:'http://127.0.0.1:3420'});await delay(3500);
 const clickText=async text=>{await send('Runtime.evaluate',{expression:"[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==="+JSON.stringify(text)+")?.click()"});await delay(400);};
 for(const panel of ['LOCKER','SETTINGS','LOBBY']){
 await send('Runtime.evaluate',{expression:"[...document.querySelectorAll('.topbar nav button')].find(b=>b.textContent.trim()==="+JSON.stringify(panel)+").click()"});await delay(1200);
 if(panel==='LOBBY'){await clickText('CREATE');await send('Runtime.evaluate',{expression:"document.querySelector('.party-settings-toggle').click()"});await delay(300);await send('Runtime.evaluate',{expression:"document.querySelector('.choice-stepper[aria-label=\"TIME\"] summary').click();[...document.querySelectorAll('.choice-stepper[aria-label=\"TIME\"] .choice-options button')].find(b=>b.textContent==='10 MIN').click()"});}
 if(panel==='SETTINGS'){await send('Runtime.evaluate',{expression:"document.querySelector('.settings-category-picker summary').click();[...document.querySelectorAll('.settings-category-picker .choice-options button')].find(b=>b.textContent==='SOUND').click()"});await delay(200);}
 results.push({panel,overflow:(await send('Runtime.evaluate',{expression:"document.documentElement.scrollWidth>innerWidth",returnByValue:true})).result.value});
 const shot=await send('Page.captureScreenshot',{format:'jpeg',quality:65});fs.writeFileSync('outputs/compact-'+panel+'.jpg',Buffer.from(shot.data,'base64'));
 }
 results.push({roomSectionsDoNotOverlap:(await send('Runtime.evaluate',{expression:`(()=>{const a=document.querySelector('.party-quick-settings').getBoundingClientRect(),b=document.querySelector('.party-settings-toggle').getBoundingClientRect(),c=document.querySelector('.party-settings').getBoundingClientRect();return a.bottom<=b.top&&b.bottom<=c.top})()`,returnByValue:true})).result.value});results.push(JSON.parse((await send('Runtime.evaluate',{expression:`JSON.stringify({equalMapMode:(()=>{const r=[...document.querySelectorAll('.party-quick-settings .choice-menu summary')].map(e=>e.getBoundingClientRect());return r.length===2&&Math.abs(r[0].width-r[1].width)<1&&Math.abs(r[0].height-r[1].height)<1})(),noExtraArrows:document.querySelectorAll('.choice-stepper>button').length===0,timeUpdated:document.querySelector('.party-settings-toggle').textContent.includes('10 MIN')})`,returnByValue:true})).result.value));console.log(JSON.stringify({errors,results}));
}finally{ws?.close();browser?.kill();web?.kill()}
