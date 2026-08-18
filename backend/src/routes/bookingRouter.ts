import { Router } from 'express';
import prisma from '../database';
import { requireAuth, AuthenticatedRequest } from '../middleware';
import { rateLimit } from '../rateLimit';
import { requireString, ValidationError, optionalString } from '../validation';

const router = Router();

router.post('/', requireAuth, rateLimit('bookings', 20, 60), async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    if (user.role !== 'CLIENT') {
      res.status(403).json({ error: 'Only clients can book professionals' });
      return;
    }
    const profileId = requireString(req.body?.profileId, 'profileId', 1, 100);
    const date = new Date(requireString(req.body?.date, 'date', 1, 64));
    if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) throw new ValidationError('date must be a future date');
    const notes = optionalString(req.body?.notes, 'notes', 2000);
    const profile = await prisma.profile.findUnique({ where: { id: profileId }, select: { id: true } });
    if (!profile) { res.status(404).json({ error: 'Professional profile not found' }); return; }
    const booking = await prisma.booking.create({ data: { clientId: user.id, profileId, date, notes }, select: { id: true, profileId: true, date: true, status: true, notes: true, createdAt: true } });
    res.status(201).json(booking);
  } catch (error) {
    next(error);
  }
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const bookings = await prisma.booking.findMany({
      where: { OR: [{ clientId: user.id }, { profile: { userId: user.id } }] },
      orderBy: { date: 'desc' }, take: 100,
      select: { id: true, clientId: true, profileId: true, date: true, status: true, notes: true, createdAt: true }
    });
    res.json({ data: bookings });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/cancel', requireAuth, async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const id = requireString(req.params.id, 'id', 1, 100);
    const booking = await prisma.booking.findFirst({ where: { id, OR: [{ clientId: user.id }, { profile: { userId: user.id } }] } });
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return; }
    const updated = await prisma.booking.update({ where: { id }, data: { status: 'CANCELLED' }, select: { id: true, status: true } });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

export default router;
