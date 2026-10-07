// Procedural Web Audio API sound synthesizer for Death Cap Roulette.
// 100% offline, self-contained, zero asset network dependencies, seek-safe.

let ctx: AudioContext | null = null;
let muted = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      ctx = new AudioCtx();
    }
  }
  if (ctx && ctx.state === 'suspended') {
    void ctx.resume();
  }
  return ctx;
}

export const rouletteSound = {
  isMuted(): boolean {
    return muted;
  },

  setMuted(m: boolean) {
    muted = m;
  },

  toggleMute(): boolean {
    muted = !muted;
    return muted;
  },

  // Crisp countdown click for final seconds
  playTick() {
    if (muted) return;
    try {
      const c = getAudioContext();
      if (!c) return;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, c.currentTime + 0.04);

      gain.gain.setValueAtTime(0.08, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + 0.04);
    } catch {
      // Audio autoplay policy fallback
    }
  },

  // Tactile button latch lock
  playLock() {
    if (muted) return;
    try {
      const c = getAudioContext();
      if (!c) return;
      const now = c.currentTime;

      // Two quick transient pulses
      [580, 720].forEach((freq, idx) => {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.02);

        gain.gain.setValueAtTime(0.12, now + idx * 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.02 + 0.06);

        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(now + idx * 0.02);
        osc.stop(now + idx * 0.02 + 0.06);
      });
    } catch {
      // Audio error catch
    }
  },

  // Ascending harmonic chime for survival (+300 or +100)
  playSurvive() {
    if (muted) return;
    try {
      const c = getAudioContext();
      if (!c) return;
      const now = c.currentTime;
      const chord = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

      chord.forEach((freq, i) => {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.06);

        gain.gain.setValueAtTime(0.15, now + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.06 + 0.6);

        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(now + i * 0.06);
        osc.stop(now + i * 0.06 + 0.65);
      });
    } catch {
      // Audio error catch
    }
  },

  // Deep descending toxic death rumble (elimination)
  playDeath() {
    if (muted) return;
    try {
      const c = getAudioContext();
      if (!c) return;
      const now = c.currentTime;

      // Heavy sawtooth plunge
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(196, now); // G3
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.9); // Low rumble

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);

      // Low pass filter
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, now);
      filter.frequency.exponentialRampToValueAtTime(80, now + 0.9);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(c.destination);

      osc.start(now);
      osc.stop(now + 0.95);
    } catch {
      // Audio error catch
    }
  },

  // Dramatic tension chord for reveal
  playReveal() {
    if (muted) return;
    try {
      const c = getAudioContext();
      if (!c) return;
      const now = c.currentTime;
      const freqs = [220, 261.63, 311.13, 440]; // Am/dim tension

      freqs.forEach((freq) => {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);

        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(now);
        osc.stop(now + 0.75);
      });
    } catch {
      // Audio error catch
    }
  }
};
