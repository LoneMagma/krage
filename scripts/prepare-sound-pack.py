from pathlib import Path
import subprocess,array,math,json,wave
root=Path(__file__).resolve().parents[1]
source=root/'sound assets';out=root/'public/audio/v07';out.mkdir(parents=True,exist_ok=True)
entries=[('kilo-reload','An_assault',2.2,6500),('defeat','“A_brief',2,2800),('echo-shot','“One_compact',.16,8500),('echo-reload','“A_compact',1.1,7500),('kilo-shot','“One_assault',.45,8500),('mica-shot','One_double',.65,7800),('mica-reload','A_double',1.8,7500),('edge-slash','“A_short_knife',.3,3500),('edge-stab','A_forceful',.28,3200),('edge-hit','“A_loud',.3,2500),('headshot','A_punchy',.5,1900),('kill','“A_short,_decisive',.3,2100),('slide','“A_short,_fast',.38,3200),('victory','A_two-second',2.2,10000),('reward','A_short_game',1.0,6500)]
report=[];decoded={}
def decode(p):
 return array.array('f',subprocess.check_output(['ffmpeg','-v','error','-i',str(p),'-af','pan=mono|c0=0.5*c0+0.5*c1','-ar','44100','-f','f32le','-']))
def export(name,a,filename,maxlen,high,derived=False):
 # RMS onset detection avoids leading silence while preserving the transient.
 step=220;level=[math.sqrt(sum(v*v for v in a[i:i+step])/step) for i in range(0,len(a),step)]
 active=[i for i,v in enumerate(level) if v>max(.001,max(level)*.015)]
 start=max(0,active[0]*step-44) if active else 0;end=min(len(a),(active[-1]+1)*step+2205) if active else len(a)
 a=a[start:min(end,start+int(maxlen*44100))]
 dc=sum(a)/len(a);a=array.array('f',(x-dc for x in a))
 filters=f'highpass=f=55,lowpass=f={high}'
 a=array.array('f',subprocess.run(['ffmpeg','-v','error','-f','f32le','-ar','44100','-ac','1','-i','-','-af',filters,'-f','f32le','-'],input=a.tobytes(),stdout=subprocess.PIPE,check=True).stdout)
 peak=max(map(abs,a));rms=math.sqrt(sum(v*v for v in a)/len(a));gain=min(10**(-3/20)/max(peak,1e-8),10**(-18/20)/max(rms,1e-8),5)
 fadein=44;fadeout=min(882,len(a)//5)
 a=array.array('f',(v*gain*min(1,i/fadein,(len(a)-1-i)/fadeout) for i,v in enumerate(a)))
 with wave.open(str(out/(name+'.wav')),'wb') as w:w.setparams((1,2,44100,0,'NONE','not compressed'));w.writeframes(array.array('h',(round(v*32767) for v in a)).tobytes())
 report.append(dict(id=name,source=filename,derived=derived,sourceStart=round(start/44100,4),duration=round(len(a)/44100,4),peakDb=round(20*math.log10(max(max(map(abs,a)),1e-9)),2),bytes=(out/(name+'.wav')).stat().st_size))
 return a
for name,prefix,maxlen,high in entries:
 p=next(source.glob(prefix+'*.wav'));a=decode(p);decoded[name]=export(name,a,p.name,maxlen,high)
p=next(source.glob('moving*.wav'));a=decode(p)
# Extract distinct foot contacts, not a walking loop; game speed controls their cadence.
step=220;energy=[sum(v*v for v in a[i:i+step])/step for i in range(0,len(a),step)]
peaks=[]
for i in sorted(range(len(energy)),key=lambda i:energy[i],reverse=True):
 if energy[i]<max(energy)*.1:break
 if all(abs(i-j)*step>44100*.22 for j in peaks):peaks.append(i)
 if len(peaks)==3:break
for n,i in enumerate(sorted(peaks)):
 clip=a[max(0,i*step-2205):min(len(a),i*step+6615)]
 export('step-'+str(n),clip,p.name,.2,4500,True)
 if n==0:export('land',clip,p.name,.23,950,True)
export('hit',decoded['edge-hit'],next(source.glob('“A_loud*.wav')).name,.075,1400,True)
a=decoded['echo-reload'];i=max(range(len(a)),key=lambda i:abs(a[i]));export('click',a[max(0,i-100):i+2000],next(source.glob('“A_compact*.wav')).name,.04,3500,True)
# Full reloads are split for the existing animation-driven open/feed/close hooks.
for weapon in ['echo','kilo','mica']:
 a=decoded[weapon+'-reload'];length=len(a)
 for phase,lo,hi in [('open',0,.25),('feed',.25,.75),('close',.75,1)]:export(weapon+'-reload-'+phase,a[int(lo*length):int(hi*length)],weapon+'-reload source',.65,6500,True)
(out/'manifest.json').write_text(json.dumps({'clips':report,'missing':[],'derived':['hit','click','land','footsteps'],'notes':{'defeat':'Original retained by user request; filtered and level-limited. Source distortion cannot be fully restored.'}},indent=2)+'\n')
print(json.dumps({'clips':len(report),'bytes':sum(x['bytes'] for x in report),'footsteps':len(peaks),'missing':[]},indent=2))
