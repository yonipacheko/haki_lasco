export const elevations = ['North', 'East', 'South', 'West'];
export type SelectionKind = 'Bay' | 'Lift' | 'Unit';
export type Selection = { kind: SelectionKind; bayId: string; level: number };
export type CellOptions = { height: number; deck: boolean; guardrails: boolean; braces: boolean; brackets: boolean };
export type ScaffoldBay = { id: string; side: number; number: number; width: number; cells: CellOptions[] };
export type ScaffoldModel = ScaffoldBay[];
export type AdditionPreview = { model: ScaffoldModel; label: string; addedBayId?: string; addedCells: { bayId: string; level: number }[]; changedBayIds?: string[]; changedCells?: { bayId: string; level: number }[]; removedCells?: { bayId: string; level: number }[]; removedBayIds?: string[] };
export type ComponentPlacement = { id: number; name: string; bayId: string; level: number };
export const defaultCell = (height = 3): CellOptions => ({ height, deck: true, guardrails: true, braces: true, brackets: false });

export function starterModel(): ScaffoldModel {
  return elevations.flatMap((_, side) => Array.from({ length: 3 }, (_, i) => ({
    id: `${side}-${i + 1}`, side, number: i + 1, width: 2.5,
    cells: Array.from({ length: 3 }, () => defaultCell()),
  })));
}

export function selectionLabel(selection: Selection, model: ScaffoldModel) {
  const bay = model.find(item => item.id === selection.bayId);
  if (!bay) return 'Scaffold';
  const bayLabel = `Bay ${String(bay.number).padStart(2, '0')} · ${elevations[bay.side]}`;
  if (selection.kind === 'Bay') return bayLabel;
  if (selection.kind === 'Lift') return `Lift ${selection.level} · Bay ${String(bay.number).padStart(2, '0')} · ${elevations[bay.side]}`;
  return `Unit · Lift ${selection.level} · Bay ${String(bay.number).padStart(2, '0')} · ${elevations[bay.side]}`;
}

export function bayLayout(model: ScaffoldModel) {
  return model.map(bay => {
    const side = model.filter(item => item.side === bay.side);
    const index = side.findIndex(item => item.id === bay.id);
    const anchor = side.findIndex(item => item.number === Math.min(...side.map(item => item.number)));
    const offset = side.slice(0, anchor).reduce((sum, item) => sum + item.width, 0);
    return { bay, x: -3.75 - offset + side.slice(0, index).reduce((sum, item) => sum + item.width, 0), z: bay.side % 2 ? 4.35 : 3.45 };
  });
}

export function cellElevation(bay: ScaffoldBay, level: number) {
  return bay.cells.slice(0, level).reduce((sum, cell) => sum + cell.height, 0);
}

export function targetCells(model: ScaffoldModel, selection: Selection) {
  return model.flatMap(bay => bay.cells.flatMap((cell, index) => {
    const level = index + 1;
    const matches = selection.kind === 'Lift' ? level === selection.level
      : bay.id === selection.bayId && (selection.kind === 'Bay' || level === selection.level);
    return matches ? [{ bay, cell, level }] : [];
  }));
}

export function editCells(model: ScaffoldModel, selection: Selection, changes: Partial<CellOptions>): ScaffoldModel {
  return model.map(bay => ({ ...bay, cells: bay.cells.map((cell, index) => {
    const matches = selection.kind === 'Lift' ? index + 1 === selection.level
      : bay.id === selection.bayId && (selection.kind === 'Bay' || index + 1 === selection.level);
    return matches ? { ...cell, ...changes } : cell;
  }) }));
}

export function availableDirections(model: ScaffoldModel, bayId: string) {
  const bay = model.find(item => item.id === bayId);
  if (!bay) return [];
  const side = model.filter(item => item.side === bay.side);
  if (side.length >= 6) return [];
  return [
    ...(side[0].id === bayId ? ['left'] : []),
    ...(side[side.length - 1].id === bayId ? ['right'] : []),
  ];
}

export function previewBay(model: ScaffoldModel, bayId: string, direction: string, width: number): AdditionPreview | null {
  if (!availableDirections(model, bayId).includes(direction)) return null;
  const source = model.find(item => item.id === bayId)!;
  const number = Math.max(...model.filter(bay => bay.side === source.side).map(bay => bay.number)) + 1;
  const bay: ScaffoldBay = { ...source, id: `${source.side}-${number}`, number, width, cells: source.cells.map(cell => ({ ...cell })) };
  const index = model.findIndex(item => item.id === bayId) + (direction === 'right' ? 1 : 0);
  const candidate = [...model];
  candidate.splice(index, 0, bay);
  return { model: candidate, addedBayId: bay.id, addedCells: [], label: `Neighboring bay · ${direction} · ${width.toFixed(1)} m` };
}

export function previewLift(model: ScaffoldModel, bayId: string, onlyBay: boolean, height: number): AdditionPreview | null {
  const targets = model.filter(bay => !onlyBay || bay.id === bayId);
  if (!targets.length || targets.some(bay => bay.cells.length >= 5)) return null;
  return {
    model: model.map(bay => (!onlyBay || bay.id === bayId) ? { ...bay, cells: [...bay.cells, defaultCell(height)] } : bay),
    addedCells: targets.map(bay => ({ bayId: bay.id, level: bay.cells.length + 1 })),
    label: `${onlyBay ? 'Selected bay' : 'All bays'} · new top lift · ${height.toFixed(1)} m`,
  };
}

export function removeLift(model: ScaffoldModel, selection: Selection, onlyBay: boolean): ScaffoldModel | null {
  const targets = model.filter(bay => (!onlyBay || bay.id === selection.bayId) && bay.cells.length >= selection.level);
  if (!targets.length || targets.some(bay => bay.cells.length <= 1)) return null;
  return model.map(bay => targets.some(target => target.id === bay.id) ? { ...bay, cells: bay.cells.filter((_, i) => i + 1 !== selection.level) } : bay);
}

export function previewEdit(model: ScaffoldModel, selection: Selection, action: string, width: number, height: number, direction: string, deck: boolean, options: Pick<CellOptions, 'guardrails' | 'braces' | 'brackets'>): AdditionPreview | null {
  if (action === 'add-bay') return previewBay(model, selection.bayId, direction, width);
  if (action === 'add-lift' || action === 'add-local-lift') return previewLift(model, selection.bayId, action === 'add-local-lift', height);
  let next: ScaffoldModel | null;
  if (action === 'remove-bay') next = model.filter(bay => bay.id !== selection.bayId);
  else if (action === 'remove-lift' || action === 'remove-local-lift') next = removeLift(model, selection, action === 'remove-local-lift');
  else if (action === 'length') next = model.map(bay => bay.id === selection.bayId ? { ...bay, width } : bay);
  else next = editCells(model, selection, action === 'height' ? { height } : action === 'decking' ? { deck } : options);
  if (!next) return null;
  return {
    model: next, label: action.startsWith('remove-') ? 'Removal preview · red outline marks removed geometry' : 'Change preview · blue geometry shows the result',
    addedCells: [],
    changedBayIds: next.filter(bay => model.find(old => old.id === bay.id)?.width !== bay.width).map(bay => bay.id),
    changedCells: next.flatMap(bay => bay.cells.flatMap((cell, index) => JSON.stringify(cell) !== JSON.stringify(model.find(old => old.id === bay.id)?.cells[index]) ? [{ bayId: bay.id, level: index + 1 }] : [])),
    removedBayIds: model.filter(bay => !next!.some(item => item.id === bay.id)).map(bay => bay.id),
    removedCells: model.flatMap(bay => {
      const nextBay = next!.find(item => item.id === bay.id);
      return nextBay && nextBay.cells.length < bay.cells.length ? [{ bayId: bay.id, level: selection.level }] : [];
    }),
  };
}

export function selectionAfterRemoval(model: ScaffoldModel, next: ScaffoldModel, selection: Selection): Selection | null {
  const sameBay = next.find(bay => bay.id === selection.bayId);
  if (sameBay) return { ...selection, level: Math.min(selection.level, sameBay.cells.length) };
  const removed = model.find(bay => bay.id === selection.bayId);
  const side = model.filter(bay => bay.side === removed?.side);
  const index = side.findIndex(bay => bay.id === selection.bayId);
  const neighbor = side[index + 1] ?? side[index - 1];
  const remaining = next.find(bay => bay.id === neighbor?.id) ?? next[0];
  return remaining ? { kind: 'Bay', bayId: remaining.id, level: Math.min(selection.level, remaining.cells.length) } : null;
}

export function partsSummary(model: ScaffoldModel, placed: ComponentPlacement[], stair: boolean) {
  const cells = model.flatMap(bay => bay.cells);
  return [
    ['Standards', model.length * 4],
    ['Ledgers', cells.length * 4 + model.length * 4],
    ['Diagonal braces', cells.filter(cell => cell.braces).length * 2],
    ['Deck units', cells.filter(cell => cell.deck).length],
    ['Guard frames', cells.filter(cell => cell.guardrails).length * 2],
    ['Brackets', cells.filter(cell => cell.brackets).length * 2],
    ['Stair towers', stair ? 1 : 0],
    ['Placed components', placed.length],
  ] as const;
}
