import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Button,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DescriptionIcon from '@mui/icons-material/Description';
import HubIcon from '@mui/icons-material/Hub';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { useTranslation } from 'react-i18next';
import { jobsApi } from '../api';
import type { JobSheet } from '../types';
import { useAuth } from '../context/AuthContext';
import JobSheetContent from './JobSheetContent';
import JobSkillTree from './JobSkillTree';

// ── Page ──────────────────────────────────────────────────────────────────────
export default function JobView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const isManager = user?.role === 'manager';

  const [job, setJob]           = useState<JobSheet | null>(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [expanded, setExpanded] = useState<string | false>('content');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    jobsApi.getAll()
      .then(all => {
        const found = all.find(j => j.id === id);
        if (found) setJob(found);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  const handleAccordion = (panel: string) => (_: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  const handleDelete = async () => {
    if (!job) return;
    setDeleting(true);
    try {
      await jobsApi.remove(job.id);
      navigate('/jobs');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (notFound || !job) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Typography color="error">{t('jobs.notFound')}</Typography>
        <Button sx={{ mt: 2 }} startIcon={<ArrowBackIcon />} onClick={() => navigate('/jobs')}>
          {t('jobs.backToList')}
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>

      {/* ── Breadcrumb / title row ── */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5 }}>
        <Typography
          variant="h3" component="span"
          sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
          onClick={() => navigate('/jobs')}
        >
          {t('jobs.title')}
        </Typography>
        <Typography variant="h3" component="span" color="text.secondary"> / </Typography>
        <Typography variant="h3" component="span" color="text.secondary" sx={{ fontSize: '1.5rem' }}>
          {job.title}
        </Typography>
      </Box>

      {/* ── Summary bar ── */}
      <Box sx={{
        mt: 2, mb: 4, p: 2.5,
        border: '1px solid', borderColor: 'divider', borderRadius: 2,
        bgcolor: 'var(--background-raised-grey)',
        display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          {/* Description */}
          <Box sx={{ flex: 1 }}>
            {job.description?.trim() ? (
              <MarkdownRenderer sx={{ fontSize: '0.9rem' }}>{job.description}</MarkdownRenderer>
            ) : (
              <Typography variant="body2" color="text.disabled" fontStyle="italic">
                {t('jobs.noDescription')}
              </Typography>
            )}
          </Box>

          {/* Delete button (manager only) */}
          {isManager && (
            <Button
              size="small"
              color="error"
              variant="outlined"
              startIcon={<DeleteIcon />}
              onClick={() => setDeleteOpen(true)}
            >
              {t('jobs.delete')}
            </Button>
          )}
        </Box>
      </Box>

      {/* ── Collapsible panels ── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>

        {/* Job Sheet content */}
        <Accordion
          expanded={expanded === 'content'}
          onChange={handleAccordion('content')}
          disableGutters
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px !important', '&:before': { display: 'none' } }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <DescriptionIcon fontSize="small" color="action" />
              <Typography fontWeight={600}>{t('jobs.panelContent')}</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 2 }}>
            <JobSheetContent
              job={job}
              onUpdate={j => setJob(j)}
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
              <Typography fontWeight={600}>{t('jobs.panelSkillTree')}</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 2 }}>
            <JobSkillTree
              job={job}
              onUpdate={j => setJob(j)}
              isManager={isManager}
            />
          </AccordionDetails>
        </Accordion>
      </Box>

      {/* Delete confirmation */}
      <Dialog open={deleteOpen} onClose={() => !deleting && setDeleteOpen(false)}>
        <DialogTitle>{t('jobs.confirmDeleteTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('jobs.confirmDelete', { title: job.title })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)} disabled={deleting}>
            {t('jobs.cancel')}
          </Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} /> : <DeleteIcon />}
          >
            {t('jobs.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
