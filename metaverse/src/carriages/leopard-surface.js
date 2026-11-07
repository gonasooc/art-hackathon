import * as THREE from '../../vendor/three/three.module.js';

const geometryCache=new Map();

// Blend anatomical volumes into one watertight skin, instead of intersecting spheres.
export function leopardSurface(volumes,material,{min,max,step=.035,blend=.075}){
 const key=JSON.stringify({volumes,min,max,step,blend});
 if(geometryCache.has(key))return new THREE.Mesh(geometryCache.get(key),material);
 const nx=Math.ceil((max[0]-min[0])/step),ny=Math.ceil((max[1]-min[1])/step),nz=Math.ceil((max[2]-min[2])/step);
 const at=(x,y,z)=>{
  let distance=100;
  for(const [cx,cy,cz,rx,ry,rz] of volumes){
   const px=(x-cx)/rx,py=(y-cy)/ry,pz=(z-cz)/rz;
   const k0=Math.hypot(px,py,pz),k1=Math.hypot(px/rx,py/ry,pz/rz);
   const d=k1>1e-8?k0*(k0-1)/k1:-Math.min(rx,ry,rz);
   const h=Math.max(blend-Math.abs(distance-d),0)/blend;
   distance=Math.min(distance,d)-h*h*blend*.25;
  }return distance;
 };
 const values=new Float32Array((nx+1)*(ny+1)*(nz+1)),index=(x,y,z)=>(x*(ny+1)+y)*(nz+1)+z;
 for(let x=0;x<=nx;x++)for(let y=0;y<=ny;y++)for(let z=0;z<=nz;z++)values[index(x,y,z)]=at(min[0]+x*step,min[1]+y*step,min[2]+z*step);
 const corners=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
 const tetra=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]],positions=[],normals=[],uv=[];
 const normal=p=>{const e=.002;return new THREE.Vector3(at(p.x+e,p.y,p.z)-at(p.x-e,p.y,p.z),at(p.x,p.y+e,p.z)-at(p.x,p.y-e,p.z),at(p.x,p.y,p.z+e)-at(p.x,p.y,p.z-e)).normalize();};
 const emit=(a,b,c)=>{
  const na=normal(a),nb=normal(b),nc=normal(c),cross=b.clone().sub(a).cross(c.clone().sub(a));
  if(cross.dot(na.clone().add(nb).add(nc))<0){[b,c]=[c,b];[nb.x,nc.x]=[nc.x,nb.x];[nb.y,nc.y]=[nc.y,nb.y];[nb.z,nc.z]=[nc.z,nb.z];}
  for(const [p,n] of [[a,na],[b,nb],[c,nc]]){positions.push(p.x,p.y,p.z);normals.push(n.x,n.y,n.z);uv.push(p.x*.6,(Math.atan2(p.z,p.y-.8)/Math.PI+1)*.5);}
 };
 for(let x=0;x<nx;x++)for(let y=0;y<ny;y++)for(let z=0;z<nz;z++){
  const v=corners.map(([dx,dy,dz])=>values[index(x+dx,y+dy,z+dz)]);if(v.every(n=>n>=0)||v.every(n=>n<0))continue;
  const p=corners.map(([dx,dy,dz])=>new THREE.Vector3(min[0]+(x+dx)*step,min[1]+(y+dy)*step,min[2]+(z+dz)*step));
  const edge=(a,b)=>p[a].clone().lerp(p[b],v[a]/(v[a]-v[b]));
  for(const t of tetra){const inside=t.filter(i=>v[i]<0),outside=t.filter(i=>v[i]>=0);
   if(inside.length===1){const a=inside[0];emit(...outside.map(b=>edge(a,b)));}
   else if(inside.length===3){const a=outside[0];emit(...inside.map(b=>edge(a,b)));}
   else if(inside.length===2){const [a,b]=inside,[c,d]=outside,ac=edge(a,c),ad=edge(a,d),bc=edge(b,c),bd=edge(b,d);emit(ac,ad,bc);emit(ad,bd,bc);}
  }
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.computeBoundingSphere();
 geometryCache.set(key,geometry);return new THREE.Mesh(geometry,material);
}
