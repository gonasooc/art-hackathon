export const CONTENT_DELAY = 2.2;
export const DURATION = 67.2;
// Presentation timing. These are playback seconds, never historical work hours.
export const scenes = [
  { id: 'waiting', start: 0, end: 3, type: 'wait', label: '딸깍' },
  { id: 'reveal', start: 3, end: 4, type: 'reveal', label: '화면이 열리는 시간' },
  // Preserve the original audiovisual edit, moving it after the longer entry.
  ...[
  { id: 'stage-first', start: 1.8, end: 5.2, type: 'process', material: 'stage', pass: 0, label: '쓰고, 지우고' },
  { id: 'paint-first', start: 5.2, end: 8.6, type: 'process', material: 'paint', pass: 0, label: '다시 그리는 선' },
  { id: 'code-first', start: 8.6, end: 11.8, type: 'process', material: 'code', pass: 0, label: '한 줄을 읽는 시간' },
  { id: 'music-first', start: 11.8, end: 14.8, type: 'process', material: 'music', pass: 0, label: '멈춘 구절' },
  { id: 'fashion-first', start: 14.8, end: 17.7, type: 'process', material: 'fashion', pass: 0, label: '선을 고르는 일' },
  { id: 'stage-second', start: 17.7, end: 20.2, type: 'process', material: 'stage', pass: 1, label: '다른 문장으로' },
  { id: 'paint-second', start: 20.2, end: 22.5, type: 'process', material: 'paint', pass: 1, label: '겹쳐 남은 색' },
  { id: 'code-second', start: 22.5, end: 24.7, type: 'process', material: 'code', pass: 1, label: '다시 읽는 한 줄' },
  { id: 'music-second', start: 24.7, end: 26.4, type: 'process', material: 'music', pass: 1, label: '다시, 같은 구절' },
  { id: 'fashion-second', start: 26.4, end: 28, type: 'process', material: 'fashion', pass: 1, label: '겹치는 윤곽' },
  { id: 'echoes', start: 28, end: 30.5, type: 'echoes', label: '서로의 잔상' },
  { id: 'breath', start: 30.5, end: 32, type: 'breath', label: '남아 있는 호흡' },
  { id: 'stage-final', start: 32, end: 38, type: 'result', material: 'stage', label: '결과 01 · 공간 작품 샘플' },
  { id: 'code-final', start: 38, end: 44, type: 'result', material: 'code', label: '결과 02 · gonasooc' },
  { id: 'music-final', start: 44, end: 52, type: 'result', material: 'music', label: '결과 03 · 돌아오는 음' },
  { id: 'paint-final', start: 52, end: 58, type: 'result', material: 'paint', label: '결과 04 · 겹의 자리' },
  { id: 'fashion-final', start: 58, end: 65, type: 'result', material: 'fashion', label: '결과 05 · 몸을 따라 남은 선' },
  ].map(scene => ({
    ...scene,
    start: Number((scene.start + CONTENT_DELAY).toFixed(3)),
    end: Number((scene.end + CONTENT_DELAY).toFixed(3)),
  })),
];
export function sceneAt(time) {
  const t = Math.max(0, Number(time) || 0);
  return scenes.find(scene => t >= scene.start && t < scene.end) || { id: 'credits', type: 'credits', start: DURATION, end: Infinity, label: '크레딧' };
}
export function progressAt(time, scene = sceneAt(time)) {
  return Math.max(0, Math.min(1, (time - scene.start) / (scene.end - scene.start)));
}
export function formatTime(time) {
  const seconds = Math.max(0, Math.floor(Number(time) || 0));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
