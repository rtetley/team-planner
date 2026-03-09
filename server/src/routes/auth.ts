import { Hono } from 'hono';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { db, KEYS } from '../db.js';
import type { User, PublicUser } from '../types.js';

const scryptAsync = promisify(scrypt);

// Session TTL: 24 hours
const SESSION_TTL = 60 * 60 * 24;
// OAuth state TTL: 10 minutes
const STATE_TTL = 60 * 10;

// ── GitLab OAuth config ───────────────────────────────────────────────────────
const GITLAB_URL         = (process.env.GITLAB_URL         ?? 'https://gitlab.com').replace(/\/$/, '');
const GITLAB_CLIENT_ID   = process.env.GITLAB_CLIENT_ID   ?? '';
const GITLAB_CLIENT_SECRET = process.env.GITLAB_CLIENT_SECRET ?? '';
const GITLAB_REDIRECT_URI  = process.env.GITLAB_REDIRECT_URI  ?? 'http://localhost:3001/api/auth/gitlab/callback';
const FRONTEND_URL         = (process.env.FRONTEND_URL        ?? 'http://localhost:5173').replace(/\/$/, '');

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Hash a plain-text password: returns "salt:hash" */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}

/** Compare a plain-text password against a stored "salt:hash" */
async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hashHex] = stored.split(':');
  if (!salt || !hashHex) return false;
  const storedBuf = Buffer.from(hashHex, 'hex');
  const derivedBuf = (await scryptAsync(password, salt, 64)) as Buffer;
  if (storedBuf.length !== derivedBuf.length) return false;
  return timingSafeEqual(storedBuf, derivedBuf);
}

/** Generate a secure random session token */
function generateToken(): string {
  return randomBytes(32).toString('hex');
}

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    teamMemberId: user.teamMemberId,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
  };
}

// ── Route ────────────────────────────────────────────────────────────────────

export const authRoute = new Hono();

/** POST /api/auth/login */
authRoute.post('/login', async (c) => {
  const body = await c.req.json() as { username?: string; password?: string };

  if (!body.username || !body.password) {
    return c.json({ error: 'username and password are required' }, 400);
  }

  const username = body.username;
  const password = body.password;

  // Look up user by username (scan all users)
  const all = await db.hgetall(KEYS.users);
  const userJson = Object.values(all as Record<string, string>).find((v) => {
    try { return (JSON.parse(v) as User).username === username; }
    catch { return false; }
  }) as string | undefined;

  if (!userJson) return c.json({ error: 'Invalid credentials' }, 401);

  const user: User = JSON.parse(userJson as string);

  if (!user.passwordHash) {
    // This account uses GitLab OAuth and has no local password
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return c.json({ error: 'Invalid credentials' }, 401);

  // Create session in Redis with TTL
  const token = generateToken();
  await db.setex(`${KEYS.sessions}:${token}`, SESSION_TTL, user.id);

  return c.json({ token, user: toPublicUser(user) });
});

/** POST /api/auth/logout */
authRoute.post('/logout', async (c) => {
  const auth = c.req.header('Authorization') ?? '';
  const token = auth.replace('Bearer ', '').trim();
  if (token) await db.del(`${KEYS.sessions}:${token}`);
  return c.json({ ok: true });
});

/** GET /api/auth/me */
authRoute.get('/me', async (c) => {
  const auth = c.req.header('Authorization') ?? '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) return c.json({ error: 'Not authenticated' }, 401);

  const userId = await db.get(`${KEYS.sessions}:${token}`);
  if (!userId) return c.json({ error: 'Session expired or invalid' }, 401);

  const userJson = await db.hget(KEYS.users, userId);
  if (!userJson) return c.json({ error: 'User not found' }, 401);

  const user: User = JSON.parse(userJson);
  return c.json({ user: toPublicUser(user) });
});

// ── GitLab OAuth ──────────────────────────────────────────────────────────────

/** GET /api/auth/gitlab — initiates the GitLab OAuth flow */
authRoute.get('/gitlab', (c) => {
  if (!GITLAB_CLIENT_ID) {
    return c.json({ error: 'GitLab OAuth is not configured on this server' }, 503);
  }

  const state = randomBytes(16).toString('hex');
  // Fire-and-forget: store state with TTL; don't need to await for the redirect
  void db.setex(`${KEYS.oauthStates}:${state}`, STATE_TTL, '1');

  const params = new URLSearchParams({
    client_id:     GITLAB_CLIENT_ID,
    redirect_uri:  GITLAB_REDIRECT_URI,
    response_type: 'code',
    state,
    scope:         'read_user',
  });

  return c.redirect(`${GITLAB_URL}/oauth/authorize?${params}`);
});

/** GET /api/auth/gitlab/callback — GitLab redirects here after authorization */
authRoute.get('/gitlab/callback', async (c) => {
  const code  = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  if (error) {
    return c.redirect(`${FRONTEND_URL}/login?error=gitlab_denied`);
  }

  // Validate CSRF state
  if (!state) {
    return c.redirect(`${FRONTEND_URL}/login?error=invalid_state`);
  }
  const stateKey   = `${KEYS.oauthStates}:${state}`;
  const stateValid = await db.get(stateKey);
  if (!stateValid) {
    return c.redirect(`${FRONTEND_URL}/login?error=invalid_state`);
  }
  await db.del(stateKey);

  if (!code) {
    return c.redirect(`${FRONTEND_URL}/login?error=missing_code`);
  }

  // Exchange authorization code for an access token
  let accessToken: string;
  try {
    const tokenRes = await fetch(`${GITLAB_URL}/oauth/token`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id:     GITLAB_CLIENT_ID,
        client_secret: GITLAB_CLIENT_SECRET,
        code,
        grant_type:    'authorization_code',
        redirect_uri:  GITLAB_REDIRECT_URI,
      }),
    });
    if (!tokenRes.ok) throw new Error(`token endpoint ${tokenRes.status}`);
    const data = await tokenRes.json() as { access_token?: string; error?: string };
    if (!data.access_token) throw new Error(data.error ?? 'no access_token');
    accessToken = data.access_token;
  } catch (err) {
    console.error('[GitLab OAuth] token exchange failed:', err);
    return c.redirect(`${FRONTEND_URL}/login?error=token_exchange_failed`);
  }

  // Fetch the GitLab user profile
  let gitlabUser: { id: number; username: string; name: string; avatar_url: string };
  try {
    const userRes = await fetch(`${GITLAB_URL}/api/v4/user`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });
    if (!userRes.ok) throw new Error(`user endpoint ${userRes.status}`);
    gitlabUser = await userRes.json() as typeof gitlabUser;
  } catch (err) {
    console.error('[GitLab OAuth] user fetch failed:', err);
    return c.redirect(`${FRONTEND_URL}/login?error=user_fetch_failed`);
  }

  // Find or create the local user record
  let userId = await db.hget(KEYS.gitlabIds, String(gitlabUser.id));

  if (!userId) {
    userId = randomBytes(16).toString('hex');
    const newUser: User = {
      id:          userId,
      username:    gitlabUser.username,
      role:        'user',
      gitlabId:    gitlabUser.id,
      displayName: gitlabUser.name,
      avatarUrl:   gitlabUser.avatar_url,
    };
    await db.hset(KEYS.users,      userId,                  JSON.stringify(newUser));
    await db.hset(KEYS.gitlabIds,  String(gitlabUser.id),   userId);
  } else {
    // Keep profile info in sync with GitLab
    const existingJson = await db.hget(KEYS.users, userId);
    if (existingJson) {
      const existing: User = JSON.parse(existingJson);
      existing.displayName = gitlabUser.name;
      existing.avatarUrl   = gitlabUser.avatar_url;
      await db.hset(KEYS.users, userId, JSON.stringify(existing));
    }
  }

  // Create a session and redirect back to the frontend
  const sessionToken = generateToken();
  await db.setex(`${KEYS.sessions}:${sessionToken}`, SESSION_TTL, userId);

  return c.redirect(`${FRONTEND_URL}/auth/callback?token=${sessionToken}`);
});
