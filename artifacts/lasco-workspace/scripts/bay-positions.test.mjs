import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { availableBayPositions, availableDirections, bayLayout, previewBay, starterModel } from '../src/scaffold-model.ts';
import { layoutSlotCards } from '../src/bay-slot-layout.ts';

const rectFor = ({ bay, x, z }) => {
  const corners = [x, x + bay.width].flatMap(a => [z, z + 1.15].map(b =>
    new THREE.Vector3(a, 0, b).applyAxisAngle(new THREE.Vector3(0, 1, 0), bay.side * Math.PI / 2)));
  return {
    left: Math.min(...corners.map(p => p.x)), right: Math.max(...corners.map(p => p.x)),
    bottom: Math.min(...corners.map(p => p.z)), top: Math.max(...corners.map(p => p.z)),
  };
};
const approximately = (a, b) => assert.ok(Math.abs(a - b) < .000001, `${a} != ${b}`);

test('end positions distinguish extending the run from adding alongside it; middle has no occupied run slot', () => {
  const model = starterModel();
  const end = availableBayPositions(model, '1-1');
  assert.deepEqual(end.map(s => [s.direction, s.kind, s.shortLabel]), [
    ['North', 'run', 'Along run'], ['East', 'side', 'Outer side'],
  ]);
  assert.deepEqual(availableBayPositions(model, '1-2').map(s => [s.direction, s.kind]), [['East', 'side']]);
  assert.deepEqual(availableBayPositions(model, '3-3').map(s => [s.direction, s.kind]), [['North', 'run'], ['West', 'side']]);
});

test('each visible position is the exact empty snapped preview footprint and selected-bay shared edge', () => {
  const model = starterModel();
  const original = JSON.stringify(model);
  for (const bay of model) for (const width of [2, 2.5, 3]) {
    const slots = availableBayPositions(model, bay.id, width);
    assert.deepEqual(slots.map(s => s.direction), availableDirections(model, bay.id, width));
    const source = rectFor(bayLayout(model).find(l => l.bay.id === bay.id));
    for (const slot of slots) {
      const preview = previewBay(model, bay.id, slot.direction, width);
      assert.ok(preview);
      const actual = rectFor(bayLayout(preview.model).find(l => l.bay.id === preview.addedBayId));
      for (const key of Object.keys(actual)) approximately(slot.footprint[key], actual[key]);
      approximately(slot.center.x, (actual.left + actual.right) / 2);
      approximately(slot.center.z, (actual.bottom + actual.top) / 2);
      assert.ok(slot.attachment.x >= source.left - 1e-6 && slot.attachment.x <= source.right + 1e-6);
      assert.ok(slot.attachment.z >= source.bottom - 1e-6 && slot.attachment.z <= source.top + 1e-6);
      assert.ok(slot.attachment.x >= actual.left - 1e-6 && slot.attachment.x <= actual.right + 1e-6);
      assert.ok(slot.attachment.z >= actual.bottom - 1e-6 && slot.attachment.z <= actual.top + 1e-6);
      assert.ok(preview.label.startsWith(slot.label));
      assert.ok(!availableBayPositions(preview.model, bay.id, width).some(s => s.direction === slot.direction));
    }
  }
  assert.equal(JSON.stringify(model), original);
});

test('the same physical slot stays camera-independent through orbit and zoom', () => {
  const slot = availableBayPositions(starterModel(), '1-1').find(s => s.kind === 'run');
  const camera = new THREE.PerspectiveCamera(36, 1.5, .1, 100);
  const point = new THREE.Vector3(slot.center.x, 6.14, slot.center.z);
  const results = [];
  for (const [x, z, zoom] of [[20, 26, 1], [-26, 20, 1], [-20, -26, 1.5], [26, -20, .8]]) {
    camera.position.set(x, 14, z); camera.lookAt(0, 4.25, 0); camera.zoom = zoom;
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    results.push(point.clone().project(camera).toArray());
    const same = availableBayPositions(starterModel(), '1-1').find(s => s.direction === slot.direction);
    assert.deepEqual(same, slot);
  }
  assert.notDeepEqual(results[0], results[1]);
  assert.notDeepEqual(results[1], results[2]);
});

test('position cards remain in the viewport and clear of selected geometry, other cards and panels when space is available', () => {
  const area = { left: 300, top: 0, right: 1140, bottom: 840 };
  const model = { left: 550, top: 230, right: 880, bottom: 700 };
  const selected = { left: 700, top: 320, right: 860, bottom: 670 };
  const panels = [{ left: 312, top: 12, right: 720, bottom: 96 }];
  const input = [
    { id: 'North', anchor: { x: 890, y: 340 }, outward: { x: 20, y: -30 } },
    { id: 'East', anchor: { x: 885, y: 550 }, outward: { x: 20, y: 15 } },
  ];
  const placements = layoutSlotCards(input, { w: 132, h: 48 }, area, panels, model, selected, new Map());
  const intersects = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  for (const p of placements) {
    assert.ok(p.rect.left >= area.left && p.rect.right <= area.right && p.rect.top >= area.top && p.rect.bottom <= area.bottom);
    assert.ok(!intersects(p.rect, selected));
    assert.ok(!intersects(p.rect, model));
    for (const panel of panels) assert.ok(!intersects(p.rect, panel));
  }
  assert.ok(!intersects(placements[0].rect, placements[1].rect));
});

test('model-edge candidates keep controls clear when a nearby action panel blocks the nearest slot', () => {
  const area = { left: 302, top: 6, right: 1138, bottom: 836 };
  const model = { left: 456, top: 190, right: 979, bottom: 765 };
  const selected = { left: 850, top: 350, right: 940, bottom: 755 };
  const panels = [
    { left: 1005, top: 320, right: 1284, bottom: 798 },
    { left: 304, top: 8, right: 625, bottom: 104 },
    { left: 620, top: 846, right: 826, bottom: 888 },
  ];
  const input = [
    { id: 'North', anchor: { x: 891, y: 598 }, outward: { x: -5, y: 18 } },
    { id: 'East', anchor: { x: 940, y: 539 }, outward: { x: 22, y: -3 } },
  ];
  const placements = layoutSlotCards(input, { w: 132, h: 48 }, area, panels, model, selected, new Map());
  const intersects = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  for (const { rect } of placements) {
    assert.ok(!intersects(rect, model), JSON.stringify(rect));
    for (const panel of panels) assert.ok(!intersects(rect, panel), JSON.stringify(rect));
  }
  assert.ok(!intersects(placements[0].rect, placements[1].rect));
});
