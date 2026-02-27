import { useState, useEffect } from 'react';
import { Container, Typography, Grid, Card, CardContent, Box } from '@mui/material';
import { teamMembersApi, projectsApi, tasksApi } from '../api';
import { TeamMember, Project, Task } from '../types';
import { useTranslation } from 'react-i18next';

export default function Dashboard() {
  const { t } = useTranslation();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    Promise.all([
      teamMembersApi.getAll(),
      projectsApi.getAll(),
      tasksApi.getAll(),
    ]).then(([members, projs, ts]) => {
      setTeamMembers(members);
      setProjects(projs);
      setTasks(ts);
    }).catch(console.error);
  }, []);

  const tasksInProgress = tasks.filter((task) => task.status === 'in-progress').length;
  const tasksDone = tasks.filter((task) => task.status === 'done').length;

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h3" gutterBottom>
        {t('dashboard.title')}
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                {t('dashboard.teamMembers')}
              </Typography>
              <Typography variant="h4">
                {teamMembers.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                {t('dashboard.activeProjects')}
              </Typography>
              <Typography variant="h4">
                {projects.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                {t('dashboard.openTasks')}
              </Typography>
              <Typography variant="h4">
                {tasksInProgress}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Tasks Completed
              </Typography>
              <Typography variant="h4">
                {tasksDone}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Projects
              </Typography>
              {projects.slice(0, 3).map((project) => (
                <Box key={project.id} sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {project.name}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {project.techStack.join(', ')}
                  </Typography>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Team Overview
              </Typography>
              {teamMembers.slice(0, 4).map((member) => (
                <Box key={member.id} sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {member.name}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {member.position}
                  </Typography>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}
