import type { Redis } from 'ioredis';

export interface Migration {
  /** Monotonically increasing integer (1, 2, …) */
  id: number;
  /** Human-readable snake_case description */
  name: string;
  /** Applies the migration. Must be idempotent when possible. */
  up: (db: Redis) => Promise<void>;
}
