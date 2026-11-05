import test from 'node:test';
import assert from 'node:assert/strict';
import { synthesizeKeyboard } from '../src/keyboard.js';

const rms = (samples, sampleRate, start, end) => {
  const from = Math.max(0, Math.floor(start * sampleRate));
  const to = Math.min(samples.length, Math.ceil(end * sampleRate));
  let power = 0;
  for (let i = from; i < to; i += 1) power += samples[i] ** 2;
  return Math.sqrt(power / Math.max(1, to - from));
};

for (const sampleRate of [24000, 48000]) {
  test(`keyboard transient is bounded, finite and reproducible at ${sampleRate} Hz`, () => {
    const settings = { sampleRate, length: Math.round(sampleRate * 0.07), seed: 319 };
    const first = synthesizeKeyboard(settings);
    const repeated = synthesizeKeyboard(settings);
    const other = synthesizeKeyboard({ ...settings, seed: 320 });
    assert.ok(first instanceof Float32Array);
    assert.equal(first.length, settings.length);
    assert.deepEqual(first, repeated);
    assert.notDeepEqual(first, other);
    assert.ok(first.every((sample) => Number.isFinite(sample) && Math.abs(sample) <= 0.8));
    assert.ok(first.some((sample) => Math.abs(sample) > 0.1));
    assert.equal(first[0], 0);
    assert.equal(first.at(-1), 0);
    const mean = first.reduce((sum, sample) => sum + sample, 0) / first.length;
    assert.ok(Math.abs(mean) < 0.01, 'the transient should not carry a substantial DC offset');
  });

  test(`keyboard has a quieter release and a dry tail at ${sampleRate} Hz`, () => {
    for (const duration of [0.06, 0.07, 0.075]) {
      for (const seed of [0, 1, 71, 319, 0xffffffff]) {
        const samples = synthesizeKeyboard({ sampleRate, length: Math.round(sampleRate * duration), seed });
        const down = rms(samples, sampleRate, 0, 0.012);
        const gap = rms(samples, sampleRate, 0.016, 0.022);
        const up = rms(samples, sampleRate, 0.023, 0.034);
        const tail = rms(samples, sampleRate, duration - 0.01, duration);
        assert.ok(up > gap * 2, 'a second, short release should be perceptible after the downstroke');
        assert.ok(up < down * 0.55, 'release should stay subordinate to the downstroke');
        assert.ok(tail < down * 0.005, 'the final 10 ms should have no sustained ringing');
        assert.equal(samples.at(-1), 0);
      }
    }
  });
}

test('keyboard release timing follows milliseconds rather than buffer length', () => {
  const releasePeakAt = (sampleRate, duration) => {
    const samples = synthesizeKeyboard({ sampleRate, length: Math.round(sampleRate * duration), seed: 71 });
    const start = Math.floor(sampleRate * 0.022);
    const end = Math.ceil(sampleRate * 0.034);
    let peak = start;
    for (let i = start + 1; i < end; i += 1) {
      if (Math.abs(samples[i]) > Math.abs(samples[peak])) peak = i;
    }
    return peak / sampleRate;
  };
  const times = [releasePeakAt(24000, 0.06), releasePeakAt(24000, 0.075),
    releasePeakAt(48000, 0.06), releasePeakAt(48000, 0.075)];
  assert.ok(times.every((at) => at >= 0.023 && at <= 0.03));
  assert.ok(Math.max(...times) - Math.min(...times) < 0.002);
});

test('keyboard handles empty buffers and rejects invalid PCM dimensions', () => {
  assert.deepEqual(synthesizeKeyboard({ sampleRate: 48000, length: 0 }), new Float32Array(0));
  assert.deepEqual(synthesizeKeyboard({ sampleRate: 48000, length: 1 }), new Float32Array(1));
  assert.throws(() => synthesizeKeyboard({ sampleRate: 0, length: 100 }), RangeError);
  assert.throws(() => synthesizeKeyboard({ sampleRate: NaN, length: 100 }), RangeError);
  assert.throws(() => synthesizeKeyboard({ sampleRate: 48000, length: -1 }), RangeError);
  assert.throws(() => synthesizeKeyboard({ sampleRate: 48000, length: 0.5 }), RangeError);
});
