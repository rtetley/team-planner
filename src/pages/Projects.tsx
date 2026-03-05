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
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import { projectsApi } from '../api';
import { Project } from '../types';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import ProjectDialog from './ProjectDialog';

// ── Projects page ─────────────────────────────────────────────────────────────

export default function Projects() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isManager = user?.role === 'manager';

  const [projects, setProjects] = useState<Project[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    projectsApi.getAll().then(setProjects).catch(console.error);
  }, []);

  const handleSave = async (data: Omit<Project, 'id'>) => {
    const created = await projectsApi.create(data);
    setProjects(prev => [...prev, created]);
    navigate(`/projects/${created.id}`);
  };

  // delete not used from list page — handled inside ProjectView
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
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
            {t('projects.newProject')}
          </Button>
        )}
      </Box>

      <Grid container spacing={3}>
        {projects.map((project) => (
          <Grid item xs={12} md={6} key={project.id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flex: 1 }}>
                {/* Title */}
                <Typography variant="h5" gutterBottom>{project.name}</Typography>

                {/* Tech stack */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
                  {project.techStack.map((tech) => (
                    <Chip key={tech} label={tech} size="small" color="primary" variant="outlined" />
                  ))}
                </Box>

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

                {/* Dates */}
                <Box sx={{ borderTop: '1px solid', borderColor: 'divider', mt: 'auto', pt: 1.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    {fmt(project.startDate)} → {fmt(project.endDate)}
                  </Typography>
                </Box>
              </CardContent>

              <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
                <Button size="small" startIcon={<VisibilityIcon />} onClick={() => navigate(`/projects/${project.id}`)}>
                  {t('projects.view')}
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      <ProjectDialog
        open={dialogOpen}
        initial={null}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </Container>
  );
}
