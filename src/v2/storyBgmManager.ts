// Procedural Fairytale Ambient Background Music Engine for Storyteller Persona
// Uses pure Web Audio API synthesis: zero CDN dependencies, zero network requests, zero CORS issues, instant playback
// Produces a soft, whimsical music box / harp arpeggio loop at very low volume (~0.04)

import { getAudioContext } from './audioManager';

class StorytellerBgmEngine {
  private isRunning: boolean = false;
  private isMuted: boolean = false;
  private timerId: any = null;
  private masterGain: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private step: number = 0;

  // Gentle fairytale pentatonic chords (Fmaj7 -> Cmaj -> Dmin7 -> Bbmaj)
  private readonly arpeggios: number[][] = [
    // F major dream chord
    [349.23, 440.00, 523.25, 659.25],
    // C major warmth
    [329.63, 392.00, 523.25, 659.25],
    // D minor mystery
    [293.66, 349.23, 440.00, 587.33],
    // Bb major wonder
    [293.66, 349.23, 466.16, 698.46]
  ];

  /**
   * Initializes audio routing for background music
   */
  private initAudioNodes(ctx: AudioContext) {
    if (!this.masterGain) {
      this.masterGain = ctx.createGain();
      // Very low volume: 0.04 ensures the storyteller's spoken voice remains crystal clear
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.04, ctx.currentTime);

      this.filterNode = ctx.createBiquadFilter();
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.setValueAtTime(1200, ctx.currentTime);
      this.filterNode.Q.setValueAtTime(1.1, ctx.currentTime);

      this.masterGain.connect(this.filterNode);
      this.filterNode.connect(ctx.destination);
    }
  }

  /**
   * Plays a single soft fairytale chime note
   */
  private playNote(freq: number, time: number) {
    try {
      const ctx = getAudioContext();
      if (!ctx || ctx.state === 'closed' || !this.masterGain) return;

      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();

      // Soft music box timbre: blend of sine and subtle triangle
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      // Gentle bell envelope
      noteGain.gain.setValueAtTime(0, time);
      noteGain.gain.linearRampToValueAtTime(0.06, time + 0.03); // Soft attack
      noteGain.gain.exponentialRampToValueAtTime(0.0001, time + 1.4); // Long gentle ring

      osc.connect(noteGain);
      noteGain.connect(this.masterGain);

      osc.start(time);
      osc.stop(time + 1.5);
    } catch (e) {
      // Audio node scheduling safe catch
    }
  }

  /**
   * Schedules the next chord arpeggio
   */
  private tick = () => {
    if (!this.isRunning) return;

    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      if (ctx && ctx.state === 'running' && !this.isMuted) {
        this.initAudioNodes(ctx);
        const chordIndex = Math.floor(this.step / 4) % this.arpeggios.length;
        const noteIndex = this.step % 4;
        const currentChord = this.arpeggios[chordIndex];
        const freq = currentChord[noteIndex];

        const now = ctx.currentTime;
        this.playNote(freq, now);

        // Every 8th step, add a very delicate high starlight sparkle chime
        if (this.step % 8 === 0) {
          this.playNote(freq * 2, now + 0.12);
        }

        this.step++;
      }
    } catch (e) {
      // Safe tick
    }

    // Tempo: ~450ms per arpeggio note (relaxing, gentle fairytale pace)
    if (this.isRunning) {
      this.timerId = setTimeout(this.tick, 480);
    }
  };

  /**
   * Starts storyteller ambient background music
   */
  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.step = 0;

    try {
      const ctx = getAudioContext();
      this.initAudioNodes(ctx);
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    } catch (e) {}

    this.tick();
  }

  /**
   * Stops storyteller ambient background music
   */
  public stop() {
    this.isRunning = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    if (this.masterGain) {
      try {
        const ctx = getAudioContext();
        if (ctx && ctx.state !== 'closed') {
          this.masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
        }
      } catch (e) {}
    }
  }

  /**
   * Toggle mute state
   */
  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain) {
      try {
        const ctx = getAudioContext();
        if (ctx && ctx.state !== 'closed') {
          const now = ctx.currentTime;
          this.masterGain.gain.cancelScheduledValues(now);
          this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.04, now);
        }
      } catch (e) {}
    }
    return !this.isMuted;
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }
}

export const storytellerBgm = new StorytellerBgmEngine();
