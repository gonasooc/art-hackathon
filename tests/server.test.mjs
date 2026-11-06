import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createStaticServer } from '../server.mjs';

test('static projects work at sibling paths and the GitHub Pages prefix', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'art-hackathon-server-'));
  const root = path.join(directory, 'site');
  await mkdir(root);
  const files = {
    'index.html': '<a href="./chatgpt/">ChatGPT</a>',
    'chatgpt/index.html': '<link rel="stylesheet" href="./styles.css">ChatGPT',
    'chatgpt/styles.css': 'body { color: black; }',
    'chatgpt/src/app.js': 'export const ready = true;',
    'chatgpt/public/assets/image.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>',
    'example/index.html': '<script type="module" src="./app.js"></script>Example',
    'example/app.js': 'export const project = "example";',
    'example/data.json': '{"ready":true}',
    'example/assets/font.woff2': 'font fixture',
    'metaverse/index.html': '<script src="./src/app.js" type="module"></script>',
    'metaverse/assets/model.task': 'model fixture',
    'metaverse/vendor/vision.wasm': 'wasm fixture',
    'metaverse/line.glb': 'glb fixture',
    'example/empty/readme.md': 'No index here',
    '.env': 'SECRET=hidden',
    '.git/config': 'private',
    'server.mjs': 'private server code',
    'package.json': '{"private":true}',
    'chatgpt/package.json': '{"private":true}',
    'chatgpt/scripts/private.js': 'private script',
    'chatgpt/tests/private.js': 'private test',
    'example/private/secret.json': '{"secret":true}',
  };
  for (const [name, contents] of Object.entries(files)) {
    const file = path.join(root, name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, contents);
  }
  await writeFile(path.join(directory, 'outside.html'), 'outside root');
  await symlink(path.join(directory, 'outside.html'), path.join(root, 'example', 'outside.html'));

  const server = createStaticServer(root);
  t.after(async () => {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await rm(directory, { recursive: true, force: true });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  // http.request preserves malicious path segments that fetch would normalize.
  const request = (requestPath, method = 'GET', headers = {}) => new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path: requestPath, method, headers }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });

  for (const prefix of ['', '/art-hackathon']) {
    for (const file of ['index.html', 'chatgpt/index.html', 'chatgpt/styles.css', 'chatgpt/src/app.js', 'chatgpt/public/assets/image.svg', 'example/index.html', 'example/app.js', 'example/data.json', 'example/assets/font.woff2']) {
      const response = await request(`${prefix}/${file}`);
      assert.equal(response.status, 200, `${prefix}/${file}`);
      assert.equal(response.body, files[file]);
      assert.equal(response.headers['x-content-type-options'], 'nosniff');
    }
    for (const project of ['chatgpt', 'example']) {
      const redirect = await request(`${prefix}/${project}?view=preview`);
      assert.equal(redirect.status, 301);
      assert.equal(redirect.headers.location, `${prefix}/${project}/?view=preview`);
      assert.equal((await request(`${prefix}/${project}/`)).body, files[`${project}/index.html`]);
    }
    assert.equal((await request(`${prefix}/`)).body, files['index.html']);
    assert.match((await request(`${prefix}/chatgpt/styles.css`)).headers['content-type'], /^text\/css/);
    assert.match((await request(`${prefix}/chatgpt/src/app.js`)).headers['content-type'], /^text\/javascript/);
    const head = await request(`${prefix}/example/`, 'HEAD');
    assert.equal(head.status, 200);
    assert.equal(head.body, '');
    assert.equal(Number(head.headers['content-length']), Buffer.byteLength(files['example/index.html']));
    const range = await request(`${prefix}/example/app.js`, 'GET', { Range: 'bytes=7-11' });
    assert.equal(range.status, 206);
    assert.equal(range.body, files['example/app.js'].slice(7, 12));
    assert.equal(range.headers['content-range'], `bytes 7-11/${Buffer.byteLength(files['example/app.js'])}`);
    const suffix = await request(`${prefix}/example/app.js`, 'GET', { Range: 'bytes=-4' });
    assert.equal(suffix.body, files['example/app.js'].slice(-4));
    for (const invalid of ['bytes=99999-', 'bytes=9-2', 'bytes=-0', 'bytes=-', 'bytes=0-1,3-4']) {
      assert.equal((await request(`${prefix}/example/app.js`, 'GET', { Range: invalid })).status, 416);
    }
    for (const [file, mime] of [['assets/model.task', 'application/octet-stream'], ['vendor/vision.wasm', 'application/wasm'], ['line.glb', 'model/gltf-binary']]) {
      const asset = await request(`${prefix}/metaverse/${file}`);
      assert.equal(asset.status, 200);
      assert.equal(asset.headers['content-type'], mime);
    }

    for (const blocked of ['.env', '.git/config', 'server.mjs', 'package.json', 'chatgpt/package.json', 'chatgpt/scripts/private.js', 'chatgpt/tests/private.js', 'example/private/secret.json', 'example/outside.html', 'example/empty/', 'missing/', 'chatgpt/missing.js', 'chatgpt/../package.json', 'chatgpt/%2e%2e/package.json', 'chatgpt/%5c../package.json', '%E0%A4%A']) {
      assert.equal((await request(`${prefix}/${blocked}`)).status, 404, `${prefix}/${blocked}`);
    }
  }
  const rootRedirect = await request('/art-hackathon?view=preview');
  assert.equal(rootRedirect.status, 301);
  assert.equal(rootRedirect.headers.location, '/art-hackathon/?view=preview');
  assert.equal((await request('/chatgpt/', 'POST')).status, 405);
});
