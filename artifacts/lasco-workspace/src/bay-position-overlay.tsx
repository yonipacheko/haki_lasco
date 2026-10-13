import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { Check, Plus } from 'lucide-react';
import type { BayPosition, WorldDirection } from './scaffold-model';
import { projectedFrame } from './camera-framing';
import { layoutSlotCards, type Rect } from './bay-slot-layout';
import './bay-position-overlay.css';

export type BayPositionOverlayHandle = { update(camera: THREE.PerspectiveCamera, host: HTMLDivElement, bounds: THREE.Box3): void };
type Props = { slots: BayPosition[]; height: number; selected: string; onChoose: (direction: WorldDirection) => void };

const CARD = { w: 132, h: 48 };
const OBSTACLES = '.context-dock, .viewport-compass, .canvas-controls, .center-top, .selection-bar, .panel.left:not(.collapsed), .collapse-tab, .bottom-toggle, .bottom-panel:not(.closed)';

export const BayPositionOverlay = forwardRef<BayPositionOverlayHandle, Props>(function BayPositionOverlay({ slots, height, selected, onChoose }, ref) {
  const rootRef = useRef<HTMLDivElement>(null);
  const cards = useRef(new Map<string, HTMLButtonElement>());
  const lines = useRef(new Map<string, SVGLineElement>());
  const dots = useRef(new Map<string, SVGCircleElement>());
  const stubs = useRef(new Map<string, SVGLineElement>());
  const previous = useRef(new Map<string, number>());
  const props = useRef({ slots, height }); props.current = { slots, height };
  const v = useRef(new THREE.Vector3());

  useLayoutEffect(() => {
    // Focusing the Levels reference can scroll an overflow-hidden stage. Restore
    // the Add bay canvas, without touching the toolkit's own scroll or camera.
    const stage = rootRef.current?.parentElement;
    if (stage) { stage.scrollTop = 0; stage.scrollLeft = 0; }
  }, []);

  useImperativeHandle(ref, () => ({
    update(camera, host, bounds) {
      const root = rootRef.current; const stage = root?.parentElement;
      if (!root || !stage) return;
      const { slots: list, height: y } = props.current;
      const w = host.clientWidth, h = host.clientHeight, ox = host.offsetLeft, oy = host.offsetTop;
      const toStage = (x: number, z: number) => {
        const p = v.current.set(x, y, z).project(camera);
        return { x: ox + (p.x + 1) * w / 2, y: oy + (1 - p.y) * h / 2, behind: p.z > 1 };
      };
      const sr = stage.getBoundingClientRect();
      const obstacles: Rect[] = [];
      stage.querySelectorAll<HTMLElement>(OBSTACLES).forEach(el => {
        if (el.closest('.bay-overlay')) return;
        const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
        obstacles.push({ left: r.left - sr.left + stage.scrollLeft - 8, right: r.right - sr.left + stage.scrollLeft + 8, top: r.top - sr.top + stage.scrollTop - 8, bottom: r.bottom - sr.top + stage.scrollTop + 8 });
      });
      const fr = projectedFrame(camera, bounds, { width: w, height: h });
      const model = fr ? { left: fr.left + ox, right: fr.right + ox, top: fr.top + oy, bottom: fr.bottom + oy } : null;
      let strong: Rect | null = null;
      const dock = stage.querySelector<HTMLElement>('[data-selected-bounds]');
      try { const s = dock?.dataset.selectedBounds ? JSON.parse(dock.dataset.selectedBounds) : null; const m = s?.selection ?? s?.model ?? s; if (m && typeof m.left === 'number') strong = m; } catch { strong = null; }
      const mc = model ? { x: (model.left + model.right) / 2, y: (model.top + model.bottom) / 2 } : { x: ox + w / 2, y: oy + h / 2 };
      const anchors = list.map(s => ({ s, a: toStage(s.center.x, s.center.z), t: toStage(s.attachment.x, s.attachment.z) }));
      const area = { left: Math.max(ox, stage.scrollLeft) + 6, top: Math.max(oy, stage.scrollTop) + 6, right: Math.min(ox + w, stage.scrollLeft + stage.clientWidth) - 6, bottom: Math.min(oy + h, stage.scrollTop + stage.clientHeight) - 6 };
      const placements = layoutSlotCards(
        anchors.map(({ s, a, t }) => { const dx = a.x - t.x || a.x - mc.x, dy = a.y - t.y || a.y - mc.y; return { id: s.direction, anchor: a, outward: { x: dx, y: dy } }; }),
        CARD, area, obstacles, model, strong, previous.current,
      );
      placements.forEach((p, i) => {
        previous.current.set(p.id, p.candidate);
        const { a, t } = anchors[i];
        const card = cards.current.get(p.id), line = lines.current.get(p.id), dot = dots.current.get(p.id), stub = stubs.current.get(p.id);
        const hidden = a.behind;
        if (card) { card.style.transform = `translate3d(${Math.round(p.rect.left)}px,${Math.round(p.rect.top)}px,0)`; card.style.visibility = hidden ? 'hidden' : 'visible'; }
        const cx = Math.min(p.rect.right, Math.max(p.rect.left, a.x)), cy = Math.min(p.rect.bottom, Math.max(p.rect.top, a.y));
        if (line) { line.setAttribute('x1', `${a.x}`); line.setAttribute('y1', `${a.y}`); line.setAttribute('x2', `${cx}`); line.setAttribute('y2', `${cy}`); line.style.visibility = hidden ? 'hidden' : 'visible'; }
        if (stub) { stub.setAttribute('x1', `${t.x}`); stub.setAttribute('y1', `${t.y}`); stub.setAttribute('x2', `${a.x}`); stub.setAttribute('y2', `${a.y}`); stub.style.visibility = hidden ? 'hidden' : 'visible'; }
        if (dot) { dot.setAttribute('cx', `${a.x}`); dot.setAttribute('cy', `${a.y}`); dot.style.visibility = hidden ? 'hidden' : 'visible'; }
      });
      root.dataset.ready = 'true';
    },
  }), []);

  const stop = (e: { stopPropagation(): void }) => e.stopPropagation();
  return (
    <div className="bay-overlay" ref={rootRef} data-testid="bay-position-overlay">
      <svg className="bay-overlay-svg" aria-hidden="true">
        {slots.map(s => <g key={s.direction} className={selected === s.direction ? 'is-selected' : ''}>
          <line className="bay-stub" ref={el => { if (el) stubs.current.set(s.direction, el); else stubs.current.delete(s.direction); }} />
          <line className="bay-leader" ref={el => { if (el) lines.current.set(s.direction, el); else lines.current.delete(s.direction); }} />
          <circle className="bay-anchor" r={4} ref={el => { if (el) dots.current.set(s.direction, el); else dots.current.delete(s.direction); }} />
        </g>)}
      </svg>
      {slots.map(s => {
        const active = selected === s.direction;
        return <button key={s.direction} type="button"
          ref={el => { if (el) cards.current.set(s.direction, el); else cards.current.delete(s.direction); }}
          className={`bay-slot-card${active ? ' is-selected' : ''}`}
          data-testid={`bay-slot-${s.direction.toLowerCase()}`} data-slot-kind={s.kind}
          data-world-center={`${s.center.x.toFixed(3)},${s.center.z.toFixed(3)}`}
          data-world-attachment={`${s.attachment.x.toFixed(3)},${s.attachment.z.toFixed(3)}`}
          aria-pressed={active} aria-label={`${s.label}, ${s.direction}, ${s.width.toFixed(1)} m`} title={`${s.label} · ${s.direction} · ${s.width.toFixed(1)} m`}
          onPointerDown={stop} onPointerUp={stop} onDoubleClick={stop}
          onClick={e => { e.stopPropagation(); onChoose(s.direction); }}>
          <span className="bay-slot-icon">{active ? <Check size={13} strokeWidth={2.6} /> : <Plus size={13} strokeWidth={2.4} />}</span>
          <span className="bay-slot-text"><strong>{s.shortLabel}</strong><small>{s.direction} · {s.width.toFixed(1)} m</small></span>
        </button>;
      })}
    </div>
  );
});
