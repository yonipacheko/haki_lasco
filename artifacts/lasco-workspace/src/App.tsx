import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  Activity, AlignCenter, ArrowUp, Box, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CircleHelp, Clock3, Columns3, Cuboid, Download, Eye, Grid2X2, Layers3, Minus, Move, Plus, RotateCcw, Ruler, Search, Shield, SlidersHorizontal, Star, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type Category = 'All' | 'Structure' | 'Decking' | 'Access' | 'Protection';
type ToolItem = { name: string; category: Exclude<Category, 'All'>; code: string; Icon: LucideIcon; favorite?: boolean };
type SceneConfig = { starter: boolean; bays: number; lifts: number; bayWidth: number; liftHeight: number; finish: string; deck: boolean; guardrails: boolean; stair: boolean; selected: string; preview: string | null };

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
const selectedDefault = 'Bay 02 · Level 02';

function ThreeViewport({ config, onSelect, onPlace, onCancel, resetToken, viewMode }: { config: SceneConfig; onSelect: (value: string) => void; onPlace: () => void; onCancel: () => void; resetToken: number; viewMode: 'orbit' | 'pan' }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const objectsRef = useRef<THREE.Group | null>(null);
  const onSelectRef = useRef(onSelect); onSelectRef.current = onSelect;
  const onPlaceRef = useRef(onPlace); onPlaceRef.current = onPlace;
  const onCancelRef = useRef(onCancel); onCancelRef.current = onCancel;
  const configRef = useRef(config); configRef.current = config;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#e9eff4');
    scene.fog = new THREE.Fog('#e9eff4', 27, 58);
    const camera = new THREE.PerspectiveCamera(36, host.clientWidth / host.clientHeight, .1, 100);
    camera.position.set(12.8, 10.2, 17.8);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    host.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 4.25, 0);
    controls.enableDamping = true;
    controls.dampingFactor = .075;
    controls.minDistance = 7;
    controls.maxDistance = 34;
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
    const click = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(group.children, true).find(x => x.object.userData.selectable || x.object.userData.placement);
      if (hit?.object.userData.placement) { onPlaceRef.current(); return; }
      if (hit?.object.userData.selectable) onSelectRef.current(hit.object.userData.selectable as string);
      else if (configRef.current.preview) onPlaceRef.current();
    };
    renderer.domElement.addEventListener('dblclick', () => controls.reset());
    renderer.domElement.addEventListener('pointerup', click);
    let frame = 0;
    const animate = () => { frame = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); };
    animate();
    const resize = () => {
      if (!host.isConnected) return;
      const width = host.clientWidth; const height = host.clientHeight;
      camera.aspect = width / Math.max(height, 1); camera.updateProjectionMatrix(); renderer.setSize(width, height);
    };
    const observer = new ResizeObserver(resize); observer.observe(host);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && configRef.current.preview) onCancelRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('keydown', onKey); renderer.domElement.removeEventListener('pointerup', click); controls.dispose(); renderer.dispose(); host.removeChild(renderer.domElement); scene.clear(); };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current; const group = objectsRef.current;
    if (!scene || !group) return;
    while (group.children.length) {
      const child = group.children.pop();
      if (child) child.traverse(obj => { const mesh = obj as THREE.Mesh; mesh.geometry?.dispose(); if (Array.isArray(mesh.material)) mesh.material.forEach(m => m.dispose()); else mesh.material?.dispose(); });
    }
  const { starter, bays, lifts, bayWidth, liftHeight, finish, deck, guardrails, stair, selected, preview } = config;
    const wallMat = new THREE.MeshStandardMaterial({ color: '#d8e0e5', roughness: .88, transparent: true, opacity: .78 });
    const edgeMat = new THREE.MeshStandardMaterial({ color: '#c6d1d9', roughness: .9 });
    const glassMat = new THREE.MeshStandardMaterial({ color: '#aec7d7', roughness: .45, transparent: true, opacity: .74 });
    const building = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(7.6, 9, 5.8), wallMat); body.position.set(0, 4.5, 0); body.castShadow = true; body.receiveShadow = true; body.userData.selectable = 'Building'; building.add(body);
    const floorHeight = 3;
    for (let floor = 0; floor < 3; floor++) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(7.8, .1, 6), edgeMat); slab.position.set(0, floor * floorHeight + .12, 0); building.add(slab);
      const band = new THREE.Mesh(new THREE.BoxGeometry(7.61, .075, 5.81), new THREE.MeshStandardMaterial({ color: '#f3f6f7', roughness: .7 }));
      band.position.set(0, (floor + 1) * floorHeight, 0); band.userData.selectable = `Bay 02 · Level 0${floor + 1}`; building.add(band);
      for (let col = 0; col < 3; col++) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(1.34, 1.62, .05), glassMat); win.position.set(-2.35 + col * 2.35, floor * floorHeight + 1.7, 2.92); win.userData.selectable = `Bay 0${col + 1} · Level 0${floor + 1}`; building.add(win);
      }
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(7.8, .17, 6), edgeMat); roof.position.set(0, 9.04, 0); building.add(roof);
    const sideWin = new THREE.Mesh(new THREE.BoxGeometry(.05, 1.62, 1.36), glassMat); sideWin.position.set(3.82, 1.7, -.7); building.add(sideWin);
    group.add(building);
    const scaffoldGroup = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: finish === 'blue' ? '#467da2' : '#7894a6', metalness: .48, roughness: .42 });
    const steelLite = new THREE.MeshStandardMaterial({ color: '#89a5b8', metalness: .34, roughness: .48 });
    const deckMat = new THREE.MeshStandardMaterial({ color: '#b8c9d3', roughness: .76, transparent: true, opacity: .92 });
    const gold = new THREE.MeshStandardMaterial({ color: '#c5a26a', metalness: .24, roughness: .5 });
    const bar = (a: THREE.Vector3, b: THREE.Vector3, radius = .055, mat = steel, selectable = '') => {
      const mid = a.clone().add(b).multiplyScalar(.5); const delta = b.clone().sub(a);
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 8), mat);
      mesh.position.copy(mid); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); mesh.castShadow = true;
      if (selectable) mesh.userData.selectable = selectable;
      scaffoldGroup.add(mesh);
    };
    if (starter) {
      const baySize = bayWidth; const scaffoldWidth = Math.max(1, bays) * baySize;
      const xStart = -scaffoldWidth / 2; const zFront = 3.65; const levelGap = liftHeight;
      const floors = Math.max(1, lifts);
      for (let i = 0; i <= bays; i++) {
        const x = xStart + i * baySize;
        bar(new THREE.Vector3(x, .12, zFront), new THREE.Vector3(x, floors * levelGap + .25, zFront), .075, steel, `Bay ${String(Math.min(i + 1, bays)).padStart(2, '0')} · Level 01`);
        bar(new THREE.Vector3(x, .12, zFront + 1.15), new THREE.Vector3(x, floors * levelGap + .25, zFront + 1.15), .065, steelLite);
        const base = new THREE.Mesh(new THREE.CylinderGeometry(.17, .21, .12, 12), gold); base.position.set(x, .06, zFront); scaffoldGroup.add(base);
      }
      for (let level = 0; level <= lifts; level++) {
        const y = .16 + level * levelGap;
        for (let i = 0; i < bays; i++) {
          const x1 = xStart + i * baySize, x2 = x1 + baySize;
          const label = `Bay ${String(i + 1).padStart(2, '0')} · Level ${String(Math.max(1, level)).padStart(2, '0')}`;
          bar(new THREE.Vector3(x1, y, zFront), new THREE.Vector3(x2, y, zFront), .048, steelLite, label);
          bar(new THREE.Vector3(x1, y, zFront + 1.15), new THREE.Vector3(x2, y, zFront + 1.15), .044, steelLite);
          bar(new THREE.Vector3(x1, y, zFront), new THREE.Vector3(x1, y, zFront + 1.15), .04, steelLite);
          bar(new THREE.Vector3(x2, y, zFront), new THREE.Vector3(x2, y, zFront + 1.15), .04, steelLite);
        }
        if (level > 0 && deck) for (let i = 0; i < bays; i++) {
          const x = xStart + i * baySize + baySize / 2;
          const platform = new THREE.Mesh(new THREE.BoxGeometry(baySize - .11, .12, 1.03), deckMat);
          platform.position.set(x, y - .11, zFront + .57); platform.castShadow = true;
          platform.userData.selectable = `Bay ${String(i + 1).padStart(2, '0')} · Level ${String(level).padStart(2, '0')}`; scaffoldGroup.add(platform);
          const edgeLine = new THREE.Mesh(new THREE.BoxGeometry(baySize - .13, .025, .025), gold); edgeLine.position.set(x, y - .03, zFront + 1.08); scaffoldGroup.add(edgeLine);
        }
      }
      if (guardrails) for (let level = 1; level <= lifts; level++) {
        const y = level * levelGap + .95;
        for (let i = 0; i < bays; i++) {
          const x1 = xStart + i * baySize, x2 = x1 + baySize;
          bar(new THREE.Vector3(x1, y, zFront), new THREE.Vector3(x2, y, zFront), .032, gold);
          bar(new THREE.Vector3(x1, y - .55, zFront), new THREE.Vector3(x2, y - .55, zFront), .027, gold);
        }
      }
      if (bays > 0 && lifts > 0) {
        for (let k = 0; k < bays; k++) {
          const x = xStart + k * baySize;
          bar(new THREE.Vector3(x, .2, zFront), new THREE.Vector3(x + baySize, levelGap, zFront), .037, steelLite, `Bay ${String(k + 1).padStart(2, '0')} · Level 01`);
          bar(new THREE.Vector3(x + baySize, .2, zFront), new THREE.Vector3(x, levelGap, zFront), .037, steelLite);
          if (lifts > 1) {
            bar(new THREE.Vector3(x, levelGap + .15, zFront), new THREE.Vector3(x + baySize, levelGap * 2 - .1, zFront), .037, steelLite);
            bar(new THREE.Vector3(x + baySize, levelGap + .15, zFront), new THREE.Vector3(x, levelGap * 2 - .1, zFront), .037, steelLite);
          }
        }
      }
      if (stair) {
        const sx = xStart + scaffoldWidth + .75, sz = zFront + .25;
        bar(new THREE.Vector3(sx, 0, sz), new THREE.Vector3(sx, lifts * levelGap, sz), .06, steel);
        bar(new THREE.Vector3(sx + .95, 0, sz), new THREE.Vector3(sx + .95, lifts * levelGap, sz), .06, steel);
        for (let y = 1; y <= lifts * levelGap; y++) {
          const step = new THREE.Mesh(new THREE.BoxGeometry(.95, .045, .3), deckMat); step.position.set(sx + .48, y, sz + (y % 3) * .18); scaffoldGroup.add(step);
        }
        bar(new THREE.Vector3(sx, .2, sz + .15), new THREE.Vector3(sx + .95, levelGap, sz + .7), .035, steelLite);
      }
    }
    group.add(scaffoldGroup);
    const selectedLevel = selected && selected.includes('Level') ? selected : '';
    if (selectedLevel && starter) {
      const match = selectedLevel.match(/Level 0?(\d)/); const level = match ? Number(match[1]) : 1;
      const x = (selectedLevel.match(/Bay 0?(\d)/)?.[1] ? Number(selectedLevel.match(/Bay 0?(\d)/)?.[1]) : 1) - 1;
      const selectedBayWidth = bayWidth; const xStart = -bays * selectedBayWidth / 2;
      const outline = new THREE.Mesh(new THREE.BoxGeometry(selectedBayWidth, .14, 1.22), new THREE.MeshBasicMaterial({ color: '#d4a85f', transparent: true, opacity: .37 }));
      outline.position.set(xStart + x * selectedBayWidth + selectedBayWidth / 2, level * liftHeight - .08, 4.22); outline.userData.selectable = selectedLevel; group.add(outline);
    }
    if (preview) {
      const previewMat = new THREE.MeshStandardMaterial({ color: '#4e8bb4', transparent: true, opacity: .52, depthWrite: false });
      const previewMesh = new THREE.Mesh(new THREE.BoxGeometry(2.3, .12, .95), previewMat); previewMesh.position.set(0, 3.1, 4.25); previewMesh.userData.placement = true; group.add(previewMesh);
      const previewOutline = new THREE.BoxHelper(previewMesh, '#4e8bb4'); previewOutline.userData.placement = true; group.add(previewOutline);
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
  const [bays, setBays] = useState(3);
  const [lifts, setLifts] = useState(3);
  const [bayWidth, setBayWidth] = useState(2.5);
  const [liftHeight, setLiftHeight] = useState(3);
  const [finish, setFinish] = useState('galv');
  const [showLabels, setShowLabels] = useState(true);
  const [workArea, setWorkArea] = useState('North elevation');
  const [deck, setDeck] = useState(true);
  const [guardrails, setGuardrails] = useState(true);
  const [stair, setStair] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [bottomOpen, setBottomOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [category, setCategory] = useState<Category>('All');
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [selected, setSelected] = useState(selectedDefault);
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
  const config = useMemo<SceneConfig>(() => ({ starter, bays, lifts, bayWidth, liftHeight, finish, deck, guardrails, stair, selected, preview }), [starter, bays, lifts, bayWidth, liftHeight, finish, deck, guardrails, stair, selected, preview]);
  const filteredTools = useMemo(() => tools.filter(t => (category === 'All' || t.category === category) && t.name.toLowerCase().includes(query.toLowerCase())), [category, query]);
  const parts = useMemo(() => {
    return [
      ['Standards', starter ? bays + 1 : 0],
      ['Ledgers', starter ? (bays * (lifts + 1)) : 0],
      ['Diagonal braces', starter ? bays * Math.min(lifts, 2) : 0],
      ['Deck units', starter && deck ? bays * lifts : 0],
      ['Guardrails', starter && guardrails ? bays * lifts * 2 : 0],
    ];
  }, [starter, bays, lifts, deck, guardrails]);
  const place = useCallback(() => {
    if (!preview) return;
    setStarter(true);
    if (preview.toLowerCase().includes('deck')) setDeck(true);
    if (preview.toLowerCase().includes('guard')) setGuardrails(true);
    setRecent(prev => [preview, ...prev.filter(item => item !== preview)].slice(0, 3));
    notify(`${preview} placed at the active level`);
    setPreview(null);
  }, [preview, notify]);
  const cancelPlacement = useCallback(() => { setPreview(null); notify('Placement cancelled'); }, [notify]);
  const chooseTool = (name: string) => {
    setPreview(name);
    setRecent(prev => [name, ...prev.filter(item => item !== name)].slice(0, 3));
  };
  const selectObject = (value: string) => {
    setSelected(value);
    if (value !== 'Building') {
      const match = value.match(/Bay 0?(\d)/);
      if (match) setSelected(value);
    }
  };
  const activeLevel = selected.includes('Level') ? Number(selected.match(/Level 0?(\d)/)?.[1] ?? 1) : 2;
  const activeBay = selected.match(/Bay 0?(\d)/)?.[1] ?? '02';
  const levels = Array.from({ length: Math.max(lifts, 1) }, (_, i) => i + 1);
  const toggleFavorite = (name: string) => setFavSet(prev => prev.includes(name) ? prev.filter(v => v !== name) : [...prev, name]);
  const generate = () => { setStarter(true); setPreview(null); setSelected('Bay 02 · Level 02'); notify('Starter scaffold added around the building'); };
  const addBay = () => { setStarter(true); setBays(v => Math.min(v + 1, 6)); notify('Bay added'); };
  const removeBay = () => { if (bays > 1) { setBays(v => v - 1); notify('Bay removed'); } };
  const addLift = () => { setStarter(true); setLifts(v => Math.min(v + 1, 5)); notify('Lift added'); };
  const removeLift = () => { if (lifts > 1) { setLifts(v => v - 1); notify('Lift removed'); } };

  return (
    <main className="workspace">
      <header className="topbar">
        <div className="brand"><div className="brand-mark">H</div><div><div className="brand-name">HAKI <span style={{ fontWeight: 500 }}>LASCO</span></div><div className="brand-sub">SCAFFOLD WORKSPACE</div></div></div>
        <div className="top-divider" />
        <div><div className="project-name">{workArea} · Concept 01</div><div className="project-meta">Untitled project&nbsp; / &nbsp;Local demo</div></div>
        <div className="top-spacer" />
        <div className="saved"><Check size={13} /> Saved locally</div>
        <button className="top-action" onClick={() => notify('Export preview is illustrative only')} data-testid="button-export"><Download size={15} /><span>Export</span></button>
        <button className="top-action" onClick={() => notify('Workspace help · click and drag to orbit, scroll to zoom')} data-testid="button-help"><CircleHelp size={16} /><span>Help</span></button>
        <div className="avatar" title="Workspace user">HL</div>
      </header>
      <section className="main-stage">
        <ThreeViewport config={config} onSelect={selectObject} onPlace={place} onCancel={cancelPlacement} resetToken={resetToken} viewMode={viewMode} />
        <div className="center-top">
          <div className="scene-chip"><span className="status-dot" /> <strong>3D view</strong>{showLabels && <span>· labels</span>}</div>
          <div className="scene-chip"><Ruler size={12} /> Dimensions illustrative</div>
          <div className="scene-chip"><span className="status-dot" /><strong>Concept</strong></div>
        </div>
        <div className="canvas-controls">
          <button className={`view-button ${viewMode === 'orbit' ? 'active' : ''}`} title="Orbit view" onClick={() => { setViewMode('orbit'); setResetToken(v => v + 1); }} data-testid="button-orbit"><RotateCcw size={14} /></button>
          <button className={`view-button ${viewMode === 'pan' ? 'active' : ''}`} title="Pan view" onClick={() => { setViewMode('pan'); notify('Pan mode: right-drag in the view'); }} data-testid="button-pan"><Move size={14} /></button>
          <button className="view-button" title="Reset view" onClick={() => setResetToken(v => v + 1)} data-testid="button-reset-view"><Eye size={14} /></button>
        </div>
        {!starter && !preview && <div className="generate-card">
          <div className="generate-icon"><Cuboid size={18} /></div>
          <h2>Start with a scaffold concept</h2>
          <p>Add a simplified scaffold around this three-storey building, then adjust its bays, lifts and components.</p>
          <button className="primary-button" onClick={generate} data-testid="button-generate"><Plus size={14} /> Generate starter scaffold</button>
        </div>}
        {preview && <div className="generate-card" style={{ top: 'auto', bottom: 58, left: '50%', padding: '10px 12px', width: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="recent-symbol"><PreviewIcon name={preview} /></div>
          <div style={{ textAlign: 'left' }}><strong style={{ fontSize: 11, color: '#39556d' }}>Place {preview}</strong><div style={{ color: '#81909d', fontSize: 9, marginTop: 2 }}>Snapped preview · click model to place</div></div>
          <button className="icon-button" title="Cancel placement" onClick={() => { setPreview(null); notify('Placement cancelled'); }} data-testid="button-cancel-placement"><X size={15} /></button>
        </div>}

        <aside className={`panel left ${leftOpen ? '' : 'collapsed'}`}>
          <div className="panel-head"><div><div className="panel-heading">Component toolkit</div><div className="head-sub">Browse system components</div></div><button className="icon-button" onClick={() => setLeftOpen(false)} title="Collapse toolkit" data-testid="button-collapse-toolkit"><ChevronLeft size={16} /></button></div>
          <div className="panel-body">
            <label className="searchbox"><Search size={14} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a component..." aria-label="Search components" data-testid="input-tool-search" />{query && <button className="icon-button" onClick={() => setQuery('')} title="Clear search"><X size={13} /></button>}</label>
            <div className="eyebrow">Categories</div>
            <div className="category-row">{categoryList.map(c => <button key={c} className={category === c ? 'active' : ''} onClick={() => setCategory(c)} data-testid={`filter-${c.toLowerCase()}`}>{c}</button>)}</div>
            <div className="eyebrow">Components <span style={{ float: 'right', fontFamily: 'var(--app-font-mono)', fontWeight: 400 }}>{filteredTools.length}</span></div>
            <div className="tool-grid" style={{ marginTop: 8 }}>
              {filteredTools.map(tool => <button className={`tool-item ${preview === tool.name ? 'selected' : ''}`} key={tool.name} onClick={() => chooseTool(tool.name)} data-testid={`tool-${tool.code}`}>
                <tool.Icon size={15} className="tool-icon" /><span className="tool-name">{tool.name}</span><div className="tool-dims">{tool.code} · demo</div>
                <span className={`tool-star ${favSet.includes(tool.name) ? 'is-fav' : ''}`} role="button" aria-label={`${favSet.includes(tool.name) ? 'Remove' : 'Add'} ${tool.name} favorite`} onClick={e => { e.stopPropagation(); toggleFavorite(tool.name); }} data-testid={`favorite-${tool.code}`}><Star size={12} fill={favSet.includes(tool.name) ? 'currentColor' : 'none'} /></span>
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
        <aside className={`panel right ${rightOpen ? '' : 'collapsed'}`}>
          <div className="panel-head"><div><div className="panel-heading">Properties</div><div className="head-sub">Contextual scaffold settings</div></div><button className="icon-button" onClick={() => setRightOpen(false)} title="Collapse properties" data-testid="button-collapse-properties"><ChevronRight size={16} /></button></div>
          <div className="panel-body">
            <div className="panel-section">
              <div className="section-title-row"><span className="eyebrow">Selected element</span><span className="type-badge">{selected === 'Building' ? 'BUILDING' : 'SCAFFOLD BAY'}</span></div>
              <div className="selected-title">{selected}</div>
              <div className="selected-desc">Illustrative configuration · not engineering verified</div>
              {selected !== 'Building' && <>
                <label className="field-label">Bay reference</label><select className="field-control" value={activeBay} onChange={e => setSelected(`Bay ${e.target.value} · Level ${String(activeLevel).padStart(2, '0')}`)} data-testid="select-bay"><option value="01">Bay 01</option><option value="02">Bay 02</option><option value="03">Bay 03</option><option value="04">Bay 04</option><option value="05">Bay 05</option></select>
                <label className="field-label">Level</label><select className="field-control" value={String(activeLevel)} onChange={e => setSelected(`Bay ${String(activeBay).padStart(2, '0')} · Level ${String(e.target.value).padStart(2, '0')}`)} data-testid="select-level">{Array.from({ length: Math.max(lifts, 3) }, (_, i) => <option key={i} value={i + 1}>Level {String(i + 1).padStart(2, '0')}</option>)}</select>
              </>}
            </div>
            <div className="panel-section">
              <div className="section-title-row"><span className="section-title">Layout</span><SlidersHorizontal size={14} color="#8998a4" /></div>
              <label className="field-label">Bay width <span style={{ color: '#9aa5ad' }}>· illustrative</span></label>
              <select className="field-control" value={String(bayWidth)} onChange={e => setBayWidth(Number(e.target.value))} data-testid="select-bay-width"><option value="2">2.0 m</option><option value="2.5">2.5 m</option><option value="3">3.0 m</option></select>
              <label className="field-label">Lift height <span style={{ color: '#9aa5ad' }}>· illustrative</span></label>
              <select className="field-control" value={String(liftHeight)} onChange={e => setLiftHeight(Number(e.target.value))} data-testid="select-lift-height"><option value="2">2.0 m</option><option value="2.5">2.5 m</option><option value="3">3.0 m</option></select>
            </div>
            <div className="panel-section">
              <div className="section-title-row"><span className="section-title">Common options</span><span className="type-badge">VISIBILITY</span></div>
              <div className="switch-row">Decking <button className={`switch ${deck ? 'on' : ''}`} role="switch" aria-checked={deck} onClick={() => setDeck(!deck)} data-testid="toggle-decking" /></div>
              <div className="switch-row">Guardrails <button className={`switch ${guardrails ? 'on' : ''}`} role="switch" aria-checked={guardrails} onClick={() => setGuardrails(!guardrails)} data-testid="toggle-guardrails" /></div>
              <div className="switch-row">Stair tower <button className={`switch ${stair ? 'on' : ''}`} role="switch" aria-checked={stair} onClick={() => setStair(!stair)} data-testid="toggle-stair" /></div>
            </div>
            <div className="panel-section" style={{ borderBottom: 0 }}>
              <button className="section-title-row" style={{ width: '100%', border: 0, background: 'none', padding: 0, cursor: 'pointer' }} onClick={() => setAdvancedOpen(!advancedOpen)} data-testid="button-advanced"><span className="section-title">Advanced settings</span>{advancedOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
              {advancedOpen && <div style={{ paddingTop: 5 }}>
                <div className="switch-row">Show component labels <button className={`switch ${showLabels ? 'on' : ''}`} role="switch" aria-checked={showLabels} onClick={() => setShowLabels(!showLabels)} data-testid="toggle-labels" /></div>
                <label className="field-label">Scaffold finish</label><select className="field-control" value={finish} onChange={e => setFinish(e.target.value)} data-testid="select-finish"><option value="galv">Galvanised steel</option><option value="blue">HAKI blue (concept)</option></select>
                <label className="field-label">Work area reference</label><input className="field-control" value={workArea} onChange={e => setWorkArea(e.target.value)} data-testid="input-work-area" />
              </div>}
            </div>
            <div className="disclaimer">Concept workspace only. All dimensions, counts and component indicators are illustrative and are not verified engineering calculations.</div>
          </div>
        </aside>
        {!rightOpen && <button className="collapse-tab right" onClick={() => setRightOpen(true)} title="Open properties" data-testid="button-open-properties"><ChevronLeft size={15} /></button>}

        <div className={`bottom-panel ${bottomOpen ? '' : 'closed'}`}>
          <div className="bottom-head">
            <div className="bottom-tabs">{(['Levels', 'Parts summary'] as const).map(tab => <button key={tab} className={`bottom-tab ${bottomTab === tab ? 'active' : ''}`} onClick={() => { setBottomTab(tab); setBottomOpen(true); }} data-testid={`tab-${tab.toLowerCase().replace(' ', '-')}`}>{tab}</button>)}</div>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}><span className="type-badge">ILLUSTRATIVE ONLY</span><button className="icon-button" onClick={() => setBottomOpen(false)} title="Close bottom panel" data-testid="button-close-bottom"><ChevronDown size={16} /></button></div>
          </div>
          <div className="bottom-content">
            {bottomTab === 'Levels' ? <>
              <div className="levels-list">{levels.map(level => <button key={level} className={`level-card ${activeLevel === level && selected !== 'Building' ? 'active' : ''}`} onClick={() => { setSelected(`Bay ${String(activeBay).padStart(2, '0')} · Level ${String(level).padStart(2, '0')}`); setStarter(true); }} data-testid={`level-card-${level}`}>
                <div className="level-number">LEVEL / 0{level}</div><div className="level-name">Lift {level} settings</div>
                <div className="level-setting"><span>Height</span><span>{liftHeight.toFixed(1)} m</span></div><div className="level-setting"><span>Deck</span><span>{deck ? 'Included' : 'Off'}</span></div><div className="level-setting"><span>Guardrail</span><span>{guardrails ? 'Included' : 'Off'}</span></div>
              </button>)}
                <button className="level-card" onClick={addLift} style={{ minWidth: 110, display: 'grid', placeItems: 'center', color: '#6f8799' }} data-testid="button-add-level"><Plus size={17} /><span style={{ fontSize: 10, marginTop: 6 }}>Add lift</span></button>
              </div>
              <div className="parts-summary"><div className="eyebrow">Quick adjust</div><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}><span style={{ color: '#71818f', fontSize: 10 }}>Bays</span><Stepper value={bays} decrement={removeBay} increment={addBay} testid="bays" /></div><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}><span style={{ color: '#71818f', fontSize: 10 }}>Lifts</span><Stepper value={lifts} decrement={removeLift} increment={addLift} testid="lifts" /></div><div className="summary-foot">Changes update the concept view immediately.</div></div>
            </> : <div className="parts-summary" style={{ width: '100%', border: 0, display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 15, alignContent: 'start', padding: '15px 20px' }}>
              {parts.map(([label, count]) => <div key={label as string} style={{ borderRight: '1px solid #e8edf0', paddingRight: 10 }}><div className="eyebrow">{label as string}</div><div style={{ font: '700 19px var(--app-font-display)', color: '#39566e', margin: '8px 0 4px' }}>{count as number}</div><div style={{ color: '#98a3ac', fontSize: 9 }}>indicative units</div></div>)}
              <div className="summary-foot" style={{ gridColumn: '1 / -1' }}>Illustrative parts summary for concept coordination. Quantities are not verified engineering calculations or a construction takeoff.</div>
            </div>}
          </div>
        </div>
        <button className="bottom-toggle" onClick={() => setBottomOpen(!bottomOpen)} data-testid="button-toggle-bottom"><Layers3 size={13} /> {bottomOpen ? 'Hide levels & parts' : 'Levels & parts'} <span className="type-badge" style={{ padding: '3px 5px' }}>{starter ? `${bays} bays · ${lifts} lifts` : 'No scaffold'}</span></button>
        {notice && <div className="toast-note" role="status" data-testid="status-notice">{notice}</div>}
      </section>
    </main>
  );
}

function Stepper({ value, decrement, increment, testid }: { value: number; decrement: () => void; increment: () => void; testid: string }) {
  return <div className="stepper"><button onClick={decrement} aria-label={`Remove ${testid}`} data-testid={`button-decrease-${testid}`}><Minus size={12} /></button><span>{String(value).padStart(2, '0')}</span><button onClick={increment} aria-label={`Add ${testid}`} data-testid={`button-increase-${testid}`}><Plus size={12} /></button></div>;
}

function PreviewIcon({ name }: { name: string }) {
  const item = tools.find(tool => tool.name === name);
  const Icon = item?.Icon ?? Box;
  return <Icon size={13} />;
}

export default App;
