import crypto from 'crypto';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function createTotpSecret() {
  return base32Encode(crypto.randomBytes(20));
}

export function createOtpAuthUri(secret, email) {
  const label = encodeURIComponent(`Nuvanti:${email}`);
  const query = new URLSearchParams({ secret, issuer: 'Nuvanti', algorithm: 'SHA1', digits: '6', period: '30' });
  return `otpauth://totp/${label}?${query}`;
}

export function encryptTotpSecret(secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.');
}

export function decryptTotpSecret(value) {
  const [iv, tag, encrypted] = String(value || '').split('.').map((part) => Buffer.from(part, 'base64url'));
  if (!iv || iv.length !== 12 || !tag || tag.length !== 16 || !encrypted?.length) throw new Error('Invalid encrypted authenticator secret.');
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch {
    const error = new Error('The authenticator secret could not be decrypted. Restore the original MFA_ENCRYPTION_KEY in Railway; do not rotate this key after setting up MFA.');
    error.status = 503;
    throw error;
  }
}

export function verifyTotp(secret, code, now = Date.now()) {
  if (!/^\d{6}$/.test(String(code || ''))) return null;
  const current = Math.floor(now / 30_000);
  for (const step of [current + 1, current, current - 1]) {
    const expected = totpAt(secret, step);
    const providedBytes = Buffer.from(String(code));
    const expectedBytes = Buffer.from(expected);
    if (crypto.timingSafeEqual(providedBytes, expectedBytes)) return step;
  }
  return null;
}

export function createRecoveryCodes(count = 10) {
  const codes = Array.from({ length: count }, () => crypto.randomBytes(8).toString('hex').toUpperCase().match(/.{1,4}/g).join('-'));
  return { codes, hashes: codes.map(hashRecoveryCode) };
}

export function hashRecoveryCode(code) {
  const normalized = String(code || '').replace(/[^a-f0-9]/gi, '').toUpperCase();
  if (!/^[A-F0-9]{16}$/.test(normalized)) return '';
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function totpAt(secret, step) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = crypto.createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
  return String(binary % 1_000_000).padStart(6, '0');
}

function encryptionKey() {
  const secret = process.env.MFA_ENCRYPTION_KEY;
  if (!secret || secret.length < 32 || /replace-with|example|paste[_ -]?your/i.test(secret)) {
    const error = new Error('Set MFA_ENCRYPTION_KEY to a stable random value of at least 32 characters before enabling two-factor authentication.');
    error.status = 503;
    throw error;
  }
  return Buffer.from(crypto.hkdfSync('sha256', Buffer.from(secret), Buffer.from('nuvanti-mfa-v1'), Buffer.from('totp-secret-encryption'), 32));
}

function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits) output += BASE32[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(value) {
  let bits = 0;
  let accumulator = 0;
  const output = [];
  for (const character of String(value).toUpperCase().replace(/=+$/g, '')) {
    const index = BASE32.indexOf(character);
    if (index < 0) throw new Error('Invalid authenticator secret.');
    accumulator = (accumulator << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((accumulator >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}
