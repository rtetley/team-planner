import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState<string | null>(() => {
    const e = searchParams.get('error');
    if (!e) return null;
    const map: Record<string, string> = {
      gitlab_denied:        t('auth.gitlabDenied'),
      invalid_state:        t('auth.gitlabInvalidState'),
      token_exchange_failed: t('auth.errorGeneric'),
      user_fetch_failed:    t('auth.errorGeneric'),
      missing_token:        t('auth.errorGeneric'),
      token_invalid:        t('auth.errorGeneric'),
    };
    return map[e] ?? t('auth.errorGeneric');
  });
  const [loading, setLoading]   = useState(false);

  const from = (location.state as { from?: string })?.from ?? '/';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const status = err instanceof Error && err.message.includes('401');
      setError(status ? t('auth.errorInvalid') : t('auth.errorGeneric'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'var(--background-default-grey)',
      }}
    >
      <Box
        component="main"
        sx={{
          width: '100%',
          maxWidth: 480,
          p: 4,
          bgcolor: 'var(--background-raised-grey)',
          borderRadius: 1,
          boxShadow: 'var(--raised-shadow)',
        }}
      >
        {/* DSFR logo mark */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              bgcolor: 'var(--background-action-high-blue-france)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span
              className="fr-icon-team-line"
              style={{ color: 'white', fontSize: 24 }}
              aria-hidden
            />
          </Box>
        </Box>

        <Typography
          variant="h4"
          component="h1"
          align="center"
          gutterBottom
          sx={{ fontWeight: 700, mb: 3 }}
        >
          TeamTree
        </Typography>

        <Typography variant="body2" align="center" sx={{ mb: 3, color: 'text.secondary' }}>
          {t('auth.loginTitle')}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <Input
            label={t('auth.usernameLabel')}
            nativeInputProps={{
              id: 'username',
              name: 'username',
              autoComplete: 'username',
              autoFocus: true,
              value: username,
              onChange: (e) => setUsername(e.target.value),
              required: true,
            }}
          />

          <Input
            label={t('auth.passwordLabel')}
            nativeInputProps={{
              id: 'password',
              name: 'password',
              type: 'password',
              autoComplete: 'current-password',
              value: password,
              onChange: (e) => setPassword(e.target.value),
              required: true,
            }}
          />

          {loading ? (
            <Button
              type="submit"
              disabled
              style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }}
            >
              <CircularProgress size={16} sx={{ mr: 1 }} />
              {t('auth.loggingIn')}
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={!username || !password}
              iconId="ri-login-circle-line"
              iconPosition="right"
              style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }}
            >
              {t('auth.loginButton')}
            </Button>
          )}
        </form>

        <Divider sx={{ my: 3 }}>
          <Typography variant="caption" color="text.secondary">
            {t('auth.orDivider')}
          </Typography>
        </Divider>

        {/* GitLab OAuth */}
        <Button
          priority="secondary"
          iconId="ri-gitlab-line"
          iconPosition="left"
          style={{ width: '100%', justifyContent: 'center' }}
          nativeButtonProps={{
            onClick: () => { window.location.href = '/api/auth/gitlab'; },
            type: 'button',
          }}
        >
          {t('auth.gitlabButton')}
        </Button>
      </Box>
    </Box>
  );
}
