import * as T from './vendor/three.module.js';

const TAU = Math.PI * 2;
const smooth = (value, lower, upper) => T.MathUtils.smoothstep(value, lower, upper);
const bell = (value, center, width) => Math.exp(-(((value - center) / width) ** 2));

function fabric(kind) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  const pixels = context.createImageData(256, 256);
  let seed = 37;
  for (let row = 0; row < 256; row++) for (let column = 0; column < 256; column++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const grain = (seed / 4294967296 - .5) * 15;
    const pattern = kind === 'knit' ? Math.cos(column * TAU / 8) * 28 + Math.sin(row * TAU / 4) * 7 : kind === 'twill' ? Math.sin((column + row) * TAU / 6) * 14 : kind === 'hair' ? Math.sin(column * TAU / 5) * 28 + Math.cos(column * TAU / 11) * 10 : grain * .3;
    const shade = T.MathUtils.clamp(145 + grain + pattern, 0, 255);
    const offset = (row * 256 + column) * 4;
    pixels.data[offset] = pixels.data[offset + 1] = pixels.data[offset + 2] = shade;
    pixels.data[offset + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  const texture = new T.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(kind === 'skin' ? 2 : 3, kind === 'knit' ? 3 : 5);
  return texture;
}

function surface(rings, segments = 40, fold = 0) {
  const original = rings;
  rings = [];
  for (let row = 0; row < original.length - 1; row++) for (let step = 0; step < 2; step++) {
    const fraction = step / 2, interpolated = {};
    for (const field of ['y', 'x', 'z', 'width', 'depth', 'bust', 'edge']) {
      const before = original[Math.max(0, row - 1)][field] || 0, start = original[row][field] || 0;
      const end = original[row + 1][field] || 0, after = original[Math.min(original.length - 1, row + 2)][field] || 0;
      interpolated[field] = .5 * (2 * start + (-before + end) * fraction + (2 * before - 5 * start + 4 * end - after) * fraction ** 2 + (-before + 3 * start - 3 * end + after) * fraction ** 3);
    }
    rings.push(interpolated);
  }
  rings.push(original.at(-1));
  const positions = [], coordinates = [], indices = [];
  rings.forEach((ring, row) => {
    for (let column = 0; column <= segments; column++) {
      const angle = column / segments * TAU;
      const crease = 1 + fold * (Math.cos(angle * 11 + ring.y * 3) + .4 * Math.sin(angle * 17 - ring.y * 7));
      const front = Math.max(0, Math.cos(angle));
      positions.push((ring.x || 0) + Math.sin(angle) * ring.width * crease, ring.y + (ring.edge || 0) * front ** 4, (ring.z || 0) + Math.cos(angle) * ring.depth * crease + (ring.bust || 0) * front ** 3);
      coordinates.push(column / segments, row / (rings.length - 1));
      if (row < rings.length - 1 && column < segments) {
        const vertex = row * (segments + 1) + column;
        indices.push(vertex, vertex + 1, vertex + segments + 1, vertex + 1, vertex + segments + 2, vertex + segments + 1);
      }
    }
  });
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(coordinates, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function combine(geometries) {
  const arrays = { position: [], normal: [], uv: [] };
  for (const source of geometries) {
    const geometry = source.index ? source.toNonIndexed() : source;
    for (const name of Object.keys(arrays)) {
      const attribute = geometry.getAttribute(name);
      if (attribute) arrays[name].push(...attribute.array);
      else arrays[name].push(...new Float32Array(geometry.getAttribute('position').count * (name === 'uv' ? 2 : 3)));
    }
    if (geometry !== source) geometry.dispose();
    source.dispose();
  }
  const result = new T.BufferGeometry();
  for (const [name, values] of Object.entries(arrays)) result.setAttribute(name, new T.Float32BufferAttribute(values, name === 'uv' ? 2 : 3));
  return result;
}

export function createCharacter({ mobile = false } = {}) {
  const scene = new T.Group();
  scene.name = 'Handcrafted Rosebay character';
  const skinMap = fabric('skin'), knitMap = fabric('knit'), trouserMap = fabric('twill'), hairMap = fabric('hair');
  const skin = new T.MeshPhysicalMaterial({ name: 'Skin', color: '#bb886c', roughness: .54, bumpMap: skinMap, bumpScale: .00065, clearcoat: .05, clearcoatRoughness: .75 });
  const top = new T.MeshStandardMaterial({ name: 'Top', color: '#d894aa', roughness: .89, bumpMap: knitMap, bumpScale: .0024, side: T.DoubleSide });
  const pants = new T.MeshStandardMaterial({ name: 'Trousers', color: '#27272c', roughness: .94, bumpMap: trouserMap, bumpScale: .0018, side: T.DoubleSide });
  const seams = new T.MeshStandardMaterial({ color: '#414046', roughness: 1 });
  const sole = new T.MeshStandardMaterial({ color: '#c5bbaa', roughness: .9 });
  const shoe = new T.MeshStandardMaterial({ color: '#e8dfce', roughness: .72, bumpMap: trouserMap, bumpScale: .001 });
  const gold = new T.MeshStandardMaterial({ color: '#c9a970', metalness: .75, roughness: .3 });
  const lip = new T.MeshPhysicalMaterial({ color: '#a76e69', roughness: .6, clearcoat: .06, side: T.DoubleSide });
  const nails = new T.MeshPhysicalMaterial({ name: 'Natural nails', color: '#c49988', roughness: .42, clearcoat: .35 });
  const pinkSeam = new T.MeshStandardMaterial({ name: 'Knit edging', color: '#bd7d91', roughness: .95 });
  const crease = new T.MeshStandardMaterial({ color: '#68453d', roughness: .8 });
  const sclera = new T.MeshStandardMaterial({ color: '#d6cec0', roughness: .35 });
  const iris = new T.MeshPhysicalMaterial({ color: '#4b3428', roughness: .23, clearcoat: .8 });
  const irisCanvas = document.createElement('canvas'); irisCanvas.width = irisCanvas.height = 128;
  const irisContext = irisCanvas.getContext('2d'), irisPixels = irisContext.createImageData(128, 128);
  for (let row = 0; row < 128; row++) for (let column = 0; column < 128; column++) {
    const horizontal = (column - 63.5) / 63.5, vertical = (row - 63.5) / 63.5;
    const radius = Math.hypot(horizontal, vertical), angle = Math.atan2(vertical, horizontal);
    const fiber = Math.sin(angle * 73 + radius * 12) * 8 + Math.cos(angle * 119 - radius * 21) * 5;
    const edge = 1 - smooth(radius, .78, 1), pupilMask = smooth(radius, .32, .39);
    const offset = (row * 128 + column) * 4;
    irisPixels.data[offset] = (51 + fiber + bell(radius, .48, .2) * 26) * edge * pupilMask + 15;
    irisPixels.data[offset + 1] = (29 + fiber * .6 + bell(radius, .48, .2) * 15) * edge * pupilMask + 12;
    irisPixels.data[offset + 2] = (15 + fiber * .3) * edge * pupilMask + 10;
    irisPixels.data[offset + 3] = 255;
  }
  irisContext.putImageData(irisPixels, 0, 0);
  const irisTexture = new T.CanvasTexture(irisCanvas); irisTexture.colorSpace = T.SRGBColorSpace;
  const irisDetail = new T.MeshPhysicalMaterial({ name: 'Iris fibers', map: irisTexture, roughness: .2, clearcoat: 1, clearcoatRoughness: .12 });
  const pupil = new T.MeshBasicMaterial({ color: '#17191a' });
  const highlight = new T.MeshBasicMaterial({ color: '#e9e2d2' });
  const hairMaterials = ['#29211f', '#302521', '#372922', '#3d2d25'].map(color => new T.MeshPhysicalMaterial({ name: 'Hair', color, roughness: .58, bumpMap: hairMap, bumpScale: .0007, metalness: .01, clearcoat: .1, clearcoatRoughness: .65, side: T.DoubleSide }));
  const bones = [], joints = {}, eyes = [];
  function bone(name, parent, x, y, z = 0) {
    const joint = new T.Bone();
    joint.name = name; joint.position.set(x, y, z);
    parent.add(joint); bones.push(joint); joints[name] = joint;
    return joint;
  }
  const hips = bone('hips', scene, 0, 1.25);
  const spine = bone('spine', hips, 0, .23);
  const chest = bone('chest', spine, 0, .31);
  const neck = bone('neck', chest, 0, .22);
  const head = bone('head', neck, 0, .11);
  for (const [side, sign] of [['left', 1], ['right', -1]]) {
    const thigh = bone(side + 'UpperLeg', hips, sign * .12, -.03);
    const shin = bone(side + 'LowerLeg', thigh, 0, -.56);
    bone(side + 'Foot', shin, 0, -.54);
    const upper = bone(side + 'UpperArm', chest, sign * .295, .105);
    const lower = bone(side + 'LowerArm', upper, sign * .025, -.315);
    bone(side + 'Hand', lower, sign * .022, -.285);
  }
  scene.updateMatrixWorld(true);
  const skeleton = new T.Skeleton(bones);
  const origins = new Map(bones.map(joint => [joint, joint.getWorldPosition(new T.Vector3())]));
  const batches = new Map();
  function rigid(geometry, material, parent = head) {
    const origin = origins.get(parent);
    if (origin) geometry.translate(-origin.x, -origin.y, -origin.z);
    const key = parent.uuid + material.uuid;
    if (!batches.has(key)) batches.set(key, { material, parent, geometries: [] });
    batches.get(key).geometries.push(geometry);
  }
  function ellipsoid(x, y, z, width, height, depth, material, parent = head) {
    const large = Math.max(width, height, depth) > .025;
    const geometry = new T.SphereGeometry(1, large ? mobile ? 16 : 24 : 10, large ? mobile ? 12 : 18 : 8);
    geometry.scale(width, height, depth); geometry.translate(x, y, z); rigid(geometry, material, parent);
  }
  function strand(points, radius, material, parent = head, radial = 5) {
    const curve = new T.CatmullRomCurve3(points.map(point => new T.Vector3(...point)));
    const segments = points.length === 2 ? 2 : points.length === 3 ? 8 : mobile ? 16 : 28;
    rigid(new T.TubeGeometry(curve, segments, radius, radial, false), material, parent);
  }
  function hairLock(points, width, angle, material) {
    const curve = new T.CatmullRomCurve3(points.map(point => new T.Vector3(...point)));
    const position = [], coordinates = [], indices = [], segments = mobile ? 18 : 30, radial = 6;
    for (let row = 0; row <= segments; row++) {
      const along = row / segments, point = curve.getPoint(along), taper = .1 + .9 * Math.sin(Math.PI * along) ** .28;
      for (let column = 0; column <= radial; column++) {
        const around = column / radial * TAU, across = Math.cos(around) * width * taper, depth = Math.sin(around) * .0035;
        position.push(point.x + Math.cos(angle) * across + Math.sin(angle) * depth, point.y, point.z - Math.sin(angle) * across + Math.cos(angle) * depth);
        coordinates.push(column / radial, along);
        if (row < segments && column < radial) { const vertex = row * (radial + 1) + column; indices.push(vertex, vertex + 1, vertex + radial + 1, vertex + 1, vertex + radial + 2, vertex + radial + 1); }
      }
    }
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(position, 3)); geometry.setAttribute('uv', new T.Float32BufferAttribute(coordinates, 2)); geometry.setIndex(indices); geometry.computeVertexNormals(); rigid(geometry, material);
  }
  function skinned(geometry, material, weighting) {
    const position = geometry.getAttribute('position'), indices = [], weights = [];
    for (let index = 0; index < position.count; index++) {
      const assignment = weighting(position.getX(index), position.getY(index), position.getZ(index));
      indices.push(bones.indexOf(assignment[0]), bones.indexOf(assignment[1] || assignment[0]), 0, 0);
      weights.push(assignment[2] ?? 1, 1 - (assignment[2] ?? 1), 0, 0);
    }
    geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(indices, 4));
    geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(weights, 4));
    const mesh = new T.SkinnedMesh(geometry, material);
    mesh.name = material.name; mesh.castShadow = true; mesh.receiveShadow = false;
    mesh.frustumCulled = false; scene.add(mesh); mesh.bind(skeleton); return mesh;
  }
  const torsoWeight = (x, y) => y < 1.57 ? [hips, spine, 1 - smooth(y, 1.34, 1.57)] : [spine, chest, 1 - smooth(y, 1.57, 1.83)];
  skinned(surface([
    { y: 1.32, width: .204, depth: .124 }, { y: 1.4, width: .19, depth: .114 }, { y: 1.49, width: .184, depth: .113 },
    { y: 1.59, width: .2, depth: .122 }, { y: 1.71, width: .232, depth: .13, bust: .018 },
    { y: 1.8, width: .248, depth: .132, bust: .024 }, { y: 1.89, width: .261, depth: .119 },
    { y: 1.94, width: .225, depth: .105 }, { y: 1.985, width: .09, depth: .072 }, { y: 2.1, width: .061, depth: .061 },
  ]), skin, torsoWeight);
  skinned(surface([
    { y: 1.49, width: .19, depth: .12 }, { y: 1.505, width: .193, depth: .122 }, { y: 1.57, width: .203, depth: .128 },
    { y: 1.67, width: .225, depth: .136, bust: .017 }, { y: 1.76, width: .246, depth: .141, bust: .025 },
    { y: 1.815, width: .252, depth: .14, bust: .018 }, { y: 1.865, width: .245, depth: .121, edge: -.045 },
  ], mobile ? 40 : 64, .006), top, torsoWeight);
  for (const sign of [-1, 1]) {
    const points = [[sign * .183, 1.82, .105], [sign * .19, 1.91, .095], [sign * .196, 1.961, .03], [sign * .19, 1.947, -.047], [sign * .182, 1.845, -.104]];
    const curve = new T.CatmullRomCurve3(points.map(point => new T.Vector3(...point)));
    const positions = [], coordinates = [], indices = [];
    for (let row = 0; row <= 24; row++) {
      const point = curve.getPoint(row / 24);
      for (const side of [-1, 1]) { positions.push(point.x + side * .022, point.y, point.z); coordinates.push((side + 1) / 2, row / 24); }
      if (row < 24) { const offset = row * 2; indices.push(offset, offset + 1, offset + 2, offset + 1, offset + 3, offset + 2); }
    }
    const strap = new T.BufferGeometry(); strap.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); strap.setAttribute('uv', new T.Float32BufferAttribute(coordinates, 2)); strap.setIndex(indices); strap.computeVertexNormals(); skinned(strap, top, torsoWeight);
  }
  for (const [height, width, depth, dip] of [[1.865, .245, .122, -.045], [1.494, .193, .123, 0]]) {
    const points = [];
    for (let index = 0; index <= 56; index++) {
      const angle = index / 56 * TAU;
      points.push([Math.sin(angle) * width, height + dip * Math.max(0, Math.cos(angle)) ** 4, Math.cos(angle) * depth]);
    }
    strand(points, .0023, pinkSeam, chest, 5);
  }
  for (const [side, sign] of [['left', 1], ['right', -1]]) {
    const upperLeg = joints[side + 'UpperLeg'], lowerLeg = joints[side + 'LowerLeg'];
    const legWeight = (x, y) => y > 1.17 ? [hips, upperLeg, smooth(y, 1.17, 1.34)] : [upperLeg, lowerLeg, smooth(y, .52, .82)];
    skinned(surface([
      { y: .125, x: sign * .133, width: .15, depth: .128, z: .018 }, { y: .16, x: sign * .133, width: .158, depth: .13, z: .012 },
      { y: .3, x: sign * .129, width: .148, depth: .124 }, { y: .49, x: sign * .125, width: .139, depth: .116 },
      { y: .67, x: sign * .122, width: .135, depth: .112 }, { y: .82, x: sign * .122, width: .142, depth: .126 },
      { y: 1.02, x: sign * .122, width: .15, depth: .143, z: -.008 }, { y: 1.17, x: sign * .12, width: .148, depth: .153, z: -.009 },
      { y: 1.29, x: sign * .116, width: .137, depth: .146 }, { y: 1.365, x: sign * .112, width: .124, depth: .134 },
    ], mobile ? 40 : 64, .018), pants, legWeight);
    const upperArm = joints[side + 'UpperArm'], lowerArm = joints[side + 'LowerArm'], hand = joints[side + 'Hand'];
    const armWeight = (x, y) => [upperArm, lowerArm, smooth(y, 1.48, 1.69)];
    skinned(surface([
      { y: 1.29, x: sign * .342, width: .027, depth: .029 }, { y: 1.37, x: sign * .337, width: .034, depth: .033 },
      { y: 1.48, x: sign * .328, width: .047, depth: .043 }, { y: 1.57, x: sign * .32, width: .043, depth: .043 },
      { y: 1.68, x: sign * .313, width: .053, depth: .05 }, { y: 1.8, x: sign * .302, width: .061, depth: .06 },
      { y: 1.89, x: sign * .283, width: .071, depth: .067 }, { y: 1.945, x: sign * .258, width: .045, depth: .04 },
    ], 28), skin, armWeight);
    ellipsoid(sign * .345, 1.255, .008, .032, .058, .021, skin, hand);
    for (let finger = 0; finger < 4; finger++) {
      const x = sign * (.324 + finger * .014), length = [.058, .071, .066, .051][finger];
      strand([[x, 1.233, .017], [x + sign * .003, 1.205, .022], [x + sign * .004, 1.233 - length, .035]], .007, skin, hand, 6);
      ellipsoid(x + sign * .003, 1.211, .019, .0075, .008, .007, skin, hand);
      ellipsoid(x + sign * .004, 1.24 - length, .029, .0044, .008, .0012, nails, hand);
    }
    strand([[sign * .32, 1.272, .025], [sign * .307, 1.245, .04], [sign * .312, 1.225, .052]], .009, skin, hand, 6);
    const foot = joints[side + 'Foot'];
    ellipsoid(sign * .13, .071, .065, .104, .051, .177, sole, foot);
    ellipsoid(sign * .13, .106, .057, .096, .069, .16, shoe, foot);
    for (let lace = 0; lace < 4; lace++) strand([[sign * .13 - .04, .165 - lace * .003, .027 + lace * .019], [sign * .13, .172 - lace * .003, .034 + lace * .019], [sign * .13 + .04, .165 - lace * .003, .027 + lace * .019]], .0021, sole, foot, 4);
    for (let perforation = 0; perforation < 6; perforation++) {
      const horizontal = (perforation % 3 - 1) * .022;
      ellipsoid(sign * .13 + horizontal, .151 - Math.floor(perforation / 3) * .009, .115 + Math.floor(perforation / 3) * .022, .0017, .001, .002, sole, foot);
    }
    strand([[sign * .13 - .065, .094, .155], [sign * .13, .105, .193], [sign * .13 + .065, .094, .155]], .0018, sole, foot, 4);
    strand([[sign * .257, 1.3, .005], [sign * .263, 1.08, .012], [sign * .263, .83, .012]], .0015, seams, upperLeg, 4);
    strand([[sign * .07, 1.34, .135], [sign * .12, 1.26, .145], [sign * .21, 1.21, .12]], .0017, seams, hips, 4);
    strand([[sign * .09, 1.326, .146], [sign * .092, 1.255, .157], [sign * .11, 1.15, .153]], .0025, seams, hips, 4);
    for (const front of [-1, 1]) {
      const loop = new T.BoxGeometry(.012, .05, .006); loop.translate(sign * .159, 1.351, front * .104); rigid(loop, seams, hips);
    }
  }
  rigid(surface([{ y: 1.329, width: .246, depth: .143 }, { y: 1.372, width: .237, depth: .136 }], 64, .004), pants, hips);
  ellipsoid(0, 1.346, .144, .009, .009, .003, gold, hips);
  strand([[0, 1.335, .143], [.004, 1.26, .151], [.005, 1.175, .152]], .0015, seams, hips, 4);
  const headGeometry = new T.SphereGeometry(1, mobile ? 48 : 64, mobile ? 36 : 48);
  const vertices = headGeometry.getAttribute('position'), complexion = [];
  const baseSkin = new T.Color('#bb886c'), cheekColor = new T.Color('#ba7871'), shadowSkin = new T.Color('#a37965');
  for (let index = 0; index < vertices.count; index++) {
    const unitX = vertices.getX(index), unitY = vertices.getY(index), unitZ = vertices.getZ(index);
    const y = 2.246 + unitY * .195;
    const jaw = .77 + .23 * smooth(unitY, -.9, -.05);
    const x = unitX * .134 * jaw;
    let z = unitZ * .123;
    if (unitZ > 0) {
      z += .01 * (bell(x, -.065, .035) + bell(x, .065, .035)) * bell(y, 2.218, .035);
      z -= .008 * (bell(x, -.05, .025) + bell(x, .05, .025)) * bell(y, 2.275, .017);
      z += .024 * bell(x, 0, .013) * bell(y, 2.26, .05);
      z += .034 * bell(x, 0, .021) * bell(y, 2.216, .018);
      z += .009 * bell(x, 0, .035) * bell(y, 2.169, .022);
      z += .006 * bell(x, 0, .038) * bell(y, 2.101, .022);
      z -= .003 * (bell(x, -.025, .009) + bell(x, .025, .009)) * bell(y, 2.181, .028);
      z += .003 * (bell(x, -.052, .033) + bell(x, .052, .033)) * bell(y, 2.299, .016);
    }
    vertices.setXYZ(index, x, y, z);
    const cheek = unitZ > 0 ? (bell(x, -.07, .035) + bell(x, .07, .035)) * bell(y, 2.219, .029) * .33 : 0;
    const temple = (bell(x, -.12, .022) + bell(x, .12, .022)) * bell(y, 2.267, .07) * .2;
    const color = baseSkin.clone().lerp(cheekColor, cheek).lerp(shadowSkin, temple);
    complexion.push(color.r, color.g, color.b);
  }
  headGeometry.setAttribute('color', new T.Float32BufferAttribute(complexion, 3));
  const faceSkin = skin.clone(); faceSkin.name = 'Face complexion'; faceSkin.color.set('#ffffff'); faceSkin.vertexColors = true;
  headGeometry.computeVertexNormals();
  const faceMesh = new T.Mesh(headGeometry, faceSkin); faceMesh.name = 'Sculpted face';
  faceMesh.geometry.translate(0, -origins.get(head).y, 0); faceMesh.castShadow = true; head.add(faceMesh);
  for (const sign of [-1, 1]) {
    ellipsoid(sign * .127, 2.238, -.008, .02, .039, .023, skin);
    ellipsoid(sign * .139, 2.237, .001, .004, .022, .012, lip);
    const ring = new T.TorusGeometry(.013, .0018, 5, 18); ring.rotateY(Math.PI / 2); ring.translate(sign * .145, 2.212, -.003); rigid(ring, gold);
    const centerX = sign * .049;
    const eyeGroup = new T.Group(); eyeGroup.name = sign > 0 ? 'Left eye' : 'Right eye';
    eyeGroup.position.set(centerX, 2.275 - origins.get(head).y, .111); head.add(eyeGroup);
    origins.set(eyeGroup, new T.Vector3(centerX, 2.275, .111)); eyes.push(eyeGroup);
    const position = [], uv = [], indices = [];
    for (let row = 0; row <= 8; row++) for (let column = 0; column <= 24; column++) {
      const across = column / 24 * 2 - 1, vertical = row / 8 * 2 - 1;
      const arch = Math.sqrt(Math.max(0, 1 - across * across));
      position.push(centerX + across * .024, 2.275 + arch * vertical * .0095 + across * sign * .0025, .108 + arch * Math.sqrt(Math.max(0, 1 - vertical * vertical)) * .009);
      uv.push(column / 24, row / 8);
      if (row < 8 && column < 24) { const vertex = row * 25 + column; indices.push(vertex, vertex + 1, vertex + 25, vertex + 1, vertex + 26, vertex + 25); }
    }
    const eye = new T.BufferGeometry(); eye.setAttribute('position', new T.Float32BufferAttribute(position, 3)); eye.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); eye.setIndex(indices); eye.computeVertexNormals(); rigid(eye, sclera, eyeGroup);
    ellipsoid(centerX, 2.275, .1175, .0085, .0086, .0025, iris, eyeGroup);
    const irisDisc = new T.CircleGeometry(.0078, mobile ? 24 : 40); irisDisc.translate(centerX, 2.275, .1202); rigid(irisDisc, irisDetail, eyeGroup);
    ellipsoid(centerX, 2.275, .1205, .0031, .0035, .0007, pupil, eyeGroup);
    ellipsoid(centerX - .0022, 2.278, .1215, .0012, .0011, .0005, highlight, eyeGroup);
    for (const vertical of [-1, 1]) {
      const points = [];
      for (let step = 0; step <= 16; step++) {
        const across = step / 8 - 1, arch = Math.sqrt(Math.max(0, 1 - across * across));
        points.push([centerX + across * .0245, 2.275 + vertical * arch * .01 + across * sign * .0025, .111 + arch * .002]);
      }
      strand(points, vertical === 1 ? .00145 : .0008, vertical === 1 ? hairMaterials[0] : lip, eyeGroup, 4);
    }
    for (let lash = 0; lash < (mobile ? 4 : 7); lash++) {
      const across = sign * (.1 + lash / (mobile ? 4 : 7) * .8), arch = Math.sqrt(1 - across * across), horizontal = centerX + across * .0245;
      strand([[horizontal, 2.275 + arch * .01 + across * sign * .0025, .112], [horizontal + sign * .0015, 2.279 + arch * .01, .115], [horizontal + sign * .0028, 2.28 + arch * .01, .114]], .00055, hairMaterials[0], eyeGroup, 3);
    }
    for (let brow = 0; brow < 14; brow++) {
      const across = brow / 13, horizontal = centerX + sign * (across - .5) * .052;
      const vertical = 2.303 + Math.sin(across * Math.PI) * .007;
      strand([[horizontal, vertical, .108 - across * .007], [horizontal + sign * .002, vertical + .0035, .108 - across * .007]], .00085, hairMaterials[1], head, 4);
    }
    ellipsoid(sign * .01, 2.207, .149, .0044, .0022, .002, crease);
  }
  for (const upper of [true, false]) {
    const positions = [], coordinates = [], indices = [];
    for (let row = 0; row <= 6; row++) for (let column = 0; column <= 32; column++) {
      const across = column / 16 - 1, fullness = Math.sqrt(Math.max(0, 1 - across * across)), outward = row / 6;
      const cupid = .0017 * bell(Math.abs(across), .28, .22), smile = across * across * .002;
      positions.push(across * .028, 2.168 + smile + outward * (upper ? .004 * fullness + cupid : -.0058 * fullness), .128 + fullness * .004 + Math.sin(outward * Math.PI) * .002);
      coordinates.push(column / 32, outward);
      if (row < 6 && column < 32) { const vertex = row * 33 + column; indices.push(vertex, vertex + 1, vertex + 33, vertex + 1, vertex + 34, vertex + 33); }
    }
    const lipGeometry = new T.BufferGeometry(); lipGeometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); lipGeometry.setAttribute('uv', new T.Float32BufferAttribute(coordinates, 2)); lipGeometry.setIndex(indices); lipGeometry.computeVertexNormals(); rigid(lipGeometry, lip);
  }
  strand([[-.027, 2.17, .13], [0, 2.168, .1325], [.027, 2.17, .13]], .00055, crease, head, 4);
  strand([[-.066, 2.015, .049], [-.055, 1.964, .097], [0, 1.925, .127], [.055, 1.964, .097], [.066, 2.015, .049]], .0016, gold, chest, 5);
  ellipsoid(0, 1.917, .129, .007, .009, .0035, gold, chest);
  const scalpPosition = [], scalpUv = [], scalpIndices = [];
  for (let row = 0; row <= 32; row++) for (let column = 0; column <= 64; column++) {
    const around = column / 64 * TAU, front = Math.max(0, Math.cos(around));
    const hairline = 1.85 - .76 * front ** 3 + .045 * Math.sin(around * 2) * front;
    const polar = row / 32 * hairline;
    scalpPosition.push(Math.sin(around) * Math.sin(polar) * .144, 2.256 + Math.cos(polar) * .202, -.015 + Math.cos(around) * Math.sin(polar) * .135);
    scalpUv.push(column / 64, row / 32);
    if (row < 32 && column < 64) { const vertex = row * 65 + column; scalpIndices.push(vertex, vertex + 65, vertex + 1, vertex + 1, vertex + 65, vertex + 66); }
  }
  const scalp = new T.BufferGeometry(); scalp.setAttribute('position', new T.Float32BufferAttribute(scalpPosition, 3)); scalp.setAttribute('uv', new T.Float32BufferAttribute(scalpUv, 2)); scalp.setIndex(scalpIndices); scalp.computeVertexNormals(); rigid(scalp, hairMaterials[0]);
  const curtainPosition = [], curtainUv = [], curtainIndex = [];
  for (let row = 0; row <= 30; row++) for (let column = 0; column <= 56; column++) {
    const along = row / 30, angle = .96 + column / 56 * (TAU - 1.92);
    const wave = Math.sin(along * 12 + angle * 5) * .009 + Math.sin(angle * 18) * .003;
    const width = .132 + .044 * smooth(along, 0, .3) + wave;
    curtainPosition.push(Math.sin(angle) * width, 2.385 - along * (.66 + .03 * Math.sin(angle * 7)), -.026 + Math.cos(angle) * (.122 + .025 * along + wave));
    curtainUv.push(column / 56, along);
    if (row < 30 && column < 56) { const vertex = row * 57 + column; curtainIndex.push(vertex, vertex + 1, vertex + 57, vertex + 1, vertex + 58, vertex + 57); }
  }
  const curtain = new T.BufferGeometry(); curtain.setAttribute('position', new T.Float32BufferAttribute(curtainPosition, 3)); curtain.setAttribute('uv', new T.Float32BufferAttribute(curtainUv, 2)); curtain.setIndex(curtainIndex); curtain.computeVertexNormals(); rigid(curtain, hairMaterials[1]);
  const locks = mobile ? 34 : 52;
  for (let index = 0; index < locks; index++) {
    const angle = 1.12 + index / (locks - 1) * (TAU - 2.24);
    const front = Math.cos(angle) > .35;
    const end = front ? 1.72 + .12 * Math.sin(index * 1.7) : 1.66 + .08 * Math.cos(index * 1.3);
    const points = [];
    for (let step = 0; step <= 14; step++) {
      const along = step / 14, growth = smooth(along, 0, .25), wave = Math.sin(along * Math.PI * 4 + index * .7);
      const width = .06 + .108 * growth + .012 * wave * growth + .014 * along;
      const x = Math.sin(angle) * width + (index % 3 - 1) * .006;
      const z = -.018 + Math.cos(angle) * (.11 + .035 * growth) + (front ? .055 * growth : -.025 * growth);
      points.push([x, 2.445 + (end - 2.445) * along, z + .023 * Math.sin(along * 11 + index) * growth]);
    }
    hairLock(points, .014 + index % 3 * .002, angle, hairMaterials[index % 4]);
  }
  for (let index = 0; index < 11; index++) {
    const offset = index / 10;
    hairLock([[-.037 + offset * .018, 2.447, .018], [-.088 - offset * .02, 2.416, .089], [-.135 - offset * .017, 2.335, .11], [-.16 - offset * .02, 2.2, .122], [-.14 - offset * .025, 2.06, .16], [-.185 - offset * .016, 1.925, .174], [-.15 - offset * .022, 1.78 + offset * .07, .178], [-.18 - offset * .019, 1.67 + offset * .08, .166]], .019, -.3, hairMaterials[index % 4]);
  }
  for (let index = 0; index < 8; index++) {
    const offset = index / 7;
    hairLock([[-.025 + offset * .02, 2.45, .025], [.065 + offset * .026, 2.419, .091], [.127 + offset * .025, 2.345, .11], [.153 + offset * .025, 2.2, .118], [.147 + offset * .025, 2.07, .145], [.18 + offset * .02, 1.94, .157], [.156 + offset * .025, 1.82 + offset * .05, .16]], .017, .3, hairMaterials[index % 4]);
  }
  for (const batch of batches.values()) {
    const mesh = new T.Mesh(combine(batch.geometries), batch.material);
    mesh.name = batch.material.name || 'Character detail'; mesh.castShadow = true; mesh.receiveShadow = false; batch.parent.add(mesh);
  }
  const rest = new Map(bones.map(joint => [joint, joint.quaternion.clone()]));
  const rotation = new T.Quaternion(), axisX = new T.Vector3(1, 0, 0), axisZ = new T.Vector3(0, 0, 1);
  let phase = 0, blend = 0;
  function pose(joint, x = 0, z = 0) {
    joint.quaternion.copy(rest.get(joint));
    rotation.setFromAxisAngle(axisX, x); joint.quaternion.multiply(rotation);
    rotation.setFromAxisAngle(axisZ, z); joint.quaternion.multiply(rotation);
  }
  function update({ dt, walking, running, height, quiet, elapsed, velocity = 3.3 }) {
    blend = T.MathUtils.damp(blend, walking ? 1 : 0, 9, dt);
    phase += dt * (running ? 10.2 : 7.6) * T.MathUtils.clamp(velocity / (running ? 6.2 : 3.3), .25, 1.25);
    const stride = (running ? .65 : .39) * blend, airborne = height > .06;
    for (const [side, sign] of [['left', 1], ['right', -1]]) {
      const swing = Math.sin(phase) * sign;
      pose(joints[side + 'UpperLeg'], airborne ? -.3 : swing * stride);
      pose(joints[side + 'LowerLeg'], airborne ? .58 : Math.max(0, -swing) * (running ? .9 : .53) * blend);
      pose(joints[side + 'Foot'], airborne ? -.1 : Math.max(0, swing) * -.12 * blend);
      pose(joints[side + 'UpperArm'], airborne ? -.16 : -swing * stride * .64 - .025, sign * (airborne ? .12 : .035));
      pose(joints[side + 'LowerArm'], -.08 - (running ? .65 : .14) * blend);
      pose(joints[side + 'Hand'], .035);
    }
    pose(spine, running ? .055 * blend : .008, Math.cos(phase) * .018 * blend);
    pose(chest, 0, Math.sin(phase) * -.015 * blend);
    pose(neck, -.012);
    pose(head, quiet ? 0 : Math.sin(elapsed * .8) * .008, quiet ? 0 : Math.sin(elapsed * .6) * .008);
    hips.position.y = 1.25 + (quiet ? 0 : Math.cos(elapsed * 1.8) * .003) - Math.abs(Math.sin(phase)) * .015 * blend;
    const blink = quiet ? 0 : Math.max(0, 1 - Math.abs((elapsed + .7) % 4.6 - .12) / .12);
    eyes.forEach(eye => { eye.scale.y = Math.max(.025, 1 - blink * .975); });
  }
  function setLook(id) {
    top.color.set({ rose: '#d894aa', luna: '#b1a1c6', sky: '#91b7c3' }[id] || '#d894aa');
    const colors = id === 'luna' ? ['#625f63', '#827b7d', '#9d9696', '#b4aaa7'] : id === 'sky' ? ['#38271f', '#493023', '#5a3a29', '#6b4630'] : ['#29211f', '#302521', '#372922', '#3d2d25'];
    hairMaterials.forEach((material, index) => material.color.set(colors[index]));
  }
  return { scene, joints, skeleton, eyes, height: 2.46, legs: [joints.leftUpperLeg, joints.rightUpperLeg], arms: [joints.leftUpperArm, joints.rightUpperArm], update, setLook };
}
