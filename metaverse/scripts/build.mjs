import { mkdir, copyFile, readFile, writeFile, access, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const copies=[
  ['node_modules/three/build/three.module.js','vendor/three/three.module.js'],
  ['node_modules/three/build/three.core.js','vendor/three/three.core.js'],
  ['node_modules/three/LICENSE','vendor/three/LICENSE.txt'],
  ['node_modules/@mediapipe/tasks-vision/vision_bundle.js','vendor/vision/vision_bundle.js'],
  ['node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.js','vendor/vision/wasm/vision_wasm_internal.js'],
  ['node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm','vendor/vision/wasm/vision_wasm_internal.wasm'],
];
for (const [source,destination] of copies) {
  await mkdir(path.dirname(path.join(root,destination)),{recursive:true});
  await copyFile(path.join(root,source),path.join(root,destination));
}
const assets=['assets/models/face_landmarker.task','assets/films/resonance.mp4','assets/films/afterimage.mp4','assets/films/ready.mp4','assets/train/membrane.png','assets/train/ground.png'];
const manifest={three:'0.187.0',mediapipe:'1.2.2',files:{}};
for (const file of [...copies.map(c=>c[1]),...assets]) {
  await access(path.join(root,file));
  const data=await readFile(path.join(root,file));
  if (!(await stat(path.join(root,file))).size) throw new Error(`Empty asset: ${file}`);
  manifest.files[file]={bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')};
}
await writeFile(path.join(root,'assets/manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Metaverse static assets prepared. Publish metaverse/ at /art-hackathon/metaverse/.');
