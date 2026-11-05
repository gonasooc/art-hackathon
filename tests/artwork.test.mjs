import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { scenes, sceneAt, DURATION, progressAt } from '../src/timeline.js';
import { materials, resultOrder, imageSources } from '../src/resources.js';
import { portfolio } from '../src/portfolio-data.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('one continuous sequence leads from waiting through process to five individual results', () => {
  assert.equal(scenes[0].type, 'wait');
  assert.equal(scenes[0].start, 0);
  for (let i = 0; i < scenes.length; i++) {
    assert.ok(scenes[i].end > scenes[i].start);
    if (i > 0) assert.equal(scenes[i - 1].end, scenes[i].start, `gap at ${scenes[i].id}`);
    assert.equal(sceneAt(scenes[i].start).id, scenes[i].id);
  }
  assert.equal(scenes.at(-1).end, DURATION);
  const results = scenes.filter(s => s.type === 'result');
  assert.deepEqual(results.map(s => s.material), resultOrder);
  assert.equal(new Set(results.map(s => s.material)).size, 5);
  assert.ok(results[0].start >= 25 && results[0].start <= 35);
  for (const result of results) {
    assert.ok(scenes.some(s => s.type === 'process' && s.material === result.material && s.start < result.start));
  }
  assert.equal(sceneAt(DURATION).type, 'credits');
  assert.equal(sceneAt(-5).type, 'wait');
  assert.equal(progressAt(100, scenes[0]), 1);
});

test('all visual assets exist and each sample pair has a distinct study and result', async () => {
  assert.equal(Object.values(materials).filter(m => m.kind === 'real').length, 1);
  assert.equal(Object.values(materials).filter(m => m.kind === 'sample').length, 4);
  for (const src of imageSources) await access(path.join(root, src));
  for (const id of ['stage', 'paint', 'fashion']) {
    const m = materials[id];
    assert.notEqual(m.study, m.image);
    assert.ok(m.provenance.includes('가상'));
    for (const src of [m.study, m.image]) {
      const svg = await readFile(path.join(root, src), 'utf8');
      assert.match(svg, /<svg\b/);
      assert.doesNotMatch(svg, /<script\b|https?:\/\/(?!www\.w3\.org)/);
    }
  }
});

test('real code excerpts and portfolio image are byte-faithful to the selected original', async t => {
  const source = '/Users/gonasooc/Desktop/gonasoo.dev/repositories/my_portfolio';
  try { await access(source); } catch { t.skip('Original repository unavailable on this machine'); return; }
  for (const fragment of portfolio.fragments) {
    const original = (await readFile(path.join(source, fragment.file), 'utf8')).split(/\r?\n/);
    const count = fragment.text.split('\n').length;
    assert.equal(original.slice(fragment.startLine - 1, fragment.startLine - 1 + count).join('\n'), fragment.text);
  }
  assert.deepEqual(await readFile(path.join(root, portfolio.image)), await readFile(path.join(source, 'images/mockup/my_mockup.png')));
  assert.match(portfolio.provenance, /수정 이력은 사용하지/);
});

test('standalone deliverable embeds its code, styles and art without a server', async () => {
  const html = await readFile(path.join(root, 'dist/딸깍.html'), 'utf8');
  assert.doesNotMatch(html, /<script\b[^>]*\bsrc=|<link\b[^>]*rel="stylesheet"|['"]\.?\/public\/assets\//);
  assert.match(html, /data:image\/png;base64,/);
  assert.match(html, /data:image\/svg\+xml;base64,/);
  assert.match(html, /<script type="module">/);
  assert.doesNotMatch(html, /^import .+ from /m);
});

test('the viewer enters through a familiar chat composer without exhibition tool labels', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /id="prompt-input"[^>]*>딸깍으로 만들어줘<\/textarea>/);
  assert.match(html, /id="composer-form"/);
  assert.match(html, /id="conversation"/);
  assert.match(html, /id="chat-stop-button"/);
  assert.doesNotMatch(html, /id="(?:chapters-button|about-button)"|<footer class="chat-footer"/);
});
