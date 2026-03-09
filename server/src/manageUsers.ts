/**
 * manageUsers.ts – CLI tool for user administration
 *
 * Usage:
 *   yarn users               # list all users
 *   yarn users promote <id>  # grant manager role to a user by id or username
 *   yarn users demote  <id>  # revoke manager role (back to 'user')
 */

import 'dotenv/config';
import { db, KEYS } from './db.js';
import type { User } from './types.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function pad(str: string, len: number) {
  return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length);
}

async function loadUsers(): Promise<User[]> {
  const raw = await db.hgetall(KEYS.users);
  return Object.values(raw as Record<string, string>).map((v) => JSON.parse(v) as User);
}

async function findUser(idOrUsername: string): Promise<User | undefined> {
  const users = await loadUsers();
  return users.find((u) => u.id === idOrUsername || u.username === idOrUsername);
}

// ── Commands ──────────────────────────────────────────────────────────────────

async function listUsers() {
  const users = await loadUsers();

  if (users.length === 0) {
    console.log('No users found in the database.');
    return;
  }

  users.sort((a, b) => a.username.localeCompare(b.username));

  const header = [
    pad('ID',          36),
    pad('Username',    20),
    pad('Display name',24),
    pad('Role',         8),
    pad('Auth',        10),
    'Team member ID',
  ].join('  ');

  const divider = '-'.repeat(header.length);

  console.log('\n' + divider);
  console.log(header);
  console.log(divider);

  for (const u of users) {
    const auth = u.gitlabId !== undefined ? 'GitLab' : 'Local';
    const display = u.displayName ?? '—';
    const teamMemberId = u.teamMemberId ?? '—';
    console.log([
      pad(u.id,           36),
      pad(u.username,     20),
      pad(display,        24),
      pad(u.role,          8),
      pad(auth,           10),
      teamMemberId,
    ].join('  '));
  }

  console.log(divider + '\n');
  console.log(`Total: ${users.length} user(s)\n`);
}

async function setRole(idOrUsername: string, role: 'manager' | 'user') {
  const user = await findUser(idOrUsername);

  if (!user) {
    console.error(`❌  User not found: "${idOrUsername}"`);
    process.exit(1);
  }

  if (user.role === role) {
    console.log(`ℹ️   "${user.username}" already has role "${role}". Nothing to do.`);
    return;
  }

  const prev = user.role;
  user.role  = role;
  await db.hset(KEYS.users, user.id, JSON.stringify(user));

  console.log(`✅  "${user.username}" (${user.id}): ${prev} → ${role}`);
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main() {
  const [,, command, arg] = process.argv;

  try {
    if (!command || command === 'list') {
      await listUsers();
    } else if (command === 'promote') {
      if (!arg) { console.error('Usage: yarn users promote <id|username>'); process.exit(1); }
      await setRole(arg, 'manager');
    } else if (command === 'demote') {
      if (!arg) { console.error('Usage: yarn users demote <id|username>'); process.exit(1); }
      await setRole(arg, 'user');
    } else {
      console.error(`Unknown command: "${command}". Available: list, promote, demote`);
      process.exit(1);
    }
  } finally {
    await db.quit();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
