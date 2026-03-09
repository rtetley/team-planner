/**
 * Migration 001 – Initial schema
 *
 * Baseline migration that formalises the schema in place when the migration
 * system was introduced.  No data transformation is required; this migration
 * simply records that version 1 has been reached.
 *
 * Redis keys in scope:
 *   teamtree:members      – Hash  { id → JSON<TeamMember> }
 *   teamtree:projects     – Hash  { id → JSON<Project> }
 *   teamtree:tasks        – Hash  { id → JSON<Task> }
 *   teamtree:objectives   – Hash  { id → JSON<Objective> }
 *   teamtree:matrix       – Hash  { "memberId:taskId" → MaturityLevel }
 *   teamtree:skill-matrix – Hash  { "memberId:skillId" → MaturityLevel }
 *   teamtree:skill-tree   – String JSON<SkillTreeDoc>
 *   teamtree:users        – Hash  { id → JSON<User> }
 *   teamtree:sessions     – String keys with TTL (session token → userId)
 *   teamtree:skill-points – Hash  { nodeId → points (number as string) }
 */
import type { Redis } from 'ioredis';
import type { Migration } from './types.js';

export const migration: Migration = {
  id: 1,
  name: 'initial_schema',
  up: async (_db: Redis) => {
    // No-op: this migration only records the baseline version.
  },
};
