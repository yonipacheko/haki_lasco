import { Quaternion, Vector3 } from 'three';

const directions = [
  { label: 'N', name: 'North', vector: [0, 0, 1] },
  { label: 'E', name: 'East', vector: [1, 0, 0] },
  { label: 'S', name: 'South', vector: [0, 0, -1] },
  { label: 'W', name: 'West', vector: [-1, 0, 0] },
] as const;

/** Match the existing project axes, using camera rotation only, never zoom or position. */
export function projectCompass(rotation: Quaternion) {
  const inverse = rotation.clone().invert();
  const points = directions.map(({ label, name, vector }) => {
    const view = new Vector3(...vector).applyQuaternion(inverse);
    const length = Math.hypot(view.x, view.y);
    const dx = length > 1e-8 ? view.x / length : 0;
    const dy = length > 1e-8 ? -view.y / length : Math.sign(view.z) || 1;
    return { label, name, dx, dy, labelX: 50 + dx * 34, labelY: 50 + dy * 34 };
  });
  // Near the horizon, ground axes converge. Separate upright labels, not the needles.
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const a = points[i], b = points[j];
      if (Math.abs(a.labelX - b.labelX) >= 24 || Math.abs(a.labelY - b.labelY) >= 26) continue;
      const axis = Math.abs((a.labelX + b.labelX) / 2 - 50) > Math.abs((a.labelY + b.labelY) / 2 - 50) ? 'labelY' : 'labelX';
      const delta = a[axis] - b[axis];
      const offset = (26 - Math.abs(delta)) / 2 * (Math.sign(delta) || 1);
      a[axis] += offset;
      b[axis] -= offset;
    }
  }
  return points;
}
