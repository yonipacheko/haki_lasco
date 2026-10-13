export type Rect = { left: number; top: number; right: number; bottom: number };
export type Point = { x: number; y: number };
export type SlotPlacementInput = { id: string; anchor: Point; outward: Point };
export type SlotPlacement = { id: string; rect: Rect; candidate: number };

const overlap = (a: Rect, b: Rect) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

/** Greedy, hysteresis-aware placement of slot cards near their projected anchors. */
export function layoutSlotCards(
  inputs: SlotPlacementInput[], size: { w: number; h: number }, area: Rect,
  obstacles: Rect[], model: Rect | null, strong: Rect | null, previous: Map<string, number>,
): SlotPlacement[] {
  const placed: Rect[] = [];
  const out: SlotPlacement[] = [];
  const angles = 16, radii = [0, 54, 92, 140, 200];
  for (const input of inputs) {
    const base = Math.atan2(input.outward.y, input.outward.x);
    let best: SlotPlacement | null = null; let bestScore = Infinity, bestRank = Infinity;
    let index = 0;
    const candidates: Point[] = [];
    for (const r of radii) {
      for (let i = 0; i < (r ? angles : 1); i++) {
        const a = base + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * (Math.PI * 2 / angles);
        candidates.push({ x: input.anchor.x + Math.cos(a) * r, y: input.anchor.y + Math.sin(a) * r });
      }
    }
    // Include clear model edges even when no nearby radial candidate reaches them.
    const xs = [input.anchor.x, area.left + size.w / 2, area.right - size.w / 2];
    const ys = [input.anchor.y, area.top + size.h / 2, area.bottom - size.h / 2];
    if (model) {
      xs.push(model.left - size.w / 2 - 12, model.right + size.w / 2 + 12);
      ys.push(model.top - size.h / 2 - 12, model.bottom + size.h / 2 + 12);
    }
    for (const x of xs) for (const y of ys) candidates.push({ x, y });
    for (const candidate of candidates) {
        let cx = candidate.x, cy = candidate.y;
        cx = Math.min(area.right - size.w / 2, Math.max(area.left + size.w / 2, cx));
        cy = Math.min(area.bottom - size.h / 2, Math.max(area.top + size.h / 2, cy));
        const rect = { left: cx - size.w / 2, right: cx + size.w / 2, top: cy - size.h / 2, bottom: cy + size.h / 2 };
        let score = Math.hypot(cx - input.anchor.x, cy - input.anchor.y) * .6;
        const uiOverlap = obstacles.reduce((sum, o) => sum + overlap(rect, o), 0)
          + placed.reduce((sum, p) => sum + overlap(rect, { left: p.left - 8, right: p.right + 8, top: p.top - 8, bottom: p.bottom + 8 }), 0);
        const selectedOverlap = strong ? overlap(rect, strong) : 0;
        const modelOverlap = model ? overlap(rect, model) : 0;
        // Clear controls and geometry take priority over a shorter leader line.
        const rank = (uiOverlap > 0 ? 100 : 0) + (selectedOverlap > 0 ? 10 : 0) + (modelOverlap > 0 ? 1 : 0);
        score += uiOverlap * 60 + selectedOverlap * 3 + modelOverlap * .35;
        if (previous.get(input.id) === index) score -= 40;
        if (rank < bestRank || (rank === bestRank && score < bestScore)) { bestRank = rank; bestScore = score; best = { id: input.id, rect, candidate: index }; }
        index++;
    }
    placed.push(best!.rect); out.push(best!);
  }
  return out;
}
