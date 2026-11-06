import * as THREE from '../../vendor/three/three.module.js';
import { TRAIN } from '../config.js';
import { box, boxes, tube } from '../train-geometry.js';

// Granite, water and growing things have quietly occupied the train. Geometry is
// deterministic and local; there are no remote textures or video surfaces.
const mat = (color, roughness = .85, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const random = seed => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const Z = TRAIN.centerZ, F = TRAIN.floorY;

function mineralTexture() {
  const n = 512, data = new Uint8Array(n * n * 4), rng = random(106);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const vein = Math.sin(x * .063 + Math.sin(y * .04) * 3) * Math.sin(y * .07 - x * .03);
    const v = Math.max(45, Math.min(240, 168 + vein * 12 + (rng() - .5) * 95));
    const i = (y * n + x) * 4; data.set([v, v, Math.round(v * .95), 255], i);
  }
  const texture = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(2, 2);
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true; texture.needsUpdate = true;
  return texture;
}

function merged(base, instances) {
  const source = base.index ? base.toNonIndexed() : base;
  const positions = [], normals = [], uvs = [], v = new THREE.Vector3(), normal = new THREE.Vector3();
  const matrix = new THREE.Matrix4(), normalMatrix = new THREE.Matrix3(), q = new THREE.Quaternion();
  for (const { p, s, r = [0, 0, 0] } of instances) {
    q.setFromEuler(new THREE.Euler(...r));
    matrix.compose(new THREE.Vector3(...p), q, new THREE.Vector3(...s)); normalMatrix.getNormalMatrix(matrix);
    for (let i = 0; i < source.attributes.position.count; i++) {
      v.fromBufferAttribute(source.attributes.position, i).applyMatrix4(matrix); positions.push(v.x, v.y, v.z);
      normal.fromBufferAttribute(source.attributes.normal, i).applyMatrix3(normalMatrix).normalize(); normals.push(normal.x, normal.y, normal.z);
      if (source.attributes.uv) uvs.push(source.attributes.uv.getX(i), source.attributes.uv.getY(i));
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  if (uvs.length) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeBoundingSphere(); if (source !== base) source.dispose();
  return geometry;
}

function rockGeometry(seed = 1, detail = 2) {
  const geometry = new THREE.IcosahedronGeometry(1, detail), a = geometry.attributes.position;
  for (let i = 0; i < a.count; i++) {
    const x = a.getX(i), y = a.getY(i), z = a.getZ(i);
    const noise = 1 + .11 * Math.sin(x * 8 + seed) * Math.cos(z * 7 - y * 6) + .05 * Math.sin(y * 17 + x * 4);
    a.setXYZ(i, x * noise, y * noise, z * noise);
  }
  geometry.computeVertexNormals(); return geometry;
}

function rock(parent, position, scale, material, seed) {
  const mesh = new THREE.Mesh(rockGeometry(seed), material); mesh.position.set(...position); mesh.scale.set(...scale); parent.add(mesh); return mesh;
}

function joinBranchMeshes(group, material) {
  const branches = group.children.filter(child => child.isMesh && child.material === material);
  const vertices = [], normals = [], uvs = [];
  for (const branch of branches) {
    const geometry = branch.geometry.index ? branch.geometry.toNonIndexed() : branch.geometry;
    vertices.push(...geometry.attributes.position.array); normals.push(...geometry.attributes.normal.array); uvs.push(...geometry.attributes.uv.array);
    group.remove(branch); if (geometry !== branch.geometry) geometry.dispose(); branch.geometry.dispose();
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  group.add(new THREE.Mesh(geometry, material));
}

function mossObject() {
  const group = new THREE.Group(), rng = random(28), lobes = [[], [], []];
  // A thick emerald carpet follows the upper face of the retained granite bed.
  const carpet = mat(0x4b5928); carpet.map = mineralTexture(); carpet.bumpMap = carpet.map; carpet.bumpScale = .025;
  group.add(new THREE.Mesh(carpetGeometry(.79, .47, .39, .48, .035), carpet));
  for (let i = 0; i < 440; i++) {
    const a = rng() * Math.PI * 2, radius = Math.sqrt(rng()), x = Math.cos(a) * radius * .73, z = Math.sin(a) * radius * .44;
    const y = .39 + .48 * Math.sqrt(Math.max(0, 1 - (radius * .9) ** 2));
    const size = .025 + rng() * .04;
    lobes[i % 3].push({ p: [x, y, z], s: [size, size * .48, size], r: [rng(), rng(), rng()] });
  }
  const base = new THREE.IcosahedronGeometry(1, 1);
  for (let i = 0; i < 3; i++) group.add(new THREE.Mesh(merged(base, lobes[i]), mat([0x59652d, 0x7b8543, 0x435327][i])));
  base.dispose(); return group;
}

function carpetGeometry(width, depth, low, height, ripple) {
  const vertices = [], uvs = [], indices = [], rings = 15, sides = 64;
  for (let r = 0; r <= rings; r++) for (let j = 0; j <= sides; j++) {
    const a = j / sides * Math.PI * 2, t = r / rings;
    const edge = 1 + .055 * Math.sin(a * 5) + .025 * Math.sin(a * 9 + .3);
    vertices.push(Math.cos(a) * t * width * edge, low + height * Math.sqrt(Math.max(0, 1 - (t * .91) ** 2)) + ripple * Math.sin(a * 6 + t * 9) * t, Math.sin(a) * t * depth * edge);
    uvs.push(.5 + Math.cos(a) * t * .5, .5 + Math.sin(a) * t * .5);
    if (r < rings && j < sides) { const p = r * (sides + 1) + j, q = p + sides + 1; indices.push(p, p + 1, q, q, p + 1, q + 1); }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

function snowObject() {
  const group = new THREE.Group();
  const snow = mat(0xeaf1ef, .96); snow.map = mineralTexture(); snow.bumpMap = snow.map; snow.bumpScale = .012; snow.side = THREE.DoubleSide;
  group.add(new THREE.Mesh(carpetGeometry(.8, .46, .29, .46, .023), snow));
  return group;
}

function treeObject(bark, seed = 47) {
  const group = new THREE.Group(), rng = random(seed);
  // The asymmetric windswept pine echoes the tree growing above the stone steps.
  tube(group, [[0, .05, 0], [.12, .36, .03], [-.08, .75, .06], [.05, 1.1, 0], [-.22, 1.5, -.03], [-.35, 1.9, -.01]], .12, bark);
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4;
    tube(group, [[.05, .23, 0], [Math.cos(a) * .25, .08, Math.sin(a) * .18], [Math.cos(a) * .53, .035, Math.sin(a) * .35]], .035, bark);
  }
  const crowns = [[], []], branchEnds = [[.56, 1.19, .2], [-.68, 1.38, .06], [.31, 1.72, -.15], [-.53, 1.96, -.09], [-.12, 2.12, .02]];
  for (const [index, end] of branchEnds.entries()) {
    const rootY = end[1] - .32;
    tube(group, [[rootY > 1.4 ? -.22 : 0, rootY, 0], [end[0] * .6, end[1] - .06, end[2]], end], .033, bark);
    for (let i = 0; i < 40; i++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * .37;
      crowns[index % 2].push({ p: [end[0] + Math.cos(a) * r, end[1] + rng() * .08, end[2] + Math.sin(a) * r * .65], s: [.07 + rng() * .08, .035 + rng() * .025, .045 + rng() * .07], r: [rng(), rng(), rng()] });
    }
  }
  const leaf = new THREE.IcosahedronGeometry(1, 1);
  crowns.forEach((instances, i) => group.add(new THREE.Mesh(merged(leaf, instances), mat(i ? 0x405847 : 0x253f32))));
  leaf.dispose(); joinBranchMeshes(group, bark); return group;
}

function fern(parent, p, size, material, phase = 0) {
  const leaf = new THREE.SphereGeometry(1, 5, 3), instances = [];
  for (let frond = 0; frond < 6; frond++) {
    const a = frond * Math.PI / 3 + phase;
    for (let k = 1; k <= 7; k++) {
      const t = k / 8, r = t * size * .65, y = Math.sin(t * Math.PI * .8) * size * .48;
      for (const side of [-1, 1]) instances.push({ p: [p[0] + Math.cos(a) * r + Math.sin(a) * side * .055 * size, p[1] + y, p[2] + Math.sin(a) * r - Math.cos(a) * side * .055 * size], s: [.11 * size * (1 - t * .6), .012 * size, .028 * size], r: [0, -a + side * .65, side * .12] });
    }
  }
  parent.add(new THREE.Mesh(merged(leaf, instances), material)); leaf.dispose();
}

function roofGeometry() {
  const positions = [], uvs = [], indices = [], nx = 100, na = 32;
  const at = (x, a) => [x, 3.28 + Math.sin(a) * .82, Z + Math.cos(a) * 1.96];
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= na; j++) {
    positions.push(...at(-15 + i / nx * 16, j / na * Math.PI)); uvs.push(i / nx * 8, j / na * 2);
  }
  for (let i = 0; i < nx; i++) for (let j = 0; j < na; j++) {
    const x = -15 + (i + .5) / nx * 16, side = ((j + .5) / na - .5) * 3.8;
    if ([-2, -5.5, -9, -12.5].some(center => ((x - center) / .91) ** 2 + (side / .65) ** 2 < 1)) continue;
    const a = i * (na + 1) + j, b = a + na + 1; indices.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

function windowFrame(parent, x, z, brass) {
  const width = 1.67, height = 1.13, radius = .17, points = [];
  for (const [cx, cy, start] of [[width / 2 - radius, height / 2 - radius, 0], [-width / 2 + radius, height / 2 - radius, Math.PI / 2], [-width / 2 + radius, -height / 2 + radius, Math.PI], [width / 2 - radius, -height / 2 + radius, Math.PI * 1.5]]) {
    for (let k = 0; k <= 6; k++) { const a = start + k / 6 * Math.PI / 2; points.push([x + cx + radius * Math.cos(a), 2.62 + cy + radius * Math.sin(a), z]); }
  }
  tube(parent, points, .045, brass, true);
}

export function buildForestCarriage() {
  const group = new THREE.Group(); group.name = 'forest-05';
  const travelingTrees = [];
  const mineral = mineralTexture(), stone = mat(0x9b9d95, .9); stone.map = mineral; stone.bumpMap = mineral; stone.bumpScale = .025; stone.side = THREE.DoubleSide;
  const darkStone = stone.clone(); darkStone.color.setHex(0x646e68);
  const brass = mat(0x736448, .34, .65), bark = mat(0x47483b), fernMat = mat(0x526c35);
  const water = mat(0x344b44, .19, .35); water.transparent = true; water.opacity = .86;
  const warmLine = new THREE.MeshBasicMaterial({ color: 0xb9a57c, toneMapped: false });

  // Jointed, wet granite floor, with the two meltwater channels outside the aisle.
  box(group, [16, .18, 3.95], [-7, F - .13, Z], darkStone);
  const paving = [], channels = [];
  for (let x = -.1; x > -15; x -= .88) {
    for (const dz of [-.49, .49]) paving.push([[.85, .08, .95], [x, F - .045, Z + dz]]);
    for (const side of [-1, 1]) {
      channels.push([[.87, .035, .23], [x, F - .018, Z + side * 1.095]]);
      paving.push([[.85, .08, .63], [x, F - .045, Z + side * 1.61]]);
    }
  }
  boxes(group, paving, stone); boxes(group, channels, water);
  const pebbles = [], rng = random(231);
  for (let i = 0; i < 110; i++) pebbles.push({ p: [-rng() * 15, F - .02, Z + (i % 2 ? -1 : 1) * (1.04 + rng() * .11)], s: [.025 + rng() * .04, .015, .025 + rng() * .025] });
  const pebble = new THREE.IcosahedronGeometry(1, 0); group.add(new THREE.Mesh(merged(pebble, pebbles), darkStone)); pebble.dispose();

  // Original train proportions survive through the brass ribs and open windows.
  for (const side of [-1, 1]) {
    const wallZ = Z + side * 1.96;
    box(group, [16, .94, .13], [-7, 1.51, wallZ], stone);
    box(group, [16, .22, .13], [-7, 3.21, wallZ], stone);
    for (let x = -.1; x > -15; x -= 2.15) {
      box(group, [.46, 1.15, .15], [x - 1.065, 2.62, wallZ], stone);
      windowFrame(group, x, wallZ - side * .04, brass);
    }
    box(group, [15.8, .027, .026], [-7, 3.36, Z + side * 1.88], warmLine);
    box(group, [15.8, .045, .04], [-7, 1.18, Z + side * 1.85], brass);
  }
  group.add(new THREE.Mesh(roofGeometry(), stone));
  for (const x of [-.25, -3.65, -7.2, -10.7, -14.3]) {
    const points = Array.from({ length: 27 }, (_, i) => { const a = i / 26 * Math.PI; return [x, 3.27 + Math.sin(a) * .82, Z + Math.cos(a) * 1.94]; });
    tube(group, points, .032, brass);
  }
  for (const x of [-2, -5.5, -9, -12.5]) {
    const points = Array.from({ length: 33 }, (_, i) => { const a = i / 32 * Math.PI * 2, angle = Math.PI / 2 + Math.sin(a) * .53; return [x + Math.cos(a) * .96, 3.28 + Math.sin(angle) * .82 - .015, Z + Math.cos(angle) * 1.96]; });
    tube(group, points, .027, brass, true);
  }

  // Rock banks curl into the lower walls, leaving the entire walking line open.
  for (const [x, side, sx, sy, sz] of [[-2.2, -1, 1.2, .72, .49], [-4.4, 1, 1.15, .68, .47], [-6.4, -1, .9, .46, .44], [-11.6, -1, 1.3, .85, .52], [-13, 1, 1.6, .9, .5]]) {
    rock(group, [x, F + sy * .35, Z + side * 1.67], [sx, sy, sz], stone, x);
    fern(group, [x + .2, F + sy * .85, Z + side * 1.6], .45, fernMat, x);
  }

  const mossPosition = [-8.08, F, Z + 1.36], snowPosition = [-8.7, F, Z - 1.36], treePosition = [-10.5, F, Z + 1.4];
  rock(group, [mossPosition[0], F + .38, mossPosition[2]], [.84, .46, .49], darkStone, 27);
  rock(group, [snowPosition[0], F + .24, snowPosition[2]], [.87, .42, .49], stone, 72);
  rock(group, [treePosition[0], F + .06, treePosition[2]], [.67, .13, .5], darkStone, 13);

  // Forest outside every opening: pale distant stone, layered trunks and canopies.
  box(group, [40, .2, 28], [-7, .69, Z], mat(0x657263));
  const distantBark = mat(0x667165), nearBark = mat(0x485347), foliage = mat(0x536851);
  for (let i = 0; i < 26; i++) {
    const side = i % 2 ? 1 : -1, x = 5 - rng() * 27, z = Z + side * (3.3 + rng() * 8), h = 5.2 + rng() * 5;
    const tree = new THREE.Group(); tree.position.x = x; group.add(tree); travelingTrees.push(tree);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.1, .2 + rng() * .13, h, 7), i % 3 ? distantBark : nearBark);
    trunk.position.set(0, .8 + h / 2, z); trunk.rotation.z = (rng() - .5) * .12; tree.add(trunk);
    rock(tree, [0, h + .4, z], [2.1 + rng(), .8 + rng() * .6, 1.9 + rng()], foliage, i);
  }
  for (const [x, z, s] of [[-9, -13, 3], [-22, 13, 4], [3, 11, 2.5]]) rock(group, [x, .8, Z + z], [s, s * 1.2, s], stone, x);
  for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
    const tree = treeObject(nearBark, 10 + i); tree.position.set(-3 - i * 3.5, .75, Z + side * (3.8 + (i % 2) * 1.1)); tree.scale.setScalar(2.2 + i % 2 * .3); tree.rotation.y = i * 1.7; group.add(tree); travelingTrees.push(tree);
  }

  // The onward portal is part of the architecture, never an instruction panel.
  for (const side of [-1, 1]) box(group, [.24, 3.05, 1.18], [-14.8, 2.55, Z + side * 1.34], darkStone);
  box(group, [.24, .53, 1.5], [-14.8, 3.78, Z], darkStone);
  for (const side of [-1, 1]) box(group, [.27, 2.5, .06], [-14.65, 2.32, Z + side * .74], brass);
  box(group, [.27, .06, 1.53], [-14.65, 3.55, Z], brass);
  box(group, [.1, 2.5, 1.44], [-15.05, 2.3, Z], mat(0x28342f));
  for (const x of [-3.3, -8.5, -12.4]) { const light = new THREE.PointLight(0xdbe7cd, 5.8, 7, 2); light.position.set(x, 3.72, Z); group.add(light); }

  return {
    group,
    targets: [
      { id: '05-moss', group: mossObject(), position: mossPosition, aim: [mossPosition[0], F + .72, mossPosition[2]] },
      { id: '05-snow', group: snowObject(), position: snowPosition, aim: [snowPosition[0], F + .57, snowPosition[2]] },
      { id: '05-tree', group: treeObject(bark), position: treePosition, aim: [treePosition[0] - .1, F + 1.42, treePosition[2]] },
    ],
    lighting: { background: 0x899a8c, fogNear: 10, fogFar: 34, hemisphere: 0xe0e7d8, ground: 0x566750, sun: 0xf1e6ce, environmentIntensity: .65 },
    update(dt, reducedMotion) {
      if (!group.visible || reducedMotion) return;
      const step = Math.min(.1, Math.max(0, dt)) * .32;
      for (const tree of travelingTrees) { tree.position.x += step; if (tree.position.x > 9) tree.position.x -= 37; }
    },
  };
}
