import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  TextField,
  Button,
  Select,
  MenuItem,
  Chip,
  OutlinedInput,
  InputLabel,
  FormControl,
  SelectChangeEvent,
  Paper,
} from '@mui/material';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import { useObjectives } from '../context/ObjectivesContext';
import { Quarter } from '../types';

const QUARTERS: Quarter[] = ['T1', 'T2', 'T3', 'T4'];

const quarterColors: Record<Quarter, string> = {
  T1: '#3b82f6',
  T2: '#8b5cf6',
  T3: '#f97316',
  T4: '#22c55e',
};

export default function ObjectiveEdit() {
  const { id } = useParams();
  const { objectives, updateObjective } = useObjectives();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const objective = objectives.find((o) => o.id === id);

  const [title, setTitle] = useState(objective?.title ?? '');
  const [description, setDescription] = useState(objective?.description ?? '');
  const [kpi, setKpi] = useState(objective?.kpi ?? '');
  const [quarters, setQuarters] = useState<Quarter[]>(objective?.quarters ?? []);

  if (!objective) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Typography variant="h5" color="error">{t('objectives.notFound')}</Typography>
      </Container>
    );
  }

  const handleSave = () => {
    updateObjective({ ...objective, title, description, kpi, quarters });
    navigate('/objectives');
  };

  const handleQuartersChange = (event: SelectChangeEvent<Quarter[]>) => {
    const value = event.target.value;
    setQuarters(typeof value === 'string' ? (value.split(',') as Quarter[]) : value);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Breadcrumb title */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 4 }}>
        <Typography
          variant="h3"
          component="span"
          sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
          onClick={() => navigate('/objectives')}
        >
          {t('objectives.title')}
        </Typography>
        <Typography variant="h3" component="span" color="text.secondary"> / </Typography>
        <Typography variant="h3" component="span" color="text.secondary" sx={{ fontSize: '1.5rem' }}>
          {title || objective.title}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Title */}
        <TextField
          label={t('objectives.titleField')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          fullWidth
          required
        />

        {/* Markdown editor + preview */}
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {t('objectives.descriptionField')}
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <TextField
              multiline
              minRows={10}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              sx={{ fontFamily: 'monospace' }}
              inputProps={{ style: { fontFamily: 'monospace', fontSize: '0.875rem' } }}
            />
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                minHeight: 240,
                overflow: 'auto',
                '& p': { mt: 0, mb: 1, fontSize: '0.9rem' },
                '& ul': { mt: 0, mb: 1, pl: 3 },
                '& li': { fontSize: '0.9rem' },
                '& strong': { fontWeight: 'bold' },
                '& h1,& h2,& h3': { mt: 0 },
              }}
            >
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                {t('objectives.preview')}
              </Typography>
              <ReactMarkdown>{description}</ReactMarkdown>
            </Paper>
          </Box>
        </Box>

        {/* KPI */}
        <TextField
          label={t('objectives.kpiField')}
          value={kpi}
          onChange={(e) => setKpi(e.target.value)}
          fullWidth
        />

        {/* Quarters multi-select */}
        <FormControl fullWidth>
          <InputLabel>{t('objectives.quartersField')}</InputLabel>
          <Select
            multiple
            value={quarters}
            onChange={handleQuartersChange}
            input={<OutlinedInput label={t('objectives.quartersField')} />}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {(selected as Quarter[]).map((q) => (
                  <Chip
                    key={q}
                    label={q}
                    size="small"
                    sx={{ bgcolor: quarterColors[q], color: '#fff', fontWeight: 'bold' }}
                  />
                ))}
              </Box>
            )}
          >
            {QUARTERS.map((q) => (
              <MenuItem key={q} value={q}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: quarterColors[q] }} />
                  {q}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Actions */}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button variant="outlined" onClick={() => navigate('/objectives')}>
            {t('objectives.cancel')}
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={!title.trim()}>
            {t('objectives.save')}
          </Button>
        </Box>
      </Box>
    </Container>
  );
}
