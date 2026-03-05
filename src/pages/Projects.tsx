import { useState, useEffect, useCallback, KeyboardEvent } from 'react';
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
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tab,
  Tabs,
  Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import ReactMarkdown from 'react-markdown';
import { projectsApi } from '../api';
import { Project } from '../types';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

// ── ProjectDialog ─────────────────────────────────────────────────────────────

interface ProjectDialogProps {
  open: boolean;
  initial: Project | null; // null = new project
  onClose: () => void;
  onSave: (data: Omit<Project, 'id'>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function ProjectDialog({ open, initial, onClose, onSave, onDelete }: ProjectDialogProps) {
  const { t } = useTranslation();
  const isNew = initial === null;

  const [name,        setName]        = useState('');
  const [description, setDescription] = useState('');
  const [startDate,   setStartDate]   = useState('');
  const [endDate,     setEndDate]     = useState('');
  const [techStack,   setTechStack]   = useState<string[]>([]);
  const [techInput,   setTechInput]   = useState('');
  const [descTab,     setDescTab]     = useState<'edit' | 'preview'>('edit');
  const [submitted,   setSubmitted]   = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Reset fields whenever dialog opens
  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setDescription(initial?.description ?? '');
    setStartDate(initial?.startDate ?? '');
    setEndDate(initial?.endDate ?? '');
    setTechStack(initial?.techStack ?? []);
    setTechInput('');
    setDescTab('edit');
    setSubmitted(false);
    setConfirmDelete(false);
  }, [open, initial]);

  // ── validation ──────────────────────────────────────────────────────────────
  const nameError    = submitted && !name.trim()                   ? t('projects.errorNameRequired')     : '';
  const startError   = submitted && !startDate                     ? t('projects.errorStartRequired')    : '';
  const endError     = submitted && !endDate                       ? t('projects.errorEndRequired')
                     : submitted && startDate && endDate && endDate <= startDate
                       ? t('projects.errorEndBeforeStart') : '';

  const isValid = name.trim() && startDate && endDate && endDate > startDate;

  // ── tech stack chip input ────────────────────────────────────────────────────
  const commitTechInput = useCallback(() => {
    const val = techInput.trim().replace(/,$/, '').trim();
    if (val && !techStack.includes(val)) setTechStack(prev => [...prev, val]);
    setTechInput('');
  }, [techInput, techStack]);

  const handleTechKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commitTechInput(); }
    if (e.key === 'Backspace' && !techInput && techStack.length > 0)
      setTechStack(prev => prev.slice(0, -1));
  };

  // ── save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSubmitted(true);
    if (!isValid) return;
    setSaving(true);
    try {
      // Commit any pending tech-stack input
      const finalStack = techInput.trim()
        ? [...techStack, techInput.trim()].filter((v, i, a) => a.indexOf(v) === i)
        : techStack;
      await onSave({ name: name.trim(), description, startDate, endDate, techStack: finalStack });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!initial) return;
    setSaving(true);
    try { await onDelete(initial.id); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="md"
        PaperProps={{ sx: { bgcolor: 'var(--background-raised-grey)' } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Typography variant="h6" component="span">
            {isNew ? t('projects.newProject') : t('projects.editProject')}
          </Typography>
          <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 4, pt: 3 }}>

          {/* Name */}
          <TextField
            label={t('projects.nameField')}
            value={name}
            onChange={e => setName(e.target.value)}
            fullWidth required
            error={!!nameError} helperText={nameError}
          />

          {/* Dates */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              label={t('projects.startDateField')}
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ flex: '1 1 160px' }}
              error={!!startError} helperText={startError}
            />
            <TextField
              label={t('projects.endDateField')}
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ flex: '1 1 160px' }}
              error={!!endError} helperText={endError}
            />
          </Box>

          {/* Tech stack */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              {t('projects.techStackField')}
            </Typography>
            <Box sx={{
              display: 'flex', flexWrap: 'wrap', gap: 0.75, p: 1,
              border: '1px solid', borderColor: 'divider', borderRadius: 1,
              minHeight: 48, alignItems: 'center',
            }}>
              {techStack.map(tech => (
                <Chip key={tech} label={tech} size="small"
                  onDelete={() => setTechStack(prev => prev.filter(t => t !== tech))} />
              ))}
              <input
                value={techInput}
                onChange={e => setTechInput(e.target.value)}
                onKeyDown={handleTechKeyDown}
                onBlur={commitTechInput}
                placeholder={techStack.length === 0 ? t('projects.techStackHint') : ''}
                style={{
                  border: 'none', outline: 'none', background: 'transparent',
                  color: 'inherit', font: 'inherit', flexGrow: 1, minWidth: 160,
                }}
              />
            </Box>
          </Box>

          {/* Description with edit/preview tabs */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                {t('projects.descriptionField')}
              </Typography>
              <Tabs value={descTab} onChange={(_, v) => setDescTab(v)}
                sx={{ minHeight: 0, '& .MuiTab-root': { minHeight: 0, py: 0.5, px: 1.5, fontSize: '0.75rem' } }}>
                <Tab label={t('projects.edit')} value="edit" />
                <Tab label={t('projects.preview')} value="preview" />
              </Tabs>
            </Box>

            <Box sx={{ position: 'relative', height: 164, overflow: 'hidden' }}>
              {/* Edit */}
              <TextField
                value={description}
                onChange={e => setDescription(e.target.value)}
                multiline
                fullWidth
                inputProps={{
                  placeholder: t('projects.descriptionPlaceholder'),
                  style: { fontFamily: 'monospace', fontSize: '0.85rem', resize: 'none' },
                }}
                sx={{
                  position: 'absolute', inset: 0,
                  visibility: descTab === 'edit' ? 'visible' : 'hidden',
                  '& .MuiInputBase-root': { height: '100%', alignItems: 'flex-start', overflow: 'hidden' },
                  '& .MuiInputBase-input': { height: '100% !important', overflow: 'auto !important', boxSizing: 'border-box' },
                }}
              />
              {/* Preview */}
              <Box sx={{
                position: 'absolute', inset: 0,
                p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1,
                overflow: 'auto',
                visibility: descTab === 'preview' ? 'visible' : 'hidden',
                '& p': { mt: 0 },
              }}>
                {description.trim()
                  ? <ReactMarkdown>{description}</ReactMarkdown>
                  : <Typography variant="body2" color="text.disabled" fontStyle="italic">
                      {t('projects.noDescription')}
                    </Typography>}
              </Box>
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
          {/* Delete (edit mode only) */}
          {!isNew ? (
            <Button startIcon={<DeleteIcon />} color="error" onClick={() => setConfirmDelete(true)}
              disabled={saving}>
              {t('projects.delete')}
            </Button>
          ) : <Box />}

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={onClose} disabled={saving}>{t('projects.cancel')}</Button>
            <Button variant="contained" onClick={handleSave} disabled={saving}>
              {t('projects.save')}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('projects.confirmDeleteTitle')}</DialogTitle>
        <DialogContent>
          <Typography>{t('projects.confirmDelete')}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(false)}>{t('projects.cancel')}</Button>
          <Button color="error" variant="contained" onClick={handleDelete} disabled={saving}>
            {t('projects.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ── Projects page ─────────────────────────────────────────────────────────────

export default function Projects() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isManager = user?.role === 'manager';

  const [projects, setProjects] = useState<Project[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);

  useEffect(() => {
    projectsApi.getAll().then(setProjects).catch(console.error);
  }, []);

  const openNew  = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (p: Project) => { setEditing(p); setDialogOpen(true); };

  const handleSave = async (data: Omit<Project, 'id'>) => {
    if (editing) {
      const updated = await projectsApi.update({ ...data, id: editing.id });
      setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
    } else {
      const created = await projectsApi.create(data);
      setProjects(prev => [...prev, created]);
    }
  };

  const handleDelete = async (id: string) => {
    await projectsApi.remove(id);
    setProjects(prev => prev.filter(p => p.id !== id));
  };

  const fmt = (d: string) => d ? new Date(d).toLocaleDateString() : '—';

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h3">{t('projects.title')}</Typography>
        {isManager && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>
            {t('projects.newProject')}
          </Button>
        )}
      </Box>

      <Grid container spacing={3}>
        {projects.map((project) => (
          <Grid item xs={12} md={6} key={project.id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flex: 1 }}>
                {/* Name + dates */}
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                  <Typography variant="h5" gutterBottom>{project.name}</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  {fmt(project.startDate)} → {fmt(project.endDate)}
                </Typography>

                {/* Description */}
                {project.description?.trim() ? (
                  <Box sx={{
                    mb: 2, fontSize: '0.875rem', color: 'text.primary',
                    '& p': { mt: 0, mb: 0.5 },
                    '& h1,& h2,& h3': { mt: 1, mb: 0.5, fontSize: '1rem' },
                    overflow: 'hidden',
                    display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical',
                  }}>
                    <ReactMarkdown>{project.description}</ReactMarkdown>
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.disabled" fontStyle="italic" sx={{ mb: 2 }}>
                    {t('projects.noDescription')}
                  </Typography>
                )}

                {/* Tech stack */}
                <Divider sx={{ mb: 1.5 }} />
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {project.techStack.map((tech) => (
                    <Chip key={tech} label={tech} size="small" color="primary" variant="outlined" />
                  ))}
                </Box>
              </CardContent>

              {isManager && (
                <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
                  <Button size="small" startIcon={<EditIcon />} onClick={() => openEdit(project)}>
                    {t('projects.edit')}
                  </Button>
                </CardActions>
              )}
            </Card>
          </Grid>
        ))}
      </Grid>

      <ProjectDialog
        open={dialogOpen}
        initial={editing}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </Container>
  );
}
