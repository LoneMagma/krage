import {spawn} from 'node:child_process';import fs from 'node:fs';import WebSocket from 'ws';
const delay=ms=>new Promise(r=>setTimeout(r,ms));let browser,web,ws;const errors=[],results=[];let seq=0;const pending=new Map();
try{
 web=spawn('node',['node_modules/vinext/dist/cli.js','start','--port','3411'],{stdio:['ignore',fs.openSync('outputs/release-web.log','w'),'ignore']});
 browser=spawn('chromium',['--headless','--disable-extensions','--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--remote-debugging-port=9411','--user-data-dir=/tmp/krage-release-browser','about:blank'],{stdio:'ignore'});
 let pages;for(let i=0;i<40;i++){try{pages=await(await fetch('http://127.0.0.1:9411/json')).json();if(pages.length)break}catch{}await delay(500)}
 ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.on('open',r));ws.on('message',buf=>{const m=JSON.parse(buf);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(m.error):p?.resolve(m.result)}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description??m.params.exceptionDetails.text);else if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args.map(a=>a.value??a.description).join(' '));});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))});
 await send('Runtime.enable');await send('Page.enable');
 for(let i=0;i<40;i++){try{if((await fetch('http://127.0.0.1:3411')).ok)break}catch{}await delay(500)}
 for(const [width,height] of [[1920,1080],[1366,768],[1280,720]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:'http://127.0.0.1:3411'});await delay(4500);
  results.push({width,height,...(await send('Runtime.evaluate',{expression:`JSON.stringify({title:document.title,svgTitle:document.querySelector('.map-diagram title')?.textContent,overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight,buttons:[...document.querySelectorAll('.play-card button')].map(b=>({text:b.textContent,disabled:b.disabled}))})`,returnByValue:true})).result.value&&JSON.parse((await send('Runtime.evaluate',{expression:`JSON.stringify({title:document.title,svgTitle:document.querySelector('.map-diagram title')?.textContent,overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight})`,returnByValue:true})).result.value)});
  const shot=await send('Page.captureScreenshot',{format:'jpeg',quality:65});fs.writeFileSync(`outputs/release-lobby-${width}.jpg`,Buffer.from(shot.data,'base64'));
 }
 await send('Runtime.evaluate',{expression:`[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('PRACTICE'))?.click()`});await delay(500);
 results.push({practice: (await send('Runtime.evaluate',{expression:`!!document.querySelector('.practice-start')`,returnByValue:true})).result.value});
 fs.writeFileSync('outputs/release-browser.json',JSON.stringify({errors,results},null,2));console.log(JSON.stringify({errors,results}));
}finally{ws?.close();browser?.kill();web?.kill()}
