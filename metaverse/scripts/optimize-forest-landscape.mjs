// Reduce only the repeated distant Blender pines. No architecture/target changes.
import {readFile,writeFile} from 'node:fs/promises';
import {MeshoptSimplifier} from '../node_modules/three/examples/jsm/libs/meshopt_simplifier.module.js';
const file=new URL('../assets/models/forest.glb',import.meta.url),raw=await readFile(file);
const jsonLength=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+jsonLength)),offset=20+jsonLength;
const binary=raw.subarray(offset+8,offset+8+raw.readUInt32LE(offset));const chunks=[binary];let length=binary.length;
function array(id){const a=doc.accessors[id],v=doc.bufferViews[a.bufferView],count=a.count*(a.type==='VEC3'?3:1),start=v.byteOffset+(a.byteOffset||0);const C={5123:Uint16Array,5125:Uint32Array,5126:Float32Array}[a.componentType];if(v.byteStride)throw new Error('Interleaved accessor unsupported');return new C(binary.buffer,binary.byteOffset+start,count);}
if(doc.asset.extras?.forestLandscapeLOD)throw new Error('Already optimized; regenerate with prepare-forest-glb.py first');
await MeshoptSimplifier.ready;
const meshIds=new Set(doc.nodes.filter(n=>n.name?.startsWith('LANDSCAPE | mountain pine')).map(n=>n.mesh));let before=0,after=0;
for(const id of meshIds)for(const primitive of doc.meshes[id].primitives){
 const indices=array(primitive.indices),positions=array(primitive.attributes.POSITION);before+=indices.length/3;
 const target=Math.max(36,Math.floor(indices.length*.025/3)*3);
 const [simplified]=MeshoptSimplifier.simplifySloppy(indices,positions,3,null,Math.min(target,indices.length),.08);after+=simplified.length/3;
 const data=Buffer.from(new Uint32Array(simplified).buffer),pad=(4-length%4)%4;if(pad){chunks.push(Buffer.alloc(pad));length+=pad;}
 const bufferView=doc.bufferViews.length;doc.bufferViews.push({buffer:0,byteOffset:length,byteLength:data.length,target:34963});chunks.push(data);length+=data.length;
 primitive.indices=doc.accessors.length;doc.accessors.push({bufferView,componentType:5125,count:simplified.length,type:'SCALAR'});
}
doc.asset.extras={...doc.asset.extras,forestLandscapeLOD:true};
doc.buffers[0].byteLength=length;let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const bin=Buffer.concat([...chunks,Buffer.alloc((4-length%4)%4)]);
const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+bin.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);
await writeFile(file,Buffer.concat([header,json,bh,bin]));console.log({meshes:meshIds.size,before,after,bytes:28+json.length+bin.length});
