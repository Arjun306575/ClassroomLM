// Global Web Audio API singleton and unlock manager for ClassroomLM
// Guarantees reliable, instant, non-breaking TTS audio playback across all browsers

let sharedAudioContext: AudioContext | null = null;
let isUnlocked = false;

/**
 * Returns or initializes the shared Web Audio Context at 24000Hz (standard Gemini TTS rate)
 */
export function getAudioContext(): AudioContext {
  if (typeof window === 'undefined') {
    throw new Error("Web Audio API is only available in browser environment");
  }

  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    sharedAudioContext = new AudioCtx({ sampleRate: 24000 });
  }

  if (sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume().catch(() => {});
  }

  return sharedAudioContext;
}

/**
 * Immediately unlocks Web Audio hardware during a direct user gesture (touch, click, keydown)
 */
export function unlockAudio(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    if (!isUnlocked) {
      // Warm up audio hardware with a 1-sample zero buffer
      const buffer = ctx.createBuffer(1, 1, 24000);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      isUnlocked = true;
    }
    return ctx;
  } catch (err) {
    console.warn("[audioManager] Audio unlock warning:", err);
    return null;
  }
}

// Auto-attach unlock listeners to window so ANY initial interaction unlocks audio immediately
if (typeof window !== 'undefined') {
  const handleInitialUserGesture = () => {
    unlockAudio();
    if (sharedAudioContext && sharedAudioContext.state === 'running') {
      window.removeEventListener('click', handleInitialUserGesture, true);
      window.removeEventListener('touchstart', handleInitialUserGesture, true);
      window.removeEventListener('pointerdown', handleInitialUserGesture, true);
      window.removeEventListener('keydown', handleInitialUserGesture, true);
    }
  };

  window.addEventListener('click', handleInitialUserGesture, true);
  window.addEventListener('touchstart', handleInitialUserGesture, true);
  window.addEventListener('pointerdown', handleInitialUserGesture, true);
  window.addEventListener('keydown', handleInitialUserGesture, true);
}

/**
 * Smooths an AudioBuffer at the micro-level (10ms start, 25ms end)
 * Prevents digital pops and static breaks without truncating speech or words.
 */
export function smoothAudioBuffer(audioBuffer: AudioBuffer): AudioBuffer {
  const sampleRate = audioBuffer.sampleRate;

  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    const data = audioBuffer.getChannelData(ch);
    const total = data.length;

    // 1. Micro Fade-In (first 10ms = ~240 samples): eliminates speaker initialization click
    const fadeInCount = Math.min(Math.floor(sampleRate * 0.01), Math.floor(total * 0.05));
    for (let i = 0; i < fadeInCount; i++) {
      data[i] *= (i / fadeInCount);
    }

    // 2. Micro Fade-Out at the VERY END of the buffer (final 25ms = ~600 samples)
    // Smoothly brings the waveform to zero without cutting off any speech phonemes
    const fadeOutCount = Math.min(Math.floor(sampleRate * 0.025), Math.floor(total * 0.1));
    const fadeStart = Math.max(0, total - fadeOutCount);
    for (let i = fadeStart; i < total; i++) {
      const progress = (i - fadeStart) / fadeOutCount; // 0 -> 1
      const factor = 0.5 * (1 + Math.cos(Math.PI * progress)); // 1 -> 0 cosine taper
      data[i] *= factor;
    }

    // Ensure the very last sample is mathematically 0.0
    if (total > 0) {
      data[total - 1] = 0;
    }
  }

  return audioBuffer;
}
