import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

export function verifyPassword(password, hash) {
  const [salt, stored] = hash.split(':');
  const result = scryptSync(password, salt, 64);
  const expected = Buffer.from(stored, 'hex');
  return result.length === expected.length && timingSafeEqual(result, expected);
}
