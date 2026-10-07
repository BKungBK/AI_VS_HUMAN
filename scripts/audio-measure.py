from pathlib import Path
import json,wave
import numpy as np
ROOT=Path(__file__).resolve().parents[1];results=[]
def check(name,passed,**details):results.append({'name':name,'pass':bool(passed),**details});print('PASS' if passed else 'FAIL',name)
def read(path):
 with wave.open(str(path)) as w:
  meta={'rate':w.getframerate(),'channels':w.getnchannels(),'width':w.getsampwidth()};x=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').reshape(-1,meta['channels']).astype(float)/32768
 return x,meta
loop_checks=[]
for path in sorted((ROOT/'public/assets/audio').glob('ambient-*.wav')):
 x,meta=read(path);delta=np.max(np.abs(x[0]-x[-1]));normal=np.max(np.abs(np.diff(x,axis=0)),axis=1);limit=float(np.quantile(normal,.999))
 # FFT-periodic signal seam is just an ordinary adjacent sample, not a discontinuity.
 loop_checks.append({'asset':path.stem,'seamStep':float(delta),'ordinaryStep999':limit,'pass':bool(delta<=limit)})
check('all 11 ambient loop joins behave like ordinary adjacent samples',len(loop_checks)==11 and all(r['pass'] for r in loop_checks),loops=loop_checks)
render_checks=[]
for path in sorted((ROOT/'qa/audio/renders').glob('[01][0-9].[0-9][0-9].wav')):
 x,meta=read(path);peak=np.max(np.abs(x));mono=x.mean(axis=1);ratio=float(np.sqrt(np.mean(mono*mono))/(np.sqrt(np.mean(x*x))+1e-12));tail=float(np.max(np.abs(x[round(3.5*48000):])))
 render_checks.append({'cue':path.stem,'peakDbFS':float(20*np.log10(peak+1e-12)),'monoRmsRatio':ratio,'readingTailPeak':tail,'pass':bool(meta=={'rate':48000,'channels':2,'width':2} and peak<.32 and ratio>.8 and tail<1/32768)})
check('all 42 cue mixes have headroom, survive mono, and leave reading silence',len(render_checks)==42 and all(r['pass'] for r in render_checks),renders=render_checks)
off,_=read(ROOT/'qa/audio/carve-off.wav');on,_=read(ROOT/'qa/audio/carve-on.wav')
def energy(x,lo,hi):
 mono=x.mean(axis=1);s=np.abs(np.fft.rfft(mono*np.hanning(len(mono))))**2;f=np.fft.rfftfreq(len(mono),1/48000);return np.sum(s[(f>=lo)&(f<hi)])
change=float(10*np.log10(energy(on,900,3000)/energy(off,900,3000)))
check('speaker-space filter reduces the actual 900–3000 Hz energy',change<-3,changeDb=change,note='A fixed spectral gap, not microphone-based ducking; live speaker intelligibility needs venue rehearsal.')
x,_=read(ROOT/'qa/audio/loop-listening.wav');period=8*48000;a=x[7*48000:15*48000];b=x[15*48000:23*48000]
check('rendered place loop repeats without a gain reset',float(np.max(np.abs(a-b)))<.00015,maximumCycleDifference=float(np.max(np.abs(a-b))))
report={'date':'2026-10-06','results':results,'passed':sum(r['pass'] for r in results),'total':len(results),'scope':'Digital PCM measurements; not a listening or sound-system test.'}
(ROOT/'qa/audio-measurements.json').write_text(json.dumps(report,indent=2),encoding='utf8');
if any(not r['pass'] for r in results):raise SystemExit(1)
