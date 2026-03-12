import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
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
import { useNavigate } from 'react-router-dom';
import { jobsApi } from '../api';
import type { JobSheet } from '../types';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

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

  useEffect(() => {
    jobsApi.getAll()
      .then(setJobs)
      .catch(() => setError(t('jobs.errorLoad')))
      .finally(() => setLoading(false));
  }, [t]);

  const handleCreate = async (title: string, description: string) => {
    const created = await jobsApi.create({ title, description, content: '', requiredSkills: [] });
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
                  {(job.requiredSkills?.length ?? 0) > 0 && (
                    <Box sx={{ mt: 1.5 }}>
                      <Chip
                        size="small"
                        label={t('jobs.skillCount', { count: job.requiredSkills!.length })}
                        variant="outlined"
                        color="primary"
                      />
                    </Box>
                  )}
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
