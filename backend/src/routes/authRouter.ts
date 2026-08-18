import { Router } from 'express';
import { Role } from '@prisma/client';
import prisma from '../database';
import { assertPasswordPolicy, createAccessToken, hashPassword, verifyPassword } from '../auth';
import { requireAuth, AuthenticatedRequest } from '../middleware';
import { rateLimit } from '../rateLimit';
import { revokeToken } from '../revocation';
import { isValidEmail, requireString, ValidationError, optionalString } from '../validation';

const router = Router();

router.post('/register', rateLimit('register', 5, 900), async (req, res, next) => {
  try {
    const email = requireString(req.body?.email, 'email', 3, 254).toLowerCase();
    const password = requireString(req.body?.password, 'password', 12, 128);
    assertPasswordPolicy(password);
    const requestedRole = req.body?.role;
    if (!['CLIENT', 'PROFESSIONAL'].includes(requestedRole)) throw new ValidationError('role must be CLIENT or PROFESSIONAL');
    if (!isValidEmail(email)) throw new ValidationError('email is invalid');
    const name = optionalString(req.body?.name, 'name', 100) ?? email.split('@')[0];
    const user = await prisma.user.create({
      data: { email, password: await hashPassword(password), role: requestedRole as Role, profile: { create: { name, tags: [] } } },
      select: { id: true, email: true, role: true, profile: true }
    });
    res.status(201).json({ message: 'User registered successfully', user });
  } catch (error) {
    next(error);
  }
});

router.post('/login', rateLimit('login', 10, 900), async (req, res, next) => {
  try {
    const email = requireString(req.body?.email, 'email', 3, 254).toLowerCase();
    const password = requireString(req.body?.password, 'password', 1, 128);
    if (!isValidEmail(email)) throw new ValidationError('email or password is invalid');
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, password: true, role: true, profile: true } });
    if (!user || !(await verifyPassword(password, user.password))) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }
    res.json({ message: 'Login successful', token: createAccessToken(user), user: { id: user.id, email: user.email, role: user.role, profile: user.profile } });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    const header = req.get('authorization')!;
    const token = header.slice(7).trim();
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')) as { exp: number };
    await revokeToken(token, claims.exp);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const record = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true, email: true, role: true, profile: true } });
    if (!record) { res.status(401).json({ error: 'User no longer exists' }); return; }
    res.json(record);
  } catch (error) {
    next(error);
  }
});

export default router;
