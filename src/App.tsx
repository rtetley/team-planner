import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { CssBaseline, Box } from '@mui/material';
import MuiDsfrThemeProvider from '@codegouvfr/react-dsfr/mui';
import { Header } from '@codegouvfr/react-dsfr/Header';
import { Footer } from '@codegouvfr/react-dsfr/Footer';
import { headerFooterDisplayItem } from '@codegouvfr/react-dsfr/Display';
import Dashboard from './pages/Dashboard';
import Team from './pages/Team';
import Projects from './pages/Projects';
import Tasks from './pages/Tasks';
import TeamMatrix from './pages/TeamMatrix';

function AppContent() {
  const location = useLocation();

  const navigation = [
    {
      text: 'Dashboard',
      linkProps: { to: '/' },
      isActive: location.pathname === '/'
    },
    {
      text: 'Team',
      linkProps: { to: '/team' },
      isActive: location.pathname === '/team'
    },
    {
      text: 'Projects',
      linkProps: { to: '/projects' },
      isActive: location.pathname === '/projects'
    },
    {
      text: 'Tasks',
      linkProps: { to: '/tasks' },
      isActive: location.pathname === '/tasks'
    },
    {
      text: 'Team Matrix',
      linkProps: { to: '/matrix' },
      isActive: location.pathname === '/matrix'
    }
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header
        brandTop={
          <>
            TEAM
            <br />
            PLANNER
          </>
        }
        serviceTitle="Team Planning Tool"
        homeLinkProps={{
          to: '/',
          title: 'Accueil - Team Planner'
        }}
        navigation={navigation}
        quickAccessItems={[headerFooterDisplayItem]}
      />
      <Box component="main" sx={{ flexGrow: 1, bgcolor: 'background.default' }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/team" element={<Team />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/matrix" element={<TeamMatrix />} />
        </Routes>
      </Box>
      <Footer
        brandTop={
          <>
            TEAM
            <br />
            PLANNER
          </>
        }
        homeLinkProps={{
          to: '/',
          title: 'Accueil - Team Planner'
        }}
        accessibility="fully compliant"
        contentDescription="Team Planner is a comprehensive tool for managing software development teams, projects, and tasks. Built with React, TypeScript, MUI, and the French Design System (DSFR)."
        bottomItems={[
          headerFooterDisplayItem,
          {
            text: 'License',
            linkProps: {
              href: '#'
            }
          }
        ]}
      />
    </Box>
  );
}

function App() {
  return (
    <Router>
      <MuiDsfrThemeProvider>
        <CssBaseline />
        <AppContent />
      </MuiDsfrThemeProvider>
    </Router>
  );
}

export default App;
