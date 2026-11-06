import * as THREE from '../../vendor/three/three.module.js';
import { TRAIN } from '../config.js';
import { box, tube } from '../train-geometry.js';

export const Z = TRAIN.centerZ, F = TRAIN.floorY;
export const mat = (color, roughness = .7, metalness = 0) => new THREE.MeshStandardMaterial({color, roughness, metalness});
export const random = seed => () => {seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296;};
export function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
export function wood(color = 0x926039) {
  const texture = canvasTexture(256, 512, (ctx, w, h) => {
    ctx.fillStyle = '#bca582'; ctx.fillRect(0, 0, w, h); const rng = random(83);
    for (let i = 0; i < 1900; i++) {
      const x = rng() * w, y = rng() * h;
      ctx.strokeStyle = `rgba(${rng() > .4 ? '49,30,17' : '247,222,177'},${.04 + rng() * .16})`;
      ctx.lineWidth = .3 + rng() * 1.1; ctx.beginPath(); ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + 3, y + 30, x - 3, y + 85, x + Math.sin(x) * 3, y + 150); ctx.stroke();
    }
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  const material = mat(color, .44); material.map = texture; material.bumpMap = texture; material.bumpScale = .012;
  return material;
}
export function grain(color, seed = 12) {
  const material = mat(color, .95);
  const texture = canvasTexture(256, 256, (ctx, w, h) => {
    const rng = random(seed), data = ctx.createImageData(w, h);
    for (let i = 0; i < data.data.length; i += 4) {const v = 140 + rng() * 95; data.data.set([v, v, v, 255], i);} ctx.putImageData(data, 0, 0);
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(4, 4);
  material.map = texture; material.bumpMap = texture; material.bumpScale = .018; return material;
}
export function ellipsoid(parent, position, scale, material) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), material);
  mesh.position.set(...position); mesh.scale.set(...scale); parent.add(mesh); return mesh;
}
export function ring(parent, radius, thickness, position, material, rotation = [Math.PI / 2, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, thickness, 12, 48), material);
  mesh.position.set(...position); mesh.rotation.set(...rotation); parent.add(mesh); return mesh;
}
// Rounded rectangles lie in XY. Rotate the containing group for end doors or side windows.
export function frame(parent, width, height, radius, material, thickness = .035) {
  const points = [];
  for (const [x, y, start] of [[width / 2 - radius, height / 2 - radius, 0], [-width / 2 + radius, height / 2 - radius, Math.PI / 2], [-width / 2 + radius, -height / 2 + radius, Math.PI], [width / 2 - radius, -height / 2 + radius, Math.PI * 1.5]]) {
    for (let i = 0; i <= 8; i++) {const a = start + i / 8 * Math.PI / 2; points.push([x + radius * Math.cos(a), y + radius * Math.sin(a), 0]);}
  }
  return tube(parent, points, thickness, material, true);
}
export function sideWindow(parent, x, side, width, height, metal) {
  const window = new THREE.Group(); window.position.set(x, 2.63, Z + side * 1.94); parent.add(window);
  frame(window, width + .13, height + .13, .21, metal, .055); frame(window, width, height, .19, mat(0x362c21), .027);
  // Small rivets belong to the train frame, even in the transformed rooms.
  for (let k = 0; k < 10; k++) for (const y of [-height / 2 - .065, height / 2 + .065]) ellipsoid(window, [-width / 2 + .15 + k * (width - .3) / 9, y, -side * .045], [.014, .014, .014], metal);
  return window;
}
export function ribs(parent, metal, xs = [-1, -4, -7, -10, -13.8]) {
  for (const x of xs) {
    const points = Array.from({length: 33}, (_, i) => {const a = i / 32 * Math.PI; return [x, 3.15 + Math.sin(a) * 1.04, Z + Math.cos(a) * 1.96];});
    tube(parent, points, .035, metal);
  }
}
export function endDoor(parent, woodMaterial, metal, x = -14.8, arched = false) {
  const door = new THREE.Group(); door.position.set(x, 2.55, Z); door.rotation.y = Math.PI / 2; parent.add(door);
  if(arched){
    const shape=new THREE.Shape();shape.moveTo(-1.975,-1.5);shape.lineTo(1.975,-1.5);shape.lineTo(1.975,.5);shape.quadraticCurveTo(1.975,1.55,0,1.55);shape.quadraticCurveTo(-1.975,1.55,-1.975,.5);shape.closePath();
    const wall=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.16,bevelEnabled:false,curveSegments:24}),woodMaterial);wall.position.z=-.18;door.add(wall);
  }else box(door, [3.95, 3, .16], [0, 0, -.1], woodMaterial);
  frame(door, 1.3, 2.55, .25, metal, .045);
  box(door, [1.15, 2.4, .05], [0, -.02, .03], woodMaterial);
  const glass = mat(0x889a8b, .2, .2); box(door, [.58, .86, .04], [0, .57, .085], glass);
  const window = new THREE.Group(); window.position.set(0, .57, .12); door.add(window); frame(window, .64, .92, .12, metal, .025);
  box(door, [.17, .035, .055], [.42, -.25, .12], metal);
  return door;
}
export function light(parent, color, intensity, position, distance = 7) {
  const lamp = new THREE.PointLight(color, intensity, distance, 2); lamp.position.set(...position); parent.add(lamp); return lamp;
}
// Layered geometry, not a flat video: parallax remains correct when looking around.
export function mountainScenery(parent, {warm = false} = {}) {
  const height=(x,z)=>.1+Math.sin(x*.14+z*.12)*1.6+Math.cos(z*.35-x*.12)*.8+Math.sin(x*.43+z*.23)*.32+Math.sin(x*1.4)*Math.cos(z*1.3)*.12+z*.025;
  for(const side of [-1,1]){
    const positions=[],colors=[],indices=[],nx=150,nz=80;
    const near=new THREE.Color(warm?0x526148:0x49645b),far=new THREE.Color(0xb3c3bd);
    for(let i=0;i<=nx;i++)for(let j=0;j<=nz;j++){
      const x=-80+i,z=5+j*.8,y=height(x,z);
      positions.push(x,y,Z+side*z);const tint=near.clone().lerp(far,j/nz),shade=.85+.15*Math.sin(x*.35+z*.4);colors.push(tint.r*shade,tint.g*shade,tint.b*shade);
      if(i<nx&&j<nz){const a=i*(nz+1)+j,b=a+nz+1;indices.push(a,b,a+1,b,b+1,a+1);}
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    const material=mat(0xffffff);material.vertexColors=true;material.side=THREE.DoubleSide;parent.add(new THREE.Mesh(geometry,material));
    const rng=random(side+718),trees=new THREE.InstancedMesh(new THREE.ConeGeometry(1,1,5),mat(warm?0x4d593c:0x405d50),1700),matrix=new THREE.Matrix4(),q=new THREE.Quaternion();
    for(let i=0;i<1700;i++){
      const x=-65+rng()*120,z=6+rng()*40,size=.13+rng()*.22;
      matrix.compose(new THREE.Vector3(x,height(x,z)+size*.5,Z+side*z),q,new THREE.Vector3(size*.4,size,size*.4));trees.setMatrixAt(i,matrix);
    }
    parent.add(trees);
  }
}
export function cloudSky(parent) {
  const texture = canvasTexture(1024, 512, (ctx, w, h) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, h); gradient.addColorStop(0, '#54728f'); gradient.addColorStop(.5, '#95a9bc'); gradient.addColorStop(1, '#e7e1d1'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
    const rng = random(876);
    for (let i = 0; i < 240; i++) {
      const x = rng() * w, y = rng() * h, radius = 15 + rng() * 70;
      const g = ctx.createRadialGradient(x, y, 0, x, y, radius); g.addColorStop(0, 'rgba(255,248,235,.5)'); g.addColorStop(1, 'rgba(245,242,233,0)'); ctx.fillStyle = g; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(65, 32, 20), new THREE.MeshBasicMaterial({map: texture, color:0xc0c9d1, side: THREE.BackSide, fog: false})); sky.position.set(-7, 0, Z); parent.add(sky);
}
export function dappledFloor(parent, color = '#ffe2a1', strength = .16) {
  const texture = canvasTexture(512, 512, (ctx, w, h) => {
    const rng = random(426);
    for (let i = 0; i < 200; i++) {const x = rng() * w, y = rng() * h, r = 3 + rng() * 27; const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color); g.addColorStop(1, 'transparent'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);}
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(16, 3.85), new THREE.MeshBasicMaterial({map: texture, transparent: true, opacity: strength, depthWrite: false})); mesh.rotation.x = -Math.PI / 2; mesh.position.set(-7, F + .012, Z); parent.add(mesh);
}
export function canopy(parent) {
  const rng = random(919), bark = wood(0x595440), count = 10000;
  const leafGeometry=new THREE.CircleGeometry(1,7);leafGeometry.rotateX(-Math.PI/2);
  const leafMaterial=mat(0xffffff);leafMaterial.side=THREE.DoubleSide;
  const leaves = new THREE.InstancedMesh(leafGeometry, leafMaterial, count);
  const matrix = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (let i = 0; i < count; i++) {
    const side = i % 2 ? 1 : -1, z = Z + side * (1.1 + rng() * 4.2), y = 3.9 + rng() * 2.3;
    q.setFromEuler(new THREE.Euler((rng()-.5)*1.1, rng()*6, (rng()-.5)*1.4));
    matrix.compose(new THREE.Vector3(-20+rng()*28, y, z), q, new THREE.Vector3(.08+rng()*.18,.012,.055+rng()*.11));
    leaves.setMatrixAt(i,matrix);leaves.setColorAt(i,new THREE.Color([0x788139,0x4c622f,0x9a963d,0x46552b,0x6b7635][i%5]));
  }
  parent.add(leaves);
  for(let i=0;i<38;i++){
    const x=-22+(i%19)*1.65,z=Z+(i<19?1:-1)*(i%3===0?2.15:3.1+rng()*4),h=5+rng()*2.7;
    tube(parent,[[x,.7,z],[x+.12,3,z],[x-.2,h,z+.1]],.12+rng()*.06,bark);
    for(let j=0;j<4;j++){
      const side=j%2?1:-1, y=3.5+j*.55;
      tube(parent,[[x,y-.6,z],[x+side*.8,y,z-side*.3],[x+side*1.9,y+.25,z-side*1.3]],.038,bark);
    }
  }
  const distantTrunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.08,.15,5,6),bark,160);
  const understory=new THREE.InstancedMesh(leafGeometry,leafMaterial,2560);
  for(let i=0;i<160;i++){
    const x=-35+rng()*45,z=Z+(i%2?1:-1)*(3.4+rng()*13);
    matrix.compose(new THREE.Vector3(x,2.7,z),new THREE.Quaternion(),new THREE.Vector3(1,1+rng()*.4,1));distantTrunks.setMatrixAt(i,matrix);
    for(let j=0;j<16;j++){
      q.setFromEuler(new THREE.Euler((rng()-.5)*1.8,rng()*6,(rng()-.5)*1.8));
      matrix.compose(new THREE.Vector3(x+(rng()-.5)*1.5,1.7+j*.2,z+(rng()-.5)*1.3),q,new THREE.Vector3(.15+rng()*.25,.025,.12+rng()*.18));understory.setMatrixAt(i*16+j,matrix);understory.setColorAt(i*16+j,new THREE.Color(0x64723b));
    }
  }
  // Merge the static branch tubes so dense foliage does not cost hundreds of draws.
  const branches=parent.children.filter(mesh=>mesh.isMesh&&!mesh.isInstancedMesh&&mesh.material===bark);
  const positions=[],normals=[],uvs=[];
  for(const branch of branches){
    const source=branch.geometry.index?branch.geometry.toNonIndexed():branch.geometry;
    for(const value of source.attributes.position.array)positions.push(value);
    for(const value of source.attributes.normal.array)normals.push(value);
    for(const value of source.attributes.uv.array)uvs.push(value);
    parent.remove(branch);if(source!==branch.geometry)source.dispose();branch.geometry.dispose();
  }
  const branchesGeometry=new THREE.BufferGeometry();branchesGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));branchesGeometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));branchesGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  parent.add(new THREE.Mesh(branchesGeometry,bark),distantTrunks,understory);
  return leaves;
}
// Only the new rooms opt into these shadows, preserving the existing carriage lighting.
export function sunlitRoom(parent, targets, color=0xffe5be) {
  const sun=new THREE.DirectionalLight(color,2.1);sun.position.set(-5,9,Z+6);sun.target.position.set(-9,F,Z);parent.add(sun,sun.target);
  sun.castShadow=true;sun.shadow.autoUpdate=false;sun.shadow.needsUpdate=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-10,right:10,top:8,bottom:-8,near:.5,far:30});sun.shadow.bias=-.0002;sun.shadow.normalBias=.025;
  for(const root of [parent,...targets.map(t=>t.group)])root.traverse(mesh=>{
    if(!mesh.isMesh||mesh.material.side===THREE.BackSide||mesh.material.transparent)return;
    mesh.castShadow=true;mesh.receiveShadow=true;
  });
  return sun;
}
