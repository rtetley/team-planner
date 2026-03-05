import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import { useAuth } from '../context/AuthContext';
import { teamMembersApi, tasksApi, projectsApi } from '../api';
import type { TeamMember, Task, Project } from '../types';
import { useSkillColorMap } from '../hooks/useSkillColorMap';

const STATUS_COLORS: Record<Task['status'], 'default' | 'warning' | 'success'> = {
  todo: 'default',
  'in-progress': 'warning',
  done: 'success',
};

export default function UserProfile() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { byLabel: skillColors } = useSkillColorMap();

  const [member, setMember]   = useState<TeamMember | null>(null);
  const [tasks, setTasks]     = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!user?.teamMemberId) { setLoading(false); return; }

    Promise.all([teamMembersApi.getAll(), tasksApi.getAll(), projectsApi.getAll()])
      .then(([members, allTasks, allProjects]) => {
        const me = members.find((m) => m.id === user.teamMemberId) ?? null;
        const myTasks = allTasks.filter((t) => t.assignedTo === user.teamMemberId);
        setMember(me);
        setTasks(myTasks);
        setProjects(allProjects);
      })
      .catch(() => setError(t('auth.errorGeneric')))
      .finally(() => setLoading(false));
  }, [user, t]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) return <Alert severity="error" sx={{ m: 4 }}>{error}</Alert>;

  const getProjectName = (id?: string) => projects.find((p) => p.id === id)?.name ?? '—';

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', mt: 4, px: 2 }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
        {t('auth.profileTitle')}
      </Typography>

      {/* Personal info */}
      {member ? (
        <Box
          sx={{
            bgcolor: 'var(--background-raised-grey)',
            borderRadius: 1,
            p: 3,
            mb: 4,
            boxShadow: 'var(--raised-shadow)',
          }}
        >
          <Typography variant="h6" gutterBottom>{member.name}</Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {member.position}
          </Typography>
          <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {member.skills.map((skill) => {
              const color = skillColors.get(skill.toLowerCase());
              return (
                <Chip key={skill} label={skill} size="small" variant="outlined"
                  sx={color ? { borderColor: color, color } : {}}
                />
              );
            })}
          </Box>
        </Box>
      ) : (
        <Alert severity="info" sx={{ mb: 4 }}>
          {t('auth.noTasks')}
        </Alert>
      )}

      <Divider sx={{ mb: 3 }} />

      {/* Assigned tasks */}
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
        {t('auth.myTasks')}
      </Typography>

      {tasks.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {t('auth.noTasks')}
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {tasks.map((task) => (
            <Box
              key={task.id}
              sx={{
                bgcolor: 'var(--background-raised-grey)',
                borderRadius: 1,
                p: 2.5,
                boxShadow: 'var(--raised-shadow)',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {task.title}
                </Typography>
                <Chip
                  label={t(`tasks.status.${task.status}`)}
                  color={STATUS_COLORS[task.status]}
                  size="small"
                  sx={{ ml: 1, flexShrink: 0 }}
                />
              </Box>
              {task.description && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {task.description}
                </Typography>
              )}
              {task.projectId && (
                <Typography variant="caption" color="text.secondary">
                  {t('tasks.project')}: {getProjectName(task.projectId)}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
