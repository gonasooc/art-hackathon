import * as THREE from '../vendor/three/three.module.js';
import { TRAIN } from './config.js';

const vector = values => new THREE.Vector3(...values);

export function box(parent, size, position, material, rotation) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  parent.add(mesh);
  return mesh;
}

export function boxes(parent, placements, material) {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, placements.length);
  const matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion();
  placements.forEach(([size, position], index) => mesh.setMatrixAt(index, matrix.compose(vector(position), quaternion, vector(size))));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  parent.add(mesh);
  return mesh;
}

export function tube(parent, points, radius, material, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points.map(vector), closed);
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(16, points.length * 8), radius, 6, closed), material);
  parent.add(mesh);
  return mesh;
}

// Cross-sections are in Y/Z; X is the train's longitudinal axis.
export function archGeometry(startX, endX, baseY, centerZ, height, width, { organic = false, full = false, segments = 48 } = {}) {
  const vertices = [], uv = [], indices = [], sides = 36;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, x = startX + (endX - startX) * t;
    for (let j = 0; j <= sides; j++) {
      const s = j / sides, angle = s * Math.PI * (full ? 2 : 1);
      const ripple = organic ? 1 + .065 * Math.sin(x * .55 + angle * 3) + .035 * Math.cos(x * .29 - angle * 5) : 1;
      vertices.push(x, baseY + Math.sin(angle) * height * ripple, centerZ + Math.cos(angle) * width * ripple);
      uv.push(t, s);
      if (i < segments && j < sides) {
        const a = i * (sides + 1) + j, b = a + sides + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function noseGeometry() {
  const rings = [[7.4, 2.44, 1.83, 1.9], [8.5, 2.25, 1.58, 1.8], [10, 1.82, 1.08, 1.48], [11.1, 1.45, .58, .82], [11.55, 1.38, .3, .22]];
  const positions = [], uv = [], indices = [], sides = 32;
  rings.forEach(([x, y, h, w], i) => {
    for (let j = 0; j <= sides; j++) {
      const angle = j / sides * Math.PI * 2;
      positions.push(x, y + Math.sin(angle) * h, TRAIN.centerZ + Math.cos(angle) * w);
      uv.push(i / (rings.length - 1), j / sides);
      if (i < rings.length - 1 && j < sides) {
        const a = i * (sides + 1) + j, b = a + sides + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

export function plaque(parent, text, subtitle, width, height, position, rotation = [0, 0, 0]) {
  const canvas = document.createElement('canvas');canvas.width = 768;canvas.height = 384;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#122335';ctx.fillRect(0, 0, 768, 384);
  ctx.strokeStyle = '#b9975e';ctx.lineWidth = 4;ctx.strokeRect(16, 16, 736, 352);
  ctx.textAlign = 'center';ctx.fillStyle = '#e3c48e';
  ctx.font = '140px "Iowan Old Style", serif';ctx.fillText(text, 384, 220);
  ctx.font = '25px "Apple SD Gothic Neo", sans-serif';ctx.fillText(subtitle, 384, 302);
  const texture = new THREE.CanvasTexture(canvas);texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
  mesh.position.set(...position);mesh.rotation.set(...rotation);parent.add(mesh);return mesh;
}

export function buildTrain(materials) {
  const train = new THREE.Group();train.name = 'train-exterior';
  const { navy, gold, silver, iron, wood, glass, lamp } = materials;
  const center = TRAIN.centerZ, near = TRAIN.nearSideZ, far = center - 1.9;
  box(train, [22.5, .32, 3.8], [-3.75, .76, center], iron);
  box(train, [22.5, .16, 3.6], [-3.75, .98, center], wood);
  // Near side has a real opening at x=0; the viewer walks through it.
  for (const [length, x] of [[14.25, -7.875], [6.65, 4.075]]) {
    box(train, [length, .85, .12], [x, 1.425, near], navy);
  }
  box(train, [22.5, .85, .12], [-3.75, 1.425, far], navy);
  for (const z of [near, far]) box(train, [22.5, .32, .14], [-3.75, 3.64, z], navy);
  const roof = new THREE.Mesh(archGeometry(-15, 7.5, 3.75, center, .64, 1.91, { segments: 24 }), silver);
  roof.name = 'silver-arched-roof';train.add(roof);
  const trims = [], windowFrames = [], pillars = [];
  const windowXs = [-13.6, -11.35, -9.1, -6.85, -4.6, -2.35, 2.3, 4.55, 6.65];
  for (const z of [near + .085, far - .085]) {
    for (const y of [1.06, 1.86, 1.94, 3.51]) {
      if (z > center && y < 3.5) {
        trims.push([[14.2, .032, .045], [-7.9, y, z]], [[6.65, .032, .045], [4.075, y, z]]);
      } else trims.push([[22.5, .032, .045], [-3.75, y, z]]);
    }
    for (const x of windowXs) {
      for (const edge of [-.83, .83]) windowFrames.push([[.035, 1.5, .05], [x + edge, 2.73, z]]);
      for (const y of [2, 3.46]) windowFrames.push([[1.7, .035, .05], [x, y, z]]);
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.62, 1.42), glass);
      pane.position.set(x, 2.73, z);pane.name = 'warm-window';train.add(pane);
      pillars.push([[.53, 1.58, .12], [x - 1.1, 2.72, z - (z > center ? .085 : -.085)]]);
    }
  }
  boxes(train, trims, gold);boxes(train, windowFrames, gold);boxes(train, pillars, navy);
  for(const x of [-1.15,1.15])box(train,[.6,1.58,.12],[x,2.72,near],navy);
  box(train,[2.95,1.58,.12],[0,2.72,far],navy);
  // Narrow structural posts leave the boarding aperture unobstructed.
  for (const x of [-.79, .79]) {
    box(train, [.12, 2.72, .18], [x, 2.39, near], gold);
  }
  box(train, [1.7, .12, .18], [0, 3.8, near], gold);
  plaque(train, '00', 'ORIGIN', .6, .28, [0, 4.13, near + .1]);
  const door = new THREE.Group();door.position.set(-.96, 1.04, near + .08);door.rotation.y = -1.42;
  box(door, [1.48, 2.66, .1], [.74, 1.33, 0], navy);
  for (const x of [.04, 1.44]) box(door, [.025, 2.58, .12], [x, 1.33, .02], gold);
  for (const y of [.06, 2.6]) box(door, [1.42, .025, .12], [.74, y, .02], gold);
  const oval = new THREE.Mesh(new THREE.CircleGeometry(.4, 48), lamp);oval.scale.set(.72, 2.0, 1);oval.position.set(.74, 1.62, .061);door.add(oval);
  const ovalFrame = new THREE.Mesh(new THREE.TorusGeometry(.4, .014, 6, 48), gold);ovalFrame.scale.set(.75, 2.03, 1);ovalFrame.position.copy(oval.position);ovalFrame.position.z += .01;door.add(ovalFrame);
  tube(door, [[1.24, .85, .12], [1.24, 1.34, .12]], .025, gold);train.add(door);
  for (let i = 0; i < 4; i++) {
    box(train, [1.48, .14, .49], [0, .16 + i * .26, near + 1.65 - i * .4], iron);
    box(train, [1.49, .025, .045], [0, .24 + i * .26, near + 1.86 - i * .4], gold);
  }
  for (const x of [-.85, .85]) tube(train, [[x, .4, near + 1.85], [x, 1.35, near + 1.85], [x, 2.1, near + .1], [x, 1.04, near + .1]], .027, gold);
  const wheels = [];
  for (const bogieX of [-11.8, -7.6, 2.4, 6]) {
    box(train, [2.3, .32, 2.85], [bogieX, .57, center], iron);
    for (const x of [bogieX - .65, bogieX + .65]) for (const z of [center - 1.48, center + 1.48]) {
      const wheel = new THREE.Group();wheel.position.set(x, .59, z);
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(.38, .38, .18, 24), iron);tire.rotation.x = Math.PI / 2;wheel.add(tire);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(.11, .11, .205, 16), silver);hub.rotation.x = Math.PI / 2;wheel.add(hub);
      const rim=new THREE.Mesh(new THREE.TorusGeometry(.34,.025,6,32),silver);rim.position.z=z>center?.11:-.11;wheel.add(rim);
      for (let j = 0; j < 3; j++) {
        const spoke = box(wheel, [.03, .53, .05], [0, 0, z > center ? .11 : -.11], iron);spoke.rotation.z = j * Math.PI / 3;
      }
      train.add(wheel);wheels.push(wheel);
    }
  }
  const nose = new THREE.Mesh(noseGeometry(), navy);nose.name = 'streamlined-nose';train.add(nose);
  for (const side of [-1, 1]) {
    tube(train, [[7.4, 1.08, center + side * 1.94], [9, 1.09, center + side * 1.75], [10.8, 1.13, center + side * .95], [11.5, 1.23, center + side * .2]], .022, gold);
    const corners=[[7.7,3.44,center+side*1.82],[9.1,2.95,center+side*1.63],[9.1,2.57,center+side*1.7],[7.7,3.03,center+side*1.89]];
    const glassGeometry=new THREE.BufferGeometry();glassGeometry.setAttribute('position',new THREE.Float32BufferAttribute(corners.flat(),3));
    glassGeometry.setIndex([0,1,2,0,2,3]);glassGeometry.computeVertexNormals();
    const windshield=new THREE.Mesh(glassGeometry,new THREE.MeshStandardMaterial({color:0x132631,roughness:.16,metalness:.3,side:THREE.DoubleSide}));train.add(windshield);
    tube(train,corners,.012,gold,true);
    const headlight = new THREE.Mesh(new THREE.SphereGeometry(.14, 12, 8), lamp);headlight.position.set(10.75, 1.65, center + side * .87);train.add(headlight);
  }
  const vents = [];
  for (let x = 3.7; x < 7; x += .18) vents.push([[.07, .12, 1.18], [x, 4.4, center]]);
  boxes(train, vents, iron);
  for (let x = -14.5; x < 7; x += 1.1) {
    const points = Array.from({length:17},(_,i)=>[x,3.76+Math.sin(i/16*Math.PI)*.65,center+Math.cos(i/16*Math.PI)*1.92]);
    tube(train, points, .011, silver);
  }
  plaque(train, 'FORGOTTEN TOWN', 'THE FIRST MEMORY', 3.5, .38, [-6.7, 1.52, near + .08]);
  return { group: train, wheels };
}

export function buildInterior(materials, membraneTexture) {
  const group = new THREE.Group();group.name = 'carriage-00';
  const { gold, wood, velvet, lamp } = materials;
  const center = TRAIN.centerZ;
  const planks = [];
  for (let z = center - 1.7; z < center + 1.7; z += .23) planks.push([[15.2, .08, .215], [-7, 1.08, z]]);
  boxes(group, planks, wood);
  const liningMaterial = new THREE.MeshBasicMaterial({
    map: membraneTexture, color: 0xffe2d4, toneMapped:false,
    side: THREE.DoubleSide, transparent: true, opacity: .8, depthWrite: false, forceSinglePass:true,
  });
  const lining = new THREE.Mesh(archGeometry(-14.7, 1.2, 1.24, center, 2.68, 1.66, { organic: true, segments: 48 }), liningMaterial);
  lining.name = 'womb-membrane';group.add(lining);
  const ribPoints = x => Array.from({length:23},(_,i)=>[x,1.18+Math.sin(i/22*Math.PI)*2.73,center+Math.cos(i/22*Math.PI)*1.72]);
  for (let x = -14.2; x < 1; x += 1.9) tube(group, ribPoints(x), .022, gold);
  const lamps = [];
  for (const x of [-2.1,-5.6,-9.1,-12.5]) {
    for (const side of [-1,1]) {
      const cushion=new THREE.Mesh(new THREE.SphereGeometry(1,20,12),velvet);
      cushion.scale.set(.46,.16,.3);cushion.position.set(x,1.19,center+side*1.35);group.add(cushion);
      const globe = new THREE.Mesh(new THREE.SphereGeometry(.13,16,12),lamp);globe.position.set(x,2.2,center+side*1.48);group.add(globe);
      tube(group,[[x,1.5,center+side*1.5],[x,2.17,center+side*1.5]],.018,gold);
    }
    const lampGroup = new THREE.Group();lampGroup.position.set(x,3.86,center);
    const stem = box(lampGroup,[.018,.24,.018],[0,-.12,0],gold);
    const globe = new THREE.Mesh(new THREE.SphereGeometry(.12,16,12),lamp);globe.position.y=-.3;lampGroup.add(globe);
    group.add(lampGroup);lamps.push(lampGroup);
  }
  // Organic folds stay at the ceiling and sides, keeping the aisle physically clear.
  const pearl = new THREE.MeshStandardMaterial({color:0xf5bcaa,emissive:0xbc765b,emissiveIntensity:.16,roughness:.5,transparent:true,opacity:.6});
  for(let strand=0;strand<4;strand++){
    const points=Array.from({length:22},(_,i)=>{
      const x=1-i*.73,t=strand*Math.PI/2;
      return [x,3.45+.22*Math.sin(x*.45+t),center+Math.sin(t)*1.05+.17*Math.sin(x*.62+t)];
    });
    tube(group,points,.045,pearl);
  }
  plaque(group,'00','첫 숨이 되기 전',.8,.42,[-.7,3.42,center],[0,Math.PI/2,0]);
  // The next-car threshold stays sealed; no unimplemented car number is presented as active.
  box(group,[.14,2.95,3.45],[-15.1,2.54,center],materials.navy);
  const endMembrane=new THREE.Mesh(new THREE.SphereGeometry(1,32,24),new THREE.MeshBasicMaterial({map:membraneTexture,color:0xffdfcf,toneMapped:false}));
  endMembrane.scale.set(.45,2.05,1.78);endMembrane.position.set(-15,2.65,center);group.add(endMembrane);
  return {group,liningMaterial,lamps};
}
