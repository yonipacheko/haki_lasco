import * as THREE from 'three';

export type ScaffoldPart = {
  id: string; type: string; bayId: string; level: number; bayNumber: number;
  elevation: string; detail: string; center: [number, number, number];
};
export type InsidePoint = { x: number; y: number; visible?: boolean };
export const partLocation = (part: ScaffoldPart) =>
  `Level ${part.level} · Bay ${String(part.bayNumber).padStart(2, '0')} · ${part.elevation}${part.detail ? ` · ${part.detail}` : ''}`;

/** Physical meshes only: never the invisible Bay/Lift/Unit pick volumes. */
export function insideCandidates(raycaster: THREE.Raycaster, group: THREE.Object3D): ScaffoldPart[] {
  group.updateMatrixWorld(true);
  const found = new Map<string, ScaffoldPart>();
  for (const { object } of raycaster.intersectObject(group, true)) {
    const part = object.userData.part as ScaffoldPart | undefined;
    if (!part || found.has(part.id)) continue;
    const center = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
    found.set(part.id, { ...part, center: center.toArray() as [number, number, number] });
  }
  return [...found.values()];
}

/** Reversible material-only treatment; no transforms or geometries are edited. */
export class InsideViewTreatment {
  private meshes = new Map<THREE.Mesh, { original: THREE.Material | THREE.Material[]; faded: THREE.Material[]; order: number }>();
  private group: THREE.Object3D | null = null;

  restore() {
    for (const [mesh, saved] of this.meshes) {
      mesh.material = saved.original;
      mesh.renderOrder = saved.order;
      saved.faded.forEach(material => material.dispose());
    }
    this.meshes.clear(); this.group = null;
  }

  update(group: THREE.Object3D, camera: THREE.Camera, selectedId: string | null) {
    if (this.group !== group) { this.restore(); this.group = group; }
    const direction = camera.getWorldDirection(new THREE.Vector3());
    const depths = new Map<THREE.Mesh, number>();
    group.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || (!mesh.userData.part && !mesh.userData.hit)) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      if (materials.every(material => !material.visible)) return;
      if (!this.meshes.has(mesh)) {
        const faded = materials.map(material => {
          const copy = material.clone(); copy.transparent = true; copy.depthWrite = false;
          return copy;
        });
        this.meshes.set(mesh, { original: mesh.material, faded, order: mesh.renderOrder });
        mesh.material = Array.isArray(mesh.material) ? faded : faded[0];
      }
      const position = mesh.getWorldPosition(new THREE.Vector3());
      depths.set(mesh, position.sub(camera.position).dot(direction));
    });
    const values = [...depths.values()];
    const split = Math.min(...values) + (Math.max(...values) - Math.min(...values)) * .52;
    for (const [mesh, depth] of depths) {
      const saved = this.meshes.get(mesh)!;
      const part = mesh.userData.part as ScaffoldPart | undefined;
      const chosen = !!selectedId && part?.id === selectedId;
      const original = Array.isArray(saved.original) ? saved.original : [saved.original];
      saved.faded.forEach((material, index) => {
        material.opacity = chosen ? 1 : part?.type === 'Base jack' ? .92 : depth < split ? .14 : .36;
        material.depthTest = chosen ? false : original[index].depthTest;
        const color = (material as THREE.MeshBasicMaterial).color;
        const originalColor = (original[index] as THREE.MeshBasicMaterial).color;
        if (color && originalColor) color.copy(chosen ? new THREE.Color('#0789ce') : originalColor);
      });
      mesh.renderOrder = chosen ? 50 : saved.order;
    }
  }
}
