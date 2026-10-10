import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SVGRenderer } from 'three/examples/jsm/renderers/SVGRenderer.js';
import { ContextualActions, type ContextualActionGroup } from './contextual-actions';
import { scaffoldScene, componentScene } from './scaffold-scene';
import { availableDirections, cellElevation, editCells, elevations, partsSummary, previewEdit, removeLift as removeModelLift, selectionAfterRemoval, selectionLabel, starterModel, targetCells, type AdditionPreview, type ComponentPlacement, type ScaffoldModel, type Selection, type SelectionKind } from './scaffold-model';
import { combineBounds, projectSelection } from './selection-projection';
import type { SelectionScreenBounds } from './context-position';
import {
  Activity, AlignCenter, ArrowUp, Box, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, Columns3, Eye, Grid2X2, Layers3, Move, Plus, RotateCcw, Ruler, Search, Shield, Star, Undo2, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type Category = 'All' | 'Structure' | 'Decking' | 'Access' | 'Protection';
type ToolItem = { name: string; category: Exclude<Category, 'All'>; code: string; Icon: LucideIcon; favorite?: boolean };
type SceneConfig = { starter: boolean; model: ScaffoldModel; selection: Selection | null; selectionMode: SelectionKind; preview: string | null; placed: ComponentPlacement[]; operation: AdditionPreview | null; stair: boolean };

const tools: ToolItem[] = [
  { name: 'Standard', category: 'Structure', code: 'S-200', Icon: Columns3, favorite: true },
  { name: 'Ledger', category: 'Structure', code: 'L-250', Icon: AlignCenter, favorite: true },
  { name: 'Diagonal brace', category: 'Structure', code: 'B-250', Icon: Activity },
  { name: 'Base jack', category: 'Structure', code: 'J-600', Icon: Move },
  { name: 'Steel deck', category: 'Decking', code: 'D-250', Icon: Grid2X2, favorite: true },
  { name: 'Toe board', category: 'Decking', code: 'T-250', Icon: AlignCenter },
  { name: 'Stair flight', category: 'Access', code: 'A-200', Icon: ArrowUp },
  { name: 'Access ladder', category: 'Access', code: 'A-180', Icon: ArrowUp },
  { name: 'Guardrail', category: 'Protection', code: 'G-250', Icon: Shield },
  { name: 'End frame', category: 'Protection', code: 'E-100', Icon: Box },
];
const categoryList: Category[] = ['All', 'Structure', 'Decking', 'Access', 'Protection'];

function ThreeViewport({ config, onSelect, onPlace, onCancel, onScreenBounds, resetToken, viewMode }: { config: SceneConfig; onSelect: (value: Selection | null) => void; onPlace: () => void; onCancel: () => void; onScreenBounds: (value: SelectionScreenBounds | null) => void; resetToken: number; viewMode: 'orbit' | 'pan' }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | SVGRenderer | null>(null);
  const objectsRef = useRef<THREE.Group | null>(null);
  const onSelectRef = useRef(onSelect); onSelectRef.current = onSelect;
  const onPlaceRef = useRef(onPlace); onPlaceRef.current = onPlace;
  const onCancelRef = useRef(onCancel); onCancelRef.current = onCancel;
  const configRef = useRef(config); configRef.current = config;
  const onScreenRef = useRef(onScreenBounds); onScreenRef.current = onScreenBounds;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#e9eff4');
    scene.fog = new THREE.Fog('#e9eff4', 27, 58);
    const camera = new THREE.PerspectiveCamera(36, host.clientWidth / host.clientHeight, .1, 100);
    camera.position.set(20, 14, 26);
    let renderer: THREE.WebGLRenderer | SVGRenderer;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2');
    if (context) {
      const webgl = new THREE.WebGLRenderer({ canvas, context, antialias: true, alpha: false });
      webgl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      webgl.shadowMap.enabled = true;
      webgl.shadowMap.type = THREE.PCFSoftShadowMap;
      webgl.outputColorSpace = THREE.SRGBColorSpace;
      webgl.toneMapping = THREE.ACESFilmicToneMapping;
      webgl.toneMappingExposure = 1.08;
      renderer = webgl;
    } else {
      const svg = new SVGRenderer();
      svg.setQuality('high');
      svg.setClearColor(new THREE.Color('#e9eff4'), 1);
      renderer = svg;
    }
    rendererRef.current = renderer;
    renderer.setSize(host.clientWidth, host.clientHeight);
    host.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, host);
    controls.target.set(0, 4.25, 0);
    controls.enableDamping = true;
    controls.dampingFactor = .075;
    controls.minDistance = 7;
    controls.maxDistance = 50;
    controls.maxPolarAngle = Math.PI * .49;
    controlsRef.current = controls;
    const hemi = new THREE.HemisphereLight(0xffffff, 0x8293a0, 2.05);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-8, 16, 10); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -18; sun.shadow.camera.right = 18; sun.shadow.camera.top = 18; sun.shadow.camera.bottom = -18; scene.add(sun);
    const grid = new THREE.GridHelper(42, 42, 0xb3c2cc, 0xd1dbe2);
    grid.position.y = -.015;
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMaterials.forEach(mat => { (mat as THREE.LineBasicMaterial).transparent = true; (mat as THREE.LineBasicMaterial).opacity = .64; });
    scene.add(grid);
    const axes = new THREE.Group();
    const axisMat = new THREE.LineBasicMaterial({ color: '#8ea1ae', transparent: true, opacity: .65 });
    axes.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-21, .01, 0), new THREE.Vector3(21, .01, 0)]), axisMat));
    axes.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, .01, -21), new THREE.Vector3(0, .01, 21)]), axisMat));
    scene.add(axes);
    const group = new THREE.Group(); scene.add(group); objectsRef.current = group; sceneRef.current = scene; cameraRef.current = camera;
    const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
    let pointerStart = { x: 0, y: 0 };
    const pointerDown = (event: PointerEvent) => { pointerStart = { x: event.clientX, y: event.clientY }; };
    const click = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(group.children, true).find(x => x.object.userData.hit || x.object.userData.selectable);
      // Layout previews only apply via their explicit confirmation controls.
      if (configRef.current.operation) return;
      if (configRef.current.preview) { onPlaceRef.current(); return; }
      if (hit?.object.userData.hit) onSelectRef.current({ ...hit.object.userData.hit, kind: event.shiftKey ? 'Lift' : configRef.current.selectionMode });
      else onSelectRef.current(null);
    };
    renderer.domElement.addEventListener('dblclick', () => controls.reset());
    host.addEventListener('pointerdown', pointerDown);
    host.addEventListener('pointerup', click);
    let frame = 0;
    let lastProjection = 0, lastBounds = '';
    const animate = (time = 0) => {
      frame = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera);
      if (time - lastProjection > 150) {
        lastProjection = time;
        const current = configRef.current;
        const bounds = current.selection ? combineBounds(projectSelection(current.model, current.selection, camera, host), current.operation ? projectSelection(current.operation.model, current.selection, camera, host) : null) : null;
        const key = JSON.stringify(bounds, (_, value) => typeof value === 'number' ? Math.round(value / 2) * 2 : value);
        if (key !== lastBounds) { lastBounds = key; onScreenRef.current(bounds); }
      }
    };
    animate();
    const resize = () => {
      if (!host.isConnected) return;
      const width = host.clientWidth; const height = host.clientHeight;
      camera.aspect = width / Math.max(height, 1); camera.updateProjectionMatrix(); renderer.setSize(width, height);
    };
    const observer = new ResizeObserver(resize); observer.observe(host);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && (configRef.current.preview || configRef.current.operation)) onCancelRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('keydown', onKey); host.removeEventListener('pointerdown', pointerDown); host.removeEventListener('pointerup', click); controls.dispose(); if (renderer instanceof THREE.WebGLRenderer) renderer.dispose(); rendererRef.current = null; host.removeChild(renderer.domElement); scene.clear(); };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current; const group = objectsRef.current;
    if (!scene || !group) return;
    while (group.children.length) {
      const child = group.children.pop();
      if (child) child.traverse(obj => { const mesh = obj as THREE.Mesh; mesh.geometry?.dispose(); if (Array.isArray(mesh.material)) mesh.material.forEach(m => m.dispose()); else mesh.material?.dispose(); });
    }
    const { starter, model, selection, preview, placed, operation, stair } = config;
    const surface = (color: string, roughness = .7, opacity = 1, metalness = 0) => rendererRef.current instanceof SVGRenderer
      ? new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity })
      : new THREE.MeshStandardMaterial({ color, roughness, transparent: opacity < 1, opacity, metalness });
    const wallMat = surface('#d8e0e5', .88, .78);
    const edgeMat = surface('#c6d1d9', .9);
    const glassMat = surface('#aec7d7', .45, .74);
    const building = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(7.6, 9, 5.8), wallMat); body.position.set(0, 4.5, 0); body.castShadow = true; body.receiveShadow = true; body.userData.selectable = 'Building'; building.add(body);
    const floorHeight = 3;
    for (let floor = 0; floor < 3; floor++) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(7.8, .1, 6), edgeMat); slab.position.set(0, floor * floorHeight + .12, 0); building.add(slab);
      const band = new THREE.Mesh(new THREE.BoxGeometry(7.61, .075, 5.81), surface('#f3f6f7'));
      band.position.set(0, (floor + 1) * floorHeight, 0); building.add(band);
      for (let col = 0; col < 3; col++) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(1.34, 1.62, .05), glassMat); win.position.set(-2.35 + col * 2.35, floor * floorHeight + 1.7, 2.92); building.add(win);
      }
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(7.8, .17, 6), edgeMat); roof.position.set(0, 9.04, 0); building.add(roof);
    const sideWin = new THREE.Mesh(new THREE.BoxGeometry(.05, 1.62, 1.36), glassMat); sideWin.position.set(3.82, 1.7, -.7); building.add(sideWin);
    group.add(building);
    if (starter) {
      group.add(scaffoldScene(model, surface, selection, operation, stair));
      group.add(componentScene(operation?.model ?? model, placed, preview, selection, surface, operation));
    }
  }, [config]);

  useEffect(() => {
    if (!resetToken || !controlsRef.current) return;
    controlsRef.current.reset();
  }, [resetToken]);
  useEffect(() => {
    if (!controlsRef.current) return;
    controlsRef.current.mouseButtons.LEFT = viewMode === 'pan' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
  }, [viewMode]);
  return <div className="scene-host" ref={hostRef} aria-label="Interactive 3D scaffold workspace" />;
}

function App() {
  const [starter, setStarter] = useState(false);
  const [model, setModel] = useState<ScaffoldModel>(starterModel);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [selectionMode, setSelectionMode] = useState<SelectionKind>('Bay');
  const [screenBounds, setScreenBounds] = useState<SelectionScreenBounds | null>(null);
  const [history, setHistory] = useState<{ label: string; model: ScaffoldModel; placed: ComponentPlacement[]; stair: boolean; starter: boolean; selection: Selection | null }[]>([]);
  const [action, setAction] = useState<string | null>(null);
  const [draftWidth, setDraftWidth] = useState(2.5);
  const [draftHeight, setDraftHeight] = useState(3);
  const [draftDirection, setDraftDirection] = useState('right');
  const [draftDeck, setDraftDeck] = useState(true);
  const [draftOptions, setDraftOptions] = useState({ guardrails: true, braces: true, brackets: false });
  const [stair, setStair] = useState(false);
  const [placed, setPlaced] = useState<ComponentPlacement[]>([]);
  const [leftOpen, setLeftOpen] = useState(() => window.innerWidth > 740);
  const [bottomOpen, setBottomOpen] = useState(false);
  const [category, setCategory] = useState<Category>('All');
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [bottomTab, setBottomTab] = useState<'Levels' | 'Parts summary'>('Levels');
  const [favSet, setFavSet] = useState<string[]>(tools.filter(t => t.favorite).map(t => t.name));
  const [recent, setRecent] = useState<string[]>(['Standard', 'Ledger', 'Steel deck']);
  const [notice, setNotice] = useState('');
  const [resetToken, setResetToken] = useState(0);
  const [viewMode, setViewMode] = useState<'orbit' | 'pan'>('orbit');
  const toastRef = useRef<number | null>(null);
  const notify = useCallback((message: string) => {
    setNotice(message);
    if (toastRef.current) window.clearTimeout(toastRef.current);
    toastRef.current = window.setTimeout(() => setNotice(''), 2400);
  }, []);
  const remember = useCallback((label: string) => setHistory(items => [...items, { label, model, placed, stair, starter, selection }].slice(-30)), [model, placed, stair, starter, selection]);
  const undo = useCallback(() => {
    const previous = history.at(-1);
    if (!previous) return;
    setModel(previous.model); setPlaced(previous.placed); setStair(previous.stair); setStarter(previous.starter);
    setSelection(previous.selection); if (previous.selection) setSelectionMode(previous.selection.kind);
    setHistory(items => items.slice(0, -1)); setAction(null); setPreview(null); setScreenBounds(null);
    notify(`Undone: ${previous.label}`);
  }, [history, notify]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey && !target.matches('input,select,textarea,[contenteditable="true"]')) { event.preventDefault(); undo(); }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [undo]);
  const operation = useMemo(() => selection && action ? previewEdit(model, selection, action, draftWidth, draftHeight, draftDirection, draftDeck, draftOptions) : null, [model, selection, action, draftWidth, draftHeight, draftDirection, draftDeck, draftOptions]);
  const config = useMemo<SceneConfig>(() => ({ starter, model, selection, selectionMode, operation, preview, placed, stair }), [starter, model, selection, selectionMode, operation, preview, placed, stair]);
  const filteredTools = useMemo(() => tools.filter(t => (category === 'All' || t.category === category) && t.name.toLowerCase().includes(query.toLowerCase())), [category, query]);
  const parts = useMemo(() => partsSummary(starter ? model : [], placed, starter && stair), [starter, model, placed, stair]);
  const selectedBay = model.find(bay => bay.id === selection?.bayId) ?? model[0];
  const lifts = Math.max(...model.map(bay => bay.cells.length));
  const levels = starter ? Array.from({ length: lifts }, (_, i) => i + 1) : [];
  const activeLevel = selection?.level ?? 1;
  const selected = selection ? selectionLabel(selection, model) : 'Building';
  const clearAction = () => { setAction(null); };
  const selectObject = (value: Selection | null) => { clearAction(); setScreenBounds(null); setPreview(null); setSelection(value); if (value) setSelectionMode(value.kind); };
  const cancelPlacement = useCallback(() => { setPreview(null); setAction(null); notify('Preview cancelled'); }, [notify]);
  const place = useCallback(() => {
    if (!preview) return;
    remember(`Place ${preview}`);
    setStarter(true);
    const target: Selection = { kind: 'Unit', bayId: selectedBay.id, level: Math.min(activeLevel, selectedBay.cells.length) };
    if (preview === 'Steel deck' || preview === 'Guardrail') setModel(value => editCells(value, target, preview === 'Steel deck' ? { deck: true } : { guardrails: true }));
    setPlaced(items => [...items, { id: Date.now(), name: preview, bayId: target.bayId, level: target.level }]);
    if (preview === 'Stair flight') setStair(true);
    setRecent(prev => [preview, ...prev.filter(item => item !== preview)].slice(0, 3));
    notify(`${preview} placed at lift ${target.level}`);
    setPreview(null);
  }, [preview, notify, selectedBay, activeLevel, remember]);
  const chooseTool = (name: string) => {
    clearAction();
    setStarter(true);
    setPreview(name);
    setRecent(prev => [name, ...prev.filter(item => item !== name)].slice(0, 3));
  };
  const toggleFavorite = (name: string) => setFavSet(prev => prev.includes(name) ? prev.filter(v => v !== name) : [...prev, name]);
  const generate = () => { remember('Generate starter scaffold'); setStarter(true); setPreview(null); selectObject({ kind: 'Bay', bayId: '0-3', level: 2 }); notify('Starter scaffold added around the building'); };
  const directions = selection ? availableDirections(model, selection.bayId) : [];
  const actionGroups: ContextualActionGroup[] = !selection ? [] : selection.kind === 'Bay' ? [
    { label: 'Configure', actions: [{ id: 'length', label: 'Change length', scope: 'selected bay' }, { id: 'decking', label: 'Change decking', scope: 'selected bay' }] },
    { label: 'Extend & remove', actions: [
      { id: 'add-bay', label: 'Add bay', scope: 'beside selected bay', disabled: !directions.length, reason: !directions.length ? 'Select an end bay with free space (six-bay limit).' : undefined },
      { id: 'remove-bay', label: 'Remove bay', scope: 'selected bay', danger: true, disabled: model.filter(bay => bay.side === selectedBay.side).length <= 1, reason: 'Keep at least one bay per elevation.' },
    ] },
  ] : selection.kind === 'Lift' ? [
    { label: 'Configure this lift', actions: [{ id: 'height', label: 'Change height', scope: 'whole lift' }, { id: 'decking', label: 'Change decking', scope: 'whole lift' }, { id: 'options', label: 'Guards, braces & brackets', scope: 'whole lift' }] },
    { label: 'All bays', actions: [
      { id: 'add-lift', label: 'Add top lift', scope: 'all bays', disabled: lifts >= 5, reason: 'Prototype limit: five lifts per bay.' },
      { id: 'remove-lift', label: 'Remove this lift', scope: 'whole lift', danger: true, disabled: !removeModelLift(model, selection, false), reason: 'Keep at least one lift per bay.' },
    ] },
    { label: `Bay ${String(selectedBay.number).padStart(2, '0')} · ${elevations[selectedBay.side]}`, actions: [
      { id: 'add-local-lift', label: 'Add top lift', scope: 'selected bay', disabled: selectedBay.cells.length >= 5, reason: 'Prototype limit: five lifts per bay.' },
      { id: 'remove-local-lift', label: 'Remove lift', scope: 'selected bay', danger: true, disabled: !removeModelLift(model, selection, true), reason: 'This bay must contain the selected lift and retain one lift.' },
    ] },
  ] : [{ label: 'Configure this unit', actions: [{ id: 'decking', label: 'Change decking', scope: 'selected unit' }, { id: 'options', label: 'Guards, braces & brackets', scope: 'selected unit' }] }];
  const actionTitle = actionGroups.flatMap(group => group.actions).find(item => item.id === action)?.label;
  const beginAction = (id: string) => {
    if (!selection) return;
    setPreview(null);
    setAction(id);
    const cell = targetCells(model, selection)[0]?.cell ?? selectedBay.cells[0];
    setDraftWidth(selectedBay.width); setDraftHeight(cell.height);
    setDraftDeck(cell.deck);
    setDraftOptions({ guardrails: cell.guardrails, braces: cell.braces, brackets: cell.brackets });
    setDraftDirection('');
  };
  const applyAction = () => {
    if (!selection || !action || !operation) return;
    if (JSON.stringify(operation.model) === JSON.stringify(model)) { clearAction(); notify('No scaffold changes to apply'); return; }
    remember(actionTitle ?? action);
    setModel(operation.model);
    if (action.startsWith('add-')) {
      if (operation.addedBayId) setSelection({ kind: 'Bay', bayId: operation.addedBayId, level: selection.level });
      else if (operation.addedCells[0]) setSelection({ kind: 'Lift', ...(operation.addedCells.find(cell => cell.bayId === selection.bayId) ?? operation.addedCells[0]) });
    } else if (action === 'remove-bay') {
      setPlaced(items => items.filter(item => item.bayId !== selection.bayId));
      setSelection(selectionAfterRemoval(model, operation.model, selection));
    } else if (action === 'remove-lift' || action === 'remove-local-lift') {
      const onlyBay = action === 'remove-local-lift';
      const next = removeModelLift(model, selection, onlyBay);
      if (!next) return;
      const changed = new Set(model.filter(bay => (!onlyBay || bay.id === selection.bayId) && bay.cells.length >= selection.level).map(bay => bay.id));
      setPlaced(items => items.filter(item => !changed.has(item.bayId) || item.level !== selection.level).map(item => changed.has(item.bayId) && item.level > selection.level ? { ...item, level: item.level - 1 } : item));
      setSelection(selectionAfterRemoval(model, operation.model, selection));
    }
    notify(`${actionTitle} applied · illustrative geometry`);
    clearAction();
  };
  const detail = action && selection ? (
    <form onSubmit={event => { event.preventDefault(); applyAction(); }}>
      <p className="context-note">{selection.kind === 'Bay' ? 'Scope: selected bay only.' : selection.kind === 'Unit' ? 'Scope: this bay/lift unit only.' : action.includes('local') ? `Scope: Bay ${String(selectedBay.number).padStart(2, '0')} · ${elevations[selectedBay.side]} only.` : action === 'add-lift' ? 'Scope: a new top lift on every bay.' : `Scope: whole Lift ${selection.level} across all elevations.`}</p>
      {action === 'add-bay' && <><div className="field-label">Choose an available direction</div><div className="context-directions" data-testid="available-directions">{directions.map(direction => <button type="button" key={direction} className={`secondary-button ${draftDirection === direction ? 'active' : ''}`} aria-pressed={draftDirection === direction} onClick={() => setDraftDirection(direction)} data-testid={`direction-${direction}`}>{direction === 'left' ? '← Left end' : 'Right end →'}</button>)}</div></>}
      {(action === 'length' || (action === 'add-bay' && draftDirection)) && <label className="context-field">Bay length · illustrative<select value={draftWidth} onChange={event => setDraftWidth(Number(event.target.value))} data-testid="select-bay-width"><option value="2">2.0 m</option><option value="2.5">2.5 m</option><option value="3">3.0 m</option></select></label>}
      {(action === 'height' || action === 'add-lift' || action === 'add-local-lift') && <label className="context-field">Lift height · illustrative<select value={draftHeight} onChange={event => setDraftHeight(Number(event.target.value))} data-testid="select-lift-height"><option value="2">2.0 m</option><option value="2.5">2.5 m</option><option value="3">3.0 m</option></select></label>}
      {action === 'decking' && <label className="context-field">Decking<select value={String(draftDeck)} onChange={event => setDraftDeck(event.target.value === 'true')} data-testid="select-decking"><option value="true">Included</option><option value="false">None</option></select></label>}
      {action === 'options' && (['guardrails', 'braces', 'brackets'] as const).map(key => <label className="context-check" key={key}><input type="checkbox" checked={draftOptions[key]} onChange={event => setDraftOptions(value => ({ ...value, [key]: event.target.checked }))} data-testid={`toggle-${key}`} />{key === 'guardrails' ? 'Guard frames' : key === 'braces' ? 'Braces' : 'Brackets'}</label>)}
      {action.startsWith('remove-') && <p className="context-note">Previewing removal of this {action === 'remove-bay' ? 'bay and its placed components' : 'lift and its placed components'}. Undo will restore them after applying.</p>}
      {operation && <p className="context-note preview-note" data-testid="preview-status"><strong>{action.startsWith('add-') ? 'Snapped preview' : 'Live preview'}</strong><br />{operation.label}<br />Apply commits the result. Cancel keeps the original scaffold.</p>}
      {action === 'add-bay' && !operation && <p className="context-note">Choose a direction to show a snapped preview. Only free directions are listed.</p>}
      <div className="context-footer"><button type="button" className="secondary-button" onClick={clearAction} data-testid="cancel-action">Cancel</button><button type="submit" className="primary-button" disabled={!operation} data-testid="apply-action">Apply</button></div>
    </form>
  ) : null;

  return (
    <main className="workspace">
      <header className="topbar">
        <div className="brand"><div className="brand-mark">H</div><div><div className="brand-name">HAKI <span style={{ fontWeight: 500 }}>LASCO</span></div><div className="brand-sub">SCAFFOLD WORKSPACE</div></div></div>
        <div className="top-divider" />
        <div><div className="project-name">Scaffold concept 01</div><div className="project-meta">Untitled project&nbsp; / &nbsp;Local demo</div></div>
        <div className="top-spacer" />
         <div className="saved"><Check size={13} /> Session prototype</div>
         <button className="top-action" disabled={!history.length} onClick={undo} title={history.length ? `Undo ${history.at(-1)?.label} (Ctrl/Cmd+Z)` : 'No completed changes to undo'} data-testid="button-undo"><Undo2 size={16} /><span>Undo</span></button>
         <button className="top-action" onClick={() => notify('Choose Bay, Lift or Unit, then click the scaffold. Drag to orbit, scroll to zoom. Shift-click selects a lift.')} data-testid="button-help"><CircleHelp size={16} /><span>Help</span></button>
        <div className="avatar" title="Workspace user">HL</div>
      </header>
       <section className={`main-stage ${leftOpen ? 'left-open' : ''} ${selection && !preview ? 'has-context' : ''} ${bottomOpen ? 'bottom-open' : ''}`}>
        <ThreeViewport config={config} onSelect={selectObject} onPlace={place} onCancel={cancelPlacement} onScreenBounds={setScreenBounds} resetToken={resetToken} viewMode={viewMode} />
        <div className="center-top">
           <div className="scene-chip"><span className="status-dot" /> <strong>3D view</strong></div>
          <div className="scene-chip"><Ruler size={12} /> Dimensions illustrative</div>
           <div className="scene-chip selection-chip"><strong>{selected}</strong></div>
        </div>
         {starter && <div className="selection-bar" aria-label="Selection mode">
           <span>Select</span>{(['Bay', 'Lift', 'Unit'] as const).map(kind => <button key={kind} className={selectionMode === kind ? 'active' : ''} aria-pressed={selectionMode === kind} data-testid={`select-mode-${kind.toLowerCase()}`} onClick={() => { clearAction(); setPreview(null); setSelectionMode(kind); if (selection) setSelection({ ...selection, kind, level: Math.min(selection.level, selectedBay.cells.length) }); }}>{kind}</button>)}
           <span className="selection-hint">Click scaffold · Shift-click lift</span>
         </div>}
        <div className="canvas-controls">
          <button className={`view-button ${viewMode === 'orbit' ? 'active' : ''}`} title="Orbit view" onClick={() => { setViewMode('orbit'); setResetToken(v => v + 1); }} data-testid="button-orbit"><RotateCcw size={14} /></button>
          <button className={`view-button ${viewMode === 'pan' ? 'active' : ''}`} title="Pan view" onClick={() => { setViewMode('pan'); notify('Pan mode: drag in the view'); }} data-testid="button-pan"><Move size={14} /></button>
          <button className="view-button" title="Reset view" onClick={() => setResetToken(v => v + 1)} data-testid="button-reset-view"><Eye size={14} /></button>
        </div>

        <aside className={`panel left ${leftOpen ? '' : 'collapsed'}`}>
          <div className="panel-head"><div><div className="panel-heading">Component toolkit</div><div className="head-sub">Browse system components</div></div><button className="icon-button" onClick={() => setLeftOpen(false)} title="Collapse toolkit" data-testid="button-collapse-toolkit"><ChevronLeft size={16} /></button></div>
          <div className="panel-body">
             {!starter && <div className="panel-section"><div className="selected-desc">Build a concept around the three-storey building.</div><button className="primary-button full-button" onClick={generate} data-testid="button-generate"><Plus size={14} /> Generate starter scaffold</button></div>}
             {preview && <div className="panel-section"><div className="section-title">Place {preview}</div><p className="selected-desc">Snapped to Bay {selectedBay.number} · Lift {Math.min(activeLevel, selectedBay.cells.length)} · {elevations[selectedBay.side]}. Click the model or confirm here. Esc cancels.</p><button className="primary-button full-button" onClick={place} data-testid="button-place-component">Place component</button><button className="secondary-button full-button" onClick={cancelPlacement} data-testid="button-cancel-placement">Cancel placement</button></div>}
            <label className="searchbox"><Search size={14} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a component..." aria-label="Search components" data-testid="input-tool-search" />{query && <button className="icon-button" onClick={() => setQuery('')} title="Clear search"><X size={13} /></button>}</label>
            <div className="eyebrow">Categories</div>
            <div className="category-row">{categoryList.map(c => <button key={c} className={category === c ? 'active' : ''} onClick={() => setCategory(c)} data-testid={`filter-${c.toLowerCase()}`}>{c}</button>)}</div>
            <div className="eyebrow">Components <span style={{ float: 'right', fontFamily: 'var(--app-font-mono)', fontWeight: 400 }}>{filteredTools.length}</span></div>
            <div className="tool-grid" style={{ marginTop: 8 }}>
              {filteredTools.map(tool => <button className={`tool-item ${preview === tool.name ? 'selected' : ''}`} key={tool.name} onClick={() => chooseTool(tool.name)} data-testid={`tool-${tool.code}`}>
                <tool.Icon size={15} className="tool-icon" /><span className="tool-name">{tool.name}</span><div className="tool-dims">{tool.code} · demo</div>
                <span className={`tool-star ${favSet.includes(tool.name) ? 'is-fav' : ''}`} role="button" tabIndex={0} aria-label={`${favSet.includes(tool.name) ? 'Remove' : 'Add'} ${tool.name} favorite`} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggleFavorite(tool.name); } }} onClick={e => { e.stopPropagation(); toggleFavorite(tool.name); }} data-testid={`favorite-${tool.code}`}><Star size={12} fill={favSet.includes(tool.name) ? 'currentColor' : 'none'} /></span>
              </button>)}
              {!filteredTools.length && <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#8c9aa5', padding: 22 }}>No components match “{query}”.</div>}
            </div>
            <div className="section-label"><span className="eyebrow">Favorites</span><span className="type-badge">{favSet.length}</span></div>
            {favSet.length ? favSet.slice(0, 3).map(name => <div className="recent-row" key={name}><span className="recent-symbol"><PreviewIcon name={name} /></span><span style={{ flex: 1 }}>{name}<div className="recent-meta">HAKI system · demo</div></span><button className="icon-button" title={`Place ${name}`} onClick={() => chooseTool(name)}><Plus size={13} /></button></div>) : <div className="recent-meta">Star components to keep them here.</div>}
            <div className="section-label"><span className="eyebrow">Recently used</span><Clock3 size={13} color="#97a3ac" /></div>
            {recent.map(name => <div className="recent-row" key={name}><span className="recent-symbol"><PreviewIcon name={name} /></span><span style={{ flex: 1 }}>{name}<div className="recent-meta">Used in this session</div></span><button className="icon-button" title={`Place ${name}`} onClick={() => chooseTool(name)}><Plus size={13} /></button></div>)}
          </div>
        </aside>
        {!leftOpen && <button className="collapse-tab left" onClick={() => setLeftOpen(true)} title="Open toolkit" data-testid="button-open-toolkit"><ChevronRight size={15} /></button>}
        {selection && !preview && <ContextualActions selectionLabel={selected} selectionKind={selection.kind} groups={actionGroups} onAction={beginAction} onClose={() => selectObject(null)} detail={detail} detailTitle={actionTitle} onBack={clearAction} screenBounds={screenBounds} />}

        <div className={`bottom-panel ${bottomOpen ? '' : 'closed'}`}>
          <div className="bottom-head">
            <div className="bottom-tabs">{(['Levels', 'Parts summary'] as const).map(tab => <button key={tab} className={`bottom-tab ${bottomTab === tab ? 'active' : ''}`} onClick={() => { setBottomTab(tab); setBottomOpen(true); }} data-testid={`tab-${tab.toLowerCase().replace(' ', '-')}`}>{tab}</button>)}</div>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}><span className="type-badge">ILLUSTRATIVE ONLY</span><button className="icon-button" onClick={() => setBottomOpen(false)} title="Close bottom panel" data-testid="button-close-bottom"><ChevronDown size={16} /></button></div>
          </div>
          <div className="bottom-content">
            {bottomTab === 'Levels' ? <>
               <div className="levels-list">{levels.map(level => {
                 const cells = model.filter(bay => bay.cells.length >= level);
                 const heights = cells.map(bay => cellElevation(bay, level));
                 const summarize = (key: 'deck' | 'guardrails' | 'braces' | 'brackets') => {
                   const count = cells.filter(bay => bay.cells[level - 1][key]).length;
                   return count === 0 ? 'Off' : count === cells.length ? 'Included' : 'Mixed';
                 };
                 return <button key={level} className={`level-card ${activeLevel === level && selection?.kind === 'Lift' ? 'active' : ''}`} onClick={() => selectObject({ kind: 'Lift', bayId: selectedBay.cells.length >= level ? selectedBay.id : cells[0].id, level })} data-testid={`level-card-${level}`}>
                <div className="level-number">LEVEL / 0{level}</div><div className="level-name">Lift {level} settings</div>
                 <div className="level-setting"><span>Elevation</span><span>{Math.min(...heights).toFixed(1)}{Math.min(...heights) !== Math.max(...heights) ? `–${Math.max(...heights).toFixed(1)}` : ''} m</span></div>
                 <div className="level-setting"><span>Deck</span><span>{summarize('deck')}</span></div><div className="level-setting"><span>Guard frames</span><span>{summarize('guardrails')}</span></div>
                 <div className="level-setting"><span>Braces / brackets</span><span>{summarize('braces')} / {summarize('brackets')}</span></div><div className="level-setting"><span>Bays at this lift</span><span>{cells.length}</span></div>
              </button>; })}
                {starter && <button className="level-card" disabled={lifts >= 5} onClick={() => {
                  setPreview(null); setSelection({ kind: 'Lift', bayId: selectedBay.id, level: Math.min(activeLevel, selectedBay.cells.length) }); setSelectionMode('Lift');
                  setAction('add-lift'); setDraftHeight(3);
                }} style={{ minWidth: 110, display: 'grid', placeItems: 'center', color: '#6f8799' }} data-testid="button-add-level"><Plus size={17} /><span style={{ fontSize: 10, marginTop: 6 }}>Preview top lift</span></button>}
                {!starter && <div className="context-note">Generate a starter scaffold from the toolkit to compare its lifts.</div>}
              </div>
              <div className="parts-summary"><div className="eyebrow">Selection reference</div>{starter && <>
                <label className="field-label" htmlFor="bay-reference">Bay for local lift actions</label><select id="bay-reference" className="field-control" data-testid="select-bay-reference" value={selectedBay.id} onChange={event => {
                  const bay = model.find(item => item.id === event.target.value)!;
                  selectObject({ kind: selection?.kind ?? 'Bay', bayId: bay.id, level: Math.min(activeLevel, bay.cells.length) });
                }}>{model.map(bay => <option key={bay.id} value={bay.id}>Bay {bay.number} · {elevations[bay.side]}</option>)}</select>
                <div className="switch-row">Stair tower<button className={`switch ${stair ? 'on' : ''}`} role="switch" aria-label="Stair tower" aria-checked={stair} onClick={() => { remember('Toggle stair tower'); clearAction(); setStair(value => !value); }} data-testid="toggle-stair" /></div>
              </>}<div className="summary-foot">Click a card to highlight its whole lift in 3D. Routine changes use the temporary action dock.</div></div>
             </> : <div className="parts-summary bom-grid">
              {parts.map(([label, count]) => <div key={label as string} style={{ borderRight: '1px solid #e8edf0', paddingRight: 10 }}><div className="eyebrow">{label as string}</div><div style={{ font: '700 19px var(--app-font-display)', color: '#39566e', margin: '8px 0 4px' }}>{count as number}</div><div style={{ color: '#98a3ac', fontSize: 9 }}>indicative units</div></div>)}
              <div className="summary-foot" style={{ gridColumn: '1 / -1' }}>Illustrative parts summary for concept coordination. Quantities are not verified engineering calculations or a construction takeoff.</div>
            </div>}
          </div>
        </div>
        <button className="bottom-toggle" onClick={() => setBottomOpen(!bottomOpen)} data-testid="button-toggle-bottom"><Layers3 size={13} /> {bottomOpen ? 'Hide levels & parts' : 'Levels & parts'} <span className="type-badge" style={{ padding: '3px 5px' }}>{starter ? `${model.length} bays · up to ${lifts} lifts` : 'No scaffold'}</span></button>
        {notice && <div className="toast-note" role="status" data-testid="status-notice">{notice}</div>}
      </section>
    </main>
  );
}

function PreviewIcon({ name }: { name: string }) {
  const item = tools.find(tool => tool.name === name);
  const Icon = item?.Icon ?? Box;
  return <Icon size={13} />;
}

export default App;
