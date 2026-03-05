import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Container,
  Typography,
  Box,
  IconButton,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Select,
  MenuItem,
  SelectChangeEvent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import { useTranslation } from 'react-i18next';
import { teamMembersApi, skillMatrixApi, skillTreeApi } from '../api';
import { MaturityLevel, SkillCell, SkillTreeDoc, SkillTreeNode, TeamMember } from '../types';

// ── Flat Anthracite Palette ──────────────────────────────────────────────────
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

const TREE_BG = '#1e2229';

// ── Viewport & node sizes ───────────────────────────────────────────────────
const BASE_R: Record<number, number> = { 0: 50, 1: 40, 2: 31, 3: 22 };
const FOCUS_SCALE = 1.5;
const VW = 800;
const VH = 600;

// ── Spring-layout physics ────────────────────────────────────────────────────
const REPULSION_K     = 5500;  // node-node repulsion (Coulomb)
const SPRING_K        = 0.055; // spring stiffness (Hooke)
const DAMPING         = 0.82;  // velocity damping per tick
const STEPS_PER_FRAME = 2;     // physics steps per animation frame (×60 fps ≈ 120 steps/s)
const MAX_ITERS       = 3600;  // 3600 / (2 × 60 fps) ≈ 30 s of animation
const CONVERGENCE_THRESHOLD = 0.08; // px mean node displacement per frame — stop early below this

// ── Zoom limits ──────────────────────────────────────────────────────────────
const ZOOM_MIN = 0.18; // ~full-graph overview
const ZOOM_MAX = 1.0;  // default viewport (no zoom change)
const ZOOM_FACTOR = 1.12; // per scroll notch (symmetric: ×1.12 / ÷1.12)

function springLen(sourceDepth: number): number {
  return sourceDepth === 0 ? 165 : sourceDepth === 1 ? 115 : 78;
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface NodeDatum {
  id: string; label: string;
  x: number; y: number;
  depth: number; colorKey: PKey;
}
interface EdgeDatum {
  x1: number; y1: number; x2: number; y2: number;
  colorKey: PKey; parentId: string; childId: string;
}
/** Mutable physics node — lives in a ref, never stored directly in React state */
interface SimNode extends NodeDatum {
  vx: number; vy: number;
  pinned: boolean;
}
interface SimEdge {
  s: string; t: string;
  srcDepth: number; // depth of source node → picks natural spring length
  colorKey: PKey;
}

// ── Flatten tree → initial sim state (radial seed positions) ────────────────
function flattenTree(root: SkillTreeNode): { simNodes: SimNode[]; simEdges: SimEdge[] } {
  const simNodes: SimNode[] = [];
  const simEdges: SimEdge[] = [];
  const INIT_R = [0, 195, 340, 450];

  function walk(
    node: SkillTreeNode, parentId: string | null,
    depth: number, colorKey: PKey, angle: number,
  ) {
    const ck: PKey =
      depth === 0 ? 'root'
      : depth === 1 ? ((CAT_KEYS[node.id] ?? 'default') as PKey)
      : colorKey;
    const r = INIT_R[Math.min(depth, INIT_R.length - 1)];
    // Small random jitter breaks symmetry so spring forces can act
    const jitter = depth > 0 ? (Math.random() - 0.5) * 14 : 0;
    simNodes.push({
      id: node.id, label: node.label,
      x: r * Math.cos(angle) + jitter,
      y: r * Math.sin(angle) + jitter,
      vx: 0, vy: 0, depth, colorKey: ck, pinned: depth === 0,
    });
    if (parentId !== null)
      simEdges.push({ s: parentId, t: node.id, srcDepth: depth - 1, colorKey: ck });

    const children = node.children ?? [];
    if (!children.length) return;

    if (depth === 0) {
      // Root: fan children evenly around the circle
      children.forEach((child, i) => {
        walk(child, node.id, 1, 'root', (2 * Math.PI * i) / children.length - Math.PI / 2);
      });
    } else {
      // Deeper levels: fan within a cone pointing away from parent
      const fanHalf = depth === 1 ? Math.PI * 0.38 : Math.PI * 0.28;
      children.forEach((child, i) => {
        const childAngle = children.length === 1
          ? angle
          : angle - fanHalf + (i * 2 * fanHalf) / (children.length - 1);
        walk(child, node.id, depth + 1, ck, childAngle);
      });
    }
  }

  walk(root, null, 0, 'root', 0);
  return { simNodes, simEdges };
}

// ── One spring-physics tick ──────────────────────────────────────────────────
function tickPhysics(nodes: SimNode[], edges: SimEdge[], alpha: number): SimNode[] {
  const next = nodes.map(n => ({ ...n }));
  const byId = new Map(next.map(n => [n.id, n]));

  // 1. Repulsion between every pair of nodes (Coulomb)
  for (let i = 0; i < next.length; i++) {
    for (let j = i + 1; j < next.length; j++) {
      const a = next[i], b = next[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist2 = dx * dx + dy * dy || 1;
      const inv   = 1 / Math.sqrt(dist2);
      const f  = (REPULSION_K * alpha) / dist2;
      const fx = f * dx * inv, fy = f * dy * inv;
      if (!a.pinned) { a.vx -= fx; a.vy -= fy; }
      if (!b.pinned) { b.vx += fx; b.vy += fy; }
    }
  }

  // 2. Spring attraction along edges (Hooke)
  for (const e of edges) {
    const a = byId.get(e.s), b = byId.get(e.t);
    if (!a || !b) continue;
    const dx = b.x - a.x, dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const f    = SPRING_K * (dist - springLen(e.srcDepth)) * alpha;
    const fx = f * dx / dist, fy = f * dy / dist;
    if (!a.pinned) { a.vx += fx; a.vy += fy; }
    if (!b.pinned) { b.vx -= fx; b.vy -= fy; }
  }

  // 3. Integrate: damp velocities, then move
  for (const n of next) {
    if (n.pinned) continue;
    n.vx *= DAMPING; n.vy *= DAMPING;
    n.x  += n.vx;   n.y  += n.vy;
  }

  return next;
}

// ── Convergence metric ──────────────────────────────────────────────────────────────
/** Mean Euclidean displacement of non-pinned nodes between two states. */
function meanDisplacement(before: SimNode[], after: SimNode[]): number {
  let sum = 0, count = 0;
  for (let i = 0; i < before.length; i++) {
    if (before[i].pinned) continue;
    const dx = after[i].x - before[i].x;
    const dy = after[i].y - before[i].y;
    sum += Math.sqrt(dx * dx + dy * dy);
    count++;
  }
  return count > 0 ? sum / count : 0;
}
function wrapText(text: string, maxChars = 10): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const cand = cur ? `${cur} ${w}` : w;
    if (cand.length > maxChars && cur) { lines.push(cur); cur = w; }
    else cur = cand;
  }
  if (cur) lines.push(cur);
  return lines;
}

// ── Skill node SVG element ────────────────────────────────────────────────────
interface SkillNodeElProps {
  node: NodeDatum; isFocused: boolean; isChild: boolean;
  onClick: () => void; label: string;
}

function SkillNodeEl({ node, isFocused, isChild, onClick, label }: SkillNodeElProps) {
  const [hovered, setHovered] = useState(false);
  const { stroke, fill, text } = PALETTE[node.colorKey];
  const r  = BASE_R[node.depth] ?? 22;
  const lines = wrapText(label);
  const fs = [12, 11, 9.5, 8.5][node.depth] ?? 8.5;
  const scale = isFocused ? FOCUS_SCALE : isChild ? 1.08 : hovered ? 1.1 : 1;
  const sw = isFocused ? 2.5 : isChild ? 2 : hovered ? 1.5 : 1;

  return (
    <g
      transform={`translate(${node.x}, ${node.y})`}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ cursor: 'pointer' }}
    >
      {/* Pulsing ring (focused only) */}
      {isFocused && (
        <circle r={r * 1.7} fill="none" stroke={stroke} strokeWidth={1}
          opacity={0.35} className="skill-pulse" />
      )}

      {/* Scale group */}
      <g style={{
        transformBox: 'fill-box', transformOrigin: 'center',
        transform: `scale(${scale})`,
        transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>
        {/* Body — flat fill, colored border */}
        <circle r={r} fill={fill} stroke={stroke}
          strokeWidth={sw}
          style={{ transition: 'stroke-width 0.2s ease' }} />
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
// ── Module-level layout cache ───────────────────────────────────────────────────────
/**
 * Keyed by treeId. Populated when the simulation finishes.
 * Survives tab changes (component unmount/remount) so the layout is
 * never recomputed for the same tree.
 */
interface ConvergedLayout {
  nodes: NodeDatum[];
  edges: EdgeDatum[];
  // View state — persisted so tab switches restore exactly where the user was
  zoom: number;
  panX: number;
  panY: number;
  focusedId: string;
}
const layoutCache = new Map<string, ConvergedLayout>();
// ── main page ────────────────────────────────────────────────────────────────
export default function Skills() {
  const { t } = useTranslation();

  // ── skill tree state ────────────────────────────────────────────────────
  const [skillTree, setSkillTree] = useState<SkillTreeDoc | null>(null);

  // Physics simulation lives in refs — mutable, no re-render on each tick
  const simRef   = useRef<{ nodes: SimNode[]; edges: SimEdge[]; iter: number } | null>(null);
  const frameRef = useRef<number>(0);

  // View state — declared here so the simulation effect can read & restore them
  const [zoom,      setZoom]      = useState(1);
  const [panX,      setPanX]      = useState(VW / 2);
  const [panY,      setPanY]      = useState(VH / 2);
  const [focusedId, setFocusedId] = useState<string>('root');

  // A ref that always holds the latest view-state values so the
  // simulation's snapshot() can read them without a stale closure.
  const viewStateRef = useRef({ zoom, panX, panY, focusedId });
  useEffect(() => {
    viewStateRef.current = { zoom, panX, panY, focusedId };
    // Also keep the in-progress (or already-converged) cache entry up to date
    if (!skillTree) return;
    const entry = layoutCache.get(skillTree.treeId);
    if (entry) layoutCache.set(skillTree.treeId, { ...entry, zoom, panX, panY, focusedId });
  }, [zoom, panX, panY, focusedId, skillTree]);

  // Rendered snapshot — set once per animation frame to trigger a React repaint
  const [nodes, setNodes] = useState<NodeDatum[]>([]);
  const [edges, setEdges] = useState<EdgeDatum[]>([]);

  // Start / restart simulation whenever the tree is (re)loaded
  useEffect(() => {
    if (!skillTree) return;
    cancelAnimationFrame(frameRef.current);

    // Use the cached converged layout if available — skip simulation entirely
    const cached = layoutCache.get(skillTree.treeId);
    if (cached) {
      setNodes(cached.nodes);
      setEdges(cached.edges);
      setZoom(cached.zoom);
      setPanX(cached.panX);
      setPanY(cached.panY);
      setFocusedId(cached.focusedId);
      return;
    }

    const treeId = skillTree.treeId;
    const { simNodes, simEdges } = flattenTree(skillTree.root);
    simRef.current = { nodes: simNodes, edges: simEdges, iter: 0 };

    // Capture a getter so snapshot always reads the live React state values
    // (zoom / panX / panY / focusedId) without needing them in the dep array.
    const getViewState = viewStateRef;

    function snapshot(sn: SimNode[], se: SimEdge[]): ConvergedLayout {
      const m = new Map(sn.map(n => [n.id, n]));
      const vs = getViewState.current;
      const nodes = sn.map(({ id, label, x, y, depth, colorKey }) => ({ id, label, x, y, depth, colorKey }));
      const edges = se.map(e => {
        const src = m.get(e.s)!, tgt = m.get(e.t)!;
        return { x1: src.x, y1: src.y, x2: tgt.x, y2: tgt.y,
          colorKey: e.colorKey, parentId: e.s, childId: e.t };
      });
      return { nodes, edges, zoom: vs.zoom, panX: vs.panX, panY: vs.panY, focusedId: vs.focusedId };
    }

    function animate() {
      const sim = simRef.current;
      if (!sim) return;
      if (sim.iter >= MAX_ITERS) {
        // Time limit reached — persist converged layout
        layoutCache.set(treeId, snapshot(sim.nodes, sim.edges));
        return;
      }
      const alpha = Math.max(0.02, 1 - sim.iter / MAX_ITERS);
      const prevNodes = sim.nodes; // capture positions before this frame's steps
      for (let step = 0; step < STEPS_PER_FRAME; step++) {
        sim.nodes = tickPhysics(sim.nodes, sim.edges, alpha);
        sim.iter++;
      }
      const layout = snapshot(sim.nodes, sim.edges);
      setNodes(layout.nodes);
      setEdges(layout.edges);
      // Check convergence: stop early if nodes have barely moved
      if (meanDisplacement(prevNodes, sim.nodes) < CONVERGENCE_THRESHOLD) {
        layoutCache.set(treeId, layout);
        return;
      }
      frameRef.current = requestAnimationFrame(animate);
    }

    const initial = snapshot(simNodes, simEdges);
    setNodes(initial.nodes);
    setEdges(initial.edges);
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [skillTree]);

  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  // ── Zoom & drag-to-pan ────────────────────────────────────────────────
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ active: false, moved: false, lastX: 0, lastY: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const zoomRef = useRef(zoom);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  useEffect(() => {
    const el = svgContainerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
      setZoom(z => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z * factor)));
    };
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

  const handleNodeClick = useCallback((node: NodeDatum) => {
    if (dragRef.current.moved) return;
    setFocusedId(node.id);
    setPanX(VW / 2 - node.x);
    setPanY(VH / 2 - node.y);
  }, []);

  // Direct children of focused node
  const childrenIds = useMemo(() => {
    const s = new Set<string>();
    edges.forEach(e => { if (e.parentId === focusedId) s.add(e.childId); });
    return s;
  }, [edges, focusedId]);

  // Ancestor path from root → direct parent (for breadcrumbs)
  const ancestorPath = useMemo(() => {
    const path: NodeDatum[] = [];
    let current = focusedId;
    while (true) {
      const parentEdge = edges.find(e => e.childId === current);
      if (!parentEdge) break;
      const parent = nodeMap.get(parentEdge.parentId);
      if (!parent) break;
      path.unshift(parent);
      current = parent.id;
    }
    return path; // root first
  }, [edges, nodeMap, focusedId]);

  // ── matrix state ────────────────────────────────────────────────────────
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [skillCells, setSkillCells] = useState<SkillCell[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      teamMembersApi.getAll(),
      skillMatrixApi.getAll(),
      skillTreeApi.get(),
    ]).then(([members, cells, tree]) => {
      setTeamMembers(members);
      setSkillCells(cells);
      setSkillTree(tree);
    }).catch(console.error);
  }, []);

  // Focused node (needed by matrixSkills and the breadcrumb display)
  const focusedNode = nodeMap.get(focusedId);

  // Columns = focused node's children, or just the focused node itself if it's a leaf
  const matrixSkills = useMemo(() => {
    if (childrenIds.size === 0) return focusedNode ? [focusedNode] : [];
    return nodes.filter(n => childrenIds.has(n.id));
  }, [nodes, childrenIds, focusedNode]);

  const getSkillLevel = (teamMemberId: string, skillId: string): MaturityLevel | null =>
    skillCells.find(c => c.teamMemberId === teamMemberId && c.skillId === skillId)?.maturityLevel ?? null;

  const handleSkillChange = (
    teamMemberId: string,
    skillId: string,
    event: SelectChangeEvent<MaturityLevel | ''>
  ) => {
    const value = event.target.value as MaturityLevel | '';
    setSkillCells(prev => {
      const idx = prev.findIndex(c => c.teamMemberId === teamMemberId && c.skillId === skillId);
      if (value === '') {
        skillMatrixApi.remove(teamMemberId, skillId).catch(console.error);
        return prev.filter((_, i) => i !== idx);
      }
      skillMatrixApi.upsert(teamMemberId, skillId, value).catch(console.error);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { teamMemberId, skillId, maturityLevel: value };
        return next;
      }
      return [...prev, { teamMemberId, skillId, maturityLevel: value }];
    });
  };

  const maturityLevels: MaturityLevel[] = ['M1', 'M2', 'M3', 'M4'];

  const getMaturityColor = (level: MaturityLevel | null): string => {
    if (!level) return 'transparent';
    return { M1: '#ef4444', M2: '#f97316', M3: '#eab308', M4: '#22c55e' }[level];
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 0.5 }}>
        <Typography variant="h3">{t('skills.title')}</Typography>
      </Box>

      {/* Breadcrumbs */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, flexWrap: 'wrap', minHeight: 24 }}>
        {ancestorPath.map((ancestor) => {
          const color = PALETTE[ancestor.colorKey].stroke;
          return (
            <Box key={ancestor.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography
                variant="caption"
                onClick={() => { const n = nodeMap.get(ancestor.id); if (n) handleNodeClick(n); }}
                sx={{ cursor: 'pointer', color: 'text.secondary', transition: 'color 0.2s', '&:hover': { color, textDecoration: 'underline' } }}
              >
                {ancestor.label}
              </Typography>
              <Typography variant="caption" color="text.disabled">/</Typography>
            </Box>
          );
        })}
        {focusedNode && (
          <Typography variant="caption" sx={{
            color: PALETTE[focusedNode.colorKey].stroke,
            fontWeight: 700,
          }}>
            {focusedNode.label}
          </Typography>
        )}
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        {t('skills.hint')}
      </Typography>

      {/* SVG tree */}
      <Box ref={svgContainerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        sx={{
          width: '100%',
          borderRadius: 2,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: TREE_BG,
          cursor: isDragging ? 'grabbing' : 'grab',
        }}>
        <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          {/* ── Background ── */}
          <rect width={VW} height={VH} fill={TREE_BG}/>

          {/* ── Zoom group (scroll wheel) — scales around viewport centre ── */}
          <g transform={`translate(${VW / 2}, ${VH / 2}) scale(${zoom}) translate(${-VW / 2}, ${-VH / 2})`}>
          {/* ── Pan group (animates on node click) ── */}
          <g style={{
            transform: `translate(${panX}px, ${panY}px)`,
            transition: isDragging ? 'none' : 'transform 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          }}>
            {/* Edges */}
            {edges.map((e, i) => {
              const { stroke } = PALETTE[e.colorKey];
              const toChild  = e.parentId === focusedId;
              const toParent = e.childId  === focusedId;
              const sw      = toChild ? 2 : toParent ? 1.2 : 0.8;
              const opacity = toChild ? 0.75 : toParent ? 0.35 : 0.15;
              return (
                <line key={i}
                  x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                  stroke={stroke}
                  strokeWidth={sw}
                  strokeOpacity={opacity}
                  style={{ transition: 'stroke-opacity 0.35s ease, stroke-width 0.35s ease' }}
                />
              );
            })}

            {/* Nodes */}
            {nodes.map(n => (
              <SkillNodeEl key={n.id} node={n}
                isFocused={n.id === focusedId}
                isChild={childrenIds.has(n.id)}
                onClick={() => handleNodeClick(n)}
                label={n.label}
              />
            ))}
          </g>          {/* ── / Pan group ── */}
          </g>
          {/* ── / Zoom group ── */}
          {/* CSS animations */}
          <style>{`
            @keyframes skill-pulse {
              0%, 100% { opacity: 0.3; transform: scale(1); }
              50%       { opacity: 0;   transform: scale(1.55); }
            }
            .skill-pulse {
              transform-box: fill-box;
              transform-origin: center;
              animation: skill-pulse 2.8s ease-in-out infinite;
            }
          `}</style>
        </svg>
      </Box>

      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 2, mt: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        {(skillTree?.root.children ?? []).map(cat => {
          const ck = (CAT_KEYS[cat.id] ?? 'default') as PKey;
          const color = PALETTE[ck].stroke;
          const isFocusedCat = focusedId === cat.id || childrenIds.has(cat.id);
          return (
            <Box key={cat.id}
              onClick={() => { const n = nodeMap.get(cat.id); if (n) handleNodeClick(n); }}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.75, cursor: 'pointer',
                opacity: isFocusedCat ? 1 : 0.55,
                transition: 'opacity 0.3s ease',
                '&:hover': { opacity: 1 } }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color }}/>
              <Typography variant="caption" sx={{ color, fontWeight: 600, fontSize: '0.7rem', letterSpacing: 0.5 }}>
                {cat.label}
              </Typography>
            </Box>
          );
        })}
      </Box>

      {/* ── Maturity Matrix section ─────────────────────────────────────── */}
      <Divider sx={{ my: 5 }} />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <Typography variant="h4">{t('matrix.title')}</Typography>
        <IconButton color="primary" onClick={() => setModalOpen(true)} aria-label="info" size="large">
          <InfoIcon />
        </IconButton>
      </Box>
      <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
        {t('matrix.description')}
      </Typography>
      {focusedNode && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 3 }}>
          <Typography variant="body2" color="text.secondary">{t('matrix.showing')}</Typography>
          {ancestorPath.map(a => (
            <Box key={a.id} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="body2" color="text.disabled">{a.label}</Typography>
              <Typography variant="body2" color="text.disabled">/</Typography>
            </Box>
          ))}
          <Typography variant="body2"
            sx={{ fontWeight: 700, color: PALETTE[focusedNode.colorKey].stroke }}>
            {focusedNode.label}
          </Typography>
        </Box>
      )}

      {/* Skill/Will modal */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>{t('matrix.modalTitle')}</DialogTitle>
        <DialogContent sx={{ py: 1 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Box sx={{ position: 'relative', width: 'calc(100% - 100px)', height: 280, border: '2px solid #000', mb: 2, ml: 10 }}>
              <Box sx={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1px', bgcolor: '#ccc' }} />
              <Box sx={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', bgcolor: '#ccc' }} />
              {[
                { pos: { left: 0, bottom: 0 }, color: '#ef4444', label: 'M1' },
                { pos: { left: 0, top: 0 }, color: '#f97316', label: 'M2' },
                { pos: { right: 0, bottom: 0 }, color: '#eab308', label: 'M3' },
                { pos: { right: 0, top: 0 }, color: '#22c55e', label: 'M4' },
              ].map(({ pos, color, label }) => (
                <Box key={label} sx={{ position: 'absolute', width: '50%', height: '50%', bgcolor: `${color}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${color}`, ...pos }}>
                  <Typography variant="h6" color={color} fontWeight="bold">{label}</Typography>
                </Box>
              ))}
              <Typography sx={{ position: 'absolute', bottom: -28, left: '50%', transform: 'translateX(-50%)', fontWeight: 'bold', fontSize: '0.9rem' }}>
                {t('matrix.skill')} →
              </Typography>
              <Typography sx={{ position: 'absolute', left: -88, top: '50%', transform: 'translateY(-50%) rotate(-90deg)', fontWeight: 'bold', whiteSpace: 'nowrap', width: 100, textAlign: 'center', fontSize: '0.9rem' }}>
                {t('matrix.will')} →
              </Typography>
              <Typography variant="caption" sx={{ position: 'absolute', left: 5, bottom: 5, fontSize: '0.7rem' }}>{t('matrix.low')}</Typography>
              <Typography variant="caption" sx={{ position: 'absolute', right: 5, top: 5, fontSize: '0.7rem' }}>{t('matrix.high')}</Typography>
            </Box>
            <Typography variant="body2" paragraph sx={{ mb: 1.5, mt: 2, textAlign: 'center', px: 2 }}>
              {t('matrix.modalExplanation')}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%', px: 2 }}>
              {[
                { color: '#ef4444', label: 'matrix.m1Label', desc: 'matrix.m1Description' },
                { color: '#f97316', label: 'matrix.m2Label', desc: 'matrix.m2Description' },
                { color: '#eab308', label: 'matrix.m3Label', desc: 'matrix.m3Description' },
                { color: '#22c55e', label: 'matrix.m4Label', desc: 'matrix.m4Description' },
              ].map(({ color, label, desc }) => (
                <Box key={label}>
                  <Typography variant="subtitle2" color={color} fontWeight="bold" sx={{ fontSize: '0.85rem' }}>{t(label)}</Typography>
                  <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>{t(desc)}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ pt: 1 }}>
          <Button onClick={() => setModalOpen(false)} color="primary">{t('matrix.close')}</Button>
        </DialogActions>
      </Dialog>

      {/* Matrix table */}
      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', minWidth: 150 }}>{t('matrix.teamMember')}</TableCell>
              {matrixSkills.map((skill) => (
                <TableCell key={skill.id} align="center"
                  sx={{ fontWeight: 'bold', minWidth: 120, color: PALETTE[skill.colorKey].stroke }}>
                  {skill.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {teamMembers.map((member) => (
              <TableRow key={member.id}>
                <TableCell component="th" scope="row">
                  <Box>
                    <Typography variant="body1" fontWeight="medium">{member.name}</Typography>
                    <Typography variant="caption" color="textSecondary">{member.position}</Typography>
                  </Box>
                </TableCell>
                {matrixSkills.map((skill) => (
                  <TableCell
                    key={skill.id}
                    align="center"
                    sx={{ bgcolor: getMaturityColor(getSkillLevel(member.id, skill.id)), transition: 'background-color 0.3s ease' }}
                  >
                    <Select
                      value={getSkillLevel(member.id, skill.id) ?? ''}
                      onChange={(e) => handleSkillChange(member.id, skill.id, e)}
                      displayEmpty
                      size="small"
                      sx={{ minWidth: 80, '& .MuiSelect-select': { color: getSkillLevel(member.id, skill.id) ? '#fff' : 'inherit', fontWeight: 'bold' } }}
                    >
                      <MenuItem value=""><em>{t('matrix.none')}</em></MenuItem>
                      {maturityLevels.map((level) => (
                        <MenuItem key={level} value={level}>{level}</MenuItem>
                      ))}
                    </Select>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
}
