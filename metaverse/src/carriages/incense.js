import * as THREE from '../../vendor/three/three.module.js';
import { TRAIN } from '../config.js';
import { box } from '../train-geometry.js';
import { IncenseFinale } from './incense-finale.js';

const standard = (color, roughness = .9) => new THREE.MeshStandardMaterial({ color, roughness });

// Small deterministic textures keep this last room self-contained and offline.
function surfaceTexture(stone = false) {
  const size = 128, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const grain = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    const noise = grain - Math.floor(grain);
    const vein = Math.pow(Math.max(0, Math.sin(x * .095 + y * .056 + Math.sin(y * .1) * 1.6)), 24);
    const value = stone ? 85 + noise * 18 + vein * 27 : 74 + noise * 24 + Math.sin(x * .15) * Math.cos(y * .13) * 7;
    const i = (y * size + x) * 4;
    pixels[i] = value; pixels[i + 1] = value * .94; pixels[i + 2] = value * .85; pixels[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(stone ? 1 : 16, stone ? 1 : 16);
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
  const material = new THREE.MeshBasicMaterial({ color: 0xc8c0b2, map: texture, transparent: true,
    opacity: .19, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  return { mesh, phase, count };
}

export function buildIncenseCarriage() {
  const group = new THREE.Group(); group.name = 'carriage-07-incense';
  const center = TRAIN.centerZ, floorY = TRAIN.floorY;
  const dark = new THREE.Mesh(new THREE.SphereGeometry(50, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, toneMapped: false }));
  dark.position.set(-7, floorY, center); group.add(dark);
  const floorMaterial = standard(0xaaa499); floorMaterial.map = surfaceTexture();
  box(group, [60, .12, 60], [-7, floorY - .06, center], floorMaterial);

  // The reference is an empty black room: only the low stone stand receives light.
  const stone = standard(0xc5b9a2, .86); stone.map = surfaceTexture(true);
  const plinth = box(group, [.85, .64, .85], [-9, floorY + .32, center], stone);
  plinth.name = 'incense-stone-plinth';
  box(group, [.87, .026, .87], [-9, floorY + .653, center], stone);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 5.2), new THREE.MeshBasicMaterial({
    map: softTexture(), color: 0xd5b88b, transparent: true, opacity: .14, depthWrite: false, toneMapped: false,
  }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(-9, floorY + .005, center); group.add(pool);
  const light = new THREE.SpotLight(0xffdbab, 40, 10, .61, .9, 2);
  light.position.set(-7.9, floorY + 5.5, center + .7);
  light.target.position.set(-9, floorY + .2, center); group.add(light, light.target);
  const fill = new THREE.PointLight(0xd7c8b0, 2.6, 4, 2);
  fill.position.set(-7.8, floorY + 1.8, center - 1.1); group.add(fill);

  const target = new THREE.Group(); target.name = 'incense-offering';
  const ceramic = standard(0xe0d1b6, .66);
  // Closed bowl profile includes a broad curved side for reliable gaze raycasts.
  const profile = [[0,.685],[.18,.685],[.21,.71],[.28,.75],[.32,.86],[.325,.9],
    [.304,.912],[.282,.87],[.26,.79],[.18,.75],[0,.75]].map(p => new THREE.Vector2(...p));
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(profile, 48), ceramic);
  bowl.name = 'incense-bowl'; target.add(bowl);
  const ash = new THREE.Mesh(new THREE.CylinderGeometry(.278, .235, .025, 40), standard(0x8d8473));
  ash.position.y = .835; target.add(ash);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(.009, .012, .825, 10), standard(0x554131));
  stick.position.set(.005, 1.25, 0); stick.rotation.z = -.014; target.add(stick);
  const char = new THREE.Mesh(new THREE.CylinderGeometry(.01, .01, .036, 8), standard(0x25231f));
  char.position.set(.011, 1.676, 0); target.add(char);
  const emberMaterial = standard(0x874728);
  emberMaterial.emissive.setHex(0xb65c29); emberMaterial.emissiveIntensity = .45;
  const ember = new THREE.Mesh(new THREE.SphereGeometry(.011, 10, 8), emberMaterial);
  ember.position.set(.011, 1.695, 0); target.add(ember);

  const smoke = new THREE.Group(); smoke.name = 'incense-rising-smoke';
  smoke.position.set(-8.989, floorY + 1.706, center); group.add(smoke);
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
      mesh.material.opacity = presence * (index ? .085 : .19);
      const attr = mesh.geometry.attributes.position;
      for (let i = 0; i <= count; i++) {
        const t = i / count, y = t * .65;
        const drift = Math.sin(t * 7 - time * .55 + phase) * t * .075
          + Math.sin(t * 13 - time * .33) * t * .025;
        const halfWidth = (.009 + Math.sin(t * Math.PI) * .035) * (index ? .7 : 1);
        const x = Math.sin(t * 6 + phase - time * .23) * t * .035;
        attr.setXYZ(i * 2, x, y, drift - halfWidth);
        attr.setXYZ(i * 2 + 1, x, y, drift + halfWidth);
      }
      attr.needsUpdate = true;
    });
  }
  update(0, true);
  const finale=new IncenseFinale();group.add(finale.group);
  return { group, targets: [{ id: '07-incense', group: target,
    position: [-9, floorY, center], aim: [-8.704, floorY + .86, center] }], update, finale };
}
