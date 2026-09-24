import {writeFileSync} from 'node:fs';
const rate=24000,duration=.19,samples=[],tau=Math.PI*2;
let seed=131,low=0,soft=0,phase=0;
for(let i=0;i<rate*duration;i++){
 const t=i/rate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;
 const noise=seed/4294967296*2-1;low+=.17*(noise-low);soft+=.035*(noise-soft);
 phase+=tau*(95+155*Math.exp(-t*24))/rate;
 const echoTime=Math.max(0,t-.035);
 const body=Math.sin(phase)*Math.exp(-t*29)*.65;
 const click=(low-soft)*Math.exp(-t*85)*.4;
 const echo=Math.sin(tau*210*echoTime)*Math.exp(-echoTime*38)*Math.min(1,echoTime/.004)*.22;
 samples.push((body+click+echo)*Math.min(1,t/.003)*Math.min(1,(duration-t)/.025));
}
const peak=Math.max(...samples.map(Math.abs)),wav=Buffer.alloc(44+samples.length*2);
wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples.length*2,40);
samples.forEach((s,i)=>wav.writeInt16LE(Math.round(s/peak*.42*32767),44+i*2));
writeFileSync(new URL('../public/audio/v07/confirm.wav',import.meta.url),wav);
console.log(`Confirmation: ${duration}s, mono, ${wav.length} bytes, peak -7.5 dBFS`);
