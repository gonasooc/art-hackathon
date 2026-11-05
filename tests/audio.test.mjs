import test from 'node:test';
import assert from 'node:assert/strict';
import { Soundtrack, AUDIO_DURATION, audioEvents, musicMotif } from '../src/audio.js';
import { DURATION, scenes, sceneAt } from '../src/timeline.js';

const musicScene = scenes.find((scene) => scene.type === 'result' && scene.material === 'music');
const musicEntry = musicScene.start + 0.4;
const musicLater = musicScene.start + 6.2;

// This harness observes the Web Audio boundary: context creation, scheduled
// sources, graph disconnection and timer ownership. It does not call private
// Soundtrack methods or reproduce its event scheduling algorithm.
function audioHarness(t, { resume = 'success', supported = true, captureTimeouts = false } = {}) {
  const intervals = new Map();
  const timeouts = new Map();
  const contexts = [];
  const scores = [];
  let nextId = 0;
  let wallTime = 0;
  const originals = new Map();
  const replace = (key, value) => {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  };

  class Param {
    value = 0;
    events = [];
    setValueAtTime(value, at) { this.value = value; this.events.push({ type: 'set', value, at }); }
    linearRampToValueAtTime(value, at) { this.value = value; this.events.push({ type: 'ramp', value, at }); }
    cancelAndHoldAtTime(at) { this.events.push({ type: 'hold', at }); }
  }

  class AudioNode {
    gain = new Param();
    frequency = new Param();
    Q = new Param();
    pan = new Param();
    connections = new Set();
    connect(target) { this.connections.add(target); return target; }
    disconnect() { this.connections.clear(); }
  }

  class BufferSource extends AudioNode {
    started = null;
    stopped = false;
    ended = false;
    start(at, offset = 0, duration) {
      assert.equal(this.started, null, 'an AudioBufferSource is single-use');
      assert.ok(Number.isFinite(at) && Number.isFinite(offset) && Number.isFinite(duration));
      assert.ok(offset >= 0 && duration > 0);
      assert.ok(offset + duration <= this.buffer.length / this.buffer.sampleRate + 0.000001);
      this.started = { at, offset, duration };
    }
    stop() { this.stopped = true; }
    finishIfDue(at) {
      if (!this.stopped && !this.ended && this.started && this.started.at + this.started.duration <= at) {
        this.ended = true;
        this.onended?.();
      }
    }
  }

  class Context {
    state = 'suspended';
    currentTime = 0;
    sampleRate = 8000;
    destination = {};
    sources = [];
    nodes = [];
    buffers = [];
    resumeCalls = 0;
    constructor() { contexts.push(this); }
    async resume() {
      this.resumeCalls += 1;
      if (resume === 'denied') throw new Error('Audio permission denied');
      if (resume === 'pending') return new Promise(() => {});
      this.state = 'running';
    }
    node() { const node = new AudioNode(); this.nodes.push(node); return node; }
    createGain() { return this.node(); }
    createBiquadFilter() { return this.node(); }
    createStereoPanner() { return this.node(); }
    createBufferSource() {
      const source = new BufferSource();
      this.sources.push(source);
      this.nodes.push(source);
      return source;
    }
    createBuffer(channels, length, sampleRate) {
      assert.equal(channels, 1);
      const samples = new Float32Array(length);
      const buffer = { length, sampleRate, getChannelData: () => samples };
      this.buffers.push(buffer);
      return buffer;
    }
  }

  replace('AudioContext', supported ? Context : undefined);
  replace('webkitAudioContext', undefined);
  replace('setInterval', (callback) => { const id = ++nextId; intervals.set(id, callback); return id; });
  replace('clearInterval', (id) => intervals.delete(id));
  if (captureTimeouts) {
    replace('setTimeout', (callback, delay) => {
      const id = ++nextId;
      timeouts.set(id, { callback, at: wallTime + delay });
      return id;
    });
    replace('clearTimeout', (id) => timeouts.delete(id));
  }

  t.after(() => {
    for (const score of scores) score.stop();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });

  return {
    contexts, intervals, timeouts,
    create() { const score = new Soundtrack(); scores.push(score); return score; },
    // A single tick after a jump also simulates a delayed/background-tab timer.
    tickAt(at) {
      for (const context of contexts) {
        context.currentTime = at;
        for (const source of context.sources) source.finishIfDue(at);
      }
      for (const callback of [...intervals.values()]) callback();
    },
    elapseWall(milliseconds) {
      wallTime += milliseconds;
      for (const [id, timeout] of [...timeouts]) {
        if (timeout.at <= wallTime) { timeouts.delete(id); timeout.callback(); }
      }
    },
  };
}

test('construction, start and seek never create or resume audio without unlock', async (t) => {
  const h = audioHarness(t);
  const score = h.create();
  assert.equal(score.state.supported, true);
  assert.equal(score.start(), false);
  assert.equal(score.resume(12), false);
  score.seek(20);
  assert.equal(h.contexts.length, 0);
  assert.equal(h.intervals.size, 0);
  assert.deepEqual(await Promise.all([score.unlock(), score.unlock()]), [true, true]);
  assert.equal(h.contexts.length, 1, 'concurrent unlock uses one context');
  assert.equal(h.contexts[0].resumeCalls, 1);
  score.start();
  score.pause();
  score.resume();
  assert.equal(h.contexts[0].resumeCalls, 1, 'only unlock may resume a context');
});

test('unsupported audio returns false without preventing a silent experience', async (t) => {
  const h = audioHarness(t, { supported: false });
  const score = h.create();
  assert.equal(score.state.supported, false);
  assert.equal(await score.unlock(), false);
  assert.equal(score.start(), false);
  score.setMuted(true);
  score.pause();
  score.seek(musicScene.start);
  score.stop();
  assert.equal(score.state.running, false);
  assert.equal(h.intervals.size, 0);
});

test('a rejected permission request does not throw or schedule audio', async (t) => {
  const h = audioHarness(t, { resume: 'denied', captureTimeouts: true });
  const score = h.create();
  assert.equal(await score.unlock(), false);
  assert.equal(score.state.unlocked, false);
  assert.equal(score.start(), false);
  assert.equal(h.contexts[0].sources.length, 0);
  assert.equal(h.intervals.size, 0);
  assert.equal(h.timeouts.size, 0, 'failure clears the fallback timer');
});

test('an indefinitely pending resume releases the caller after 900 ms', async (t) => {
  const h = audioHarness(t, { resume: 'pending', captureTimeouts: true });
  const score = h.create();
  let settled = false;
  const result = score.unlock().then((value) => { settled = true; return value; });
  h.elapseWall(899);
  await Promise.resolve();
  assert.equal(settled, false);
  h.elapseWall(1);
  assert.equal(await result, false);
  assert.equal(score.start(), false);
  assert.equal(h.timeouts.size, 0);
  assert.equal(h.intervals.size, 0);
});

test('pause cancels even future lookahead sources and freezes the position', async (t) => {
  const h = audioHarness(t);
  const score = h.create();
  await score.unlock();
  const firstType = audioEvents.find((event) => event.type === 'type');
  assert.equal(score.start(firstType.at - 0.05), true);
  const context = h.contexts[0];
  assert.ok(context.sources.some((source) => source.started.at > context.currentTime));
  const pausedAt = score.pause();
  assert.ok(context.sources.every((source) => source.stopped));
  assert.equal(score.state.activeVoices, 0);
  assert.equal(h.intervals.size, 0);
  h.tickAt(30);
  assert.equal(score.state.position, pausedAt);
  assert.equal(context.nodes.filter((node) => node.connections.size > 0).length, 1,
    'only the reusable master bus remains connected');
});

test('paused seek stays silent, and resume enters the current note instead of replaying the click', async (t) => {
  const h = audioHarness(t);
  const score = h.create();
  await score.unlock();
  score.seek(musicEntry);
  assert.equal(score.state.running, false);
  assert.equal(score.state.position, musicEntry);
  assert.equal(h.contexts[0].sources.length, 0);
  assert.equal(score.resume(), true);
  assert.equal(h.contexts[0].sources.length, 1);
  assert.ok(h.contexts[0].sources[0].started.offset > 0.2,
    'the active music note resumes at its elapsed sample offset');
  assert.ok(h.contexts[0].sources[0].started.duration > 0.5);
});

test('running seek replaces previous sources and preserves one scheduler', async (t) => {
  const h = audioHarness(t);
  const score = h.create();
  await score.unlock();
  score.start();
  const context = h.contexts[0];
  const previousSources = [...context.sources];
  score.seek(musicLater);
  assert.equal(score.state.running, true);
  assert.equal(score.state.position, musicLater);
  assert.ok(previousSources.every((source) => source.stopped));
  assert.equal(h.intervals.size, 1);
  assert.ok(context.sources.slice(previousSources.length).every((source) => source.started.at >= context.currentTime));
  score.seek(1000);
  assert.equal(score.state.position, AUDIO_DURATION);
  assert.equal(score.state.running, false);
  assert.equal(h.intervals.size, 0);
});

test('a delayed scheduler skips expired gestures rather than playing a backlog', async (t) => {
  const h = audioHarness(t);
  const score = h.create();
  await score.unlock();
  score.start();
  const count = h.contexts[0].sources.length;
  const quietMoment = scenes.find((scene) => scene.id === 'code-final').start + 2;
  h.tickAt(quietMoment);
  assert.equal(h.contexts[0].sources.length, count,
    'the quiet moment in the code result must not replay the earlier montage');
  h.tickAt(musicEntry);
  const newSources = h.contexts[0].sources.slice(count);
  assert.ok(newSources.length > 0 && newSources.length < 4);
  assert.ok(newSources.every((source) => source.started.at >= musicEntry));
});

test('natural completion stops the timer and disconnects remaining voices', async (t) => {
  const h = audioHarness(t);
  const score = h.create();
  await score.unlock();
  score.start(AUDIO_DURATION - 2);
  h.tickAt(3);
  assert.equal(score.state.running, false);
  assert.equal(score.state.position, AUDIO_DURATION);
  assert.equal(score.state.activeVoices, 0);
  assert.equal(h.intervals.size, 0);
  assert.ok(h.contexts[0].sources.every((source) => source.ended || source.stopped));
});

test('repeated starts do not retain voices, timers or stale callbacks', async (t) => {
  const h = audioHarness(t);
  const score = h.create();
  await score.unlock();
  score.start(musicEntry);
  const obsoleteCallback = [...h.intervals.values()][0];
  for (let cycle = 0; cycle < 12; cycle += 1) {
    score.start(musicEntry);
    assert.equal(h.intervals.size, 1);
    assert.ok(score.state.activeVoices > 0);
    score.pause();
    assert.equal(h.intervals.size, 0);
    assert.equal(score.state.activeVoices, 0);
  }
  score.start(musicLater);
  const sourceCount = h.contexts[0].sources.length;
  obsoleteCallback();
  assert.equal(h.contexts[0].sources.length, sourceCount);
  assert.equal(h.intervals.size, 1);
  score.stop();
  assert.equal(score.state.position, 0);
  assert.equal(h.intervals.size, 0);
  assert.equal(score.state.activeVoices, 0);
});

test('mute ramps the master level while time continues and persists across restart', async (t) => {
  const h = audioHarness(t);
  const score = h.create();
  await score.unlock();
  const context = h.contexts[0];
  const master = context.nodes.find((node) => node.connections.has(context.destination));
  score.start(musicScene.start);
  score.setMuted(true);
  assert.equal(score.state.muted, true);
  assert.equal(master.gain.events.at(-1).type, 'ramp');
  assert.equal(master.gain.events.at(-1).value, 0);
  assert.ok(master.gain.events.at(-1).at > context.currentTime);
  h.tickAt(1);
  assert.ok(score.state.position > musicScene.start + 0.5);
  score.start(musicScene.start);
  assert.equal(score.state.muted, true);
  score.setMuted(false);
  assert.equal(score.state.muted, false);
  assert.ok(master.gain.events.at(-1).value > 0);
  assert.ok(master.gain.events.at(-1).at > context.currentTime);
});

test('generated sound buffers contain finite, non-silent samples', async (t) => {
  const h = audioHarness(t);
  const score = h.create();
  await score.unlock();
  // Exercise the different sounds through public playback, not _buffer().
  for (const type of ['click', 'type', 'scratch', 'brush', 'pluck', 'room']) {
    score.start(audioEvents.find((event) => event.type === type).at + 0.01);
  }
  assert.ok(h.contexts[0].buffers.length >= 6);
  for (const buffer of h.contexts[0].buffers) {
    const samples = buffer.getChannelData(0);
    assert.ok(samples.every((sample) => Number.isFinite(sample) && Math.abs(sample) <= 1));
    assert.ok(samples.some((sample) => Math.abs(sample) > 0.001));
  }
});

test('the three-second wait and one-second reveal precede the original artwork and score', () => {
  assert.equal(DURATION, 67.2);
  assert.equal(sceneAt(2.999).id, 'waiting');
  assert.equal(sceneAt(3).id, 'reveal');
  assert.equal(sceneAt(3.999).id, 'reveal');
  assert.equal(sceneAt(4).id, 'stage-first');
  assert.equal(sceneAt(DURATION).type, 'credits');
  assert.deepEqual(audioEvents.filter((event) => event.at < 4).map(({ type, at }) => ({ type, at })),
    [{ type: 'click', at: 0 }]);
  assert.equal(audioEvents.find((event) => event.type === 'type').at, 4.6);
});

test('the repeated musical motif resolves in the same 46.2–54.2 second visual scene', () => {
  assert.equal(AUDIO_DURATION, DURATION);
  assert.equal(musicScene.start, 46.2);
  assert.equal(musicScene.end, 54.2);
  const finalNotes = audioEvents.filter((event) => event.type === 'pluck'
    && event.at >= musicScene.start && event.at < musicScene.end);
  assert.deepEqual(finalNotes.slice(0, 4).map((event) => event.frequency), musicMotif);
  assert.deepEqual(finalNotes.slice(4, 8).map((event) => event.frequency), musicMotif);
  const firstResult = scenes.find((scene) => scene.type === 'result').start;
  const earlierNotes = audioEvents.filter((event) => event.type === 'pluck' && event.at < firstResult);
  assert.deepEqual(earlierNotes.slice(0, 2).map((event) => event.frequency), musicMotif.slice(0, 2));
  assert.ok(audioEvents.filter((event) => event.type === 'pluck' && event.at >= firstResult)
    .every((event) => event.at >= musicScene.start && event.at < musicScene.end),
  'new music notes only begin while the music result is visible; a decay may trail into the next scene');
  assert.ok(audioEvents.every((event, index) => event.at >= 0 && event.duration > 0
    && event.at + event.duration <= AUDIO_DURATION
    && (index === 0 || event.at >= audioEvents[index - 1].at)));
});
