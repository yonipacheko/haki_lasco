import * as THREE from 'three';

type FrameControls = { target: THREE.Vector3; maxDistance: number };
export type CanvasSize = { width: number; height: number };

export function boxCorners(box: THREE.Box3) {
  return [box.min.x, box.max.x].flatMap(x => [box.min.y, box.max.y].flatMap(y => [box.min.z, box.max.z].map(z => new THREE.Vector3(x, y, z))));
}

/** Fit actual scene geometry, not the grid, without changing the orbit angle. */
export function fitCamera(camera: THREE.PerspectiveCamera, controls: FrameControls, bounds: THREE.Box3, size: CanvasSize, allowZoomIn = false) {
  if (bounds.isEmpty() || size.width <= 0 || size.height <= 0) return;
  const direction = camera.position.clone().sub(controls.target).normalize();
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  const center = bounds.getCenter(new THREE.Vector3());
  const top = Math.min(104, Math.max(0, size.height - 48));
  const bottom = Math.min(24, size.height * .1);
  const horizontal = Math.min(24, size.width * .08);
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / camera.zoom;
  const tanH = tanV * camera.aspect;
  const safeTop = 1 - 2 * top / size.height;
  const safeBottom = 1 - 2 * bottom / size.height;
  const safeY = 1 - (top + bottom) / size.height;
  const safeX = 1 - 2 * horizontal / size.width;
  let distance = 7;
  for (const point of boxCorners(bounds)) {
    const offset = point.sub(center);
    const x = offset.dot(right), y = offset.dot(up), z = offset.dot(direction);
    distance = Math.max(distance,
      z + Math.abs(x) / (tanH * safeX),
      (y + z * tanV * safeTop) / (tanV * safeY),
      (-y + z * tanV * safeBottom) / (tanV * safeY),
      z + 1);
  }
  distance *= 1.025;
  if (!allowZoomIn) distance = Math.max(distance, camera.position.distanceTo(controls.target));
  // Leave the scene chips and selection toolbar above the geometry.
  const target = center.addScaledVector(up, (top - bottom) / size.height * distance * tanV);
  controls.target.copy(target);
  camera.position.copy(target).addScaledVector(direction, distance);
  controls.maxDistance = Math.max(50, distance * 1.25);
  camera.far = Math.max(100, distance + bounds.getSize(new THREE.Vector3()).length() + 50);
  camera.updateProjectionMatrix();
  camera.lookAt(target);
  camera.updateMatrixWorld();
}

/** Unclipped screen bounds make framing checks independent of WebGL support. */
export function projectedFrame(camera: THREE.PerspectiveCamera, bounds: THREE.Box3, size: CanvasSize) {
  if (bounds.isEmpty()) return null;
  const points = boxCorners(bounds).map(point => point.project(camera));
  return {
    left: Math.min(...points.map(p => (p.x + 1) * size.width / 2)),
    right: Math.max(...points.map(p => (p.x + 1) * size.width / 2)),
    top: Math.min(...points.map(p => (1 - p.y) * size.height / 2)),
    bottom: Math.max(...points.map(p => (1 - p.y) * size.height / 2)),
  };
}
