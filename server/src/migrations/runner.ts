/**
 * Migration runner
 *
 * Usage (standalone CLI):
 *   yarn migrate
 *
 * Usage (programmatic – called by the server on startup):
 *   import { runMigrations } from './migrations/runner.js';
 *   await runMigrations(db);
 *
 * How it works:
 *   1. Reads `teamtree:schema-version` from Redis (defaults to 0 if absent).
 *   2. Collects all registered migrations with id > current version.
 *   3. Runs each one in ascending order, updating the version key after each
 *      successful migration so partial failures are safe to retry.
 *
 * How to add a new migration:
 *   1. Create `server/src/migrations/NNN_description.ts` (e.g. 003_add_tags.ts)
 *      and export a `migration` object matching the `Migration` interface.
 *   2. Import it below and append it to the `ALL_MIGRATIONS` array.
 */

import type { Redis } from 'ioredis';
import type { Migration } from './types.js';
export type { Migration } from './types.js';
import { migration as m001 } from './001_initial_schema.js';
import { migration as m002 } from './002_gitlab_oauth.js';

// ── Registry – append new migrations here ────────────────────────────────────

const ALL_MIGRATIONS: Migration[] = [m001, m002].sort((a, b) => a.id - b.id);

const VERSION_KEY = 'teamtree:schema-version';

// ── Core runner ───────────────────────────────────────────────────────────────

export async function runMigrations(db: Redis): Promise<void> {
  const raw = await db.get(VERSION_KEY);
  const currentVersion = raw ? parseInt(raw, 10) : 0;

  const pending = ALL_MIGRATIONS.filter((m) => m.id > currentVersion);

  if (pending.length === 0) {
    console.log(`[Migrate] Schema is up to date (v${currentVersion}).`);
    return;
  }

  console.log(
    `[Migrate] Current version: ${currentVersion}. ` +
    `Applying ${pending.length} pending migration(s)…`,
  );

  for (const migration of pending) {
    const label = `${String(migration.id).padStart(3, '0')}_${migration.name}`;
    console.log(`[Migrate] ▶ ${label}`);
    try {
      await migration.up(db);
      await db.set(VERSION_KEY, migration.id);
      console.log(`[Migrate] ✓ ${label} applied (schema v${migration.id})`);
    } catch (err) {
      console.error(`[Migrate] ✗ ${label} FAILED — aborting.`, err);
      throw err;
    }
  }

  console.log(
    `[Migrate] All migrations applied. ` +
    `Schema is now at v${pending[pending.length - 1].id}.`,
  );
}

// ── Standalone CLI entry point ────────────────────────────────────────────────

// Only run when executed directly (not when imported by the server)
if (import.meta.url === new URL(process.argv[1], 'file://').href) {
  import('../env.js').then(async () => {
    const { db } = await import('../db.js');
    try {
      await runMigrations(db);
    } finally {
      await db.quit();
    }
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
