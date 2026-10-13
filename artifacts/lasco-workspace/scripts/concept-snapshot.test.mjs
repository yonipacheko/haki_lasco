import test from 'node:test';
import assert from 'node:assert/strict';
import { starterModel, previewBay, previewLift, editCells } from '../src/scaffold-model.ts';
import { CONCEPT_STORAGE_KEY, openConcept, parseConcept, saveConcept, serializeConcept } from '../src/concept-snapshot.ts';

const state = () => ({ model: starterModel(), placed: [], stair: false, starter: true });
const snapshot = () => JSON.parse(serializeConcept(state()));
const storage = () => {
  const items = new Map();
  return { getItem: key => items.get(key) ?? null, setItem: (key, text) => items.set(key, text) };
};

test('round trip restores edited geometry, placements, stair and starter state', () => {
  const concept = state();
  concept.model = previewBay(concept.model, '0-1', 'left', 2).model;
  concept.model = previewLift(concept.model, '0-1', true, 2.5).model;
  concept.model = editCells(concept.model, { kind: 'Unit', bayId: '0-1', level: 2 }, { deck: false, brackets: true });
  concept.placed = [{ id: 42, name: 'Stair flight', bayId: '0-1', level: 4 }];
  concept.stair = true;
  const loaded = parseConcept(serializeConcept(concept));
  for (const key of Object.keys(concept)) assert.deepEqual(loaded[key], concept[key]);
  loaded.model[0].cells[0].deck = false;
  assert.equal(concept.model[0].cells[0].deck, true);
});

test('empty workspace state is preserved and transient fields are excluded', () => {
  const concept = { ...state(), starter: false, preview: 'Standard', operation: { model: [] }, selection: { bayId: '0-1' }, history: [state()] };
  const loaded = parseConcept(serializeConcept(concept));
  assert.equal(loaded.starter, false);
  assert.deepEqual(Object.keys(loaded).sort(), ['format', 'version', 'model', 'placed', 'stair', 'starter'].sort());
});

test('explicit save survives a simulated reload; opening and editing never overwrites it', () => {
  const browser = storage(), original = state();
  saveConcept(browser, original);
  const freshSession = { ...state(), starter: false };
  assert.equal(freshSession.starter, false);
  const opened = openConcept(browser);
  assert.equal(opened.starter, true);
  opened.model[0].width = 3;
  assert.equal(openConcept(browser).model[0].width, 2.5);
  saveConcept(browser, opened);
  assert.equal(openConcept(browser).model[0].width, 3);
});

test('missing save, unavailable storage and quota errors are explicit', () => {
  assert.throws(() => openConcept(storage()), /No saved concept/);
  assert.throws(() => openConcept({ getItem() { throw new Error('blocked'); } }), /storage is unavailable/);
  assert.throws(() => saveConcept({ setItem() { throw new Error('quota'); } }, state()), /unavailable or full/);
});

test('invalid save fails validation before touching the previous browser save', () => {
  const browser = storage();
  saveConcept(browser, state());
  const previous = browser.getItem(CONCEPT_STORAGE_KEY);
  const broken = state();
  broken.model[0].width = Infinity;
  assert.throws(() => saveConcept(browser, broken), /malformed/);
  assert.equal(browser.getItem(CONCEPT_STORAGE_KEY), previous);
});

test('malformed JSON, oversized input, primitive roots and unsupported versions are rejected', () => {
  for (const text of ['{', 'null', '[]', '1', '"concept"', ' '.repeat(1_000_001)]) {
    assert.throws(() => parseConcept(text), /malformed/);
  }
  for (const change of [{ version: 2 }, { version: '1' }, { format: 'another-app' }]) {
    assert.throws(() => parseConcept(JSON.stringify({ ...snapshot(), ...change })), /incompatible/);
  }
});

test('invalid fields, counts and cross-references are rejected without mutating the current state', () => {
  const mutations = [
    s => { delete s.stair; },
    s => { s.preview = 'Standard'; },
    s => { s.stair = 'true'; },
    s => { s.starter = 1; },
    s => { s.model = []; },
    s => { s.model = s.model.filter(b => b.side !== 0); },
    s => { s.model[0].side = 4; },
    s => { s.model[0].side = 0.5; },
    s => { s.model[0].number = -1; },
    s => { s.model[0].id = 'missing'; },
    s => { s.model[1] = structuredClone(s.model[0]); },
    s => { s.model[0].width = 100; },
    s => { s.model[0].cells = []; },
    s => { s.model[0].cells.push(...s.model[0].cells); },
    s => { s.model[0].cells[0].height = 0; },
    s => { s.model[0].cells[0].deck = 1; },
    s => { s.model[0].cells[0].unexpected = true; },
    s => { s.placed = [{ id: 1, name: 'Unknown', bayId: '0-1', level: 1 }]; },
    s => { s.placed = [{ id: 1, name: 'Standard', bayId: 'missing', level: 1 }]; },
    s => { s.placed = [{ id: 1, name: 'Standard', bayId: '0-1', level: 4 }]; },
    s => { s.placed = [{ id: -1, name: 'Standard', bayId: '0-1', level: 1 }]; },
    s => { s.placed = [{ id: 1, name: 'Standard', bayId: '0-1', level: 1.5 }]; },
    s => { s.starter = false; s.stair = true; },
    s => { s.starter = false; s.placed = [{ id: 1, name: 'Standard', bayId: '0-1', level: 1 }]; },
  ];
  const current = state(), before = structuredClone(current);
  for (const mutate of mutations) {
    const saved = snapshot();
    mutate(saved);
    const browser = storage();
    browser.setItem(CONCEPT_STORAGE_KEY, JSON.stringify(saved));
    assert.throws(() => openConcept(browser), /malformed/);
    assert.deepEqual(current, before);
  }
});
