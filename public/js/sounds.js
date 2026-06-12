/* ---------------------------------------------------------------------------
   Cute Sound Effects — synthesized via Web Audio API (no external files)
   --------------------------------------------------------------------------- */

const Sound = (function () {
  let _ctx = null;
  let _enabled = true;

  function ctx() {
    if (!_ctx) {
      _ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Resume if suspended (browsers require user gesture)
    if (_ctx.state === 'suspended') _ctx.resume();
    return _ctx;
  }

  function playTone(freq, duration, type, vol, ramp) {
    if (!_enabled) return;
    try {
      const c = ctx();
      const t = c.currentTime;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (ramp) osc.frequency.linearRampToValueAtTime(ramp, t + duration);
      gain.gain.setValueAtTime(vol || 0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(t);
      osc.stop(t + duration);
    } catch (_) { /* audio not available */ }
  }

  // ── Public sounds ──

  /** Soft bubbly pop — for adding/saving notes */
  function pop() {
    playTone(600, 0.12, 'sine', 0.12, 900);
    setTimeout(function () { playTone(900, 0.08, 'sine', 0.08); }, 40);
  }

  /** Pleasant ding — for correct review answer */
  function ding() {
    playTone(880, 0.15, 'sine', 0.13, 1100);
    setTimeout(function () { playTone(1100, 0.2, 'sine', 0.1); }, 80);
  }

  /** Gentle low thud — for incorrect review */
  function thud() {
    playTone(200, 0.2, 'triangle', 0.1, 120);
    setTimeout(function () { playTone(150, 0.15, 'sine', 0.06); }, 60);
  }

  /** Magical sparkle — for favoriting or mastering */
  function sparkle() {
    playTone(1200, 0.08, 'sine', 0.08, 1600);
    setTimeout(function () { playTone(1600, 0.1, 'sine', 0.1, 2000); }, 50);
    setTimeout(function () { playTone(2000, 0.12, 'sine', 0.07); }, 100);
  }

  /** Soft tap — for button clicks */
  function tap() {
    playTone(400, 0.05, 'sine', 0.06, 500);
  }

  /** Gentle swoosh — for delete or transitions */
  function swoosh() {
    playTone(300, 0.15, 'sawtooth', 0.04, 100);
  }

  /** Success chime — for completed actions */
  function chime() {
    playTone(523, 0.15, 'sine', 0.1, 659);
    setTimeout(function () { playTone(659, 0.15, 'sine', 0.1, 784); }, 100);
    setTimeout(function () { playTone(784, 0.25, 'sine', 0.12); }, 200);
  }

  /** Enable or disable all sounds */
  function enabled(val) {
    if (val === undefined) return _enabled;
    _enabled = val;
  }

  return { pop, ding, thud, sparkle, tap, swoosh, chime, enabled };
})();
