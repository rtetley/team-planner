import { useState, useEffect, useMemo } from 'react';
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Box,
  Button,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { useNavigate } from 'react-router-dom';
import { jobsApi, skillTreeApi } from '../api';
import type { JobSheet, SkillTreeNode } from '../types';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

// ── Palette (matches Team / UserSkills) ───────────────────────────────────────
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

function buildChildrenOf(root: SkillTreeNode): Map<string, string[]> {
  const m = new Map<string, string[]>();
  function walk(node: SkillTreeNode) {
    m.set(node.id, (node.children ?? []).map(c => c.id));
    (node.children ?? []).forEach(walk);
  }
  walk(root);
  return m;
}

function computeScore(id: string, childrenOf: Map<string, string[]>, ratings: Record<string, number>): number {
  const kids = childrenOf.get(id) ?? [];
  if (kids.length === 0) return ratings[id] ?? 0;
  const unlockedKids = kids.filter(kid => (ratings[kid] ?? 0) > 0);
  if (unlockedKids.length === 0) return 0;
  const meanGrade = unlockedKids.reduce((sum, kid) => sum + computeScore(kid, childrenOf, ratings), 0) / unlockedKids.length;
  return ((unlockedKids.length / kids.length) * 5 + meanGrade) / 2;
}

interface JobSkillSummaryProps {
  job: JobSheet;
  skillTree: { root: SkillTreeNode } | null;
}

function JobSkillSummary({ job, skillTree }: JobSkillSummaryProps) {
  const { t, i18n } = useTranslation();
  const ratings = job.skillRatings ?? {};

  const childrenOf = useMemo(() => skillTree ? buildChildrenOf(skillTree.root) : new Map<string, string[]>(), [skillTree]);

  const radarCategories = useMemo<RadarCat[]>(() => {
    if (!skillTree) return [];
    const lang = i18n.language;
    return (skillTree.root.children ?? []).map(cat => {
      const ck = (CAT_KEYS[cat.id] ?? 'default') as PKey;
      const label = cat.labels?.[lang] ?? cat.label;
      return { id: cat.id, label, colorKey: ck, color: cat.color, total: computeScore(cat.id, childrenOf, ratings) };
    });
  }, [skillTree, childrenOf, ratings, i18n.language]);

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

  const leafNodes = useMemo(() => {
    if (!skillTree) return [];
    const withKids = new Set(Array.from(childrenOf.entries()).filter(([, kids]) => kids.length > 0).map(([id]) => id));
    return Array.from(childrenOf.keys()).filter(id => !withKids.has(id) && (ratings[id] ?? 0) > 0);
  }, [skillTree, childrenOf, ratings]);

  const hasData = radarCategories.some(c => c.total > 0) || leafNodes.length > 0;
  if (!hasData) return null;

  return (
    <Box sx={{ mt: 2 }}>
      {/* Mini radar + category bars */}
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
            {t('jobs.requiredSkillsLabel')}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {leafNodes.map(id => {
              const info = nodeLabels.get(id);
              if (!info) return null;
              const color = info.color ?? PALETTE[info.colorKey].stroke;
              const rating = ratings[id] ?? 0;
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

// ── New Job Dialog ────────────────────────────────────────────────────────────
interface NewJobDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (title: string, description: string) => Promise<void>;
}

function NewJobDialog({ open, onClose, onCreate }: NewJobDialogProps) {
  const { t } = useTranslation();
  const [title, setTitle]             = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving]           = useState(false);
  const [submitted, setSubmitted]     = useState(false);

  useEffect(() => {
    if (!open) { setTitle(''); setDescription(''); setSubmitted(false); }
  }, [open]);

  const handleSubmit = async () => {
    setSubmitted(true);
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onCreate(title.trim(), description.trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !saving && onClose()} maxWidth="sm" fullWidth>
      <DialogTitle>{t('jobs.newJobTitle')}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
        <TextField
          label={t('jobs.titleField')}
          value={title}
          onChange={e => setTitle(e.target.value)}
          error={submitted && !title.trim()}
          helperText={submitted && !title.trim() ? t('jobs.errorTitleRequired') : ''}
          required
          fullWidth
          autoFocus
        />
        <TextField
          label={t('jobs.descriptionField')}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder={t('jobs.descriptionPlaceholder')}
          multiline
          rows={3}
          fullWidth
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>{t('jobs.cancel')}</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={saving}
          startIcon={saving ? <CircularProgress size={16} /> : undefined}>
          {t('jobs.create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Jobs() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isManager = user?.role === 'manager';

  const [jobs, setJobs]             = useState<JobSheet[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [skillTree, setSkillTree]   = useState<{ root: SkillTreeNode } | null>(null);

  useEffect(() => {
    jobsApi.getAll()
      .then(setJobs)
      .catch(() => setError(t('jobs.errorLoad')))
      .finally(() => setLoading(false));
    skillTreeApi.get().then(setSkillTree).catch(console.error);
  }, [t]);

  const handleCreate = async (title: string, description: string) => {
    const created = await jobsApi.create({ title, description, content: undefined, skillRatings: {} });
    setDialogOpen(false);
    navigate(`/jobs/${created.id}`);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h3">{t('jobs.title')}</Typography>
        {isManager && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
            {t('jobs.newJob')}
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <CircularProgress />
        </Box>
      ) : jobs.length === 0 ? (
        <Box sx={{ py: 10, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}>
          <WorkOutlineIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
          <Typography color="text.disabled" sx={{ mb: 2 }}>{t('jobs.noJobs')}</Typography>
          {isManager && (
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
              {t('jobs.newJob')}
            </Button>
          )}
        </Box>
      ) : (
        <Grid container spacing={3}>
          {jobs.map((job) => (
            <Grid item xs={12} md={6} key={job.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flex: 1 }}>
                  <Typography variant="h5" gutterBottom>{job.title}</Typography>
                  {job.description?.trim() ? (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {job.description}
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="text.disabled" fontStyle="italic">
                      {t('jobs.noDescription')}
                    </Typography>
                  )}
                  <JobSkillSummary job={job} skillTree={skillTree} />
                </CardContent>
                <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
                  <Button size="small" startIcon={<OpenInNewIcon />} onClick={() => navigate(`/jobs/${job.id}`)}>
                    {t('jobs.open')}
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <NewJobDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreate={handleCreate}
      />
    </Container>
  );
}
