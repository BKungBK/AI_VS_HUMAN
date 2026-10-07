from pathlib import Path
import json,wave
import numpy as np
root=Path(__file__).resolve().parents[1]
def read(name):
 with wave.open(str(root/'qa/audio'/name)) as w:return np.frombuffer(w.readframes(w.getnframes()),'<i2').astype(np.int32)
a,b=read('loop-listening.wav'),read('debug-repeat-full.wav');d=a-b;maximum=int(np.max(np.abs(d)));changed=int(np.count_nonzero(d));percentage=changed/len(d)*100
report={'pass':maximum<=1 and percentage<=.1,'maximumPcm16Step':maximum,'changedSamples':changed,'totalSamples':len(d),'changedPercent':percentage,'rmsDifferenceDbFS':float(20*np.log10(np.sqrt(np.mean(d.astype(float)**2))/32768 or 1e-12)),'interpretation':'Quantization-scale differences; phase and timing are preserved. Numerical tolerance is one 16-bit sample step in no more than 0.1% of samples; this is not a bit-identical guarantee across native DSP runs.'}
(root/'qa/audio-rounding.json').write_text(json.dumps(report,indent=2),encoding='utf8');print(json.dumps(report,indent=2));
if not report['pass']:raise SystemExit(1)
