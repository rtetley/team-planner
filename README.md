# Team Planner

A comprehensive team planning and management tool built with React, TypeScript, MUI, and the French Design System (DSFR).

## Features

- **Dashboard**: Overview of teams, projects, and tasks with key metrics
- **Team Management**: View team members with their positions and skills
- **Project Tracking**: Monitor projects with tech stacks and timespans
- **Task Management**: Track tasks with status, assignments, and project links
- **Team Maturity Matrix**: Assess team member maturity levels (M1-M4) for different tasks/objectives

## Tech Stack

- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite
- **Package Manager**: Yarn
- **UI Libraries**: Material-UI (MUI) and DSFR (French Design System)
- **Routing**: React Router v7

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

```
src/
├── components/       # Reusable UI components
├── pages/           # Page components
├── types/           # TypeScript type definitions
├── data/            # Mock data
├── App.tsx          # Main app component with routing
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
