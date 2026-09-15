from pathlib import Path
import subprocess,array,wave,math,random,json,shutil
root=Path(__file__).resolve().parents[1];out=root/'public/audio/v07';src=root/'sound assets/v07-revised';src.mkdir(parents=True,exist_ok=True)
files={'mica':'gamified_double_barr_#1-1789451134285.wav','kilo':'KILO RELOAD.wav','echo':'possible echo reload.wav','edge-slash':"soft swoosh- use for knife's air sound- trim and use the first part only..wav"}
def read(p,limit=None):
 args=['ffmpeg','-v','error','-i',str(p)]
 if limit:args+=['-t',str(limit)]
 return array.array('f',subprocess.check_output(args+['-ac','1','-ar','44100','-f','f32le','-']))
def write(name,a,high=4500,peak=-6):
 a=array.array('f',a);a=array.array('f',subprocess.run(['ffmpeg','-v','error','-f','f32le','-ar','44100','-ac','1','-i','-','-af',f'highpass=f=100,lowpass=f={high}','-f','f32le','-'],input=a.tobytes(),stdout=subprocess.PIPE,check=True).stdout)
 mx=max(map(abs,a));gain=min(4,10**(peak/20)/max(mx,1e-8));n=len(a)
 pcm=array.array('h',(round(v*gain*min(1,i/180,(n-1-i)/650)*32767) for i,v in enumerate(a)))
 with wave.open(str(out/(name+'.wav')),'wb') as w:w.setparams((1,2,44100,0,'NONE','not compressed'));w.writeframes(pcm.tobytes())
 return len(a)/44100
report=[]
for weapon,name in files.items():
 p=src/name;
 if not p.exists():raise FileNotFoundError(p)
 a=read(p,1 if weapon=='edge-slash' else None)
 if weapon=='edge-slash':write(weapon,a,2200,-10);report.append({'id':weapon,'source':name,'sourceStart':0,'duration':len(a)/44100});continue
 # Trim quiet boundaries, preserve the supplied action order and divide into animation events.
 step=220;energy=[sum(x*x for x in a[i:i+step])/step for i in range(0,len(a),step)];active=[i for i,e in enumerate(energy) if e>max(energy)*.002]
 lo=max(0,active[0]*step-220);hi=min(len(a),(active[-1]+1)*step+900);a=a[lo:hi];duration=len(a)/44100
 if duration>2.3:
  # Keep the whole gesture, time-compressed to reload length without changing pitch.
  ratio=duration/2.3;filters=[]
  while ratio>2:filters.append('atempo=2');ratio/=2
  filters.append(f'atempo={ratio}')
  a=array.array('f',subprocess.run(['ffmpeg','-v','error','-f','f32le','-ar','44100','-ac','1','-i','-','-af',','.join(filters),'-f','f32le','-'],input=a.tobytes(),stdout=subprocess.PIPE,check=True).stdout)
 write(weapon+'-reload',a)
 for phase,start,end in [('open',0,.25),('feed',.25,.75),('close',.75,1)]:
  chunk=a[int(start*len(a)):int(end*len(a))];write(weapon+'-reload-'+phase,chunk);report.append({'id':weapon+'-reload-'+phase,'source':name,'duration':len(chunk)/44100})
# Soft filtered air movement, deliberately lower than reloads and steps.
rng=random.Random(704);a=[rng.uniform(-1,1)*math.sin(math.pi*i/(int(.32*44100)-1))**2 for i in range(int(.32*44100))];write('slide',a,1000,-19);report.append({'id':'slide','source':'seeded filtered air noise','duration':.32})
(out/'revision.json').write_text(json.dumps({'fire':'Original public/audio/weapons v0.6 clips','effects':report},indent=2))
print(json.dumps(report))
