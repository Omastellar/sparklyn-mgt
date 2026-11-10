/**
 * Browser-native Web Audio API synthesizer for routine reminder alarms.
 * Does not require external audio assets or network downloads.
 */

export function playChimeAlarm(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const startTime = ctx.currentTime;

    // Chime Note 1: E5 (659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, startTime);
    gain1.gain.setValueAtTime(0.3, startTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, startTime + 0.6);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(startTime);
    osc1.stop(startTime + 0.6);

    // Chime Note 2: G#5 (830.61 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(830.61, startTime + 0.2);
    gain2.gain.setValueAtTime(0.35, startTime + 0.2);
    gain2.gain.exponentialRampToValueAtTime(0.001, startTime + 0.9);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(startTime + 0.2);
    osc2.stop(startTime + 0.9);

    // Chime Note 3: B5 (987.77 Hz)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(987.77, startTime + 0.45);
    gain3.gain.setValueAtTime(0.4, startTime + 0.45);
    gain3.gain.exponentialRampToValueAtTime(0.001, startTime + 1.4);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(startTime + 0.45);
    osc3.stop(startTime + 1.4);

    // Gentle vibration if supported on mobile
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 300]);
    }
  } catch (err) {
    console.warn('Could not play audio alarm:', err);
  }
}

export function parseFrequencyToMinutes(frequencyString: string): number {
  if (!frequencyString) return 120;
  const lower = frequencyString.toLowerCase();
  if (lower.includes('30 min')) return 30;
  if (lower.includes('1 hour') || lower.includes('hourly')) return 60;
  if (lower.includes('2 hour')) return 120;
  if (lower.includes('3 hour')) return 180;
  if (lower.includes('4 hour')) return 240;
  if (lower.includes('daily')) return 480;

  const match = lower.match(/(\d+)/);
  if (match) {
    const val = parseInt(match[1], 10);
    if (lower.includes('hour')) return val * 60;
    if (lower.includes('min')) return val;
  }
  return 120; // default 2 hours
}
