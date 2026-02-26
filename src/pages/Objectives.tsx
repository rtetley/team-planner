import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  LinearProgress,
  IconButton,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
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
              sx={{
                gridColumn: getGridColumn(obj.quarters),
                borderTop: `4px solid ${accentColor}`,
              }}
            >
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                {/* Title + edit button */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 1,
                    mb: 1.5,
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    fontWeight="bold"
                    sx={{ lineHeight: 1.4 }}
                  >
                    {obj.title}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => navigate(`/objectives/${obj.id}`)}
                    aria-label="edit"
                    sx={{ flexShrink: 0, mt: -0.25 }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Box>

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
    </Container>
  );
}
