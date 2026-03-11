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
│   ├── updateSkillTree.ts  # Migration script – loads a skill tree JSON into Valkey
│   └── routes/
│       ├── teamMembers.ts  # GET / POST / PUT /:id / DELETE /:id
│       ├── projects.ts
│       ├── tasks.ts
│       ├── objectives.ts
│       ├── matrix.ts       # Task maturity matrix  – PUT/DELETE /:teamMemberId/:taskId
│       ├── skillMatrix.ts  # Skill maturity matrix – PUT/DELETE /:teamMemberId/:skillId
│       └── skillTree.ts    # Skill tree definition  – GET /
├── package.json
└── tsconfig.json
```

### Request flow

```
Vite dev server (port 5173)
  └─ /api/* proxy ──► Hono server (port 3001)
                          └─ ioredis ──► Valkey (port 6379)
```

The Vite frontend proxies all `/teamtree/api` requests to the Hono server, so there are no CORS issues in development. In production, both the static build and the API should sit behind a reverse proxy (e.g. Nginx) on the same origin.

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
| `teamtree:skill-tree`     | *(string key)*             | JSON-serialised `SkillTreeDoc` (treeId, version, root) |

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

### 2. Configure environment

Copy the development example and adjust if needed:

```bash
cp ../deploy/.env.development.example .env
```

### 3. Seed the database

```bash
yarn seed
```

To wipe existing data and re-seed from scratch:

```bash
FLUSH_BEFORE_SEED=1 yarn seed
```

### 4. Load the skill tree

The Skills tab requires a skill tree to be loaded into Valkey before it will work:

```bash
yarn update-skill-tree
```

See [Scripts reference — `yarn update-skill-tree`](#yarn-update-skill-tree-path) for full details.

### 5. Start the dev server

```bash
yarn dev
```

The server starts with `tsx watch`, so it hot-reloads on any file change. You should see:

```
[Valkey] Connected to redis://127.0.0.1:6379
[TeamTree Server] Listening on http://localhost:3001
```

### 6. Verify

```bash
curl http://localhost:3001/api/health
# → {"status":"ok"}

curl http://localhost:3001/api/team-members
```

---

## Scripts reference

All scripts are run from the `server/` directory with `yarn <script>`.

---

### `yarn dev`

Starts the development server with `tsx watch`. The process hot-reloads on any source file change.

```bash
yarn dev
```

---

### `yarn build` / `yarn start`

Compiles TypeScript to `dist/` and then runs the compiled output.

```bash
yarn build   # tsc → dist/
yarn start   # node dist/index.js
```

---

### `yarn seed`

Populates Valkey with demo data (team members, projects, tasks, objectives, matrix cells and a default manager account). Safe to run multiple times — it skips collections that already contain data.

```bash
yarn seed
```

To wipe all existing data and start fresh:

```bash
FLUSH_BEFORE_SEED=1 yarn seed
```

> **Note:** the seed script does not load the skill tree. Run `yarn update-skill-tree` separately for that.

---

### `yarn update-skill-tree [path]`

Reads a skill tree JSON file, converts the flat `nodes` array into a nested tree, and writes the result to Valkey. By default it looks for `../research_engineer.json` (i.e. the project root when run from `server/`). An explicit path can be passed as the first argument.

```bash
# Use the default path (../research_engineer.json)
yarn update-skill-tree

# Use a custom file
yarn update-skill-tree /path/to/my_tree.json
```

The script is **idempotent** — if the same `treeId` and `version` are already stored it exits without writing. To force an overwrite (e.g. after editing node labels):

```bash
FORCE=1 yarn update-skill-tree
```

---

### `yarn migrate`

Runs all pending database migrations in order. Migrations are numbered scripts in `src/migrations/` and are tracked in Valkey so each one runs only once.

```bash
yarn migrate
```

This is run automatically when the server starts (`yarn dev` or `yarn start`), so you rarely need to call it manually. It is useful when running migrations independently — e.g. on a fresh database or before starting the server for the first time.

---

### `yarn users [command] [id|username]`

CLI tool for user administration. Operates directly on the Valkey database — no running server required.

| Command | Description |
|---|---|
| `yarn users` *(or `yarn users list`)* | Print a table of all users with their ID, username, display name, role and auth method |
| `yarn users promote <id\|username>` | Grant the `manager` role to the specified user |
| `yarn users demote  <id\|username>` | Revoke the `manager` role (resets to `user`) |

```bash
# List all users
yarn users

# Promote by username
yarn users promote alice

# Promote by ID
yarn users promote a3f1c2d4-...

# Demote
yarn users demote bob
```

---

## Environment variables

| Variable          | Default                      | Description                          |
|-------------------|------------------------------|--------------------------------------|
| `VALKEY_URL`      | `redis://127.0.0.1:6379`     | Connection URL for Valkey / Redis     |
| `PORT`            | `3001`                       | Port the HTTP server listens on       |
| `FLUSH_BEFORE_SEED` | *(unset)*                  | Set to `1` to force a full re-seed   |
| `FORCE`           | *(unset)*                    | Set to `1` to overwrite an existing skill tree even if `treeId` + `version` match |

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

### Skill tree — `/api/skill-tree`

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET    | `/`  | —    | Returns the full `SkillTreeDoc` (`{ treeId, version, root }`) stored by `update-skill-tree`. Returns `404` if the script has not been run yet. |

The `root` field is a nested `SkillTreeNode` tree:

```jsonc
{
  "treeId": "dc9583d6-...",
  "version": 1,
  "root": {
    "id": "root",
    "label": "Research Engineer",
    "children": [
      {
        "id": "development",
        "label": "Development",
        "children": [ ... ]
      }
    ]
  }
}
```

From the **monorepo root**, open two terminals:

```bash
# Terminal 1 – API server
cd server && yarn dev

# Terminal 2 – Vite frontend
yarn dev
```

The frontend runs on `http://localhost:5173` and proxies all `/teamtree/api` calls to the server on port 3001.

---
