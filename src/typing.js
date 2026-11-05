// A shared performance score for visible code and audible key presses.
// Each cue reveals a small group of characters: compressed time, not a claim
// to reproduce the original author's physical keystrokes.
const typingPlanCache = new Map();

export function typingPlanFor(scene) {
  const key = `${scene.id}:${scene.start}:${scene.end}`;
  if (typingPlanCache.has(key)) return typingPlanCache.get(key);
  const first = scene.start + 0.1;
  const last = scene.start + (scene.end - scene.start) * 0.75;
  const count = Math.max(6, Math.round((last - first) / 0.09));
  const rhythm = [1, 0.8, 1.15, 0.9, 1, 1.9, 0.75];
  const weights = Array.from({ length: count - 1 }, (_, i) => rhythm[i % rhythm.length]);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let elapsed = 0;
  const plan = Object.freeze(Array.from({ length: count }, (_, index) => {
    if (index > 0) elapsed += weights[index - 1];
    return Object.freeze({
      at: Number((first + (last - first) * elapsed / total).toFixed(6)),
      progress: (index + 1) / count,
    });
  }));
  typingPlanCache.set(key, plan);
  return plan;
}

export function typedLengthAt(scene, time, totalLength) {
  const length = Math.max(0, Math.floor(totalLength));
  let progress = 0;
  for (const cue of typingPlanFor(scene)) {
    if (cue.at > time) break;
    progress = cue.progress;
  }
  return Math.min(length, Math.floor(length * progress));
}
