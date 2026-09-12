"""Rebuild compact one-shot WAVs from the three user-provided recordings.
Usage: python3 scripts/prepare-weapon-audio.py /path/to/source/folder
Requires ffmpeg. No third-party Python packages.
"""
import array, json, math, subprocess, sys, wave
from pathlib import Path
source = Path(sys.argv[1])
out = Path(__file__).resolve().parents[1] / 'public/audio/weapons'
out.mkdir(parents=True, exist_ok=True)
# SMG cuts stop before the next attack; runtime schedules one cut per real shot.
clips = [
 ('echo-a', 'smg-burst-fire.mp3', .337, .064, 100, 9200, 150, 1.5),
 ('echo-b', 'smg-burst-fire.mp3', .409, .064, 100, 9200, 150, 1.5),
 ('kilo', 'assault-rifle-singleshot.mp3', .091, .34, 65, 8500, 165, 2.0),
 ('mica', 'shotgun-fire.mp3', .039, .70, 45, 7800, 100, 2.5),
]
report=[]
for name, filename, start, duration, low, high, bass, boost in clips:
 filters=f'atrim=start={start}:duration={duration},asetpts=PTS-STARTPTS,highpass=f={low},lowpass=f={high},equalizer=f={bass}:t=q:w=0.8:g={boost},afade=t=in:d=0.0005,afade=t=out:st={duration*.65}:d={duration*.35}'
 samples=array.array('f', subprocess.check_output(['ffmpeg','-v','error','-i',str(source/filename),'-af',filters,'-ac','1','-ar','44100','-f','f32le','-']))
 # Preserve attack dynamics. Peak-normalize to -2dBFS, without hard clipping.
 peak=max(abs(v) for v in samples); gain=10**(-2/20)/max(peak,1e-9)
 pcm=array.array('h',(round(max(-1,min(1,v*gain))*32767) for v in samples))
 with wave.open(str(out/(name+'.wav')),'wb') as f:
  f.setparams((1,2,44100,0,'NONE','not compressed')); f.writeframes(pcm.tobytes())
 report.append({'name':name,'source':filename,'start':start,'duration':len(samples)/44100,'peakDb':-2,'bytes':(out/(name+'.wav')).stat().st_size})
(out/'manifest.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
