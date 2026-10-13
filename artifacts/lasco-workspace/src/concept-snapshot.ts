import type { ComponentPlacement, ScaffoldModel } from './scaffold-model';

export const CONCEPT_STORAGE_KEY = 'haki-lasco.saved-concept';
export const CONCEPT_VERSION = 1;
const FORMAT = 'haki-lasco-concept';
const MAX_LENGTH = 1_000_000;
const COMPONENTS = ['Standard', 'Ledger', 'Diagonal brace', 'Base jack', 'Steel deck', 'Toe board', 'Stair flight', 'Access ladder', 'Guardrail', 'End frame'];

export type ConceptState = { model: ScaffoldModel; placed: ComponentPlacement[]; stair: boolean; starter: boolean };
export type ConceptSnapshot = ConceptState & { format: typeof FORMAT; version: typeof CONCEPT_VERSION };

function invalid(): never {
  throw new Error('Saved concept is malformed. Current concept unchanged.');
}

function record(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  const result = value as Record<string, unknown>;
  if (Object.keys(result).length !== keys.length || keys.some(key => !Object.hasOwn(result, key))) return invalid();
  return result;
}

function boolean(value: unknown): boolean {
  return typeof value === 'boolean' ? value : invalid();
}

function integer(value: unknown, min = 1): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min ? value : invalid();
}

function dimension(value: unknown): number {
  return typeof value === 'number' && [2, 2.5, 3].includes(value) ? value : invalid();
}

function identifier(value: unknown): string {
  return typeof value === 'string' && value.length > 0 && value.length <= 80 ? value : invalid();
}

/** Validate everything, including cross-references, before returning detached data. */
export function parseConcept(text: string): ConceptSnapshot {
  if (text.length > MAX_LENGTH) return invalid();
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return invalid(); }
  const root = record(raw, ['format', 'version', 'model', 'placed', 'stair', 'starter']);
  if (root.format !== FORMAT || root.version !== CONCEPT_VERSION) {
    throw new Error('Saved concept uses an incompatible format or version. Current concept unchanged.');
  }
  if (!Array.isArray(root.model) || root.model.length < 4 || root.model.length > 24) return invalid();
  const ids = new Set<string>();
  const sideCounts = [0, 0, 0, 0];
  const model: ScaffoldModel = root.model.map(value => {
    const bay = record(value, ['id', 'side', 'number', 'width', 'cells']);
    const id = identifier(bay.id);
    const side = integer(bay.side, 0);
    const number = integer(bay.number);
    if (side > 3 || id !== `${side}-${number}` || ids.has(id)) return invalid();
    ids.add(id);
    sideCounts[side]++;
    if (!Array.isArray(bay.cells) || bay.cells.length < 1 || bay.cells.length > 5) return invalid();
    return { id, side, number, width: dimension(bay.width), cells: bay.cells.map(value => {
      const cell = record(value, ['height', 'deck', 'guardrails', 'braces', 'brackets']);
      return { height: dimension(cell.height), deck: boolean(cell.deck), guardrails: boolean(cell.guardrails), braces: boolean(cell.braces), brackets: boolean(cell.brackets) };
    }) };
  });
  if (sideCounts.some(count => count < 1 || count > 6)) return invalid();
  if (!Array.isArray(root.placed) || root.placed.length > 10_000) return invalid();
  const placed: ComponentPlacement[] = root.placed.map(value => {
    const item = record(value, ['id', 'name', 'bayId', 'level']);
    const bayId = identifier(item.bayId);
    const level = integer(item.level);
    const bay = model.find(bay => bay.id === bayId);
    if (!bay || level > bay.cells.length || typeof item.name !== 'string' || !COMPONENTS.includes(item.name)) return invalid();
    return { id: integer(item.id), name: item.name, bayId, level };
  });
  const stair = boolean(root.stair), starter = boolean(root.starter);
  if (!starter && (stair || placed.length)) return invalid();
  return { format: FORMAT, version: CONCEPT_VERSION, model, placed, stair, starter };
}

/** Deliberately pick committed fields; never serialize scene previews or UI state. */
export function serializeConcept(state: ConceptState): string {
  const text = JSON.stringify({
    format: FORMAT, version: CONCEPT_VERSION,
    model: state.model, placed: state.placed, stair: state.stair, starter: state.starter,
  });
  return JSON.stringify(parseConcept(text));
}

type ConceptStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function saveConcept(storage: ConceptStorage, state: ConceptState): void {
  const text = serializeConcept(state);
  try { storage.setItem(CONCEPT_STORAGE_KEY, text); } catch {
    throw new Error('Save failed: browser storage is unavailable or full. Previous save was not replaced.');
  }
}

export function openConcept(storage: ConceptStorage): ConceptSnapshot {
  let text: string | null;
  try { text = storage.getItem(CONCEPT_STORAGE_KEY); } catch {
    throw new Error('Open failed: browser storage is unavailable. Current concept unchanged.');
  }
  if (text === null) throw new Error('No saved concept in this browser. Use Save concept first.');
  return parseConcept(text);
}
