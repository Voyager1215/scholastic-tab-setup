#!/usr/bin/env node
/**
 * Creates (or resets) an administrator account.
 *
 * The password hash format matches the Worker's PBKDF2 implementation
 * exactly: `pbkdf2$<iterations>$<salt-b64>$<hash-b64>`.
 *
 *   node scripts/create-admin.mjs admin "my password"              # prints SQL
 *   node scripts/create-admin.mjs admin "my password" --apply      # local D1
 *   node scripts/create-admin.mjs admin "my password" --apply --remote
 */
import { execFileSync } from 'node:child_process';
import { pbkdf2Sync, randomBytes, randomUUID } from 'node:crypto';

const ITERATIONS = 100_000;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

const [, , username, password, ...flags] = process.argv;

if (!username || !password) {
  console.error('Usage: node scripts/create-admin.mjs <username> <password> [--apply] [--remote]');
  process.exit(1);
}

const apply = flags.includes('--apply');
const remote = flags.includes('--remote');

const salt = randomBytes(SALT_LENGTH);
const derived = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha256');
const hash = `pbkdf2$${ITERATIONS}$${salt.toString('base64')}$${derived.toString('base64')}`;

const sql = `INSERT INTO admins (id, username, password_hash) VALUES ('${randomUUID()}', '${username.replace(/'/g, "''")}', '${hash}')
ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash;`;

if (apply) {
  const target = remote ? 'remote' : 'local';
  console.log(`Applying the administrator to the ${target} D1 database…`);
  execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', 'media-db', `--${target}`, '--command', sql],
    { stdio: 'inherit' },
  );
  console.log(`Administrator "${username}" is ready on the ${target} database.`);
} else {
  console.log('Run this SQL against the D1 database:\n');
  console.log(sql);
  console.log('\nOr re-run with --apply (add --remote for the deployed database).');
}
