// Render carriages in the camera-less inspection mode (?mode=inspect&car=NN) at a fixed view and
// compare each render with its reference image (side-by-side composite + value/colour metrics).
// `--all` runs every entry of poses.json in one go; reference frames are pulled from the source
// videos automatically, Figma-only references must already be saved at their `ref` path.
//
// The product page exposes no pose input. Like tests/browser/support.mjs, this script swaps
// src/visual-inspector.js at the network boundary so the inspector instance is reachable.
// Product files are never modified.
import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const metaverse = fileURLToPath(new URL('../../../../', import.meta.url));
const repository = fileURLToPath(new URL('../../../../../', import.meta.url));
const manifestFile = fileURLToPath(new URL('../poses.json', import.meta.url));
const compareScript = fileURLToPath(new URL('./compare.py', import.meta.url));
const outDir = path.join(metaverse, '.cache/look-compare');

const usage = `사용법
  전체 칸    node snap.mjs --all [--cars 01,05]      레퍼런스 상태만: --check
  목록 항목  node snap.mjs --name 05-frame-1
  직접 지정  node snap.mjs --car 05 [--preset entrance|inspection|exit | --pose "x,y,z,pitch,yaw"] [--ref <이미지>]
옵션        --ignore-bottom 0.12  --size 1280x720  --fov 48  --exposure 1  --tone aces|neutral|agx|none
            --out <png>  --base http://127.0.0.1:5173/art-hackathon/metaverse/  --animate <ms>  --chrome  --headed`;

const flags = new Set(['all', 'check', 'chrome', 'headed', 'help']);
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (!arg.startsWith('--')) throw new Error(`알 수 없는 인자: ${arg}\n${usage}`);
  const key = arg.slice(2);
  args[key] = flags.has(key) ? true : process.argv[++i];
}
if (args.help) { console.log(usage); process.exit(0); }

const resolveLocal = file => {
  if (!file) return null;
  file = String(file).replace(/^~(?=$|\/)/, os.homedir());
  if (path.isAbsolute(file) || existsSync(file)) return path.resolve(file);
  return path.join(metaverse, file);
};
const shown = file => path.relative(process.cwd(), file) || file;
const parsePose = text => {
  const values = String(text).replace(/[\[\]\s]/g, '').split(',').filter(Boolean).map(Number);
  if (values.length !== 5 || !values.every(Number.isFinite)) throw new Error(`포즈는 x,y,z,pitch,yaw 다섯 숫자여야 해요: ${text}`);
  return values;
};
const toneNames = { aces: 'ACESFilmicToneMapping', neutral: 'NeutralToneMapping', agx: 'AgXToneMapping', none: 'NoToneMapping' };

// One shot = one carriage view and its reference. CLI flags (`given`) override the saved entry.
function shotFrom(name, saved, given = {}) {
  const pick = key => given[key] ?? saved[key];
  const car = String(pick('car') ?? 'platform');
  const pose = given.pose ? parsePose(given.pose) : given.preset ? null : saved.pose ? parsePose(saved.pose.join(',')) : null;
  const preset = pose ? null : (given.preset ?? saved.preset ?? 'inspection');
  if (preset && !['entrance', 'inspection', 'exit'].includes(preset)) throw new Error(`알 수 없는 preset: ${preset}`);
  const tone = pick('tone');
  if (tone && !toneNames[tone]) throw new Error(`알 수 없는 tone: ${tone}`);
  const fov = pick('fov'), exposure = pick('exposure');
  return {
    name: name ?? `${car}-${pose ? 'pose' : preset}`, car, pose, preset, tone,
    fov: fov === undefined ? undefined : Number(fov), exposure: exposure === undefined ? undefined : Number(exposure),
    ref: resolveLocal(pick('ref')), source: saved.source, figma: saved.figma, note: saved.note,
    ignoreBottom: Number(given['ignore-bottom'] ?? saved.ignoreBottom ?? 0),
  };
}

const sourceVideo = shot => shot.source?.video ? resolveLocal(shot.source.video) : null;
// 'ok' | 'extract' (take the frame from the source video) | 'missing' | 'none' (no reference set)
function refState(shot) {
  if (!shot.ref) return 'none';
  const video = sourceVideo(shot);
  if (video && existsSync(video) && (!existsSync(shot.ref) || statSync(video).mtimeMs > statSync(shot.ref).mtimeMs)) return 'extract';
  return existsSync(shot.ref) ? 'ok' : 'missing';
}
function missingHint(shot) {
  const hints = [];
  if (shot.figma) hints.push(`Figma 노드 ${shot.figma} 이미지를 ${shown(shot.ref)}에 저장하세요`);
  if (shot.source?.video) hints.push(`영상이 없어요: ${shown(sourceVideo(shot))}`);
  return `레퍼런스 없음 — ${hints.join(' / ') || shown(shot.ref)}`;
}
function prepareRef(shot) {
  const state = refState(shot);
  if (state !== 'extract') return { state, message: state === 'missing' ? missingHint(shot) : null };
  const video = sourceVideo(shot), seconds = String(shot.source.t ?? 1);
  mkdirSync(path.dirname(shot.ref), { recursive: true });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', seconds, '-i', video, '-frames:v', '1', shot.ref]);
  return { state, message: `${path.basename(video)} ${seconds}초 프레임을 뽑았어요` };
}

// compare.py needs PIL; the first python3 on PATH may not have it.
function findPython() {
  const candidates = [process.env.LOOK_COMPARE_PYTHON, 'python3'];
  try { candidates.push(...execFileSync('which', ['-a', 'python3'], { encoding: 'utf8' }).split('\n')); } catch {}
  for (const candidate of new Set(candidates.filter(Boolean))) {
    try { execFileSync(candidate, ['-c', 'import PIL'], { stdio: 'ignore' }); return candidate; } catch {}
  }
  return null;
}

// Viewport: explicit --size, otherwise the reference's aspect ratio, otherwise the test default.
function viewportFor(ref) {
  let width = 1440, height = 900;
  if (args.size) [width, height] = String(args.size).split('x').map(Number);
  else if (ref) {
    try {
      const [w, h] = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', ref], { encoding: 'utf8' }).trim().split('x').map(Number);
      width = Math.min(1600, Math.max(960, w)); height = Math.round(width * h / w);
    } catch { console.warn('ffprobe로 레퍼런스 크기를 읽지 못해 1440x900을 사용해요.'); }
  }
  if (!(width >= 700 && height >= 480)) throw new Error(`화면이 너무 작아요 (${width}x${height}). 최소 700x480.`);
  return { width, height };
}

const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
const batch = Boolean(args.all || args.cars || (args.check && !args.name && !args.car));
let shots;
if (batch) {
  const cars = args.cars ? new Set(String(args.cars).split(',').map(car => car.trim()).filter(Boolean)) : null;
  const shared = Object.fromEntries(['fov', 'exposure', 'tone'].filter(key => args[key] !== undefined).map(key => [key, args[key]]));
  shots = Object.entries(manifest).filter(([, saved]) => !cars || cars.has(String(saved.car))).map(([name, saved]) => shotFrom(name, saved, shared));
  if (!shots.length) throw new Error(`poses.json에 ${args.cars} 칸 항목이 없어요. 있는 칸: ${[...new Set(Object.values(manifest).map(saved => saved.car))].join(', ')}`);
} else if (args.name) {
  const saved = manifest[args.name];
  if (!saved) throw new Error(`poses.json에 '${args.name}' 항목이 없어요. 있는 항목: ${Object.keys(manifest).join(', ') || '없음'}`);
  shots = [shotFrom(args.name, saved, args)];
} else shots = [shotFrom(null, {}, args)];

if (args.check) {
  const labels = { ok: '있음', extract: '영상에서 추출', missing: '없음', none: '지정 안 됨' };
  for (const shot of shots) {
    const state = refState(shot);
    const detail = state === 'missing' ? missingHint(shot)
      : state === 'extract' ? `${path.basename(sourceVideo(shot))} ${shot.source.t ?? 1}초 → ${shown(shot.ref)}`
      : shot.ref ? shown(shot.ref) : '';
    console.log(`${shot.name}  [${shot.car}]  ${labels[state]}  ${detail}`);
  }
  process.exit(0);
}
if (!batch && refState(shots[0]) === 'missing') {
  throw new Error(`${missingHint(shots[0])}\n해당 docs/*-reference.md의 Figma 노드나 영상에서 다시 받아 주세요.`);
}

const needsCompare = shots.some(shot => ['ok', 'extract'].includes(refState(shot)));
const python = needsCompare ? findPython() : null;
if (needsCompare && !python) throw new Error('PIL이 있는 python3를 찾지 못했어요. `python3 -m pip install pillow` 후 다시 실행하거나 LOOK_COMPARE_PYTHON에 경로를 지정하세요.');

const hook = 'constructor(world){';
const inspectorSource = await readFile(path.join(metaverse, 'src/visual-inspector.js'), 'utf8');
if (!inspectorSource.includes(hook)) throw new Error('src/visual-inspector.js에서 constructor(world){ 를 찾지 못해 포즈 연결을 넣을 수 없어요. 스크립트의 hook을 갱신하세요.');

async function shoot(browser, base, shot, viewport, out) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  try {
    await page.route('**/src/visual-inspector.js', route => route.fulfill({
      contentType: 'text/javascript', body: inspectorSource.replace(hook, `${hook}window.__lookCompare=this;`),
    }));
    await page.goto(`${base}?mode=inspect${shot.car === 'platform' ? '' : `&car=${shot.car}`}`);
    try {
      await page.waitForFunction(car => {
        const canvas = document.getElementById('world');
        return document.body.dataset.phase === 'visual' && canvas.dataset.assets === 'ready' && window.__lookCompare?.active
          && (car === 'platform' ? !document.body.dataset.carriage : document.body.dataset.carriage === car);
      }, shot.car, { timeout: 90000 });
    } catch {
      throw new Error(`칸 '${shot.car}'을 수동 점검 모드로 열지 못했어요(90초). 구현된 칸인지 확인하세요. ${errors[0] ?? ''}`.trim());
    }
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
    }, { pose: shot.pose, preset: shot.preset, fov: shot.fov, exposure: shot.exposure, tone: shot.tone, toneName: toneNames[shot.tone] });

    if (!args.chrome) await page.addStyleTag({ content: 'body * { visibility: hidden !important; } #world { visibility: visible !important; }' });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.waitForTimeout(400);
    await page.screenshot({ path: out });
    return { ...applied, errors };
  } finally {
    await page.close();
  }
}

function compare(shot, out) {
  const jsonOut = out.replace(/\.png$/, '-metrics.json');
  const argv = [compareScript, shot.ref, out, '--json', jsonOut];
  if (shot.ignoreBottom) argv.push('--ignore-bottom', String(shot.ignoreBottom));
  if (batch) argv.push('--quiet');
  execFileSync(python, argv, { stdio: batch ? 'pipe' : 'inherit' });
  return JSON.parse(readFileSync(jsonOut, 'utf8'));
}

const summaryKeys = ['mean', 'contrast', 'shadows', 'highlights', 'saturation', 'warmth'];
const digits = value => typeof value === 'number' ? (Math.abs(value) < 1 ? value.toFixed(2) : value.toFixed(0)) : '-';
function printRow(row) {
  const head = `[${row.name}] ${row.car} · ${row.view}`;
  if (row.error) return console.log(`${head} · 실패: ${row.error}`);
  if (!row.composite) return console.log(`${head} · ${row.refMessage ?? '레퍼런스 없음'}\n    렌더만: ${row.out}${row.errors?.length ? `  · ⚠ 페이지 오류 ${row.errors.length}건` : ''}`);
  const { ref, render } = row.metrics;
  console.log(`${head} · ${row.composite}${row.refMessage ? ` (${row.refMessage})` : ''}`);
  console.log(`    ${summaryKeys.map(key => `${key} ${digits(ref[key])}→${digits(render[key])}`).join('  ')}`);
  console.log(`    open: ${row.open.length ? row.open.join(', ') : '없음'}${row.aspectMatch ? '' : '  · 비율 다름'}${row.errors.length ? `  · ⚠ 페이지 오류 ${row.errors.length}건` : ''}`);
}

await mkdir(outDir, { recursive: true });
const renderer = args.headed ? 'gpu (headed)' : 'swiftshader (headless)';
const rows = [];
let server = null, browser = null;
try {
  let base = args.base;
  if (!base) {
    const { createStaticServer } = await import(pathToFileURL(path.join(repository, 'server.mjs')).href);
    server = createStaticServer(repository).listen(0, '127.0.0.1');
    await once(server, 'listening');
    base = `http://127.0.0.1:${server.address().port}/art-hackathon/metaverse/`;
  }
  browser = await chromium.launch({ headless: !args.headed, args: args.headed ? [] : ['--enable-unsafe-swiftshader'] });
  for (const shot of shots) {
    const row = { name: shot.name, car: shot.car, view: shot.pose ? 'pose' : shot.preset, ref: shot.ref ? shown(shot.ref) : null, figma: shot.figma ?? null, note: shot.note ?? null };
    try {
      const { state, message } = prepareRef(shot);
      row.refState = state;
      if (message) row.refMessage = message;
      const hasRef = state === 'ok' || state === 'extract';
      const viewport = viewportFor(hasRef ? shot.ref : null);
      const out = !batch && args.out ? resolveLocal(args.out) : path.join(outDir, `${shot.name}${shot.tone ? `-${shot.tone}` : ''}.png`);
      await mkdir(path.dirname(out), { recursive: true });
      Object.assign(row, { out: shown(out), viewport: `${viewport.width}x${viewport.height}` }, await shoot(browser, base, shot, viewport, out));
      if (!batch) {
        console.log(JSON.stringify({ ...row, renderer }, null, 2));
        if (row.errors.length) console.warn(`⚠ 페이지 오류 ${row.errors.length}건 — 렌더를 믿기 전에 확인하세요.`);
      }
      if (hasRef) {
        const result = compare(shot, out);
        Object.assign(row, {
          composite: shown(result.composite), open: result.open, aspectMatch: result.aspect.match,
          metrics: Object.fromEntries(['ref', 'render'].map(side => [side, Object.fromEntries(summaryKeys.map(key => [key, result.metrics[side][key]]))])),
        });
      }
    } catch (error) {
      if (!batch) throw error;
      row.error = String(error.message).split('\n')[0];
    }
    rows.push(row);
    if (batch) printRow(row);
  }
} finally {
  await browser?.close();
  if (server) { server.closeAllConnections?.(); server.close(); }
}

if (batch) {
  const summaryFile = path.join(outDir, 'summary.json');
  await writeFile(summaryFile, JSON.stringify({ generated: new Date().toISOString(), renderer, rows }, null, 1));
  const missing = rows.filter(row => row.refState === 'missing'), failed = rows.filter(row => row.error);
  console.log(`\n비교 ${rows.filter(row => row.composite).length}건 · 레퍼런스 없음 ${missing.length}건 · 실패 ${failed.length}건 · 요약 ${shown(summaryFile)}`);
  if (missing.length) console.log(`레퍼런스 없음: ${missing.map(row => `${row.name}${row.figma ? ` (Figma ${row.figma})` : ''}`).join(', ')}`);
  if (failed.length) process.exitCode = 1;
}
