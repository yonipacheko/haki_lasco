import * as THREE from 'three';

export type PlacedComponent = { id: number; name: string; bay: number; level: number; side: number };

/** Simplified component geometry for the UX demo, not a construction model. */
export function createComponent(name: string, material: THREE.Material, width: number, height: number) {
  const group = new THREE.Group();
  const box = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    group.add(mesh);
  };
  const rod = (a: number[], b: number[], radius = .065) => {
    const start = new THREE.Vector3(...a);
    const end = new THREE.Vector3(...b);
    const direction = end.clone().sub(start);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 6), material);
    mesh.position.copy(start.add(end).multiplyScalar(.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    group.add(mesh);
  };
  switch (name) {
    case 'Standard':
      rod([-.35, 0, .55], [-.35, height, .55], .09);
      break;
    case 'Ledger':
      rod([-width / 2, .25, .55], [width / 2, .25, .55], .075);
      break;
    case 'Diagonal brace':
      rod([-width / 2, .15, .55], [width / 2, height, .55]);
      break;
    case 'Base jack':
      box(.4, .1, .4, 0, .06, .55);
      rod([0, .1, .55], [0, .65, .55], .09);
      break;
    case 'Steel deck':
      box(width - .16, .13, 1, 0, .14, .55);
      break;
    case 'Toe board':
      box(width - .1, .2, .06, 0, .18, 1.1);
      break;
    case 'Guardrail':
      rod([-width / 2, 1.05, 1.1], [width / 2, 1.05, 1.1]);
      rod([-width / 2, .5, 1.1], [width / 2, .5, 1.1]);
      break;
    case 'Access ladder':
      for (const x of [-.3, .3]) rod([x, 0, .45], [x, height, .45], .04);
      for (let y = .2; y < height; y += .3) rod([-.3, y, .45], [.3, y, .45], .035);
      break;
    case 'Stair flight':
      for (let step = 0; step < 10; step++) box(.9, .055, .2, 0, step * height / 10, step * .1);
      rod([-.5, .1, 0], [-.5, height, 1]);
      rod([.5, .1, 0], [.5, height, 1]);
      break;
    case 'End frame':
      for (const x of [-.5, .5]) rod([x, 0, .55], [x, height, .55]);
      rod([-.5, height, .55], [.5, height, .55]);
      break;
  }
  group.traverse(object => { object.userData.placement = true; });
  return group;
}
