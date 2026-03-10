import { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  CircularProgress,
  Alert,
  Chip,
  Avatar,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useTranslation } from 'react-i18next';
import { usersApi } from '../api';
import { useAuth } from '../context/AuthContext';
import type { AuthUser, UserRole } from '../types';

export default function UserManagement() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Confirmation dialog for deletion
  const [deleteTarget, setDeleteTarget] = useState<AuthUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Per-row saving indicator
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await usersApi.getAll();
      setUsers(data);
    } catch {
      setError(t('userManagement.errorLoad'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const handleRoleChange = async (user: AuthUser, role: UserRole) => {
    setSavingId(user.id);
    try {
      const updated = await usersApi.updateRole(user.id, role);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch {
      setError(t('userManagement.errorUpdate'));
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await usersApi.remove(deleteTarget.id);
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      setError(t('userManagement.errorDelete'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 900, mx: 'auto' }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {t('userManagement.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t('userManagement.subtitle')}
      </Typography>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('userManagement.columnUser')}</TableCell>
                <TableCell>{t('userManagement.columnUsername')}</TableCell>
                <TableCell>{t('userManagement.columnRole')}</TableCell>
                <TableCell align="center">{t('userManagement.columnActions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u) => {
                const isSelf = u.id === currentUser?.id;
                const isSaving = savingId === u.id;
                return (
                  <TableRow key={u.id} hover>
                    {/* Avatar + display name */}
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar
                          src={u.avatarUrl}
                          alt={u.displayName ?? u.username}
                          sx={{ width: 32, height: 32, fontSize: 14 }}
                        >
                          {(u.displayName ?? u.username).charAt(0).toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={500}>
                            {u.displayName ?? u.username}
                          </Typography>
                          {isSelf && (
                            <Chip
                              label={t('userManagement.you')}
                              size="small"
                              color="primary"
                              variant="outlined"
                              sx={{ height: 18, fontSize: 11 }}
                            />
                          )}
                        </Box>
                      </Box>
                    </TableCell>

                    {/* Username */}
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {u.username}
                      </Typography>
                    </TableCell>

                    {/* Role selector */}
                    <TableCell>
                      <Select
                        size="small"
                        value={u.role}
                        disabled={isSelf || isSaving}
                        onChange={(e) => handleRoleChange(u, e.target.value as UserRole)}
                        sx={{ minWidth: 130 }}
                      >
                        <MenuItem value="manager">{t('userManagement.roleManager')}</MenuItem>
                        <MenuItem value="user">{t('userManagement.roleUser')}</MenuItem>
                      </Select>
                      {isSaving && (
                        <CircularProgress size={16} sx={{ ml: 1, verticalAlign: 'middle' }} />
                      )}
                    </TableCell>

                    {/* Delete */}
                    <TableCell align="center">
                      <Tooltip title={isSelf ? t('userManagement.cannotDeleteSelf') : t('userManagement.deleteTooltip')}>
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            disabled={isSelf}
                            onClick={() => setDeleteTarget(u)}
                            aria-label={t('userManagement.deleteTooltip')}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}

              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    {t('userManagement.noUsers')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)}>
        <DialogTitle>{t('userManagement.confirmDeleteTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('userManagement.confirmDelete', {
              username: deleteTarget?.displayName ?? deleteTarget?.username ?? '',
            })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>
            {t('userManagement.cancel')}
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} /> : undefined}
          >
            {t('userManagement.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
