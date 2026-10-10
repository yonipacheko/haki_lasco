import type { ReactNode } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { contextPosition, type SelectionScreenBounds } from './context-position';
import { ArrowLeft, X } from 'lucide-react';
import './contextual-actions.css';

export type ContextualActionGroup = {
  label: string;
  actions: { id: string; label: string; scope?: string; disabled?: boolean; danger?: boolean; reason?: string }[];
};

export interface ContextualActionsProps {
  selectionLabel: string;
  selectionKind: 'Bay' | 'Lift' | 'Unit';
  groups: ContextualActionGroup[];
  onAction: (id: string) => void;
  onClose: () => void;
  detail: ReactNode;
  detailTitle?: string;
  onBack: () => void;
  screenBounds?: SelectionScreenBounds | null;
}

export function ContextualActions({ selectionLabel, selectionKind, groups, onAction, onClose, detail, detailTitle, onBack, screenBounds = null }: ContextualActionsProps) {
  const inDetail = detail !== null && detail !== undefined;
  const dockRef = useRef<HTMLElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 16, placement: 'clear-area' });
  useLayoutEffect(() => {
    const dock = dockRef.current;
    const stage = dock?.parentElement;
    if (!dock || !stage) return;
    const update = () => {
      const scene = stage.querySelector<HTMLElement>('.scene-host');
      const area = { left: (scene?.offsetLeft ?? 0) + 16, right: stage.clientWidth - 16, top: 104, bottom: (scene?.clientHeight ?? stage.clientHeight) - 12 };
      const next = contextPosition(screenBounds, area, dock.offsetWidth, dock.offsetHeight);
      setPosition(previous => previous.left === next.left && previous.top === next.top && previous.placement === next.placement ? previous : next);
    };
    update();
    const observer = new ResizeObserver(update); observer.observe(dock); observer.observe(stage);
    return () => observer.disconnect();
  }, [screenBounds, detail, groups]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (inDetail) onBack(); else onClose();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [inDetail, onBack, onClose]);

  return (
    <aside ref={dockRef} className="context-dock" data-testid="context-dock" data-placement={position.placement} data-selected-bounds={screenBounds ? JSON.stringify(screenBounds.selected) : undefined} style={{ left: position.left, top: position.top, right: 'auto' }} role="complementary" aria-label={`${selectionKind} actions`}>
      <header className="context-head">
        {inDetail && <button className="icon-button" onClick={onBack} title="Back to actions" aria-label="Back to actions" data-testid="context-back"><ArrowLeft size={15} /></button>}
        <div className="context-titles">
          <div className="context-kind">{selectionKind} selected</div>
          <h2 className="context-title">{inDetail ? detailTitle ?? selectionLabel : selectionLabel}</h2>
          {inDetail && <div className="context-sub">{selectionLabel}</div>}
        </div>
        <button className="icon-button" onClick={onClose} title="Close actions" aria-label="Close actions" data-testid="close-context"><X size={15} /></button>
      </header>
      <div className="context-body">
        {inDetail ? detail : groups.map(g => (
          <section className="context-group" key={g.label} aria-label={g.label}>
            <div className="eyebrow">{g.label}</div>
            <div className="context-actions">
              {g.actions.map(a => (
                <button key={a.id} className={`context-action ${a.danger ? 'danger' : ''}`} disabled={a.disabled} title={a.disabled ? a.reason : undefined} onClick={() => onAction(a.id)} data-testid={`action-${a.id}`}>
                  <span>{a.label}{a.scope && <span className="action-scope"> · {a.scope}</span>}</span>
                  {a.disabled && a.reason && <small>{a.reason}</small>}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}

export default ContextualActions;
