import Redis from 'ioredis';

const VALKEY_URL = process.env.VALKEY_URL ?? 'redis://127.0.0.1:6379';

export const db = new Redis(VALKEY_URL, {
  lazyConnect: false,
  maxRetriesPerRequest: 3,
});

db.on('error', (err) => console.error('[Valkey] Connection error:', err));
db.on('connect', () => console.log('[Valkey] Connected to', VALKEY_URL));

export const KEYS = {
  members:     'teamtree:members',
  projects:    'teamtree:projects',
  tasks:       'teamtree:tasks',
  objectives:  'teamtree:objectives',
  matrix:      'teamtree:matrix',
  skillMatrix: 'teamtree:skill-matrix',
} as const;
