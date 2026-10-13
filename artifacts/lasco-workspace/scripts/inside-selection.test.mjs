import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import * as THREE from 'three';
import { starterModel } from '../src/scaffold-model.ts';
import { insideCandidates, InsideViewTreatment, partLocation } from '../src/inside-selection.ts';

// Vite resolves extensionless TS imports; mirror that for the shared scene tests.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context); }
    catch (error) {
      if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context);
      throw error;
    }
  },
});
const { scaffoldScene, componentScene } = await import('../src/scaffold-scene.ts');
const surface = (color, _roughness, opacity = 1) => new THREE.MeshBasicMaterial({ color, opacity, transparent: opacity < 1 });
const fixture = () => {
  const model = starterModel();
  const group = scaffoldScene(model, surface, { kind: 'Bay', bayId: '0-3', level: 2 }, null, false);
  group.updateMatrixWorld(true);
  return { model, group };
};
const meshes = group => {
  const result = [];
  group.traverse(object => { if (object.isMesh) result.push(object); });
  return result;
};

test('every existing ground jack has exact bay, level and corner metadata without changing normal scope picking', () => {
  const { group } = fixture();
  const jacks = meshes(group).filter(mesh => mesh.userData.part?.type === 'Base jack');
  assert.equal(jacks.length, 48);
  assert.equal(new Set(jacks.map(mesh => mesh.userData.part.id)).size, 48);
  for (const mesh of jacks) {
    assert.equal(mesh.userData.part.level, 1);
    assert.equal(mesh.userData.hit, undefined);
    assert.equal(mesh.geometry.parameters.width, .24);
    assert.ok(/Level 1 · Bay 0[123] · (North|East|South|West) · (Inner|Outer) edge · (Start|End) post/.test(partLocation(mesh.userData.part)));
  }
  assert.ok(meshes(group).filter(mesh => !mesh.material.visible).every(mesh => !mesh.userData.part));
});

test('ray picks include a Bay 03 inner jack hidden behind a front standard, with faces deduplicated', () => {
  const { group } = fixture();
  const target = new THREE.Vector3(1.25, .05, 3.45);
  const origin = new THREE.Vector3(1.25, 3, 18);
  const raycaster = new THREE.Raycaster(origin, target.clone().sub(origin).normalize());
  const candidates = insideCandidates(raycaster, group);
  assert.equal(candidates[0].type, 'Standard');
  const jack = candidates.find(part => part.type === 'Base jack' && part.bayId === '0-3' && part.detail === 'Inner edge · Start post');
  assert.ok(jack, JSON.stringify(candidates));
  assert.deepEqual(jack.center, target.toArray());
  assert.equal(new Set(candidates.map(part => part.id)).size, candidates.length);
  assert.ok(candidates.every(part => part.type && part.bayId && part.level));
});

test('translucency and selected-jack highlight are reversible material-only changes', () => {
  const { group, model } = fixture();
  const originals = meshes(group).map(mesh => ({
    mesh, material: mesh.material, geometry: mesh.geometry,
    opacity: mesh.material.opacity, color: mesh.material.color.getHex(),
    depthTest: mesh.material.depthTest, depthWrite: mesh.material.depthWrite, order: mesh.renderOrder,
    position: mesh.position.toArray(), quaternion: mesh.quaternion.toArray(), scale: mesh.scale.toArray(),
  }));
  const serializedModel = JSON.stringify(model);
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 100);
  camera.position.set(1.25, 3, 18); camera.lookAt(1.25, .05, 3.45); camera.updateMatrixWorld();
  const jack = originals.find(({ mesh }) => mesh.userData.part?.type === 'Base jack' && mesh.userData.part.bayId === '0-3');
  const treatment = new InsideViewTreatment();
  treatment.update(group, camera, jack.mesh.userData.part.id);
  assert.equal(jack.mesh.material.opacity, 1);
  assert.equal(jack.mesh.material.depthTest, false);
  assert.equal(jack.mesh.material.color.getHex(), 0x0789ce);
  assert.ok(meshes(group).some(mesh => mesh.material.opacity === .14));
  assert.ok(meshes(group).some(mesh => mesh.material.opacity === .36));
  camera.position.set(-14, 9, -18); camera.lookAt(0, 4, 0); camera.updateMatrixWorld();
  treatment.update(group, camera, null);
  assert.notEqual(jack.mesh.material.color.getHex(), 0x0789ce);
  treatment.restore();
  for (const before of originals) {
    assert.equal(before.mesh.material, before.material);
    assert.equal(before.mesh.geometry, before.geometry);
    assert.equal(before.mesh.material.opacity, before.opacity);
    assert.equal(before.mesh.material.color.getHex(), before.color);
    assert.equal(before.mesh.material.depthTest, before.depthTest);
    assert.equal(before.mesh.material.depthWrite, before.depthWrite);
    assert.equal(before.mesh.renderOrder, before.order);
    assert.deepEqual(before.mesh.position.toArray(), before.position);
    assert.deepEqual(before.mesh.quaternion.toArray(), before.quaternion);
    assert.deepEqual(before.mesh.scale.toArray(), before.scale);
  }
  assert.equal(JSON.stringify(model), serializedModel);
});

test('placed-component meshes share one selectable identity; placement previews are not inside candidates', () => {
  const model = starterModel();
  const group = componentScene(model, [{ id: 42, name: 'Base jack', bayId: '0-3', level: 1 }], 'Ledger', null, surface);
  const parts = meshes(group).filter(mesh => mesh.userData.part);
  assert.equal(parts.length, 2);
  assert.ok(parts.every(mesh => mesh.userData.part.id === 'placed:42'));
  assert.ok(meshes(group).filter(mesh => mesh.userData.placement).every(mesh => !mesh.userData.part));
});
