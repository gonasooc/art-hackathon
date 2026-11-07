import * as THREE from '../../vendor/three/three.module.js';
import { TRAIN } from '../config.js';
import { box } from '../train-geometry.js';
import { canvasTexture,random } from './memory-room-kit.js';
import { IncenseFinale } from './incense-finale.js';

const standard = (color, roughness = .9) => new THREE.MeshStandardMaterial({ color, roughness });

// Small deterministic textures keep this last room self-contained and offline.
function surfaceTexture(stone = false) {
  if(stone){
    return canvasTexture(512,512,(ctx,w,h)=>{
      const rng=random(707),data=ctx.createImageData(w,h);
      for(let i=0;i<data.data.length;i+=4){const v=139+rng()*14;data.data.set([v,v*.98,v*.93,255],i);}ctx.putImageData(data,0,0);
      for(let i=0;i<36;i++){
        let x=rng()*w,y=rng()*h;ctx.beginPath();ctx.moveTo(x,y);
        for(let j=0;j<5;j++){const nx=x+(rng()-.5)*190,ny=y+(rng()-.35)*145;ctx.bezierCurveTo(x+28,y+12,nx-24,ny-12,nx,ny);x=nx;y=ny;}
        ctx.strokeStyle=`rgba(222,218,201,${.22+rng()*.2})`;ctx.lineWidth=1.1+rng()*1.5;ctx.stroke();
      }
    });
  }
  const size = 128, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const grain = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    const noise = grain - Math.floor(grain);
    const value = 105 + noise * 12 + Math.sin(x * .15) * Math.cos(y * .13) * 10;
    const i = (y * size + x) * 4;
    pixels[i] = value; pixels[i + 1] = value * .98; pixels[i + 2] = value * .92; pixels[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8,8);
  texture.magFilter = THREE.LinearFilter; texture.needsUpdate = true;
  return texture;
}

function softTexture(ribbon = false) {
  const width = 64, height = ribbon ? 128 : 64, data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const u = (x + .5) / width * 2 - 1, v = (y + .5) / height;
    const alpha = ribbon
      ? Math.exp(-u * u * 8) * Math.pow(Math.sin(Math.PI * v), .65)
      : Math.pow(Math.max(0, 1 - Math.sqrt(u * u + (v * 2 - 1) ** 2)), 2);
    const i = (y * width + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = 255; data[i + 3] = alpha * 255;
  }
  const texture = new THREE.DataTexture(data, width, height);
  texture.magFilter = THREE.LinearFilter; texture.needsUpdate = true;
  return texture;
}

function smokeRibbon(texture, phase) {
  const count = 44, positions = new Float32Array((count + 1) * 6), uv = [], indices = [];
  for (let i = 0; i <= count; i++) {
    uv.push(0, i / count, 1, i / count);
    if (i < count) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices);
  const material = new THREE.MeshBasicMaterial({ color: 0xd2d0c8, map: texture, transparent: true,
    opacity: .19, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  return { mesh, phase, count };
}

export function buildIncenseCarriage() {
  const group = new THREE.Group(); group.name = 'carriage-07-incense';
  const center = TRAIN.centerZ + .03245, floorY = TRAIN.floorY;
  const dark = new THREE.Mesh(new THREE.SphereGeometry(50, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, toneMapped: false, fog:false }));
  dark.position.set(-7, floorY, center); group.add(dark);
  const floorMaterial = standard(0x81837c); floorMaterial.map = surfaceTexture();
  const floor=box(group, [60, .12, 60], [-7, floorY - .06, center], floorMaterial);floor.receiveShadow=true;

  // The reference is an empty black room: only the low stone stand receives light.
  const stone = standard(0xc7c5bb, .88); stone.map = surfaceTexture(true);
  const plinth = box(group, [.85, .54, .85], [-9, floorY + .27, center], stone);
  plinth.name = 'incense-stone-plinth';
  plinth.rotation.y = -.62387;plinth.castShadow=true;plinth.receiveShadow=true;
  const cap=box(group, [.85, .006, .85], [-9, floorY + .543, center], stone);
  cap.rotation.y = plinth.rotation.y;cap.receiveShadow=true;cap.castShadow=true;
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 5.2), new THREE.MeshBasicMaterial({
    map: softTexture(), color: 0xc0beb7, transparent: true, opacity: .03, depthWrite: false, toneMapped: false,
  }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(-9, floorY + .005, center); group.add(pool);
  const light = new THREE.SpotLight(0xfff5e5, 65, 12, .82, 1, 2);
  light.position.set(-7.2, floorY + 4.8, center + 2.5);
  light.target.position.set(-9, floorY + .2, center); group.add(light, light.target);
  light.castShadow=true;light.shadow.autoUpdate=false;light.shadow.needsUpdate=true;light.shadow.mapSize.set(1024,1024);light.shadow.camera.near=.5;light.shadow.camera.far=12;light.shadow.bias=-.0001;light.shadow.normalBias=.01;light.shadow.radius=4;
  const fill = new THREE.PointLight(0xe0dfd6, .7, 4, 2);
  fill.position.set(-7.8, floorY + 1.8, center - 1.1); group.add(fill);

  const target = new THREE.Group(); target.name = 'incense-offering';
  const ceramic = standard(0xd7d4c6, .72);
  // Closed bowl profile includes a broad curved side for reliable gaze raycasts.
  const profile = [[0,.685],[.18,.685],[.21,.71],[.28,.75],[.32,.86],[.325,.9],
    [.304,.912],[.282,.87],[.26,.79],[.18,.75],[0,.75]].map(([radius,y]) => new THREE.Vector2(radius*.52,.647+(y-.685)*.7));
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(profile, 48), ceramic);
  bowl.name = 'incense-bowl'; target.add(bowl);
  const ash = new THREE.Mesh(new THREE.CylinderGeometry(.145, .122, .018, 40), standard(0x8d8473));
  ash.position.y = .752; target.add(ash);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(.0035, .004, .6, 10), standard(0x554131));
  stick.position.set(.005, 1.065, 0); stick.rotation.z = -.014; target.add(stick);
  const char = new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, .022, 8), standard(0x25231f));
  char.position.set(.009, 1.38, 0); target.add(char);
  const emberMaterial = standard(0x874728);
  emberMaterial.emissive.setHex(0xb65c29); emberMaterial.emissiveIntensity = .45;
  const ember = new THREE.Mesh(new THREE.SphereGeometry(.005, 10, 8), emberMaterial);
  ember.position.set(.009, 1.397, 0); target.add(ember);

  const smoke = new THREE.Group(); smoke.name = 'incense-rising-smoke';
  smoke.position.set(-8.989, floorY + 1.309, center); group.add(smoke);
  const smokeMap = softTexture(true);
  const ribbons = [smokeRibbon(smokeMap, 0), smokeRibbon(smokeMap, 1.9)];
  ribbons.forEach(({ mesh }) => smoke.add(mesh));
  let time = 0;
  function update(dt, reducedMotion = false) {
    if (!reducedMotion) time += Math.min(dt, .1);
    // MemoryObjects clones each material; read the live bowl material every frame.
    const presence = target.visible ? bowl.material.opacity : 0;
    smoke.visible = presence > .02;
    if (!smoke.visible) return;
    ribbons.forEach(({ mesh, phase, count }, index) => {
      mesh.material.opacity = presence * (index ? .12 : .29);
      const attr = mesh.geometry.attributes.position;
      for (let i = 0; i <= count; i++) {
        const t = i / count, y = t * .86;
        const drift = Math.sin(t * 7 - time * .55 + phase) * t * .045
          + Math.sin(t * 13 - time * .33) * t * .015;
        const halfWidth = (.009 + Math.sin(t * Math.PI) * .035) * (index ? .7 : 1);
        const x = Math.sin(t * 6 + phase - time * .23) * t * .035;
        attr.setXYZ(i * 2, x, y, drift - halfWidth);
        attr.setXYZ(i * 2 + 1, x, y, drift + halfWidth);
      }
      attr.needsUpdate = true;
    });
  }
  update(0, true);
  target.traverse(mesh=>{if(mesh.isMesh){mesh.castShadow=true;mesh.receiveShadow=true;}});
  const finale=new IncenseFinale();group.add(finale.group);
  return { group, targets: [{ id: '07-incense', group: target,
    position: [-9, floorY-.1, center], aim: [-8.85, floorY + .65, center] }], update, finale, sunlight:light };
}
