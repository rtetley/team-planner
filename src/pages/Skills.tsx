import { useState, useCallback, useMemo } from 'react';
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
import { skillTreeRoot, SkillNode } from '../data/skillTree';
import { mockTeamMembers, mockTasks, mockTeamMatrix } from '../data/mockData';
import { MaturityLevel } from '../types';

// ── RPG Palette ──────────────────────────────────────────────────────────────
type PKey = 'root' | 'development' | 'research' | 'communication' | 'organisation' | 'default';

const PALETTE: Record<PKey, { stroke: string; fill: string }> = {
  root:          { stroke: '#fbbf24', fill: '#1a1100' },
  development:   { stroke: '#22d3ee', fill: '#001519' },
  research:      { stroke: '#b975f5', fill: '#0e0019' },
  communication: { stroke: '#fb923c', fill: '#1a0900' },
  organisation:  { stroke: '#34d399', fill: '#001510' },
  default:       { stroke: '#7c8fa6', fill: '#0f1520' },
};

const CAT_KEYS: Record<string, PKey> = {
  root: 'root', development: 'development', research: 'research',
  communication: 'communication', organisation: 'organisation',
};

const TREE_BG = '#060b18';

// ── Geometry ─────────────────────────────────────────────────────────────────
const D1 = 225;                    // root → category
const D2 = 162;                    // category → sub
const D3 = 108;                    // sub → leaf
const SPREAD_L2 = Math.PI * 0.65;  // sub angular spread
const SPREAD_L3 = Math.PI * 0.55;  // leaf angular spread
const BASE_R: Record<number, number> = { 0: 50, 1: 40, 2: 31, 3: 22 };
const FOCUS_SCALE = 1.5;
const VW = 800;
const VH = 600;

// ── Star field (deterministic) ───────────────────────────────────────────────
const STARS = Array.from({ length: 45 }, (_, i) => ({
  x: ((i * 127 + 23) % 770) + 15,
  y: ((i * 193 + 61) % 560) + 15,
  r: i % 5 === 0 ? 1.2 : i % 3 === 0 ? 0.7 : 0.35,
  opacity: 0.2 + (i % 4) * 0.08,
}));

// ── Types ─────────────────────────────────────────────────────────────────────
interface NodeDatum {
  id: string; labelKey: string;
  x: number; y: number;
  depth: number; colorKey: PKey;
}
interface EdgeDatum {
  x1: number; y1: number; x2: number; y2: number;
  colorKey: PKey; parentId: string; childId: string;
}

// ── Full-tree layout ──────────────────────────────────────────────────────────
function buildLayout(root: SkillNode): { nodes: NodeDatum[]; edges: EdgeDatum[] } {
  const nodes: NodeDatum[] = [];
  const edges: EdgeDatum[] = [];

  function walk(
    node: SkillNode, x: number, y: number, outAngle: number,
    depth: number, parentPos: { x: number; y: number } | null,
    parentId: string | null, colorKey: PKey,
  ) {
    nodes.push({ id: node.id, labelKey: node.labelKey, x, y, depth, colorKey });
    if (parentId !== null && parentPos !== null)
      edges.push({ x1: parentPos.x, y1: parentPos.y, x2: x, y2: y, colorKey, parentId, childId: node.id });

    const children = node.children ?? [];
    if (!children.length) return;
    const pos = { x, y };

    if (depth === 0) {
      children.forEach((child, i) => {
        const angle = (2 * Math.PI * i) / children.length - Math.PI / 2;
        const ck = (CAT_KEYS[child.id] ?? 'default') as PKey;
        walk(child, D1 * Math.cos(angle), D1 * Math.sin(angle), angle, 1, pos, node.id, ck);
      });
    } else {
      const spread = depth === 1 ? SPREAD_L2 : SPREAD_L3;
      const dist   = depth === 1 ? D2 : D3;
      children.forEach((child, i) => {
        const angle = children.length === 1
          ? outAngle
          : outAngle - spread / 2 + (i * spread) / (children.length - 1);
        walk(child, x + dist * Math.cos(angle), y + dist * Math.sin(angle),
          angle, depth + 1, pos, node.id, colorKey);
      });
    }
  }

  walk(root, 0, 0, -Math.PI / 2, 0, null, null, 'root');
  return { nodes, edges };
}

// ── Text wrap ─────────────────────────────────────────────────────────────────
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
  node: NodeDatum; isFocused: boolean; isConnected: boolean;
  onClick: () => void; label: string;
}

function SkillNodeEl({ node, isFocused, isConnected, onClick, label }: SkillNodeElProps) {
  const [hovered, setHovered] = useState(false);
  const { stroke, fill } = PALETTE[node.colorKey];
  const r  = BASE_R[node.depth] ?? 22;
  const lines = wrapText(label);
  const fs = [12, 11, 9.5, 8.5][node.depth] ?? 8.5;
  const scale = isFocused ? FOCUS_SCALE : hovered ? 1.15 : 1;
  const lit   = isFocused || isConnected;

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
          opacity={0.3} className="skill-pulse" />
      )}

      {/* Scale group */}
      <g style={{
        transformBox: 'fill-box', transformOrigin: 'center',
        transform: `scale(${scale})`,
        transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>
        {/* Outer glow ring */}
        <circle r={r + 5} fill="none" stroke={stroke}
          strokeWidth={lit ? 1 : 0.5}
          opacity={isFocused ? 0.55 : isConnected ? 0.3 : hovered ? 0.25 : 0.1}
          style={{ transition: 'opacity 0.3s ease' }} />
        {/* Body */}
        <circle r={r} fill={fill} stroke={stroke}
          strokeWidth={isFocused ? 2.5 : 1.5}
          filter={`url(#glow-${isFocused ? 'focus' : 'soft'})`}
          style={{ transition: 'stroke-width 0.3s ease' }} />
        {/* Label */}
        {lines.map((line, i) => (
          <text key={i} textAnchor="middle" dominantBaseline="middle"
            fontSize={fs} fontWeight={isFocused ? 700 : 500}
            fill={isFocused ? stroke : '#c8d6e8'}
            y={(i - (lines.length - 1) / 2) * (fs + 2.5)}
            style={{ userSelect: 'none', pointerEvents: 'none' }}>
            {line}
          </text>
        ))}
      </g>
    </g>
  );
}

// ── main page ────────────────────────────────────────────────────────────────
export default function Skills() {
  const { t } = useTranslation();

  // ── skill tree state ────────────────────────────────────────────────────
  const { nodes, edges } = useMemo(() => buildLayout(skillTreeRoot), []);
  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  const [focusedId, setFocusedId] = useState<string>('root');
  const [panX, setPanX] = useState(VW / 2);
  const [panY, setPanY] = useState(VH / 2);

  const handleNodeClick = useCallback((node: NodeDatum) => {
    setFocusedId(node.id);
    setPanX(VW / 2 - node.x);
    setPanY(VH / 2 - node.y);
  }, []);

  // Direct neighbours of focused node (for edge + ring highlight)
  const connectedIds = useMemo(() => {
    const s = new Set<string>();
    edges.forEach(e => {
      if (e.parentId === focusedId) s.add(e.childId);
      if (e.childId  === focusedId) s.add(e.parentId);
    });
    return s;
  }, [edges, focusedId]);

  // ── matrix state ────────────────────────────────────────────────────────
  const [matrixCells, setMatrixCells] = useState(mockTeamMatrix.cells);
  const [modalOpen, setModalOpen] = useState(false);

  const getMaturityLevel = (teamMemberId: string, taskId: string): MaturityLevel | null => {
    const cell = matrixCells.find(
      (c) => c.teamMemberId === teamMemberId && c.taskId === taskId
    );
    return cell?.maturityLevel ?? null;
  };

  const handleMaturityChange = (
    teamMemberId: string,
    taskId: string,
    event: SelectChangeEvent<MaturityLevel | ''>
  ) => {
    const value = event.target.value as MaturityLevel | '';
    setMatrixCells((prev) => {
      const existingIndex = prev.findIndex(
        (c) => c.teamMemberId === teamMemberId && c.taskId === taskId
      );
      if (value === '') return prev.filter((_, i) => i !== existingIndex);
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = { teamMemberId, taskId, maturityLevel: value };
        return next;
      }
      return [...prev, { teamMemberId, taskId, maturityLevel: value }];
    });
  };

  const maturityLevels: MaturityLevel[] = ['M1', 'M2', 'M3', 'M4'];

  const getMaturityColor = (level: MaturityLevel | null): string => {
    if (!level) return 'transparent';
    return { M1: '#ef4444', M2: '#f97316', M3: '#eab308', M4: '#22c55e' }[level];
  };

  // focused node label (for the breadcrumb-style hint)
  const focusedNode = nodeMap.get(focusedId);

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="h3">{t('skills.title')}</Typography>
        {focusedNode && focusedNode.id !== 'root' && (
          <Typography variant="caption" sx={{ color: PALETTE[focusedNode.colorKey].stroke, fontWeight: 600, letterSpacing: 1 }}>
            ◈ {t(focusedNode.labelKey)}
          </Typography>
        )}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        {t('skills.hint')}
      </Typography>

      {/* SVG tree */}
      <Box sx={{
        width: '100%',
        borderRadius: 3,
        overflow: 'hidden',
        border: '1px solid rgba(34,211,238,0.12)',
        boxShadow: '0 0 60px rgba(6,11,24,0.8), inset 0 0 120px rgba(0,0,0,0.4)',
        bgcolor: TREE_BG,
      }}>
        <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          {/* ── Defs ── */}
          <defs>
            <filter id="glow-soft" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="glow-focus" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <radialGradient id="bg-radial" cx="50%" cy="50%" r="55%">
              <stop offset="0%" stopColor="#0c1830"/>
              <stop offset="100%" stopColor={TREE_BG}/>
            </radialGradient>
          </defs>

          {/* ── Background ── */}
          <rect width={VW} height={VH} fill="url(#bg-radial)"/>

          {/* Stars */}
          {STARS.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={s.opacity}/>
          ))}

          {/* Ambient viewport rings */}
          <g opacity={0.06} style={{ pointerEvents: 'none' }}>
            {[55, 115, 200, 310, 440].map(r => (
              <circle key={r} cx={VW / 2} cy={VH / 2} r={r}
                fill="none" stroke="#7dd3fc" strokeWidth={0.5}/>
            ))}
          </g>

          {/* ── Graph group (pans on click) ── */}
          <g style={{
            transform: `translate(${panX}px, ${panY}px)`,
            transition: 'transform 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          }}>
            {/* Edges */}
            {edges.map((e, i) => {
              const { stroke } = PALETTE[e.colorKey];
              const lit = e.parentId === focusedId || e.childId === focusedId;
              return (
                <line key={i}
                  x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                  stroke={stroke}
                  strokeWidth={lit ? 1.8 : 0.8}
                  strokeOpacity={lit ? 0.65 : 0.18}
                  style={{ transition: 'stroke-opacity 0.35s ease, stroke-width 0.35s ease' }}
                />
              );
            })}

            {/* Nodes */}
            {nodes.map(n => (
              <SkillNodeEl key={n.id} node={n}
                isFocused={n.id === focusedId}
                isConnected={connectedIds.has(n.id)}
                onClick={() => handleNodeClick(n)}
                label={t(n.labelKey)}
              />
            ))}
          </g>

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
        {(skillTreeRoot.children ?? []).map(cat => {
          const ck = (CAT_KEYS[cat.id] ?? 'default') as PKey;
          const color = PALETTE[ck].stroke;
          const isFocusedCat = focusedId === cat.id || connectedIds.has(cat.id);
          return (
            <Box key={cat.id}
              onClick={() => { const n = nodeMap.get(cat.id); if (n) handleNodeClick(n); }}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.75, cursor: 'pointer',
                opacity: isFocusedCat ? 1 : 0.55,
                transition: 'opacity 0.3s ease',
                '&:hover': { opacity: 1 } }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color,
                boxShadow: `0 0 6px ${color}` }}/>
              <Typography variant="caption" sx={{ color, fontWeight: 600, fontSize: '0.7rem', letterSpacing: 0.5 }}>
                {t(cat.labelKey)}
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
      <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
        {t('matrix.description')}
      </Typography>

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
              {mockTasks.map((task) => (
                <TableCell key={task.id} align="center" sx={{ fontWeight: 'bold', minWidth: 120 }}>
                  {task.title}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {mockTeamMembers.map((member) => (
              <TableRow key={member.id}>
                <TableCell component="th" scope="row">
                  <Box>
                    <Typography variant="body1" fontWeight="medium">{member.name}</Typography>
                    <Typography variant="caption" color="textSecondary">{member.position}</Typography>
                  </Box>
                </TableCell>
                {mockTasks.map((task) => (
                  <TableCell
                    key={task.id}
                    align="center"
                    sx={{ bgcolor: getMaturityColor(getMaturityLevel(member.id, task.id)), transition: 'background-color 0.3s ease' }}
                  >
                    <Select
                      value={getMaturityLevel(member.id, task.id) ?? ''}
                      onChange={(e) => handleMaturityChange(member.id, task.id, e)}
                      displayEmpty
                      size="small"
                      sx={{ minWidth: 80, '& .MuiSelect-select': { color: getMaturityLevel(member.id, task.id) ? '#fff' : 'inherit', fontWeight: 'bold' } }}
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
