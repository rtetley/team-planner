/**
 * env.ts — Environment variable loader
 *
 * Loads dotenv files in priority order (later files win):
 *   1. .env                          — shared baseline (always loaded if present)
 *   2. .env.<NODE_ENV>               — environment-specific overrides
 *
 * Import this module once at the top of every entry point instead of
 * `import 'dotenv/config'`.
 *
 * Example filenames for NODE_ENV=production:
 *   .env, .env.production
 */

import { config } from 'dotenv';
import { resolve } from 'node:path';

const root = new URL('..', import.meta.url).pathname;

// 1. Shared baseline
config({ path: resolve(root, '.env') });

// 2. Environment-specific overrides (takes precedence)
const env = process.env.NODE_ENV ?? 'development';
config({ path: resolve(root, `.env.${env}`), override: true });
