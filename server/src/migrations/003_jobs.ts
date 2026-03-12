/**
 * Migration 003 – Jobs
 *
 * Covers two related additions that landed after migration 002:
 *
 * 1. New key:
 *      teamtree:jobs  – Hash  { id → JSON<JobSheet> }
 *    Self-managed by the /api/jobs route; no data pre-population needed.
 *
 * 2. JobSheet shape change:
 *    The initial version of JobSheet (commit 9a36fc3) stored required skills as
 *    a plain string array:
 *      requiredSkills?: string[]
 *    This was superseded (commit 694d15d) by a rated map:
 *      skillRatings?: Record<string, number>
 *
 *    Any record written between those two commits may carry the old field.
 *    This migration scans every JobSheet and, if it finds a legacy
 *    `requiredSkills` array, converts it to `skillRatings` (rating = 0 for
 *    each skill since no star value was stored before) and removes the
 *    obsolete field.
 */
import type { Redis } from 'ioredis';
import type { Migration } from './types.js';
import type { JobSheet } from '../types.js';

type LegacyJobSheet = JobSheet & { requiredSkills?: string[] };

export const migration: Migration = {
  id: 3,
  name: 'jobs',
  up: async (db: Redis) => {
    const JOBS_KEY = 'teamtree:jobs';
    const all = await db.hgetall(JOBS_KEY);
    if (!all || Object.keys(all).length === 0) return;

    const pipeline = db.pipeline();
    let patched = 0;

    for (const [id, json] of Object.entries(all)) {
      let job: LegacyJobSheet;
      try {
        job = JSON.parse(json) as LegacyJobSheet;
      } catch {
        console.warn(`[migrate:003] Skipping corrupt job record id=${id}`);
        continue;
      }

      if (!Array.isArray(job.requiredSkills)) continue;

      // Convert the string array to a rating map with 0 as the default value.
      const skillRatings: Record<string, number> = {};
      for (const skillId of job.requiredSkills) {
        skillRatings[skillId] = 0;
      }

      const { requiredSkills: _removed, ...rest } = job;
      const updated: JobSheet = { ...rest, skillRatings };

      pipeline.hset(JOBS_KEY, id, JSON.stringify(updated));
      patched++;
    }

    if (patched > 0) {
      await pipeline.exec();
      console.log(`[migrate:003] Converted requiredSkills → skillRatings for ${patched} job record(s).`);
    }
  },
};
