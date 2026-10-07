"""Original deterministic sound design. No recordings, samples or external rights.
48 kHz stereo PCM. Periodic FFT noise makes 8 s ambience mathematically seamless.
"""
from pathlib import Path
import json, hashlib, wave
import numpy as np

ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'public/assets/audio'; OUT.mkdir(parents=True,exist_ok=True)
SR=48000
DUR={'departure':.5,'travel-walk':1.65,'travel-descend':1.65,'travel-threshold':1.65,'travel-rise':1.65,'glass':.62,'human':.7,'ai':.7,'duet':1.25,'gallery':1.05,'atrium':1.05,'laboratory':1.05,'frontier':1.1,'grove':1.05,'listening':1.1,'checkpoint':.95,'forum':.95,'observatory':1.1,'horizon':1.7,'placeholder':.25}
PLACES=['confluence','gallery','atrium','laboratory','frontier','grove','listening','checkpoint','forum','observatory','horizon']

def noise(n,seed,low=180,high=3800,power=.6):
 rng=np.random.default_rng(seed); f=np.fft.rfftfreq(n,1/SR)
 weights=(1-np.exp(-(f/max(low,1))**4))*np.exp(-(f/high)**4)/np.maximum(f,80)**power
 spec=(rng.normal(size=len(f))+1j*rng.normal(size=len(f)))*weights; spec[0]=0; spec[-1]=spec[-1].real
 x=np.fft.irfft(spec,n=n); return x/(np.std(x)+1e-9)

def bell(t,frequency,at=0,decay=.35):
 u=np.maximum(t-at,0); env=(1-np.exp(-u*160))*np.exp(-u/decay)*(t>=at)
 # Inharmonic overtones give softly resonant material, not a notification beep.
 return env*(np.sin(2*np.pi*frequency*u)+.22*np.sin(2*np.pi*frequency*2.006*u)+.055*np.sin(2*np.pi*frequency*3.99*u))

def sound(name,duration):
 n=round(SR*duration);t=np.arange(n)/SR; p=t/duration; seed=int(hashlib.sha256(name.encode()).hexdigest()[:8],16)
 a=noise(n,seed); b=noise(n,seed+1); env=np.sin(np.pi*p)**1.5
 if name.startswith('travel-'):
  # Air passing a broad surface: no pitch glide, notification or threshold bell.
  route=name[7:]; center={'walk':.46,'descend':.52,'threshold':.48,'rise':.45}[route]
  swell=np.exp(-((p-center)/.27)**2)*np.sin(np.pi*p)**2
  air=noise(n,seed,240,2700,.55); body=noise(n,seed+9,110,720,.8)
  x=(.34*air+.2*body)*swell
  side=.018*noise(n,seed+1,350,2200,.7)*swell
 elif name=='departure':
  x=.4*noise(n,seed,180,2300,.65)*np.sin(np.pi*p)**2
  side=.018*noise(n,seed+1,250,1800,.7)*np.sin(np.pi*p)**2
 elif name=='placeholder':x=.15*noise(n,seed,260,1800,.7)*env*np.exp(-p*5);side=x*.02
 elif name=='grove':
  # Confidence scene: a single soft, non-pitched pressure swell, with no bell.
  swell=np.sin(np.pi*p)**2.5
  body=noise(n,seed,85,650,.85); air=noise(n,seed+7,280,1700,.7)
  x=(.25*body+.045*air)*swell
  side=.012*noise(n,seed+1,180,1000,.85)*swell
 else:
  notes={'glass':[640,962],'human':[220,330],'ai':[440,660],'duet':[220,440,550],
   'gallery':[293.66,440],'atrium':[261.63,392,523.25],'laboratory':[440,554.37,659.25],
   'frontier':[130.81,138.59],'grove':[196,293.66],'listening':[174.61,261.63],
   'checkpoint':[233.08,349.23],'forum':[146.83,220],'observatory':[329.63,493.88],
   'horizon':[220,329.63,440,550]}[name]
  decay={'glass':.17,'forum':.19,'frontier':.45,'horizon':.52}.get(name,.28)
  spacing=.16 if name=='horizon' else .09
  x=sum(bell(t,f,i*spacing,decay)/(1+i*.45) for i,f in enumerate(notes))*.42
  if name in ['frontier','grove','listening']:x+=.13*noise(n,seed,90,900,.8)*env
  if name in ['gallery','atrium','laboratory','observatory']:x+=.06*a*env
  if name=='forum':x+=.12*noise(n,seed,150,1600,.6)*np.exp(-t*25)*np.minimum(t*150,1)
  # Short diffuse early reflections, avoiding long reverberation under live speech.
  side=.07*np.roll(x,int(SR*.021))+.03*b*env
  fade=np.minimum(t/.015,1)*np.minimum((duration-t)/.14,1);x*=fade;side*=fade
 stereo=np.stack([x+side,x-side],axis=1); peak=np.max(np.abs(stereo))
 target=.15 if name.startswith('travel-') else .12 if name=='departure' else .19 if name=='grove' else .3
 return stereo*target/max(peak,1e-9)

def ambient(place):
 n=SR*8;t=np.arange(n)/SR; idx=PLACES.index(place); seed=80321+idx*101
 # All frequencies and modulation occupy integer bins of the 8 s period.
 fundamental=[110,146.875,130.875,220,65.375,98,87.25,116.5,73.375,164.875,110][idx]
 low=70 if place=='frontier' else 120; high=900 if place in ['listening','forum','frontier'] else 2200
 x=noise(n,seed,low,high,.9)*.08
 x+=.095*np.sin(2*np.pi*fundamental*t+.28*np.sin(2*np.pi*t/8))
 x+=.035*np.sin(2*np.pi*round(fundamental*1.5*8)/8*t)
 x*=.82+.18*np.cos(2*np.pi*t/8)
 side=noise(n,seed+1,500,3000,.8)*.009*(.8+.2*np.sin(2*np.pi*t/8))
 return np.stack([x+side,x-side],axis=1)

records=[]
for name,d in list(DUR.items())+[(f'ambient-{p}',8) for p in PLACES]:
 x=ambient(name[8:]) if name.startswith('ambient-') else sound(name,d)
 pcm=np.round(np.clip(x,-.98,.98)*32767).astype('<i2');path=OUT/f'{name}.wav'
 with wave.open(str(path),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes(pcm.tobytes())
 records.append({'id':name,'duration':d,'peakDbFS':float(20*np.log10(np.max(np.abs(x))+1e-12)),'rmsDbFS':float(20*np.log10(np.sqrt(np.mean(x*x))+1e-12)),'seamStep':float(np.max(np.abs(x[0]-x[-1]))) if name.startswith('ambient-') else None,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
(OUT/'manifest.json').write_text(json.dumps({'author':'Original procedural sound design for HUMAN vs AI','rights':'Original generated waveform assets; no third-party samples. Project owner may use and modify with the deck.','sampleRate':SR,'channels':2,'format':'PCM16 WAV','assets':records},indent=2),encoding='utf8')
print(json.dumps({'assets':len(records),'bytes':sum(p.stat().st_size for p in OUT.glob('*.wav')),'maxPeakDbFS':max(r['peakDbFS'] for r in records),'largestLoopSeam':max(r['seamStep'] or 0 for r in records)},indent=2))
