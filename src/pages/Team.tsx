import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  Box,
} from '@mui/material';
import { mockTeamMembers } from '../data/mockData';
import { useTranslation } from 'react-i18next';

export default function Team() {
  const { t } = useTranslation();
  
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h3" gutterBottom>
        {t('team.title')}
      </Typography>

      <Grid container spacing={3}>
        {mockTeamMembers.map((member) => (
          <Grid item xs={12} sm={6} md={4} key={member.id}>
            <Card>
              <CardContent>
                <Typography variant="h5" gutterBottom>
                  {member.name}
                </Typography>
                <Typography variant="subtitle1" color="textSecondary" gutterBottom>
                  {member.position}
                </Typography>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    {t('team.skills')}:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {member.skills.map((skill, index) => (
                      <Chip key={index} label={skill} size="small" />
                    ))}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}
