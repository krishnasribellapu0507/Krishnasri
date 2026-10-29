import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import * as T from '../dist/vendor/three.module.js';
import { enrichTown } from '../dist/town-details.js';
import { makeRoute, createTraffic, sampleRoute, stepTraffic, overlaps, signalPhase } from '../dist/traffic-sim.js';

const curve = new T.CatmullRomCurve3([[-38, 0, 0], [-33, 0, -21], [-16, 0, -35], [5, 0, -38], [31, 0, -25], [43, 0, 0], [27, 0, 20], [0, 0, 25], [-27, 0, 20]].map(point => new T.Vector3(...point)), true);
const route = makeRoute(curve.getSpacedPoints(720));
const noOverlaps = actors => {
  for (let first = 0; first < actors.length; first++) for (let second = first + 1; second < actors.length; second++) assert.equal(overlaps(actors[first], actors[second]), false, `Cars ${first} and ${second} overlap`);
};

test('safe, deterministic spawning keeps both lanes and avoids the player', () => {
  const blocker = { ...sampleRoute(route, 0), angle: 0, width: 2, length: 4.2 };
  const actors = createTraffic(route, 12, [blocker]);
  assert.equal(actors.length, 12);
  assert.equal(new Set(actors.map(actor => actor.direction)).size, 2);
  assert.ok(new Set(actors.map(actor => actor.cruise)).size > 4);
  actors.forEach(actor => assert.equal(overlaps(actor, blocker, 1), false));
  noOverlaps(actors);
});

test('five minutes of mixed-speed following never interpenetrates or leaves the road', () => {
  const actors = createTraffic(route, 12);
  const starts = actors.map(actor => actor.distance);
  for (let frame = 0; frame < 9000; frame++) {
    stepTraffic(route, actors, 1 / 30, frame / 30);
    if (frame % 30 === 0) noOverlaps(actors);
  }
  actors.forEach((actor, index) => {
    assert.ok(Math.abs(actor.distance - starts[index]) > 1);
    assert.ok(actor.speed <= actor.cruise);
    const expected = sampleRoute(route, actor.distance, actor.direction);
    assert.ok(Math.hypot(actor.x - expected.x, actor.z - expected.z) < .001);
  });
});

test('traffic brakes for a parked car and resumes when it leaves', () => {
  const actors = createTraffic(route, 2).slice(0, 1);
  const actor = actors[0];
  const blocker = { ...sampleRoute(route, 22), width: 2.05, length: 4.2 };
  for (let frame = 0; frame < 1200; frame++) {
    stepTraffic(route, actors, 1 / 60, frame / 60, [blocker]);
    assert.equal(overlaps(actor, blocker), false);
  }
  assert.ok(actor.speed < .1);
  assert.ok(actor.distance < 22);
  for (let frame = 0; frame < 180; frame++) stepTraffic(route, actors, 1 / 60, frame / 60);
  assert.ok(actor.speed > 1);
});

test('red stop line holds traffic outside the junction, green releases it', () => {
  const actors = createTraffic(route, 2).slice(0, 1);
  const junctions = [{ distance: 18, radius: 3.7, offset: 0 }];
  for (let frame = 0; frame < 1200; frame++) stepTraffic(route, actors, 1 / 60, 17, [], junctions);
  assert.equal(signalPhase(17), 'red');
  assert.ok(actors[0].distance < 18 - 3.7 - actors[0].length / 2);
  assert.ok(actors[0].speed < .1);
  for (let frame = 0; frame < 420; frame++) stepTraffic(route, actors, 1 / 60, 1, [], junctions);
  assert.ok(actors[0].distance > 18);
});

test('rotated collision boxes detect side impacts without blocking adjacent lanes', () => {
  const car = { x: 0, z: 0, angle: Math.PI / 4, width: 2, length: 4 };
  assert.ok(overlaps(car, { x: .5, z: .5, angle: 0, width: 1, length: 1 }));
  assert.equal(overlaps(car, { x: 4, z: 0, angle: 0, width: 1, length: 1 }), false);
});

test('actual town geometry leaves both traffic lanes clear and batches the new scenery', () => {
  const context = new Proxy({ createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }) }, { get: (target, key) => target[key] ?? (() => {}) });
  const document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) };
  const source = readFileSync(new URL('../dist/world.js', import.meta.url), 'utf8');
  const prefix = source.slice(source.indexOf('const scene='), source.indexOf('function makeGirl()'));
  const sandbox = { T, TAU: Math.PI * 2, innerWidth: 1280, innerHeight: 720, renderer: { capabilities: { getMaxAnisotropy: () => 1 } }, document };
  vm.createContext(sandbox);
  vm.runInContext(prefix + ';globalThis.world={outdoor,roadCurve,obstacle,obstacles};', sandbox);
  globalThis.document = document;
  try {
    const town = enrichTown({ ...sandbox.world, mobile: false });
    const blockers = sandbox.world.obstacles.map(item => ({ x: item.x, z: item.z, width: item.w, length: item.d, angle: 0 }));
    assert.equal(town.actors.length, 12);
    for (let distance = 0; distance < town.route.length; distance += .5) for (const direction of [-1, 1]) {
      const pose = { ...sampleRoute(town.route, distance, direction), width: 1.48, length: 3.5 };
      const blockedBy = blockers.find(blocker => overlaps(pose, blocker, .15));
      assert.equal(Boolean(blockedBy), false, `Road blocked at ${distance}, direction ${direction}: ${JSON.stringify(blockedBy)}`);
    }
    for (let frame = 0; frame < 1800; frame++) stepTraffic(town.route, town.actors, 1 / 30, frame / 30, blockers, town.junctions);
    noOverlaps(town.actors);
    assert.ok(sandbox.world.outdoor.children.filter(child => child.isInstancedMesh).length > 10);
  } finally { delete globalThis.document; }
});
