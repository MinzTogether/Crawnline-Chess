/**
 * Synthesizes crisp tactile wooden chess acoustics using the Web Audio API.
 * Zero external audio file dependencies.
 */

let audioCtx: AudioContext | null = null;

interface WindowWithWebkitAudioContext extends Window {
  webkitAudioContext?: typeof AudioContext;
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || (window as WindowWithWebkitAudioContext).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) {
    audioCtx = new Ctor();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playWoodTap(freqStart: number, freqEnd: number, duration: number, gainPeak: number, delay = 0) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freqStart, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + duration);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(900, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(gainPeak, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.onended = () => {
    try {
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
    } catch {
      // Ignore disconnect errors on already-released nodes
    }
  };

  osc.start(now);
  osc.stop(now + duration + 0.01);
}

export type ChessSoundType = 'move' | 'capture' | 'castle' | 'check' | 'promote' | 'gameover' | 'illegal';

export function playChessSound(type: ChessSoundType, muted: boolean) {
  if (muted) return;
  try {
    switch (type) {
      case 'move':
        playWoodTap(260 + Math.random() * 22, 95, 0.075, 0.22);
        break;
      case 'capture':
        playWoodTap(410 + Math.random() * 30, 110, 0.095, 0.3);
        playWoodTap(190, 70, 0.06, 0.16, 0.02);
        break;
      case 'castle':
        playWoodTap(250, 95, 0.07, 0.22, 0);
        playWoodTap(290, 105, 0.075, 0.24, 0.085);
        break;
      case 'check': {
        const ctx = getAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.14);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.18, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.onended = () => {
          try {
            osc.disconnect();
            gain.disconnect();
          } catch {
            // Ignore disconnect errors on already-released nodes
          }
        };
        osc.start(now);
        osc.stop(now + 0.17);
        playWoodTap(310, 100, 0.07, 0.2);
        break;
      }
      case 'promote':
        playWoodTap(440, 520, 0.09, 0.16, 0);
        playWoodTap(587, 660, 0.12, 0.18, 0.07);
        break;
      case 'gameover':
        playWoodTap(330, 328, 0.24, 0.14, 0);
        playWoodTap(440, 438, 0.28, 0.14, 0.09);
        playWoodTap(554, 550, 0.34, 0.16, 0.18);
        break;
      case 'illegal':
        playWoodTap(140, 95, 0.08, 0.14, 0);
        break;
    }
  } catch {
    // Ignore audio context autoplay errors
  }
}
