# Team Planner

A comprehensive team planning and management tool built with React, TypeScript, MUI, and the French Design System (DSFR).

## Features

- **Dashboard**: Overview of teams, projects, and tasks with key metrics
- **Team Management**: View team members with their positions and skills
- **Project Tracking**: Monitor projects with tech stacks and timespans
- **Task Management**: Track tasks with status, assignments, and project links
- **Team Maturity Matrix**: Assess team member maturity levels (M1-M4) for different tasks/objectives
- **DSFR Compliant**: Uses official French Design System Header and Footer components
- **Dark Mode**: Built-in theme switcher following DSFR standards

## Tech Stack

- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite
- **Package Manager**: Yarn
- **UI Libraries**: Material-UI (MUI) integrated with @codegouvfr/react-dsfr (French Design System)
- **Routing**: React Router v7

The project uses the official react-dsfr library which provides seamless integration between MUI components and the French Design System, ensuring components blend perfectly with DSFR styling.

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- Yarn

### Installation

```bash
yarn install
```

### Development

Run the development server:

```bash
yarn dev
```

The application will be available at `http://localhost:5173`

### Build

Create a production build:

```bash
yarn build
```

Preview the production build:

```bash
yarn preview
```

## Project Structure

```pages/           # Dashboard, Team, Projects, Tasks, TeamMatrix
├── types/           # TypeScript interfaces
├── data/            # Mock data for development
├── App.tsx          # Main app with DSFR Header/Footer and routing
└── main.tsx         # Entry point with react-dsfr initialization
```

## DSFR Integration

This project uses [@codegouvfr/react-dsfr](https://react-dsfr.codegouv.studio/) for proper integration of the French Design System with Material-UI. The integration includes:

- **MuiDsfrThemeProvider**: Wraps the entire app to apply DSFR theme to MUI components
- **DSFR Header**: Official navigation header with logo, service title, and navigation menu
- **DSFR Footer**: Official footer with branding and bottom items
- **Display Toggle**: Built-in dark/light mode switcher in header and footer

All MUI components automatically inherit DSFR styling, ensuring consistency across the application. App.tsx          # Main app component with routing
└── main.tsx         # Application entry point
```

## Team Maturity Matrix

The Team Maturity Matrix follows the management maturity model:

- **M1**: Initial/Beginner level
- **M2**: Developing competency
- **M3**: Proficient/Advanced
- **M4**: Expert/Master level

## License

Private project
