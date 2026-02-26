import { useState, useCallback } from 'react';
import {
  Container,
  Typography,
  Box,
  IconButton,
  Tooltip,
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
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import InfoIcon from '@mui/icons-material/Info';
import { useTranslation } from 'react-i18next';
import { skillTreeRoot, SkillNode } from '../data/skillTree';
import { mockTeamMembers, mockTasks, mockTeamMatrix } from '../data/mockData';
import { MaturityLevel } from '../types';

// ── colour palette per top-level category ──────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  development: '#3b82f6',
  research: '#8b5cf6',
  communication: '#f97316',
  organisation: '#22c55e',
  root: '#1d4ed8',
};

function resolveColor(node: SkillNode, ancestors: SkillNode[]): string {
  // Walk ancestors to find the top-level category
  const topLevel = ancestors[1] ?? node;
  return CATEGORY_COLORS[topLevel.id] ?? CATEGORY_COLORS[node.id] ?? '#6b7280';
}

// ── geometry helpers ────────────────────────────────────────────────────────
const CX = 400;
const CY = 340;
const ORBIT_R = 190;   // distance from center to child nodes
const ROOT_R = 54;
const NODE_R = 42;
const LEAF_R = 34;

function circlePoints(n: number, r: number, cx = CX, cy = CY) {
  return Array.from({ length: n }, (_, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });
}

// ── node component ──────────────────────────────────────────────────────────
interface NodeProps {
  x: number;
  y: number;
  radius: number;
  label: string;
  color: string;
  isCenter?: boolean;
  isLeaf?: boolean;
  onClick?: () => void;
}

function TreeNode({ x, y, radius, label, color, isCenter, isLeaf, onClick }: NodeProps) {
  const [hovered, setHovered] = useState(false);

  const words = label.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > 12 && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);

  const scale = hovered && !isCenter ? 1.12 : 1;
  const fontSize = isCenter ? 13 : isLeaf ? 10 : 11;

  return (
    <g
      transform={`translate(${x},${y}) scale(${scale})`}
      style={{ cursor: onClick ? 'pointer' : 'default', transition: 'transform 0.15s ease' }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <circle
        r={radius}
        fill={isCenter ? color : hovered ? color : `${color}cc`}
        stroke={color}
        strokeWidth={isCenter ? 3 : 2}
        style={{ transition: 'fill 0.15s ease, filter 0.15s ease' }}
        filter={hovered && !isCenter ? `drop-shadow(0 4px 8px ${color}88)` : undefined}
      />
      {lines.map((line, i) => (
        <text
          key={i}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={fontSize}
          fontWeight={isCenter ? 700 : 600}
          fill="#fff"
          y={(i - (lines.length - 1) / 2) * (fontSize + 2)}
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          {line}
        </text>
      ))}
    </g>
  );
}

// ── edge component ───────────────────────────────────────────────────────────
function Edge({ x1, y1, x2, y2, color }: { x1: number; y1: number; x2: number; y2: number; color: string }) {
  return (
    <line
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={color}
      strokeWidth={2}
      strokeOpacity={0.4}
      strokeDasharray="5 4"
    />
  );
}

// ── breadcrumb helpers ───────────────────────────────────────────────────────
function findPath(node: SkillNode, targetId: string, path: SkillNode[] = []): SkillNode[] | null {
  const next = [...path, node];
  if (node.id === targetId) return next;
  for (const child of node.children ?? []) {
    const result = findPath(child, targetId, next);
    if (result) return result;
  }
  return null;
}

// ── main page ────────────────────────────────────────────────────────────────
export default function Skills() {
  const { t } = useTranslation();

  // ── skill tree state ────────────────────────────────────────────────────
  const [centerNode, setCenterNode] = useState<SkillNode>(skillTreeRoot);
  const [ancestors, setAncestors] = useState<SkillNode[]>([]);
  const [animKey, setAnimKey] = useState(0);

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

  const navigateTo = useCallback((node: SkillNode) => {
    if (!node.children?.length) return; // leaf — no further navigation
    const path = findPath(skillTreeRoot, node.id) ?? [];
    setAncestors(path.slice(0, -1)); // everything except the node itself
    setCenterNode(node);
    setAnimKey((k) => k + 1);
  }, []);

  const navigateBack = useCallback(() => {
    if (!ancestors.length) return;
    const parent = ancestors[ancestors.length - 1];
    const path = findPath(skillTreeRoot, parent.id) ?? [];
    setAncestors(path.slice(0, -1));
    setCenterNode(parent);
    setAnimKey((k) => k + 1);
  }, [ancestors]);

  const children = centerNode.children ?? [];
  const positions = circlePoints(children.length, ORBIT_R);
  const centerColor = resolveColor(centerNode, ancestors);
  const isLeafNode = (n: SkillNode) => !n.children?.length;

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        {ancestors.length > 0 && (
          <Tooltip title={t('skills.back')}>
            <IconButton onClick={navigateBack} size="small">
              <ArrowBackIcon />
            </IconButton>
          </Tooltip>
        )}
        <Typography variant="h3">{t('skills.title')}</Typography>
      </Box>

      {/* Breadcrumb */}
      {ancestors.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 2, flexWrap: 'wrap' }}>
          {ancestors.map((a, i) => (
            <Box key={a.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography
                variant="body2"
                sx={{
                  cursor: 'pointer',
                  color: 'text.secondary',
                  '&:hover': { textDecoration: 'underline' },
                }}
                onClick={() => navigateTo(a)}
              >
                {t(a.labelKey)}
              </Typography>
              {i < ancestors.length - 1 && (
                <Typography variant="body2" color="text.disabled">/</Typography>
              )}
            </Box>
          ))}
          <Typography variant="body2" color="text.disabled">/</Typography>
          <Typography variant="body2" fontWeight="bold">{t(centerNode.labelKey)}</Typography>
        </Box>
      )}

      {/* Hint */}
      {children.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          {t('skills.hint')}
        </Typography>
      )}

      {/* SVG tree */}
      <Box
        sx={{
          width: '100%',
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          overflow: 'hidden',
        }}
      >
        <svg
          key={animKey}
          viewBox="0 0 800 680"
          style={{ width: '100%', height: 'auto', display: 'block' }}
        >
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; transform: scale(0.7); }
              to   { opacity: 1; transform: scale(1); }
            }
            .animated { animation: fadeIn 0.25s ease both; }
          `}</style>

          {/* Edges */}
          {positions.map((pos, i) => {
            const child = children[i];
            const edgeColor = resolveColor(child, [...ancestors, centerNode]);
            return (
              <Edge
                key={child.id}
                x1={CX} y1={CY}
                x2={pos.x} y2={pos.y}
                color={edgeColor}
              />
            );
          })}

          {/* Child nodes */}
          {positions.map((pos, i) => {
            const child = children[i];
            const color = resolveColor(child, [...ancestors, centerNode]);
            const leaf = isLeafNode(child);
            return (
              <g key={child.id} className="animated" style={{ animationDelay: `${i * 35}ms` }}>
                <TreeNode
                  x={pos.x}
                  y={pos.y}
                  radius={leaf ? LEAF_R : NODE_R}
                  label={t(child.labelKey)}
                  color={color}
                  isLeaf={leaf}
                  onClick={leaf ? undefined : () => navigateTo(child)}
                />
              </g>
            );
          })}

          {/* Center node */}
          <g className="animated">
            <TreeNode
              x={CX}
              y={CY}
              radius={ROOT_R}
              label={t(centerNode.labelKey)}
              color={centerColor}
              isCenter
            />
          </g>
        </svg>
      </Box>

      {/* Legend */}
      {centerNode.id === 'root' && (
        <Box sx={{ display: 'flex', gap: 2, mt: 2, flexWrap: 'wrap' }}>
          {(centerNode.children ?? []).map((cat) => (
            <Box key={cat.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: CATEGORY_COLORS[cat.id] }} />
              <Typography variant="caption">{t(cat.labelKey)}</Typography>
            </Box>
          ))}
        </Box>
      )}

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
