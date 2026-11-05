import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as timeline from '../src/timeline.js';
import { materials, resultOrder } from '../src/resources.js';
import { typedLengthAt } from '../src/typing.js';

const appSource = (await readFile(new URL('../src/app.js', import.meta.url), 'utf8'))
  .replace(/^import .+ from ['"].+['"];?\s*$/gm, '');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const defaultPrompt = html.match(/<textarea\b[^>]*id="prompt-input"[^>]*>([^<]*)<\/textarea>/)?.[1];
assert.ok(defaultPrompt, 'The standalone composer has its initial prompt');

// Control only the asynchronous browser boundaries. The production application
// handles the clicks, dialogs, visibility changes and playback transitions.
function playerHarness({ waitForImage = false, deferCollapse = false } = {}) {
  const elements = new Map();
  const unlocks = [];
  const images = [];
  const starts = [];
  const submissions = [];
  const frames = new Map();
  let now = 1000;
  let nextFrame = 0;
  let motion;
  const element = () => {
    const listeners = new Map();
    const children = new Map();
    const attributes = new Map();
    const classes = new Set();
    return {
      dataset: {}, style: {}, value: '', textContent: '', innerHTML: '', scrollHeight: 24,
      classList: {
        add(name) { classes.add(name); }, remove(name) { classes.delete(name); },
        toggle(name) { if (classes.has(name)) { classes.delete(name); return false; } classes.add(name); return true; },
      },
      setAttribute(name, value) { attributes.set(name, value); },
      getAttribute(name) { return attributes.get(name); },
      focus() {}, replaceChildren() { children.clear(); }, append() {}, remove() {},
      querySelector(selector) {
        if (!children.has(selector)) children.set(selector, element());
        return children.get(selector);
      },
      querySelectorAll() { return []; }, getContext() { return null; },
      matches() { return false; }, scrollIntoView() {},
      addEventListener(type, listener) { listeners.set(type, listener); },
      emit(type, event = {}) {
        event.target ||= this;
        event.preventDefault ||= () => { event.defaultPrevented = true; };
        return listeners.get(type)?.(event);
      },
      requestSubmit() {
        const promise = this.emit('submit');
        submissions.push(promise);
        return promise;
      },
      showModal() { this.open = true; },
      close() { this.open = false; queueMicrotask(() => this.emit('close')); },
    };
  };
  const get = selector => {
    if (!elements.has(selector)) elements.set(selector, element());
    return elements.get(selector);
  };
  get('#prompt-input').value = defaultPrompt;
  const dialogs = [get('#about-dialog'), get('#chapters-dialog'), get('#settings-dialog')];
  const document = Object.assign(element(), {
    hidden: false,
    querySelector(selector) {
      return selector === 'dialog[open]' ? dialogs.find(dialog => dialog.open) || null : get(selector);
    },
    querySelectorAll(selector) { return selector === 'dialog' ? dialogs : []; },
    createElement: element,
  });
  const context = {
    ...timeline, materials, resultOrder, typedLengthAt, imageSources: waitForImage ? ['fixture'] : [],
    audioEvents: [], musicMotif: [], document,
    window: { addEventListener() {}, scrollTo() {} },
    performance: { now: () => now }, matchMedia: () => ({ matches: false }),
    requestAnimationFrame(callback) { const id = ++nextFrame; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    setTimeout: () => 1, clearTimeout() {},
    PresentationMotion: class {
      constructor() {
        motion = this;
        this.phase = 'inline';
        this.expansions = 0;
        this.collapses = [];
        this.resets = 0;
      }
      get active() { return this.phase !== 'inline'; }
      expand() { this.expansions += 1; this.phase = 'expanded'; return Promise.resolve(true); }
      collapse() {
        this.phase = 'collapsing';
        if (!deferCollapse) { this.phase = 'inline'; return Promise.resolve(true); }
        return new Promise(resolve => this.collapses.push(() => {
          // A completed animation callback may arrive after a newer view reset.
          // Keep that callback deliverable so the application's own generation
          // check, rather than the fake animation, must reject stale completion.
          if (this.phase === 'collapsing') this.phase = 'inline';
          resolve(true);
        }));
      }
      reset() { this.resets += 1; this.phase = 'inline'; }
      refresh() {}
    },
    Image: class { constructor() { images.push(this); } },
    Soundtrack: class {
      unlock() { return new Promise(resolve => unlocks.push(resolve)); }
      start(time) { starts.push(time); }
      stop() {} pause() {} seek() {} setMuted() {}
    },
  };
  vm.runInNewContext(`${appSource}\nglobalThis.inspectPlayback = () => ({ ...state });`, context);
  return {
    get, document, starts, unlocks, images, submissions,
    get motion() { return motion; },
    advance(seconds) {
      now += seconds * 1000;
      const callbacks = [...frames.values()];
      frames.clear();
      for (const callback of callbacks) callback(now);
    },
    seek: seconds => get('#seek').emit('input', { target: { value: String(seconds) } }),
    escape: () => document.emit('keydown', { key: 'Escape', code: 'Escape' }),
    replay: () => get('#replay-button').emit('click'),
    snapshot: context.inspectPlayback,
    start: () => get('#composer-form').requestSubmit(),
    home: () => get('#new-chat-button').emit('click'),
    input: value => { get('#prompt-input').value = value; get('#prompt-input').emit('input'); },
    key: properties => {
      const event = { key: 'Enter', code: 'Enter', shiftKey: false, isComposing: false, keyCode: 13, defaultPrevented: false, ...properties };
      get('#prompt-input').emit('keydown', event);
      return event;
    },
    openDialog: () => document.emit('keydown', { altKey: true, shiftKey: true, code: 'KeyI' }),
    closeDialog: () => get('#about-dialog').close(),
  };
}

test('returning home cancels a start still waiting for audio permission', async () => {
  const player = playerHarness();
  const pending = player.start();
  player.home();
  player.unlocks[0](true);
  await pending;
  assert.equal(player.snapshot().mode, 'home');
  assert.equal(player.snapshot().playing, false);
  assert.equal(player.get('#start-button').disabled, false);
  assert.equal(player.starts.length, 0);
});

test('opening and closing a dialog cannot revive an earlier pending start', async () => {
  const player = playerHarness();
  const pending = player.start();
  player.openDialog();
  player.closeDialog();
  player.unlocks[0](true);
  await pending;
  assert.equal(player.snapshot().mode, 'player');
  assert.equal(player.snapshot().playing, false);
  assert.equal(player.starts.length, 0);
});

test('returning to a previously hidden tab does not revive its pending start', async () => {
  const player = playerHarness();
  const pending = player.start();
  player.document.hidden = true;
  player.document.emit('visibilitychange');
  player.document.hidden = false;
  player.document.emit('visibilitychange');
  player.unlocks[0](true);
  await pending;
  assert.equal(player.snapshot().playing, false);
  assert.equal(player.starts.length, 0);
});

test('an older canceled request does not clear or activate a newer start', async () => {
  const player = playerHarness();
  const first = player.start();
  player.home();
  const second = player.start();
  player.unlocks[0](true);
  await first;
  assert.equal(player.snapshot().starting, true);
  assert.equal(player.get('#start-button').disabled, true);
  assert.equal(player.starts.length, 0);
  player.unlocks[1](true);
  await second;
  assert.equal(player.snapshot().mode, 'player');
  assert.equal(player.snapshot().playing, true);
  assert.equal(player.starts.length, 1);
});

test('returning home also cancels a start waiting for images after audio unlock', async () => {
  const player = playerHarness({ waitForImage: true });
  const pending = player.start();
  player.unlocks[0](true);
  await Promise.resolve();
  player.home();
  player.images[0].onload();
  await pending;
  assert.equal(player.snapshot().mode, 'home');
  assert.equal(player.snapshot().playing, false);
  assert.equal(player.starts.length, 0);
});

test('blank input does not create a message or start playback', async () => {
  const player = playerHarness();
  player.input('  \n\t ');
  assert.equal(player.get('#start-button').disabled, true);
  await player.start();
  assert.equal(player.snapshot().mode, 'home');
  assert.equal(player.unlocks.length, 0);
  assert.equal(player.starts.length, 0);
});

test('submission snapshots the literal prompt and later edits do not change its message', async () => {
  const player = playerHarness();
  const prompt = '<img src=x onerror="alert(1)"> 내 작업을 보여줘.';
  player.input(`  ${prompt}  `);
  const pending = player.start();
  assert.equal(player.snapshot().prompt, prompt);
  assert.equal(player.get('#user-message').textContent, prompt);
  assert.equal(player.get('#user-message').innerHTML, '');
  assert.equal(player.get('#prompt-input').value, '');
  player.input('아직 전송하지 않은 다음 문장');
  player.unlocks[0](true);
  await pending;
  assert.equal(player.snapshot().prompt, prompt);
  assert.equal(player.get('#user-message').textContent, prompt);
  assert.equal(player.get('#prompt-input').value, '아직 전송하지 않은 다음 문장');
});

test('Enter submits once, while Shift+Enter and Korean IME composition do not submit', async () => {
  const player = playerHarness();
  for (const properties of [{ shiftKey: true }, { isComposing: true }, { keyCode: 229 }]) {
    const event = player.key(properties);
    assert.equal(event.defaultPrevented, false);
    assert.equal(player.submissions.length, 0);
    assert.equal(player.unlocks.length, 0);
  }
  assert.equal(player.key({}).defaultPrevented, true);
  assert.equal(player.submissions.length, 1);
  assert.equal(player.unlocks.length, 1);
  player.unlocks[0](true);
  await player.submissions[0];
  assert.equal(player.starts.length, 1);
});

test('new chat resets the submitted message, composer, timeline and visible conversation', async () => {
  const player = playerHarness();
  player.input('이전 대화의 문장');
  const pending = player.start();
  player.unlocks[0](true);
  await pending;
  player.get('#seek').emit('input', { target: { value: '10' } });
  assert.equal(player.snapshot().time, 10);
  player.home();
  assert.equal(player.snapshot().mode, 'home');
  assert.equal(player.snapshot().prompt, defaultPrompt);
  assert.equal(player.snapshot().time, 0);
  assert.equal(player.snapshot().playing, false);
  assert.equal(player.get('#prompt-input').value, defaultPrompt);
  assert.equal(player.get('#user-message').textContent, defaultPrompt);
  assert.equal(player.get('#conversation').hidden, true);
  assert.equal(player.get('#chat-stop-button').hidden, true);
  assert.equal(player.get('#start-button').hidden, false);
  assert.equal(player.get('#start-button').disabled, false);
});

test('the composer stop button cancels a generation still waiting to start', async () => {
  const player = playerHarness();
  const pending = player.start();
  assert.equal(player.get('#chat-stop-button').hidden, false);
  player.get('#chat-stop-button').emit('click');
  player.unlocks[0](true);
  await pending;
  assert.equal(player.snapshot().starting, false);
  assert.equal(player.snapshot().playing, false);
  assert.equal(player.get('#chat-thinking').dataset.state, 'paused');
  assert.equal(player.get('#chat-stop-button').hidden, true);
  assert.equal(player.starts.length, 0);
});

test('submitting again during startup or playback does not replace the running response', async () => {
  const player = playerHarness();
  const first = player.start();
  player.input('두 번째 입력');
  await player.start();
  assert.equal(player.unlocks.length, 1);
  assert.equal(player.snapshot().prompt, defaultPrompt);
  player.unlocks[0](true);
  await first;
  await player.start();
  assert.equal(player.unlocks.length, 1);
  assert.equal(player.starts.length, 1);
  assert.equal(player.snapshot().prompt, defaultPrompt);
  assert.equal(player.get('#prompt-input').value, '두 번째 입력');
});

test('after stopping, a new prompt can start a fresh response', async () => {
  const player = playerHarness();
  const first = player.start();
  player.unlocks[0](true);
  await first;
  player.get('#chat-stop-button').emit('click');
  player.input('새로운 문장');
  const second = player.start();
  player.unlocks[1](true);
  await second;
  assert.equal(player.snapshot().prompt, '새로운 문장');
  assert.equal(player.snapshot().time, 0);
  assert.equal(player.snapshot().playing, true);
  assert.equal(player.starts.length, 2);
});

async function beginPlayback(player) {
  const pending = player.start();
  player.unlocks.at(-1)(true);
  await pending;
}

// Let promise continuations from the VM's realm complete before checking the
// browser-visible result of an animation callback.
const settleBrowserTasks = () => new Promise(resolve => setImmediate(resolve));

test('the first three seconds stay in chat, then the presentation expands once', async () => {
  const player = playerHarness();
  await beginPlayback(player);
  assert.equal(player.motion.expansions, 0);
  assert.equal(player.get('#chat-thinking').dataset.state, 'thinking');
  player.advance(2.9);
  assert.equal(player.snapshot().scene.type, 'wait');
  assert.equal(player.motion.active, false);
  player.advance(0.1);
  assert.equal(player.snapshot().scene.type, 'reveal');
  assert.equal(player.motion.expansions, 1);
  player.advance(0.5);
  assert.equal(player.motion.expansions, 1);
  player.advance(0.5);
  assert.equal(player.snapshot().scene.type, 'process');
  assert.equal(player.motion.expansions, 1);
});

test('completion keeps the last result visible until the return animation settles', async () => {
  const player = playerHarness({ deferCollapse: true });
  await beginPlayback(player);
  const last = timeline.scenes.at(-1);
  player.seek(last.start);
  player.advance(timeline.DURATION - last.start);
  assert.equal(player.snapshot().finishing, true);
  assert.equal(player.snapshot().playing, false);
  assert.equal(player.snapshot().mode, 'player');
  assert.equal(player.snapshot().scene.id, last.id);
  assert.equal(player.get('#player').hidden, false);
  assert.equal(player.get('#credits').hidden, true);
  assert.equal(player.motion.collapses.length, 1);
  player.motion.collapses[0]();
  await settleBrowserTasks();
  assert.equal(player.snapshot().finishing, false);
  assert.equal(player.snapshot().mode, 'credits');
  assert.equal(player.get('#player').hidden, true);
  assert.equal(player.get('#credits').hidden, false);
  assert.equal(player.get('#conversation').hidden, false);
  assert.equal(player.get('#chat-thinking').dataset.state, 'complete');
});

test('a completed return animation cannot restore credits after a new chat', async () => {
  const player = playerHarness({ deferCollapse: true });
  await beginPlayback(player);
  player.seek(timeline.scenes.at(-1).start);
  player.seek(timeline.DURATION);
  assert.equal(player.snapshot().finishing, true);
  player.home();
  assert.equal(player.motion.active, false);
  player.motion.collapses[0]();
  await settleBrowserTasks();
  assert.equal(player.snapshot().mode, 'home');
  assert.equal(player.snapshot().finishing, false);
  assert.equal(player.snapshot().playing, false);
  assert.equal(player.get('#credits').hidden, true);
});

test('replay supersedes an old completion even when its animation resolves later', async () => {
  const player = playerHarness({ deferCollapse: true });
  await beginPlayback(player);
  player.seek(timeline.scenes.at(-1).start);
  player.seek(timeline.DURATION);
  const replay = player.replay();
  assert.equal(player.snapshot().finishing, false);
  assert.equal(player.motion.active, false);
  player.motion.collapses[0]();
  await settleBrowserTasks();
  assert.equal(player.snapshot().mode, 'player');
  assert.equal(player.snapshot().starting, true);
  player.unlocks.at(-1)(true);
  await replay;
  assert.equal(player.snapshot().time, 0);
  assert.equal(player.snapshot().playing, true);
  assert.equal(player.get('#credits').hidden, true);
  player.advance(3);
  assert.equal(player.motion.active, true);
});

test('Escape returns to an inline paused response, and resume respects that dismissal', async () => {
  const player = playerHarness({ deferCollapse: true });
  await beginPlayback(player);
  player.advance(4.5);
  assert.equal(player.motion.active, true);
  player.escape();
  assert.equal(player.snapshot().playing, false);
  assert.equal(player.snapshot().presentationDismissed, true);
  assert.equal(player.snapshot().mode, 'player');
  player.motion.collapses[0]();
  await settleBrowserTasks();
  assert.equal(player.motion.active, false);
  assert.equal(player.get('#chat-thinking').dataset.state, 'paused');
  const resume = player.get('#play-button').emit('click');
  player.unlocks.at(-1)(true);
  await resume;
  player.advance(1);
  assert.equal(player.snapshot().playing, true);
  assert.equal(player.motion.active, false);
  assert.equal(player.motion.expansions, 1);
  const replay = player.replay();
  player.unlocks.at(-1)(true);
  await replay;
  assert.equal(player.snapshot().presentationDismissed, false);
  player.advance(3);
  assert.equal(player.motion.expansions, 2);
});

test('Escape does not interrupt the final return or leave completion stuck', async () => {
  const player = playerHarness({ deferCollapse: true });
  await beginPlayback(player);
  player.seek(timeline.scenes.at(-1).start);
  player.seek(timeline.DURATION);
  player.escape();
  assert.equal(player.motion.collapses.length, 1);
  player.motion.collapses[0]();
  await settleBrowserTasks();
  assert.equal(player.snapshot().mode, 'credits');
  assert.equal(player.snapshot().finishing, false);
});
