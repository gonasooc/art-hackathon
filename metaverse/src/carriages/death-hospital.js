import * as THREE from '../../vendor/three/three.module.js';
import {TRAIN} from '../config.js';
import {box, boxes, tube} from '../train-geometry.js';

const mat = (color, roughness = .55, metalness = 0) => new THREE.MeshStandardMaterial({color, roughness, metalness});
function oval(group, position, scale, material) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), material);
  mesh.position.set(...position);mesh.scale.set(...scale);group.add(mesh);return mesh;
}

// Black-on-black rosettes remain quiet until the cyan light grazes the coat.
function coatTexture() {
  const size = 128, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const row = Math.floor(y / 24), px = (x + (row % 2) * 13) % 26 - 13, py = y % 24 - 12;
    const ring = Math.hypot(px * .9, py * 1.15), spot = ring > 5 && ring < 8 && Math.sin(x * .7 + y) > -.7;
    const value = (spot ? 30 : 51) + Math.sin(x * 15.7 + y * 31.1) * 4;
    const index = (y * size + x) * 4;
    data.set([value, value + 3, value + 2, 255], index);
  }
  const texture = new THREE.DataTexture(data, size, size);texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;texture.needsUpdate = true;return texture;
}

function blackLeopard() {
  const group = new THREE.Group(), coat = mat(0xbac3be, .78), muzzle = mat(0x272e2b, .86);
  coat.map = coatTexture();
  const black = mat(0x080c0b, .45), eye = mat(0xa8a574, .28);
  eye.emissive.setHex(0x655d29);eye.emissiveIntensity = .12;
  oval(group, [0, .7, 0], [.67, .24, .25], coat);
  oval(group, [-.43, .76, 0], [.28, .29, .27], coat);
  oval(group, [.46, .69, 0], [.27, .27, .26], coat);
  for (const [x, z] of [[-.47,-.19],[-.36,.2],[.43,-.19],[.55,.18]]) {
    oval(group, [x,.39,z], [.085,.32,.085], coat);
    oval(group, [x-.045,.09,z], [.135,.075,.095], coat);
    for (const offset of [-.045,0,.045]) oval(group,[x-.13,.09,z+offset],[.023,.022,.013],black);
  }
  oval(group,[-.62,.89,0],[.19,.26,.21],coat);
  oval(group,[-.79,1.04,0],[.24,.2,.21],coat);
  oval(group,[-.97,.99,0],[.16,.1,.16],muzzle);
  oval(group,[-1.09,1.025,0],[.05,.036,.07],black);
  for (const side of [-1,1]) {
    oval(group,[-.7,1.21,side*.155],[.085,.095,.054],coat);
    oval(group,[-.727,1.22,side*.178],[.049,.061,.019],muzzle);
    oval(group,[-.91,1.09,side*.178],[.035,.025,.019],eye);
    oval(group,[-.93,1.09,side*.19],[.012,.022,.01],black);
  }
  tube(group,[[.6,.75,0],[.85,.53,.02],[1.01,.2,.05],[1.2,.15,.05],[1.28,.38,.08]],.044,coat);
  group.rotation.y = -Math.PI / 2;group.scale.setScalar(.82);return group;
}

function shroudedBody() {
  const group = new THREE.Group(), cloth = mat(0xe2dfcf, .98);
  cloth.side = THREE.DoubleSide;
  // A single draped sheet, with a covered head/chest/feet profile and irregular
  // hanging pleats. No skin, face, wounds, or anatomical mesh is exposed.
  const width = 36, length = 72, positions = [], uvs = [], indices = [];
  const gaussian = (value, center, spread) => Math.exp(-(((value - center) / spread) ** 2));
  for (let j = 0; j <= length; j++) for (let i = 0; i <= width; i++) {
    const across = i / width * 2 - 1, along = j / length * 2 - 1;
    const z = along * 1.04, x = across * .53;
    const profile = .27 * gaussian(z,-.48,.42) + .23 * gaussian(z,.27,.49) + .25 * gaussian(z,.77,.2);
    const drape = Math.pow(Math.max(0, 1 - Math.abs(across) ** 2), .55);
    const fold = (.013 + .025 * Math.abs(across)) * Math.sin(z * 27 + across * 6) * Math.sin(across * 12 + z * 3);
    const y = .045 + (.14 + profile) * drape * Math.pow(Math.max(0,1-Math.abs(along)**8), .3) + fold;
    positions.push(x,y,z);uvs.push(i / width,j / length);
    if (i < width && j < length) {
      const a = j * (width + 1) + i, b = a + width + 1;
      indices.push(a,b,a+1,b,b+1,a+1);
    }
  }
  const geometry = new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const sheet = new THREE.Mesh(geometry,cloth);sheet.name='fully-covered-shroud';group.add(sheet);
  // The pillow is part of this memory, so no orphaned white shape remains.
  oval(group,[.01,.085,.76],[.4,.085,.27],cloth);
  return group;
}

function angelHalo() {
  const group = new THREE.Group(), ivory = mat(0xf9edce, .24, .18);
  ivory.emissive.setHex(0xffe4af);ivory.emissiveIntensity = .7;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.43,.075,16,72),ivory);
  ring.rotation.x = Math.PI / 2;ring.name='ivory-angel-halo';group.add(ring);
  // A slight suspended tilt keeps the opening legible at seated eye height.
  group.rotation.z = .28;
  return group;
}

function waitingChair(parent,x,z,side,metal,vinyl) {
  const chair = new THREE.Group();chair.position.set(x,TRAIN.floorY,z);chair.rotation.y = side > 0 ? Math.PI : 0;
  box(chair,[.62,.11,.56],[0,.46,0],vinyl);
  box(chair,[.62,.65,.09],[0,.81,-.24],vinyl,[-.07,0,0]);
  for(const dx of [-.32,.32]) tube(chair,[[dx,.04,.27],[dx,.69,.24],[dx,.69,-.26],[dx,.04,-.31]],.019,metal);
  parent.add(chair);
}

export function buildDeathHospitalCarriage() {
  const group = new THREE.Group();group.name='death-hospital-06';
  const z = TRAIN.centerZ, floor = TRAIN.floorY, wallZ = 2.16, ceiling = 4.25;
  const red = mat(0x4a090d,.27,.16), seams = mat(0x7b6650,.52,.3), metal = mat(0x8d9992,.27,.75);
  const darkMetal = mat(0x293b37,.37,.55), vinyl = mat(0x213d35,.6), gray = mat(0x68736b,.29,.22);
  const fluorescent = mat(0xb4eae1,.28);fluorescent.emissive.setHex(0x9cece4);fluorescent.emissiveIntensity = 1.5;
  box(group,[14.1,.14,4.45],[-6.5,floor-.07,z],gray);
  box(group,[14.1,.12,4.45],[-6.5,ceiling+.06,z],red);
  for (const side of [-1,1]) {
    // Observation window is cut into the left wall; no painted-on people.
    for (let x = -.5; x >= -12.5; x -= 2) {
      if(side === -1 && (x === -6.5 || x === -8.5)) {
        box(group,[1.98,.92,.12],[x,floor+.46,z+side*wallZ],red);
        box(group,[1.98,.63,.12],[x,ceiling-.315,z+side*wallZ],red);
      } else box(group,[1.98,ceiling-floor,.12],[x,(ceiling+floor)/2,z+side*wallZ],red);
      box(group,[.012,ceiling-floor,.02],[x-.995,(ceiling+floor)/2,z+side*(wallZ-.066)],seams);
    }
    box(group,[14,.11,.035],[-6.5,floor+.1,z+side*(wallZ-.08)],seams);
    box(group,[14,.012,.015],[-6.5,2.48,z+side*(wallZ-.065)],seams);
    for (const x of [-2.2,-3.05,-4.4,-11.1]) waitingChair(group,x,z+side*1.74,side,metal,vinyl);
  }
  box(group,[.15,ceiling-floor,4.45],[-13.57,(ceiling+floor)/2,z],red);
  box(group,[.16,ceiling-floor,4.45],[.57,(ceiling+floor)/2,z],red);
  // Long cyan ceiling banks are the principal visual rhythm of the references.
  const lampFrames=[], lampPanes=[];
  for(const side of [-1,1]) for(const lateral of [.62,1.62]) for(let x=-.5;x>-13;x-=2.2) {
    lampFrames.push([[2.1,.065,.22],[x,ceiling-.04,z+side*lateral]]);
    lampPanes.push([[2.02,.016,.155],[x,ceiling-.08,z+side*lateral]]);
  }
  boxes(group,lampFrames,darkMetal);boxes(group,lampPanes,fluorescent);
  for(const x of [-2,-5.5,-9.2,-12]) {
    const light = new THREE.PointLight(0xb9e9dc,5.2,7,2);light.position.set(x,3.8,z);group.add(light);
    box(group,[.42,.025,.4],[x,ceiling-.03,z],darkMetal);
    for(let i=0;i<8;i++) box(group,[.37,.018,.014],[x,ceiling-.05,z-.15+i*.042],metal);
  }
  // Rear steel kick plates and split burgundy hospital doors.
  for(const side of [-1,1]) {
    box(group,[.09,2.58,.83],[-13.45,floor+1.29,z+side*.43],red);
    box(group,[.018,.78,.81],[-13.39,floor+.39,z+side*.43],metal);
    box(group,[.025,.87,.22],[-13.38,2.8,z+side*.44],metal);
    box(group,[.03,.8,.16],[-13.36,2.8,z+side*.44],mat(0xa4c7b9,.65));
    tube(group,[[-13.31,2.02,z+side*.1],[-13.31,2.38,z+side*.1]],.022,metal);
  }
  box(group,[.08,.06,1.8],[-13.33,3.65,z],metal);
  box(group,[.06,.09,.78],[-13.3,3.81,z],fluorescent);
  // Empty observation room, with horizontal blinds and subdued monitor traces.
  const observation = mat(0x244440,.68), glass = mat(0x497c77,.24,.15);
  glass.transparent=true;glass.opacity=.2;glass.depthWrite=false;
  box(group,[4.15,2.5,.1],[-7.5,2.5,z-3.1],observation);
  box(group,[4.1,.07,1],[-7.5,1.97,z-2.6],metal);
  for(const x of [-8.6,-7.25,-6.1]) {
    box(group,[.64,.44,.07],[x,2.39,z-2.75],darkMetal);
    box(group,[.55,.32,.025],[x,2.39,z-2.7],mat(0x518e86,.65));
    for(let i=0;i<3;i++) box(group,[.38,.009,.008],[x,2.31+i*.07,z-2.68],fluorescent);
  }
  box(group,[4.06,1.65,.022],[-7.5,2.81,z-wallZ+.09],glass);
  for(const y of [1.98,3.64])box(group,[4.18,.055,.08],[-7.5,y,z-wallZ+.12],metal);
  for(const x of [-9.58,-5.42])box(group,[.055,1.7,.08],[x,2.81,z-wallZ+.12],metal);
  const blinds=[];for(let y=2.05;y<3.6;y+=.075)blinds.push([[4.1,.014,.027],[-7.5,y,z-wallZ+.14]]);
  boxes(group,blinds,darkMetal);
  // Low wooden dais; all of it is beyond the observation stop.
  const wood=mat(0x382317,.4,.08);
  box(group,[1.45,.17,2.65],[-9.3,floor+.085,z+.55],wood);
  for(let zz=-.75;zz<1.85;zz+=.23)box(group,[1.4,.005,.008],[-9.3,floor+.173,z+zz],mat(0x6c4930,.6));
  const leopard=blackLeopard(), shroud=shroudedBody(), halo=angelHalo();
  const targets=[
    {id:'06-leopard',group:leopard,position:[-8.6,floor,z-1.05],aim:[-8.6,floor+.62,z-1.05]},
    {id:'06-shroud',group:shroud,position:[-9.3,floor+.18,z+.55],aim:[-9.27,floor+.53,z+.55]},
    // Aim at the ivory tube, not the empty middle of the horizontal ring.
    {id:'06-halo',group:halo,position:[-9.25,3.04,z+.65],aim:[-9.25+.43*Math.cos(.28),3.04+.43*Math.sin(.28),z+.65]},
  ];
  return {group,targets};
}
