import * as THREE from 'three';
import { bayLayout, cellElevation, type ScaffoldModel, type Selection } from './scaffold-model';
import type { ScreenRect, SelectionScreenBounds } from './context-position';

export function combineBounds(original: SelectionScreenBounds | null, preview: SelectionScreenBounds | null) {
  if (!original) return preview;
  if (!preview) return original;
  const union = (a: ScreenRect, b: ScreenRect): ScreenRect => ({ left: Math.min(a.left, b.left), top: Math.min(a.top, b.top), right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom) });
  return { anchor: union(original.anchor, preview.anchor), selected: union(original.selected, preview.selected), model: union(original.model, preview.model) };
}
export function projectSelection(model: ScaffoldModel, selection: Selection, camera: THREE.PerspectiveCamera, host: HTMLElement): SelectionScreenBounds | null {
  const selectedPoints: THREE.Vector3[] = [], anchorPoints: THREE.Vector3[] = [], modelPoints: THREE.Vector3[] = [];
  const corners = (x: number, width: number, z: number, low: number, high: number, side: number) => {
    const points: THREE.Vector3[] = [];
    for (const bx of [x, x + width]) for (const by of [low, high]) for (const bz of [z - .65, z + 1.25]) {
      points.push(new THREE.Vector3(bx, by, bz).applyAxisAngle(new THREE.Vector3(0, 1, 0), side * Math.PI / 2));
    }
    return points;
  };
  for (const { bay, x, z } of bayLayout(model)) {
    modelPoints.push(...corners(x, bay.width, z, 0, cellElevation(bay, bay.cells.length) + 1.2, bay.side));
    const local = bay.id === selection.bayId;
    if (!local && selection.kind !== 'Lift') continue;
    if (selection.kind !== 'Bay' && bay.cells.length < selection.level) continue;
    const low = selection.kind === 'Bay' ? 0 : cellElevation(bay, selection.level - 1);
    const high = cellElevation(bay, selection.kind === 'Bay' ? bay.cells.length : selection.level) + 1.2;
    const points = corners(x, bay.width, z, low, high, bay.side);
    selectedPoints.push(...points);
    if (local) anchorPoints.push(...points);
  }
  if (!anchorPoints.length) return null;
  const rect = (points: THREE.Vector3[]): ScreenRect => {
    const projected = points.map(point => point.clone().project(camera));
    const xs = projected.map(point => (point.x + 1) * host.clientWidth / 2);
    const ys = projected.map(point => (1 - point.y) * host.clientHeight / 2);
    return {
      left: host.offsetLeft + Math.max(0, Math.min(host.clientWidth, Math.min(...xs))),
      right: host.offsetLeft + Math.max(0, Math.min(host.clientWidth, Math.max(...xs))),
      top: host.offsetTop + Math.max(0, Math.min(host.clientHeight, Math.min(...ys))),
      bottom: host.offsetTop + Math.max(0, Math.min(host.clientHeight, Math.max(...ys))),
    };
  };
  return { anchor: rect(anchorPoints), selected: rect(selectedPoints), model: rect(modelPoints) };
}
