import { portfolio } from './portfolio-data.js';
import { sampleArt } from './sample-art.js';

// Replace a study/final pair together so a fragment really returns in its result.
// The original portfolio folder is never served or modified by this application.
export const materials = {
  stage: { ...sampleArt.stage, medium: 'SPATIAL STUDY', credit: '공간 기획 · 가상 샘플', description: '다섯 빛의 면이 공간에 놓이기까지', image: sampleArt.stage.final },
  code: { ...portfolio, medium: 'WEB PORTFOLIO', credit: 'gonasooc · 실제 소스와 기존 목업', description: '현재 소스의 발췌와 화면 재생 연출' },
  music: { id: 'music', title: '돌아오는 음', kind: 'sample', medium: 'SOUND STUDY', credit: '음악 · 가상 샘플', description: '끊겼던 네 음이 한 구절로 돌아온다', provenance: '시제품을 위해 작곡한 네 음의 합성 음악. 실제 밴드의 녹음이 아닙니다.' },
  paint: { ...sampleArt.paint, medium: 'PAINTING STUDY', credit: '회화 · 가상 샘플', description: '여러 번 덧그린 붉은 호', image: sampleArt.paint.final },
  fashion: { ...sampleArt.fashion, medium: 'GARMENT STUDY', credit: '패션 · 가상 샘플', description: '평면의 재단선이 청회색 천의 접힘으로 남는 과정', image: sampleArt.fashion.final },
};
export const resultOrder = ['stage', 'code', 'music', 'paint', 'fashion'];
export const imageSources = [...new Set(Object.values(materials).flatMap(m => [m.study, m.image].filter(Boolean)))];
