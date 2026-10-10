import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { fitCamera, projectedFrame } from '../src/camera-framing.ts';
import { contextPosition, overlaps } from '../src/context-position.ts';

const scaffold = new THREE.Box3(new THREE.Vector3(-6, 0, -6), new THREE.Vector3(6, 10.3, 6));
function setup(width, height) {
  const camera = new THREE.PerspectiveCamera(36, width / height, .1, 100);
  camera.position.set(20, 14, 26);
  const controls = { target: new THREE.Vector3(0, 4.25, 0), maxDistance: 50 };
  camera.lookAt(controls.target); camera.updateMatrixWorld();
  return { camera, controls, size: { width, height } };
}
function assertVisible(camera, box, size) {
  const rect = projectedFrame(camera, box, size);
  assert.ok(rect.left >= 0 && rect.right <= size.width, JSON.stringify(rect));
  assert.ok(rect.top >= Math.min(104, size.height - 48) - 1 && rect.bottom <= size.height, JSON.stringify(rect));
}

for (const [width, height] of [[848, 842], [848, 560], [336, 384], [208, 450], [120, 180]]) {
  test(`entire scaffold fits available ${width}x${height} canvas`, () => {
    const { camera, controls, size } = setup(width, height);
    const angle = camera.position.clone().sub(controls.target).normalize();
    fitCamera(camera, controls, scaffold, size);
    assertVisible(camera, scaffold, size);
    assert.ok(angle.distanceTo(camera.position.clone().sub(controls.target).normalize()) < .00001);
    assert.ok(camera.far > camera.position.distanceTo(controls.target));
  });
}

test('snapped Add bay preview is included without changing committed geometry', () => {
  const { camera, controls, size } = setup(336, 384);
  const original = scaffold.clone();
  const preview = scaffold.clone().expandByPoint(new THREE.Vector3(9, 10.3, 6));
  fitCamera(camera, controls, preview, size);
  assertVisible(camera, preview, size);
  assert.ok(scaffold.equals(original));
});

test('returning canvas height preserves scale without resetting position or orbit target', () => {
  const { camera, controls, size } = setup(848, 560);
  fitCamera(camera, controls, scaffold, size);
  const before = projectedFrame(camera, scaffold, size);
  const position = camera.position.clone(), target = controls.target.clone();
  const larger = { width: 848, height: 842 };
  camera.zoom *= size.height / larger.height;
  camera.aspect = larger.width / larger.height; camera.updateProjectionMatrix();
  const after = projectedFrame(camera, scaffold, larger);
  assert.ok(Math.abs((after.bottom - after.top) - (before.bottom - before.top)) < .001);
  assert.ok(camera.position.equals(position) && controls.target.equals(target));
});

test('context panels clear the full fitted preview at wide and narrow sizes', () => {
  for (const [width, height, stageWidth, offset, paneWidth] of [[848, 560, 1440, 296, 264], [356, 420, 900, 264, 248], [328, 384, 600, 0, 248]]) {
    const { camera, controls, size } = setup(width, height);
    const preview = scaffold.clone().expandByPoint(new THREE.Vector3(9, 10.3, 6));
    fitCamera(camera, controls, preview, size);
    const frame = projectedFrame(camera, preview, size);
    const model = { ...frame, left: frame.left + offset, right: frame.right + offset };
    const position = contextPosition({ anchor: model, selected: model, model }, { left: offset + 16, right: stageWidth - 16, top: 104, bottom: height - 12 }, paneWidth, Math.min(280, height - 116));
    const pane = { ...position, right: position.left + paneWidth, bottom: position.top + Math.min(280, height - 116) };
    assert.equal(overlaps(pane, model, 0), false);
  }
});
