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
import { teamMembersApi } from '../api';
import { TeamMember } from '../types';
import { useTranslation } from 'react-i18next';
import { useSkillColorMap } from '../hooks/useSkillColorMap';

export default function Team() {
  const { t } = useTranslation();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const { byLabel: skillColors } = useSkillColorMap();

  useEffect(() => {
    teamMembersApi.getAll().then(setTeamMembers).catch(console.error);
  }, []);
  
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h3" gutterBottom>
        {t('team.title')}
      </Typography>

      <Grid container spacing={3}>
        {teamMembers.map((member) => (
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
                    {member.skills.map((skill, index) => {
                      const color = skillColors.get(skill.toLowerCase());
                      return (
                        <Chip key={index} label={skill} size="small"
                          variant="outlined"
                          sx={color ? { borderColor: color, color } : {}}
                        />
                      );
                    })}
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
