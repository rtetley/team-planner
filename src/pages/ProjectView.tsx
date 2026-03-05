import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Chip,
  Button,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import WorkIcon from '@mui/icons-material/AccountTree';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';
import HubIcon from '@mui/icons-material/Hub';
import DescriptionIcon from '@mui/icons-material/Description';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import { projectsApi } from '../api';
import type { Project } from '../types';
import { useAuth } from '../context/AuthContext';
import ProjectDialog from './ProjectDialog';
import ProjectSkillTree from './ProjectSkillTree';
import ProjectRoadmap from './ProjectRoadmap';
import ProjectPrd from './ProjectPrd';

// ── helpers ───────────────────────────────────────────────────────────────────
const fmt = (d: string) => (d ? new Date(d).toLocaleDateString() : '—');

// ── placeholder panel content ─────────────────────────────────────────────────
function EmptyPanel({ label }: { label: string }) {
  return (
    <Box sx={{ py: 4, textAlign: 'center' }}>
      <Typography variant="body2" color="text.disabled" fontStyle="italic">
        {label}
      </Typography>
    </Box>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────
export default function ProjectView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const isManager = user?.role === 'manager';

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | false>('prd');

  useEffect(() => {
    if (!id) return;
    projectsApi.getAll()
      .then(all => {
        const found = all.find(p => p.id === id);
        if (found) setProject(found);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async (data: Omit<Project, 'id'>) => {
    if (!project) return;
    // Preserve fields the edit dialog doesn't manage
    const updated = await projectsApi.update({
      ...data,
      id: project.id,
      requiredSkills: project.requiredSkills ?? [],
      workPackages: project.workPackages ?? [],
      prd: project.prd ?? '',
    });
    setProject(updated);
  };

  const handleDelete = async (pid: string) => {
    await projectsApi.remove(pid);
    navigate('/projects');
  };

  const handleAccordion = (panel: string) => (_: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (notFound || !project) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Typography color="error">{t('projects.notFound')}</Typography>
        <Button sx={{ mt: 2 }} startIcon={<ArrowBackIcon />} onClick={() => navigate('/projects')}>
          {t('projects.backToList')}
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>

      {/* ── breadcrumb / title row ── */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5 }}>
        <Typography
          variant="h3"
          component="span"
          sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
          onClick={() => navigate('/projects')}
        >
          {t('projects.title')}
        </Typography>
        <Typography variant="h3" component="span" color="text.secondary"> / </Typography>
        <Typography variant="h3" component="span" color="text.secondary" sx={{ fontSize: '1.5rem' }}>
          {project.name}
        </Typography>
      </Box>

      {/* ── summary bar ── */}
      <Box sx={{
        mt: 2, mb: 4, p: 2.5,
        border: '1px solid', borderColor: 'divider', borderRadius: 2,
        bgcolor: 'var(--background-raised-grey)',
        display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        {/* top row: tech chips + edit button */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {project.techStack.map(tech => (
              <Chip key={tech} label={tech} size="small" color="primary" variant="outlined" />
            ))}
            {project.techStack.length === 0 && (
              <Typography variant="body2" color="text.disabled" fontStyle="italic">
                {t('projects.noTechStack')}
              </Typography>
            )}
          </Box>
          {isManager && (
            <Button size="small" startIcon={<EditIcon />} onClick={() => setDialogOpen(true)}>
              {t('projects.edit')}
            </Button>
          )}
        </Box>

        {/* description */}
        {project.description?.trim() ? (
          <Box sx={{
            fontSize: '0.9rem',
            '& p': { mt: 0, mb: 0.5 },
            '& h1,& h2,& h3': { mt: 1, mb: 0.5 },
          }}>
            <ReactMarkdown>{project.description}</ReactMarkdown>
          </Box>
        ) : (
          <Typography variant="body2" color="text.disabled" fontStyle="italic">
            {t('projects.noDescription')}
          </Typography>
        )}

        {/* dates */}
        <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 1.5 }}>
          <Typography variant="body2" color="text.secondary">
            {fmt(project.startDate)} → {fmt(project.endDate)}
          </Typography>
        </Box>
      </Box>

      {/* ── collapsible panels ── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>

        {/* PRD */}
        <Accordion
          expanded={expanded === 'prd'}
          onChange={handleAccordion('prd')}
          disableGutters
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px !important', '&:before': { display: 'none' } }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <DescriptionIcon fontSize="small" color="action" />
              <Typography fontWeight={600}>{t('projects.panelPrd')}</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 2 }}>
            <ProjectPrd
              project={project}
              onUpdate={p => setProject(p)}
              isManager={isManager}
            />
          </AccordionDetails>
        </Accordion>

        {/* Skill Tree */}
        <Accordion
          expanded={expanded === 'skillTree'}
          onChange={handleAccordion('skillTree')}
          disableGutters
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px !important', '&:before': { display: 'none' } }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <HubIcon fontSize="small" color="action" />
              <Typography fontWeight={600}>{t('projects.panelSkillTree')}</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 2 }}>
            <ProjectSkillTree
              project={project}
              onUpdate={p => setProject(p)}
              isManager={isManager}
            />
          </AccordionDetails>
        </Accordion>

        {/* Work Packages */}
        <Accordion
          expanded={expanded === 'workPackages'}
          onChange={handleAccordion('workPackages')}
          disableGutters
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px !important', '&:before': { display: 'none' } }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <WorkIcon fontSize="small" color="action" />
              <Typography fontWeight={600}>{t('projects.panelWorkPackages')}</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <ProjectRoadmap
              project={project}
              onUpdate={p => setProject(p)}
              isManager={isManager}
            />
          </AccordionDetails>
        </Accordion>

        {/* Kanban */}
        <Accordion
          expanded={expanded === 'kanban'}
          onChange={handleAccordion('kanban')}
          disableGutters
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px !important', '&:before': { display: 'none' } }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <ViewKanbanIcon fontSize="small" color="action" />
              <Typography fontWeight={600}>{t('projects.panelKanban')}</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <EmptyPanel label={t('projects.panelKanbanEmpty')} />
          </AccordionDetails>
        </Accordion>
      </Box>

      {/* Edit dialog */}
      <ProjectDialog
        open={dialogOpen}
        initial={project}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </Container>
  );
}
