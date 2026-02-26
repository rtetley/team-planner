import { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Divider,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useObjectives } from '../context/ObjectivesContext';
import { Objective, Quarter } from '../types';

const quarterColors: Record<Quarter, string> = {
  T1: '#3b82f6',
  T2: '#8b5cf6',
  T3: '#f97316',
  T4: '#22c55e',
};

const QUARTER_ORDER: Quarter[] = ['T1', 'T2', 'T3', 'T4'];

function getGridColumn(quarters: Quarter[]): string {
  if (!quarters.length) return '1 / 2';
  const indices = quarters
    .map((q) => QUARTER_ORDER.indexOf(q))
    .filter((i) => i !== -1);
  if (!indices.length) return '1 / 2';
  const min = Math.min(...indices);
  const max = Math.max(...indices);
  return `${min + 1} / ${max + 2}`;
}

export default function Objectives() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { objectives } = useObjectives();
  const [viewObjective, setViewObjective] = useState<Objective | null>(null);

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h3" gutterBottom>
        {t('objectives.title')}
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          columnGap: 1.5,
          rowGap: 1.5,
          gridAutoFlow: 'row dense',
        }}
      >
        {/* Column headers — explicit row 1 */}
        {QUARTER_ORDER.map((q, i) => (
          <Box
            key={q}
            sx={{
              gridColumn: i + 1,
              gridRow: 1,
              bgcolor: quarterColors[q],
              color: '#fff',
              p: 1.5,
              borderRadius: 1,
              textAlign: 'center',
            }}
          >
            <Typography variant="subtitle1" fontWeight="bold">
              {t(`objectives.${q}`)}
            </Typography>
          </Box>
        ))}

        {/* Objective cards — auto-placed from row 2 onwards */}
        {objectives.map((obj) => {
          const firstQuarter =
            QUARTER_ORDER.find((q) => obj.quarters.includes(q)) ?? 'T1';
          const accentColor = quarterColors[firstQuarter];
          return (
            <Card
              key={obj.id}
              variant="outlined"
              onClick={() => setViewObjective(obj)}
              sx={{
                gridColumn: getGridColumn(obj.quarters),
                borderTop: `4px solid ${accentColor}`,
                cursor: 'pointer',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                '&:hover': {
                  transform: 'scale(1.03)',
                  boxShadow: `0 6px 20px ${accentColor}44`,
                },
              }}
            >
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                {/* Title */}
                <Typography
                  variant="subtitle2"
                  fontWeight="bold"
                  sx={{ lineHeight: 1.4, mb: 1.5 }}
                >
                  {obj.title}
                </Typography>

                {/* KPI progress */}
                <Box>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      mb: 0.5,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {t('objectives.kpiProgress')}
                    </Typography>
                    <Typography
                      variant="caption"
                      fontWeight="bold"
                      sx={{ color: accentColor }}
                    >
                      {obj.kpiProgress}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={obj.kpiProgress}
                    sx={{
                      height: 6,
                      borderRadius: 3,
                      bgcolor: `${accentColor}22`,
                      '& .MuiLinearProgress-bar': {
                        bgcolor: accentColor,
                        borderRadius: 3,
                      },
                    }}
                  />
                </Box>
              </CardContent>
            </Card>
          );
        })}
      </Box>

      {/* View modal */}
      <Dialog
        open={!!viewObjective}
        onClose={() => setViewObjective(null)}
        maxWidth="sm"
        fullWidth
      >
        {viewObjective && (() => {
          const firstQ = QUARTER_ORDER.find((q) => viewObjective.quarters.includes(q)) ?? 'T1';
          const color = quarterColors[firstQ];
          return (
            <>
              <DialogTitle sx={{ borderTop: `4px solid ${color}`, pt: 2.5 }}>
                <Typography variant="h6" fontWeight="bold">
                  {viewObjective.title}
                </Typography>
              </DialogTitle>
              <DialogContent dividers>
                {/* Description */}
                <Box
                  sx={{
                    mb: 2,
                    '& p': { mt: 0, mb: 1, fontSize: '0.9rem' },
                    '& ul': { mt: 0, mb: 1, pl: 3 },
                    '& li': { fontSize: '0.9rem' },
                    '& strong': { fontWeight: 'bold' },
                  }}
                >
                  <ReactMarkdown>{viewObjective.description}</ReactMarkdown>
                </Box>

                <Divider sx={{ my: 1.5 }} />

                {/* KPI target */}
                <Box sx={{ mb: 1.5 }}>
                  <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                    {t('objectives.kpiField')}
                  </Typography>
                  <Typography variant="body2">{viewObjective.kpi}</Typography>
                </Box>

                <Divider sx={{ my: 1.5 }} />

                {/* KPI progress */}
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                    <Typography variant="caption" color="text.secondary">
                      {t('objectives.kpiProgress')}
                    </Typography>
                    <Typography variant="caption" fontWeight="bold" sx={{ color }}>
                      {viewObjective.kpiProgress}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={viewObjective.kpiProgress}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      bgcolor: `${color}22`,
                      '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 4 },
                    }}
                  />
                </Box>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setViewObjective(null)}>
                  {t('matrix.close')}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={() => {
                    setViewObjective(null);
                    navigate(`/objectives/${viewObjective.id}`);
                  }}
                >
                  {t('objectives.editButton')}
                </Button>
              </DialogActions>
            </>
          );
        })()}
      </Dialog>
    </Container>
  );
}
