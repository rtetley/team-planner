import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { CssBaseline, Box } from '@mui/material';
import MuiDsfrThemeProvider from '@codegouvfr/react-dsfr/mui';
import { Header } from '@codegouvfr/react-dsfr/Header';
import { Footer } from '@codegouvfr/react-dsfr/Footer';
import { headerFooterDisplayItem } from '@codegouvfr/react-dsfr/Display';
import { LanguageSelect } from '@codegouvfr/react-dsfr/LanguageSelect';
import Dashboard from './pages/Dashboard';
import Team from './pages/Team';
import Projects from './pages/Projects';
import ProjectView from './pages/ProjectView';
import Tasks from './pages/Tasks';
import TeamMatrix from './pages/TeamMatrix';
import Objectives from './pages/Objectives';
import ObjectiveEdit from './pages/ObjectiveEdit';
import Skills from './pages/Skills';
import Login from './pages/Login';
import UserProfile from './pages/UserProfile';
import UserSkills from './pages/UserSkills';
import GitLabCallback from './pages/GitLabCallback';
import UserManagement from './pages/UserManagement';
import { ObjectivesProvider } from './context/ObjectivesContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { useTranslation } from 'react-i18next';

function AppContent() {
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();

  // ── Navigation items per role ────────────────────────────────────────────
  const managerNav = [
    { text: t('navigation.dashboard'), linkProps: { to: '/' },           isActive: location.pathname === '/' },
    { text: t('navigation.team'),      linkProps: { to: '/team' },       isActive: location.pathname === '/team' },
    { text: t('navigation.projects'),  linkProps: { to: '/projects' },   isActive: location.pathname === '/projects' },
    { text: t('navigation.tasks'),     linkProps: { to: '/tasks' },      isActive: location.pathname === '/tasks' },
    { text: t('navigation.skills'),    linkProps: { to: '/skills' },     isActive: location.pathname === '/skills' },
    { text: t('navigation.objectives'),linkProps: { to: '/objectives' }, isActive: location.pathname.startsWith('/objectives') },
  ];

  const userNav = [
    { text: t('auth.profileTitle'), linkProps: { to: '/profile' }, isActive: location.pathname === '/profile' },
    { text: t('navigation.tasks'),  linkProps: { to: '/tasks' },   isActive: location.pathname === '/tasks' },
    { text: t('navigation.skills'), linkProps: { to: '/skills' },  isActive: location.pathname === '/skills' },
  ];

  const navigation = !user ? [] : user.role === 'manager' ? managerNav : userNav;

  // ── Quick-access items ───────────────────────────────────────────────────
  const quickAccessItems = [
    headerFooterDisplayItem,
    <LanguageSelect
      key="language-select"
      lang={i18n.language}
      supportedLangs={['fr', 'en']}
      fullNameByLang={{ fr: 'Français', en: 'English' }}
      setLang={(lang: string) => i18n.changeLanguage(lang)}
    />,
    ...(user
      ? [          ...(user.role === 'manager'
            ? [{
                iconId: 'fr-icon-settings-5-line' as const,
                text: t('userManagement.settingsButton'),
                linkProps: { to: '/settings/users' },
              }]
            : []),          {
            iconId: 'fr-icon-user-line' as const,
            text: user.username,
            linkProps: { to: '/profile' },
          },
          {
            iconId: 'fr-icon-logout-box-r-line' as const,
            text: t('auth.logoutButton'),
            buttonProps: {
              onClick: () => logout(),
            },
          },
        ]
      : []),
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header
        brandTop={<>TEAM<br />TREE</>}
        serviceTitle={t('footer.serviceTitle')}
        homeLinkProps={{ to: '/', title: 'Accueil - TeamTree' }}
        navigation={navigation}
        quickAccessItems={quickAccessItems}
      />
      <Box component="main" sx={{ flexGrow: 1, bgcolor: 'background.default' }}>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<GitLabCallback />} />

          {/* Manager-only routes */}
          <Route path="/"           element={<ProtectedRoute requiredRole="manager"><Dashboard /></ProtectedRoute>} />
          <Route path="/team"       element={<ProtectedRoute requiredRole="manager"><Team /></ProtectedRoute>} />
          <Route path="/projects"      element={<ProtectedRoute requiredRole="manager"><Projects /></ProtectedRoute>} />
          <Route path="/projects/:id"  element={<ProtectedRoute requiredRole="manager"><ProjectView /></ProtectedRoute>} />
          <Route path="/matrix"     element={<ProtectedRoute requiredRole="manager"><TeamMatrix /></ProtectedRoute>} />
          <Route path="/skills"     element={<ProtectedRoute>{user?.role === 'manager' ? <Skills /> : <UserSkills />}</ProtectedRoute>} />
          <Route path="/objectives" element={<ProtectedRoute requiredRole="manager"><Objectives /></ProtectedRoute>} />
          <Route path="/objectives/new" element={<ProtectedRoute requiredRole="manager"><ObjectiveEdit /></ProtectedRoute>} />
          <Route path="/objectives/:id" element={<ProtectedRoute requiredRole="manager"><ObjectiveEdit /></ProtectedRoute>} />

          {/* Shared: tasks visible for both roles */}
          <Route path="/tasks"   element={<ProtectedRoute><Tasks /></ProtectedRoute>} />

          {/* User role home */}
          <Route path="/profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />

          {/* Settings */}
          <Route path="/settings/users" element={<ProtectedRoute requiredRole="manager"><UserManagement /></ProtectedRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Box>
      <Footer
        brandTop={<>TEAM<br />TREE</>}
        homeLinkProps={{ to: '/', title: t('footer.homeTitle') }}
        accessibility="fully compliant"
        contentDescription={t('footer.contentDescription')}
        bottomItems={[
          headerFooterDisplayItem,
          { text: t('footer.licenseText'), linkProps: { href: '#' } }
        ]}
        license={
          <>
            {t('footer.license')}{' '}
            <a href="https://github.com/etalab/licence-ouverte/blob/master/LO.md" target="_blank" rel="noopener">
              {t('footer.licenseLink')}
            </a>
          </>
        }
      />
    </Box>
  );
}

function App() {
  return (
    <Router>
      <MuiDsfrThemeProvider>
        <CssBaseline />
        <AuthProvider>
          <ObjectivesProvider>
            <AppContent />
          </ObjectivesProvider>
        </AuthProvider>
      </MuiDsfrThemeProvider>
    </Router>
  );
}

export default App;

