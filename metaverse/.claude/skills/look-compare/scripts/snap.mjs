// Render a carriage in the camera-less visual study mode (?mode=visual) at an exact pose,
// then (with a reference) build a side-by-side composite and value/colour metrics.
//
// The product page exposes no pose input. Like tests/browser/support.mjs, this script swaps
// a module at the network boundary instead: it serves src/visual-inspector.js with one line
// that publishes the inspector instance. Product files are never modified.
import { chromium } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const metaverse = fileURLToPath(new URL('../../../../', import.meta.url));
const repository = fileURLToPath(new URL('../../../../../', import.meta.url));
const posesFile = fileURLToPath(new URL('../poses.json', import.meta.url));
const compareScript = fileURLToPath(new URL('./compare.py', import.meta.url));

const usage = `사용법: node snap.mjs --car 02 [--preset entrance|inspection|exit | --pose "x,y,z,pitch,yaw" | --name <poses.json 항목>]
  [--ref <레퍼런스 이미지>] [--ignore-bottom 0.12] [--size 1280x720] [--fov 48] [--exposure 1] [--tone aces|neutral|agx|none]
  [--out <png>] [--base http://127.0.0.1:5173/metaverse/] [--animate <ms>] [--chrome] [--headed]`;
const flags = new Set(['chrome', 'headed', 'help']);
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const key = process.argv[i].replace(/^--/, '');
  if (!process.argv[i].startsWith('--')) throw new Error(`알 수 없는 인자: ${process.argv[i]}\n${usage}`);
  args[key] = flags.has(key) ? true : process.argv[++i];
}
if (args.help) { console.log(usage); process.exit(0); }

const resolveLocal = file => {
  if (!file) return null;
  if (path.isAbsolute(file) || existsSync(file)) return path.resolve(file);
  return path.join(metaverse, file);
};
const parsePose = text => {
  const values = String(text).replace(/[\[\]\s]/g, '').split(',').filter(Boolean).map(Number);
  if (values.length !== 5 || !values.every(Number.isFinite)) throw new Error(`포즈는 x,y,z,pitch,yaw 다섯 숫자여야 해요: ${text}`);
  return values;
};

let saved = {};
if (args.name) {
  const poses = JSON.parse(await readFile(posesFile, 'utf8'));
  saved = poses[args.name];
  if (!saved) throw new Error(`poses.json에 '${args.name}' 항목이 없어요. 있는 항목: ${Object.keys(poses).join(', ') || '없음'}`);
}
const car = args.car ?? saved.car ?? 'platform';
const pose = args.pose ? parsePose(args.pose) : args.preset ? null : saved.pose ? parsePose(saved.pose.join(',')) : null;
const preset = pose ? null : (args.preset ?? 'inspection');
if (preset && !['entrance', 'inspection', 'exit'].includes(preset)) throw new Error(`알 수 없는 preset: ${preset}`);
const fov = args.fov !== undefined ? Number(args.fov) : saved.fov;
const exposure = args.exposure !== undefined ? Number(args.exposure) : saved.exposure;
const tone = args.tone ?? saved.tone;
const toneNames = { aces: 'ACESFilmicToneMapping', neutral: 'NeutralToneMapping', agx: 'AgXToneMapping', none: 'NoToneMapping' };
if (tone && !toneNames[tone]) throw new Error(`알 수 없는 tone: ${tone}`);
const ref = resolveLocal(args.ref ?? saved.ref);
if (ref && !existsSync(ref)) throw new Error(`레퍼런스 이미지가 없어요: ${ref}\n해당 docs/*-reference.md의 Figma 노드나 영상에서 다시 받아 주세요.`);

// Viewport: explicit --size, otherwise the reference's aspect ratio, otherwise the test default.
let width = 1440, height = 900;
if (args.size) [width, height] = args.size.split('x').map(Number);
else if (ref) {
  try {
    const [w, h] = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', ref], { encoding: 'utf8' }).trim().split('x').map(Number);
    width = Math.min(1600, Math.max(960, w)); height = Math.round(width * h / w);
  } catch { console.warn('ffprobe로 레퍼런스 크기를 읽지 못해 1440x900을 사용해요.'); }
}
if (!(width >= 700 && height >= 480)) throw new Error(`화면이 너무 작아요 (${width}x${height}). 최소 700x480.`);

const label = args.name ?? `${car}-${pose ? 'pose' : preset}`;
const out = resolveLocal(args.out) ?? path.join(metaverse, '.cache/look-compare', `${label}${tone ? `-${tone}` : ''}.png`);
await mkdir(path.dirname(out), { recursive: true });

const source = await readFile(path.join(metaverse, 'src/visual-inspector.js'), 'utf8');
const hook = 'constructor(world){';
if (!source.includes(hook)) throw new Error('src/visual-inspector.js의 constructor(world){ 를 찾지 못해 포즈 연결을 넣을 수 없어요. 스크립트의 hook을 갱신하세요.');

let server = null, browser = null;
try {
  let base = args.base;
  if (!base) {
    const { createStaticServer } = await import(pathToFileURL(path.join(repository, 'server.mjs')).href);
    server = createStaticServer(repository).listen(0, '127.0.0.1');
    await once(server, 'listening');
    base = `http://127.0.0.1:${server.address().port}/metaverse/`;
  }
  browser = await chromium.launch({ headless: !args.headed, args: args.headed ? [] : ['--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/src/visual-inspector.js', route => route.fulfill({
    contentType: 'text/javascript', body: source.replace(hook, `${hook}window.__lookCompare=this;`),
  }));

  await page.goto(`${base}?mode=visual${car === 'platform' ? '' : `&car=${car}`}`);
  await page.waitForFunction(car => {
    const canvas = document.getElementById('world');
    return document.body.dataset.phase === 'visual' && canvas.dataset.assets === 'ready' && window.__lookCompare?.active
      && (car === 'platform' || document.body.dataset.carriage === car);
  }, car, { timeout: 90000 });
  if (args.animate) await page.waitForTimeout(Number(args.animate));

  const applied = await page.evaluate(async ({ pose, preset, fov, exposure, tone, toneName }) => {
    const inspector = window.__lookCompare, world = inspector.world, camera = world.camera;
    inspector.paused = true; // freeze decorative motion so repeated shots match
    if (pose) { camera.position.set(pose[0], pose[1], pose[2]); inspector.pitch = pose[3]; inspector.yaw = pose[4]; inspector.orient(); }
    else inspector.view(preset);
    if (fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
    if (exposure) inspector.exposure(exposure);
    const THREE = await import('./vendor/three/three.module.js');
    if (tone) world.renderer.toneMapping = THREE[toneName];
    world.needsRender = true;
    const toneMapping = Object.keys(THREE).find(key => key.endsWith('ToneMapping') && THREE[key] === world.renderer.toneMapping);
    return { pose: JSON.parse(world.canvas.dataset.visualPose), fov: camera.fov, exposure: world.renderer.toneMappingExposure, toneMapping };
  }, { pose, preset, fov, exposure, tone, toneName: toneNames[tone] });

  if (!args.chrome) await page.addStyleTag({ content: '.masthead, main, .colophon { visibility: hidden !important; }' });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForTimeout(400);
  await page.screenshot({ path: out });

  console.log(JSON.stringify({
    out: path.relative(process.cwd(), out), car, view: pose ? 'pose' : preset, ...applied,
    viewport: `${width}x${height}`, renderer: args.headed ? 'gpu (headed)' : 'swiftshader (headless)',
    ref: ref ? path.relative(process.cwd(), ref) : null, errors,
  }, null, 2));
  if (errors.length) console.warn(`⚠ 페이지 오류 ${errors.length}건 — 렌더를 믿기 전에 확인하세요.`);
  const ignoreBottom = args['ignore-bottom'] ?? saved.ignoreBottom;
  if (ref) execFileSync('python3', [compareScript, ref, out, ...(ignoreBottom ? ['--ignore-bottom', String(ignoreBottom)] : [])], { stdio: 'inherit' });
} finally {
  await browser?.close();
  if (server) { server.closeAllConnections?.(); server.close(); }
}
