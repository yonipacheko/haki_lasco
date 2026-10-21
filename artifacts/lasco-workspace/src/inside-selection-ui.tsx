import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { partLocation, type InsidePoint, type ScaffoldPart } from './inside-selection';
import './inside-selection-ui.css';

export function InsideModeControl({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button type="button" className={active ? 'active' : ''} aria-pressed={active} onClick={onToggle} data-testid="button-select-inside">
      {active ? 'Exit Select inside' : 'Select inside'}
    </button>
  );
}

export interface InsideSelectionOverlayProps {
  candidates: ScaffoldPart[];
  chooserPosition: InsidePoint | null;
  selected: ScaffoldPart | null;
  marker: InsidePoint | null;
  adjusting: boolean;
  draftHeight: number;
  appliedHeight: number | null;
  onChoose: (part: ScaffoldPart) => void;
  onDismissChooser: () => void;
  onAdjust: () => void;
  onHeightChange: (value: number) => void;
  onApply: () => void;
  onCancel: () => void;
  onExit: () => void;
  onClear: () => void;
}

type Area = { left: number; top: number; right: number; bottom: number };

export function InsideSelectionOverlay(p: InsideSelectionOverlayProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const chooserRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState<Area>({ left: 0, top: 0, right: 0, bottom: 0 });
  const [chooserPos, setChooserPos] = useState({ left: 0, top: 0 });
  const showChooser = !!p.chooserPosition && p.candidates.length > 1;

  useLayoutEffect(() => {
    const root = rootRef.current; const stage = root?.parentElement;
    if (!root || !stage) return;
    // Hidden, focused Levels content can scroll this overflow-hidden stage.
    stage.scrollTop = 0; stage.scrollLeft = 0;
    const update = () => {
      const scene = stage.querySelector<HTMLElement>('.scene-host');
      const left = scene?.offsetLeft ?? 0, top = scene?.offsetTop ?? 0;
      const next = { left, top, right: left + (scene?.clientWidth ?? stage.clientWidth), bottom: top + (scene?.clientHeight ?? stage.clientHeight) };
      setArea(a => a.left === next.left && a.top === next.top && a.right === next.right && a.bottom === next.bottom ? a : next);
    };
    update();
    const ro = new ResizeObserver(update); ro.observe(stage);
    const scene = stage.querySelector('.scene-host'); if (scene) ro.observe(scene);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!showChooser || !p.chooserPosition) return;
    const el = chooserRef.current; if (!el) return;
    const w = el.offsetWidth, h = el.offsetHeight, pad = 10;
    let left = p.chooserPosition.x + 12, top = p.chooserPosition.y + 12;
    if (left + w > area.right - pad) left = p.chooserPosition.x - w - 12;
    if (top + h > area.bottom - pad) top = area.bottom - pad - h;
    left = Math.max(area.left + pad, Math.min(left, area.right - pad - w));
    top = Math.max(area.top + 104, top);
    setChooserPos(prev => prev.left === left && prev.top === top ? prev : { left, top });
    el.querySelector<HTMLButtonElement>('[data-part-id]')?.focus({ preventScroll: true });
  }, [showChooser, p.chooserPosition, p.candidates, area]);

  const cb = useRef(p); cb.current = p;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      cb.current.onExit();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  const sel = p.selected;
  const isJack = sel?.type === 'Base jack';
  const markerVisible = !!(sel && p.marker && p.marker.visible !== false);
  const labelBelow = !!p.marker && p.marker.y - area.top < 160;
  const labelLeft = !!p.marker && p.marker.x > area.right - 220;
  const changed = p.appliedHeight !== null && p.draftHeight !== p.appliedHeight;

  return (
    <div ref={rootRef} className="inside-overlay" data-testid="inside-overlay" data-choosing={showChooser || undefined}>
      <div className="inside-banner" style={{ left: area.left + 16, bottom: Math.max(64, (rootRef.current?.parentElement?.clientHeight ?? 0) - area.bottom + 64) }}>
        <span className="inside-banner-tag">Select inside</span>
        <span className="inside-banner-text">Front scaffold is translucent. Click a part to select it; overlapping hits open a list. Esc exits.</span>
        <button type="button" className="inside-exit" onClick={p.onExit} data-testid="exit-select-inside"><X size={13} /> Exit</button>
      </div>

      {markerVisible && sel && p.marker && (
        <div className="inside-marker" data-testid="inside-marker" data-part-id={sel.id} data-x={p.marker.x.toFixed(1)} data-y={p.marker.y.toFixed(1)} style={{ left: p.marker.x, top: p.marker.y }}>
          <span className="inside-marker-ring" />
          <span className={`inside-marker-label ${labelBelow ? 'below' : 'above'} ${labelLeft ? 'left' : 'right'}`}>
            <strong>{sel.type}</strong>
            <span>{partLocation(sel)}</span>
          </span>
        </div>
      )}

      {showChooser && p.chooserPosition && (
        <div ref={chooserRef} className="inside-chooser" data-testid="inside-chooser" role="dialog" aria-label="Choose a part" style={{ left: chooserPos.left, top: chooserPos.top, maxHeight: Math.max(140, area.bottom - area.top - 124) }}>
          <div className="inside-chooser-head">
            <span className="eyebrow">{p.candidates.length} parts under pointer</span>
            <button type="button" className="icon-button" onClick={p.onDismissChooser} aria-label="Close part list" data-testid="close-inside-chooser"><X size={14} /></button>
          </div>
          <div className="inside-chooser-list">
            {p.candidates.map(part => (
              <button type="button" key={part.id} className={`inside-choice ${sel?.id === part.id ? 'current' : ''}`} onClick={() => p.onChoose(part)}
                data-testid={`inside-choice-${part.id}`} data-part-id={part.id} data-part-type={part.type} data-location={partLocation(part)}>
                <strong>{part.type}</strong>
                <span>{partLocation(part)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {sel && (
        <aside className="inside-panel" data-testid="inside-selected-part" data-part-id={sel.id} data-part-type={sel.type} aria-label="Selected part">
          <header className="inside-panel-head">
            <div>
              <div className="eyebrow">{p.adjusting ? 'Base jack' : 'Part selected'}</div>
              <h2>{p.adjusting ? 'Adjust base jack' : sel.type}</h2>
              <div className="inside-panel-sub">{partLocation(sel)}</div>
            </div>
            <button type="button" className="icon-button" onClick={p.onClear} aria-label="Clear selection" data-testid="clear-inside-selection"><X size={15} /></button>
          </header>
          <div className="inside-panel-body">
            {!p.adjusting && (
              <>
                <dl className="inside-facts">
                  <div><dt>Type</dt><dd>{sel.type}</dd></div>
                  <div><dt>Level</dt><dd>{sel.level}</dd></div>
                  <div><dt>Bay</dt><dd>{String(sel.bayNumber).padStart(2, '0')}</dd></div>
                  <div><dt>Elevation</dt><dd>{sel.elevation}</dd></div>
                  {sel.detail && <div><dt>Position</dt><dd>{sel.detail}</dd></div>}
                  {isJack && p.appliedHeight !== null && <div><dt>Illustrative height</dt><dd data-testid="text-applied-height">{p.appliedHeight} mm</dd></div>}
                </dl>
                {isJack
                  ? <button type="button" className="context-action inside-action" onClick={p.onAdjust} data-testid="action-adjust-base-jack">Adjust base jack</button>
                  : <p className="inside-note">No adjustments for this part type. Information only.</p>}
              </>
            )}
            {p.adjusting && (
              <>
                <div className="inside-slider-row">
                  <label htmlFor="inside-jack-height" className="field-label">Height · illustrative</label>
                  <output htmlFor="inside-jack-height" data-testid="text-draft-height">{p.draftHeight} mm</output>
                </div>
                <input id="inside-jack-height" type="range" min={0} max={600} step={10} value={p.draftHeight}
                  onChange={e => p.onHeightChange(Number(e.target.value))} data-testid="input-base-jack-height" className="inside-range" />
                <div className="inside-scale"><span>0</span><span>300</span><span>600 mm</span></div>
                {p.appliedHeight !== null && (
                  <div className="inside-applied">Applied this session: <strong>{p.appliedHeight} mm</strong>{changed && <span> · draft differs</span>}</div>
                )}
                <div className="inside-buttons">
                  <button type="button" className="secondary-button" onClick={p.onCancel} data-testid="cancel-base-jack">Cancel</button>
                  <button type="button" className="primary-button" onClick={p.onApply} data-testid="apply-base-jack">Apply</button>
                </div>
              </>
            )}
            {isJack && <p className="disclaimer">Prototype · session only. Illustrative setting, not an engineering calculation. Scaffold geometry is unchanged.</p>}
          </div>
        </aside>
      )}
    </div>
  );
}

export default InsideSelectionOverlay;
