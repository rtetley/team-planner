import {
  Container,
  Typography,
  Box,
  Chip,
  Card,
  CardContent,
  Divider,
  IconButton,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useObjectives } from '../context/ObjectivesContext';
import { Quarter } from '../types';

const quarterColors: Record<Quarter, string> = {
  T1: '#3b82f6',
  T2: '#8b5cf6',
  T3: '#f97316',
  T4: '#22c55e',
};

export default function Objectives() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { objectives } = useObjectives();

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h3" gutterBottom>
        {t('objectives.title')}
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {objectives.map((objective) => (
          <Card key={objective.id} variant="outlined">
            <CardContent sx={{ p: 3 }}>
              {/* Title + Quarter chips + Edit button */}
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="h6" fontWeight="bold">
                    {objective.title}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => navigate(`/objectives/${objective.id}`)}
                    aria-label="edit"
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                  {objective.quarters.length > 0
                    ? objective.quarters.map((q) => (
                        <Chip
                          key={q}
                          label={q}
                          size="small"
                          sx={{
                            bgcolor: quarterColors[q],
                            color: '#fff',
                            fontWeight: 'bold',
                          }}
                        />
                      ))
                    : (
                        <Typography variant="caption" color="textSecondary">
                          {t('objectives.noQuarters')}
                        </Typography>
                      )
                  }
                </Box>
              </Box>

              {/* Markdown description */}
              <Box
                sx={{
                  '& p': { mt: 0, mb: 1, fontSize: '0.9rem' },
                  '& ul': { mt: 0, mb: 1, pl: 3 },
                  '& li': { fontSize: '0.9rem' },
                  '& strong': { fontWeight: 'bold' },
                  color: 'text.secondary',
                }}
              >
                <ReactMarkdown>{objective.description}</ReactMarkdown>
              </Box>

              <Divider sx={{ my: 1.5 }} />

              {/* KPI */}
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                <Typography variant="body2" fontWeight="bold" color="text.secondary" sx={{ flexShrink: 0 }}>
                  {t('objectives.kpi')}:
                </Typography>
                <Typography variant="body2">
                  {objective.kpi}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Container>
  );
}
