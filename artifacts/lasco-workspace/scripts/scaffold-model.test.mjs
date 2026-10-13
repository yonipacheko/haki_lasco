import test from 'node:test';
import assert from 'node:assert/strict';
import { availableDirections, bayLayout, editCells, partsSummary, previewBay, previewEdit, previewLift, removeLift, selectionAfterRemoval, selectionLabel, starterModel } from '../src/scaffold-model.ts';
import { addBayContextPosition, contextPosition, overlaps } from '../src/context-position.ts';

test('neighbor previews do not mutate the committed scaffold and reject occupied directions', () => {
  const model = starterModel();
  assert.equal(previewBay(model, '0-2', 'East', 2.5), null);
  const preview = previewBay(model, '0-3', 'North', 2);
  assert.equal(model.length, 12);
  assert.equal(preview.model.length, 13);
  assert.equal(preview.model.find(bay => bay.id === preview.addedBayId).width, 2);
  assert.ok(!availableDirections(preview.model, preview.addedBayId).includes('South'));
  assert.ok(availableDirections(preview.model, preview.addedBayId).includes('North'));
});

test('world West neighbor snaps outside a free row end without moving existing bays', () => {
  const model = starterModel().filter(bay => bay.side === 0);
  const preview = previewBay(model, '0-1', 'West', 3);
  const before = bayLayout(model), after = bayLayout(preview.model);
  for (const layout of before) assert.equal(after.find(item => item.bay.id === layout.bay.id).x, layout.x);
  const added = after.find(item => item.bay.id === preview.addedBayId);
  assert.equal(added.x + added.bay.width, before[0].x);
});

test('lift previews distinguish all-bay and selected-bay scope and obey the limit', () => {
  const model = starterModel();
  const local = previewLift(model, '0-3', true, 2);
  assert.equal(model[2].cells.length, 3);
  assert.equal(local.addedCells.length, 1);
  assert.equal(local.model[2].cells.length, 4);
  assert.equal(local.model[0].cells.length, 3);
  const global = previewLift(model, '0-3', false, 2.5);
  assert.equal(global.addedCells.length, 12);
  assert.ok(global.model.every(bay => bay.cells.length === 4));
  const five = previewLift(global.model, '0-3', false, 3).model;
  assert.equal(previewLift(five, '0-3', false, 3), null);
});

test('bay, lift and unit option changes have distinct scope', () => {
  const model = starterModel();
  const unit = editCells(model, { kind: 'Unit', bayId: '0-3', level: 2 }, { deck: false, brackets: true });
  assert.equal(unit.flatMap(bay => bay.cells).filter(cell => !cell.deck).length, 1);
  assert.equal(unit.flatMap(bay => bay.cells).filter(cell => cell.brackets).length, 1);
  const bay = editCells(model, { kind: 'Bay', bayId: '0-3', level: 2 }, { deck: false });
  assert.equal(bay.flatMap(item => item.cells).filter(cell => !cell.deck).length, 3);
  const lift = editCells(model, { kind: 'Lift', bayId: '0-3', level: 2 }, { guardrails: false, braces: false, brackets: true, height: 2 });
  assert.ok(lift.every(bay => !bay.cells[1].guardrails && !bay.cells[1].braces && bay.cells[1].brackets && bay.cells[1].height === 2));
  assert.ok(lift.every(bay => bay.cells[0].guardrails && bay.cells[2].guardrails));
});

test('removing a lift preserves other lift options and can target just one bay', () => {
  const model = editCells(starterModel(), { kind: 'Unit', bayId: '0-3', level: 3 }, { brackets: true });
  const local = removeLift(model, { kind: 'Lift', bayId: '0-3', level: 2 }, true);
  assert.equal(local[2].cells.length, 2);
  assert.equal(local[2].cells[1].brackets, true);
  assert.equal(local[0].cells.length, 3);
  const global = removeLift(model, { kind: 'Lift', bayId: '0-3', level: 2 }, false);
  assert.ok(global.every(bay => bay.cells.length === 2));
  const one = removeLift(global, { kind: 'Lift', bayId: '0-3', level: 1 }, false);
  assert.equal(removeLift(one, { kind: 'Lift', bayId: '0-3', level: 1 }, false), null);
});

test('illustrative BOM updates when option geometry changes', () => {
  const model = editCells(starterModel(), { kind: 'Lift', bayId: '0-3', level: 2 }, { deck: false, guardrails: false, braces: false, brackets: true });
  const parts = Object.fromEntries(partsSummary(model, [], false));
  assert.equal(parts['Deck units'], 24);
  assert.equal(parts['Guard frames'], 48);
  assert.equal(parts['Diagonal braces'], 48);
  assert.equal(parts.Brackets, 24);
});

test('direction must be explicitly chosen before an add-bay preview exists', () => {
  const model = starterModel(), selection = { kind: 'Bay', bayId: '0-3', level: 2 };
  assert.equal(previewEdit(model, selection, 'add-bay', 2.5, 3, '', true, {}), null);
  assert.equal(previewEdit(model, selection, 'add-bay', 2.5, 3, 'South', true, {}), null);
  assert.equal(previewEdit(model, selection, 'add-bay', 2.5, 3, 'North', true, {}).model.length, 13);
});

test('live option and removal previews never modify the original snapshot', () => {
  const model = starterModel(), original = JSON.stringify(model), selection = { kind: 'Lift', bayId: '0-3', level: 2 };
  const change = previewEdit(model, selection, 'height', 2.5, 2, '', true, {});
  assert.equal(change.changedCells.length, 12);
  assert.equal(change.model[0].cells[1].height, 2);
  const removal = previewEdit(model, selection, 'remove-local-lift', 2.5, 3, '', true, {});
  assert.deepEqual(removal.removedCells, [{ bayId: '0-3', level: 2 }]);
  assert.equal(removal.model[2].cells.length, 2);
  assert.equal(JSON.stringify(model), original);
});

test('lift identity names the bay reference independently of whole-lift edit scope', () => {
  assert.equal(selectionLabel({ kind: 'Lift', bayId: '0-3', level: 2 }, starterModel()), 'Lift 2 · Bay 03 · North');
});

test('context placement stays beside selection without overlapping the model', () => {
  const model = { left: 400, top: 160, right: 860, bottom: 700 };
  const bounds = { anchor: { left: 720, top: 320, right: 830, bottom: 460 }, selected: model, model };
  const area = { left: 312, top: 104, right: 1424, bottom: 830 };
  const placed = contextPosition(bounds, area, 264, 280);
  assert.equal(placed.placement, 'near-selection');
  assert.equal(placed.left, 876);
  assert.equal(overlaps({ ...placed, right: placed.left + 264, bottom: placed.top + 280 }, model), false);
  assert.equal(contextPosition(null, area, 264, 280).placement, 'clear-area');
});

test('removal selects a valid remaining neighbor without mutating the undo snapshot', () => {
  const model = starterModel(), original = JSON.stringify(model);
  const bay = { kind: 'Bay', bayId: '0-3', level: 2 };
  const next = model.filter(item => item.id !== bay.bayId);
  assert.deepEqual(selectionAfterRemoval(model, next, bay), { kind: 'Bay', bayId: '0-2', level: 2 });
  const lift = { kind: 'Lift', bayId: '0-3', level: 3 };
  const withoutLift = removeLift(model, lift, true);
  assert.deepEqual(selectionAfterRemoval(model, withoutLift, lift), { kind: 'Lift', bayId: '0-3', level: 2 });
  assert.equal(JSON.stringify(model), original);
});

test('world directions expose all free slots and block the building and occupied neighbors', () => {
  const model = starterModel();
  assert.deepEqual(availableDirections(model, '0-2'), ['North']);
  assert.deepEqual(availableDirections(model, '1-1'), ['North', 'East']);
  assert.deepEqual(availableDirections(model, '2-2'), ['South']);
  assert.deepEqual(availableDirections(model, '3-3'), ['North', 'West']);
  const next = previewBay(model, '0-2', 'North', 2.5).model;
  assert.deepEqual(availableDirections(next, '0-2'), []);
  assert.equal(previewBay(next, '0-2', 'North', 2.5), null);
});

test('every available cardinal preview snaps in world space and preserves every committed bay', () => {
  const model = starterModel(), snapshot = JSON.stringify(model), original = bayLayout(model);
  const rotate = (side, x, z) => side === 0 ? [x, z] : side === 1 ? [z, -x] : side === 2 ? [-x, -z] : [-z, x];
  const center = layout => rotate(layout.bay.side, layout.x + layout.bay.width / 2, layout.z + 1.15 / 2);
  const vectors = { North: [0, 1], East: [1, 0], South: [0, -1], West: [-1, 0] };
  const tested = new Set();
  for (const source of original) for (const direction of availableDirections(model, source.bay.id)) {
    const preview = previewBay(model, source.bay.id, direction, source.bay.width);
    const candidate = bayLayout(preview.model), added = candidate.find(item => item.bay.id === preview.addedBayId);
    const from = center(source), to = center(added), delta = [to[0] - from[0], to[1] - from[1]];
    const [x, z] = vectors[direction];
    assert.ok(delta[0] * x + delta[1] * z > 0);
    assert.ok(Math.abs(delta[0] * z - delta[1] * x) < .00001);
    for (const before of original) {
      const after = candidate.find(item => item.bay.id === before.bay.id);
      assert.equal(after.x, before.x); assert.equal(after.z, before.z);
    }
    assert.ok(!availableDirections(preview.model, source.bay.id).includes(direction));
    tested.add(direction);
  }
  assert.deepEqual([...tested].sort(), ['East', 'North', 'South', 'West']);
  assert.equal(JSON.stringify(model), snapshot);
});

test('explicit neighbors retain the six-bay elevation limit', () => {
  let model = starterModel();
  for (const id of ['0-1', '0-2', '0-3']) model = previewBay(model, id, 'North', 2.5).model;
  assert.equal(model.filter(bay => bay.side === 0).length, 6);
  assert.deepEqual(availableDirections(model, '0-4'), []);
});

test('Add bay panel chooses the closest clear side without covering surrounding scaffold', () => {
  const model = { left: 400, top: 160, right: 850, bottom: 700 };
  const area = { left: 16, top: 104, right: 1424, bottom: 830 };
  for (const [anchor, side] of [[{ left: 410, top: 320, right: 460, bottom: 460 }, 'left'], [{ left: 780, top: 320, right: 840, bottom: 460 }, 'right']]) {
    const position = addBayContextPosition({ anchor, selected: anchor, model }, area, 264, 300);
    assert.equal(position.placement, `near-selection-${side}`);
    assert.equal(overlaps({ ...position, right: position.left + 264, bottom: position.top + 300 }, model), false);
  }
});
