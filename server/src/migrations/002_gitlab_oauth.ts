/**
 * Migration 002 – GitLab OAuth
 *
 * Adds support for GitLab OAuth accounts.
 *
 * Schema changes:
 *   teamtree:users        – User records gain optional fields:
 *                             gitlabId?: number
 *                             displayName?: string
 *                             avatarUrl?: string
 *                           passwordHash is now optional (absent for OAuth-only
 *                           accounts).  Existing local accounts are not
 *                           affected because all new fields are additive.
 *   teamtree:gitlab-ids   – NEW Hash  { gitlabId (string) → userId }
 *                           Created automatically when the first GitLab user
 *                           logs in; nothing to pre-populate here.
 *   teamtree:oauth-states – NEW ephemeral String keys with TTL (CSRF state).
 *                           Self-managed; no data migration needed.
 *
 * Data transformation:
 *   Scan every User record and ensure the shape is valid.  Because all new
 *   fields are optional this is essentially a no-op for existing records, but
 *   the scan acts as a health-check and will surface any corrupt JSON early.
 */
import type { Redis } from 'ioredis';
import type { Migration } from './types.js';
import type { User } from '../types.js';

export const migration: Migration = {
  id: 2,
  name: 'gitlab_oauth',
  up: async (db: Redis) => {
    const USERS_KEY = 'teamtree:users';
    const all = await db.hgetall(USERS_KEY);
    if (!all) return;

    const pipeline = db.pipeline();
    let patched = 0;

    for (const [id, json] of Object.entries(all)) {
      let user: User;
      try {
        user = JSON.parse(json) as User;
      } catch {
        console.warn(`[migrate:002] Skipping corrupt user record id=${id}`);
        continue;
      }

      // Ensure the record can be re-serialised cleanly (self-heal corrupt escaping).
      const repacked = JSON.stringify(user);
      if (repacked !== json) {
        pipeline.hset(USERS_KEY, id, repacked);
        patched++;
      }
    }

    if (patched > 0) {
      await pipeline.exec();
      console.log(`[migrate:002] Re-serialised ${patched} user record(s).`);
    }
  },
};
