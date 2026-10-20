/**
 * Password hashing and token helpers.
 *
 * PBKDF2-HMAC-SHA256 is used because Web Crypto has it built in, so the
 * Worker needs no native dependencies. The format is
 * `pbkdf2$<iterations>$<salt-b64>$<hash-b64>` which `scripts/create-admin.mjs`
 * reproduces byte for byte with Node's crypto module.
 *
 * 100000 iterations is the maximum the Workers runtime allows for PBKDF2
 * (`NotSupportedError: iteration counts above 100000 are not supported`).
 * The count is stored inside the hash, so it can be raised later if the
 * platform ever lifts the cap.
 */

const ITERATIONS = 100_000;
const KEY_LENGTH_BITS = 256;

/** The Workers runtime refuses PBKDF2 above this many iterations. */
export const MAX_ITERATIONS = 100_000;

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function randomToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await derive(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(derived)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;

  const iterations = Number.parseInt(parts[1], 10);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  // The Workers runtime refuses more than 100000 PBKDF2 iterations, so a
  // hash stored with a higher count can never be verified.
  if (iterations > MAX_ITERATIONS) return false;

  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = base64ToBytes(parts[2]);
    expected = base64ToBytes(parts[3]);
  } catch {
    return false;
  }

  const actual = await derive(password, salt, iterations).catch(() => null);
  if (!actual || actual.length !== expected.length) return false;

  // Constant time comparison.
  let diff = 0;
  for (let i = 0; i < actual.length; i += 1) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    key,
    KEY_LENGTH_BITS,
  );
  return new Uint8Array(bits);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
