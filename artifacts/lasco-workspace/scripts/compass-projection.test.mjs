import assert from 'node:assert/strict';
import test from 'node:test';
import { PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { projectCompass } from '../src/compass-projection.ts';

const vectors = [new Vector3(0, 0, 1), new Vector3(1, 0, 0), new Vector3(0, 0, -1), new Vector3(-1, 0, 0)];
for (const yaw of [0, Math.PI / 4, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
  for (const pitch of [.032, .5, Math.PI / 2 - .001]) {
    test(`compass matches world axes on screen at yaw ${yaw.toFixed(2)}, elevation ${pitch.toFixed(2)}`, () => {
      const camera = new PerspectiveCamera(36, 1.5, .1, 100);
      camera.position.set(Math.sin(yaw) * Math.cos(pitch) * 25, Math.sin(pitch) * 25, Math.cos(yaw) * Math.cos(pitch) * 25);
      camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
      const original = camera.position.clone();
      const rotation = camera.getWorldQuaternion(new Quaternion());
      const points = projectCompass(rotation);
      const center = new Vector3().project(camera);
      points.forEach((point, index) => {
        const screen = vectors[index].clone().project(camera).sub(center);
        const x = screen.x * 900, y = -screen.y * 600;
        const length = Math.hypot(x, y);
        assert.ok(Math.abs(point.dx - x / length) < 1e-7);
        assert.ok(Math.abs(point.dy - y / length) < 1e-7);
        assert.ok(point.labelX >= 14 && point.labelX <= 86);
        assert.ok(point.labelY >= 14 && point.labelY <= 86);
      });
      assert.deepEqual(camera.position, original);
      for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
        assert.ok(Math.abs(points[i].labelX - points[j].labelX) >= 24 || Math.abs(points[i].labelY - points[j].labelY) >= 25.999);
      }
    });
  }
}

test('zoom and pan leave compass directions unchanged and opposite axes remain opposite', () => {
  const camera = new PerspectiveCamera(36, 1.5, .1, 100);
  camera.position.set(20, 14, 26); camera.lookAt(0, 4.25, 0);
  const rotation = camera.getWorldQuaternion(new Quaternion());
  const before = projectCompass(rotation);
  camera.position.multiplyScalar(1.5); camera.position.x += 8;
  camera.zoom = 2; camera.updateProjectionMatrix();
  assert.deepEqual(projectCompass(camera.getWorldQuaternion(new Quaternion())), before);
  assert.ok(camera.quaternion.angleTo(rotation) < 1e-7);
  assert.ok(Math.abs(before[0].dx + before[2].dx) < 1e-8);
  assert.ok(Math.abs(before[1].dy + before[3].dy) < 1e-8);
});
