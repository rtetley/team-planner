import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  Box,
} from '@mui/material';
import { tasksApi, teamMembersApi, projectsApi } from '../api';
import { Task, TeamMember, Project } from '../types';
import { useTranslation } from 'react-i18next';

export default function Tasks() {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    Promise.all([
      tasksApi.getAll(),
      teamMembersApi.getAll(),
      projectsApi.getAll(),
    ]).then(([ts, members, projs]) => {
      setTasks(ts);
      setTeamMembers(members);
      setProjects(projs);
    }).catch(console.error);
  }, []);

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
    return teamMembers.find((m) => m.id === id)?.name || 'Unknown';
  };

  const getProjectName = (id?: string) => {
    if (!id) return 'No project';
    return projects.find((p) => p.id === id)?.name || 'Unknown';
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h3" gutterBottom>
        {t('tasks.title')}
      </Typography>

      <Grid container spacing={3}>
        {tasks.map((task) => (
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
