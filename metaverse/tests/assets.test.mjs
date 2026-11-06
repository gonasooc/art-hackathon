import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root=new URL('../',import.meta.url);

test('every pinned runtime/model/film asset exists and matches the deployment manifest',async()=>{
  const manifest=JSON.parse(await readFile(new URL('assets/manifest.json',root),'utf8'));
  assert.equal(manifest.three,'0.187.0');assert.equal(manifest.mediapipe,'1.2.2');
  for(const [file,expected] of Object.entries(manifest.files)){
    const buffer=await readFile(new URL(file,root));assert.equal(buffer.length,expected.bytes,file);
    assert.equal(createHash('sha256').update(buffer).digest('hex'),expected.sha256,file);
  }
  for(const name of ['resonance','afterimage']){
    const film=await readFile(new URL(`assets/films/${name}.mp4`,root));
    assert.ok(film.includes(Buffer.from('vide')));assert.ok(film.includes(Buffer.from('soun')),'film must contain a real audio track');
  }
});
