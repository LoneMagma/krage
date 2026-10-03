import {spawn} from 'node:child_process';import fs from 'node:fs';import WebSocket from 'ws';
const delay=ms=>new Promise(r=>setTimeout(r,ms));let browser,web,ws;const errors=[],results=[];let seq=0;const pending=new Map();
try{
 web=spawn('node',['node_modules/vinext/dist/cli.js','start','--port','3412'],{stdio:['ignore',fs.openSync('outputs/mobile-web.log','w'),'ignore']});
 browser=spawn('chromium',['--headless','--disable-extensions','--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--remote-debugging-port=9412','--user-data-dir=/tmp/krage-mobile-browser','about:blank'],{stdio:'ignore'});
 let pages;for(let i=0;i<40;i++){try{pages=await(await fetch('http://127.0.0.1:9412/json')).json();if(pages.length)break}catch{}await delay(500)}
 ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.on('open',r));ws.on('message',buf=>{const m=JSON.parse(buf);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(m.error):p?.resolve(m.result)}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description??m.params.exceptionDetails.text);else if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args.map(a=>a.value??a.description).join(' '));});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))});
 await send('Runtime.enable');await send('Page.enable');await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 for(let i=0;i<40;i++){try{if((await fetch('http://127.0.0.1:3412')).ok)break}catch{}await delay(500)}
 for(const [width,height] of [[844,390],[1024,768],[667,375]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});await send('Page.navigate',{url:'http://127.0.0.1:3412'});await delay(4500);
  results.push({width,height,...(await send('Runtime.evaluate',{expression:`JSON.stringify({title:document.title,svgTitle:document.querySelector('.map-diagram title')?.textContent,overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight,buttons:[...document.querySelectorAll('.play-card button')].map(b=>({text:b.textContent,disabled:b.disabled}))})`,returnByValue:true})).result.value&&JSON.parse((await send('Runtime.evaluate',{expression:`JSON.stringify({title:document.title,svgTitle:document.querySelector('.map-diagram title')?.textContent,overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight})`,returnByValue:true})).result.value)});
  const shot=await send('Page.captureScreenshot',{format:'jpeg',quality:65});fs.writeFileSync(`outputs/mobile-lobby-${width}.jpg`,Buffer.from(shot.data,'base64'));
 }
 await send('Runtime.evaluate',{expression:`[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('PRACTICE'))?.click()`});await delay(500);
 results.push({practice: (await send('Runtime.evaluate',{expression:`!!document.querySelector('.practice-start')`,returnByValue:true})).result.value});
 await send('Runtime.evaluate',{expression: `document.querySelector('.practice-start')?.click()`});await delay(2200);
 const mobile=await send('Runtime.evaluate',{expression: `JSON.stringify({controls:!!document.querySelector('.mobile-controls'),buttons:document.querySelectorAll('.mobile-actions button').length,coarse:matchMedia('(pointer:coarse)').matches})`,returnByValue:true});results.push(JSON.parse(mobile.result.value));
 const centers=JSON.parse((await send('Runtime.evaluate',{expression:`JSON.stringify(['.mobile-stick','.mobile-fire'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}}))`,returnByValue:true})).result.value);
 await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:centers.map((p,id)=>({...p,id}))});
 await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:centers.map((p,id)=>({x:p.x+(id===0?32:12),y:p.y,id}))});await delay(180);
 const moved=(await send('Runtime.evaluate',{expression:`document.querySelector('.mobile-stick i').style.transform`,returnByValue:true})).result.value;
 await send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await delay(180);
 const released=(await send('Runtime.evaluate',{expression:`document.querySelector('.mobile-stick i').style.transform`,returnByValue:true})).result.value;results.push({multiTouch:moved!=='translate(0px, 0px)',cancellation:released==='translate(0px, 0px)'});
 const screenshot=await send('Page.captureScreenshot',{format:'jpeg',quality:65});fs.writeFileSync('outputs/mobile-practice.jpg',Buffer.from(screenshot.data,'base64'));
 fs.writeFileSync('outputs/mobile-browser.json',JSON.stringify({errors,results},null,2));console.log(JSON.stringify({errors,results}));
}finally{ws?.close();browser?.kill();web?.kill()}
