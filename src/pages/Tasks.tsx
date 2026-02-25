import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  Box,
} from '@mui/material';
import { mockTasks, mockTeamMembers, mockProjects } from '../data/mockData';
import { useTranslation } from 'react-i18next';

export default function Tasks() {
  const { t } = useTranslation();
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done':
        return 'success';
      case 'in-progress':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getMemberName = (id?: string) => {
    if (!id) return 'Unassigned';
    return mockTeamMembers.find((m) => m.id === id)?.name || 'Unknown';
  };

  const getProjectName = (id?: string) => {
    if (!id) return 'No project';
    return mockProjects.find((p) => p.id === id)?.name || 'Unknown';
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h3" gutterBottom>
        {t('tasks.title')}
      </Typography>

      <Grid container spacing={3}>
        {mockTasks.map((task) => (
          <Grid item xs={12} md={6} key={task.id}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Typography variant="h6">
                    {task.title}
                  </Typography>
                  <Chip 
                    label={t(`tasks.status.${task.status}`)} 
                    size="small" 
                    color={getStatusColor(task.status) as any}
                  />
                </Box>
                
                <Typography variant="body2" color="textSecondary" paragraph>
                  {task.description}
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography variant="caption">
                    <strong>{t('tasks.assignedTo')}:</strong> {getMemberName(task.assignedTo)}
                  </Typography>
                  <Typography variant="caption">
                    <strong>{t('tasks.project')}:</strong> {getProjectName(task.projectId)}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}
