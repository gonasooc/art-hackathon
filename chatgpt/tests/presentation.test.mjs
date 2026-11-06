import test from 'node:test';
import assert from 'node:assert/strict';
import { PresentationMotion } from '../src/presentation.js';

function fixture({ reducedMotion = false, animateSupported = true } = {}) {
  const document = { activeElement: null };
  function element() {
    const classes = new Set();
    return {
      style: { transformOrigin: '', willChange: '' }, inert: false, isConnected: true,
      classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name) },
      contains: () => false,
      focus() { document.activeElement = this; },
      ownerDocument: document,
    };
  }
  const root = element();
  const player = element();
  const composer = element();
  const sidebar = element();
  sidebar.inert = true;
  const ancestor = element();
  ancestor.contains = child => child === player;
  document.activeElement = composer;
  let inline = { left: 300, top: 180, width: 700, height: 420 };
  let full = { left: 0, top: 0, width: 1400, height: 900 };
  let visual = null;
  const animations = [];
  player.getBoundingClientRect = () => visual || (player.classList.contains('is-expanded') ? full : inline);
  if (animateSupported) player.animate = (frames, options) => {
    const animation = {
      frames, options, canceled: false, onfinish: null, oncancel: null,
      finish() { this.onfinish?.(); },
      cancel() { this.canceled = true; visual = null; this.oncancel?.(); },
    };
    animations.push(animation);
    return animation;
  };
  const motion = new PresentationMotion({ player, root, reducedMotion, backgroundElements: [composer, sidebar, ancestor, player] });
  return {
    motion, player, root, composer, sidebar, ancestor, document, animations,
    setInline(rect) { inline = rect; }, setFull(rect) { full = rect; }, setVisual(rect) { visual = rect; },
  };
}

test('expands the same card using transform and holds the background inert until return', async () => {
  const f = fixture();
  const enter = f.motion.expand();
  assert.equal(f.motion.phase, 'expanding');
  assert.equal(f.motion.active, true);
  assert.equal(f.motion.expand(), enter, 'duplicate expand shares the active promise');
  assert.equal(f.player.classList.contains('is-expanded'), true);
  assert.equal(f.root.classList.contains('is-presenting'), true);
  assert.equal(f.composer.inert, true);
  assert.equal(f.ancestor.inert, false, 'player ancestors are never made inert');
  assert.equal(f.document.activeElement, f.player);
  assert.deepEqual(f.animations[0].frames, [
    { transform: 'translate(300px, 180px) scale(0.5, 0.4666666666666667)' },
    { transform: 'none' },
  ]);
  assert.equal(f.animations[0].options.duration, 900);
  assert.equal(f.player.style.transformOrigin, '0 0');
  f.animations[0].finish();
  assert.equal(await enter, true);
  assert.equal(f.motion.phase, 'expanded');
  assert.equal(f.player.style.willChange, '');
  assert.equal(f.composer.inert, true);
  assert.equal(await f.motion.expand(), true);
  assert.equal(f.animations.length, 1);
});

test('collapse re-measures the current reply destination and restores focus and prior inert states', async () => {
  const f = fixture();
  const enter = f.motion.expand(); f.animations[0].finish(); await enter;
  f.setInline({ left: 180, top: 90, width: 800, height: 480 });
  const exit = f.motion.collapse();
  assert.equal(f.motion.phase, 'collapsing');
  assert.equal(f.motion.collapse(), exit);
  assert.equal(f.root.classList.contains('is-presenting'), false, 'chat fades in while the player returns');
  assert.equal(f.player.classList.contains('is-expanded'), true);
  assert.equal(f.composer.inert, true, 'controls stay inert until the animation finishes');
  assert.deepEqual(f.animations[1].frames[1], { transform: 'translate(180px, 90px) scale(0.5714285714285714, 0.5333333333333333)' });
  assert.equal(f.animations[1].options.duration, 650);
  f.animations[1].finish();
  assert.equal(await exit, true);
  assert.equal(f.motion.phase, 'inline');
  assert.equal(f.motion.active, false);
  assert.equal(f.player.classList.contains('is-expanded'), false);
  assert.equal(f.composer.inert, false);
  assert.equal(f.sidebar.inert, true, 'pre-existing inert is preserved');
  assert.equal(f.document.activeElement, f.composer);
});

test('mid-expansion collapse uses the visible rectangle and stale callbacks cannot complete the new transition', async () => {
  const f = fixture();
  const enter = f.motion.expand();
  const oldFinish = f.animations[0].onfinish;
  f.setVisual({ left: 120, top: 80, width: 1000, height: 650 });
  const exit = f.motion.collapse();
  assert.equal(await enter, false);
  assert.equal(f.animations[0].canceled, true);
  assert.deepEqual(f.animations[1].frames[0], { transform: 'translate(120px, 80px) scale(0.7142857142857143, 0.7222222222222222)' });
  oldFinish();
  assert.equal(f.motion.phase, 'collapsing');
  f.animations[1].finish();
  assert.equal(await exit, true);
  assert.equal(f.motion.phase, 'inline');
});

test('re-expanding during return cancels the old return and does not unlock the background early', async () => {
  const f = fixture();
  const first = f.motion.expand(); f.animations[0].finish(); await first;
  const exit = f.motion.collapse();
  const staleReturn = f.animations[1].onfinish;
  f.setVisual({ left: 160, top: 90, width: 1000, height: 600 });
  const enter = f.motion.expand();
  assert.equal(await exit, false);
  staleReturn();
  assert.equal(f.motion.phase, 'expanding');
  assert.equal(f.composer.inert, true);
  f.animations[2].finish();
  assert.equal(await enter, true);
  assert.equal(f.motion.phase, 'expanded');
  f.motion.reset();
  assert.equal(f.composer.inert, false);
});

test('reset cancels pending animation and immediately restores the original layout and styles', async () => {
  const f = fixture();
  f.player.style.transformOrigin = '50% 25%';
  f.player.style.willChange = 'opacity';
  const enter = f.motion.expand();
  const staleFinish = f.animations[0].onfinish;
  f.motion.reset();
  assert.equal(await enter, false);
  staleFinish();
  assert.equal(f.motion.phase, 'inline');
  assert.equal(f.player.classList.contains('is-expanded'), false);
  assert.equal(f.root.classList.contains('is-presenting'), false);
  assert.equal(f.player.style.transformOrigin, '50% 25%');
  assert.equal(f.player.style.willChange, 'opacity');
  assert.equal(f.composer.inert, false);
  assert.equal(await f.motion.collapse(), true);
});

test('resize settles an entry at fullscreen and a return at inline without leaving awaiters pending', async () => {
  const f = fixture();
  const enter = f.motion.expand();
  f.setFull({ left: 0, top: 0, width: 900, height: 1400 });
  f.motion.refresh();
  assert.equal(await enter, true);
  assert.equal(f.motion.phase, 'expanded');
  const exit = f.motion.collapse();
  f.motion.refresh();
  assert.equal(await exit, true);
  assert.equal(f.motion.phase, 'inline');
  assert.equal(f.composer.inert, false);
});

test('reduced motion and unavailable WAAPI both snap cleanly with the same lifecycle', async () => {
  for (const options of [{ reducedMotion: true }, { animateSupported: false }]) {
    const f = fixture(options);
    assert.equal(await f.motion.expand(), true);
    assert.equal(f.motion.phase, 'expanded');
    assert.equal(f.animations.length, 0);
    assert.equal(f.document.activeElement, f.player);
    assert.equal(await f.motion.collapse(), true);
    assert.equal(f.motion.phase, 'inline');
    assert.equal(f.composer.inert, false);
  }
});

test('invalid geometry and animate failures cannot produce NaN transforms or a stuck transition', async () => {
  const zero = fixture();
  zero.setInline({ left: 0, top: 0, width: 0, height: 0 });
  assert.equal(await zero.motion.expand(), true);
  assert.equal(zero.animations.length, 0);
  assert.equal(zero.motion.phase, 'expanded');
  zero.motion.reset();
  const failed = fixture();
  failed.player.animate = () => { throw new Error('Unavailable rendering context'); };
  assert.equal(await failed.motion.expand(), true);
  assert.equal(failed.motion.phase, 'expanded');
  assert.equal(await failed.motion.collapse(), true);
  assert.equal(failed.motion.phase, 'inline');
});

test('external cancellation settles false and snaps to a coherent endpoint', async () => {
  const f = fixture();
  const enter = f.motion.expand();
  f.animations[0].cancel();
  assert.equal(await enter, false);
  assert.equal(f.motion.phase, 'expanded');
  const exit = f.motion.collapse();
  f.animations[1].cancel();
  assert.equal(await exit, false);
  assert.equal(f.motion.phase, 'inline');
  assert.equal(f.composer.inert, false);
});

test('return does not steal focus from another active control', async () => {
  const f = fixture();
  const enter = f.motion.expand(); f.animations[0].finish(); await enter;
  const dialogControl = {};
  f.document.activeElement = dialogControl;
  const exit = f.motion.collapse(); f.animations[1].finish(); await exit;
  assert.equal(f.document.activeElement, dialogControl);
});
