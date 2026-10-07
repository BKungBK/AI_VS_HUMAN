from pathlib import Path
import json, wave
import numpy as np

root=Path(__file__).resolve().parents[1]
out=root/'qa/creative-direction'
def read(p):
    with wave.open(str(p)) as w:
        meta=(w.getframerate(),w.getnchannels(),w.getsampwidth())
        x=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').reshape(-1,w.getnchannels()).astype(float)/32768
    return x,meta
def db(value):return float(20*np.log10(value+1e-12))
def band(x,lo,hi):
    y=x.mean(axis=1);spec=np.abs(np.fft.rfft(y*np.hanning(len(y))))**2;freq=np.fft.rfftfreq(len(y),1/48000)
    return float(np.sum(spec[(freq>=lo)&(freq<hi)]))
changes=[]
for name in ['departure','travel-walk','travel-descend','travel-threshold','travel-rise']:
    old,_=read(root/'qa/previous-motion-source/creative-revision-baseline/audio'/f'{name}.wav')
    new,meta=read(root/'public/assets/audio'/f'{name}.wav')
    changes.append({'asset':name,'oldPeakDbFS':db(np.max(np.abs(old))),'newPeakDbFS':db(np.max(np.abs(new))),'oldRmsDbFS':db(np.sqrt(np.mean(old**2))),'newRmsDbFS':db(np.sqrt(np.mean(new**2))),'upperBandChangeDb':float(10*np.log10((band(new,3200,8000)+1e-20)/(band(old,3200,8000)+1e-20))),'endpointMagnitude':float(max(np.max(np.abs(new[0])),np.max(np.abs(new[-1])))),'pass':bool(meta==(48000,2,2) and len(new)==len(old) and np.max(np.abs(new))<.151 and np.max(np.abs(new[[0,-1]]))<1/32768)})
mixes=[]
for p in sorted((out/'audio-renders').glob('[01][0-9].[0-9][0-9].wav')):
    x,meta=read(p);mono=x.mean(axis=1);ratio=float(np.sqrt(np.mean(mono**2))/(np.sqrt(np.mean(x**2))+1e-12));tail=float(np.max(np.abs(x[round(3.5*48000):])))
    mixes.append({'cue':p.stem,'peakDbFS':db(np.max(np.abs(x))),'monoRmsRatio':ratio,'tailPeak':tail,'pass':bool(meta==(48000,2,2) and np.max(np.abs(x))<.32 and ratio>.8 and tail<1/32768)})
passed=len(mixes)==42 and all(r['pass'] for r in changes+mixes)
(out/'sound-measurements.json').write_text(json.dumps({'method':'PCM/FFT comparison of authored stems and current production renders; technical measurement, not a listening review.','changes':changes,'mixes':mixes,'pass':passed},indent=2),encoding='utf-8')
print(json.dumps({'pass':passed,'stems':len(changes),'mixes':len(mixes),'worstPeakDbFS':max((m['peakDbFS'] for m in mixes),default=None),'changes':changes},indent=2))
if not passed:raise SystemExit(1)
