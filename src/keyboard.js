// Synthetic prototype foley, not a recording of a particular keyboard.
// `length` is the number of mono PCM frames. A 60–75 ms buffer is recommended.
export function synthesizeKeyboard({ sampleRate = 48000, length = Math.round(sampleRate * 0.07), seed = 1 } = {}) {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new RangeError('sampleRate must be a positive finite number');
  }
  if (!Number.isSafeInteger(length) || length < 0) {
    throw new RangeError('length must be a non-negative integer frame count');
  }
  const samples = new Float32Array(length);
  if (length < 2) return samples;

  let randomState = Number.isFinite(seed) ? seed >>> 0 : 1;
  const random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4294967296;
  };
  // Small changes in the switch body, release and texture make successive keys
  // differ without changing the gesture into a different sound each time.
  const bodyWidth = 0.00078 + random() * 0.00018;
  const upAt = 0.023 + random() * 0.004;
  const downDecay = 0.0044 + random() * 0.0011;
  const upStrength = 0.3 + random() * 0.06;
  const bounceAt = 0.007 + random() * 0.0014;
  const targetPeak = 0.69 + random() * 0.07;
  const duration = (length - 1) / sampleRate;
  const soundEnd = Math.min(duration, 0.057);
  const fadeDuration = Math.min(0.008, soundEnd / 3);
  const coefficient = (hz) => 1 - Math.exp(-2 * Math.PI * Math.min(hz, sampleRate * 0.42) / sampleRate);
  const highCoefficient = coefficient(5800);
  const lowCoefficient = coefficient(760);
  const bodyCoefficient = coefficient(340);
  let highNoise = 0;
  let lowNoise = 0;
  let bodyNoise = 0;
  let peak = 0;

  // A short, bipolar pressure pulse supplies the low "thock" without a sustained
  // oscillator. The low-frequency body is over after only a few milliseconds.
  const pressurePulse = (time, center, width) => {
    const x = (time - center) / width;
    return (1 - x * x) * Math.exp(-0.5 * x * x);
  };
  const attack = (time, seconds) => {
    const x = Math.min(1, Math.max(0, time / seconds));
    return x * x * (3 - 2 * x);
  };

  for (let i = 0; i < length; i += 1) {
    const time = i / sampleRate;
    if (time >= soundEnd) break;
    const white = random() * 2 - 1;
    highNoise += highCoefficient * (white - highNoise);
    lowNoise += lowCoefficient * (white - lowNoise);
    bodyNoise += bodyCoefficient * (white - bodyNoise);
    const plasticNoise = highNoise - lowNoise;
    const downEnvelope = attack(time, 0.00024) * Math.exp(-time / downDecay);
    let value = 0.76 * pressurePulse(time, bodyWidth * 3, bodyWidth) * attack(time, 0.00024);
    value += (plasticNoise * 0.9 + bodyNoise * 0.28) * downEnvelope;
    value += pressurePulse(time, bounceAt, 0.00038) * 0.065;

    const upTime = time - upAt;
    if (upTime >= 0) {
      const upEnvelope = attack(upTime, 0.00018) * Math.exp(-upTime / 0.0028);
      value += upStrength * (
        pressurePulse(upTime, 0.0015, 0.0005) * 0.54 * attack(upTime, 0.00018)
        + plasticNoise * 0.88 * upEnvelope
      );
    }

    const fade = Math.min(1, Math.max(0, (soundEnd - time) / fadeDuration));
    value *= fade * fade * (3 - 2 * fade);
    samples[i] = value;
    peak = Math.max(peak, Math.abs(value));
  }

  if (peak > 0) {
    const level = targetPeak / peak;
    for (let i = 0; i < length; i += 1) samples[i] *= level;
  }
  samples[0] = 0;
  samples[length - 1] = 0;
  return samples;
}
