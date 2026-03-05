import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Box, Typography, Chip, Divider, Tooltip, CircularProgress } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import { useTranslation } from 'react-i18next';
import { skillTreeApi, skillPointsApi } from '../api';
import type { SkillTreeDoc, SkillTreeNode } from '../types';

// ── Palette (mirrors Skills.tsx) ─────────────────────────────────────────────
type PKey = 'root' | 'development' | 'research' | 'communication' | 'organisation' | 'default';

const PALETTE: Record<PKey, { stroke: string; fill: string; text: string }> = {
  root:          { stroke: '#e2b714', fill: '#3d3519', text: '#f5e6a3' },
  development:   { stroke: '#38bdf8', fill: '#1a3040', text: '#bae6fd' },
  research:      { stroke: '#a78bfa', fill: '#2a1f40', text: '#ddd6fe' },
  communication: { stroke: '#fb923c', fill: '#3d2210', text: '#fed7aa' },
  organisation:  { stroke: '#4ade80', fill: '#1a3326', text: '#bbf7d0' },
  default:       { stroke: '#94a3b8', fill: '#232b35', text: '#cbd5e1' },
};

const CAT_KEYS: Record<string, PKey> = {
  root: 'root', development: 'development', research: 'research',
  communication: 'communication', organisation: 'organisation',
};

const TREE_BG   = '#1e2229';
const BASE_R: Record<number, number> = { 0: 50, 1: 40, 2: 31, 3: 22 };
const FOCUS_SCALE = 1.5;
const VW = 800; const VH = 600;
const MAX_SKILL_POINTS = 5;

// ── Physics constants ─────────────────────────────────────────────────────────
const REPULSION_K = 5500; const SPRING_K = 0.055;
const DAMPING = 0.82; const STEPS_PER_FRAME = 2;
const MAX_ITERS = 3600; const CONVERGENCE_THRESHOLD = 0.08;
const ZOOM_MIN = 0.18; const ZOOM_MAX = 1.0; const ZOOM_FACTOR = 1.12;

function springLen(srcDepth: number) { return srcDepth === 0 ? 165 : srcDepth === 1 ? 115 : 78; }

// ── Types ─────────────────────────────────────────────────────────────────────
interface NodeDatum { id: string; label: string; description?: string; x: number; y: number; depth: number; colorKey: PKey; color?: string; }
interface EdgeDatum { x1: number; y1: number; x2: number; y2: number; colorKey: PKey; parentId: string; childId: string; }
interface SimNode extends NodeDatum { vx: number; vy: number; pinned: boolean; }
interface SimEdge { s: string; t: string; srcDepth: number; colorKey: PKey; }
interface ConvergedLayout { nodes: NodeDatum[]; edges: EdgeDatum[]; zoom: number; panX: number; panY: number; focusedId: string; }

// ── Physics functions ─────────────────────────────────────────────────────────
function flattenTree(root: SkillTreeNode): { simNodes: SimNode[]; simEdges: SimEdge[] } {
  const simNodes: SimNode[] = []; const simEdges: SimEdge[] = [];
  const INIT_R = [0, 195, 340, 450];
  function walk(node: SkillTreeNode, parentId: string | null, depth: number, colorKey: PKey, angle: number) {
    const ck: PKey = depth === 0 ? 'root' : depth === 1 ? ((CAT_KEYS[node.id] ?? 'default') as PKey) : colorKey;
    const r = INIT_R[Math.min(depth, INIT_R.length - 1)];
    const jitter = depth > 0 ? (Math.random() - 0.5) * 14 : 0;
    simNodes.push({ id: node.id, label: node.label, description: node.description, x: r * Math.cos(angle) + jitter, y: r * Math.sin(angle) + jitter, vx: 0, vy: 0, depth, colorKey: ck, pinned: depth === 0, color: node.color });
    if (parentId !== null) simEdges.push({ s: parentId, t: node.id, srcDepth: depth - 1, colorKey: ck });
    const children = node.children ?? [];
    if (!children.length) return;
    if (depth === 0) {
      children.forEach((child, i) => walk(child, node.id, 1, 'root', (2 * Math.PI * i) / children.length - Math.PI / 2));
    } else {
      const fanHalf = depth === 1 ? Math.PI * 0.38 : Math.PI * 0.28;
      children.forEach((child, i) => {
        const childAngle = children.length === 1 ? angle : angle - fanHalf + (i * 2 * fanHalf) / (children.length - 1);
        walk(child, node.id, depth + 1, ck, childAngle);
      });
    }
  }
  walk(root, null, 0, 'root', 0);
  return { simNodes, simEdges };
}

function tickPhysics(nodes: SimNode[], edges: SimEdge[], alpha: number): SimNode[] {
  const next = nodes.map(n => ({ ...n }));
  const byId = new Map(next.map(n => [n.id, n]));
  for (let i = 0; i < next.length; i++) {
    for (let j = i + 1; j < next.length; j++) {
      const a = next[i], b = next[j]; const dx = b.x - a.x, dy = b.y - a.y;
      const dist2 = dx * dx + dy * dy || 1; const inv = 1 / Math.sqrt(dist2);
      const f = (REPULSION_K * alpha) / dist2; const fx = f * dx * inv, fy = f * dy * inv;
      if (!a.pinned) { a.vx -= fx; a.vy -= fy; } if (!b.pinned) { b.vx += fx; b.vy += fy; }
    }
  }
  for (const e of edges) {
    const a = byId.get(e.s), b = byId.get(e.t); if (!a || !b) continue;
    const dx = b.x - a.x, dy = b.y - a.y; const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const f = SPRING_K * (dist - springLen(e.srcDepth)) * alpha; const fx = f * dx / dist, fy = f * dy / dist;
    if (!a.pinned) { a.vx += fx; a.vy += fy; } if (!b.pinned) { b.vx -= fx; b.vy -= fy; }
  }
  for (const n of next) { if (n.pinned) continue; n.vx *= DAMPING; n.vy *= DAMPING; n.x += n.vx; n.y += n.vy; }
  return next;
}

function meanDisplacement(before: SimNode[], after: SimNode[]): number {
  let sum = 0, count = 0;
  for (let i = 0; i < before.length; i++) {
    if (before[i].pinned) continue;
    const dx = after[i].x - before[i].x, dy = after[i].y - before[i].y;
    sum += Math.sqrt(dx * dx + dy * dy); count++;
  }
  return count > 0 ? sum / count : 0;
}

function wrapText(text: string, maxChars = 10): string[] {
  const words = text.split(' '); const lines: string[] = []; let cur = '';
  for (const w of words) {
    const cand = cur ? `${cur} ${w}` : w;
    if (cand.length > maxChars && cur) { lines.push(cur); cur = w; } else cur = cand;
  }
  if (cur) lines.push(cur); return lines;
}

// ── Points arc around a node ───────────────────────────────────────────────────
function PointsArc({ r, points, stroke }: { r: number; points: number; stroke: string }) {
  if (points <= 0) return null;
  if (points >= MAX_SKILL_POINTS) return <circle r={r} fill="none" stroke={stroke} strokeWidth={2.5} opacity={0.85} />;
  const frac = points / MAX_SKILL_POINTS;
  const angle = frac * 2 * Math.PI;
  const sa = -Math.PI / 2, ea = sa + angle;
  const x1 = r * Math.cos(sa), y1 = r * Math.sin(sa);
  const x2 = r * Math.cos(ea), y2 = r * Math.sin(ea);
  return (
    <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${angle > Math.PI ? 1 : 0} 1 ${x2} ${y2}`}
      fill="none" stroke={stroke} strokeWidth={2.5} opacity={0.85} strokeLinecap="round" />
  );
}

// ── Skill node (user variant) ─────────────────────────────────────────────────
interface UserSkillNodeElProps {
  node: NodeDatum; isFocused: boolean; isChild: boolean;
  isLocked: boolean; isGlowing: boolean; points: number;
  onClick: () => void;
}

function UserSkillNodeEl({ node, isFocused, isChild, isLocked, isGlowing, points, onClick }: UserSkillNodeElProps) {
  const [hovered, setHovered] = useState(false);
  const base = PALETTE[node.colorKey];
  const stroke = node.color ?? base.stroke;
  const fill   = base.fill;
  const text   = node.color ?? base.text;
  const r = BASE_R[node.depth] ?? 22;
  const lines = wrapText(node.label);
  const fs = [12, 11, 9.5, 8.5][node.depth] ?? 8.5;
  const scale = isFocused ? FOCUS_SCALE : isChild ? 1.08 : hovered ? 1.1 : 1;
  const sw = isFocused ? 2.5 : points > 0 ? 2 : isChild ? 1.8 : hovered ? 1.5 : 1;

  return (
    <g
      transform={`translate(${node.x}, ${node.y})`}
      onClick={isLocked ? undefined : onClick}
      onMouseEnter={() => { if (!isLocked) setHovered(true); }}
      onMouseLeave={() => setHovered(false)}
      style={{ cursor: isLocked ? 'not-allowed' : 'pointer', opacity: isLocked ? 0.22 : 1, transition: 'opacity 0.3s ease' }}
    >
      {/* Focused pulse ring */}
      {isFocused && <circle r={r * 1.7} fill="none" stroke={stroke} strokeWidth={1} opacity={0.35} className="skill-pulse" />}

      {/* Glow ripple on point add */}
      {isGlowing && <circle r={r * 2.2} fill="none" stroke={stroke} strokeWidth={3} className="skill-glow-ring" />}

      {/* Scale group */}
      <g style={{ transformBox: 'fill-box', transformOrigin: 'center', transform: `scale(${scale})`, transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
        <circle r={r} fill={fill} stroke={stroke} strokeWidth={sw} style={{ transition: 'stroke-width 0.2s ease' }} />

        {/* Points arc (outside ring) */}
        {node.depth > 0 && <PointsArc r={r + 5} points={points} stroke={stroke} />}

        {/* Label */}
        {lines.map((line, i) => (
          <text key={i} textAnchor="middle" dominantBaseline="middle"
            fontSize={fs} fontWeight={isFocused ? 700 : isChild ? 600 : 500}
            fill={isFocused ? text : isChild ? text : '#9aa8b8'}
            y={(i - (lines.length - 1) / 2) * (fs + 2.5)}
            style={{ userSelect: 'none', pointerEvents: 'none' }}>
            {line}
          </text>
        ))}
      </g>
    </g>
  );
}

// ── Radar chart ───────────────────────────────────────────────────────────────
interface RadarCat { id: string; label: string; colorKey: PKey; total: number; }

function RadarChart({ categories, maxVal }: { categories: RadarCat[]; maxVal: number }) {
  const n = categories.length;
  if (n < 3) return null;
  const cx = 120, cy = 120, R = 85, levels = 5;
  const cap = Math.max(maxVal, 1);
  const angles = categories.map((_, i) => (2 * Math.PI * i) / n - Math.PI / 2);
  const dataR = categories.map(cat => (R * Math.min(cat.total, cap)) / cap);
  const pts = angles.map((a, i) => ({ x: cx + dataR[i] * Math.cos(a), y: cy + dataR[i] * Math.sin(a) }));

  return (
    <svg viewBox="0 0 240 240" style={{ width: '100%', maxWidth: 240, display: 'block', margin: '0 auto' }}>
      <rect width={240} height={240} fill="transparent" />

      {/* Grid rings */}
      {Array.from({ length: levels }, (_, lv) => {
        const r = (R * (lv + 1)) / levels;
        const poly = angles.map(a => `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`).join(' ');
        return <polygon key={lv} points={poly} fill="none" stroke="#2d3748" strokeWidth={0.8} />;
      })}

      {/* Axes */}
      {angles.map((a, i) => (
        <line key={i} x1={cx} y1={cy} x2={cx + R * Math.cos(a)} y2={cy + R * Math.sin(a)} stroke="#2d3748" strokeWidth={0.8} />
      ))}

      {/* Colored sectors between data points */}
      {categories.map((cat, i) => {
        const j = (i + 1) % n;
        const { fill, stroke } = PALETTE[cat.colorKey];
        return (
          <polygon key={cat.id}
            points={`${cx},${cy} ${pts[i].x},${pts[i].y} ${pts[j].x},${pts[j].y}`}
            fill={fill} fillOpacity={0.7} stroke={stroke} strokeWidth={0.6}
          />
        );
      })}

      {/* Data points */}
      {categories.map((cat, i) => (
        <circle key={cat.id} cx={pts[i].x} cy={pts[i].y} r={4} fill={PALETTE[cat.colorKey].stroke} />
      ))}

      {/* Axis labels */}
      {categories.map((cat, i) => {
        const a = angles[i]; const lr = R + 20;
        return (
          <text key={cat.id} x={cx + lr * Math.cos(a)} y={cy + lr * Math.sin(a)}
            textAnchor="middle" dominantBaseline="middle" fontSize={8.5}
            fill={PALETTE[cat.colorKey].stroke} fontWeight={600} style={{ userSelect: 'none' }}>
            {cat.label}
          </text>
        );
      })}

      <circle cx={cx} cy={cy} r={2.5} fill="#4a5568" />
    </svg>
  );
}

// ── Layout cache (separate from manager Skills page) ─────────────────────────
const userLayoutCache = new Map<string, ConvergedLayout>();

// ── Main page ─────────────────────────────────────────────────────────────────
export default function UserSkills() {
  const { t } = useTranslation();

  // ── Tree + points state ──────────────────────────────────────────────────
  const [skillTree, setSkillTree] = useState<SkillTreeDoc | null>(null);
  const [points, setPoints] = useState<Record<string, number>>({});
  const [loadingPoints, setLoadingPoints] = useState(false);

  // Physics
  const simRef   = useRef<{ nodes: SimNode[]; edges: SimEdge[]; iter: number } | null>(null);
  const frameRef = useRef<number>(0);

  // View state
  const [zoom, setZoom]           = useState(1);
  const [panX, setPanX]           = useState(VW / 2);
  const [panY, setPanY]           = useState(VH / 2);
  const [focusedId, setFocusedId] = useState<string>('root');
  const [glowingId, setGlowingId] = useState<string | null>(null);
  const [nodes, setNodes]         = useState<NodeDatum[]>([]);
  const [edges, setEdges]         = useState<EdgeDatum[]>([]);

  const viewStateRef = useRef({ zoom, panX, panY, focusedId });
  useEffect(() => {
    viewStateRef.current = { zoom, panX, panY, focusedId };
    if (!skillTree) return;
    const entry = userLayoutCache.get(skillTree.treeId);
    if (entry) userLayoutCache.set(skillTree.treeId, { ...entry, zoom, panX, panY, focusedId });
  }, [zoom, panX, panY, focusedId, skillTree]);

  // ── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([skillTreeApi.get(), skillPointsApi.getAll()])
      .then(([tree, pts]) => { setSkillTree(tree); setPoints(pts); })
      .catch(console.error);
  }, []);

  // ── Spring simulation ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!skillTree) return;
    cancelAnimationFrame(frameRef.current);
    const cached = userLayoutCache.get(skillTree.treeId);
    if (cached) {
      setNodes(cached.nodes); setEdges(cached.edges);
      setZoom(cached.zoom); setPanX(cached.panX); setPanY(cached.panY); setFocusedId(cached.focusedId);
      return;
    }
    const treeId = skillTree.treeId;
    const { simNodes, simEdges } = flattenTree(skillTree.root);
    simRef.current = { nodes: simNodes, edges: simEdges, iter: 0 };
    const getViewState = viewStateRef;

    function snapshot(sn: SimNode[], se: SimEdge[]): ConvergedLayout {
      const m = new Map(sn.map(n => [n.id, n]));
      const vs = getViewState.current;
      const nodes = sn.map(({ id, label, description, x, y, depth, colorKey, color }) => ({ id, label, description, x, y, depth, colorKey, color }));
      const edges = se.map(e => {
        const src = m.get(e.s)!, tgt = m.get(e.t)!;
        return { x1: src.x, y1: src.y, x2: tgt.x, y2: tgt.y, colorKey: e.colorKey, parentId: e.s, childId: e.t };
      });
      return { nodes, edges, zoom: vs.zoom, panX: vs.panX, panY: vs.panY, focusedId: vs.focusedId };
    }

    function animate() {
      const sim = simRef.current; if (!sim) return;
      if (sim.iter >= MAX_ITERS) { userLayoutCache.set(treeId, snapshot(sim.nodes, sim.edges)); return; }
      const alpha = Math.max(0.02, 1 - sim.iter / MAX_ITERS);
      const prev = sim.nodes;
      for (let s = 0; s < STEPS_PER_FRAME; s++) { sim.nodes = tickPhysics(sim.nodes, sim.edges, alpha); sim.iter++; }
      const layout = snapshot(sim.nodes, sim.edges);
      setNodes(layout.nodes); setEdges(layout.edges);
      if (meanDisplacement(prev, sim.nodes) < CONVERGENCE_THRESHOLD) { userLayoutCache.set(treeId, layout); return; }
      frameRef.current = requestAnimationFrame(animate);
    }

    const init = snapshot(simNodes, simEdges);
    setNodes(init.nodes); setEdges(init.edges);
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [skillTree]);

  // ── Derived maps ──────────────────────────────────────────────────────────
  const nodeMap    = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);
  const parentMap  = useMemo(() => { const m = new Map<string, string>(); edges.forEach(e => m.set(e.childId, e.parentId)); return m; }, [edges]);
  const childrenOf = useMemo(() => {
    const m = new Map<string, Set<string>>();
    edges.forEach(e => { if (!m.has(e.parentId)) m.set(e.parentId, new Set()); m.get(e.parentId)!.add(e.childId); });
    return m;
  }, [edges]);

  const childrenIds = useMemo(() => childrenOf.get(focusedId) ?? new Set<string>(), [childrenOf, focusedId]);

  /** A node is locked if depth >= 2 and its direct parent has 0 points. Root (depth 0) and categories (depth 1) are always unlocked. */
  const isLocked = useCallback((nodeId: string): boolean => {
    const node = nodeMap.get(nodeId);
    if (!node || node.depth <= 1) return false;
    const parentId = parentMap.get(nodeId);
    return !parentId || (points[parentId] ?? 0) < 1;
  }, [nodeMap, parentMap, points]);

  /** Root (depth 0) is not allocatable; everything else that is unlocked can receive points. */
  const canAllocate = useCallback((nodeId: string): boolean => {
    const node = nodeMap.get(nodeId);
    return !!node && node.depth > 0 && !isLocked(nodeId);
  }, [nodeMap, isLocked]);

  // ── Category subtrees for radar chart ────────────────────────────────────
  const radarCategories = useMemo<RadarCat[]>(() => {
    if (!skillTree) return [];
    function subtreeIds(nodeId: string): string[] {
      const ids = [nodeId];
      (childrenOf.get(nodeId) ?? new Set()).forEach(child => subtreeIds(child).forEach(id => ids.push(id)));
      return ids;
    }
    return (skillTree.root.children ?? []).map(cat => {
      const ck = (CAT_KEYS[cat.id] ?? 'default') as PKey;
      const ids = subtreeIds(cat.id);
      const total = ids.reduce((sum, id) => sum + (points[id] ?? 0), 0);
      return { id: cat.id, label: cat.label, colorKey: ck, total };
    });
  }, [skillTree, childrenOf, points]);

  const radarMax = useMemo(() => Math.max(10, ...radarCategories.map(c => c.total)), [radarCategories]);

  // ── Ancestor path (breadcrumb) ────────────────────────────────────────────
  const ancestorPath = useMemo(() => {
    const path: NodeDatum[] = []; let current = focusedId;
    while (true) {
      const parentEdge = edges.find(e => e.childId === current); if (!parentEdge) break;
      const parent = nodeMap.get(parentEdge.parentId); if (!parent) break;
      path.unshift(parent); current = parent.id;
    }
    return path;
  }, [edges, nodeMap, focusedId]);

  const focusedNode = nodeMap.get(focusedId);

  // ── Zoom & drag-to-pan ────────────────────────────────────────────────────
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ active: false, moved: false, lastX: 0, lastY: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const zoomRef = useRef(zoom);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  useEffect(() => {
    const el = svgContainerRef.current; if (!el) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); const f = e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR; setZoom(z => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z * f))); };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragRef.current = { active: true, moved: false, lastX: e.clientX, lastY: e.clientY };
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.lastX;
    const dy = e.clientY - dragRef.current.lastY;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) dragRef.current.moved = true;
    const rect = svgContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = VW / rect.width;
    setPanX(x => x + dx * ratio / zoomRef.current);
    setPanY(y => y + dy * ratio / zoomRef.current);
  }, []);

  const handleMouseUp = useCallback(() => {
    dragRef.current.active = false;
    setIsDragging(false);
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleNodeClick = useCallback((node: NodeDatum) => {
    if (dragRef.current.moved) return;
    setFocusedId(node.id);
    setPanX(VW / 2 - node.x);
    setPanY(VH / 2 - node.y);
  }, []);

  const handleChangePoints = useCallback(async (nodeId: string, delta: 1 | -1) => {
    const current = points[nodeId] ?? 0;
    const next = Math.min(MAX_SKILL_POINTS, Math.max(0, current + delta));
    if (next === current) return;
    setLoadingPoints(true);
    try {
      const updated = await skillPointsApi.update(nodeId, next);
      setPoints(updated);
      if (delta === 1) {
        setGlowingId(nodeId);
        setTimeout(() => setGlowingId(null), 1100);
      }
    } catch (err) { console.error(err); }
    finally { setLoadingPoints(false); }
  }, [points]);

  // ── Stars display ─────────────────────────────────────────────────────────
  const renderStars = (n: number) => Array.from({ length: MAX_SKILL_POINTS }, (_, i) => (
    <Box key={i} component="span" sx={{ fontSize: '1.3rem', lineHeight: 1, color: i < n ? '#e2b714' : '#334155' }}>
      {i < n ? '★' : '☆'}
    </Box>
  ));

  const currentPoints = focusedNode ? (points[focusedNode.id] ?? 0) : 0;
  const focusedIsLocked = focusedNode ? isLocked(focusedNode.id) : false;
  const focusedCanAllocate = focusedNode ? canAllocate(focusedNode.id) : false;
  const focusedParentLabel = focusedNode ? (nodeMap.get(parentMap.get(focusedNode.id) ?? '')?.label ?? '') : '';
  const focusedColor = focusedNode ? (focusedNode.color ?? PALETTE[focusedNode.colorKey].stroke) : '#94a3b8';

  return (
    <Box sx={{ px: { xs: 2, md: 3 }, pt: 3, pb: 4 }}>
      {/* Page title */}
      <Typography variant="h3" gutterBottom>{t('userSkills.title')}</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        {t('userSkills.hint')}
      </Typography>

      {/* Main layout */}
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: { xs: 'wrap', lg: 'nowrap' } }}>

        {/* ── Left: SVG tree ────────────────────────────────────────────── */}
        <Box sx={{ flex: '1 1 55%', minWidth: 0 }}>
          {/* Breadcrumb */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, flexWrap: 'wrap', minHeight: 24 }}>
            {ancestorPath.map(ancestor => (
              <Box key={ancestor.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="caption"
                  onClick={() => { const n = nodeMap.get(ancestor.id); if (n) handleNodeClick(n); }}
                  sx={{ cursor: 'pointer', color: 'text.secondary', '&:hover': { color: ancestor.color ?? PALETTE[ancestor.colorKey].stroke, textDecoration: 'underline' } }}>
                  {ancestor.label}
                </Typography>
                <Typography variant="caption" color="text.disabled">/</Typography>
              </Box>
            ))}
            {focusedNode && (
              <Typography variant="caption" sx={{ color: focusedColor, fontWeight: 700 }}>
                {focusedNode.label}
              </Typography>
            )}
          </Box>

          {/* SVG */}
          <Box ref={svgContainerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider', bgcolor: TREE_BG, cursor: isDragging ? 'grabbing' : 'grab' }}>
            <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
              <rect width={VW} height={VH} fill={TREE_BG} />
              <g transform={`translate(${VW / 2}, ${VH / 2}) scale(${zoom}) translate(${-VW / 2}, ${-VH / 2})`}>
                <g style={{ transform: `translate(${panX}px, ${panY}px)`, transition: isDragging ? 'none' : 'transform 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94)' }}>
                  {/* Edges */}
                  {edges.map((e, i) => {
                    const { stroke } = PALETTE[e.colorKey];
                    const toChild  = e.parentId === focusedId;
                    const toParent = e.childId  === focusedId;
                    const locked   = isLocked(e.childId);
                    const glowing  = glowingId !== null && (e.childId === glowingId || e.parentId === glowingId);
                    const sw      = glowing ? 3 : toChild ? 2 : toParent ? 1.2 : 0.8;
                    const opacity = locked ? 0.07 : glowing ? 1 : toChild ? 0.75 : toParent ? 0.35 : 0.15;
                    return (
                      <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                        stroke={stroke} strokeWidth={sw} strokeOpacity={opacity}
                        className={glowing ? 'edge-glow' : undefined}
                        style={{ transition: 'stroke-opacity 0.35s ease, stroke-width 0.35s ease' }}
                      />
                    );
                  })}
                  {/* Nodes */}
                  {nodes.map(n => (
                    <UserSkillNodeEl key={n.id} node={n}
                      isFocused={n.id === focusedId}
                      isChild={childrenIds.has(n.id)}
                      isLocked={isLocked(n.id)}
                      isGlowing={n.id === glowingId}
                      points={points[n.id] ?? 0}
                      onClick={() => handleNodeClick(n)}
                    />
                  ))}
                </g>
              </g>
              <style>{`
                @keyframes skill-pulse { 0%,100%{opacity:.3;transform:scale(1)} 50%{opacity:0;transform:scale(1.55)} }
                .skill-pulse { transform-box:fill-box; transform-origin:center; animation:skill-pulse 2.8s ease-in-out infinite }
                @keyframes glow-ring { 0%{opacity:.9;transform:scale(1)} 100%{opacity:0;transform:scale(2.4)} }
                .skill-glow-ring { transform-box:fill-box; transform-origin:center; animation:glow-ring 1s ease-out forwards }
                @keyframes edge-glow { 0%{stroke-opacity:1} 100%{stroke-opacity:.3} }
                .edge-glow { animation:edge-glow 1.1s ease-out forwards }
              `}</style>
            </svg>
          </Box>

          {/* Legend */}
          <Box sx={{ display: 'flex', gap: 2, mt: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            {(skillTree?.root.children ?? []).map(cat => {
              const ck = (CAT_KEYS[cat.id] ?? 'default') as PKey;
              const color = PALETTE[ck].stroke;
              const active = focusedId === cat.id || childrenIds.has(cat.id);
              return (
                <Box key={cat.id} onClick={() => { const n = nodeMap.get(cat.id); if (n) handleNodeClick(n); }}
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.75, cursor: 'pointer', opacity: active ? 1 : 0.55, transition: 'opacity 0.3s', '&:hover': { opacity: 1 } }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color }} />
                  <Typography variant="caption" sx={{ color, fontWeight: 600, fontSize: '0.7rem', letterSpacing: 0.5 }}>{cat.label}</Typography>
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* ── Right: info card + radar ───────────────────────────────────── */}
        <Box sx={{ flex: '0 0 320px', width: 320, display: 'flex', flexDirection: 'column', gap: 2 }}>

          {/* Info card */}
          <Box sx={{ bgcolor: 'var(--background-raised-grey)', borderRadius: 1.5, p: 2.5, boxShadow: 'var(--raised-shadow)' }}>

            {/* Category dot + breadcrumb label */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: focusedColor, flexShrink: 0 }} />
              <Typography variant="caption" color="text.secondary" noWrap>
                {ancestorPath.map(a => a.label).join(' › ')}
                {ancestorPath.length > 0 ? ' › ' : ''}
                {focusedNode?.label ?? '—'}
              </Typography>
            </Box>

            {/* Node name */}
            <Typography variant="h5" sx={{ fontWeight: 700, color: focusedColor, mb: 0.5 }}>
              {focusedNode?.label ?? '—'}
            </Typography>

            {/* Description */}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 40, fontStyle: focusedNode?.description ? 'normal' : 'italic' }}>
              {focusedNode?.description ?? t('userSkills.noDescription')}
            </Typography>

            <Divider sx={{ mb: 2 }} />

            {/* Lock status */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              {focusedNode?.depth === 0 ? (
                <Chip icon={<LockOpenIcon fontSize="small" />} label={t('userSkills.rootNode')} size="small" sx={{ bgcolor: '#1e2229', color: '#94a3b8' }} />
              ) : focusedIsLocked ? (
                <Tooltip title={`${t('userSkills.lockReason')}: ${focusedParentLabel}`}>
                  <Chip icon={<LockIcon fontSize="small" />} label={t('userSkills.locked')} size="small" color="error" variant="outlined" />
                </Tooltip>
              ) : (
                <Chip icon={<LockOpenIcon fontSize="small" />} label={t('userSkills.unlocked')} size="small" color="success" variant="outlined" />
              )}
            </Box>

            {/* Stars */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5 }}>
              {renderStars(currentPoints)}
              <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                {currentPoints} / {MAX_SKILL_POINTS}
              </Typography>
            </Box>

            {/* Add / Remove buttons */}
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Tooltip title={currentPoints <= 0 ? '' : t('userSkills.removePoint')}>
                <Box component="span">
                  <Box
                    component="button"
                    onClick={() => handleChangePoints(focusedId, -1)}
                    disabled={!focusedCanAllocate || currentPoints <= 0 || loadingPoints}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.75,
                      border: '1px solid', borderRadius: 1, cursor: 'pointer',
                      bgcolor: 'transparent', borderColor: 'divider', color: 'text.secondary',
                      transition: 'all 0.2s',
                      '&:not(:disabled):hover': { borderColor: '#ef4444', color: '#ef4444' },
                      '&:disabled': { opacity: 0.35, cursor: 'not-allowed' },
                    }}
                  >
                    <RemoveCircleOutlineIcon fontSize="small" />
                    <Typography variant="caption" sx={{ fontWeight: 600, userSelect: 'none' }}>
                      {t('userSkills.remove')}
                    </Typography>
                  </Box>
                </Box>
              </Tooltip>

              <Tooltip title={currentPoints >= MAX_SKILL_POINTS ? t('userSkills.maxReached') : !focusedCanAllocate && !focusedIsLocked ? t('userSkills.rootNode') : focusedIsLocked ? `${t('userSkills.lockReason')}: ${focusedParentLabel}` : t('userSkills.addPoint')}>
                <Box component="span">
                  <Box
                    component="button"
                    onClick={() => handleChangePoints(focusedId, 1)}
                    disabled={!focusedCanAllocate || currentPoints >= MAX_SKILL_POINTS || loadingPoints}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.75,
                      border: '1px solid', borderRadius: 1, cursor: 'pointer',
                      bgcolor: 'transparent', borderColor: focusedColor, color: focusedColor,
                      transition: 'all 0.2s',
                      '&:not(:disabled):hover': { bgcolor: `${focusedColor}18` },
                      '&:disabled': { opacity: 0.35, cursor: 'not-allowed' },
                    }}
                  >
                    {loadingPoints
                      ? <CircularProgress size={14} sx={{ color: focusedColor }} />
                      : <AddCircleOutlineIcon fontSize="small" />
                    }
                    <Typography variant="caption" sx={{ fontWeight: 600, userSelect: 'none' }}>
                      {t('userSkills.add')}
                    </Typography>
                  </Box>
                </Box>
              </Tooltip>
            </Box>

            {/* Locked reason hint */}
            {focusedIsLocked && (
              <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1.5 }}>
                🔒 {t('userSkills.lockReason')}: <strong>{focusedParentLabel}</strong>
              </Typography>
            )}
          </Box>

          {/* Radar chart card */}
          <Box sx={{ bgcolor: 'var(--background-raised-grey)', borderRadius: 1.5, p: 2.5, boxShadow: 'var(--raised-shadow)' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>{t('userSkills.radarTitle')}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              {t('userSkills.radarHint')}
            </Typography>
            <Box sx={{ bgcolor: TREE_BG, borderRadius: 1.5, p: 1.5 }}>
              <RadarChart categories={radarCategories} maxVal={radarMax} />
            </Box>
            {/* Legend */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
              {radarCategories.map(cat => {
                const catColor = nodeMap.get(cat.id)?.color ?? PALETTE[cat.colorKey].stroke;
                return (
                <Box key={cat.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: catColor }} />
                  <Typography variant="caption" sx={{ color: catColor, fontSize: '0.68rem', fontWeight: 600 }}>
                    {cat.label} ({cat.total})
                  </Typography>
                </Box>
              );})}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
