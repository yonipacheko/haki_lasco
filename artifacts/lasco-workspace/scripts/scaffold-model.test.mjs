import test from 'node:test';
import assert from 'node:assert/strict';
import { availableDirections, bayLayout, editCells, partsSummary, previewBay, previewLift, removeLift, starterModel } from '../src/scaffold-model.ts';

test('neighbor previews do not mutate the committed scaffold and reject occupied directions', () => {
  const model = starterModel();
  assert.equal(previewBay(model, '0-2', 'right', 2.5), null);
  const preview = previewBay(model, '0-3', 'right', 2);
  assert.equal(model.length, 12);
  assert.equal(preview.model.length, 13);
  assert.equal(preview.model.find(bay => bay.id === preview.addedBayId).width, 2);
  assert.deepEqual(availableDirections(preview.model, preview.addedBayId), ['right']);
});

test('left neighbor snaps outside the original bays without moving existing bays', () => {
  const model = starterModel();
  const preview = previewBay(model, '0-1', 'left', 3);
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
