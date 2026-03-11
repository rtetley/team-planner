import { useState, useEffect, useMemo } from 'react';
import {
  Autocomplete,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  TextField,
  Typography,
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useNavigate } from 'react-router-dom';
import { teamMembersApi, skillTreeApi, skillPointsApi } from '../api';
import { AvailableMember, TeamMember } from '../types';
import type { SkillTreeNode } from '../types';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

// ── Palette (matches UserSkills / MemberSkillView) ────────────────────────────
type PKey = 'root' | 'development' | 'research' | 'communication' | 'organisation' | 'default';
const PALETTE: Record<PKey, { stroke: string }> = {
  root:          { stroke: '#e2b714' },
  development:   { stroke: '#38bdf8' },
  research:      { stroke: '#a78bfa' },
  communication: { stroke: '#fb923c' },
  organisation:  { stroke: '#4ade80' },
  default:       { stroke: '#94a3b8' },
};
const CAT_KEYS: Record<string, PKey> = {
  development: 'development', research: 'research',
  communication: 'communication', organisation: 'organisation',
};
const MAX_POINTS = 5;
const TREE_BG = '#1e2229';

interface RadarCat { id: string; label: string; colorKey: PKey; color?: string; total: number; }

function MiniRadar({ categories }: { categories: RadarCat[] }) {
  const n = categories.length;
  if (n < 3) return null;
  const cx = 60, cy = 60, R = 42, levels = 4, cap = 5;
  const angles = categories.map((_, i) => (2 * Math.PI * i) / n - Math.PI / 2);
  const dataR = categories.map(cat => (R * Math.min(cat.total, cap)) / cap);
  const pts = angles.map((a, i) => ({ x: cx + dataR[i] * Math.cos(a), y: cy + dataR[i] * Math.sin(a) }));
  return (
    <svg viewBox="0 0 120 120" style={{ width: 120, height: 120, flexShrink: 0 }}>
      {Array.from({ length: levels }, (_, lv) => {
        const r = (R * (lv + 1)) / levels;
        return <polygon key={lv} points={angles.map(a => `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`).join(' ')} fill="none" stroke="#2d3748" strokeWidth={0.6} />;
      })}
      {angles.map((a, i) => <line key={i} x1={cx} y1={cy} x2={cx + R * Math.cos(a)} y2={cy + R * Math.sin(a)} stroke="#2d3748" strokeWidth={0.6} />)}
      {categories.map((cat, i) => {
        const j = (i + 1) % n;
        const stroke = cat.color ?? PALETTE[cat.colorKey].stroke;
        const fill = cat.color ? cat.color + '28' : stroke + '28';
        return <polygon key={cat.id} points={`${cx},${cy} ${pts[i].x},${pts[i].y} ${pts[j].x},${pts[j].y}`} fill={fill} fillOpacity={0.85} stroke={stroke} strokeWidth={0.5} />;
      })}
      {categories.map((cat, i) => (
        <circle key={cat.id} cx={pts[i].x} cy={pts[i].y} r={3} fill={cat.color ?? PALETTE[cat.colorKey].stroke} />
      ))}
      {categories.map((cat, i) => {
        const a = angles[i]; const lr = R + 10;
        return <text key={cat.id} x={cx + lr * Math.cos(a)} y={cy + lr * Math.sin(a)} textAnchor="middle" dominantBaseline="middle" fontSize={5.5} fill={cat.color ?? PALETTE[cat.colorKey].stroke} fontWeight={600} style={{ userSelect: 'none' }}>{cat.label}</text>;
      })}
      <circle cx={cx} cy={cy} r={2} fill="#4a5568" />
    </svg>
  );
}

// ── Member skill summary ──────────────────────────────────────────────────────
interface MemberSkillSummaryProps {
  member: TeamMember;
  skillTree: { root: SkillTreeNode } | null;
  points: Record<string, number>;
}

function flatIds(node: SkillTreeNode): string[] {
  const ids: string[] = [node.id];
  (node.children ?? []).forEach(c => ids.push(...flatIds(c)));
  return ids;
}

function buildChildrenOf(root: SkillTreeNode): Map<string, string[]> {
  const m = new Map<string, string[]>();
  function walk(node: SkillTreeNode) {
    m.set(node.id, (node.children ?? []).map(c => c.id));
    (node.children ?? []).forEach(walk);
  }
  walk(root);
  return m;
}

function computeScore(id: string, childrenOf: Map<string, string[]>, points: Record<string, number>): number {
  const kids = childrenOf.get(id) ?? [];
  if (kids.length === 0) return points[id] ?? 0;
  const unlockedKids = kids.filter(kid => (points[kid] ?? 0) > 0);
  if (unlockedKids.length === 0) return 0;
  const meanGrade = unlockedKids.reduce((sum, kid) => sum + computeScore(kid, childrenOf, points), 0) / unlockedKids.length;
  return ((unlockedKids.length / kids.length) * 5 + meanGrade) / 2;
}

function MemberSkillSummary({ member, skillTree, points }: MemberSkillSummaryProps) {
  const { t, i18n } = useTranslation();

  const childrenOf = useMemo(() => skillTree ? buildChildrenOf(skillTree.root) : new Map<string, string[]>(), [skillTree]);

  const radarCategories = useMemo<RadarCat[]>(() => {
    if (!skillTree) return [];
    const lang = i18n.language;
    return (skillTree.root.children ?? []).map(cat => {
      const ck = (CAT_KEYS[cat.id] ?? 'default') as PKey;
      const label = cat.labels?.[lang] ?? cat.label;
      return { id: cat.id, label, colorKey: ck, color: cat.color, total: computeScore(cat.id, childrenOf, points) };
    });
  }, [skillTree, childrenOf, points, i18n.language]);

  const leafNodes = useMemo(() => {
    if (!skillTree) return [];
    const allIds = flatIds(skillTree.root);
    const withKids = new Set(Array.from(childrenOf.entries()).filter(([, kids]) => kids.length > 0).map(([id]) => id));
    return allIds.filter(id => !withKids.has(id) && (points[id] ?? 0) > 0);
  }, [skillTree, childrenOf, points]);

  // Flatten tree to get labels
  const nodeLabels = useMemo(() => {
    if (!skillTree) return new Map<string, { label: string; color?: string; colorKey: PKey }>();
    const lang = i18n.language;
    const m = new Map<string, { label: string; color?: string; colorKey: PKey }>();
    function walk(node: SkillTreeNode, ck: PKey) {
      const nodeCk: PKey = CAT_KEYS[node.id] ? CAT_KEYS[node.id] : ck;
      m.set(node.id, { label: node.labels?.[lang] ?? node.label, color: node.color, colorKey: nodeCk });
      (node.children ?? []).forEach(c => walk(c, nodeCk));
    }
    walk(skillTree.root, 'root');
    return m;
  }, [skillTree, i18n.language]);

  if (!member.linkedUserId) {
    return (
      <Typography variant="caption" color="text.secondary" fontStyle="italic">
        {t('team.noLinkedUser')}
      </Typography>
    );
  }

  return (
    <Box>
      {/* Mini radar + category scores side-by-side */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
        <Box sx={{ bgcolor: TREE_BG, borderRadius: 1, p: 0.5 }}>
          <MiniRadar categories={radarCategories} />
        </Box>
        <Box sx={{ flex: 1 }}>
          {radarCategories.map(cat => {
            const color = cat.color ?? PALETTE[cat.colorKey].stroke;
            const pct = Math.round((cat.total / 5) * 100);
            return (
              <Box key={cat.id} sx={{ mb: 0.6 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.2 }}>
                  <Typography variant="caption" sx={{ fontSize: '0.65rem', color, fontWeight: 600 }}>{cat.label}</Typography>
                  <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>{cat.total.toFixed(1)}</Typography>
                </Box>
                <Box sx={{ height: 3, borderRadius: 2, bgcolor: '#2d3748', overflow: 'hidden' }}>
                  <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: color, borderRadius: 2, transition: 'width 0.4s ease' }} />
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Unlocked leaf skills */}
      {leafNodes.length > 0 && (
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
            <LockOpenIcon sx={{ fontSize: '0.65rem', mr: 0.4, verticalAlign: 'middle' }} />
            {t('team.unlockedSkills')}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {leafNodes.map(id => {
              const info = nodeLabels.get(id);
              if (!info) return null;
              const color = info.color ?? PALETTE[info.colorKey].stroke;
              const rating = points[id] ?? 0;
              return (
                <Box key={id} sx={{ display: 'flex', alignItems: 'center', gap: 0.4, px: 0.75, py: 0.25, borderRadius: 0.75, border: '1px solid', borderColor: color + '55', bgcolor: color + '12' }}>
                  <Typography variant="caption" sx={{ color, fontWeight: 600, fontSize: '0.65rem' }}>{info.label}</Typography>
                  {rating > 0 && (
                    <Box sx={{ display: 'flex' }}>
                      {Array.from({ length: MAX_POINTS }, (_, i) => (
                        <Box key={i} component="span" sx={{ fontSize: '0.55rem', color: i < rating ? '#e2b714' : '#334155' }}>★</Box>
                      ))}
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
      )}
    </Box>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Team() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [availableMembers, setAvailableMembers] = useState<AvailableMember[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<AvailableMember[]>([]);
  const [saving, setSaving] = useState(false);
  // Skill data for all linked members
  const [skillTree, setSkillTree] = useState<{ root: SkillTreeNode } | null>(null);
  const [allPoints, setAllPoints] = useState<Record<string, Record<string, number>>>({});

  const isManager = user?.role === 'manager';
  const myTeam = isManager ? teamMembers.filter((m) => m.managerId === user?.id) : teamMembers;

  useEffect(() => {
    teamMembersApi.getAll().then(setTeamMembers).catch(console.error);
    skillTreeApi.get().then(setSkillTree).catch(console.error);
  }, []);

  // Fetch skill points for each linked member once we have the member list
  useEffect(() => {
    const linked = myTeam.filter(m => m.linkedUserId);
    Promise.all(
      linked.map(m =>
        skillPointsApi.getForUser(m.linkedUserId!)
          .then(pts => ({ id: m.id, pts }))
          .catch(() => ({ id: m.id, pts: {} }))
      )
    ).then(results => {
      const map: Record<string, Record<string, number>> = {};
      results.forEach(({ id, pts }) => { map[id] = pts; });
      setAllPoints(map);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamMembers]);

  const openDialog = () => {
    teamMembersApi.getAvailable().then(setAvailableMembers).catch(console.error);
    setSelected([]);
    setDialogOpen(true);
  };

  const handleAddMembers = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const added = await Promise.all(
        selected.map((m) =>
          m._fromUserId
            ? teamMembersApi.createFromUser(m._fromUserId, user.id)
            : teamMembersApi.update({ ...m, managerId: user.id }),
        ),
      );
      setTeamMembers((prev) => {
        const updatedMap = new Map(added.map((u) => [u.id, u]));
        const merged = prev.map((m) => updatedMap.get(m.id) ?? m);
        added.forEach((a) => { if (!prev.find((m) => m.id === a.id)) merged.push(a); });
        return merged;
      });
      setDialogOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h3">{t('team.title')}</Typography>
        {isManager && (
          <Button variant="contained" startIcon={<PersonAddIcon />} onClick={openDialog}>
            {t('team.addMember')}
          </Button>
        )}
      </Box>

      <Grid container spacing={3}>
        {myTeam.map((member) => (
          <Grid item xs={12} sm={6} md={4} key={member.id}>
            <Card sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <CardContent sx={{ flex: 1 }}>
                <Typography variant="h5" gutterBottom>{member.name}</Typography>
                {member.position && (
                  <Typography variant="subtitle1" color="textSecondary" gutterBottom>{member.position}</Typography>
                )}
                {member.linkedUserId && (
                  <Chip icon={<LockOpenIcon fontSize="small" />} size="small" color="success" variant="outlined"
                    label={t('team.linked')} sx={{ mb: 1.5 }} />
                )}
                <MemberSkillSummary
                  member={member}
                  skillTree={skillTree}
                  points={allPoints[member.id] ?? {}}
                />
              </CardContent>
              {member.linkedUserId && (
                <CardActions sx={{ pt: 0, px: 2, pb: 1.5 }}>
                  <Button
                    size="small"
                    startIcon={<VisibilityIcon />}
                    onClick={() => navigate(`/team/${member.id}/skills`)}
                  >
                    {t('team.viewSkillTree')}
                  </Button>
                </CardActions>
              )}
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Add Member Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('team.addMemberDialogTitle')}</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          {availableMembers.length === 0 ? (
            <Alert severity="info">{t('team.noMembersAvailable')}</Alert>
          ) : (
            <Autocomplete
              multiple
              options={availableMembers}
              getOptionLabel={(m) =>
                m._fromUserId
                  ? `${m.name} (GitLab)`
                  : m.position
                  ? `${m.name} — ${m.position}`
                  : m.name
              }
              value={selected}
              onChange={(_, val) => setSelected(val)}
              renderInput={(params) => (
                <TextField {...params} label={t('team.addMemberSelectLabel')} autoFocus />
              )}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('team.addMemberCancel')}</Button>
          <Button variant="contained" onClick={handleAddMembers} disabled={selected.length === 0 || saving}>
            {t('team.addMemberConfirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
