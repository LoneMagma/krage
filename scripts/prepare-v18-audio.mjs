import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root='public/audio/v18';fs.mkdirSync(root,{recursive:true});
const rate=32000, manifest=[];
function prepare(name,source,maxSeconds,cutoff=6500,peak=.5,speed=1){
 const raw=execFileSync('ffmpeg',['-v','error','-i',source,'-ac','1','-ar',String(rate),'-af',`highpass=f=65,lowpass=f=${cutoff},atempo=${speed}`,'-f','f32le','pipe:1'],{maxBuffer:16000000});
 let data=Array.from({length:raw.length/4},(_,i)=>raw.readFloatLE(i*4));
 let high=0;for(const x of data)high=Math.max(high,Math.abs(x));
 if(high<.00001)throw Error(`Silent ${source}`);
 let start=data.findIndex(x=>Math.abs(x)>high*.025);start=Math.max(0,start-96);
 let end=data.length;while(end>start&&Math.abs(data[end-1])<high*.012)end--;
 data=data.slice(start,Math.min(end+320,start+Math.round(maxSeconds*rate)));
 high=0;for(const x of data)high=Math.max(high,Math.abs(x));
 const gain=Math.min(6,peak/high),fade=Math.min(Math.floor(data.length/4),Math.round(rate*(maxSeconds>1?.16:.035)));
 const pcm=Buffer.alloc(data.length*2);
 data.forEach((x,i)=>pcm.writeInt16LE(Math.round(Math.max(-1,Math.min(1,x*gain*Math.min(1,i/96,(data.length-1-i)/fade)))*32767),i*2));
 const out=`${root}/${name}.wav`;
 execFileSync('ffmpeg',['-v','error','-y','-f','s16le','-ar',String(rate),'-ac','1','-i','pipe:0','-c:a','pcm_s16le',out],{input:pcm});
 manifest.push({name,source,seconds:+(data.length/rate).toFixed(3),peak:peak,sha256:createHash('sha256').update(fs.readFileSync(out)).digest('hex')});
}
prepare('victory','sound assets/v18/victory-3.mp3',3.2,6500,.55);
prepare('defeat','sound assets/v18/defeat-1.mp3',3.2,4200,.48);
prepare('confirm','sound assets/v18/confirm-0.mp3',.24,2200,.5);
prepare('click','public/audio/v07/click.wav',.14,6500,.6);
{
 const duration=.17, pcm=Buffer.alloc(Math.round(rate*duration)*2);let low=0,seed=173;
 for(let i=0;i<pcm.length/2;i++){
   seed=(Math.imul(seed,1664525)+1013904223)>>>0;
   low+=.055*((seed/4294967296*2-1)-low);
   const t=i/(pcm.length/2-1),env=Math.sin(Math.PI*t)**1.6;
   pcm.writeInt16LE(Math.round(low*env*.6*32767),i*2);
 }
 execFileSync('ffmpeg',['-v','error','-y','-f','s16le','-ar',String(rate),'-ac','1','-i','pipe:0','sound assets/v18/slide-wave.wav'],{input:pcm});
 prepare('slide','sound assets/v18/slide-wave.wav',duration,1000,.32);
}
for(const name of ['edge-slash','edge-stab','edge-hit','headshot','reward','step-0','step-1','step-2','land','hit']){
 const duration=name.startsWith('edge-')?.3:name==='reward'?.65:name==='headshot'?.19:name==='land'?.2:.12;
 prepare(name,`public/audio/v07/${name}.wav`,duration,name==='headshot'?1800:4200,name.startsWith('step')?.4:.5);
}
for(const weapon of ['echo','kilo','mica'])for(const phase of ['open','feed','close'])prepare(`${weapon}-reload-${phase}`,`public/audio/v07/${weapon}-reload-${phase}.wav`,phase==='feed'?.19:.14,weapon==='echo'?5000:weapon==='kilo'?3200:2400,.55);
// Small physical actions reuse trimmed mechanical/cloth source material, with distinct pitch in playback.
prepare('equip','public/audio/v07/kilo-reload-open.wav',.10,2600,.32);
prepare('jump','public/audio/v07/edge-slash.wav',.09,1100,.25);
prepare('spawn','public/audio/v07/reward.wav',.30,2400,.32);
prepare('impact-stone','public/audio/v07/land.wav',.075,1800,.35);
prepare('impact-metal','public/audio/v07/mica-reload-close.wav',.085,4400,.35);
fs.writeFileSync(`${root}/manifest.json`,JSON.stringify({generator:'scripts/prepare-v18-audio.mjs',sampleRate:rate,channels:1,fireHashes:Object.fromEntries(fs.readdirSync('public/audio/weapons').filter(f=>f.endsWith('.wav')).map(f=>[f,createHash('sha256').update(fs.readFileSync('public/audio/weapons/'+f)).digest('hex')])),files:manifest},null,2)+'\n');
console.log(`${manifest.length} cues, ${manifest.reduce((s,f)=>s+fs.statSync(`${root}/${f.name}.wav`).size,0)} bytes`);
