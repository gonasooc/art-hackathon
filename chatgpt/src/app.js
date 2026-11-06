import { scenes, DURATION, sceneAt, progressAt, formatTime } from './timeline.js';
import { materials, resultOrder, imageSources } from './resources.js';
import { Soundtrack, audioEvents, musicMotif } from './audio.js';
import { PresentationMotion } from './presentation.js';
import { typedLengthAt } from './typing.js';

const $ = selector => document.querySelector(selector);
const app = $('#app');
const stage = $('#stage');
const audio = new Soundtrack();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const presentation = new PresentationMotion({
  player: $('#player'), root: app, reducedMotion,
  backgroundElements: [$('#chat-sidebar'), $('.chat-topbar'), $('#composer-form'), $('#user-message'), $('#chat-thinking'), $('.chat-assistant-mark')],
});
const DEFAULT_PROMPT = '딸깍으로 만들어줘';
const state = { mode: 'home', playing: false, time: 0, origin: 0, sceneId: '', scene: null, raf: 0, muted: false, starting: false, finishing: false, presentationDismissed: false, prompt: DEFAULT_PROMPT };
let updateScene = () => {};
let noticeTimer;
let audioNotified = false;
let dialogResume = false;
let startGeneration = 0;
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (n, low = 0, high = 1) => Math.max(low, Math.min(high, n));
const ease = n => 1 - (1 - clamp(n)) ** 3;

// Preload local assets before a scene needs them; there are no remote assets.
const imageReady = Promise.all(imageSources.map(src => new Promise(resolve => {
  const image = new Image(); image.onload = () => resolve(true); image.onerror = () => resolve(false); image.src = src;
})));

function notify(message) {
  const notice = $('#notice');
  notice.textContent = message; notice.hidden = false;
  clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { notice.hidden = true; }, 4000);
}

function setMode(mode) {
  state.mode = mode; app.dataset.mode = mode;
  $('#home').hidden = mode !== 'home';
  $('#conversation').hidden = mode === 'home';
  $('#player').hidden = mode !== 'player';
  $('#credits').hidden = mode !== 'credits';
  $('#user-message').textContent = state.prompt;
  if (mode === 'home' || mode === 'credits') $('#chat-content').scrollTop = 0;
  syncChatStatus();
}

function syncChatStatus() {
  const busy = state.mode === 'player' && (state.playing || state.starting);
  $('#start-button').hidden = busy;
  $('#chat-stop-button').hidden = !busy;
  $('#start-button').disabled = state.starting || state.finishing || !String($('#prompt-input').value || '').trim();
  const phase = state.mode === 'credits' || state.finishing ? 'complete' : !busy ? 'paused' : state.scene?.type === 'result' ? 'results' : 'thinking';
  const label = { complete: '완료', paused: '응답 일시정지됨', results: '결과를 정리하는 중', thinking: '생각 중' }[phase];
  $('#chat-thinking').dataset.state = phase;
  if ($('#thinking-label').textContent !== label) $('#thinking-label').textContent = label;
}

function resizeComposer() {
  const input = $('#prompt-input');
  input.style.height = 'auto';
  input.style.height = `${Math.min(140, Math.max(24, input.scrollHeight || 24))}px`;
  syncChatStatus();
}

async function submitPrompt(event) {
  event.preventDefault();
  const prompt = String($('#prompt-input').value || '').trim();
  if (!prompt || state.starting || state.playing || state.finishing) return;
  // Snapshot text as textContent: it never becomes markup or a network request.
  state.prompt = prompt;
  presentation.reset();
  state.presentationDismissed = false;
  state.sceneId = '';
  state.time = 0;
  $('#prompt-input').value = '';
  setMode('player');
  renderAt(0);
  $('#chat-content').scrollTop = 0;
  closeSidebar();
  resizeComposer();
  await playFrom(0);
}

function setPlayButton() {
  $('#play-button').setAttribute('aria-label', state.playing ? '일시정지' : '재생');
  $('#play-glyph').textContent = state.playing ? 'Ⅱ' : '▷';
  app.dataset.playing = String(state.playing);
  syncChatStatus();
}

function cancelPendingStart() {
  startGeneration += 1;
  state.starting = false;
  syncChatStatus();
}

function pause() {
  cancelPendingStart();
  if (!state.playing) { syncChatStatus(); return; }
  state.time = clamp((performance.now() - state.origin) / 1000, 0, DURATION);
  state.playing = false;
  cancelAnimationFrame(state.raf); audio.pause();
  setPlayButton(); renderAt(state.time);
}

async function playFrom(seconds = 0) {
  if (state.starting) return;
  if (state.finishing || seconds === 0) {
    presentation.reset();
    state.finishing = false;
    app.dataset.returning = 'false';
    state.presentationDismissed = false;
  }
  const generation = ++startGeneration;
  state.starting = true;
  syncChatStatus();
  try {
    const unlocked = await audio.unlock();
    if (generation !== startGeneration || document.hidden || document.querySelector('dialog[open]')) return;
    if (!unlocked && !audioNotified) { notify('오디오를 사용할 수 없어 화면으로 재생합니다.'); audioNotified = true; }
    // Local images are normally ready already; a failed image must not lock playback.
    await Promise.race([imageReady, new Promise(resolve => setTimeout(resolve, 1500))]);
    if (generation !== startGeneration || document.hidden || document.querySelector('dialog[open]')) return;
    cancelAnimationFrame(state.raf);
    state.time = clamp(seconds, 0, DURATION);
    if (state.time >= DURATION) { finish(); return; }
    setMode('player');
    state.playing = true;
    state.origin = performance.now() - state.time * 1000;
    audio.start(state.time); audio.setMuted(state.muted);
    setPlayButton(); renderAt(state.time);
    state.raf = requestAnimationFrame(tick);
  } finally { if (generation === startGeneration) { state.starting = false; syncChatStatus(); } }
}

function tick(now) {
  if (!state.playing) return;
  state.time = clamp((now - state.origin) / 1000, 0, DURATION);
  if (state.time >= DURATION) { finish(); return; }
  renderAt(state.time);
  state.raf = requestAnimationFrame(tick);
}

async function finish() {
  if (state.finishing || state.mode === 'credits') return;
  cancelPendingStart();
  const generation = startGeneration;
  cancelAnimationFrame(state.raf); state.playing = false; state.time = DURATION;
  state.finishing = true;
  app.dataset.returning = 'true';
  audio.stop(); setPlayButton();
  // Keep the last image on screen while it returns to its original reply.
  const returned = await presentation.collapse();
  if (!returned || generation !== startGeneration || !state.finishing) return;
  state.finishing = false;
  app.dataset.returning = 'false';
  setMode('credits');
  $('#scene-live').textContent = '다섯 결과물의 재생이 끝났습니다. 크레딧과 자료 출처를 확인할 수 있습니다.';
  $('#replay-button').focus({ preventScroll: true });
}

function goHome() {
  cancelPendingStart();
  presentation.reset();
  state.finishing = false;
  state.presentationDismissed = false;
  app.dataset.returning = 'false';
  cancelAnimationFrame(state.raf); state.playing = false; state.time = 0;
  audio.stop(); state.sceneId = ''; state.scene = null; state.prompt = DEFAULT_PROMPT; stage.replaceChildren();
  $('#prompt-input').value = DEFAULT_PROMPT;
  $('#explore-panel').hidden = true;
  $('#explore-button').setAttribute('aria-expanded', 'false');
  setPlayButton(); setMode('home'); resizeComposer(); closeSidebar();
  $('#prompt-input').focus({ preventScroll: true });
}

function seek(seconds) {
  const next = clamp(Number(seconds) || 0, 0, DURATION);
  if (next >= DURATION) { finish(); return; }
  if (state.finishing) {
    cancelPendingStart();
    presentation.reset();
    state.finishing = false;
    app.dataset.returning = 'false';
  }
  state.time = next;
  state.origin = performance.now() - next * 1000;
  audio.seek(next);
  renderAt(next);
}

function renderAt(time) {
  const scene = sceneAt(time);
  if (scene.type === 'credits') { finish(); return; }
  if (scene.id !== state.sceneId) {
    state.sceneId = scene.id; state.scene = scene;
    stage.dataset.scene = scene.id;
    stage.dataset.material = scene.material || '';
    stage.dataset.phase = scene.type;
    buildScene(scene);
    $('#scene-live').textContent = scene.type === 'result' ? `완성작 ${resultOrder.indexOf(scene.material) + 1}. ${materials[scene.material].title}` : scene.label;
    $('#phase-label').textContent = scene.type === 'result' ? '남은 것들' : scene.type === 'wait' ? '잠시만요' : '그 사이의 시간';
    $('#result-count').textContent = scene.type === 'result' ? `${String(resultOrder.indexOf(scene.material) + 1).padStart(2, '0')} / 05` : '';
    $('#player').dataset.surface = scene.material === 'music' || (scene.material === 'code' && scene.type === 'process') || (scene.material === 'stage' && scene.type === 'result') ? 'dark' : 'light';
    $('#player').dataset.phase = scene.type;
    syncChatStatus();
  }
  updateScene(progressAt(time, scene), time);
  $('#current-time').textContent = formatTime(time);
  $('#seek').value = time.toFixed(2);
  $('#seek').setAttribute('aria-valuetext', `${Math.floor(time)}초, 전체 ${DURATION}초`);
  $('#seek-fill').style.width = `${time / DURATION * 100}%`;
  stage.dataset.time = time.toFixed(2);
  if (!state.finishing && scene.type === 'wait' && presentation.active) {
    presentation.collapse();
  } else if (!state.finishing && state.playing && !state.presentationDismissed && scene.type !== 'wait' && (!presentation.active || presentation.phase === 'collapsing')) {
    presentation.expand();
  }
}

function surface(html, extra = '') { return `<div class="work-surface ${extra}">${html}</div>`; }
function image(src, cls, alt = '') { return `<img src="${esc(src)}" class="${cls}" alt="${esc(alt)}" draggable="false">`; }

function buildScene(scene) {
  // Keep only one short-lived visual echo, so long sessions cannot accumulate DOM.
  stage.querySelectorAll('.scene-exit').forEach(node => node.remove());
  const previous = stage.querySelector('.scene');
  if (previous) {
    previous.classList.remove('scene-enter'); previous.classList.add('scene-exit');
    setTimeout(() => previous.remove(), reducedMotion ? 0 : 560);
  }
  const node = document.createElement('div');
  node.className = `scene scene-enter ${scene.type} ${scene.material ? `${scene.material}-${scene.type}` : ''}`;
  stage.append(node); updateScene = () => {};

  if (scene.type === 'wait') {
    node.innerHTML = '<div class="waiting"><span></span><span></span><span></span></div>'; return;
  }
  if (scene.type === 'reveal') {
    node.innerHTML = surface(`<div class="opening-sheet">${image(materials.stage.study, 'study-sheet')}</div>`, 'opening-composition');
    return;
  }
  if (scene.type === 'breath') {
    node.innerHTML = '<div class="afterimage"><span>그 사이에</span><span>남은 것들.</span></div>';
    updateScene = p => { node.style.opacity = String(1 - p * .8); }; return;
  }
  if (scene.type === 'echoes') {
    node.innerHTML = surface(`<div class="echo-strip">${image(materials.paint.study, '')}${image(materials.stage.study, '')}${image(materials.fashion.study, '')}</div>`, 'echo-composition');
    updateScene = p => { node.querySelector('.echo-strip').style.opacity = String(.9 - p * .4); }; return;
  }
  if (scene.type === 'result') { buildResult(node, scene); return; }
  if (scene.material === 'stage') buildWriting(node, scene);
  if (scene.material === 'paint') buildDrawing(node, scene);
  if (scene.material === 'fashion') buildDrawing(node, scene);
  if (scene.material === 'code') buildCode(node, scene);
  if (scene.material === 'music') buildMusic(node, scene);
}

function sceneNote(kind, phrase) {
  return `<div class="material-note"><span>${kind}</span><span>${phrase}</span></div>`;
}

function buildWriting(node, scene) {
  node.innerHTML = surface(`${sceneNote('공간', '빛이 머무는 자리')}<div class="spatial-sheet">${image(materials.stage.study, 'study-sheet')}</div><div class="revision-text"><span class="revision-prefix">빛이</span><div class="revision-word"></div><span class="revision-suffix">자리</span></div><div class="working-note">${scene.pass ? '남겨 둔 간격' : '지나가는 것과 머무는 것 사이'}</div>`, 'spatial-composition');
  const word = node.querySelector('.revision-word');
  const sheet = node.querySelector('.spatial-sheet');
  let lastPhase = '';
  updateScene = p => {
    const phase = scene.pass ? 'resolved' : p < .34 ? 'first' : p < .63 ? 'erased' : 'revised';
    if (phase !== lastPhase) {
      const erased = phase !== 'first';
      word.innerHTML = `<span class="earlier-word${erased ? ' is-erased' : ''}">지나가는</span>${phase === 'revised' || phase === 'resolved' ? '<span class="later-word">머무는</span>' : ''}`;
      lastPhase = phase;
    }
    sheet.style.transform = reducedMotion ? 'none' : `translate3d(${(1 - ease(p)) * 12}px,0,0)`;
    sheet.style.opacity = String(.62 + ease(p) * .38);
  };
}

function buildDrawing(node, scene) {
  const material = materials[scene.material];
  const painting = scene.material === 'paint';
  node.innerHTML = surface(`${sceneNote(painting ? '회화' : '의복', scene.pass ? '다시, 같은 자리' : '남겨진 선')}<div class="study-fragment">${image(material.study, 'study-image')}</div><div class="material-layer">${image(material.study, 'under-drawing')}${image(material.image, 'over-drawing')}</div><div class="working-note">${painting ? '지운 뒤에도 남는 것' : '평면이 몸을 기억하는 방식'}</div>`, `material-composition ${painting ? 'pigment-composition' : 'cloth-composition'}`);
  const over = node.querySelector('.over-drawing');
  const under = node.querySelector('.under-drawing');
  const fragment = node.querySelector('.study-fragment');
  updateScene = p => {
    // Layers share their geometry: revision is visible as accumulated material,
    // not an imitation tool drawing over a finished image.
    const amount = scene.pass ? .36 + ease(p) * .64 : ease(p) * .62;
    over.style.opacity = String(reducedMotion ? (p < .5 ? .35 : .85) : amount);
    under.style.opacity = String(1 - amount * .7);
    over.style.transform = reducedMotion ? 'none' : `translate3d(${(1 - amount) * (painting ? 8 : -6)}px,${(1 - amount) * 4}px,0)`;
    fragment.style.opacity = String(.5 + (1 - amount) * .36);
  };
}

function buildCode(node, scene) {
  const fragment = materials.code.fragments[scene.pass ? 1 : 2];
  const code = fragment.text.split('\n').map(line => line.replace(/^ {4}/, '')).join('\n');
  const lines = code.split('\n');
  const manuscript = lines.map((line, i) => `<div class="code-row"><span class="code-line-number">${fragment.startLine + i}</span><div class="code-line-layers"><pre class="code-imprint">${esc(line || ' ')}</pre><pre class="code-text"></pre></div></div>`).join('');
  node.innerHTML = surface(`${sceneNote('코드', fragment.file)}<div class="code-manuscript">${manuscript}</div><div class="working-note">한 줄을 쓰고, 다시 읽는 시간</div>`, 'code-composition');
  const rows = [...node.querySelectorAll('.code-text')];
  let lastLength = -1;
  updateScene = (_p, time) => {
    const length = typedLengthAt(scene, time, code.length);
    if (length === lastLength) return;
    lastLength = length;
    let offset = 0;
    rows.forEach((pre, i) => {
      const line = lines[i];
      const visible = Math.max(0, Math.min(line.length, length - offset));
      const cursor = length >= offset && length <= offset + line.length;
      const markup = esc(line.slice(0, visible)) + (cursor ? '<span class="code-caret"></span>' : '');
      if (pre.innerHTML !== markup) pre.innerHTML = markup;
      offset += line.length + 1;
    });
  };
}

function buildMusic(node, scene) {
  const final = scene.type === 'result';
  node.classList.add(final ? 'music-result' : 'music-process');
  node.innerHTML = surface(`${sceneNote('소리', final ? '네 음의 잔향' : '멈춘 구절')}<div class="resonance-field"><canvas class="resonance-canvas" width="1600" height="800"></canvas></div><div class="score-notes"><span>D</span><span>A</span><span>F</span><span>G</span></div><div class="working-note">${final ? '돌아오는 음' : '소리가 멎은 자리에도'}</div>`, 'sound-composition');
  const canvas = node.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const notes = [...node.querySelectorAll('.score-notes > span')];
  const score = audioEvents.filter(e => e.type === 'pluck' && e.sceneId === scene.id);
  updateScene = (_p, time) => {
    const active = score.filter(e => time >= e.at && time < e.at + e.duration);
    const latest = active.at(-1);
    const noteIndex = latest ? musicMotif.findIndex(f => f === latest.frequency) : -1;
    notes.forEach((note, i) => note.classList.toggle('on', i === noteIndex));
    if (!ctx) return;
    const voices = active.map(event => ({
      age: time - event.at,
      amplitude: Math.exp(-(time - event.at) * 2.2),
      frequency: event.frequency / musicMotif[0],
    }));
    ctx.clearRect(0, 0, 1600, 800);
    // An engraving of the same four-note score; every movement follows a note's
    // onset and decay. Pausing or seeking therefore also freezes or seeks it.
    for (let strand = 0; strand < 56; strand++) {
      const band = strand / 55;
      ctx.beginPath();
      ctx.strokeStyle = strand === 28 ? '#b19476' : '#b5bdb4';
      ctx.globalAlpha = strand === 28 ? .85 : .28 + Math.sin(band * Math.PI) * .32;
      ctx.lineWidth = strand === 28 ? 1.35 : .8;
      for (let x = 0; x <= 1400; x += 6) {
        const u = x / 1400;
        const edge = Math.sin(u * Math.PI) ** 1.6;
        let vibration = 0;
        for (const voice of voices) {
          vibration += Math.sin(u * Math.PI * 6 * voice.frequency + band * 5 - (reducedMotion ? 0 : voice.age * 2.4)) * voice.amplitude;
        }
        const arch = Math.sin(u * Math.PI * 2.2 + band * 1.7) * 55;
        const y = 213 + band * 330 + edge * (arch + vibration * (reducedMotion ? 0 : 48));
        x === 0 ? ctx.moveTo(x + 100, y) : ctx.lineTo(x + 100, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };
}

function buildResult(node, scene) {
  const material = materials[scene.material];
  node.classList.add('result');
  if (scene.material === 'music') { buildMusic(node, scene); return; }
  const number = String(resultOrder.indexOf(scene.material) + 1).padStart(2, '0');
  node.innerHTML = surface(`<div class="result-plate">${image(material.image, 'result-art', material.title)}</div><div class="result-caption"><span class="result-index">${number}</span><span class="result-title">${esc(material.title)}</span><span class="result-medium">${esc(material.medium)}</span></div>`, 'result-composition');
  const art = node.querySelector('.result-art');
  updateScene = p => {
    if (!reducedMotion) art.style.transform = `scale(${1.012 - ease(p) * .012})`;
  };
}

$('#credits-list').innerHTML = resultOrder.map((id, i) => {
  const m = materials[id];
  return `<div class="credit-row"><span class="credit-number">0${i + 1}</span><div class="credit-name">${esc(m.title)}</div></div>`;
}).join('');

$('#chapter-list').innerHTML = scenes.map(scene => `<button class="chapter-button ${scene.type === 'result' ? 'is-result' : ''}" data-time="${scene.start}"><time>${formatTime(scene.start)}</time><span>${esc(scene.type === 'result' ? materials[scene.material].title : scene.label)}</span><span aria-hidden="true">↗</span></button>`).join('');

function openDialog(dialog) {
  if (state.finishing) return;
  dialogResume = state.playing;
  pause();
  dialog.showModal();
}
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => {
    const rect = dialog.getBoundingClientRect();
    if (e.target === dialog && (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom)) dialog.close();
  });
  dialog.addEventListener('close', () => { const resume = dialogResume; dialogResume = false; if (resume && state.mode === 'player') playFrom(state.time); });
});
// Review tools remain keyboard-accessible without adding exhibition chrome.
$('#chapter-list').addEventListener('click', e => {
  const button = e.target.closest('[data-time]'); if (!button) return;
  dialogResume = false; $('#chapters-dialog').close(); playFrom(Number(button.dataset.time));
});
$('#composer-form').addEventListener('submit', submitPrompt);
$('#prompt-input').addEventListener('input', resizeComposer);
$('#prompt-input').addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
    event.preventDefault();
    $('#composer-form').requestSubmit();
  }
});
$('#chat-stop-button').addEventListener('click', pause);
$('#replay-button').addEventListener('click', () => playFrom(0));
$('#restart-button').addEventListener('click', () => playFrom(0));
$('#play-button').addEventListener('click', () => state.playing ? pause() : playFrom(state.time));
$('#back-button').addEventListener('click', goHome);
$('#new-chat-button').addEventListener('click', goHome);
$('#seek').addEventListener('input', e => seek(e.target.value));
$('#sound-button').addEventListener('click', async () => {
  state.muted = !state.muted; audio.setMuted(state.muted);
  $('#sound-button').setAttribute('aria-pressed', String(state.muted));
  $('#sound-button').setAttribute('aria-label', state.muted ? '소리 켜기' : '소리 끄기');
  if (!state.muted && state.playing && !audio.state.running) { if (await audio.unlock()) audio.start(state.time); }
});
$('#fullscreen-button').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (app.requestFullscreen) await app.requestFullscreen();
    else notify('이 브라우저에서는 전체 화면 기능을 지원하지 않습니다.');
  } catch { notify('전체 화면을 열 수 없습니다. 브라우저 창을 확대해 주세요.'); }
});
document.addEventListener('fullscreenchange', () => $('#fullscreen-button').setAttribute('aria-label', document.fullscreenElement ? '전체 화면 나가기' : '전체 화면'));
document.addEventListener('keydown', e => {
  if (e.altKey && e.shiftKey && e.code === 'KeyL') { e.preventDefault(); if (!document.querySelector('dialog[open]')) openDialog($('#chapters-dialog')); return; }
  if (e.altKey && e.shiftKey && e.code === 'KeyI') { e.preventDefault(); if (!document.querySelector('dialog[open]')) openDialog($('#about-dialog')); return; }
  if (e.code === 'Escape' && presentation.active && !state.finishing && !document.querySelector('dialog[open]')) {
    e.preventDefault();
    state.presentationDismissed = true;
    pause();
    presentation.collapse();
    return;
  }
  if (document.querySelector('dialog[open]') || e.target.matches('input,button,a,textarea,select')) return;
  if (e.code === 'Space' && state.mode === 'player') { e.preventDefault(); state.playing ? pause() : playFrom(state.time); }
  if (state.mode === 'player' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) { e.preventDefault(); seek(state.time + (e.code === 'ArrowRight' ? 5 : -5)); }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && !state.finishing) {
    const wasPlaying = state.playing;
    pause();
    if (wasPlaying) notify('다른 창으로 이동해 잠시 멈췄습니다. 재생 버튼으로 이어보세요.');
  }
});
window.addEventListener('pagehide', () => { presentation.reset(); audio.stop(); cancelAnimationFrame(state.raf); });
window.addEventListener('resize', () => presentation.refresh());

function closeSidebar() {
  app.classList.remove('sidebar-open');
  $('#mobile-sidebar-button').setAttribute('aria-expanded', 'false');
}
$('#sidebar-toggle').addEventListener('click', () => {
  if (matchMedia('(max-width: 700px)').matches) { closeSidebar(); return; }
  const collapsed = app.classList.toggle('sidebar-collapsed');
  $('#sidebar-toggle').setAttribute('aria-expanded', String(!collapsed));
  $('#sidebar-toggle').setAttribute('aria-label', collapsed ? '사이드바 펼치기' : '사이드바 접기');
});
$('#mobile-sidebar-button').addEventListener('click', () => {
  if (!matchMedia('(max-width: 700px)').matches) {
    app.classList.remove('sidebar-collapsed');
    $('#sidebar-toggle').setAttribute('aria-expanded', 'true');
    $('#sidebar-toggle').setAttribute('aria-label', '사이드바 접기');
    return;
  }
  const opened = app.classList.toggle('sidebar-open');
  $('#mobile-sidebar-button').setAttribute('aria-expanded', String(opened));
});
$('#sidebar-backdrop').addEventListener('click', closeSidebar);
$('#brand-button').addEventListener('click', () => $('#prompt-input').focus());
$('#attachment-button').addEventListener('click', () => {
  const panel = $('#explore-panel');
  if (state.mode === 'home') { panel.hidden = !panel.hidden; $('#explore-button').setAttribute('aria-expanded', String(!panel.hidden)); }
  else $('#prompt-input').focus();
});
$('#settings-button').addEventListener('click', () => { closeSidebar(); openDialog($('#settings-dialog')); });
$('#mic-button').addEventListener('click', () => openDialog($('#settings-dialog')));
$('#explore-button').addEventListener('click', () => {
  const panel = $('#explore-panel'); panel.hidden = !panel.hidden;
  $('#explore-button').setAttribute('aria-expanded', String(!panel.hidden));
});
document.querySelectorAll('[data-prompt]').forEach(button => button.addEventListener('click', () => {
  $('#prompt-input').value = button.dataset.prompt;
  $('#explore-panel').hidden = true;
  $('#explore-button').setAttribute('aria-expanded', 'false');
  closeSidebar(); resizeComposer(); $('#prompt-input').focus();
}));
document.querySelectorAll('[data-exhibition-info]').forEach(button => button.addEventListener('click', () => { closeSidebar(); $('#prompt-input').focus(); }));
// Browsers may restore the empty, previously submitted textarea on reload.
// A fresh exhibition entry always starts with the intended one-click prompt.
$('#prompt-input').value = DEFAULT_PROMPT;
window.addEventListener('pageshow', event => {
  if (!event.persisted && state.mode === 'home') {
    $('#prompt-input').value = DEFAULT_PROMPT;
    resizeComposer();
  }
});
setPlayButton();
resizeComposer();
$('#seek').max = String(DURATION);
$('.end-time').textContent = formatTime(DURATION);
