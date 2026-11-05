import test from 'node:test';
import assert from 'node:assert/strict';
import { audioEvents } from '../src/audio.js';
import { scenes } from '../src/timeline.js';
import { typingPlanFor, typedLengthAt } from '../src/typing.js';
import { materials } from '../src/resources.js';

const EPSILON = 1e-7;
const codeScenes = scenes.filter(scene => scene.type === 'process' && scene.material === 'code');
const overlaps = (event, start, end) => event.at < end - EPSILON && event.at + event.duration > start + EPSILON;

for (const scene of codeScenes) {
  test(`${scene.id}: visible character changes and keyboard cues share every onset`, () => {
    const fragment = materials.code.fragments[scene.pass ? 1 : 2];
    const code = fragment.text.split('\n').map(line => line.replace(/^ {4}/, '')).join('\n');
    const plan = typingPlanFor(scene);
    const keys = audioEvents.filter(event => event.sceneId === scene.id && event.type === 'type');
    assert.ok(plan.length > 0);
    assert.equal(keys.length, plan.length);
    assert.equal(typedLengthAt(scene, scene.start, code.length), 0);

    let previousLength = 0;
    for (let i = 0; i < plan.length; i++) {
      const cue = plan[i];
      const key = keys[i];
      assert.equal(key.at, cue.at, `Keyboard onset ${i} differs from the visible cue`);
      assert.equal(key.typingProgress, cue.progress);
      const before = typedLengthAt(scene, cue.at - EPSILON, code.length);
      const after = typedLengthAt(scene, cue.at + EPSILON, code.length);
      assert.equal(before, previousLength);
      assert.ok(after > before, `Keyboard cue ${i} should reveal characters`);
      assert.equal(after, Math.floor(cue.progress * code.length));
      assert.equal(typedLengthAt(scene, cue.at, code.length), after);
      previousLength = after;
    }
    assert.equal(previousLength, code.length);

    // Seeking backwards must reconstruct the same visible prefix without
    // needing the earlier frames or replaying all preceding key presses.
    for (const cue of [...plan].reverse()) {
      assert.equal(typedLengthAt(scene, cue.at, code.length), Math.floor(cue.progress * code.length));
    }
    assert.equal(typedLengthAt(scene, scene.start - 1, code.length), 0);

    const releaseEnd = Math.max(...keys.map(event => event.at + event.duration));
    assert.ok(releaseEnd < scene.end - 0.03 + EPSILON);
    for (const time of [releaseEnd, (releaseEnd + scene.end) / 2, scene.end - EPSILON]) {
      assert.equal(typedLengthAt(scene, time, code.length), code.length);
    }
    assert.deepEqual(audioEvents.filter(event => overlaps(event, releaseEnd, scene.end)), [],
      'The completed code should hold without further typing or unrelated sound');
  });
}

test('only that scene’s keyboard sounds overlap either code typing scene', () => {
  assert.equal(codeScenes.length, 2);
  for (const scene of codeScenes) {
    const audible = audioEvents.filter(event => overlaps(event, scene.start, scene.end));
    assert.ok(audible.length > 0);
    for (const event of audible) {
      assert.equal(event.type, 'type', `${event.type} leaks into ${scene.id}`);
      assert.equal(event.sceneId, scene.id, `A tail from ${event.sceneId} leaks into ${scene.id}`);
    }
  }
});

test('every musical note and its release stays within a music scene', () => {
  const musicScenes = scenes.filter(scene => scene.material === 'music');
  const notes = audioEvents.filter(event => event.type === 'pluck');
  assert.ok(notes.length > 0);
  for (const scene of musicScenes) {
    assert.ok(notes.some(event => event.sceneId === scene.id), `${scene.id} should contain its own music`);
  }
  for (const event of notes) {
    const scene = scenes.find(candidate => candidate.id === event.sceneId);
    assert.ok(scene, `Unknown music owner: ${event.sceneId}`);
    assert.equal(scene.material, 'music');
    assert.ok(['process', 'result'].includes(scene.type));
    assert.ok(event.at >= scene.start);
    assert.ok(event.duration > 0);
    assert.ok(event.at + event.duration <= scene.end - 0.03 + EPSILON,
      `Note at ${event.at} outlasts ${scene.id}'s release margin`);
  }
  for (const scene of scenes.filter(candidate => candidate.material !== 'music')) {
    assert.equal(notes.some(event => overlaps(event, scene.start, scene.end)), false,
      `Music overlaps ${scene.id}`);
  }
});

test('the static portfolio result contains no off-screen typing or incoming sound tail', () => {
  const result = scenes.find(scene => scene.type === 'result' && scene.material === 'code');
  assert.ok(result);
  assert.deepEqual(audioEvents.filter(event => overlaps(event, result.start, result.end)), []);
});

test('scene-owned work sounds do not extend into the following material', () => {
  for (const event of audioEvents) {
    const scene = scenes.find(candidate => candidate.id === event.sceneId);
    assert.ok(scene, `Missing owner for ${event.type} at ${event.at}`);
    assert.ok(Number.isFinite(event.at) && Number.isFinite(event.duration));
    assert.ok(event.duration > 0);
    assert.ok(event.at >= scene.start - EPSILON);
    assert.ok(event.at + event.duration <= scene.end - 0.03 + EPSILON,
      `${event.type} from ${scene.id} leaks past its scene`);
  }
});
