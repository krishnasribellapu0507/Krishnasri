import * as T from './vendor/three.module.js';
import { makeRoute, createTraffic, stepTraffic, overlaps, signalPhase } from './traffic-sim.js';

export function enrichTown({ outdoor, roadCurve, obstacle, obstacles, mobile }) {
  const route = makeRoute(roadCurve.getSpacedPoints(720));
  const batches = new Map(), transform = new T.Object3D();
  const shapes = { box: new T.BoxGeometry(1, 1, 1), pole: new T.CylinderGeometry(1, 1, 1, 8), leaf: new T.IcosahedronGeometry(1, 0) };
  function detail(shape, color, x, y, z, width, height, depth, angle = 0, glow = false) {
    const key = `${shape}:${color}:${glow}`;
    if (!batches.has(key)) batches.set(key, { shape, color, glow, items: [] });
    batches.get(key).items.push({ x, y, z, width, height, depth, angle });
  }
  const paint = (x, z, width, depth, angle = 0, color = '#f4ebd4') => detail('box', color, x, .592, z, width, .018, depth, angle);
  const junctions = [1, 25, -38].map((z, index) => {
    let best = 0, error = Infinity;
    route.points.forEach((point, sample) => {
      const score = index === 0 ? Math.abs(point.z - z) + (point.x < 0 ? 0 : 100) : Math.abs(point.x + 5.5) + Math.abs(point.z - z);
      if (score < error) { error = score; best = sample; }
    });
    return { distance: route.distances[best], radius: 3.7, offset: index * 4 };
  });
  let east = 0, eastError = Infinity;
  route.points.forEach((point, index) => { const error = Math.abs(point.z - 1) + (point.x > 0 ? 0 : 100); if (error < eastError) { eastError = error; east = index; } });
  junctions.push({ distance: route.distances[east], radius: 3.7, offset: 8 });
  const nearJunction = distance => junctions.some(junction => Math.min(Math.abs(distance - junction.distance), route.length - Math.abs(distance - junction.distance)) < 5.8);
  for (let distance = 0; distance < route.length; distance += 2.6) {
    if (nearJunction(distance)) continue;
    const point = roadCurve.getPointAt(distance / route.length), tangent = roadCurve.getTangentAt(distance / route.length), angle = Math.atan2(tangent.x, tangent.z);
    paint(point.x, point.z, .11, 1.25, angle, '#f7dfa1');
    for (const side of [-1, 1]) paint(point.x + tangent.z * 2.48 * side, point.z - tangent.x * 2.48 * side, .1, 2.65, angle);
  }
  for (let x = -36; x < 40; x += 3) if (Math.abs(x + 5.5) > 4) paint(x, 1, 1.4, .1, 0, '#f7dfa1');
  for (let z = -36; z < 24; z += 3) if (Math.abs(z - 1) > 4) paint(-5.5, z, .1, 1.4, 0, '#f7dfa1');
  for (const x of [-10, -1]) {
    for (let stripe = -1.6; stripe < 2; stripe += .65) paint(x, 1 + stripe, 1.7, .32);
    paint(x + (x < -5.5 ? -1.4 : 1.4), 1, .16, 4.1);
  }
  for (const z of [-3.5, 5.5]) {
    for (let stripe = -1.6; stripe < 2; stripe += .65) paint(-5.5 + stripe, z, .32, 1.7);
    paint(-5.5, z + (z < 1 ? -1.4 : 1.4), 4.1, .16);
  }
  const signalHeads = [];
  for (const junction of junctions) for (const direction of [-1, 1]) {
    const pose = roadCurve.getPointAt(((junction.distance - direction * 5 + route.length) % route.length) / route.length);
    const tangent = roadCurve.getTangentAt(((junction.distance - direction * 5 + route.length) % route.length) / route.length);
    const x = pose.x + tangent.z * 3.5 * direction, z = pose.z - tangent.x * 3.5 * direction;
    detail('pole', '#4d5c5b', x, 2.05, z, .07, 3.1, .07);
    detail('box', '#344649', x, 3.5, z, .35, .9, .32);
    const lamps = ['#ef655f', '#efb95b', '#91d2a4'].map((color, index) => {
      const material = new T.MeshBasicMaterial({ color });
      const lamp = new T.Mesh(new T.SphereGeometry(.1, 8, 6), material);
      lamp.position.set(x, 3.78 - index * .27, z + .18);
      outdoor.add(lamp);
      return lamp;
    });
    signalHeads.push({ lamps, offset: junction.offset });
    const angle = Math.atan2(tangent.x, tangent.z);
    paint(pose.x, pose.z, 4.9, .15, angle);
    for (let stripe = -2; stripe <= 2; stripe += .65) {
      paint(pose.x + tangent.z * stripe + tangent.x * direction * 1.5, pose.z - tangent.x * stripe + tangent.z * direction * 1.5, .32, 1.4, angle);
    }
  }
  function sign(text, x, z, angle = 0) {
    detail('pole', '#68736d', x, 1.65, z, .065, 2.3, .065);
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 160;
    const context = canvas.getContext('2d');
    context.fillStyle = '#375c59'; context.fillRect(0, 0, 512, 160);
    context.strokeStyle = '#e7e3cc'; context.lineWidth = 8; context.strokeRect(7, 7, 498, 146);
    context.fillStyle = '#fff5dc'; context.font = 'bold 35px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(text, 256, 80, 480);
    const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
    const board = new T.Mesh(new T.PlaneGeometry(2.6, .82), new T.MeshBasicMaterial({ map: texture, side: T.DoubleSide }));
    board.position.set(x, 2.6, z); board.rotation.y = angle; outdoor.add(board);
  }
  sign('← Library · Café →', -10.5, 5.9);
  sign('Coast road · 30', 31, 15, -.5);
  sign('↑ Studio · Yield', -9.5, -19);
  sign('Whisper Falls ↗', -33, -16, .7);
  sign('Beach promenade', 13, 29);
  function shrub(x, z, radius = .65) { detail('leaf', '#557b56', x, .85, z, radius, .6, radius); }
  function cottage(x, z, width, depth, color, height = 4) {
    obstacle(x, z, width + .4, depth + .4);
    detail('box', color, x, .5 + height / 2, z, width, height, depth);
    detail('box', '#64726e', x, height + .75, z, width + .6, .5, depth + .6);
    detail('box', '#d4c9b4', x, .65, z + depth / 2 + .8, width + .8, .3, 1.3);
    detail('box', '#69584e', x, 1.7, z + depth / 2 + .02, 1, 2.3, .12);
    for (const side of [-1, 1]) {
      detail('box', '#f2e1bc', x + side * width * .31, 2.8, z + depth / 2 + .05, 1.4, 1.7, .14);
      detail('box', '#779ea0', x + side * width * .31, 2.8, z + depth / 2 + .14, 1.12, 1.4, .1);
      detail('box', '#d4c9b4', x + side * width * .31, 2.8, z + depth / 2 + .21, .08, 1.5, .1);
      detail('box', '#a7806b', x + side * width * .31, 1.8, z + depth / 2 + .4, 1.6, .3, .65);
      shrub(x + side * width * .31, z + depth / 2 + .55, .65);
    }
    detail('box', '#ae9a83', x + width * .28, height + 1.1, z - 1, .6, 1.1, .65);
  }
  cottage(-23, 12, 6.3, 4.5, '#cbb9a2');
  cottage(25, -17, 5.2, 4.8, '#c5c8b9', 5.4);
  cottage(-17, -25, 6, 5, '#c2c4c1');
  cottage(19, 12, 5.8, 4.8, '#d1bdb4');
  for (let distance = 8; distance < route.length; distance += 14) {
    if (nearJunction(distance)) continue;
    const point = roadCurve.getPointAt(distance / route.length), tangent = roadCurve.getTangentAt(distance / route.length);
    const x = point.x + tangent.z * 3.9, z = point.z - tangent.x * 3.9;
    detail('pole', '#526463', x, 2.85, z, .07, 4.7, .07);
    detail('box', '#526463', x - tangent.z * .5, 5.15, z + tangent.x * .5, 1.25, .12, .38, Math.atan2(tangent.x, tangent.z));
    detail('box', '#ffe3aa', x - tangent.z * .5, 5.07, z + tangent.x * .5, .9, .06, .3, Math.atan2(tangent.x, tangent.z), true);
    for (const side of [-1, 1]) {
      const vergeX = point.x + tangent.z * 4.4 * side, vergeZ = point.z - tangent.x * 4.4 * side;
      if ((vergeX / 61) ** 2 + (vergeZ / 44) ** 2 < .92) shrub(vergeX, vergeZ);
    }
  }
  for (const z of [29, 30.4]) for (let x = 13; x < 35; x += 2.4) {
    detail('pole', '#c4b49a', x, 1.1, z, .055, 1.2, .055);
    detail('box', '#b4a38b', x + 1.2, 1.45, z, 2.4, .08, .08);
  }
  for (let index = 0; index < 34; index++) {
    const x = -38 + index * 2.2, z = 33 + Math.sin(index * 1.2) * 3;
    if (Math.abs(x + 2) < 4) continue;
    detail('leaf', index % 2 ? '#a8a998' : '#858e81', x, .5, z, .4 + index % 3 * .13, .35, .5);
    if (index % 3 === 0) { shrub(x, z - 2, .8); detail('pole', '#bd9a7f', x + .8, .8, z, .15, .6, .15); }
  }
  for (const [x, z] of [[-11, 7], [11, 7], [28, 5], [-28, -3]]) {
    detail('pole', '#586d65', x, .98, z, .35, .95, .35);
    detail('pole', '#364e48', x, 1.48, z, .38, .08, .38);
    detail('box', '#f0d7be', x + 1, .78, z, .18, .55, .18);
    shrub(x - 1, z, .8);
  }
  for (const batch of batches.values()) {
    const material = batch.glow ? new T.MeshBasicMaterial({ color: batch.color }) : new T.MeshStandardMaterial({ color: batch.color, roughness: .86 });
    const instances = new T.InstancedMesh(shapes[batch.shape], material, batch.items.length);
    batch.items.forEach((item, index) => {
      transform.position.set(item.x, item.y, item.z); transform.rotation.set(0, item.angle, 0); transform.scale.set(item.width, item.height, item.depth); transform.updateMatrix(); instances.setMatrixAt(index, transform.matrix);
    });
    instances.castShadow = !batch.glow && batch.shape !== 'box'; instances.receiveShadow = !batch.glow;
    instances.computeBoundingSphere(); outdoor.add(instances);
  }
  const staticBlockers = obstacles.map(item => ({ x: item.x, z: item.z, width: item.w, length: item.d, angle: 0 }));
  const actors = createTraffic(route, mobile ? 8 : 12, staticBlockers);
  const traffic = new T.Group(); outdoor.add(traffic);
  const paints = ['#83a9a0', '#e5d9b9', '#879db7', '#b58b7d', '#d6a7bb', '#657b85'];
  const body = new T.InstancedMesh(shapes.box, new T.MeshStandardMaterial({ metalness: .32, roughness: .38 }), actors.length);
  const glass = new T.InstancedMesh(shapes.box, new T.MeshStandardMaterial({ color: '#364d59', metalness: .25, roughness: .24 }), actors.length);
  const wheels = new T.InstancedMesh(new T.CylinderGeometry(.32, .32, .15, 10).rotateZ(Math.PI / 2), new T.MeshStandardMaterial({ color: '#303a3d' }), actors.length * 4);
  const headlights = new T.InstancedMesh(shapes.box, new T.MeshBasicMaterial({ color: '#fff0c4' }), actors.length * 2);
  const brakes = new T.InstancedMesh(shapes.box, new T.MeshBasicMaterial(), actors.length * 2);
  const bumpers = new T.InstancedMesh(shapes.box, new T.MeshStandardMaterial({ color: '#c3c7c1', metalness: .5, roughness: .4 }), actors.length * 2);
  for (const instances of [body, glass, wheels, headlights, brakes, bumpers]) { instances.instanceMatrix.setUsage(T.DynamicDrawUsage); instances.frustumCulled = false; traffic.add(instances); }
  body.castShadow = true; body.receiveShadow = true;
  actors.forEach((actor, index) => body.setColorAt(index, new T.Color(paints[index % paints.length])));
  function part(instances, index, actor, x, y, z, width, height, depth, spin = 0) {
    transform.position.set(actor.x + Math.cos(actor.angle) * x + Math.sin(actor.angle) * z, y, actor.z - Math.sin(actor.angle) * x + Math.cos(actor.angle) * z);
    transform.rotation.set(spin, actor.angle, 0); transform.scale.set(width, height, depth); transform.updateMatrix(); instances.setMatrixAt(index, transform.matrix);
  }
  let wheelSpin = 0, lightTime = -1;
  function renderTraffic(dt, time) {
    wheelSpin += dt;
    actors.forEach((actor, index) => {
      const tall = actor.id % 4 === 0;
      part(body, index, actor, 0, 1.14, 0, actor.width, .64, actor.length);
      part(glass, index, actor, 0, tall ? 1.76 : 1.64, -.22, 1.2, tall ? .7 : .5, tall ? 2 : 1.5);
      for (let wheel = 0; wheel < 4; wheel++) part(wheels, index * 4 + wheel, actor, wheel % 2 ? .77 : -.77, .88, wheel < 2 ? 1.02 : -1.02, 1, 1, 1, wheelSpin * actor.speed / .32);
      for (let side = 0; side < 2; side++) {
        part(headlights, index * 2 + side, actor, side ? .5 : -.5, 1.19, actor.length / 2 + .015, .3, .17, .04);
        part(brakes, index * 2 + side, actor, side ? .51 : -.51, 1.19, -actor.length / 2 - .015, .29, .17, .04);
        brakes.setColorAt(index * 2 + side, new T.Color(actor.braking ? '#ff403f' : '#742d31'));
        part(bumpers, index * 2 + side, actor, 0, .99, (side ? 1 : -1) * (actor.length / 2 + .04), 1.25, .1, .08);
      }
    });
    for (const instances of [body, glass, wheels, headlights, brakes, bumpers]) instances.instanceMatrix.needsUpdate = true;
    brakes.instanceColor.needsUpdate = true;
    if (Math.floor(time * 4) !== lightTime) {
      lightTime = Math.floor(time * 4);
      for (const head of signalHeads) {
        const active = { red: 0, amber: 1, green: 2 }[signalPhase(time, head.offset)];
        head.lamps.forEach((lamp, index) => { lamp.material.color.set(index === active ? ['#ff514b', '#ffd371', '#88edac'][index] : '#273b3c'); });
      }
    }
  }
  renderTraffic(0, 0);
  return {
    actors, route, junctions,
    update(dt, time, blockers) { stepTraffic(route, actors, dt, time, [...staticBlockers, ...blockers], junctions); renderTraffic(dt, time); },
    blocks(x, z, angle, driving, radius) { return actors.some(actor => overlaps(actor, { x, z, angle, width: driving ? 2.05 : radius * 2, length: driving ? 4.2 : radius * 2 }, .12)); },
    safeSpot(x, z, radius = 2.8) { return !actors.some(actor => Math.hypot(actor.x - x, actor.z - z) < radius + actor.length / 2); },
  };
}
