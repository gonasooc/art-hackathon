// Remove vertices not referenced by the web LOD, and discard obsolete GLB buffers.
// Preserves every rendered triangle, vertex attribute, material and node transform.
import {readFile,writeFile} from 'node:fs/promises';
const file=new URL('../assets/models/forest.glb',import.meta.url),raw=await readFile(file);
const size=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+size)),start=20+size;
if(doc.animations?.length||doc.skins?.length)throw new Error('This static forest compactor does not support animation or skinning');
const bin=raw.subarray(start+8,start+8+raw.readUInt32LE(start));
const types={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array},components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
function attribute(id){const a=doc.accessors[id],v=doc.bufferViews[a.bufferView],C=types[a.componentType],n=components[a.type];if(!C||!n||a.sparse)throw new Error('Unsupported accessor');
 const output=new C(a.count*n),offset=(v.byteOffset||0)+(a.byteOffset||0),stride=v.byteStride||n*C.BYTES_PER_ELEMENT;
 for(let i=0;i<a.count;i++)new Uint8Array(output.buffer,i*n*C.BYTES_PER_ELEMENT,n*C.BYTES_PER_ELEMENT).set(bin.subarray(offset+i*stride,offset+i*stride+n*C.BYTES_PER_ELEMENT));return output;
}
const views=[],accessors=[],chunks=[];let length=0,oldVertices=0,newVertices=0;
function append(data,target){const pad=(4-length%4)%4;if(pad){chunks.push(Buffer.alloc(pad));length+=pad;}const index=views.length;views.push({buffer:0,byteOffset:length,byteLength:data.length,...(target?{target}:{})});chunks.push(data);length+=data.length;return index;}
const oldMeshes=structuredClone(doc.meshes),cache=new Map();
for(const [m,mesh] of doc.meshes.entries())for(const [p,primitive] of mesh.primitives.entries()){
 const original=oldMeshes[m].primitives[p];if(original.targets)throw new Error('Morph targets unsupported');
 const key=JSON.stringify([original.indices,original.attributes]);
 if(cache.has(key)){Object.assign(primitive,structuredClone(cache.get(key)));continue;}
 const vertexCount=doc.accessors[original.attributes.POSITION].count;
 const indices=original.indices===undefined?Uint32Array.from({length:vertexCount},(_,i)=>i):attribute(original.indices);
 const used=[...new Set(indices)].sort((a,b)=>a-b),map=new Map(used.map((v,i)=>[v,i]));oldVertices+=vertexCount;newVertices+=used.length;
 const remapped=used.length<=65535?new Uint16Array(indices.length):new Uint32Array(indices.length);for(let i=0;i<indices.length;i++)remapped[i]=map.get(indices[i]);
 const newIndices=accessors.length;accessors.push({bufferView:append(Buffer.from(remapped.buffer),34963),componentType:remapped.BYTES_PER_ELEMENT===2?5123:5125,count:remapped.length,type:'SCALAR'});
 const attributes={};
 for(const [semantic,id] of Object.entries(original.attributes)){
  const a=doc.accessors[id],source=attribute(id),n=components[a.type],out=new source.constructor(used.length*n);
  for(let i=0;i<used.length;i++)out.set(source.subarray(used[i]*n,used[i]*n+n),i*n);
  const next={...a,bufferView:append(Buffer.from(out.buffer),34962),byteOffset:0,count:used.length};delete next.min;delete next.max;
  if(semantic==='POSITION'){next.min=[Infinity,Infinity,Infinity];next.max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<out.length;i++) {const axis=i%3;next.min[axis]=Math.min(next.min[axis],out[i]);next.max[axis]=Math.max(next.max[axis],out[i]);}}
  attributes[semantic]=accessors.length;accessors.push(next);
 }
 primitive.indices=newIndices;primitive.attributes=attributes;cache.set(key,{indices:newIndices,attributes});
}
for(const image of doc.images||[]){const v=doc.bufferViews[image.bufferView];image.bufferView=append(Buffer.from(bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength)));}
doc.accessors=accessors;doc.bufferViews=views;doc.buffers=[{byteLength:length}];doc.asset.extras={...doc.asset.extras,forestVerticesCompacted:true};
let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const binary=Buffer.concat([...chunks,Buffer.alloc((4-length%4)%4)]),header=Buffer.alloc(20),bh=Buffer.alloc(8);
header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);bh.writeUInt32LE(binary.length);bh.writeUInt32LE(0x004e4942,4);
await writeFile(file,Buffer.concat([header,json,bh,binary]));console.log({beforeBytes:raw.length,afterBytes:28+json.length+binary.length,oldVertices,newVertices});
