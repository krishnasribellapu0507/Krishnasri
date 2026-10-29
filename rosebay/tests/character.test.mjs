import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from '../dist/vendor/three.module.js';
import { createCharacter } from '../dist/character.js';

const context = { createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData() {} };
globalThis.document = { createElement: () => ({ width: 256, height: 256, getContext: () => context }) };

function inspect(character) {
  let triangles = 0, meshes = 0;
  character.scene.traverse(object => {
    if (!object.isMesh) return;
    meshes++;
    const geometry = object.geometry;
    triangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3;
    for (const value of geometry.attributes.position.array) assert.ok(Number.isFinite(value));
    if (object.isSkinnedMesh) {
      const weights = geometry.attributes.skinWeight;
      for (let index = 0; index < weights.count; index++) assert.ok(Math.abs(weights.getX(index) + weights.getY(index) + weights.getZ(index) + weights.getW(index) - 1) < .0001);
    }
  });
  return { triangles, meshes };
}

test('hand-authored character has finite geometry, normalized rig weights and human scale', () => {
  const character = createCharacter();
  const metrics = inspect(character);
  character.scene.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(character.scene, true), size = bounds.getSize(new T.Vector3());
  assert.ok(size.y > 2.35 && size.y < 2.55);
  assert.ok(size.x > .6 && size.x < .9);
  assert.ok(metrics.meshes < 55, `${metrics.meshes} draw calls`);
  assert.ok(metrics.triangles < 75000, `${metrics.triangles} triangles`);
  assert.equal(character.skeleton.bones.length, 17);
});

test('mobile character reduces geometry while retaining the same rig', () => {
  const desktop = inspect(createCharacter()), mobile = inspect(createCharacter({ mobile: true }));
  assert.ok(mobile.triangles < desktop.triangles * .8);
  assert.ok(mobile.meshes <= desktop.meshes);
});

test('walking, running, jumping and quiet idle keep the rig finite and connected', () => {
  const character = createCharacter();
  let previous = character.joints.leftUpperLeg.quaternion.clone(), changed = false;
  for (let frame = 0; frame < 600; frame++) {
    character.update({ dt: 1 / 60, walking: true, running: frame > 180, height: frame > 300 && frame < 360 ? .5 : 0, quiet: false, elapsed: frame / 60, velocity: frame > 180 ? 6.2 : 3.3 });
    character.scene.updateMatrixWorld(true);
    if (previous.angleTo(character.joints.leftUpperLeg.quaternion) > .001) changed = true;
    previous.copy(character.joints.leftUpperLeg.quaternion);
    for (const joint of character.skeleton.bones) for (const value of joint.matrixWorld.elements) assert.ok(Number.isFinite(value));
    if (frame % 60 === 0) {
      const bounds = new T.Box3().setFromObject(character.scene, true);
      assert.ok(bounds.min.y > -.15 && bounds.max.y < 2.6);
    }
  }
  assert.ok(changed);
  for (let frame = 0; frame < 180; frame++) character.update({ dt: 1 / 60, walking: false, running: false, height: 0, quiet: true, elapsed: frame / 60 });
  assert.ok(character.joints.leftUpperLeg.quaternion.angleTo(new T.Quaternion()) < .001);
  assert.ok(Math.abs(character.joints.hips.position.y - 1.25) < .0001);
});

test('all existing character colors remain selectable', () => {
  const character = createCharacter();
  const top = character.scene.children.find(child => child.isMesh && child.material.name === 'Top');
  character.setLook('luna'); const luna = top.material.color.getHex();
  character.setLook('sky'); const sky = top.material.color.getHex();
  character.setLook('rose'); const rose = top.material.color.getHex();
  assert.equal(new Set([luna, sky, rose]).size, 3);
});

test('eyes blink together, reopen and remain still in quiet mode', () => {
  const character = createCharacter();
  const idle = { dt: 1 / 60, walking: false, running: false, height: 0, quiet: false, velocity: 0 };
  character.update({ ...idle, elapsed: 4.02 });
  assert.equal(character.eyes.length, 2);
  character.eyes.forEach(eye => assert.ok(eye.scale.y < .03));
  character.update({ ...idle, elapsed: 4.4 });
  character.eyes.forEach(eye => assert.equal(eye.scale.y, 1));
  character.update({ ...idle, quiet: true, elapsed: 4.02 });
  character.eyes.forEach(eye => assert.equal(eye.scale.y, 1));
});

test('face complexion and iris detail are authored mesh attributes and local textures', () => {
  const character = createCharacter();
  const face = character.scene.getObjectByName('Sculpted face');
  assert.equal(face.material.vertexColors, true);
  assert.equal(face.geometry.attributes.color.count, face.geometry.attributes.position.count);
  const irisMeshes = [];
  character.scene.traverse(object => { if (object.material?.name === 'Iris fibers') irisMeshes.push(object); });
  assert.equal(irisMeshes.length, 2);
  irisMeshes.forEach(mesh => assert.ok(mesh.material.map.isCanvasTexture));
});
