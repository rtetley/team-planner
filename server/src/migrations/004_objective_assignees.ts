/**
 * Migration 004 – Objective assignees
 *
 * Adds the `assigneeIds` field (string[]) to every existing Objective record.
 * Objectives created before this migration have no assignees, so we default
 * the field to an empty array to ensure a consistent shape.
 */
import type { Redis } from 'ioredis';
import type { Migration } from './types.js';
import type { Objective } from '../types.js';

export const migration: Migration = {
  id: 4,
  name: 'objective-assignees',
  up: async (db: Redis) => {
    const OBJECTIVES_KEY = 'teamtree:objectives';
    const all = await db.hgetall(OBJECTIVES_KEY);
    if (!all || Object.keys(all).length === 0) return;

    const pipeline = db.pipeline();
    let patched = 0;

    for (const [id, json] of Object.entries(all)) {
      let objective: Objective & { assigneeIds?: string[] };
      try {
        objective = JSON.parse(json) as Objective;
      } catch {
        console.warn(`[migrate:004] Skipping corrupt objective record id=${id}`);
        continue;
      }

      if (Array.isArray(objective.assigneeIds)) continue;

      objective.assigneeIds = [];
      pipeline.hset(OBJECTIVES_KEY, id, JSON.stringify(objective));
      patched++;
    }

    if (patched > 0) {
      await pipeline.exec();
      console.log(`[migrate:004] Patched ${patched} objective record(s) with assigneeIds=[]`);
    }
  },
};
