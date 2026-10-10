export type ScreenRect = { left: number; top: number; right: number; bottom: number };
export type SelectionScreenBounds = { anchor: ScreenRect; selected: ScreenRect; model: ScreenRect };
export const overlaps = (a: ScreenRect, b: ScreenRect, gap = 10) => a.left < b.right + gap && a.right > b.left - gap && a.top < b.bottom + gap && a.bottom > b.top - gap;

/** Place beside the projected selection, avoiding the model and occupied UI. */
export function contextPosition(bounds: SelectionScreenBounds | null, area: ScreenRect, width: number, height: number) {
  const maxTop = Math.max(area.top, area.bottom - height);
  const clampTop = (top: number) => Math.max(area.top, Math.min(maxTop, top));
  if (!bounds) return { left: area.right - width, top: area.top, placement: 'clear-area' };
  const center = (bounds.anchor.top + bounds.anchor.bottom) / 2;
  const candidates = [
    { left: Math.max(bounds.anchor.right, bounds.model.right) + 16, top: clampTop(center - height / 2) },
    { left: Math.min(bounds.anchor.left, bounds.model.left) - width - 16, top: clampTop(center - height / 2) },
    { left: Math.max(area.left, Math.min(area.right - width, (bounds.anchor.left + bounds.anchor.right - width) / 2)), top: bounds.model.top - height - 16 },
    { left: Math.max(area.left, Math.min(area.right - width, (bounds.anchor.left + bounds.anchor.right - width) / 2)), top: bounds.model.bottom + 16 },
  ];
  for (const candidate of candidates) {
    const rect = { ...candidate, right: candidate.left + width, bottom: candidate.top + height };
    if (rect.left >= area.left && rect.right <= area.right && rect.top >= area.top && rect.bottom <= area.bottom && !overlaps(rect, bounds.selected) && !overlaps(rect, bounds.model)) return { ...candidate, placement: 'near-selection' };
  }
  // The viewport reserves this clear strip while contextual controls are open.
  return { left: area.right - width, top: clampTop(center - height / 2), placement: 'clear-area' };
}
