import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState<string | null>(null);
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
      </Box>
    </Box>
  );
}
