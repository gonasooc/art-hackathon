import * as THREE from '../../vendor/three/three.module.js';
import {mergeGeometries} from '../../vendor/three/addons/utils/BufferGeometryUtils.js';
import {GLTFLoader} from '../../vendor/three/addons/loaders/GLTFLoader.js';
import {TRAIN} from '../config.js';
import {buildForestSnow} from './forest.js';

const label=node=>node.userData.name||node.name;
// Real Blender geometry, with only an axis conversion and a clear walking lane.
export function buildForestGLTFCarriage(){
 const group=new THREE.Group();group.name='forest-blender-05';
 const transform=new THREE.Group();transform.rotation.y=Math.PI/2;transform.position.set(-7,TRAIN.floorY-.13,TRAIN.centerZ);group.add(transform);
 const moss=new THREE.Group(),tree=new THREE.Group();
 const snow=buildForestSnow();group.add(snow.base);
 const targets=[
  {id:'05-moss',group:moss,position:[0,0,0],aim:[-8.08,TRAIN.floorY+.72,TRAIN.centerZ+1.36]},
  snow.target,
  {id:'05-tree',group:tree,position:[0,0,0],aim:[-10.65,TRAIN.floorY+2,TRAIN.centerZ+1.6]},
 ];
 const spec={group,targets,loaded:false,load:null};
 let loading;
 spec.load=()=>loading||(loading=new GLTFLoader().loadAsync(new URL('../../assets/models/forest.glb',import.meta.url).href).then(gltf=>{
  const model=gltf.scene;model.name='blender-forest-model';transform.add(model);
  const island=new THREE.Group();island.name='forest-island-clearance';island.position.x=-1.65;island.scale.x=.55;model.add(island);
  const islandParts=[];let mossNode,treeNode;
  model.traverse(node=>{
   const name=label(node);
   if(/^Granite (ascent|crown|monolith)/.test(name)||/^MOSS |^MAIN BONSAI |^SMALL PINE /.test(name)&&!node.isMesh)islandParts.push(node);
   if(name==='MOSS | root and rock crack patches'){mossNode=node;islandParts.push(node);}
   if(name==='MAIN BONSAI | layered mountain pine')treeNode=node;
  });
  for(const node of new Set(islandParts))island.add(node);
  if(!mossNode||!treeNode)throw new Error('Forest GLB is missing moss or main bonsai nodes');
  const correctedMaterials=new Set();
  model.traverse(mesh=>{
   if(!mesh.isMesh)return;
   const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
   if(!mesh.geometry.attributes.uv&&materials.some(m=>m.map||m.normalMap||m.roughnessMap)){
    const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal,uv=[];
    for(let i=0;i<p.count;i++){
     const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i)),nz=Math.abs(n.getZ(i));
     uv.push((nx>ny&&nx>nz?p.getZ(i):p.getX(i))*.5,(ny>nx&&ny>nz?p.getZ(i):p.getY(i))*.5);
    }
    mesh.geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
   }
   for(const material of materials){
    if(correctedMaterials.has(material))continue;correctedMaterials.add(material);
    // These Blender procedural colors were not baked into glTF (default white).
    if(!material.map&&material.color.r===1&&material.color.g===1&&material.color.b===1){
      if(/bark/i.test(material.name))material.color.setHex(0x68564a);
      else if(/bronze|brass/i.test(material.name))material.color.setHex(0x9b8050);
      else if(/pine litter/i.test(material.name))material.color.setHex(0x59624c);
      else if(/granite/i.test(material.name))material.color.setHex(0x96978b);
    }

    if(/pine needles/i.test(material.name)){material.sheen=0;material.roughness=.9;}
    if(material.normalMap)material.normalScale.set(.35,.35);
    material.envMapIntensity=.35;
    // Keep Blender's physical glass/water, without a second full-scene render pass.
    if(material.transmission>0){material.transmission=0;material.transparent=true;material.opacity=/water/i.test(material.name)?.35:.08;material.depthWrite=false;}
   }
   mesh.castShadow=false;mesh.receiveShadow=false;
  });
  group.updateMatrixWorld(true);
  // Attach real imported nodes with their final world transforms preserved.
  moss.attach(mossNode);tree.attach(treeNode);
  for(const root of [moss,tree])root.traverse(mesh=>{
   if(!mesh.isMesh)return;
   const convert=m=>{const next=new THREE.MeshStandardMaterial();THREE.MeshStandardMaterial.prototype.copy.call(next,m);return next;};
   mesh.material=Array.isArray(mesh.material)?mesh.material.map(convert):convert(mesh.material);
  });
  // Aim at an actual moss patch near the observation point rather than empty bounds.
  let best=Infinity;
  mossNode.traverse(mesh=>{
   if(!mesh.isMesh)return;mesh.updateMatrixWorld(true);
   const geometry=mesh.geometry,p=geometry.attributes.position,index=geometry.index;
   const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),v=new THREE.Vector3();
   const count=index?index.count:p.count;
   for(let i=0;i<count;i+=3){
    a.fromBufferAttribute(p,index?index.getX(i):i);b.fromBufferAttribute(p,index?index.getX(i+1):i+1);c.fromBufferAttribute(p,index?index.getX(i+2):i+2);
    v.copy(a).add(b).add(c).multiplyScalar(1/3).applyMatrix4(mesh.matrixWorld);
    const score=(v.x+8.1)**2+(v.y-(TRAIN.floorY+1))**2+(v.z-(TRAIN.centerZ+1.2))**2;
    if(score<best){best=score;targets[0].aim=v.toArray();}
   }
  });
  // Repeated GLB meshes share one vertex buffer and per-instance transforms.
  model.updateMatrixWorld(true);
  const inverse=model.matrixWorld.clone().invert(),buckets=new Map(),staticMeshes=[],repeated=new Map();
  model.traverse(mesh=>{if(mesh.isMesh)staticMeshes.push(mesh);});
  spec.sourceMeshCount=staticMeshes.length;
  const originals=new Set(staticMeshes.map(m=>m.geometry));
  for(const mesh of staticMeshes){
    if(Array.isArray(mesh.material))continue;
    const key=mesh.geometry.uuid+':'+mesh.material.uuid;
    if(!repeated.has(key))repeated.set(key,[]);repeated.get(key).push(mesh);
  }
  let instanceBatches=0,instanceCount=0;
  for(const meshes of repeated.values()){
    if(meshes.length>1&&!meshes[0].material.transparent){
      const batch=new THREE.InstancedMesh(meshes[0].geometry,meshes[0].material,meshes.length);
      batch.name='blender-instances-'+meshes[0].material.name;
      batch.userData.sourceNodes=meshes.map(label);
      meshes.forEach((mesh,i)=>{batch.setMatrixAt(i,new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld));mesh.removeFromParent();});
      batch.instanceMatrix.needsUpdate=true;batch.computeBoundingBox();batch.computeBoundingSphere();model.add(batch);
      instanceBatches++;instanceCount+=meshes.length;continue;
    }
    for(const mesh of meshes){
      const geometry=mesh.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld));
      if(!geometry.attributes.uv)geometry.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count*2),2));
      for(const key of Object.keys(geometry.attributes))if(!['position','normal','uv'].includes(key))geometry.deleteAttribute(key);
      if(!geometry.attributes.normal)geometry.computeVertexNormals();
      const key=mesh.material.uuid+Boolean(geometry.index);
      if(!buckets.has(key))buckets.set(key,{material:mesh.material,geometries:[],names:[]});
      buckets.get(key).geometries.push(geometry);buckets.get(key).names.push(label(mesh));mesh.removeFromParent();
    }
  }
  for(const {material,geometries,names} of buckets.values()){
    const merged=mergeGeometries(geometries,false);if(!merged)throw new Error('Forest static mesh merge failed');
    const mesh=new THREE.Mesh(merged,material);mesh.name='blender-static-'+material.name;mesh.userData.sourceNodes=names;model.add(mesh);
    for(const geometry of geometries)geometry.dispose();
  }
  const retained=new Set();for(const root of [model,moss,tree])root.traverse(n=>{if(n.isMesh)retained.add(n.geometry);});
  for(const geometry of originals)if(!retained.has(geometry))geometry.dispose();
  spec.staticBatches=buckets.size;spec.instanceBatches=instanceBatches;spec.instanceCount=instanceCount;
  spec.source=gltf.asset;group.userData.model='forest.glb';
  spec.loaded=true;return spec;
 }));
 return spec;
}
