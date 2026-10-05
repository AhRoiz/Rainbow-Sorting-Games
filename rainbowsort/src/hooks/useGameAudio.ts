/**
 * useGameAudio — procedural sound effects synthesized with the Web Audio API.
 * No external audio assets. Subscribes to store events and plays the matching cue.
 */
import { useEffect } from 'react';
import { useGameStore, type GameEventType } from '../store/useGameStore';

type Wave = OscillatorType;

class SynthAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private ensure(): { ctx: AudioContext; out: GainNode } | null {
    if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') return null;
    if (!this.ctx || !this.master) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return { ctx: this.ctx, out: this.master };
  }

  /** One enveloped oscillator note with an optional exponential pitch sweep. */
  private tone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    { wave = 'sine' as Wave, gain = 0.3, delay = 0, attack = 0.005 } = {},
  ): void {
    const audio = this.ensure();
    if (!audio) return;
    const { ctx, out } = audio;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freqStart, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + duration);
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(amp).connect(out);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  private noise(ctx: AudioContext): AudioBuffer {
    if (!this.noiseBuffer) {
      const len = ctx.sampleRate;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    }
    return this.noiseBuffer;
  }

  /** Gentle high pop: sine 400Hz -> 600Hz, 80ms. */
  select(): void {
    this.tone(400, 600, 0.08, { gain: 0.25 });
  }

  deselect(): void {
    this.tone(500, 380, 0.07, { gain: 0.15 });
  }

  /** Soft bubbling trickle: band-passed noise sweep + random rising bubble blips. */
  pour(units = 1): void {
    const audio = this.ensure();
    if (!audio) return;
    const { ctx, out } = audio;
    const duration = 0.3 + units * 0.11;
    const t0 = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.noise(ctx);
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 6;
    band.frequency.setValueAtTime(500, t0);
    band.frequency.exponentialRampToValueAtTime(1400, t0 + duration);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(0.12, t0 + 0.04);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(band).connect(amp).connect(out);
    src.start(t0);
    src.stop(t0 + duration + 0.05);

    const bubbles = 4 + units * 2;
    for (let i = 0; i < bubbles; i++) {
      const f = 280 + Math.random() * 420 + i * 25;
      this.tone(f, f * 1.8, 0.05, { gain: 0.07, delay: (i / bubbles) * duration });
    }
  }

  /** Low damp thud. */
  error(): void {
    this.tone(140, 55, 0.18, { gain: 0.45 });
    this.tone(90, 45, 0.12, { wave: 'triangle', gain: 0.2 });
  }

  undo(): void {
    this.tone(620, 420, 0.1, { wave: 'triangle', gain: 0.18 });
  }

  hint(): void {
    this.tone(880, 880, 0.18, { wave: 'triangle', gain: 0.15 });
    this.tone(1318.5, 1318.5, 0.25, { wave: 'triangle', gain: 0.12, delay: 0.1 });
  }

  /** Harmonious arpeggio C5–E5–G5–C6 followed by a soft chord. */
  win(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => this.tone(f, f, 0.45, { wave: 'triangle', gain: 0.22, delay: i * 0.12 }));
    notes.forEach((f) => this.tone(f, f, 1.1, { wave: 'sine', gain: 0.08, delay: 0.55, attack: 0.03 }));
  }

  restart(): void {
    this.tone(300, 520, 0.14, { wave: 'sine', gain: 0.15 });
  }
}

export const synth = new SynthAudio();

/** Plays a cue for every store event while sound is enabled. */
export function useGameAudio(): void {
  const event = useGameStore((s) => s.event);
  const enabled = useGameStore((s) => s.soundEnabled);

  useEffect(() => {
    if (!event || !enabled) return;
    const units = useGameStore.getState().pour?.count ?? 1;
    const handlers: Record<GameEventType, () => void> = {
      select: () => synth.select(),
      deselect: () => synth.deselect(),
      pour: () => synth.pour(units),
      error: () => synth.error(),
      undo: () => synth.undo(),
      hint: () => synth.hint(),
      win: () => synth.win(),
      restart: () => synth.restart(),
    };
    handlers[event.type]();
    // Only react to new events, not to the `enabled` flag flipping.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);
}
