import { useState, useEffect } from 'react';
import {
  Autocomplete,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  TextField,
  Typography,
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { teamMembersApi } from '../api';
import { AvailableMember, TeamMember } from '../types';
import { useTranslation } from 'react-i18next';
import { useSkillColorMap } from '../hooks/useSkillColorMap';
import { useAuth } from '../context/AuthContext';

export default function Team() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [availableMembers, setAvailableMembers] = useState<AvailableMember[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<AvailableMember[]>([]);
  const [saving, setSaving] = useState(false);
  const { byLabel: skillColors } = useSkillColorMap();

  const isManager = user?.role === 'manager';
  const myTeam = isManager
    ? teamMembers.filter((m) => m.managerId === user?.id)
    : teamMembers;

  useEffect(() => {
    teamMembersApi.getAll().then(setTeamMembers).catch(console.error);
  }, []);

  const openDialog = () => {
    teamMembersApi.getAvailable().then(setAvailableMembers).catch(console.error);
    setSelected([]);
    setDialogOpen(true);
  };

  const handleAddMembers = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const added = await Promise.all(
        selected.map((m) =>
          m._fromUserId
            ? teamMembersApi.createFromUser(m._fromUserId, user.id)
            : teamMembersApi.update({ ...m, managerId: user.id }),
        ),
      );
      setTeamMembers((prev) => {
        const updatedMap = new Map(added.map((u) => [u.id, u]));
        // Replace existing entries or append new ones
        const merged = prev.map((m) => updatedMap.get(m.id) ?? m);
        added.forEach((a) => { if (!prev.find((m) => m.id === a.id)) merged.push(a); });
        return merged;
      });
      setDialogOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h3">
          {t('team.title')}
        </Typography>
        {isManager && (
          <Button variant="contained" startIcon={<PersonAddIcon />} onClick={openDialog}>
            {t('team.addMember')}
          </Button>
        )}
      </Box>

      <Grid container spacing={3}>
        {myTeam.map((member) => (
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

      {/* Add Member Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('team.addMemberDialogTitle')}</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          {availableMembers.length === 0 ? (
            <Alert severity="info">{t('team.noMembersAvailable')}</Alert>
          ) : (
            <Autocomplete
              multiple
              options={availableMembers}
              getOptionLabel={(m) =>
                m._fromUserId
                  ? `${m.name} (GitLab)`
                  : m.position
                  ? `${m.name} — ${m.position}`
                  : m.name
              }
              value={selected}
              onChange={(_, val) => setSelected(val)}
              renderInput={(params) => (
                <TextField {...params} label={t('team.addMemberSelectLabel')} autoFocus />
              )}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('team.addMemberCancel')}</Button>
          <Button
            variant="contained"
            onClick={handleAddMembers}
            disabled={selected.length === 0 || saving}
          >
            {t('team.addMemberConfirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
