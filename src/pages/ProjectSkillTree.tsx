import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Box, Typography, Chip, Divider, CircularProgress, Tooltip } from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import LockIcon from '@mui/icons-material/Lock';
import { useTranslation } from 'react-i18next';
import { skillTreeApi, projectsApi } from '../api';
import type { SkillTreeDoc, SkillTreeNode, Project } from '../types';

// ── Palette (mirrors Skills.tsx / UserSkills.tsx) ────────────────────────────
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
const BASE_R: Record<number, number> = { 0: 50, 1: 40, 2: 31, 3: 22 };
const FOCUS_SCALE = 1.5;
const VW = 800; const VH = 600;

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

// ── Physics ───────────────────────────────────────────────────────────────────
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

// ── Outer rings ──────────────────────────────────────────────────────────────
// Solid ring = required; dashed ring = available (parent is required, so this can be added)
function RequiredRing({ r, stroke }: { r: number; stroke: string }) {
  return <circle r={r} fill="none" stroke={stroke} strokeWidth={2.5} opacity={0.9} />;
}

function AvailableRing({ r, stroke }: { r: number; stroke: string }) {
  const circ = 2 * Math.PI * r;
  return (
    <circle r={r} fill="none" stroke={stroke} strokeWidth={1.8} opacity={0.55}
      strokeDasharray={`${circ * 0.12} ${circ * 0.08}`} />
  );
}

// ── Skill node (project variant) ──────────────────────────────────────────────
interface ProjectSkillNodeElProps {
  node: NodeDatum;
  isFocused: boolean;
  isChild: boolean;
  isRequired: boolean;
  isAvailable: boolean; // parent is required → can be added
  isLocked: boolean;    // parent is NOT required → cannot add yet
  onClick: () => void;
}

function ProjectSkillNodeEl({ node, isFocused, isChild, isRequired, isAvailable, isLocked, onClick }: ProjectSkillNodeElProps) {
  const [hovered, setHovered] = useState(false);
  const base = PALETTE[node.colorKey];
  const stroke = node.color ?? base.stroke;
  const fill   = base.fill;
  const text   = node.color ?? base.text;
  const r = BASE_R[node.depth] ?? 22;
  const lines = wrapText(node.label);
  const fs = [12, 11, 9.5, 8.5][node.depth] ?? 8.5;
  const isRoot = node.depth === 0;
  const scale = isFocused ? FOCUS_SCALE : isChild ? 1.08 : hovered ? 1.1 : 1;
  const sw = isFocused ? 2.5 : isRequired ? 2 : isChild ? 1.8 : hovered ? 1.5 : 1;
  // root and actively relevant nodes stay at full opacity; locked are ghosted
  const opacity = isLocked ? 0.2 : isRoot || isFocused || isChild || isRequired || isAvailable ? 1 : 0.4;

  return (
    <g
      transform={`translate(${node.x}, ${node.y})`}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ cursor: isLocked ? 'not-allowed' : 'pointer', opacity, transition: 'opacity 0.3s ease' }}
    >
      {/* Focused pulse ring */}
      {isFocused && <circle r={r * 1.7} fill="none" stroke={stroke} strokeWidth={1} opacity={0.35} className="skill-pulse" />}

      {/* Scale group */}
      <g style={{ transformBox: 'fill-box', transformOrigin: 'center', transform: `scale(${scale})`, transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
        <circle r={r} fill={fill} stroke={stroke} strokeWidth={sw} style={{ transition: 'stroke-width 0.2s ease' }} />

        {/* Solid ring = required; dashed ring = available to add */}
        {node.depth > 0 && isRequired && <RequiredRing r={r + 5} stroke={stroke} />}
        {node.depth > 0 && isAvailable && !isRequired && <AvailableRing r={r + 5} stroke={stroke} />}

        {/* Label */}
        {lines.map((line, i) => (
          <text key={i} textAnchor="middle" dominantBaseline="middle"
            fontSize={fs} fontWeight={isFocused || isRoot ? 700 : isChild || isRequired ? 600 : 500}
            fill={isFocused || isRoot || isRequired ? text : isChild || isAvailable ? text : '#9aa8b8'}
            y={(i - (lines.length - 1) / 2) * (fs + 2.5)}
            style={{ userSelect: 'none', pointerEvents: 'none' }}>
            {line}
          </text>
        ))}
      </g>
    </g>
  );
}

// ── Layout cache (separate from manager + user skill pages) ──────────────────
const projectLayoutCache = new Map<string, ConvergedLayout>();

// ── Component ─────────────────────────────────────────────────────────────────
interface ProjectSkillTreeProps {
  project: Project;
  onUpdate: (updated: Project) => void;
  isManager: boolean;
}

export default function ProjectSkillTree({ project, onUpdate, isManager }: ProjectSkillTreeProps) {
  const { t } = useTranslation();

  // ── State ─────────────────────────────────────────────────────────────────
  const [skillTree, setSkillTree] = useState<SkillTreeDoc | null>(null);
  const [required, setRequired] = useState<Set<string>>(() => new Set(project.requiredSkills ?? []));
  const [saving, setSaving] = useState(false);

  // Physics
  const simRef   = useRef<{ nodes: SimNode[]; edges: SimEdge[]; iter: number } | null>(null);
  const frameRef = useRef<number>(0);

  // View state
  const [zoom, setZoom]           = useState(1);
  const [panX, setPanX]           = useState(VW / 2);
  const [panY, setPanY]           = useState(VH / 2);
  const [focusedId, setFocusedId] = useState<string>('root');
  const [nodes, setNodes]         = useState<NodeDatum[]>([]);
  const [edges, setEdges]         = useState<EdgeDatum[]>([]);

  const viewStateRef = useRef({ zoom, panX, panY, focusedId });
  useEffect(() => {
    viewStateRef.current = { zoom, panX, panY, focusedId };
    if (!skillTree) return;
    const cacheKey = `${skillTree.treeId}-${project.id}`;
    const entry = projectLayoutCache.get(cacheKey);
    if (entry) projectLayoutCache.set(cacheKey, { ...entry, zoom, panX, panY, focusedId });
  }, [zoom, panX, panY, focusedId, skillTree, project.id]);

  // Sync required skills when project prop changes (e.g. after save from another source)
  useEffect(() => {
    setRequired(new Set(project.requiredSkills ?? []));
  }, [project.requiredSkills]);

  // ── Load tree ─────────────────────────────────────────────────────────────
  useEffect(() => {
    skillTreeApi.get().then(setSkillTree).catch(console.error);
  }, []);

  // ── Spring simulation ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!skillTree) return;
    cancelAnimationFrame(frameRef.current);
    const cacheKey = `${skillTree.treeId}-${project.id}`;
    const cached = projectLayoutCache.get(cacheKey);
    if (cached) {
      setNodes(cached.nodes); setEdges(cached.edges);
      setZoom(cached.zoom); setPanX(cached.panX); setPanY(cached.panY); setFocusedId(cached.focusedId);
      return;
    }
    const { simNodes, simEdges } = flattenTree(skillTree.root);
    simRef.current = { nodes: simNodes, edges: simEdges, iter: 0 };
    const getViewState = viewStateRef;

    function snapshot(sn: SimNode[], se: SimEdge[]): ConvergedLayout {
      const m = new Map(sn.map(nd => [nd.id, nd]));
      const vs = getViewState.current;
      const layoutNodes = sn.map(({ id, label, description, x, y, depth, colorKey, color }) => ({ id, label, description, x, y, depth, colorKey, color }));
      const layoutEdges = se.map(ed => {
        const src = m.get(ed.s)!, tgt = m.get(ed.t)!;
        return { x1: src.x, y1: src.y, x2: tgt.x, y2: tgt.y, colorKey: ed.colorKey, parentId: ed.s, childId: ed.t };
      });
      return { nodes: layoutNodes, edges: layoutEdges, zoom: vs.zoom, panX: vs.panX, panY: vs.panY, focusedId: vs.focusedId };
    }

    function animate() {
      const sim = simRef.current; if (!sim) return;
      if (sim.iter >= MAX_ITERS) { projectLayoutCache.set(cacheKey, snapshot(sim.nodes, sim.edges)); return; }
      const alpha = Math.max(0.02, 1 - sim.iter / MAX_ITERS);
      const prev = sim.nodes;
      for (let s = 0; s < STEPS_PER_FRAME; s++) { sim.nodes = tickPhysics(sim.nodes, sim.edges, alpha); sim.iter++; }
      const layout = snapshot(sim.nodes, sim.edges);
      setNodes(layout.nodes); setEdges(layout.edges);
      if (meanDisplacement(prev, sim.nodes) < CONVERGENCE_THRESHOLD) { projectLayoutCache.set(cacheKey, layout); return; }
      frameRef.current = requestAnimationFrame(animate);
    }

    const init = snapshot(simNodes, simEdges);
    setNodes(init.nodes); setEdges(init.edges);
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [skillTree, project.id]);

  // ── Derived maps ──────────────────────────────────────────────────────────
  const nodeMap    = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);
  const parentMap  = useMemo(() => { const m = new Map<string, string>(); edges.forEach(e => m.set(e.childId, e.parentId)); return m; }, [edges]);
  const childrenOf = useMemo(() => {
    const m = new Map<string, Set<string>>();
    edges.forEach(e => { if (!m.has(e.parentId)) m.set(e.parentId, new Set()); m.get(e.parentId)!.add(e.childId); });
    return m;
  }, [edges]);

  const childrenIds = useMemo(() => childrenOf.get(focusedId) ?? new Set<string>(), [childrenOf, focusedId]);

  /** A depth-2+ node is locked if its direct parent has NOT been required.
   * Depth-0 (root) and depth-1 (categories) are always available.
   */
  const isLocked = useCallback((nodeId: string): boolean => {
    const node = nodeMap.get(nodeId);
    if (!node || node.depth <= 1) return false;
    const pid = parentMap.get(nodeId);
    return !pid || !required.has(pid);
  }, [nodeMap, parentMap, required]);

  /** Collect a node and all its descendants */
  const collectSubtree = useCallback((nodeId: string): string[] => {
    const result: string[] = [nodeId];
    const queue = [nodeId];
    while (queue.length) {
      const cur = queue.shift()!;
      (childrenOf.get(cur) ?? new Set()).forEach(child => { result.push(child); queue.push(child); });
    }
    return result;
  }, [childrenOf]);

  // ── Ancestor path ─────────────────────────────────────────────────────────
  const ancestorPath = useMemo(() => {
    const path: NodeDatum[] = []; let current = focusedId;
    while (true) {
      const parentEdge = edges.find(e => e.childId === current); if (!parentEdge) break;
      const parent = nodeMap.get(parentEdge.parentId); if (!parent) break;
      path.unshift(parent); current = parent.id;
    }
    return path;
  }, [edges, nodeMap, focusedId]);

  const focusedNode         = nodeMap.get(focusedId);
  const focusedColor        = focusedNode ? PALETTE[focusedNode.colorKey].stroke : '#94a3b8';
  const focusedIsRequired   = required.has(focusedId);
  const focusedIsLocked     = focusedNode ? isLocked(focusedId) : false;
  const focusedParentLabel  = focusedNode ? (nodeMap.get(parentMap.get(focusedId) ?? '')?.label ?? '') : '';

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

  const handleToggleRequired = useCallback(async () => {
    if (!focusedNode || focusedNode.depth === 0) return;
    const next = new Set(required);
    if (next.has(focusedId)) {
      // Un-requiring: also remove all descendants so no child can remain required
      // without its ancestor
      collectSubtree(focusedId).forEach(id => next.delete(id));
    } else {
      next.add(focusedId);
    }
    setRequired(next);
    setSaving(true);
    try {
      const updated = await projectsApi.update({ ...project, requiredSkills: Array.from(next) });
      onUpdate(updated);
    } catch (err) {
      console.error(err);
      setRequired(required); // rollback
    } finally {
      setSaving(false);
    }
  }, [focusedId, focusedNode, required, project, onUpdate, collectSubtree]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: { xs: 'wrap', lg: 'nowrap' } }}>

      {/* ── Left: SVG tree ───────────────────────────────────────────────── */}
      <Box sx={{ flex: '1 1 55%', minWidth: 0 }}>
        {/* Breadcrumb */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, flexWrap: 'wrap', minHeight: 24 }}>
          {ancestorPath.map(ancestor => (
            <Box key={ancestor.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="caption"
                onClick={() => { const n = nodeMap.get(ancestor.id); if (n) handleNodeClick(n); }}
                sx={{ cursor: 'pointer', color: 'text.secondary', '&:hover': { color: PALETTE[ancestor.colorKey].stroke, textDecoration: 'underline' } }}>
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

        {/* SVG canvas */}
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
                  const toChild   = e.parentId === focusedId;
                  const toParent  = e.childId  === focusedId;
                  const childReq  = required.has(e.childId);
                  const childAvail = !childReq && !isLocked(e.childId);
                  const childLocked = isLocked(e.childId);
                  const sw      = toChild ? 2 : toParent ? 1.2 : childReq ? 1.6 : 0.8;
                  const opacity  = childLocked ? 0.05 : toChild ? 0.75 : toParent ? 0.35 : childReq ? 0.55 : childAvail ? 0.3 : 0.12;
                  return (
                    <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                      stroke={stroke} strokeWidth={sw} strokeOpacity={opacity}
                      style={{ transition: 'stroke-opacity 0.35s ease, stroke-width 0.35s ease' }}
                    />
                  );
                })}
                {/* Nodes */}
                {nodes.map(n => (
                  <ProjectSkillNodeEl key={n.id} node={n}
                    isFocused={n.id === focusedId}
                    isChild={childrenIds.has(n.id)}
                    isRequired={required.has(n.id)}
                    isAvailable={!required.has(n.id) && !isLocked(n.id) && n.depth > 0}
                    isLocked={isLocked(n.id)}
                    onClick={() => handleNodeClick(n)}
                  />
                ))}
              </g>
            </g>
            <style>{`
              @keyframes skill-pulse { 0%,100%{opacity:.3;transform:scale(1)} 50%{opacity:0;transform:scale(1.55)} }
              .skill-pulse { transform-box:fill-box; transform-origin:center; animation:skill-pulse 2.8s ease-in-out infinite }
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

      {/* ── Right: info card ─────────────────────────────────────────────── */}
      <Box sx={{ flex: '0 0 280px', width: 280, display: 'flex', flexDirection: 'column', gap: 2 }}>

        {/* Node info card */}
        <Box sx={{ bgcolor: 'var(--background-raised-grey)', borderRadius: 1.5, p: 2.5, boxShadow: 'var(--raised-shadow)' }}>
          {/* Color dot + breadcrumb */}
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
            {focusedNode?.description ?? t('projectSkillTree.noDescription')}
          </Typography>

          <Divider sx={{ mb: 2 }} />

          {/* Required status badge */}
          <Box sx={{ mb: 2 }}>
            {focusedNode?.depth === 0 ? (
              <Chip label={t('projectSkillTree.rootNode')} size="small" sx={{ bgcolor: '#1e2229', color: '#94a3b8' }} />
            ) : focusedIsLocked ? (
              <Chip
                icon={<LockIcon sx={{ fontSize: '0.85rem !important' }} />}
                label={t('projectSkillTree.locked')}
                size="small"
                color="error"
                variant="outlined"
              />
            ) : focusedIsRequired ? (
              <Chip
                label={t('projectSkillTree.required')}
                size="small"
                variant="outlined"
                sx={{ borderColor: focusedColor, color: focusedColor }}
              />
            ) : (
              <Chip
                label={t('projectSkillTree.available')}
                size="small"
                variant="outlined"
                sx={{ borderColor: focusedColor, color: focusedColor, opacity: 0.7,
                  borderStyle: 'dashed' }}
              />
            )}
          </Box>

          {/* Lock reason hint */}
          {focusedIsLocked && focusedParentLabel && (
            <Typography variant="caption" color="error" sx={{ display: 'block', mb: 2 }}>
              🔒 {t('projectSkillTree.lockReason', { parent: focusedParentLabel })}
            </Typography>
          )}

          {/* Add / Remove button (manager only, non-locked, non-root nodes) */}
          {isManager && !!focusedNode && focusedNode.depth > 0 && (
            <Tooltip title={focusedIsLocked ? t('projectSkillTree.lockReason', { parent: focusedParentLabel }) : ''}>
              <Box component="span">
                <Box
                  component="button"
                  onClick={handleToggleRequired}
                  disabled={saving || focusedIsLocked}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.75,
                    border: '1px solid', borderRadius: 1, cursor: 'pointer',
                    bgcolor: 'transparent',
                    borderColor: focusedIsRequired ? 'divider' : focusedIsLocked ? 'divider' : focusedColor,
                    color: focusedIsRequired ? 'text.secondary' : focusedIsLocked ? 'text.disabled' : focusedColor,
                    transition: 'all 0.2s',
                    '&:not(:disabled):hover': focusedIsRequired
                      ? { borderColor: '#ef4444', color: '#ef4444' }
                      : { bgcolor: `${focusedColor}18` },
                    '&:disabled': { opacity: 0.35, cursor: 'not-allowed' },
                  }}
                >
                  {saving
                    ? <CircularProgress size={14} sx={{ color: focusedIsRequired ? 'text.secondary' : focusedColor }} />
                    : focusedIsRequired
                      ? <RemoveCircleOutlineIcon fontSize="small" />
                      : <AddCircleOutlineIcon fontSize="small" />
                  }
                  <Typography variant="caption" sx={{ fontWeight: 600, userSelect: 'none' }}>
                    {focusedIsRequired ? t('projectSkillTree.remove') : t('projectSkillTree.add')}
                  </Typography>
                </Box>
              </Box>
            </Tooltip>
          )}
        </Box>

        {/* Required skills summary */}
        {required.size > 0 && (
          <Box sx={{ bgcolor: 'var(--background-raised-grey)', borderRadius: 1.5, p: 2, boxShadow: 'var(--raised-shadow)' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
              {t('projectSkillTree.summaryTitle')} ({required.size})
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {Array.from(required).map(id => {
                const n = nodeMap.get(id);
                if (!n) return null;
                const color = PALETTE[n.colorKey].stroke;
                return (
                  <Chip
                    key={id}
                    label={n.label}
                    size="small"
                    variant="outlined"
                    onClick={() => handleNodeClick(n)}
                    sx={{ borderColor: color, color, cursor: 'pointer', fontSize: '0.7rem' }}
                  />
                );
              })}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
