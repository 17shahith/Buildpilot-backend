import assert from 'node:assert/strict';
import test from 'node:test';

test('passwords are hashed and verified without storing plaintext', async () => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  process.env.JWT_SECRET = 'test-secret-that-is-longer-than-32-characters';
  const { hashPassword, verifyPassword } = await import('./auth');
  const password = 'correct horse battery staple';
  const hash = await hashPassword(password);
  assert.notEqual(hash, password);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword('wrong password', hash), false);
});

test('tampered access tokens are rejected', async () => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  process.env.JWT_SECRET = 'test-secret-that-is-longer-than-32-characters';
  const { createAccessToken, verifyAccessToken } = await import('./auth');
  const token = createAccessToken({ id: 'user-1', role: 'CLIENT' });
  assert.equal(verifyAccessToken(token).sub, 'user-1');
  assert.throws(() => verifyAccessToken(`${token}tampered`));
});

