import * as THREE from 'three';
import type { BayPosition } from './scaffold-model';

/** Non-pickable empty-slot guides; actual blue scaffold geometry remains an explicit preview. */
export function bayPositionGuides(slots: BayPosition[], height: number, selected: string) {
  const group = new THREE.Group();
  for (const slot of slots) {
    const rect = slot.footprint;
    const material = new THREE.LineDashedMaterial({
      color: slot.direction === selected ? '#315f84' : '#6b91a8',
      transparent: true, opacity: slot.direction === selected ? .9 : .65,
      dashSize: .22, gapSize: .14,
    });
    const points = [
      new THREE.Vector3(rect.left, height, rect.bottom),
      new THREE.Vector3(rect.right, height, rect.bottom),
      new THREE.Vector3(rect.right, height, rect.top),
      new THREE.Vector3(rect.left, height, rect.top),
      new THREE.Vector3(rect.left, height, rect.bottom),
    ];
    const outline = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material);
    outline.computeLineDistances();
    group.add(outline);
    const connection = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(slot.attachment.x, height, slot.attachment.z),
      new THREE.Vector3(slot.center.x, height, slot.center.z),
    ]), material);
    connection.computeLineDistances();
    group.add(connection);
  }
  return group;
}
