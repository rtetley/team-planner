import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

/**
 * Landing page for the GitLab OAuth callback.
 * The server redirects here with ?token=<session_token> after a successful
 * authorization. This component stores the token and navigates to the app.
 */
export default function GitLabCallback() {
  const { t } = useTranslation();
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const handled = useRef(false);

  useEffect(() => {
    // Prevent double-execution in React Strict Mode
    if (handled.current) return;
    handled.current = true;

    const token = searchParams.get('token');

    if (!token) {
      navigate('/login?error=missing_token', { replace: true });
      return;
    }

    loginWithToken(token)
      .then(() => navigate('/', { replace: true }))
      .catch((err: unknown) => {
        console.error('[GitLabCallback] token validation failed:', err);
        navigate('/login?error=token_invalid', { replace: true });
      });
  }, [loginWithToken, navigate, searchParams]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        bgcolor: 'var(--background-default-grey)',
      }}
    >
      <CircularProgress />
      <Typography variant="body1" color="text.secondary">
        {t('auth.gitlabCallbackLoading')}
      </Typography>
    </Box>
  );
}
