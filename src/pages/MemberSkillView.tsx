/**
 * MemberSkillView — read-only skill tree for a team member (manager view).
 *
 * Replicates the UserSkills graph experience without any editing capabilities:
 * no unlock button, no star rating. Shows the member's current points as a
 * purely visual overlay.
 */
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, CircularProgress, Chip } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { SearchBar } from '@codegouvfr/react-dsfr/SearchBar';
import { useTranslation } from 'react-i18next';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { skillTreeApi, skillPointsApi, teamMembersApi } from '../api';
import type { SkillTreeDoc, SkillTreeNode, TeamMember } from '../types';

// ── Palette ───────────────────────────────────────────────────────────────────
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

const REPULSION_K = 5500; const SPRING_K = 0.055;
const DAMPING = 0.82; const STEPS_PER_FRAME = 2;
const MAX_ITERS = 3600; const CONVERGENCE_THRESHOLD = 0.08;
const ZOOM_MIN = 0.18; const ZOOM_MAX = 1.0; const ZOOM_FACTOR = 1.12;

function springLen(d: number) { return d === 0 ? 165 : d === 1 ? 115 : 78; }

// ── Types ─────────────────────────────────────────────────────────────────────
interface NodeDatum { id: string; label: string; description?: string; x: number; y: number; depth: number; colorKey: PKey; color?: string; }
interface EdgeDatum { x1: number; y1: number; x2: number; y2: number; colorKey: PKey; color?: string; parentId: string; childId: string; }
interface SimNode extends NodeDatum { vx: number; vy: number; pinned: boolean; }
interface SimEdge { s: string; t: string; srcDepth: number; colorKey: PKey; }
interface ConvergedLayout { nodes: NodeDatum[]; edges: EdgeDatum[]; zoom: number; panX: number; panY: number; focusedId: string; }

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

// ── Read-only skill node ──────────────────────────────────────────────────────
function ViewSkillNodeEl({ node, isFocused, isChild, isUnlocked, displayScore, onClick }:
  { node: NodeDatum; isFocused: boolean; isChild: boolean; isUnlocked: boolean; displayScore: number; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const base = PALETTE[node.colorKey];
  const stroke = node.color ?? base.stroke;
  const fill   = base.fill;
  const text   = node.color ?? base.text;
  const r = BASE_R[node.depth] ?? 22;
  const lines = wrapText(node.label);
  const fs = [12, 11, 9.5, 8.5][node.depth] ?? 8.5;
  const scale = isFocused ? FOCUS_SCALE : isChild ? 1.08 : hovered ? 1.1 : 1;
  const sw = isFocused ? 2.5 : isUnlocked ? 2 : isChild ? 1.8 : hovered ? 1.5 : 1;

  return (
    <g transform={`translate(${node.x}, ${node.y})`} onClick={onClick}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ cursor: 'pointer', opacity: isUnlocked ? 1 : 0.38, transition: 'opacity 0.35s ease' }}>
      {isFocused && <circle r={r * 1.7} fill="none" stroke={stroke} strokeWidth={1} opacity={0.35} className="skill-pulse" />}
      <g style={{ transformBox: 'fill-box', transformOrigin: 'center', transform: `scale(${scale})`, transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
        <circle r={r} fill={fill} stroke={stroke} strokeWidth={sw} style={{ transition: 'stroke-width 0.2s ease' }} />
        {node.depth > 0 && isUnlocked && <PointsArc r={r + 5} points={displayScore} stroke={stroke} />}
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

// ── Radar ─────────────────────────────────────────────────────────────────────
interface RadarCat { id: string; label: string; colorKey: PKey; color?: string; total: number; }

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
      {Array.from({ length: levels }, (_, lv) => {
        const r = (R * (lv + 1)) / levels;
        const poly = angles.map(a => `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`).join(' ');
        return <polygon key={lv} points={poly} fill="none" stroke="#2d3748" strokeWidth={0.8} />;
      })}
      {angles.map((a, i) => <line key={i} x1={cx} y1={cy} x2={cx + R * Math.cos(a)} y2={cy + R * Math.sin(a)} stroke="#2d3748" strokeWidth={0.8} />)}
      {categories.map((cat, i) => {
        const j = (i + 1) % n;
        const stroke = cat.color ?? PALETTE[cat.colorKey].stroke;
        const fill = cat.color ? cat.color + '28' : PALETTE[cat.colorKey].fill;
        return <polygon key={cat.id} points={`${cx},${cy} ${pts[i].x},${pts[i].y} ${pts[j].x},${pts[j].y}`} fill={fill} fillOpacity={0.85} stroke={stroke} strokeWidth={0.6} />;
      })}
      {categories.map((cat, i) => <circle key={cat.id} cx={pts[i].x} cy={pts[i].y} r={4} fill={cat.color ?? PALETTE[cat.colorKey].stroke} />)}
      {categories.map((cat, i) => {
        const a = angles[i]; const lr = R + 20;
        return <text key={cat.id} x={cx + lr * Math.cos(a)} y={cy + lr * Math.sin(a)} textAnchor="middle" dominantBaseline="middle" fontSize={8.5} fill={cat.color ?? PALETTE[cat.colorKey].stroke} fontWeight={600} style={{ userSelect: 'none' }}>{cat.label}</text>;
      })}
      <circle cx={cx} cy={cy} r={2.5} fill="#4a5568" />
    </svg>
  );
}

// ── Per-page layout cache (keyed by treeId) ───────────────────────────────────
const viewLayoutCache = new Map<string, ConvergedLayout>();

// ── Page ──────────────────────────────────────────────────────────────────────
export default function MemberSkillView() {
  const { memberId } = useParams<{ memberId: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [member, setMember]     = useState<TeamMember | null>(null);
  const [skillTree, setSkillTree] = useState<SkillTreeDoc | null>(null);
  const [points, setPoints]     = useState<Record<string, number>>({});
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  // Physics
  const simRef   = useRef<{ nodes: SimNode[]; edges: SimEdge[]; iter: number } | null>(null);
  const frameRef = useRef<number>(0);

  // View
  const [zoom, setZoom]           = useState(1);
  const [panX, setPanX]           = useState(VW / 2);
  const [panY, setPanY]           = useState(VH / 2);
  const [focusedId, setFocusedId] = useState<string>('root');
  const [nodes, setNodes]         = useState<NodeDatum[]>([]);
  const [edges, setEdges]         = useState<EdgeDatum[]>([]);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen]   = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // ── Load member + tree + points ───────────────────────────────────────────
  useEffect(() => {
    if (!memberId) return;
    setLoading(true);
    Promise.all([
      teamMembersApi.getAll(),
      skillTreeApi.get(),
    ]).then(async ([members, tree]) => {
      const m = members.find(x => x.id === memberId) ?? null;
      setMember(m);
      setSkillTree(tree);
      if (m?.linkedUserId) {
        try {
          const pts = await skillPointsApi.getForUser(m.linkedUserId);
          setPoints(pts);
        } catch { setPoints({}); }
      }
    }).catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [memberId]);

  // ── Localized tree ────────────────────────────────────────────────────────
  const localizedSkillTree = useMemo(() => {
    if (!skillTree) return null;
    const lang = i18n.language;
    function resolve(node: SkillTreeNode): SkillTreeNode {
      return {
        ...node,
        label:       node.labels?.[lang]       ?? node.label,
        description: node.descriptions?.[lang] ?? node.description,
        children:    node.children?.map(resolve),
      };
    }
    return { ...skillTree, root: resolve(skillTree.root) };
  }, [skillTree, i18n.language]);

  // ── Spring simulation ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!localizedSkillTree) return;
    cancelAnimationFrame(frameRef.current);

    const freshById = new Map<string, SkillTreeNode>();
    (function collect(n: SkillTreeNode) {
      freshById.set(n.id, n);
      (n.children ?? []).forEach(collect);
    })(localizedSkillTree.root);

    const cacheKey = `${localizedSkillTree.treeId}`;
    const cached = viewLayoutCache.get(cacheKey);
    if (cached) {
      const freshNodes = cached.nodes.map(n => {
        const f = freshById.get(n.id);
        return f ? { ...n, label: f.label, description: f.description, color: f.color } : n;
      });
      viewLayoutCache.set(cacheKey, { ...cached, nodes: freshNodes });
      setNodes(freshNodes); setEdges(cached.edges);
      setZoom(cached.zoom); setPanX(cached.panX); setPanY(cached.panY); setFocusedId(cached.focusedId);
      return;
    }

    const treeId = localizedSkillTree.treeId;
    const { simNodes, simEdges } = flattenTree(localizedSkillTree.root);
    simRef.current = { nodes: simNodes, edges: simEdges, iter: 0 };
    const vsRef = { current: { zoom: 1, panX: VW / 2, panY: VH / 2, focusedId: 'root' } };

    function snapshot(sn: SimNode[], se: SimEdge[]): ConvergedLayout {
      const m = new Map(sn.map(n => [n.id, n]));
      const vs = vsRef.current;
      const nodes = sn.map(({ id, label, description, x, y, depth, colorKey, color }) => ({ id, label, description, x, y, depth, colorKey, color }));
      const edges = se.map(e => {
        const src = m.get(e.s)!, tgt = m.get(e.t)!;
        return { x1: src.x, y1: src.y, x2: tgt.x, y2: tgt.y, colorKey: e.colorKey, color: tgt.color, parentId: e.s, childId: e.t };
      });
      return { nodes, edges, zoom: vs.zoom, panX: vs.panX, panY: vs.panY, focusedId: vs.focusedId };
    }

    function animate() {
      const sim = simRef.current; if (!sim) return;
      if (sim.iter >= MAX_ITERS) { viewLayoutCache.set(treeId, snapshot(sim.nodes, sim.edges)); return; }
      const alpha = Math.max(0.02, 1 - sim.iter / MAX_ITERS);
      const prev = sim.nodes;
      for (let s = 0; s < STEPS_PER_FRAME; s++) { sim.nodes = tickPhysics(sim.nodes, sim.edges, alpha); sim.iter++; }
      const layout = snapshot(sim.nodes, sim.edges);
      setNodes(layout.nodes); setEdges(layout.edges);
      if (meanDisplacement(prev, sim.nodes) < CONVERGENCE_THRESHOLD) { viewLayoutCache.set(treeId, layout); return; }
      frameRef.current = requestAnimationFrame(animate);
    }

    const init = snapshot(simNodes, simEdges);
    setNodes(init.nodes); setEdges(init.edges);
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [localizedSkillTree]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const nodeMap     = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);
  const childrenOf  = useMemo(() => {
    const m = new Map<string, Set<string>>();
    edges.forEach(e => { if (!m.has(e.parentId)) m.set(e.parentId, new Set()); m.get(e.parentId)!.add(e.childId); });
    return m;
  }, [edges]);
  const childrenIds = useMemo(() => childrenOf.get(focusedId) ?? new Set<string>(), [childrenOf, focusedId]);

  const leafIds = useMemo(() => {
    const s = new Set<string>();
    nodes.forEach(n => { const kids = childrenOf.get(n.id); if (!kids || kids.size === 0) s.add(n.id); });
    return s;
  }, [nodes, childrenOf]);

  const isUnlocked = useCallback((id: string) => (points[id] ?? 0) > 0, [points]);

  const effectiveScores = useMemo<Record<string, number>>(() => {
    const cache: Record<string, number> = {};
    function compute(id: string): number {
      if (id in cache) return cache[id];
      const kids = [...(childrenOf.get(id) ?? [])];
      if (kids.length === 0) { cache[id] = points[id] ?? 0; return cache[id]; }
      const unlockedKids = kids.filter(kid => (points[kid] ?? 0) > 0);
      const unlockFraction = unlockedKids.length / kids.length;
      const meanGrade = unlockedKids.length > 0 ? unlockedKids.reduce((sum, kid) => sum + compute(kid), 0) / unlockedKids.length : 0;
      cache[id] = (unlockFraction * 5 + meanGrade) / 2;
      return cache[id];
    }
    nodes.forEach(n => compute(n.id));
    return cache;
  }, [nodes, childrenOf, points]);

  const radarCategories = useMemo<RadarCat[]>(() => {
    if (!localizedSkillTree) return [];
    return (localizedSkillTree.root.children ?? []).map(cat => {
      const ck = (CAT_KEYS[cat.id] ?? 'default') as PKey;
      const color = nodeMap.get(cat.id)?.color;
      return { id: cat.id, label: cat.label, colorKey: ck, color, total: effectiveScores[cat.id] ?? 0 };
    });
  }, [localizedSkillTree, effectiveScores, nodeMap]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return nodes.filter(n => n.label.toLowerCase().includes(q) || (n.description ?? '').toLowerCase().includes(q)).slice(0, 8);
  }, [nodes, searchQuery]);

  const searchMatchIds = useMemo(() => new Set(searchResults.map(n => n.id)), [searchResults]);

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
  const focusedColor = focusedNode ? (focusedNode.color ?? PALETTE[focusedNode.colorKey].stroke) : '#94a3b8';
  const focusedIsLeaf = focusedNode ? leafIds.has(focusedNode.id) : false;
  const focusedIsUnlocked = focusedNode ? isUnlocked(focusedNode.id) : false;
  const currentScore = focusedNode ? (effectiveScores[focusedNode.id] ?? 0) : 0;

  const focusNode = useCallback((node: NodeDatum) => {
    const targetZoom = ([0.45, 0.65, 0.85, 1.0] as const)[Math.min(node.depth, 3)];
    setZoom(targetZoom); setFocusedId(node.id);
    setPanX(VW / 2 - node.x); setPanY(VH / 2 - node.y);
  }, []);

  const handleSearchSelect = useCallback((node: NodeDatum) => {
    focusNode(node); setSearchQuery(''); setSearchOpen(false);
  }, [focusNode]);

  // ── Zoom + drag-to-pan ────────────────────────────────────────────────────
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
  }, [loading]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragRef.current = { active: true, moved: false, lastX: e.clientX, lastY: e.clientY };
    setIsDragging(true);
  }, []);
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.lastX, dy = e.clientY - dragRef.current.lastY;
    dragRef.current.lastX = e.clientX; dragRef.current.lastY = e.clientY;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) dragRef.current.moved = true;
    const rect = svgContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = VW / rect.width;
    setPanX(x => x + dx * ratio / zoomRef.current);
    setPanY(y => y + dy * ratio / zoomRef.current);
  }, []);
  const handleMouseUp = useCallback(() => { dragRef.current.active = false; setIsDragging(false); }, []);

  const handleNodeClick = useCallback((node: NodeDatum) => {
    if (dragRef.current.moved) return;
    setFocusedId(node.id);
    setPanX(VW / 2 - node.x);
    setPanY(VH / 2 - node.y);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
  );
  if (error) return (
    <Box sx={{ p: 4 }}><Typography color="error">{error}</Typography></Box>
  );

  return (
    <Box sx={{ px: { xs: 2, md: 3 }, pt: 3, pb: 4 }}>
      {/* Back + title */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Button iconId="fr-icon-arrow-left-line" iconPosition="left" priority="tertiary no outline" onClick={() => navigate('/team')}>
          {t('team.title')}
        </Button>
        <Typography variant="h3">
          {member?.name ?? '—'}{' '}
          <Typography component="span" variant="h5" color="text.secondary">
            — {t('team.viewSkillTree')}
          </Typography>
        </Typography>
      </Box>

      {/* Read-only banner */}
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, mb: 2, px: 1.5, py: 0.5, borderRadius: 1, bgcolor: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.15)' }}>
        <Typography variant="caption" color="text.secondary">{t('team.viewOnlyBanner')}</Typography>
      </Box>

      {!member?.linkedUserId && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" fontStyle="italic">{t('team.noLinkedUser')}</Typography>
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: { xs: 'wrap', lg: 'nowrap' } }}>

        {/* ── Left: graph ──────────────────────────────────────────────── */}
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

          <Box sx={{ position: 'relative' }}>
            {/* Search overlay */}
            <Box ref={searchRef} sx={{ position: 'absolute', top: 8, right: 8, zIndex: 5, width: 220 }}>
              <Box sx={{
                '& .fr-search-bar': { gap: '4px' },
                '& .fr-label': { position: 'absolute', width: '1px', height: '1px', p: 0, m: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 },
                '& .fr-input': { height: '1.875rem !important', fontSize: '0.75rem !important', background: 'rgba(18,22,28,0.88) !important', backdropFilter: 'blur(6px)', color: '#e2e8f0 !important', border: '1px solid rgba(255,255,255,0.12) !important', boxShadow: 'none !important', '--idle': 'transparent', '--hover': 'transparent', '--active': 'transparent' },
                '& .fr-input::placeholder': { color: 'rgba(148,163,184,0.7) !important' },
                '& .fr-btn': { height: '1.875rem !important', minHeight: '0 !important', lineHeight: '1.875rem !important', fontSize: '0 !important', px: '0.5rem !important', ml: '4px !important', background: 'rgba(18,22,28,0.88) !important', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.12) !important', color: 'rgba(148,163,184,0.7) !important', '&::before': { fontSize: '0.875rem !important' } },
                '& .fr-btn:hover': { background: 'rgba(255,255,255,0.06) !important', color: '#e2e8f0 !important' },
              }}>
                <SearchBar label={t('userSkills.searchPlaceholder')}
                  renderInput={({ id, type, className, placeholder }) => (
                    <input id={id} type={type} className={className} placeholder={placeholder}
                      value={searchQuery}
                      onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                      onFocus={() => setSearchOpen(true)}
                      onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                      autoComplete="off" />
                  )}
                  onButtonClick={() => { if (searchResults.length > 0) handleSearchSelect(searchResults[0]); }}
                />
              </Box>
              {searchOpen && searchResults.length > 0 && (
                <Box sx={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, mt: 0.25, bgcolor: 'rgba(18,22,28,0.96)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 1, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
                  {searchResults.map(n => {
                    const color = n.color ?? PALETTE[n.colorKey].stroke;
                    return (
                      <Box key={n.id} onMouseDown={() => handleSearchSelect(n)} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.6, cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.06)', '&:last-child': { borderBottom: 'none' }, '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>
                        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="caption" sx={{ display: 'block', fontWeight: 600, color, fontSize: '0.7rem', lineHeight: 1.3 }}>{n.label}</Typography>
                          {n.description && <Typography variant="caption" sx={{ display: 'block', fontSize: '0.63rem', color: 'rgba(148,163,184,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2 }}>{n.description}</Typography>}
                        </Box>
                        {isUnlocked(n.id)
                          ? <LockOpenIcon sx={{ fontSize: '0.75rem', color: 'success.main', opacity: 0.7, flexShrink: 0 }} />
                          : <LockIcon sx={{ fontSize: '0.75rem', color: 'rgba(148,163,184,0.4)', flexShrink: 0 }} />}
                      </Box>
                    );
                  })}
                </Box>
              )}
              {searchOpen && searchQuery.trim() && searchResults.length === 0 && (
                <Box sx={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, mt: 0.25, bgcolor: 'rgba(18,22,28,0.96)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 1, px: 1.25, py: 0.75 }}>
                  <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'rgba(148,163,184,0.6)' }}>{t('userSkills.searchNoResults')}</Typography>
                </Box>
              )}
            </Box>

            {/* SVG */}
            <Box ref={svgContainerRef}
              onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
              sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider', bgcolor: TREE_BG, cursor: isDragging ? 'grabbing' : 'grab' }}>
              <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                <rect width={VW} height={VH} fill={TREE_BG} />
                <g style={{ transform: `translate(${zoom * (panX - VW / 2) + VW / 2}px, ${zoom * (panY - VH / 2) + VH / 2}px) scale(${zoom})`, transformOrigin: '0 0', transition: isDragging ? 'none' : 'transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)' }}>
                  {edges.map((e, i) => {
                    const stroke = e.color ?? PALETTE[e.colorKey].stroke;
                    const toChild = e.parentId === focusedId, toParent = e.childId === focusedId;
                    const childUnlocked = isUnlocked(e.childId), parentUnlocked = isUnlocked(e.parentId);
                    const fullyActive = childUnlocked && parentUnlocked, partiallyActive = !childUnlocked && parentUnlocked;
                    const score = effectiveScores[e.childId] ?? 0;
                    const sf = score / MAX_SKILL_POINTS;
                    const baseSw = fullyActive ? 0.8 + sf * 2.2 : partiallyActive ? 0.6 : 0.4;
                    const sw = toChild ? Math.max(baseSw, 2) : toParent ? Math.max(baseSw, 1.2) : baseSw;
                    const baseOpacity = fullyActive ? 0.2 + sf * 0.65 : partiallyActive ? 0.12 : 0.05;
                    const opacity = toChild ? Math.max(baseOpacity, 0.7) : toParent ? Math.max(baseOpacity, 0.3) : baseOpacity;
                    return <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke={stroke} strokeWidth={sw} strokeOpacity={opacity} style={{ transition: 'stroke-opacity 0.45s ease, stroke-width 0.45s ease' }} />;
                  })}
                  {nodes.map(n => (
                    <ViewSkillNodeEl key={n.id} node={n}
                      isFocused={n.id === focusedId} isChild={childrenIds.has(n.id)}
                      isUnlocked={isUnlocked(n.id)}
                      displayScore={leafIds.has(n.id) ? (points[n.id] ?? 0) : (effectiveScores[n.id] ?? 0)}
                      onClick={() => handleNodeClick(n)}
                    />
                  ))}
                  {/* Search match glow */}
                  {nodes.filter(n => searchMatchIds.has(n.id)).map(n => {
                    const stroke = n.color ?? PALETTE[n.colorKey].stroke;
                    const r = BASE_R[n.depth] ?? 22;
                    return <circle key={`glow-${n.id}`} cx={n.x} cy={n.y} r={r * 2.2} fill="none" stroke={stroke} strokeWidth={3} className="skill-glow-ring" />;
                  })}
                </g>
                <style>{`
                  @keyframes skill-pulse { 0%,100%{opacity:.3;transform:scale(1)} 50%{opacity:0;transform:scale(1.55)} }
                  .skill-pulse { transform-box:fill-box; transform-origin:center; animation:skill-pulse 2.8s ease-in-out infinite }
                  @keyframes glow-ring { 0%{opacity:.9;transform:scale(1)} 100%{opacity:0;transform:scale(2.4)} }
                  .skill-glow-ring { transform-box:fill-box; transform-origin:center; animation:glow-ring 1s ease-out forwards }
                `}</style>
              </svg>
            </Box>
          </Box>

          {/* Legend */}
          <Box sx={{ display: 'flex', gap: 2, mt: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            {(localizedSkillTree?.root.children ?? []).map(cat => {
              const ck = (CAT_KEYS[cat.id] ?? 'default') as PKey;
              const color = nodeMap.get(cat.id)?.color ?? PALETTE[ck].stroke;
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

        {/* ── Right: info + radar ───────────────────────────────────────── */}
        <Box sx={{ flex: '0 0 320px', width: 320, display: 'flex', flexDirection: 'column', gap: 2, position: { xs: 'relative', lg: 'sticky' }, top: { lg: 16 }, maxHeight: { lg: 'calc(100vh - 32px)' }, overflowY: { lg: 'auto' } }}>

          {/* Node info card */}
          <Box sx={{ bgcolor: 'var(--background-raised-grey)', borderRadius: 1.5, p: 2.5, boxShadow: 'var(--raised-shadow)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: focusedColor, flexShrink: 0 }} />
              <Typography variant="caption" color="text.secondary" noWrap>
                {ancestorPath.map(a => a.label).join(' › ')}{ancestorPath.length > 0 ? ' › ' : ''}{focusedNode?.label ?? '—'}
              </Typography>
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: focusedColor, mb: 0.5 }}>
              {focusedNode?.label ?? '—'}
            </Typography>
            {focusedNode?.description ? (
              <Box sx={{ maxHeight: 200, overflowY: 'auto', mb: 2 }}>
                <MarkdownRenderer sx={{ color: 'text.secondary' }}>
                  {focusedNode.description}
                </MarkdownRenderer>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 40, fontStyle: 'italic' }}>
                {t('userSkills.noDescription')}
              </Typography>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              {focusedIsUnlocked
                ? <Chip icon={<LockOpenIcon fontSize="small" />} label={t('userSkills.unlocked')} size="small" color="success" variant="outlined" />
                : <Chip icon={<LockIcon fontSize="small" />} label={t('userSkills.locked')} size="small" color="default" variant="outlined" />
              }
            </Box>

            {/* Score display — read-only */}
            {focusedIsUnlocked && focusedNode && focusedNode.depth > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  {focusedIsLeaf ? t('userSkills.yourRating') : t('userSkills.computedScore')}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5 }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: focusedColor }}>{currentScore.toFixed(focusedIsLeaf ? 0 : 1)}</Typography>
                  <Typography variant="caption" color="text.secondary">/ 5</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.25 }}>
                  {Array.from({ length: MAX_SKILL_POINTS }, (_, i) => (
                    <Box key={i} component="span" sx={{ fontSize: '1.3rem', lineHeight: 1, color: i < currentScore ? '#e2b714' : '#334155' }}>★</Box>
                  ))}
                </Box>
              </Box>
            )}
          </Box>

          {/* Radar card */}
          <Box sx={{ bgcolor: 'var(--background-raised-grey)', borderRadius: 1.5, p: 2.5, boxShadow: 'var(--raised-shadow)' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>{t('userSkills.radarTitle')}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>{t('userSkills.radarHint')}</Typography>
            <Box sx={{ bgcolor: TREE_BG, borderRadius: 1.5, p: 1.5 }}>
              <RadarChart categories={radarCategories} maxVal={5} />
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
              {radarCategories.map(cat => {
                const catColor = cat.color ?? PALETTE[cat.colorKey].stroke;
                return (
                  <Box key={cat.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: catColor }} />
                    <Typography variant="caption" sx={{ color: catColor, fontSize: '0.68rem', fontWeight: 600 }}>
                      {cat.label} ({cat.total.toFixed(1)})
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>

          {/* Unlocked leaves */}
          <Box sx={{ bgcolor: 'var(--background-raised-grey)', borderRadius: 1.5, p: 2.5, boxShadow: 'var(--raised-shadow)' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>{t('team.unlockedSkills')}</Typography>
            {(() => {
              const unlocked = nodes.filter(n => leafIds.has(n.id) && isUnlocked(n.id));
              if (unlocked.length === 0) return (
                <Typography variant="caption" color="text.secondary" fontStyle="italic">—</Typography>
              );
              return (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {unlocked.map(n => {
                    const color = n.color ?? PALETTE[n.colorKey].stroke;
                    const rating = points[n.id] ?? 0;
                    return (
                      <Box key={n.id}
                        onClick={() => handleNodeClick(n)}
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.4, borderRadius: 1, border: '1px solid', borderColor: color + '55', bgcolor: color + '12', cursor: 'pointer', '&:hover': { bgcolor: color + '22' }, transition: 'background 0.2s' }}>
                        <Typography variant="caption" sx={{ color, fontWeight: 600, fontSize: '0.7rem' }}>{n.label}</Typography>
                        {rating > 0 && (
                          <Box sx={{ display: 'flex', gap: '1px' }}>
                            {Array.from({ length: MAX_SKILL_POINTS }, (_, i) => (
                              <Box key={i} component="span" sx={{ fontSize: '0.6rem', lineHeight: 1, color: i < rating ? '#e2b714' : '#334155' }}>★</Box>
                            ))}
                          </Box>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              );
            })()}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
