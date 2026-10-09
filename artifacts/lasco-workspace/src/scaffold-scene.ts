import * as THREE from 'three';
import { createComponent } from './scaffold-component';
import { bayLayout, cellElevation, type AdditionPreview, type ComponentPlacement, type ScaffoldModel, type Selection } from './scaffold-model';

type Surface = (color: string, roughness?: number, opacity?: number, metalness?: number) => THREE.Material;

/** Illustrative bays and lift cells, shared by WebGL and the SVG fallback. */
export function scaffoldScene(model: ScaffoldModel, surface: Surface, selection: Selection | null, operation: AdditionPreview | null, stair: boolean) {
  const group = new THREE.Group();
  const steel = surface('#7894a6', .42, 1, .48);
  const lite = surface('#89a5b8', .48, 1, .34);
  const gold = surface('#c5a26a', .5, 1, .24);
  const deck = surface('#b8c9d3', .76, .94);
  const ghost = surface('#318ac4', .6, .5);
  const highlight = surface('#d4a85f', .6, .45);
  const selectedEdge = new THREE.MeshBasicMaterial({ color: '#db901d' });
  const rod = (parent: THREE.Group, a: number[], b: number[], mat: THREE.Material, hit?: { bayId: string; level: number }, radius = .05) => {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 8), mat);
    mesh.position.copy(start.add(end).multiplyScalar(.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    if (hit) mesh.userData.hit = hit;
    parent.add(mesh);
  };
  const box = (parent: THREE.Group, size: number[], position: number[], material: THREE.Material, hit?: { bayId: string; level: number }) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size as [number, number, number]), material);
    mesh.position.set(...position as [number, number, number]);
    if (hit) mesh.userData.hit = hit;
    parent.add(mesh);
  };
  const layouts = bayLayout(operation?.model ?? model);
  for (const { bay, x, z } of layouts) {
    const side = new THREE.Group();
    side.rotation.y = bay.side * Math.PI / 2;
    const newBay = operation?.addedBayId === bay.id;
    const total = cellElevation(bay, bay.cells.length);
    for (const bx of [x, x + bay.width]) for (const bz of [z, z + 1.15]) {
      if (!newBay) {
        const original = model.find(item => item.id === bay.id);
        const originalTotal = original ? cellElevation(original, original.cells.length) : 0;
        rod(side, [bx, .12, bz], [bx, originalTotal + .25, bz], steel, { bayId: bay.id, level: 1 }, .065);
        if (total > originalTotal) rod(side, [bx, originalTotal + .25, bz], [bx, total + .25, bz], ghost);
      } else rod(side, [bx, .12, bz], [bx, total + .25, bz], ghost);
      box(side, [.24, .1, .24], [bx, .05, bz], newBay ? ghost : gold);
    }
    rod(side, [x, .15, z], [x + bay.width, .15, z], newBay ? ghost : lite, newBay ? undefined : { bayId: bay.id, level: 1 });
    let bottom = .15;
    bay.cells.forEach((cell, index) => {
      const level = index + 1;
      const top = cellElevation(bay, level) + .15;
      const isGhost = newBay || !!operation?.addedCells.some(item => item.bayId === bay.id && item.level === level);
      const hit = isGhost ? undefined : { bayId: bay.id, level };
      const structure = isGhost ? ghost : lite, protection = isGhost ? ghost : gold;
      for (const bz of [z, z + 1.15]) rod(side, [x, top, bz], [x + bay.width, top, bz], structure, hit);
      for (const bx of [x, x + bay.width]) rod(side, [bx, top, z], [bx, top, z + 1.15], structure, hit);
      if (cell.deck) box(side, [bay.width - .1, .1, 1.04], [x + bay.width / 2, top - .1, z + .575], isGhost ? ghost : deck, hit);
      if (cell.guardrails) {
        for (const y of [top + .45, top + .95]) rod(side, [x, y, z + 1.15], [x + bay.width, y, z + 1.15], protection, hit, .033);
        for (const bx of [x, x + bay.width]) rod(side, [bx, top, z + 1.15], [bx, top + 1.02, z + 1.15], structure, hit, .04);
      }
      if (cell.braces) {
        rod(side, [x, bottom, z + 1.15], [x + bay.width, top, z + 1.15], structure, hit, .035);
        rod(side, [x + bay.width, bottom, z + 1.15], [x, top, z + 1.15], structure, hit, .035);
      }
      if (cell.brackets) {
        for (const bx of [x + .2, x + bay.width - .2]) {
          rod(side, [bx, top, z], [bx, top, z - .6], protection, hit);
          rod(side, [bx, top - .5, z], [bx, top, z - .6], protection, hit);
        }
        box(side, [bay.width - .2, .08, .55], [x + bay.width / 2, top, z - .3], isGhost ? ghost : deck, hit);
      }
      const chosen = !isGhost && selection && (selection.kind === 'Lift' ? selection.level === level
        : selection.bayId === bay.id && (selection.kind === 'Bay' || selection.level === level));
      if (chosen) {
        box(side, [bay.width - .04, .08, 1.19], [x + bay.width / 2, top + .025, z + .575], highlight, hit);
        for (const bz of [z + .02, z + 1.13]) rod(side, [x + .03, top + .1, bz], [x + bay.width - .03, top + .1, bz], selectedEdge, hit, .065);
        if (selection.kind !== 'Lift') for (const bx of [x + .03, x + bay.width - .03]) {
          rod(side, [bx, bottom + .05, z + 1.13], [bx, top + .1, z + 1.13], selectedEdge, hit, .065);
        }
      }
      // A transparent pick volume keeps units selectable even without decking.
      if (!isGhost) {
        const pickMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
        box(side, [bay.width, cell.height, 1.15], [x + bay.width / 2, (top + bottom) / 2, z + .575], pickMat, hit);
      }
      bottom = top;
    });
    group.add(side);
  }
  if (stair && model.length) {
    const { bay, x, z } = bayLayout(model).filter(item => item.bay.side === 0).at(-1)!;
    const tower = new THREE.Group(), sx = x + bay.width + .5, total = cellElevation(bay, bay.cells.length);
    for (const bx of [sx, sx + .95]) rod(tower, [bx, 0, z], [bx, total, z], steel);
    for (let step = 0; step < total * 4; step++) box(tower, [.95, .05, .25], [sx + .475, step / 4, z + (step % 12) * .09], deck);
    group.add(tower);
  }
  return group;
}

export function componentScene(model: ScaffoldModel, placed: ComponentPlacement[], preview: string | null, selection: Selection | null, surface: Surface) {
  const group = new THREE.Group();
  const add = (name: string, bayId: string, level: number, isPreview: boolean) => {
    const layout = bayLayout(model).find(item => item.bay.id === bayId);
    if (!layout) return;
    const { bay, x, z } = layout;
    const cell = bay.cells[level - 1];
    if (!cell || (!isPreview && ((name === 'Steel deck' && !cell.deck) || (name === 'Guardrail' && !cell.guardrails)))) return;
    const material = surface(isPreview ? '#318ac4' : '#245a87', .6, isPreview ? .55 : 1);
    material.depthWrite = !isPreview;
    const component = createComponent(name, material, bay.width, cell.height);
    component.position.set(x + bay.width / 2, cellElevation(bay, level) + .1, z);
    component.traverse(object => { object.userData.placement = isPreview; if (!isPreview) object.userData.hit = { bayId, level }; });
    const side = new THREE.Group(); side.add(component); side.rotation.y = bay.side * Math.PI / 2; group.add(side);
  };
  placed.forEach(item => add(item.name, item.bayId, item.level, false));
  if (preview && model.length) add(preview, selection?.bayId ?? model[0].id, selection?.level ?? 1, true);
  return group;
}
