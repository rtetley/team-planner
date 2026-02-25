# Team Planner Project Setup

## Project Overview
React + TypeScript application using Vite, Yarn, MUI, and DSFR (French Design System) for team planning and management.

## Features
- Team management (name, position, skills)
- Project tracking (name, tech stack, timespan)
- Task management
- Team matrix tool (M1-M4 maturity grading)

## Tech Stack
- React + TypeScript
- Vite (build tool)
- Yarn (package manager)
- MUI (Material-UI)
- DSFR (French Design System)
- React Router

## Setup Progress
- [x] Create copilot-instructions.md
- [x] Scaffold the project
- [x] Customize the project
- [x] Install dependencies
- [x] Compile and test
- [x] Initialize Git repository

## Development

Run the development server:
```bash
yarn dev
```

Build for production:
```bash
yarn build
```

## Project Structure

```
src/
├── components/       # Navigation component
├── pages/           # Dashboard, Team, Projects, Tasks, TeamMatrix
├── types/           # TypeScript interfaces
├── data/            # Mock data for development
├── App.tsx          # Main app with routing
└── main.tsx         # Entry point
```
