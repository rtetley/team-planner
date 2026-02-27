# TeamTree Server

REST API backend for TeamTree, built with **Hono** on Node.js and **Valkey** (Redis-compatible) for persistence.

---

## Architecture

```
server/
├── src/
│   ├── index.ts          # Entry point – Hono app, CORS, route mounting
│   ├── db.ts             # ioredis client + hash key constants
│   ├── types.ts          # Shared TypeScript interfaces
│   ├── seed.ts           # One-shot seed script (populates Valkey from mock data)
│   └── routes/
│       ├── teamMembers.ts  # GET / POST / PUT /:id / DELETE /:id
│       ├── projects.ts
│       ├── tasks.ts
│       ├── objectives.ts
│       ├── matrix.ts       # Task maturity matrix  – PUT/DELETE /:teamMemberId/:taskId
│       └── skillMatrix.ts  # Skill maturity matrix – PUT/DELETE /:teamMemberId/:skillId
├── package.json
└── tsconfig.json
```

### Request flow

```
Vite dev server (port 5173)
  └─ /api/* proxy ──► Hono server (port 3001)
                          └─ ioredis ──► Valkey (port 6379)
```

The Vite frontend proxies all `/api` requests to the Hono server, so there are no CORS issues in development. In production, both the static build and the API should sit behind a reverse proxy (e.g. Nginx) on the same origin.

### Data storage

Each collection is stored as a **Redis Hash** in Valkey:

| Hash key                  | Field key                  | Value                     |
|---------------------------|----------------------------|---------------------------|
| `teamtree:members`        | `<id>`                     | JSON-serialised object    |
| `teamtree:projects`       | `<id>`                     | JSON-serialised object    |
| `teamtree:tasks`          | `<id>`                     | JSON-serialised object    |
| `teamtree:objectives`     | `<id>`                     | JSON-serialised object    |
| `teamtree:matrix`         | `<teamMemberId>:<taskId>`  | MaturityLevel (`M1`–`M4`) |
| `teamtree:skill-matrix`   | `<teamMemberId>:<skillId>` | MaturityLevel (`M1`–`M4`) |

IDs for new records are generated server-side with `crypto.randomUUID()`.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | ≥ 20 | |
| Yarn | 1.x | or npm |
| Valkey / Redis | ≥ 7 | must be running before starting the server |

### Install Valkey (macOS)

```bash
brew install valkey
brew services start valkey
```

Valkey listens on `127.0.0.1:6379` by default, which matches the server's default `VALKEY_URL`.

---

## Development setup

### 1. Install dependencies

```bash
cd server
yarn install
```

### 2. Seed the database

Populates Valkey with initial demo data (team members, projects, tasks, objectives and matrix cells). The seed script is idempotent — it will skip if data is already present.

```bash
yarn seed
```

To wipe existing data and re-seed from scratch:

```bash
FLUSH_BEFORE_SEED=1 yarn seed
```

### 3. Start the dev server

```bash
yarn dev
```

The server starts with `tsx watch`, so it hot-reloads on any file change. You should see:

```
[Valkey] Connected to redis://127.0.0.1:6379
[TeamTree Server] Listening on http://localhost:3001
```

### 4. Verify

```bash
curl http://localhost:3001/api/health
# → {"status":"ok"}

curl http://localhost:3001/api/team-members
```

---

## Environment variables

| Variable          | Default                      | Description                          |
|-------------------|------------------------------|--------------------------------------|
| `VALKEY_URL`      | `redis://127.0.0.1:6379`     | Connection URL for Valkey / Redis     |
| `PORT`            | `3001`                       | Port the HTTP server listens on       |
| `FLUSH_BEFORE_SEED` | *(unset)*                  | Set to `1` to force a full re-seed   |

---

## API reference

All routes are prefixed with `/api`.

### Team members — `/api/team-members`

| Method | Path  | Body                          | Description       |
|--------|-------|-------------------------------|-------------------|
| GET    | `/`   | —                             | List all members  |
| POST   | `/`   | `{ name, position, skills }`  | Create a member   |
| PUT    | `/:id`| `{ name, position, skills }`  | Replace a member  |
| DELETE | `/:id`| —                             | Delete a member   |

### Projects — `/api/projects`

| Method | Path  | Body                                          | Description       |
|--------|-------|-----------------------------------------------|-------------------|
| GET    | `/`   | —                                             | List all projects |
| POST   | `/`   | `{ name, techStack, startDate, endDate }`     | Create a project  |
| PUT    | `/:id`| `{ name, techStack, startDate, endDate }`     | Replace a project |
| DELETE | `/:id`| —                                             | Delete a project  |

### Tasks — `/api/tasks`

| Method | Path  | Body                                                        | Description    |
|--------|-------|-------------------------------------------------------------|----------------|
| GET    | `/`   | —                                                           | List all tasks |
| POST   | `/`   | `{ title, description, status, assignedTo?, projectId? }`  | Create a task  |
| PUT    | `/:id`| `{ title, description, status, assignedTo?, projectId? }`  | Replace a task |
| DELETE | `/:id`| —                                                           | Delete a task  |

### Objectives — `/api/objectives`

| Method | Path  | Body                                                    | Description          |
|--------|-------|---------------------------------------------------------|----------------------|
| GET    | `/`   | —                                                       | List all objectives  |
| POST   | `/`   | `{ title, description, kpi, kpiProgress, quarters }`   | Create an objective  |
| PUT    | `/:id`| `{ title, description, kpi, kpiProgress, quarters }`   | Replace an objective |
| DELETE | `/:id`| —                                                       | Delete an objective  |

### Task maturity matrix — `/api/matrix`

| Method | Path                        | Body                    | Description        |
|--------|-----------------------------|-------------------------|--------------------|
| GET    | `/`                         | —                       | All matrix cells   |
| PUT    | `/:teamMemberId/:taskId`    | `{ maturityLevel }`     | Upsert a cell      |
| DELETE | `/:teamMemberId/:taskId`    | —                       | Clear a cell       |

### Skill maturity matrix — `/api/skill-matrix`

| Method | Path                         | Body                    | Description        |
|--------|------------------------------|-------------------------|--------------------|
| GET    | `/`                          | —                       | All skill cells    |
| PUT    | `/:teamMemberId/:skillId`    | `{ maturityLevel }`     | Upsert a skill cell|
| DELETE | `/:teamMemberId/:skillId`    | —                       | Clear a skill cell |

Valid `maturityLevel` values: `M1` · `M2` · `M3` · `M4`

---

## Running the full stack

From the **monorepo root**, open two terminals:

```bash
# Terminal 1 – API server
cd server && yarn dev

# Terminal 2 – Vite frontend
yarn dev
```

The frontend runs on `http://localhost:5173` and proxies all `/api` calls to the server on port 3001.

---

## Production build

```bash
yarn build          # compiles TypeScript → dist/
yarn start          # runs node dist/index.js
```
