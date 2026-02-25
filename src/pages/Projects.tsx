import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  Box,
} from '@mui/material';
import { mockProjects } from '../data/mockData';
import { useTranslation } from 'react-i18next';

export default function Projects() {
  const { t } = useTranslation();
  
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h3" gutterBottom>
        {t('projects.title')}
      </Typography>

      <Grid container spacing={3}>
        {mockProjects.map((project) => (
          <Grid item xs={12} md={6} key={project.id}>
            <Card>
              <CardContent>
                <Typography variant="h5" gutterBottom>
                  {project.name}
                </Typography>
                
                <Box sx={{ mt: 2, mb: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    {t('projects.techStack')}:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {project.techStack.map((tech, index) => (
                      <Chip key={index} label={tech} size="small" color="primary" />
                    ))}
                  </Box>
                </Box>

                <Typography variant="body2" color="textSecondary">
                  {t('projects.duration')}: {new Date(project.startDate).toLocaleDateString()} - {new Date(project.endDate).toLocaleDateString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}
